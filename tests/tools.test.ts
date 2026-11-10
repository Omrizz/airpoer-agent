// Integration tests for the tool layer against the real DuckDB snapshot (no LLM, no network).
// The database is built from the committed parquet snapshot on first use, so these always run.
import { describe, expect, it } from "vitest";
import { anthropicTools, runTool } from "../src/tools/index.ts";

const d = describe;

async function call(name: string, input: unknown) {
  const r = await runTool(name, input);
  return { ...r, json: JSON.parse(r.content) as any };
}

describe("tool schemas", () => {
  it("exposes valid JSON schemas with descriptions", () => {
    const tools = anthropicTools();
    expect(tools.map((t) => t.name)).toEqual(["resolve_airports", "rank_airports", "compare_airports", "route_mix", "demand_gap", "estimate_upside", "live_status", "get_methodology"]);
    for (const t of tools) {
      expect(t.description.length).toBeGreaterThan(40);
      expect(t.input_schema.type).toBe("object");
      expect(t.input_schema).not.toHaveProperty("$schema");
    }
  });
});

d("runTool safety", () => {
  it("rejects unknown tools and bad input without throwing", async () => {
    expect((await call("nope", {})).is_error).toBe(true);
    const bad = await call("route_mix", { airport: "ANCHORAGE" });
    expect(bad.is_error).toBe(true);
    expect(bad.json.ok).toBe(false);
  });
  it("cannot be SQL-injected through airport codes", async () => {
    const r = await call("compare_airports", { airports: ["LAX", "SNA'); DROP TABLE t100;--"] });
    expect(r.is_error).toBe(true);
  });
});

d("resolve_airports", () => {
  it("expands New England to six states", async () => {
    const r = await call("resolve_airports", { query: "New England" });
    expect(r.json.data.kind).toBe("region");
    expect(r.json.data.states.sort()).toEqual(["CT", "MA", "ME", "NH", "RI", "VT"]);
  });
  it("maps LA to LAX first and flags ambiguity", async () => {
    const r = await call("resolve_airports", { query: "LA" });
    expect(r.json.data.matches[0].iata).toBe("LAX");
    expect(r.json.data.ambiguous).toBe(true);
  });
  it("finds Santa Ana / John Wayne as SNA", async () => {
    for (const q of ["Santa Ana", "John Wayne airport", "sna"]) {
      const r = await call("resolve_airports", { query: q });
      expect(r.json.data.matches.map((m: any) => m.iata)).toContain("SNA");
    }
  });
  it("returns none (not a guess) for nonsense", async () => {
    const r = await call("resolve_airports", { query: "Zzyzx Nowhere" });
    expect(r.json.data.kind).toBe("none");
    expect(r.json.caveats.join(" ")).toMatch(/do not guess/i);
  });
  it("includes data_as_of on every success", async () => {
    const r = await call("resolve_airports", { query: "Anchorage" });
    expect(r.json.data_as_of.t100_through).toMatch(/^\d{4}-\d{2}$/);
  });
});

d("rank_airports", () => {
  it("ranks New England with Boston first and lists unscored airports", async () => {
    const r = await call("rank_airports", { region: "New England", top_n: 5 });
    expect(r.json.ok).toBe(true);
    expect(r.json.data.ranked[0].iata).toBe("BOS");
    expect(r.json.data.ranked.every((a: any) => ["CT", "ME", "MA", "NH", "RI", "VT"].includes(a.state))).toBe(true);
    expect(r.json.data.not_scored_in_scope_listed.length).toBeGreaterThan(0);
    // The listed names are capped; the total must be reported separately so nobody quotes the cap as the count.
    expect(r.json.data.not_scored_in_scope_total).toBeGreaterThan(r.json.data.not_scored_in_scope_listed.length);
    expect(r.json.data.not_scored_note).toMatch(/quote the total/);
    expect(r.json.data.sensitivity.rows.length).toBeGreaterThan(0);
  });
  it("component points sum to the score", async () => {
    const r = await call("rank_airports", { top_n: 3 });
    for (const a of r.json.data.ranked) {
      const sum = Object.values<any>(a.components).reduce((s, c) => s + c.points, 0);
      expect(Math.abs(sum - a.score)).toBeLessThan(0.3);
    }
  });
  it("honours weight overrides and reports them", async () => {
    const r = await call("rank_airports", { top_n: 3, weights: { demand_pressure: 0, congestion: 1, growth: 0, scale: 0 } });
    expect(r.json.data.weights_used_pct.congestion).toBe(100);
  });
  it("errors helpfully on an unknown region", async () => {
    const r = await call("rank_airports", { region: "Narnia" });
    expect(r.is_error).toBe(true);
    expect(r.json.hint).toMatch(/resolve_airports/);
  });
});

