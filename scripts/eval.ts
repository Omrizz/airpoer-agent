// Runs the exam's sample questions (plus follow-ups and a boundary probe) against the live agent,
// applies deterministic checks, and writes docs/EVAL.md. Costs real API tokens: ~10-20 model calls.
// Usage: npm run eval
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { Agent, DEFAULT_MODEL, type TurnResult } from "../src/agent/agent.ts";
import { estimateCost } from "../src/agent/cost.ts";

if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY is not set (see .env.example)."); process.exit(1); }
process.on("uncaughtException", (e) => {
  console.error(`\nEval stopped: ${e instanceof Error ? (e as { apiMessage?: string }).apiMessage ?? e.message : String(e)}`);
  process.exit(1);
});

interface Turn { ask: string; expectTools?: string[]; forbidTools?: boolean; mustMention?: RegExp[]; label: string }
interface Case { name: string; turns: Turn[] }

const CASES: Case[] = [
  {
    name: "1. New England terminal-expansion candidates (+ follow-ups)",
    turns: [
      { label: "ask", ask: "Which airports in New England are strong candidates for terminal expansion?", expectTools: ["rank_airports"], mustMention: [/BOS|Boston/i, /not (been )?scored|below|small|Nantucket/i, /one month|single|season|assum|proxy/i] },
      { label: "follow-up (explain)", ask: "Why is Portland ranked above Bangor?", mustMention: [/Portland|PWM/i, /Bangor|BGR/i] },
      { label: "follow-up (re-weight)", ask: "What changes if we care much more about growth than congestion?", expectTools: ["rank_airports"] },
    ],
  },
  {
    name: "2. LA vs Santa Ana congestion",
    turns: [{ label: "ask", ask: "Compare LA and Santa Ana airport congestion levels.", expectTools: ["compare_airports"], mustMention: [/LAX/i, /SNA|John Wayne|Santa Ana/i, /taxi|delay/i] }],
  },
  {
    name: "3. Long-haul share out of Anchorage",
    turns: [{ label: "ask", ask: "What is the percentage of long haul flights out of Anchorage airport?", expectTools: ["route_mix"], mustMention: [/\d+(\.\d+)?\s?%/, /3,?000|miles/i, /cargo/i, /(all|every) (flights|departures)|including cargo|with cargo|cargo (flights )?(included|too)/i] }],
  },
  {
    name: "4. Unmet demand at SFO",
    turns: [{ label: "ask", ask: "What is the unmet flight demand in SFO airport and why?", expectTools: ["demand_gap"], mustMention: [/proxy|proxies|(cannot|can't|can not) be (measured|observed)|not (directly )?(measurable|observable|measured)|measured directly|indirect/i, /OAK|Oakland|SJC|San Jose/i, /runway|fog|editorial|terminal/i] }],
  },
  {
    name: "5. Boundary: out of scope",
    turns: [{ label: "ask", ask: "Should I buy Delta Air Lines stock this week?", forbidTools: true, mustMention: [/can't|cannot|outside|not (able|something)|don't|do not/i] }],
  },
];

const MODEL = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
const EFFORT = process.env.ANTHROPIC_EFFORT ?? "medium";
const OUT = process.env.EVAL_OUT ?? "docs/EVAL.md"; // markdown report path; a .json summary is written next to it
const cost = (u: TurnResult["usage"]) => estimateCost(MODEL, u) ?? 0;

const out: string[] = [`# Evaluation run\n\nModel: \`${MODEL}\`, effort: \`${EFFORT}\`. Checks are deterministic (tool use, required mentions, number grounding); they do not judge answer quality, so read the answers.\n`];
let pass = 0, total = 0, spend = 0;
const turnsLog: Record<string, unknown>[] = [];

const only = process.env.EVAL_ONLY?.split(",").map((s) => s.trim()).filter(Boolean); // e.g. EVAL_ONLY=3,4 re-runs just those cases

for (const c of CASES) {
  if (only && !only.includes(c.name.split(".")[0]!)) continue;
  const agent = new Agent();
  out.push(`\n## ${c.name}\n`);
  for (const t of c.turns) {
    const r = await agent.send(t.ask);
    const called = r.toolCalls.map((x) => x.name);
    const checks: [string, boolean][] = [];
    for (const e of t.expectTools ?? []) checks.push([`calls ${e}`, called.includes(e)]);
    if (t.forbidTools) checks.push(["calls no tools", called.length === 0]);
    for (const m of t.mustMention ?? []) checks.push([`mentions ${m}`, m.test(r.text)]);
    checks.push(["no tool errors", r.toolCalls.every((x) => x.ok)]);
    checks.push(["answer not empty", r.text.length > 50]);
    const g = r.grounding;
    spend += cost(r.usage);
    total += checks.length; pass += checks.filter(([, ok]) => ok).length;
    turnsLog.push({
      case: c.name, label: t.label, tools: called, checks: checks.length, passed: checks.filter(([, ok]) => ok).length,
      failed: checks.filter(([, ok]) => !ok).map(([n]) => n), modelCalls: r.iterations, outputTokens: r.usage.output,
      inputTokens: r.usage.input + r.usage.cacheRead + r.usage.cacheWrite, cacheRead: r.usage.cacheRead, costUsd: cost(r.usage),
      words: r.text.split(/\s+/).filter(Boolean).length, groundingChecked: g.checked, groundingTraced: g.traced, untraced: g.untraced,
    });

    out.push(`### ${t.label}: ${t.ask}\n`);
    out.push(`**Tools:** ${called.length ? called.map((n, i) => `\`${n}(${JSON.stringify(r.toolCalls[i]!.input)})\``).join(", ") : "none"}  \n**Model calls:** ${r.iterations} | **Tokens:** in ${r.usage.input}, out ${r.usage.output}, cache-read ${r.usage.cacheRead} | **Est. cost:** $${cost(r.usage).toFixed(3)}  \n**Grounding:** ${g.traced}/${g.checked} figures traced to tool output${g.untraced.length ? `; untraced: ${g.untraced.join(", ")}` : ""}\n`);
    out.push(`**Checks:** ${checks.map(([n, ok]) => `${ok ? "PASS" : "FAIL"} ${n}`).join("; ")}\n`);
    out.push(`> ${r.text.replace(/\n/g, "\n> ")}\n`);
    console.log(`${checks.every(([, ok]) => ok) ? "PASS" : "FAIL"}  ${c.name} / ${t.label}  (${called.join(", ") || "no tools"}; grounding ${g.traced}/${g.checked})`);
    for (const [n, ok] of checks) if (!ok) console.log(`      failed: ${n}`);
  }
}
out.splice(1, 0, `\n**Result: ${pass}/${total} checks passed. Estimated spend: $${spend.toFixed(2)}.**\n`);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, out.join("\n"));
writeFileSync(OUT.replace(/\.md$/, "") + ".json", JSON.stringify({ model: MODEL, effort: EFFORT, passed: pass, total, costUsd: spend, turns: turnsLog }, null, 2));
console.log(`\n${pass}/${total} checks passed, est. $${spend.toFixed(2)}. Report: ${OUT}`);
