// Runs scripts/eval.ts once per (model, effort) setup and writes docs/MODEL_COMPARISON.md.
// Costs real API tokens (one full eval per setup, see the list below). Usage: npm run compare-models
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

interface Setup { model: string; effort: "low" | "medium"; fallbacks: boolean }
const SETUPS: Setup[] = [
  { model: "claude-opus-5-5", effort: "medium", fallbacks: true },
  { model: "claude-opus-5-5", effort: "low", fallbacks: true },
  { model: "claude-sonnet-5-5", effort: "medium", fallbacks: true },
  { model: "claude-sonnet-5-5", effort: "low", fallbacks: true },
  // Haiku 5.5 has no server-side refusal fallback, so it is switched off for this setup.
  { model: "claude-haiku-5-5", effort: "medium", fallbacks: false },
];

mkdirSync("docs/eval", { recursive: true });
interface Turn { case: string; label: string; checks: number; passed: number; failed: string[]; modelCalls: number; outputTokens: number; inputTokens: number; cacheRead: number; costUsd: number; words: number; groundingChecked: number; groundingTraced: number; tools: string[] }
interface Summary { model: string; effort: string; passed: number; total: number; costUsd: number; turns: Turn[] }
const results: { setup: Setup; summary?: Summary; error?: string }[] = [];

for (const s of SETUPS) {
  const base = `docs/eval/${s.model.replace("claude-", "")}_${s.effort}`;
  console.log(`\n=== ${s.model} / effort ${s.effort} ===`);
  const r = spawnSync(process.execPath, ["--env-file=.env", "scripts/eval.ts"], {
    env: { ...process.env, ANTHROPIC_MODEL: s.model, ANTHROPIC_EFFORT: s.effort, ANTHROPIC_FALLBACKS: s.fallbacks ? "on" : "off", EVAL_OUT: `${base}.md` },
    encoding: "utf8",
  });
  process.stdout.write(r.stdout ?? "");
  if (r.status !== 0 || !existsSync(`${base}.json`)) {
    const msg = (r.stderr || r.stdout || "").trim().split("\n").slice(-3).join(" ");
    console.log(`  FAILED to complete: ${msg}`);
    results.push({ setup: s, error: msg || `exit code ${r.status}` });
    continue;
  }
  results.push({ setup: s, summary: JSON.parse(readFileSync(`${base}.json`, "utf8")) as Summary });
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const rows = results.map(({ setup, summary, error }) => {
  const label = `${setup.model.replace("claude-", "")} / ${setup.effort}`;
  if (!summary) return `| ${label} | did not complete | | | | | | ${error ?? ""} |`;
  const t = summary.turns;
  const traced = t.reduce((a, x) => a + x.groundingTraced, 0), checked = t.reduce((a, x) => a + x.groundingChecked, 0);
  const failed = t.flatMap((x) => x.failed.map((f) => `${x.case.split(".")[0]}/${x.label}: ${f}`));
  return `| ${label} | ${summary.passed}/${summary.total} | $${summary.costUsd.toFixed(2)} | $${avg(t.map((x) => x.costUsd)).toFixed(3)} | ${Math.round(avg(t.map((x) => x.outputTokens)))} | ${Math.round(avg(t.map((x) => x.words)))} | ${avg(t.map((x) => x.modelCalls)).toFixed(1)} | ${checked ? Math.round((100 * traced) / checked) : 0}% | ${failed.length ? failed.join("; ") : "none"} |`;
});

const md = `# Model comparison

Same evaluation (${results.find((r) => r.summary)?.summary?.turns.length ?? 0} questions across 5 cases, ${results.find((r) => r.summary)?.summary?.total ?? 0} deterministic checks), run once per setup. Costs are estimates from token usage; they are not billing figures.

| Setup | Checks passed | Total cost | Avg cost / question | Avg output tokens | Avg words | Avg model calls | Figures traced | Failed checks |
|---|---|---|---|---|---|---|---|---|
${rows.join("\n")}

## How to read this
- **Checks are shallow.** They test tool selection, required mentions and tool errors, not whether an answer is correct or well judged. Read the per-setup reports in \`docs/eval/\` before choosing.
- **One run per setup.** Model output varies between runs, so small differences in cost or check counts are noise.
- **Figures traced** is the share of numbers in answers that the grounding check could match to tool output. Derived values (ratios, differences) appear as untraced by design.
- Haiku 5.5 runs without the server-side refusal fallback (not available for that model).
`;
writeFileSync("docs/MODEL_COMPARISON.md", md);
console.log("\nWrote docs/MODEL_COMPARISON.md");
