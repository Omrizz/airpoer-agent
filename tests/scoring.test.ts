import { describe, expect, it } from "vitest";
import {
  normalizeWeights,
  percentileOf,
  scoreAirports,
  sensitivity,
  weightedMean,
  type AirportMetrics,
} from "../src/scoring/index.ts";

const base: AirportMetrics = {
  iata: "XXX", name: "Test", city: "Town", state: "MA",
  ltm_pax: 2_000_000, months_covered: 12,
  load_factor: 0.8, peak_month_load_factor: 0.85, pax_growth_yoy: 0.03, seat_growth_yoy: 0.03,
  p90_taxi_out_min: 20, pct_dep_delayed_15: 0.2, nas_delay_share: 0.25,
  otp_coverage: 0.9, otp_months: 12,
  taf_enpl_2025: 1_000_000, taf_enpl_2035: 1_200_000,
};
const mk = (iata: string, over: Partial<AirportMetrics> = {}): AirportMetrics => ({ ...base, iata, ...over });

/** A clearly "hot" airport and a clearly "cold" one among filler. */
const field = (): AirportMetrics[] => [
  mk("HOT", {
    load_factor: 0.92, peak_month_load_factor: 0.97, pax_growth_yoy: 0.12, seat_growth_yoy: 0.02,
    p90_taxi_out_min: 40, pct_dep_delayed_15: 0.35, nas_delay_share: 0.5,
    taf_enpl_2025: 1_000_000, taf_enpl_2035: 2_000_000, ltm_pax: 9_000_000,
  }),
  mk("COLD", {
    load_factor: 0.6, peak_month_load_factor: 0.65, pax_growth_yoy: -0.05, seat_growth_yoy: 0.02,
    p90_taxi_out_min: 12, pct_dep_delayed_15: 0.1, nas_delay_share: 0.05,
    taf_enpl_2025: 1_000_000, taf_enpl_2035: 900_000, ltm_pax: 400_000,
  }),
  mk("MID1", { load_factor: 0.8, ltm_pax: 3_000_000 }),
  mk("MID2", { load_factor: 0.78, ltm_pax: 2_500_000, p90_taxi_out_min: 22 }),
  mk("MID3", { load_factor: 0.82, ltm_pax: 1_500_000, pax_growth_yoy: 0.05 }),
];

describe("percentileOf", () => {
  it("ranks min at 0 and max at 100", () => {
    const s = [1, 2, 3, 4, 5];
    expect(percentileOf(s, 1)).toBe(0);
    expect(percentileOf(s, 5)).toBe(100);
    expect(percentileOf(s, 3)).toBe(50);
  });
  it("gives ties the same mid-rank value", () => {
    const s = [1, 2, 2, 2, 9];
    expect(percentileOf(s, 2)).toBe(50);
  });
  it("is neutral (50) for a single peer", () => {
    expect(percentileOf([7], 7)).toBe(50);
  });
});

describe("weightedMean / normalizeWeights", () => {
  it("ignores nulls and re-normalises", () => {
    expect(weightedMean([{ value: 10, weight: 1 }, { value: null, weight: 5 }, { value: 30, weight: 1 }])).toBe(20);
  });
  it("returns null when nothing is available", () => {
    expect(weightedMean([{ value: null, weight: 1 }])).toBeNull();
  });
  it("normalises to sum 1 and rejects an all-zero set", () => {
    const w = normalizeWeights({ a: 3, b: 1 });
    expect(w.a).toBeCloseTo(0.75);
    expect(() => normalizeWeights({ a: 0 })).toThrow();
  });
});

