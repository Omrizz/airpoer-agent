import {
  COMPONENTS,
  DEFAULT_WEIGHTS,
  EDITORIAL_CONSTRAINTS,
  LOW_OTP_COVERAGE,
  MIN_OTP_MONTHS,
  UNIVERSE,
} from "./config.ts";
import { normalizeWeights, percentileOf, weightedMean } from "./rank.ts";
import type {
  AirportMetrics,
  ComponentResult,
  ComponentSpec,
  Flag,
  MetricResult,
  MetricSpec,
  ScoredAirport,
} from "./types.ts";

export interface ScoreOptions {
  /** Relative component weights; normalised internally. Unknown keys are ignored, missing keys default. */
  weights?: Record<string, number>;
  /** Applied AFTER national scoring so percentiles stay comparable. */
  filter?: (m: AirportMetrics) => boolean;
  components?: ComponentSpec[];
}

export function inUniverse(m: AirportMetrics): boolean {
  return (
    (m.ltm_pax ?? 0) >= UNIVERSE.minLtmPax && (m.months_covered ?? 0) >= UNIVERSE.minMonthsCovered
  );
}

export function formatMetric(spec: Pick<MetricSpec, "unit">, v: number): string {
  switch (spec.unit) {
    case "pct":
      return `${(v * 100).toFixed(1)}%`;
    case "min":
      return `${v.toFixed(1)} min`;
    case "count":
      return v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : `${Math.round(v)}`;
    default:
      return v.toFixed(2);
  }
}

function ordinal(p: number): string {
  const n = Math.round(p);
  const suffix = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${suffix[(v - 20) % 10] ?? suffix[v] ?? suffix[0]} percentile`;
}

export function scoreAirports(all: readonly AirportMetrics[], opts: ScoreOptions = {}): ScoredAirport[] {
  const components = opts.components ?? COMPONENTS;
  const peers = all.filter(inUniverse);
  if (peers.length === 0) return [];

  const compWeights = normalizeWeights(
    Object.fromEntries(components.map((c) => [c.id, opts.weights?.[c.id] ?? DEFAULT_WEIGHTS[c.id] ?? c.weight])),
  );

  // 1. Sorted value arrays per metric -> percentile lookups.
  const sortedByMetric = new Map<string, number[]>();
  for (const c of components) {
    for (const spec of c.metrics) {
      const vals = peers.map((p) => spec.value(p)).filter((v): v is number => v != null && Number.isFinite(v));
      sortedByMetric.set(spec.id, vals.sort((a, b) => a - b));
    }
  }

  // 2. Score every peer.
  const scored = peers.map((m) => {
    const compResults: ComponentResult[] = components.map((c) => {
      const metrics: MetricResult[] = c.metrics.map((spec) => {
        const raw = spec.value(m);
        const value = raw != null && Number.isFinite(raw) ? raw : null;
        const sorted = sortedByMetric.get(spec.id)!;
        return {
          id: spec.id,
          label: spec.label,
          unit: spec.unit,
          value,
          percentile: value == null || sorted.length < 2 ? null : percentileOf(sorted, value),
        };
      });
      const score = weightedMean(metrics.map((r, i) => ({ value: r.percentile, weight: c.metrics[i]!.weight })));
      return { id: c.id, label: c.label, score, weight: 0, contribution: 0, metrics };
    });

    // Re-normalise weights across components this airport actually has.
    const available = compResults.filter((r) => r.score != null);
    const wTotal = available.reduce((s, r) => s + compWeights[r.id]!, 0);
    let total = 0;
    for (const r of compResults) {
      if (r.score == null || wTotal === 0) continue;
      r.weight = compWeights[r.id]! / wTotal;
      r.contribution = r.score * r.weight;
      total += r.contribution;
    }

    const flags = buildFlags(m, compResults);
    const issues = flags.filter((f) => f.code !== "editorial_constraint").length;
    return {
      iata: m.iata,
      name: m.name,
      city: m.city,
      state: m.state,
      score: total,
      rank: 0,
      nationalRank: 0,
      confidence: issues === 0 ? ("high" as const) : issues === 1 ? ("medium" as const) : ("low" as const),
      components: compResults,
      drivers: buildDrivers(components, compResults),
      flags,
      _m: m,
    };
  });

  // 3. National ranking (ties broken by IATA for determinism), then optional filter + local ranking.
  scored.sort((a, b) => b.score - a.score || a.iata.localeCompare(b.iata));
  scored.forEach((s, i) => (s.nationalRank = i + 1));
  const kept = opts.filter ? scored.filter((s) => opts.filter!(s._m)) : scored;
  kept.forEach((s, i) => (s.rank = i + 1));
  return kept.map(({ _m, ...rest }) => rest);
}

function buildFlags(m: AirportMetrics, comps: ComponentResult[]): Flag[] {
  const flags: Flag[] = [];
  if ((m.months_covered ?? 0) < 12) {
    flags.push({ code: "short_history", message: `Only ${m.months_covered} of the last 12 months of T-100 data.` });
  }
  if (m.otp_coverage != null && m.otp_coverage < LOW_OTP_COVERAGE) {
    flags.push({
      code: "low_otp_coverage",
      message: `On-time data covers only ${(m.otp_coverage * 100).toFixed(0)}% of departures (large carriers only); congestion may be understated or skewed.`,
    });
  }
  if ((m.otp_months ?? 0) < MIN_OTP_MONTHS) {
    flags.push({
      code: "single_season_otp",
      message: `Congestion is based on ${m.otp_months ?? 0} month(s) of on-time data, so it may reflect one season.`,
    });
  }
  const missing = comps.filter((c) => c.score == null).map((c) => c.label);
  if (missing.length) {
    flags.push({ code: "missing_component", message: `No data for: ${missing.join(", ")}; score re-weighted over the rest.` });
  }
  const editorial = EDITORIAL_CONSTRAINTS[m.iata];
  if (editorial) flags.push({ code: "editorial_constraint", message: `Editorial note (not data-derived): ${editorial}` });
  return flags;
}

function buildDrivers(components: ComponentSpec[], results: ComponentResult[]): string[] {
  const rows: { text: string; weight: number }[] = [];
  results.forEach((r) => {
    const spec = components.find((c) => c.id === r.id)!;
    r.metrics.forEach((mr, i) => {
      if (mr.percentile == null || mr.value == null) return;
      // Contribution-weighted strength: how far above the median, scaled by importance.
      const importance = r.weight * spec.metrics[i]!.weight;
      rows.push({
        text: `${mr.label}: ${formatMetric(mr, mr.value)} (${ordinal(mr.percentile)})`,
        weight: (mr.percentile - 50) * importance,
      });
    });
  });
  return rows
    .filter((r) => r.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((r) => r.text);
}
