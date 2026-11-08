import { z } from "zod";
import { query } from "../data/db.ts";
import { CARGO_CLASSES, PASSENGER_CLASSES, ltmPredicate } from "../data/windows.ts";
import { err, ok, pct1, r1, SOURCES, type ToolResult } from "./envelope.ts";

export const routeMixInput = z.object({
  airport: z.string().regex(/^[A-Za-z]{3}$/, "IATA code").transform((s) => s.toUpperCase()).describe("IATA code of the ORIGIN airport, e.g. ANC."),
  service: z.enum(["passenger", "cargo", "all"]).optional().describe('Which flights to count. Default "passenger" (scheduled + non-scheduled passenger/combination). "cargo" = all-cargo only.'),
  long_haul_miles: z.number().int().min(100).max(9000).optional().describe("Distance at/above which a flight counts as long-haul. Default 3000 statute miles. There is no official definition, so state this choice."),
  year: z.number().int().min(2024).max(2026).optional().describe("Calendar year instead of the default last-12-months window."),
});

interface Band { band: string; deps: number; pax: number; seats: number }

const BANDS: [string, number, number][] = [["under 500 mi", 0, 500], ["500-1,499 mi", 500, 1500], ["1,500-2,999 mi", 1500, 3000], ["3,000-3,999 mi", 3000, 4000], ["4,000+ mi", 4000, 99999]];

