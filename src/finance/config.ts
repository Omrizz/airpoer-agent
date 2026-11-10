/**
 * Financial scenario assumptions. NOT part of the investment score (see docs/FINANCE.md).
 * Every number here is an assumption anchored on a cited figure. Change them here, or per question
 * through the `custom` argument of the estimate_upside tool. All money is nominal US dollars.
 *
 * Units: per ENPLANEMENT (one boarding passenger), the unit FAA CATS reports in. T-100 "passengers
 * departing" and TAF enplanements are on the same basis, so no conversion is needed for revenue.
 * Capital cost is quoted per added ANNUAL ENPLANEMENT of capacity (two annual passengers = one enplanement).
 */

export interface FinanceScenario {
  id: "optimistic" | "base" | "conservative";
  label: string;
  revenue_per_enplanement: number; // operating revenue per added enplanement, $
  opex_per_enplanement: number; // operating expense excl. depreciation per added enplanement, $
  capex_per_added_enplanement: number; // capital cost per added annual enplanement of capacity, $
  basis: string;
}

export const SCENARIOS: FinanceScenario[] = [
  {
    id: "optimistic",
    label: "Optimistic",
    revenue_per_enplanement: 48.69,
    opex_per_enplanement: 23.85,
    capex_per_added_enplanement: 415,
    basis: "Revenue and cost like Boston (FAA CATS FY2025). Build cost like Newark Terminal A measured against its gross new capacity ($2.7B for 13M+ passengers a year, about $208 per annual passenger, $415 per enplanement).",
  },
  {
    id: "base",
    label: "Base",
    revenue_per_enplanement: 34.28,
    opex_per_enplanement: 21.54,
    capex_per_added_enplanement: 510,
    basis: "US national averages for all filing airports (FAA CATS FY2025). Build cost like Orlando Terminal C ($2.8B for 10-12M added passengers a year, about $254 per annual passenger, $510 per enplanement).",
  },
  {
    id: "conservative",
    label: "Conservative",
    revenue_per_enplanement: 27.45,
    opex_per_enplanement: 18.63,
    capex_per_added_enplanement: 1350,
    basis: "Revenue and cost like Portland, Maine (FAA CATS FY2025). Build cost like Newark Terminal A measured against only the capacity it added over the terminal it replaced ($2.7B for about 4M added passengers a year, $675 per annual passenger, $1,350 per enplanement).",
  },
];

/** FY2025 FAA CATS Form 127 figures, per enplanement, for airports we have looked up. Reference only. */
export const AIRPORT_REFERENCE: Record<string, { revenue_per_enplanement: number; opex_per_enplanement: number; aero_revenue_per_enplanement: number; enplanements: number }> = {
  ATL: { revenue_per_enplanement: 13.82, opex_per_enplanement: 9.11, aero_revenue_per_enplanement: 4.48, enplanements: 53_399_519 },
  BOS: { revenue_per_enplanement: 48.69, opex_per_enplanement: 23.85, aero_revenue_per_enplanement: 23.5, enplanements: 21_823_395 },
  LAX: { revenue_per_enplanement: 54.35, opex_per_enplanement: 27.06, aero_revenue_per_enplanement: 33.85, enplanements: 37_671_297 },
  JFK: { revenue_per_enplanement: 64.4, opex_per_enplanement: 34.49, aero_revenue_per_enplanement: 38.37, enplanements: 31_208_836 },
  PWM: { revenue_per_enplanement: 27.45, opex_per_enplanement: 18.63, aero_revenue_per_enplanement: 9.33, enplanements: 1_278_219 },
  SNA: { revenue_per_enplanement: 33.93, opex_per_enplanement: 22.69, aero_revenue_per_enplanement: 14.93, enplanements: 5_469_903 },
};

export const FORECAST_YEAR = 2035;
export const DEFAULT_SHARE_OF_GROWTH = 1;
export const DEFAULT_HORIZON_YEARS = 25;

export const FINANCE_SOURCES = [
  "US national FY2025: operating revenue $34.28 and operating expense (excl. depreciation) $21.54 per enplanement, from FAA CATS Form 127 as summarised by DWU, dwuconsulting.com/videos/dwu-data-briefing-fifteen-years-of-airport-finance",
  "Airport FY2025 figures (ATL, BOS, LAX, JFK, PWM, SNA): FAA CATS Form 127 as shown on dwuconsulting.com/airports/<code> (per-enplanement values calculated by DWU from the filed line items)",
  "Orlando Terminal C: $2.8B, 15 gates, adds 10-12M passengers a year, constructconnect.com (Oct 2022)",
  "Newark Terminal A: $2.7B, capacity above 13M a year versus 9M for the old terminal, constructiondive.com (2023)",
];
