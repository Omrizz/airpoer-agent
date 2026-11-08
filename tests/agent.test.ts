import { describe, expect, it } from "vitest";
import { Agent, type AgentEvent, type MessagesClient } from "../src/agent/agent.ts";
import { checkGrounding, extractNumbers, harvestNumbers } from "../src/agent/grounding.ts";

/** A scripted stand-in for the model: returns canned responses in order and records the requests. */
function fakeClient(script: any[]) {
  const requests: any[] = [];
  const client: MessagesClient = {
    beta: {
      messages: {
        stream(params: any) {
          requests.push(structuredClone(params));
          const msg = script.shift();
          if (!msg) throw new Error("script exhausted");
          const handlers: ((d: string) => void)[] = [];
          return {
            on(_e: "text", cb: (d: string) => void) { handlers.push(cb); return this; },
            async finalMessage() {
              for (const b of msg.content) if (b.type === "text") handlers.forEach((h) => h(b.text));
              return { usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 50, cache_creation_input_tokens: 0 }, ...msg };
            },
          };
        },
      },
    },
  };
  return { client, requests };
}

const toolUse = (id: string, name: string, input: unknown) => ({ type: "tool_use", id, name, input });
const text = (t: string) => ({ type: "text", text: t });

describe("Agent loop", () => {
  it("runs a tool, returns results in ONE user message, and answers", async () => {
    const { client, requests } = fakeClient([
      { stop_reason: "tool_use", content: [{ type: "thinking", thinking: "", signature: "sig" }, toolUse("t1", "get_methodology", {}), toolUse("t2", "get_methodology", {})] },
      { stop_reason: "end_turn", content: [text("It uses four components.")] },
    ]);
    const events: AgentEvent[] = [];
    const agent = new Agent({ client });
    const res = await agent.send("How does scoring work?", (e) => events.push(e));

    expect(res.text).toBe("It uses four components.");
    expect(res.toolCalls.map((c) => c.name)).toEqual(["get_methodology", "get_methodology"]);
    expect(res.iterations).toBe(2);
    expect(res.usage.cacheRead).toBe(100);

    // Second request carries: user, assistant (with thinking block preserved), ONE user message holding both tool_results.
    const second = requests[1].messages;
    expect(second.map((m: any) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(second[1].content[0].type).toBe("thinking");
    expect(second[2].content).toHaveLength(2);
    expect(second[2].content.map((b: any) => b.tool_use_id).sort()).toEqual(["t1", "t2"]);

    expect(events.map((e) => e.type)).toEqual(["tool_call", "tool_call", "tool_result", "tool_result", "text_delta"]);
  });

  it("sends tools, a static system prompt, caching, effort and fallbacks", async () => {
    const { client, requests } = fakeClient([{ stop_reason: "end_turn", content: [text("hi")] }]);
    await new Agent({ client, model: "claude-opus-5-5" }).send("hello");
    const r = requests[0];
    expect(r.model).toBe("claude-opus-5-5");
    expect(r.tools.map((t: any) => t.name)).toContain("rank_airports");
    expect(r.cache_control).toEqual({ type: "ephemeral" });
    expect(r.output_config.effort).toBe("medium");
    expect(r.fallbacks).toBe("default");
    expect(r.betas).toContain("server-side-fallback-2026-07-01");
    expect(r.thinking).toBeUndefined(); // thinking is on by default; never send "disabled"
    expect(r.tool_choice).toBeUndefined(); // forced tool use is not supported on this model
  });

  it("defaults to Sonnet 5.5 unless overridden", () => {
    const saved = process.env.ANTHROPIC_MODEL;
    delete process.env.ANTHROPIC_MODEL;
    const { client } = fakeClient([]);
    expect(new Agent({ client }).model).toBe("claude-sonnet-5-5");
    expect(new Agent({ client, model: "claude-opus-5-5" }).model).toBe("claude-opus-5-5");
    if (saved !== undefined) process.env.ANTHROPIC_MODEL = saved;
  });

  it("can turn fallbacks off", async () => {
    const { client, requests } = fakeClient([{ stop_reason: "end_turn", content: [text("hi")] }]);
    await new Agent({ client, fallbacks: false }).send("hello");
    expect(requests[0].fallbacks).toBeUndefined();
    expect(requests[0].betas).toBeUndefined();
  });

  it("keeps history across turns for follow-ups", async () => {
    const { client, requests } = fakeClient([
      { stop_reason: "end_turn", content: [text("first")] },
      { stop_reason: "end_turn", content: [text("second")] },
    ]);
    const agent = new Agent({ client });
    await agent.send("Q1");
    await agent.send("Q2 follow-up");
    expect(requests[1].messages.map((m: any) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(requests[1].messages[0].content).toBe("Q1");
  });

  it("returns invalid tool input to the model as an error result instead of crashing", async () => {
    const { client, requests } = fakeClient([
      { stop_reason: "tool_use", content: [toolUse("t1", "route_mix", { airport: "ANCHORAGE" })] },
      { stop_reason: "end_turn", content: [text("Sorry, I need a 3-letter code.")] },
    ]);
    const res = await new Agent({ client }).send("long haul at Anchorage");
    const toolResult = requests[1].messages[2].content[0];
    expect(toolResult.is_error).toBe(true);
    expect(res.toolCalls[0]!.ok).toBe(false);
  });

  it("stops after the tool-round limit with an honest message", async () => {
    const loop = Array.from({ length: 5 }, (_, i) => ({ stop_reason: "tool_use", content: [toolUse(`t${i}`, "get_methodology", {})] }));
    const { client } = fakeClient(loop);
    const res = await new Agent({ client, maxToolRounds: 2 }).send("loop forever");
    expect(res.text).toMatch(/limit on tool calls/);
  });

  it("surfaces refusal and truncation instead of hiding them", async () => {
    const { client } = fakeClient([{ stop_reason: "refusal", content: [] }]);
    const events: AgentEvent[] = [];
    const res = await new Agent({ client }).send("x", (e) => events.push(e));
    expect(res.text).toMatch(/can't help/);
    expect(events.some((e) => e.type === "notice")).toBe(true);
  });
});

describe("grounding check", () => {
  const tool = JSON.stringify({ ok: true, data: { load_factor_pct: 82.3, passengers: 26488386, share: 0.178, rows: [{ miles: 3000 }] } });

  it("harvests numeric leaves, including those inside strings", () => {
    const nums = harvestNumbers([JSON.stringify({ a: 5, b: "p88 and 1,234", c: [7.5] })]);
    expect(nums).toEqual(expect.arrayContaining([5, 88, 1234, 7.5]));
  });
  it("extracts figures but ignores years and tiny integers", () => {
    const raw = extractNumbers("In 2026 SFO had 3 terminals and 26.5M passengers, 82.3% load factor, about 5x more.").map((n) => n.raw);
    expect(raw).toEqual(["26.5M", "82.3%"]);
  });
  it("traces rounded and scaled figures to tool output", () => {
    const r = checkGrounding("SFO carried 26.5M passengers at an 82.3% load factor and 17.8% share beyond 3,000 miles.", [tool]);
    expect(r.untraced).toEqual([]);
    expect(r.traced).toBe(r.checked);
  });
  it("traces scaled figures that tools return as formatted strings (e.g. '5.6M (p93)')", () => {
    const t = JSON.stringify({ ok: true, data: { metrics: { added: "5.6M (p93)", pax: "26.5M (p96)", small: "278k (p47)" } } });
    const r = checkGrounding("It adds 5.6M passengers by 2035 and carries 26.5M today; 278k at the smaller one.", [t]);
    expect(r.untraced).toEqual([]);
  });
  it("flags a figure the tools never returned", () => {
    const r = checkGrounding("The load factor was 91.7% and 26.5M people flew.", [tool]);
    expect(r.untraced).toEqual(["91.7%"]);
  });
});
