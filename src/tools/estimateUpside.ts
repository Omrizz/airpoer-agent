import { z } from "zod";
import { allMetrics } from "../data/db.ts";
import { AIRPORT_REFERENCE, DEFAULT_HORIZON_YEARS, DEFAULT_SHARE_OF_GROWTH, FINANCE_SOURCES, FORECAST_YEAR, SCENARIOS } from "../finance/config.ts";
import { FILED_FIGURES } from "../finance/filed.ts";
import { computeScenario } from "../finance/upside.ts";
import { err, ok, type ToolResult } from "./envelope.ts";

export const estimateUpsideInput = z.object({
  airport: z.string().regex(/^[A-Za-z]{3}$/, "IATA code").transform((s) => s.toUpperCase()).describe("IATA code, e.g. BOS."),
  share_of_forecast_growth: z.number().min(0.05).max(1).optional().describe("Share (0.05-1) of the FAA-forecast added passengers that depends on the new capacity. Default 1 (all of it), which is an upper bound; lower it if existing capacity could absorb part of the growth."),
  horizon_years: z.number().int().min(5).max(40).optional().describe("Years used for the breakeven build cost (default 25)."),
  custom: z.object({
    revenue_per_enplanement: z.number().min(0).max(200).optional(),
    opex_per_enplanement: z.number().min(0).max(200).optional(),
    capex_per_added_enplanement: z.number().min(0).max(5000).optional(),
  }).optional().describe("The user's own assumptions in US dollars, per enplanement. Missing values use the base scenario. Adds a 'custom' scenario."),
});

export async function estimateUpside(input: z.infer<typeof estimateUpsideInput>): Promise<ToolResult<unknown>> {
  const { airport } = input;
  const share = input.share_of_forecast_growth ?? DEFAULT_SHARE_OF_GROWTH;
  const horizon = input.horizon_years ?? DEFAULT_HORIZON_YEARS;

  const me = (await allMetrics()).find((m) => m.iata === airport);
  if (!me) return err(`No data for ${airport}.`, "Only airports in the scored peer set (at least 300,000 departing passengers a year) have forecasts here. Check the code with resolve_airports.");
  const a = me.taf_enpl_2025;
  const b = me.taf_enpl_2035;
  if (a == null || b == null) return err(`No FAA forecast for ${airport}.`, "The financial scenarios need the FAA Terminal Area Forecast; this airport has none.");
  const added = b - a;
  if (added <= 0) return err(`The FAA forecast shows no passenger growth at ${airport} by ${FORECAST_YEAR}.`, "There is no added demand to put a dollar figure on.");

  const i = { added_enplanements: added, share_of_growth: share, horizon_years: horizon };
  const scenarios = SCENARIOS.map((s) => computeScenario(s, i));

  const base = SCENARIOS.find((s) => s.id === "base")!;
  const c = input.custom;
  if (c) {
    scenarios.push(computeScenario({
      id: "custom", label: "Custom (user assumptions)",
      revenue_per_enplanement: c.revenue_per_enplanement ?? base.revenue_per_enplanement,
      opex_per_enplanement: c.opex_per_enplanement ?? base.opex_per_enplanement,
      capex_per_added_enplanement: c.capex_per_added_enplanement ?? base.capex_per_added_enplanement,
      basis: "Values supplied by the user; any value not supplied uses the base scenario.",
    }, i));
  }

  // Airport's own filed figures replace the generic revenue and cost where we have them.
  const filed = FILED_FIGURES[airport];
  const ref = AIRPORT_REFERENCE[airport];
  const own = filed
    ? { revenue: (filed.revenue_usd_k * 1000) / filed.enplanements, opex: (filed.opex_usd_k * 1000) / filed.enplanements, enplanements: filed.enplanements }
    : ref ? { revenue: ref.revenue_per_enplanement, opex: ref.opex_per_enplanement, enplanements: ref.enplanements } : null;
  const ownScenario = own
    ? computeScenario({ id: "airport_own_fy2025", label: `${airport} at its own FY2025 revenue and cost`, revenue_per_enplanement: own.revenue, opex_per_enplanement: own.opex, capex_per_added_enplanement: base.capex_per_added_enplanement, basis: `${airport}'s own FAA CATS FY2025 revenue and cost per enplanement (cost before depreciation), with the base build cost, which is not airport-specific.` }, i)
    : null;
  const figuresUsed = ownScenario ? "airport_filed" : "benchmark";

  return ok(
    {
      airport,
      name: me.name,
      forecast: { enplanements_2025: Math.round(a), enplanements_2035: Math.round(b), added_enplanements_by_2035: Math.round(added), share_of_growth_counted: share, forecast_year: FORECAST_YEAR },
      revenue_and_cost_source: figuresUsed,
      source_note: ownScenario ? `Headline scenario uses ${airport}'s own filed FY2025 revenue and cost per passenger; the optimistic, base and conservative scenarios are generic benchmarks for comparison.` : `No filed figures for ${airport} were loaded, so only generic benchmark scenarios are shown.`,
      scenarios,
      airport_own_figures: own && ownScenario ? { fy2025_cats: { revenue_per_enplanement: Math.round(own.revenue * 100) / 100, opex_per_enplanement: Math.round(own.opex * 100) / 100, enplanements: own.enplanements }, scenario: ownScenario } : null,
      reading_guide: "Payback is capital cost divided by added annual operating profit (before depreciation and debt service) at the 2035 run rate. Breakeven build cost is the most the project could cost per added annual enplanement and still be repaid by operating profit within the horizon; compare it with each scenario's build cost.",
    },
    {
      assumptions: [
        `Illustrative scenarios, not a valuation or a forecast. Added passengers are the FAA forecast growth from FY2025 to ${FORECAST_YEAR}, scaled by the share the project is assumed to enable (${Math.round(share * 100)}%).`,
        "Revenue and operating cost per added passenger equal the scenario's average per-enplanement figures (FAA CATS FY2025). Operating cost excludes depreciation.",
        "Capital cost per added annual enplanement comes from two recent large-hub terminal projects (Orlando, Newark). Two annual passengers are counted as one enplanement.",
        "Payback ignores ramp-up, discounting, inflation, grants, passenger facility charges and how the project would be financed.",
      ],
      caveats: [
        "These scenarios are identical for every airport except for the number of added passengers, so the payback years do not rank airports; the dollar upside scales with forecast growth. Use the investment score to rank.",
        "Revenue per passenger varies widely between airports (FY2025 FAA CATS: $13.82 at Atlanta to $64.40 at JFK), so any generic figure can be far off for one airport.",
        "Filed figures are one fiscal year of airport-wide averages; revenue and cost on added passengers can differ, and large hubs include non-passenger income such as parking and cargo. Where an airport already loses money before depreciation, expansion at its current economics does not pay back.",
        "Build-cost anchors are two large-hub megaprojects from 2022-23. Costs at small airports, or for renovations rather than new terminals, can be very different.",
        "Counting all forecast growth as dependent on the project is an upper bound; if the existing terminal can absorb part of it, lower the share.",
        "Airline rates at many airports are set to recover capital costs, so a project's revenue can partly reflect cost recovery rather than profit.",
        "This estimate is separate from the investment score and is not used in it.",
      ],
      sources: FINANCE_SOURCES,
    },
  );
}
