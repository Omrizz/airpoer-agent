import { z } from "zod";
import { allMetrics, query, sqlList } from "../data/db.ts";
import { CARGO_CLASSES, PASSENGER_CLASSES, ltmPredicate } from "../data/windows.ts";
import { scoreAirports } from "../scoring/index.ts";
import { err, ok, pct1, r1, SOURCES, type ToolResult } from "./envelope.ts";

export const compareInput = z.object({
  airports: z
    .array(z.string().regex(/^[A-Za-z]{3}$/, "IATA code, e.g. LAX").transform((s) => s.toUpperCase()))
    .min(2)
    .max(6)
    .describe("2-6 IATA codes to compare, e.g. [\"LAX\", \"SNA\"]. Resolve names with resolve_airports first."),
});

interface Vol { iata: string; deps: number; seats: number; pax: number }
interface Otp { iata: string; flights: number; avg_taxi: number | null; p90_taxi: number | null; avg_delay: number | null; pct15: number | null; pct_cx: number | null; nas: number | null }

export async function compareAirports(input: z.infer<typeof compareInput>): Promise<ToolResult<unknown>> {
  const codes = [...new Set(input.airports)];
  if (codes.length < 2) return err("Need at least two distinct airports.");
  const list = sqlList(codes);
  const ltm = await ltmPredicate();

  const vols = await query<Vol>(`
    SELECT ORIGIN AS iata, sum(DEPARTURES_PERFORMED) AS deps, sum(SEATS) AS seats, sum(PASSENGERS) AS pax
    FROM t100 WHERE CLASS IN (${PASSENGER_CLASSES}) AND SEATS > 0 AND ORIGIN_COUNTRY = 'US' AND ${ltm} AND ORIGIN IN (${list})
    GROUP BY 1`);
  const cargo = await query<{ iata: string; deps: number }>(`
    SELECT ORIGIN AS iata, sum(DEPARTURES_PERFORMED) AS deps FROM t100
    WHERE CLASS IN (${CARGO_CLASSES}) AND ${ltm} AND ORIGIN IN (${list}) GROUP BY 1`);
  const otps = await query<Otp>(`
    SELECT Origin AS iata, count(*) AS flights, avg(TaxiOut) AS avg_taxi, quantile_cont(TaxiOut, 0.9) AS p90_taxi,
           avg(DepDelayMinutes) AS avg_delay, avg(DepDel15::DOUBLE) AS pct15, avg(Cancelled::DOUBLE) AS pct_cx,
           sum(NASDelay) / nullif(sum(CarrierDelay + WeatherDelay + NASDelay + SecurityDelay + LateAircraftDelay), 0) AS nas
    FROM otp WHERE Origin IN (${list}) GROUP BY 1`);

  const missing = codes.filter((c) => !vols.some((v) => v.iata === c));
  if (missing.length) return err(`No passenger-service data for: ${missing.join(", ")}.`, "Check the codes with resolve_airports.");

  const metrics = await allMetrics();
  const scored = scoreAirports(metrics);
  const byIata = new Map(metrics.map((m) => [m.iata, m]));

  const rows = codes.map((c) => {
    const m = byIata.get(c)!;
    const v = vols.find((x) => x.iata === c)!;
    const o = otps.find((x) => x.iata === c);
    const s = scored.find((x) => x.iata === c);
    const cargoDeps = cargo.find((x) => x.iata === c)?.deps ?? 0;
    return {
      iata: c, name: m.name, city: m.city, state: m.state,
      scale: { passengers_12mo: Math.round(v.pax), passenger_departures_12mo: Math.round(v.deps), avg_seats_per_departure: r1(v.seats / v.deps), all_cargo_departures_12mo: Math.round(cargoDeps) },
      demand: { load_factor_pct: pct1(v.pax / v.seats), peak_month_load_factor_pct: pct1(m.peak_month_load_factor), pax_growth_yoy_pct: pct1(m.pax_growth_yoy), seat_growth_yoy_pct: pct1(m.seat_growth_yoy) },
      congestion: o
        ? { on_time_flights_in_sample: o.flights, on_time_coverage_pct: pct1(m.otp_coverage), avg_taxi_out_min: r1(o.avg_taxi), p90_taxi_out_min: r1(o.p90_taxi), avg_departure_delay_min: r1(o.avg_delay), pct_departures_delayed_15: pct1(o.pct15), pct_cancelled: pct1(o.pct_cx), nas_share_of_delay_pct: pct1(o.nas) }
        : null,
      score: s ? { total: r1(s.score), national_rank: s.nationalRank, confidence: s.confidence, components: Object.fromEntries(s.components.map((c2) => [c2.id, r1(c2.score)])) } : null,
      flags: s?.flags.map((f) => `[${f.code}] ${f.message}`) ?? [],
    };
  });

  // Deterministic contrasts: who is higher on each measure, and by how much.
  const contrast = (label: string, get: (r: (typeof rows)[number]) => number | null | undefined, unit: string) => {
    const vals = rows.map((r) => ({ iata: r.iata, v: get(r) })).filter((x): x is { iata: string; v: number } => x.v != null);
    if (vals.length < 2) return null;
    const sorted = [...vals].sort((a, b) => b.v - a.v);
    const hi = sorted[0]!, lo = sorted.at(-1)!;
    return { measure: label, unit, higher: hi.iata, lower: lo.iata, values: Object.fromEntries(vals.map((x) => [x.iata, r1(x.v)])), ratio_high_to_low: lo.v !== 0 ? r1(hi.v / lo.v) : null };
  };
  const contrasts = [
    contrast("passengers_12mo", (r) => r.scale.passengers_12mo, "passengers"),
    contrast("load_factor", (r) => r.demand.load_factor_pct, "%"),
    contrast("avg_taxi_out", (r) => r.congestion?.avg_taxi_out_min, "min"),
    contrast("p90_taxi_out", (r) => r.congestion?.p90_taxi_out_min, "min"),
    contrast("avg_departure_delay", (r) => r.congestion?.avg_departure_delay_min, "min"),
    contrast("pct_departures_delayed_15", (r) => r.congestion?.pct_departures_delayed_15, "%"),
    contrast("congestion_component_score", (r) => r.score?.components.congestion, "0-100 percentile score"),
  ].filter(Boolean);

  const sizes = rows.map((r) => r.scale.passenger_departures_12mo);
  const sizeRatio = Math.max(...sizes) / Math.min(...sizes);
  return ok(
    { airports: rows, contrasts },
    {
      assumptions: [
        "Volumes are departing passengers on passenger service (T-100 classes F+L) over the last 12 months; load factor = passengers / seats.",
        "For all contrasts, a higher congestion value means MORE congested (longer taxi-out, more delay).",
        `Congestion is measured on on-time-performance months available: ${(await import("../data/db.ts").then((m) => m.dataAsOf())).otp_months.join(", ")}.`,
      ],
      caveats: [
        "On-time data covers large reporting carriers only (the on-time coverage share is listed for each airport), so smaller-carrier delays are missing.",
        "Taxi-out and delay measure ground and departure-flow congestion, not runway or terminal capacity.",
        ...(sizeRatio >= 3 ? [`The airports differ a lot in scale (up to ${r1(sizeRatio)}x in departures); per-flight measures are comparable, but total delay burden is larger at the bigger airport.`] : []),
        ...(rows.some((r) => r.congestion == null) ? ["Some airports have no on-time sample, so their congestion is not shown."] : []),
      ],
      sources: [SOURCES.t100, SOURCES.otp],
    },
  );
}
