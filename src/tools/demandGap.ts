import { z } from "zod";
import { allMetrics, query } from "../data/db.ts";
import { PASSENGER_CLASSES, latestIdx, ltmPredicate } from "../data/windows.ts";
import { EDITORIAL_CONSTRAINTS, scoreAirports } from "../scoring/index.ts";
import { err, ok, pct1, r1, SOURCES, type ToolResult } from "./envelope.ts";

export const demandGapInput = z.object({
  airport: z.string().regex(/^[A-Za-z]{3}$/, "IATA code").transform((s) => s.toUpperCase()).describe("IATA code, e.g. SFO."),
  target_load_factor: z.number().min(0.6).max(0.95).optional().describe("Load factor above which seats are treated as 'full' (default 0.85, an industry rule of thumb). A stated assumption, not a measurement."),
  nearby_miles: z.number().int().min(10).max(150).optional().describe("Radius for nearby alternative airports (default 60 miles)."),
});

const fmtIdx = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;

export async function demandGap(input: z.infer<typeof demandGapInput>): Promise<ToolResult<unknown>> {
  const { airport } = input;
  const target = input.target_load_factor ?? 0.85;
  const radius = input.nearby_miles ?? 60;
  const ltm = await ltmPredicate();
  const latest = await latestIdx();

  const monthly = await query<{ ym: number; seats: number; pax: number; deps: number }>(`
    SELECT YEAR*12+MONTH-1 AS ym, sum(SEATS) AS seats, sum(PASSENGERS) AS pax, sum(DEPARTURES_PERFORMED) AS deps
    FROM t100 WHERE ORIGIN = '${airport}' AND CLASS IN (${PASSENGER_CLASSES}) AND SEATS > 0 AND ${ltm} GROUP BY 1 ORDER BY 1`);
  if (!monthly.length) return err(`No passenger-service data for ${airport}.`, "Check the code with resolve_airports.");

  const months = monthly.map((m) => ({ month: fmtIdx(m.ym), load_factor_pct: pct1(m.pax / m.seats), seats: Math.round(m.seats), passengers: Math.round(m.pax), above_target: m.pax / m.seats > target, shortfall_seats: Math.max(0, Math.round(m.pax / target - m.seats)) }));
  const seats = monthly.reduce((a, m) => a + m.seats, 0);
  const shortfall = months.reduce((a, m) => a + m.shortfall_seats, 0);

  const metrics = await allMetrics();
  const me = metrics.find((m) => m.iata === airport)!;
  const scored = scoreAirports(metrics);
  const s = scored.find((x) => x.iata === airport);
  const pctOf = (id: string) => s?.components.flatMap((c) => c.metrics).find((m) => m.id === id)?.percentile ?? null;

  const nearby = await query<{ iata: string; name: string; miles: number }>(`
    SELECT b.iata, b.name, round(3959 * acos(least(1, greatest(-1,
             sin(radians(a.lat)) * sin(radians(b.lat)) + cos(radians(a.lat)) * cos(radians(b.lat)) * cos(radians(b.lon - a.lon)))))) AS miles
    FROM airports_ref a, airports_ref b
    WHERE a.iata = '${airport}' AND b.iata <> a.iata AND b.lat IS NOT NULL AND a.lat IS NOT NULL
    ORDER BY miles LIMIT 40`);
  const near = nearby
    .filter((n) => n.miles <= radius)
    .map((n) => ({ ...n, m: metrics.find((x) => x.iata === n.iata) }))
    .filter((n) => (n.m?.ltm_pax ?? 0) >= 300_000)
    .map((n) => ({ iata: n.iata, name: n.m?.name ?? n.name, miles_away: n.miles, passengers_12mo: Math.round(n.m!.ltm_pax!), load_factor_pct: pct1(n.m!.load_factor), pax_growth_yoy_pct: pct1(n.m!.pax_growth_yoy), p90_taxi_out_min: r1(n.m!.p90_taxi_out_min) }));

  const paxGrowth = me.pax_growth_yoy, seatGrowth = me.seat_growth_yoy;
  const evidence: string[] = [];
  if (me.load_factor != null) evidence.push(`Seats were ${pct1(me.load_factor)}% full on average over the last 12 months${pctOf("load_factor") != null ? ` (higher than ${Math.round(pctOf("load_factor")!)}% of scored US airports)` : ""}.`);
  const hot = months.filter((m) => m.above_target);
  evidence.push(hot.length ? `${hot.length} of ${months.length} months exceeded ${pct1(target)}% load factor (${hot.map((m) => `${m.month}: ${m.load_factor_pct}%`).join(", ")}).` : `No month exceeded ${pct1(target)}% load factor.`);
  if (paxGrowth != null && seatGrowth != null) evidence.push(`Passengers changed ${pct1(paxGrowth)}% year over year versus ${pct1(seatGrowth)}% for seats offered${paxGrowth > seatGrowth ? ": demand growing faster than supply." : ": supply growing at least as fast as demand."}`);
  if (me.p90_taxi_out_min != null) evidence.push(`Ground congestion: P90 taxi-out ${r1(me.p90_taxi_out_min)} min${pctOf("p90_taxi_out") != null ? ` (higher than ${Math.round(pctOf("p90_taxi_out")!)}% of scored airports)` : ""}; ${pct1(me.pct_dep_delayed_15)}% of reporting-carrier departures delayed 15+ min.`);
  const spareNearby = near.filter((n) => n.load_factor_pct != null && me.load_factor != null && n.load_factor_pct < me.load_factor * 100 - 3);
  if (spareNearby.length) evidence.push(`Nearby airports have lower load factors (${spareNearby.map((n) => `${n.iata} ${n.load_factor_pct}%`).join(", ")}), consistent with some demand already spilling to them.`);

  const constraint = EDITORIAL_CONSTRAINTS[airport];

  return ok(
    {
      airport, name: me.name, window: `${fmtIdx(latest - 11)} to ${fmtIdx(latest)}`,
      headline: { load_factor_pct: pct1(me.load_factor), peak_month_load_factor_pct: pct1(me.peak_month_load_factor), months_above_target: hot.length, target_load_factor_pct: pct1(target) },
      seat_shortfall_proxy: { seats_needed_to_bring_months_to_target: shortfall, pct_of_annual_seats: r1((100 * shortfall) / seats), basis: `sum over months of max(0, passengers / ${target} - seats)` },
      growth: { passengers_yoy_pct: pct1(paxGrowth), seats_yoy_pct: pct1(seatGrowth) },
      monthly: months,
      nearby_alternatives: near,
      evidence,
      ...(constraint ? { editorial_constraint: constraint } : {}),
      cannot_be_measured_here: ["True unconstrained demand (travellers who never booked or chose another mode)", "Fare levels and yield (airfare data such as DB1B is not loaded)", "Denied boarding, waitlists or gate/slot constraints", "Cargo or international origin-destination demand beyond what appears in T-100 segments"],
    },
    {
      assumptions: [
        `"Unmet demand" is not directly observable. This tool reports PROXIES: seats full above ${pct1(target)}% load factor, demand growing faster than seats, ground congestion, and spill to nearby airports.`,
        `The seat shortfall proxy asks how many extra seats would have been needed to keep every month at or below ${pct1(target)}% load factor. ${pct1(target)}% is a rule-of-thumb assumption.`,
      ],
      caveats: [
        "Load factor above the target does not prove customers were turned away; airlines also fill planes by pricing.",
        ...(me.otp_months != null && me.otp_months < 6 ? [`Congestion rests on ${me.otp_months} month(s) of on-time data and may reflect one season.`] : []),
        ...(constraint ? ["The airport has a hand-written note that its binding constraint may not be the terminal (see editorial_constraint)."] : []),
      ],
      sources: [SOURCES.t100, SOURCES.otp, SOURCES.oa],
    },
  );
}
