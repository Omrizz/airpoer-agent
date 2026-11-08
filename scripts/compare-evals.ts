// Summarises every eval run (docs/EVAL.json + docs/eval/*.json) into one table and writes docs/eval/COMPARISON.md.
// Usage: node scripts/compare-evals.ts
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";

interface Turn {
  case: string; label: string; tools: string[]; checks: number; passed: number; failed: string[];
  modelCalls: number; outputTokens: number; inputTokens: number; cacheRead: number; costUsd: number;
  words: number; groundingChecked: number; groundingTraced: number; untraced: string[];
}
interface Run { model: string; effort: string; passed: number; total: number; costUsd: number; turns: Turn[] }

const files = ["docs/EVAL.json", ...readdirSync("docs/eval").filter((f) => f.endsWith(".json") && !f.includes("_case")).map((f) => `docs/eval/${f}`)];
const sum = (t: Turn[], k: keyof Turn) => t.reduce((a, x) => a + (x[k] as number), 0);

const rows = files.map((f) => {
  const r = JSON.parse(readFileSync(f, "utf8")) as Run;
  const t = r.turns;
  return {
    file: f, when: statSync(f).mtime.toISOString().slice(0, 16).replace("T", " "), model: r.model, effort: r.effort ?? "n/a",
    checks: `${r.passed}/${r.total}`, cost: r.costUsd, perQ: r.costUsd / t.length, calls: sum(t, "modelCalls"),
    outTok: sum(t, "outputTokens"), words: Math.round(sum(t, "words") / t.length),
    grounding: `${sum(t, "groundingTraced")}/${sum(t, "groundingChecked")}`,
    groundingPct: Math.round((100 * sum(t, "groundingTraced")) / Math.max(1, sum(t, "groundingChecked"))),
    failed: t.flatMap((x) => x.failed.map((n) => `${x.case.slice(0, 2)}${x.label}: ${n}`)),
  };
}).sort((a, b) => a.model.localeCompare(b.model) || a.effort.localeCompare(b.effort) || a.when.localeCompare(b.when));

const md = [
  "# Eval comparison\n",
  "Same 8 questions (5 cases incl. follow-ups and an out-of-scope probe), same tools, same system prompt. Checks are deterministic (tool use, required mentions, no tool errors); they do not rate answer quality. Cost is estimated from token usage and published per-token prices.\n",
  "| Model | Effort | Checks | Total cost | Per question | Model calls | Output tokens | Avg words | Figures traced | Run time (UTC) |",
  "|---|---|---|---|---|---|---|---|---|---|",
  ...rows.map((r) => `| ${r.model} | ${r.effort} | ${r.checks} | $${r.cost.toFixed(3)} | $${r.perQ.toFixed(3)} | ${r.calls} | ${r.outTok.toLocaleString()} | ${r.words} | ${r.grounding} (${r.groundingPct}%) | ${r.when} |`),
  "",
  "## Failed checks",
  ...(rows.some((r) => r.failed.length) ? rows.filter((r) => r.failed.length).flatMap((r) => [`- **${r.model} (${r.effort}, ${r.file})**: ${r.failed.join("; ")}`]) : ["None."]),
].join("\n");

writeFileSync("docs/eval/COMPARISON.md", md + "\n");
console.log(md);
