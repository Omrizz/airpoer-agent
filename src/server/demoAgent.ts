import type { AgentEvent, ChatAgent, TurnResult } from "../agent/agent.ts";
import { checkGrounding } from "../agent/grounding.ts";
import { runTool } from "../tools/index.ts";

/**
 * DEMO MODE ONLY. A keyword router that runs the REAL tools and fills a template with their numbers.
 * It exists so the UI can be exercised without API credits. It is not a language model: answers are
 * scripted, follow-ups are not understood, and the UI says so. Never used unless started with `npm run web:demo`.
 */
export class DemoAgent implements ChatAgent {
  readonly model = "demo-mode (no model)";
  private readonly outputs: string[] = [];

  async send(text: string, onEvent: (e: AgentEvent) => void = () => {}): Promise<TurnResult> {
    const q = text.toLowerCase();
    const calls: { name: string; input: unknown }[] = [];
    let answer: (r: any[]) => string;

    if (/new england|expansion|candidate|rank/.test(q)) {
      calls.push({ name: "rank_airports", input: { region: /new england/.test(q) ? "New England" : undefined, top_n: 6 } });
      answer = ([r]) => {
        const top = r.data.ranked as any[];
        return `**Demo answer (scripted, not model output).** In ${r.data.scope}, the highest-scoring airports are ${top.slice(0, 3).map((a) => `${a.iata} (${a.score})`).join(", ")}.\n\n` +
          `${top[0].iata} leads on ${top[0].strongest_signals[0] ?? "overall score"}.\n\n**Assumptions and limits**\n` + [...r.assumptions.slice(0, 2), ...r.caveats.slice(0, 3)].map((x: string) => `- ${x}`).join("\n");
      };
    } else if (/compare|vs|versus/.test(q) && /(la\b|lax|los angeles)/.test(q)) {
      calls.push({ name: "compare_airports", input: { airports: ["LAX", "SNA"] } });
      answer = ([r]) => {
        const c = r.data.contrasts.find((x: any) => x.measure === "avg_taxi_out");
        return `**Demo answer (scripted, not model output).** Average taxi-out: ${Object.entries(c.values).map(([k, v]) => `${k} ${v} min`).join(", ")}; ${c.higher} is higher.\n\n**Assumptions and limits**\n` + r.caveats.map((x: string) => `- ${x}`).join("\n");
      };
    } else if (/long.?haul|anchorage|anc\b/.test(q)) {
      calls.push({ name: "route_mix", input: { airport: "ANC" } });
      answer = ([r]) =>
        `**Demo answer (scripted, not model output).** ${r.data.long_haul.pct_of_departures}% of ${r.data.service} departures from ANC are ${r.data.long_haul_threshold_miles}+ miles (${r.data.window}).\n\n**Assumptions and limits**\n` + [...r.assumptions.slice(0, 1), ...r.caveats.slice(0, 2)].map((x: string) => `- ${x}`).join("\n");
    } else if (/unmet|demand|sfo/.test(q)) {
      calls.push({ name: "demand_gap", input: { airport: "SFO" } });
      answer = ([r]) =>
        `**Demo answer (scripted, not model output).** Unmet demand is not directly measurable; these are proxies. ${r.data.evidence.slice(0, 3).join(" ")}\n\n**Assumptions and limits**\n` + [...r.assumptions, ...r.caveats].map((x: string) => `- ${x}`).join("\n");
    } else {
      const reply = "**Demo mode** only understands the four example questions (New England candidates, LA vs Santa Ana, Anchorage long-haul, SFO unmet demand). Add API credits and restart without demo mode for open conversation.";
      onEvent({ type: "text_delta", text: reply });
      return { text: reply, toolCalls: [], grounding: { checked: 0, traced: 0, untraced: [] }, stopReason: "end_turn", usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, iterations: 1 };
    }

    const results: any[] = [];
    const record: TurnResult["toolCalls"] = [];
    for (const [i, c] of calls.entries()) {
      const id = `demo_${i}`;
      onEvent({ type: "tool_call", id, name: c.name, input: c.input });
      const t0 = Date.now();
      const r = await runTool(c.name, c.input);
      this.outputs.push(r.content);
      results.push(JSON.parse(r.content));
      record.push({ name: c.name, input: c.input, ok: !r.is_error });
      onEvent({ type: "tool_result", id, name: c.name, ok: !r.is_error, ms: Date.now() - t0, bytes: r.content.length, content: r.content });
    }
    const out = answer!(results);
    for (const chunk of out.match(/.{1,40}/gs) ?? []) onEvent({ type: "text_delta", text: chunk });
    return { text: out, toolCalls: record, grounding: checkGrounding(out, this.outputs), stopReason: "end_turn", usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, iterations: 1 };
  }
}