d("compare_airports", () => {
  it("compares LAX and SNA and reports scale and congestion", async () => {
    const r = await call("compare_airports", { airports: ["lax", "sna"] });
    expect(r.json.ok).toBe(true);
    const lax = r.json.data.airports.find((a: any) => a.iata === "LAX");
    const sna = r.json.data.airports.find((a: any) => a.iata === "SNA");
    expect(lax.scale.passenger_departures_12mo).toBeGreaterThan(sna.scale.passenger_departures_12mo * 3);
    expect(lax.congestion.avg_taxi_out_min).toBeGreaterThan(0);
    expect(r.json.data.contrasts.length).toBeGreaterThan(3);
    expect(r.json.caveats.join(" ")).toMatch(/scale/);
  });
  it("needs two distinct airports", async () => {
    expect((await call("compare_airports", { airports: ["LAX", "LAX"] })).is_error).toBe(true);
  });
});

d("route_mix", () => {
  it("ANC: long-haul share is small for passengers and sensitive to threshold", async () => {
    const r = await call("route_mix", { airport: "ANC", long_haul_miles: 3000 });
    expect(r.json.ok).toBe(true);
    const share = r.json.data.long_haul.pct_of_departures;
    expect(share).toBeGreaterThan(0.5);
    expect(share).toBeLessThan(8);
    const sens = r.json.data.threshold_sensitivity;
    expect(sens[0].pct_of_departures).toBeGreaterThan(sens.at(-1).pct_of_departures); // monotone in threshold
  });
  it("ANC: warns that cargo flights outnumber passenger flights", async () => {
    const r = await call("route_mix", { airport: "ANC" });
    expect(r.json.caveats.join(" ")).toMatch(/all-cargo departures/);
    expect(r.json.data.service_mix_all_flights.all_cargo_departures).toBeGreaterThan(r.json.data.service_mix_all_flights.passenger_departures);
  });
  it("ANC: gives the long-haul share for passenger, cargo and all flights in one call (no guessing the cargo effect)", async () => {
    const r = await call("route_mix", { airport: "ANC" });
    const s = r.json.data.long_haul_share_by_scope_pct;
    expect(s.passenger_flights_pct).toBe(r.json.data.long_haul.pct_of_departures);
    expect(s.all_cargo_flights_pct).toBeGreaterThan(s.passenger_flights_pct);
    expect(s.all_flights_pct).toBeGreaterThan(s.passenger_flights_pct); // cargo RAISES the long-haul share at ANC
    expect(r.json.caveats.join(" ")).toContain(`${s.all_flights_pct}% of all flights`);
  });
  it("distance bands cover 100% of counted departures", async () => {
    const r = await call("route_mix", { airport: "BOS" });
    const total = r.json.data.distance_bands.reduce((s: number, b: any) => s + b.pct_of_departures, 0);
    expect(Math.abs(total - 100)).toBeLessThan(0.5);
  });
  it("reports a clear error for an airport with no data", async () => {
    expect((await call("route_mix", { airport: "ZZZ" })).is_error).toBe(true);
  });
});

d("demand_gap", () => {
  it("SFO: returns proxies, nearby alternatives, the editorial note, and what cannot be measured", async () => {
    const r = await call("demand_gap", { airport: "SFO" });
    expect(r.json.ok).toBe(true);
    expect(r.json.data.monthly).toHaveLength(12);
    expect(r.json.data.headline.load_factor_pct).toBeGreaterThan(70);
    expect(r.json.data.nearby_alternatives.map((n: any) => n.iata)).toEqual(expect.arrayContaining(["OAK", "SJC"]));
    expect(r.json.data.editorial_constraint).toBeTruthy();
    expect(r.json.data.cannot_be_measured_here.length).toBeGreaterThan(2);
    expect(r.json.assumptions.join(" ")).toMatch(/not directly observable/);
  });
  it("shortfall proxy is zero when the target is above every month's load factor", async () => {
    const r = await call("demand_gap", { airport: "SFO", target_load_factor: 0.95 });
    expect(r.json.data.seat_shortfall_proxy.seats_needed_to_bring_months_to_target).toBe(0);
  });
});

d("get_methodology", () => {
  it("lists four components whose default weights sum to 100", async () => {
    const r = await call("get_methodology", {});
    const w = r.json.data.components.reduce((s: number, c: any) => s + c.default_weight_pct, 0);
    expect(r.json.data.components).toHaveLength(4);
    expect(w).toBe(100);
  });
});