describe("scoreAirports", () => {
  it("ranks the hot airport first and the cold one last", () => {
    const out = scoreAirports(field());
    expect(out[0]!.iata).toBe("HOT");
    expect(out.at(-1)!.iata).toBe("COLD");
    expect(out.map((o) => o.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  it("is deterministic and keeps scores within 0..100", () => {
    const a = scoreAirports(field());
    const b = scoreAirports(field().reverse());
    expect(a.map((x) => x.iata)).toEqual(b.map((x) => x.iata));
    for (const s of a) expect(s.score).toBeGreaterThanOrEqual(0), expect(s.score).toBeLessThanOrEqual(100);
  });

  it("contributions add up to the total score", () => {
    for (const s of scoreAirports(field())) {
      const sum = s.components.reduce((acc, c) => acc + c.contribution, 0);
      expect(sum).toBeCloseTo(s.score, 8);
      expect(s.components.reduce((acc, c) => acc + c.weight, 0)).toBeCloseTo(1, 8);
    }
  });

  it("excludes airports below the traffic or history floor from the peer set", () => {
    const out = scoreAirports([...field(), mk("TINY", { ltm_pax: 50_000 }), mk("SHORT", { months_covered: 4 })]);
    expect(out.map((o) => o.iata)).not.toContain("TINY");
    expect(out.map((o) => o.iata)).not.toContain("SHORT");
  });

  it("does not turn missing data into a zero: a missing component is dropped and flagged", () => {
    const noOtp = mk("NOOTP", { p90_taxi_out_min: null, pct_dep_delayed_15: null, nas_delay_share: null, otp_coverage: null, otp_months: null });
    const out = scoreAirports([...field(), noOtp]);
    const row = out.find((o) => o.iata === "NOOTP")!;
    const congestion = row.components.find((c) => c.id === "congestion")!;
    expect(congestion.score).toBeNull();
    expect(congestion.weight).toBe(0);
    expect(row.flags.map((f) => f.code)).toContain("missing_component");
    expect(row.components.reduce((a, c) => a + c.weight, 0)).toBeCloseTo(1, 8);
  });

  it("filters by region AFTER national scoring (percentiles stay national)", () => {
    const rows = [...field().map((m) => ({ ...m, state: "TX" })), mk("NE1", { state: "ME", load_factor: 0.95 })];
    const national = scoreAirports(rows);
    const regional = scoreAirports(rows, { filter: (m) => m.state === "ME" });
    expect(regional).toHaveLength(1);
    expect(regional[0]!.rank).toBe(1);
    expect(regional[0]!.nationalRank).toBe(national.find((n) => n.iata === "NE1")!.nationalRank);
    expect(regional[0]!.score).toBeCloseTo(national.find((n) => n.iata === "NE1")!.score, 10);
  });

  it("responds to weights: all-in on congestion favours the most congested airport", () => {
    const rows = [
      ...field(),
      mk("JAM", { p90_taxi_out_min: 60, pct_dep_delayed_15: 0.5, nas_delay_share: 0.7, load_factor: 0.7, pax_growth_yoy: 0, peak_month_load_factor: 0.7 }),
    ];
    const out = scoreAirports(rows, { weights: { demand_pressure: 0, congestion: 1, growth: 0, scale: 0 } });
    expect(out[0]!.iata).toBe("JAM");
  });

  it("flags low OTP coverage, short OTP history, and editorial constraints", () => {
    const out = scoreAirports([...field(), mk("SFO", { otp_coverage: 0.4, otp_months: 1 })]);
    const flags = out.find((o) => o.iata === "SFO")!.flags.map((f) => f.code);
    expect(flags).toEqual(expect.arrayContaining(["low_otp_coverage", "single_season_otp", "editorial_constraint"]));
    expect(out.find((o) => o.iata === "SFO")!.confidence).toBe("low");
  });

  it("explains itself: drivers cite the strongest above-median metrics", () => {
    const hot = scoreAirports(field()).find((o) => o.iata === "HOT")!;
    expect(hot.drivers.length).toBeGreaterThan(0);
    expect(hot.drivers.join(" ")).toMatch(/\d(st|nd|rd|th) percentile\)/);
    expect(hot.drivers.join(" ")).not.toMatch(/\b(1th|2th|3th|11st|12nd|13rd)\b/);
  });

  it("returns an empty list when nobody qualifies", () => {
    expect(scoreAirports([mk("A", { ltm_pax: 10 })])).toEqual([]);
  });
});

describe("sensitivity", () => {
  it("reports a clear leader as stable", () => {
    const r = sensitivity(field(), { k: 1 });
    expect(r.rows[0]!.iata).toBe("HOT");
    expect(r.rows[0]!.inTopKShare).toBe(1);
    expect(r.stable).toBe(true);
    expect(r.scenarios).toBe(1 + 4 * 2);
  });

  it("flags instability when two airports trade places under weight changes", () => {
    // A leads on demand, B leads on congestion; they are near-tied overall.
    const a = mk("A", { load_factor: 0.95, peak_month_load_factor: 0.99, p90_taxi_out_min: 15, pct_dep_delayed_15: 0.15, nas_delay_share: 0.2 });
    const b = mk("B", { load_factor: 0.8, peak_month_load_factor: 0.85, p90_taxi_out_min: 45, pct_dep_delayed_15: 0.4, nas_delay_share: 0.6 });
    const filler = [mk("F1"), mk("F2"), mk("F3")];
    const r = sensitivity([a, b, ...filler], { k: 1, delta: 0.9, stableShare: 1 });
    expect(r.rows[0]!.minRank).toBeLessThanOrEqual(r.rows[0]!.baseRank);
    expect(r.rows[0]!.maxRank).toBeGreaterThan(1);
    expect(r.stable).toBe(false);
  });
});
