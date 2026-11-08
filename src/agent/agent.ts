import Anthropic from "@anthropic-ai/sdk";
import { anthropicTools, runTool } from "../tools/index.ts";
import { checkGrounding, type GroundingReport } from "./grounding.ts";
import { SYSTEM_PROMPT } from "./prompt.ts";

/** Chosen by measurement (docs/MODEL_CHOICE.md): passes the eval at roughly half the cost of Opus. Override with ANTHROPIC_MODEL. */
export const DEFAULT_MODEL = "claude-sonnet-5-5";

type Msg = Anthropic.Beta.BetaMessageParam;
type ToolResultBlock = Anthropic.Beta.BetaToolResultBlockParam;

export type AgentEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_call"; id: string; name: string; input: unknown }
  | { type: "tool_result"; id: string; name: string; ok: boolean; ms: number; bytes: number; content: string }
  | { type: "notice"; message: string };

export interface TurnResult {
  text: string;
  toolCalls: { name: string; input: unknown; ok: boolean }[];
  grounding: GroundingReport;
  stopReason: string | null;
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
  iterations: number;
}

/** The small slice of the SDK the agent uses, so tests can inject a fake. */
export interface MessagesClient {
  beta: {
    messages: {
      stream(params: Anthropic.Beta.MessageCreateParamsNonStreaming): {
        on(event: "text", cb: (delta: string) => void): unknown;
        finalMessage(): Promise<Anthropic.Beta.BetaMessage>;
      };
    };
  };
}

export interface AgentOptions {
  client?: MessagesClient;
  model?: string;
  maxToolRounds?: number;
  /** Server-side refusal fallback (Claude API only). On by default. */
  fallbacks?: boolean;
  effort?: "low" | "medium" | "high";
}

/** What the web server needs from an agent; lets tests and demo mode substitute their own. */
export interface ChatAgent {
  readonly model: string;
  send(userText: string, onEvent?: (e: AgentEvent) => void): Promise<TurnResult>;
}

export class Agent implements ChatAgent {
  readonly messages: Msg[] = [];
  private readonly client: MessagesClient;
  readonly model: string;
  private readonly maxToolRounds: number;
  private readonly fallbacks: boolean;
  private readonly effort: "low" | "medium" | "high";
  private readonly tools = anthropicTools();
  /** Raw tool outputs for the whole conversation, used for grounding checks on follow-ups too. */
  private readonly toolOutputs: string[] = [];

  constructor(opts: AgentOptions = {}) {
    this.client = opts.client ?? (new Anthropic() as unknown as MessagesClient);
    this.model = opts.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
    this.maxToolRounds = opts.maxToolRounds ?? 8;
    this.fallbacks = opts.fallbacks ?? process.env.ANTHROPIC_FALLBACKS !== "off";
    const envEffort = process.env.ANTHROPIC_EFFORT;
    this.effort = opts.effort ?? (envEffort === "low" || envEffort === "medium" || envEffort === "high" ? envEffort : "medium");
  }

  /** Send one user message and run the tool loop to completion. History is kept on the instance. */
  async send(userText: string, onEvent: (e: AgentEvent) => void = () => {}): Promise<TurnResult> {
    this.messages.push({ role: "user", content: userText });
    const toolCalls: TurnResult["toolCalls"] = [];
    const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    const turnOutputs: string[] = [];
    let text = "";
    let stopReason: string | null = null;
    let iterations = 0;

    for (; iterations < this.maxToolRounds + 1; iterations++) {
      const stream = this.client.beta.messages.stream({
        model: this.model,
        max_tokens: 16000,
        // Top-level cache_control caches the longest stable prefix (tools + system + earlier turns).
        cache_control: { type: "ephemeral" },
        system: SYSTEM_PROMPT,
        tools: this.tools,
        messages: this.messages,
        output_config: { effort: this.effort },
        ...(this.fallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      });
      stream.on("text", (d) => onEvent({ type: "text_delta", text: d }));
      const msg = await stream.finalMessage();

      usage.input += msg.usage.input_tokens;
      usage.output += msg.usage.output_tokens;
      usage.cacheRead += msg.usage.cache_read_input_tokens ?? 0;
      usage.cacheWrite += msg.usage.cache_creation_input_tokens ?? 0;
      stopReason = msg.stop_reason;

      // Keep the assistant turn exactly as returned (thinking blocks included); the API needs it unchanged.
      this.messages.push({ role: "assistant", content: msg.content as unknown as Anthropic.Beta.BetaContentBlockParam[] });

      for (const b of msg.content) if (b.type === "fallback") onEvent({ type: "notice", message: "A safety fallback model continued this answer." });

      if (msg.stop_reason === "tool_use") {
        const uses = msg.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
        for (const u of uses) onEvent({ type: "tool_call", id: u.id, name: u.name, input: u.input });
        // Independent calls run concurrently; ALL results go back in one user message.
        const results: ToolResultBlock[] = await Promise.all(
          uses.map(async (u) => {
            const t0 = Date.now();
            const r = await runTool(u.name, u.input);
            toolCalls.push({ name: u.name, input: u.input, ok: !r.is_error });
            turnOutputs.push(r.content);
            this.toolOutputs.push(r.content);
            onEvent({ type: "tool_result", id: u.id, name: u.name, ok: !r.is_error, ms: Date.now() - t0, bytes: r.content.length, content: r.content });
            return { type: "tool_result" as const, tool_use_id: u.id, content: r.content, ...(r.is_error ? { is_error: true } : {}) };
          }),
        );
        this.messages.push({ role: "user", content: results });
        continue;
      }
      if (msg.stop_reason === "pause_turn") continue;

      text = msg.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
      if (msg.stop_reason === "max_tokens") onEvent({ type: "notice", message: "The answer hit the length limit and may be cut off." });
      if (msg.stop_reason === "refusal") {
        text ||= "I can't help with that request.";
        onEvent({ type: "notice", message: "The model declined this request." });
      }
      break;
    }

    if (!text && stopReason === "tool_use") {
      text = "I reached the limit on tool calls for one question before finishing. Please narrow the question and I will try again.";
      onEvent({ type: "notice", message: `Stopped after ${this.maxToolRounds} tool rounds.` });
    }
    return { text, toolCalls, grounding: checkGrounding(text, this.toolOutputs), stopReason, usage, iterations: iterations + 1 };
  }
}
