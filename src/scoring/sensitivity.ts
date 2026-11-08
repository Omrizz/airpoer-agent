import { COMPONENTS, DEFAULT_WEIGHTS } from "./config.ts";
import { scoreAirports, type ScoreOptions } from "./score.ts";
import type { AirportMetrics } from "./types.ts";

export interface SensitivityRow {
  iata: string;
  baseRank: number;
  minRank: number;
  maxRank: number;
  /** Share of weight scenarios (incl. base) in which the airport stays in the top K. */
  inTopKShare: number;
}

export interface SensitivityReport {
  k: number;
  delta: number;
  scenarios: number;
  rows: SensitivityRow[];
  /** True when every base top-K airport stays in the top K in at least `stableShare` of scenarios. */
  stable: boolean;
}

/**
 * Re-rank with each component weight scaled by (1 - delta) and (1 + delta), one at a time.
 * Answers: "does the top K survive reasonable disagreement about the weights?"
 */
export function sensitivity(
  all: readonly AirportMetrics[],
  opts: ScoreOptions & { k?: number; delta?: number; stableShare?: number } = {},
): SensitivityReport {
  const k = opts.k ?? 5;
  const delta = opts.delta ?? 0.2;
  const stableShare = opts.stableShare ?? 0.75;
  const baseWeights = { ...DEFAULT_WEIGHTS, ...opts.weights };

  const variants: Record<string, number>[] = [baseWeights];
  for (const c of opts.components ?? COMPONENTS) {
    for (const factor of [1 - delta, 1 + delta]) {
      variants.push({ ...baseWeights, [c.id]: baseWeights[c.id]! * factor });
    }
  }

  const runs = variants.map((weights) => scoreAirports(all, { ...opts, weights }));
  const base = runs[0]!;
  const top = base.slice(0, k);

  const rows: SensitivityRow[] = top.map((b) => {
    const ranks = runs.map((r) => r.find((x) => x.iata === b.iata)?.rank ?? Number.POSITIVE_INFINITY);
    return {
      iata: b.iata,
      baseRank: b.rank,
      minRank: Math.min(...ranks),
      maxRank: Math.max(...ranks),
      inTopKShare: ranks.filter((r) => r <= k).length / ranks.length,
    };
  });

  return { k, delta, scenarios: variants.length, rows, stable: rows.every((r) => r.inTopKShare >= stableShare) };
}
