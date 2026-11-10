import { describe, expect, it } from "vitest";
import { SCENARIOS } from "../src/finance/config.ts";
import { computeScenario } from "../src/finance/upside.ts";
import { runTool } from "../src/tools/index.ts";

const call = async (input: unknown) => {
  const r = await runTool("estimate_upside", input);
  return { ...r, json: JSON.parse(r.content) as any };
};

describe("finance arithmetic", () => {
  const input = { added_enplanements: 1_000_000, share_of_growth: 1, horizon_years: 25 };
  it("computes revenue, profit, capex and payback exactly", () => {
    const r = computeScenario({ id: "t", label: "t", revenue_per_enplanement: 30, opex_per_enplanement: 20, capex_per_added_enplanement: 500 }, input);
    expect(r.added_annual_revenue_usd_m).toBe(30);
    expect(r.added_annual_operating_profit_usd_m).toBe(10);
    expect(r.capex_usd_m).toBe(500);
    expect(r.simple_payback_years).toBe(50);
    expect(r.operating_margin_pct).toBe(33.3);
    expect(r.breakeven_capex_per_enplanement).toBe(250);
  });
  it("scales with the share of growth the project is assumed to enable", () => {
    const full = computeScenario(SCENARIOS[1]!, input);
    const half = computeScenario(SCENARIOS[1]!, { ...input, share_of_growth: 0.5 });
    expect(half.added_annual_revenue_usd_m).toBeCloseTo(full.added_annual_revenue_usd_m / 2, 1);
    expect(half.simple_payback_years).toBe(full.simple_payback_years); // ratio does not depend on size
  });
  it("gives no payback when operating profit is not positive", () => {
    const r = computeScenario({ id: "t", label: "t", revenue_per_enplanement: 10, opex_per_enplanement: 12, capex_per_added_enplanement: 500 }, input);
    expect(r.simple_payback_years).toBeNull();
    expect(r.breakeven_capex_per_enplanement).toBeNull();
  });
  it("orders the scenarios optimistic > base > conservative on profit per passenger", () => {
    const p = SCENARIOS.map((s) => s.revenue_per_enplanement - s.opex_per_enplanement);
    expect(p[0]).toBeGreaterThan(p[1]!);
    expect(p[1]).toBeGreaterThan(p[2]!);
  });
});

describe("estimate_upside tool", () => {
  it("returns three scenarios, the forecast basis, assumptions and the not-in-score caveat", async () => {
    const r = await call({ airport: "bos" });
    expect(r.json.ok).toBe(true);
    expect(r.json.data.scenarios.map((s: any) => s.id)).toEqual(["optimistic", "base", "conservative"]);
    expect(r.json.data.forecast.added_enplanements_by_2035).toBeGreaterThan(1_000_000);
    expect(r.json.caveats.join(" ")).toMatch(/not used in it/);
    expect(r.json.caveats.join(" ")).toMatch(/do not rank airports/);
    expect(r.json.sources.length).toBeGreaterThan(2);
  });
  it("shows the airport's own CATS figures where known, and null otherwise", async () => {
    expect((await call({ airport: "BOS" })).json.data.airport_own_figures.fy2025_cats.revenue_per_enplanement).toBe(48.69);
    expect((await call({ airport: "BGR" })).json.data.airport_own_figures).toBeNull();
  });
  it("uses filed figures for shortlist airports and says which source it used", async () => {
    const ewr = (await call({ airport: "EWR" })).json.data;
    expect(ewr.revenue_and_cost_source).toBe("airport_filed");
    expect(ewr.airport_own_figures.fy2025_cats.revenue_per_enplanement).toBe(60.4);
    expect(ewr.airport_own_figures.fy2025_cats.opex_per_enplanement).toBe(34.9);
    expect(ewr.airport_own_figures.scenario.revenue_per_enplanement).toBe(60.4);
    expect((await call({ airport: "BGR" })).json.data.revenue_and_cost_source).toBe("benchmark");
  });
  it("shows a loss-making airport as having no payback", async () => {
    const btv = (await call({ airport: "BTV" })).json.data;
    expect(btv.airport_own_figures.scenario.operating_profit_per_enplanement).toBeLessThan(0);
    expect(btv.airport_own_figures.scenario.simple_payback_years).toBeNull();
  });
  it("filed figures match the committed CSV", async () => {
    const { readFileSync } = await import("node:fs");
    const { FILED_FIGURES } = await import("../src/finance/filed.ts");
    const rows = readFileSync("snapshot/airport_finance_fy2025.csv", "utf8").trim().split("\n").slice(1).map((l) => l.split(","));
    expect(rows.length).toBe(Object.keys(FILED_FIGURES).length);
    for (const r of rows) expect(FILED_FIGURES[r[0]!]).toMatchObject({ enplanements: +r[3]!, revenue_usd_k: +r[4]!, opex_usd_k: +r[5]! });
  });
  it("adds a custom scenario using the user's values and base for the rest", async () => {
    const r = await call({ airport: "BGR", custom: { revenue_per_enplanement: 40 } });
    const c = r.json.data.scenarios.find((s: any) => s.id === "custom");
    expect(c.revenue_per_enplanement).toBe(40);
    expect(c.opex_per_enplanement).toBe(21.54);
    expect(c.capex_per_added_enplanement).toBe(510);
  });
  it("honours the share of forecast growth", async () => {
    const full = (await call({ airport: "BOS" })).json.data.scenarios[1];
    const part = (await call({ airport: "BOS", share_of_forecast_growth: 0.5 })).json.data.scenarios[1];
    expect(part.added_enplanements_counted).toBeCloseTo(full.added_enplanements_counted / 2, -1);
  });
  it("errors helpfully for an unknown airport and rejects bad input", async () => {
    expect((await call({ airport: "ZZZ" })).is_error).toBe(true);
    expect((await call({ airport: "BOS'; DROP" })).is_error).toBe(true);
    expect((await call({ airport: "BOS", share_of_forecast_growth: 3 })).is_error).toBe(true);
  });
});