export async function routeMix(input: z.infer<typeof routeMixInput>): Promise<ToolResult<unknown>> {
  const { airport } = input;
  const service = input.service ?? "passenger";
  const threshold = input.long_haul_miles ?? 3000;
  const classes = service === "passenger" ? PASSENGER_CLASSES : service === "cargo" ? CARGO_CLASSES : `${PASSENGER_CLASSES},${CARGO_CLASSES}`;
  const window = input.year ? `YEAR = ${input.year}` : await ltmPredicate();
  const windowLabel = input.year ? `calendar year ${input.year}${input.year === 2026 ? " (January-July only)" : ""}` : "last 12 months";
  const base = `FROM t100 WHERE ORIGIN = '${airport}' AND DEPARTURES_PERFORMED > 0 AND ${window}`;

  const bands = await query<Band>(`
    SELECT CASE ${BANDS.map(([l, lo, hi]) => `WHEN DISTANCE >= ${lo} AND DISTANCE < ${hi} THEN '${l}'`).join(" ")} END AS band,
           sum(DEPARTURES_PERFORMED) AS deps, sum(PASSENGERS) AS pax, sum(SEATS) AS seats
    ${base} AND CLASS IN (${classes}) GROUP BY 1`);
  const total = bands.reduce((a, b) => a + b.deps, 0);
  if (!total) {
    const any = await query<{ n: number }>(`SELECT count(*) AS n ${base}`);
    return err(`No ${service} departures found from ${airport} in the ${windowLabel}.`, any[0]!.n ? `${airport} has other service types; try service "all" or "cargo".` : "Check the airport code.");
  }
  const totalPax = bands.reduce((a, b) => a + b.pax, 0);

  const sens = await query<{ t: number; deps_share: number; pax_share: number | null }>(`
    SELECT t, sum(CASE WHEN DISTANCE >= t THEN DEPARTURES_PERFORMED ELSE 0 END) / sum(DEPARTURES_PERFORMED) AS deps_share,
           CASE WHEN sum(PASSENGERS) > 0 THEN sum(CASE WHEN DISTANCE >= t THEN PASSENGERS ELSE 0 END) / sum(PASSENGERS) END AS pax_share
    FROM t100 CROSS JOIN (VALUES (1500), (2000), (2500), (3000), (3500), (4000)) AS th(t)
    WHERE ORIGIN = '${airport}' AND DEPARTURES_PERFORMED > 0 AND ${window} AND CLASS IN (${classes})
    GROUP BY t ORDER BY t`);

  const [at] = await query<{ deps: number; pax: number; intl: number }>(`
    SELECT sum(CASE WHEN DISTANCE >= ${threshold} THEN DEPARTURES_PERFORMED ELSE 0 END) AS deps,
           sum(CASE WHEN DISTANCE >= ${threshold} THEN PASSENGERS ELSE 0 END) AS pax,
           sum(CASE WHEN DEST_COUNTRY <> 'US' THEN DEPARTURES_PERFORMED ELSE 0 END) AS intl
    ${base} AND CLASS IN (${classes})`);

  const mix = await query<{ kind: string; deps: number; freight_tons: number; pax: number }>(`
    SELECT CASE WHEN CLASS IN (${PASSENGER_CLASSES}) THEN 'passenger/combination' ELSE 'all-cargo' END AS kind,
           sum(DEPARTURES_PERFORMED) AS deps, sum(FREIGHT) / 2000 AS freight_tons, sum(PASSENGERS) AS pax
    ${base} GROUP BY 1`);

  const top = await query<{ dest: string; city: string; miles: number; deps: number; pax: number }>(`
    SELECT DEST AS dest, any_value(DEST_CITY_NAME) AS city, any_value(DISTANCE) AS miles, sum(DEPARTURES_PERFORMED) AS deps, sum(PASSENGERS) AS pax
    ${base} AND CLASS IN (${classes}) AND DISTANCE >= ${threshold} GROUP BY 1 ORDER BY deps DESC LIMIT 8`);

  const cargoDeps = mix.find((m) => m.kind === "all-cargo")?.deps ?? 0;
  const paxDeps = mix.find((m) => m.kind !== "all-cargo")?.deps ?? 0;

  // The same long-haul share under each scope, so the answer never has to guess how cargo changes it.
  const byKind = await query<{ kind: string; deps: number; lh: number }>(`
    SELECT CASE WHEN CLASS IN (${PASSENGER_CLASSES}) THEN 'passenger' ELSE 'cargo' END AS kind,
           sum(DEPARTURES_PERFORMED) AS deps,
           sum(CASE WHEN DISTANCE >= ${threshold} THEN DEPARTURES_PERFORMED ELSE 0 END) AS lh
    ${base} GROUP BY 1`);
  const kind = (k: string) => byKind.find((b) => b.kind === k);
  const share = (deps?: number, lh?: number) => (deps ? pct1((lh ?? 0) / deps) : null);
  const scopeComparison = {
    passenger_flights_pct: share(kind("passenger")?.deps, kind("passenger")?.lh),
    all_cargo_flights_pct: share(kind("cargo")?.deps, kind("cargo")?.lh),
    all_flights_pct: share(byKind.reduce((a, b) => a + b.deps, 0), byKind.reduce((a, b) => a + b.lh, 0)),
  };

  return ok(
    {
      airport, service, window: windowLabel, long_haul_threshold_miles: threshold,
      departures_counted: Math.round(total),
      long_haul: {
        departures: Math.round(at!.deps), pct_of_departures: pct1(at!.deps / total),
        ...(service !== "cargo" ? { passengers: Math.round(at!.pax), pct_of_passengers: totalPax ? pct1(at!.pax / totalPax) : null } : {}),
      },
      threshold_sensitivity: sens.map((s) => ({ miles: s.t, pct_of_departures: pct1(s.deps_share), pct_of_passengers: s.pax_share == null || service === "cargo" ? null : pct1(s.pax_share) })),
      distance_bands: BANDS.map(([label]) => bands.find((b) => b.band === label)).filter(Boolean).map((b) => ({ band: b!.band, departures: Math.round(b!.deps), pct_of_departures: pct1(b!.deps / total), pct_of_passengers: totalPax && service !== "cargo" ? pct1(b!.pax / totalPax) : null })),
      international_pct_of_departures: pct1(at!.intl / total),
      long_haul_share_by_scope_pct: scopeComparison,
      service_mix_all_flights: { passenger_departures: Math.round(paxDeps), all_cargo_departures: Math.round(cargoDeps), all_cargo_freight_tons: Math.round(mix.find((m) => m.kind === "all-cargo")?.freight_tons ?? 0) },
      top_long_haul_destinations: top.map((t) => ({ dest: t.dest, city: t.city, miles: Math.round(t.miles), departures: Math.round(t.deps), passengers: Math.round(t.pax) })),
    },
    {
      assumptions: [
        `"Long-haul" = nonstop segment distance of ${threshold}+ statute miles. There is no official definition; the sensitivity breakdown (1,500 to 4,000 miles) shows how the answer moves.`,
        `Scope = ${service === "passenger" ? "passenger/combination flights (T-100 classes F+L), departures from the airport" : service === "cargo" ? "all-cargo flights (classes G+P)" : "passenger and all-cargo flights combined"}; window = ${windowLabel}.`,
        "Share is by departures performed on nonstop segments; the passenger share weights each segment by passengers carried.",
      ],
      caveats: [
        ...(cargoDeps > paxDeps ? [`${airport} has more all-cargo departures (${Math.round(cargoDeps)}) than passenger ones (${Math.round(paxDeps)}), so the answer depends heavily on whether cargo is included: ${scopeComparison.passenger_flights_pct}% of passenger flights, ${scopeComparison.all_cargo_flights_pct}% of all-cargo flights and ${scopeComparison.all_flights_pct}% of all flights are long-haul at this threshold.`] : cargoDeps > 0 ? [`Including all-cargo flights, ${scopeComparison.all_flights_pct}% of all departures are long-haul (passenger flights alone: ${scopeComparison.passenger_flights_pct}%).`] : []),
        "Segment distance is the nonstop leg flown, not the passenger's full trip; a connecting passenger counts on each leg.",
        "Only direct departures from this airport are counted (origin = this airport).",
      ],
      sources: [SOURCES.t100],
    },
  );
}
