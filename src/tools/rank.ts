import { z } from "zod";
import { allMetrics } from "../data/db.ts";
import { findRegion, findState, STATE_NAMES } from "../data/regions.ts";
import { COMPONENTS, DEFAULT_WEIGHTS, UNIVERSE, inUniverse, scoreAirports, sensitivity, formatMetric, normalizeWeights } from "../scoring/index.ts";
import type { AirportMetrics } from "../scoring/types.ts";
import { err, ok, r1, SOURCES, type ToolResult } from "./envelope.ts";

const weight = z.number().min(0).max(1).optional();

export const rankInput = z.object({
  region: z
    .string()
    .optional()
    .describe('Region, state, or comma-separated state codes to rank within, e.g. "New England", "CA", "MA,RI". Omit for the whole US.'),
  top_n: z.number().int().min(1).max(25).optional().describe("How many airports to return (default 10)."),
  weights: z
    .object({ demand_pressure: weight, congestion: weight, growth: weight, scale: weight })
    .optional()
    .describe("Optional relative weights to override the defaults (they are re-normalised). Use when the user asks to emphasise something."),
});

function statesFor(region: string): { states: string[]; label: string } | null {
  const r = findRegion(region);
  if (r) return { states: r.states, label: r.name.replace(/\b\w/g, (c) => c.toUpperCase()) };
  const parts = region.split(/[,;/]| and /i).map((s) => s.trim()).filter(Boolean);
  const states = parts.map((p) => findState(p));
  if (states.length && states.every(Boolean)) return { states: states as string[], label: (states as string[]).join(", ") };
  return null;
}

export async function rankAirports(input: z.infer<typeof rankInput>): Promise<ToolResult<unknown>> {
  const metrics = await allMetrics();
  let filter: ((m: AirportMetrics) => boolean) | undefined;
  let scope = "United States (all)";
  let states: string[] | null = null;
  if (input.region) {
    const s = statesFor(input.region);
    if (!s) return err(`Could not interpret region "${input.region}".`, "Call resolve_airports first, or pass state codes like MA,RI.");
    states = s.states;
    filter = (m) => states!.includes(m.state ?? "");
    scope = `${s.label} (${states.join(", ")})`;
  }

  const weights = Object.fromEntries(Object.entries({ ...DEFAULT_WEIGHTS, ...(input.weights ?? {}) }).filter(([, v]) => v != null)) as Record<string, number>;
  if (Object.values(weights).every((v) => v === 0)) return err("All weights are zero.", "Give at least one component a positive weight.");
  const norm = normalizeWeights(weights);

  const topN = input.top_n ?? 10;
  const scored = scoreAirports(metrics, { weights, filter });
  if (!scored.length) {
    return ok({ scope, ranked: [], note: "No airports in this scope pass the peer-set filter." }, {
      caveats: [`Peer set requires at least ${UNIVERSE.minLtmPax.toLocaleString()} departing passengers per year and ${UNIVERSE.minMonthsCovered} months of data.`],
    });
  }

  const top = scored.slice(0, topN).map((s) => ({
    rank: s.rank,
    national_rank: s.nationalRank,
    iata: s.iata,
    name: s.name,
    state: s.state,
    score: r1(s.score),
    confidence: s.confidence,
    components: Object.fromEntries(s.components.map((c) => [c.id, { score: r1(c.score), weight_pct: r1(c.weight * 100), points: r1(c.contribution) }])),
    metrics: Object.fromEntries(
      s.components.flatMap((c) =>
        c.metrics.map((m) => [m.id, m.value == null ? "n/a" : `${formatMetric(m, m.value)}${m.percentile == null ? "" : ` (p${Math.round(m.percentile)})`}`] as const),
      ),
    ),
    strongest_signals: s.drivers,
    flags: s.flags.map((f) => `[${f.code}] ${f.message}`),
  }));

  // Airports in scope that have passenger service but were NOT scored: say so, don't imply they scored low.
  const notScoredAll = metrics
    .filter((m) => (!filter || filter(m)) && (m.ltm_pax ?? 0) > 0 && !inUniverse(m))
    .sort((a, b) => (b.ltm_pax ?? 0) - (a.ltm_pax ?? 0));
  const notScored = notScoredAll
    .slice(0, 15)
    .map((m) => ({ iata: m.iata, name: m.name, state: m.state, ltm_passengers: m.ltm_pax == null ? null : Math.round(m.ltm_pax), reason: (m.ltm_pax ?? 0) < UNIVERSE.minLtmPax ? "below traffic floor" : "incomplete history" }));

  const sens = sensitivity(metrics, { weights, filter, k: Math.min(5, scored.length) });
  const flagCodes = new Set(top.flatMap((t) => t.flags.map((f) => f.slice(1, f.indexOf("]")))));

  const caveats = [
    ...(flagCodes.has("single_season_otp") ? ["Congestion uses a single month of on-time data (a summer peak), so it may overstate year-round congestion."] : []),
    ...(flagCodes.has("low_otp_coverage") ? ["For some airports, on-time data covers well under all departures (large carriers only)."] : []),
    ...(flagCodes.has("editorial_constraint") ? ["Some airports carry a hand-written note that their binding constraint may not be the terminal; this does not change the score."] : []),
    "Taxi-out and delay are proxies for congestion, not measures of runway capacity.",
    "This screens where capacity would be absorbed; it does not estimate construction cost, returns, or whether the terminal is the bottleneck.",
    sens.stable
      ? `Top ${sens.k} is stable when each weight is shifted by +/-${sens.delta * 100}%.`
      : `Top ${sens.k} is NOT stable under +/-${sens.delta * 100}% weight changes; treat adjacent ranks as ties.`,
  ];

  return ok(
    {
      scope,
      peer_set_size: scoreAirports(metrics).length,
      scored_in_scope: scored.length,
      weights_used_pct: Object.fromEntries(Object.entries(norm).map(([k, v]) => [k, r1(v * 100)])),
      component_definitions: Object.fromEntries(COMPONENTS.map((c) => [c.id, c.label])),
      ranked: top,
      sensitivity: { top_k: sens.k, shift: `+/-${sens.delta * 100}%`, stable: sens.stable, rows: sens.rows.map((r) => ({ iata: r.iata, base_rank: r.baseRank, rank_range: [r.minRank, r.maxRank], share_in_top_k: r1(r.inTopKShare) })) },
      not_scored_in_scope_total: notScoredAll.length,
      not_scored_in_scope_listed: notScored,
      not_scored_note: `${notScoredAll.length} airports in scope have some passenger traffic but were not scored (most are very small or seasonal). Only the ${notScored.length} largest are listed; quote the total, not the list length.`,
    },
    {
      assumptions: [
        "Higher score = stronger case for added terminal capacity (demand pressure, congestion, growth, size of prize).",
        `Percentiles are always national, among ${scoreAirports(metrics).length} airports with at least ${UNIVERSE.minLtmPax.toLocaleString()} departing passengers/year; a regional ranking filters that national scoring afterwards.`,
        `Weights: ${Object.entries(norm).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(", ")}${input.weights ? " (user override)" : " (defaults)"}.`,
        ...(states ? [`Region = ${states.map((s) => STATE_NAMES[s]).join(", ")}.`] : []),
      ],
      caveats,
      sources: [SOURCES.t100, SOURCES.otp, SOURCES.taf],
    },
  );
}
