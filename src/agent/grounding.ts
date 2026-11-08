/**
 * Deterministic check that numbers in an answer trace back to tool output.
 * It does not judge whether the answer is correct; it flags figures the model may have invented or
 * computed, so a reviewer (or the UI) can see them. Derived numbers (ratios, differences) show up as
 * "untraced" by design: the prompt asks the model to label those as derived.
 */

export interface GroundingReport {
  checked: number;
  traced: number;
  untraced: string[];
}

const UNIT: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9 };

/** All numeric leaves in the tool outputs, plus their rounded forms. */
export function harvestNumbers(texts: readonly string[]): number[] {
  const out: number[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === "number" && Number.isFinite(v)) out.push(v);
    else if (typeof v === "string") {
      // Tool strings like "5.6M (p93)": keep the plain number and also its scaled value.
      for (const m of v.matchAll(/(-?\d[\d,]*\.?\d*)\s?([kKmMbB])?(?![\w])/g)) {
        const n = Number(m[1]!.replace(/,/g, ""));
        out.push(n);
        const mult = m[2] ? UNIT[m[2].toLowerCase()] : undefined;
        if (mult) out.push(n * mult);
      }
    }
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  for (const t of texts) {
    try { walk(JSON.parse(t)); } catch { /* non-JSON tool output: ignore */ }
  }
  return out.filter((n) => Number.isFinite(n));
}

interface Found { raw: string; value: number; decimals: number }

export function extractNumbers(answer: string): Found[] {
  const found: Found[] = [];
  const re = /(?<![\w.])(-?\d[\d,]*(?:\.\d+)?)\s?(%|[kKmMbB]\b|x\b)?/g;
  for (const m of answer.matchAll(re)) {
    const numStr = m[1]!.replace(/,/g, "");
    let value = Number(numStr);
    if (!Number.isFinite(value)) continue;
    const suffix = (m[2] ?? "").toLowerCase();
    if (suffix === "x") continue; // multipliers are derived by definition
    if (UNIT[suffix]) value *= UNIT[suffix]!;
    const decimals = (numStr.split(".")[1] ?? "").length;
    // Ignore things that are not data figures: years, ranks/small counts, bullet numbering.
    const asInt = Number.isInteger(value);
    if (asInt && value >= 1990 && value <= 2060 && !suffix) continue;
    if (asInt && Math.abs(value) <= 10 && !suffix) continue;
    found.push({ raw: m[0].trim(), value, decimals });
  }
  return found;
}

const close = (a: number, b: number, decimals: number, scaled: boolean): boolean => {
  if (a === b) return true;
  if (scaled) return Math.abs(a - b) / Math.max(Math.abs(b), 1) <= 0.006; // "21.1M" vs 21,143,295
  const tol = 0.5 * Math.pow(10, -decimals) + 1e-9; // rounding to the digits shown
  return Math.abs(a - b) <= tol * (decimals === 0 && Math.abs(b) > 100 ? Math.abs(b) * 0.001 : 1);
};

export function checkGrounding(answer: string, toolOutputs: readonly string[]): GroundingReport {
  const pool = harvestNumbers(toolOutputs);
  const nums = extractNumbers(answer);
  const untraced: string[] = [];
  for (const n of nums) {
    const scaled = /[kKmMbB]$/.test(n.raw);
    const hit = pool.some((p) => close(n.value, p, n.decimals, scaled) || close(n.value, p * 100, n.decimals, false) || (Math.abs(p) < 1 && close(n.value, p * 100, n.decimals, false)));
    if (!hit) untraced.push(n.raw);
  }
  return { checked: nums.length, traced: nums.length - untraced.length, untraced: [...new Set(untraced)] };
}
