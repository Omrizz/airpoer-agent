// Dev CLI: score the real data. Usage: npm run score -- [--region NE|CA|AK|XX,YY] [--top 15] [--detail SFO,BOS]
import { DuckDBInstance } from "@duckdb/node-api";
import { formatMetric, scoreAirports, sensitivity, type AirportMetrics } from "../src/scoring/index.ts";

const args = process.argv.slice(2);
const arg = (name: string, dflt = "") => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] ?? dflt) : dflt;
};
const REGIONS: Record<string, string[]> = {
  NE: ["CT", "ME", "MA", "NH", "RI", "VT"], // New England
};
const region = arg("region");
const states = region ? (REGIONS[region.toUpperCase()] ?? region.toUpperCase().split(",")) : null;
const top = Number(arg("top", "15"));
const detail = arg("detail").split(",").filter(Boolean);

const con = await (await DuckDBInstance.create("data/airports.duckdb", { access_mode: "READ_ONLY" })).connect();
const rows = (await con.runAndReadAll(`SELECT * FROM airport_metrics`)).getRowObjects();
const num = (v: unknown) => (v == null ? null : Number(v));
const metrics: AirportMetrics[] = rows.map((r) => ({
  iata: String(r.iata), name: r.name as string | null, city: r.city as string | null, state: r.state as string | null,
  ltm_pax: num(r.ltm_pax), months_covered: num(r.months_covered), load_factor: num(r.load_factor),
  peak_month_load_factor: num(r.peak_month_load_factor), pax_growth_yoy: num(r.pax_growth_yoy),
  seat_growth_yoy: num(r.seat_growth_yoy), p90_taxi_out_min: num(r.p90_taxi_out_min),
  pct_dep_delayed_15: num(r.pct_dep_delayed_15), nas_delay_share: num(r.nas_delay_share),
  otp_coverage: num(r.otp_coverage), otp_months: num(r.otp_months),
  taf_enpl_2025: num(r.taf_enpl_2025), taf_enpl_2035: num(r.taf_enpl_2035),
}));

const opts = states ? { filter: (m: AirportMetrics) => states.includes(m.state ?? "") } : {};
const scored = scoreAirports(metrics, opts);
console.log(`\nPeer set scored: ${scoreAirports(metrics).length} airports${states ? `; showing ${scored.length} in ${states.join(",")}` : ""}\n`);

console.table(
  scored.slice(0, top).map((s) => ({
    rank: s.rank, national: s.nationalRank, iata: s.iata, state: s.state, score: +s.score.toFixed(1),
    demand: +(s.components[0]!.score ?? NaN).toFixed(0), congestion: +(s.components[1]!.score ?? NaN).toFixed(0),
    growth: +(s.components[2]!.score ?? NaN).toFixed(0), scale: +(s.components[3]!.score ?? NaN).toFixed(0),
    conf: s.confidence,
  })),
);

for (const code of detail) {
  const s = scoreAirports(metrics).find((x) => x.iata === code);
  if (!s) { console.log(`\n${code}: not in peer set`); continue; }
  console.log(`\n--- ${s.iata} ${s.name ?? ""}: ${s.score.toFixed(1)} (national #${s.nationalRank}, ${s.confidence} confidence)`);
  for (const c of s.components) {
    console.log(`  ${c.label}: ${c.score == null ? "n/a" : c.score.toFixed(0)} x ${(c.weight * 100).toFixed(0)}% = ${c.contribution.toFixed(1)}`);
    for (const m of c.metrics) console.log(`     ${m.label}: ${m.value == null ? "n/a" : formatMetric(m, m.value)}${m.percentile == null ? "" : ` (p${m.percentile.toFixed(0)})`}`);
  }
  s.flags.forEach((f) => console.log(`  ! [${f.code}] ${f.message}`));
}

const sens = sensitivity(metrics, { ...opts, k: 5 });
console.log(`\nSensitivity (each weight +/-${sens.delta * 100}%, ${sens.scenarios} scenarios): top-${sens.k} ${sens.stable ? "STABLE" : "NOT stable"}`);
console.table(sens.rows);
