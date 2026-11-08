/** Mid-rank percentile (0..100) of `value` within `sorted` (ascending). Ties share the middle of their block. */
export function percentileOf(sorted: readonly number[], value: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  if (n === 1) return 50;
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]! < value) lo = mid + 1;
    else hi = mid;
  }
  const below = lo;
  let upper = lo;
  while (upper < n && sorted[upper] === value) upper++;
  const equal = upper - below;
  return (100 * (below + (equal - 1) / 2)) / (n - 1);
}

/** Weighted mean over the entries that have a value, re-normalising weights. Null if nothing is available. */
export function weightedMean(items: readonly { value: number | null; weight: number }[]): number | null {
  let sum = 0;
  let w = 0;
  for (const it of items) {
    if (it.value == null || Number.isNaN(it.value) || it.weight <= 0) continue;
    sum += it.value * it.weight;
    w += it.weight;
  }
  return w === 0 ? null : sum / w;
}

export function normalizeWeights(weights: Record<string, number>): Record<string, number> {
  const total = Object.values(weights).reduce((a, b) => a + Math.max(0, b), 0);
  if (total <= 0) throw new Error("weights must have a positive total");
  return Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, Math.max(0, v) / total]));
}
