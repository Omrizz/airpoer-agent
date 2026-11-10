
export interface UpsideInput {
  added_enplanements: number; // annual, at the forecast year
  share_of_growth: number; // 0..1: share of the forecast growth that depends on the new capacity
  horizon_years: number;
}

export interface ScenarioResult {
  id: string;
  label: string;
  revenue_per_enplanement: number;
  opex_per_enplanement: number;
  operating_profit_per_enplanement: number;
  operating_margin_pct: number;
  capex_per_added_enplanement: number;
  added_enplanements_counted: number;
  added_annual_revenue_usd_m: number;
  added_annual_operating_profit_usd_m: number;
  capex_usd_m: number;
  /** capex / added annual operating profit, at the full 2035 run rate; ignores ramp-up, discounting and inflation. */
  simple_payback_years: number | null;
  /** Highest build cost per added annual enplanement that operating profit repays within the horizon. */
  breakeven_capex_per_enplanement: number | null;
  horizon_years: number;
  basis?: string;
}

const m = (usd: number) => Math.round(usd / 1e5) / 10; // $ -> $ millions, 1 decimal
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Pure arithmetic. No I/O, no randomness: the same inputs always give the same numbers. */
export interface ScenarioInput {
  id: string;
  label: string;
  revenue_per_enplanement: number;
  opex_per_enplanement: number;
  capex_per_added_enplanement: number;
  basis?: string;
}

export function computeScenario(s: ScenarioInput, i: UpsideInput): ScenarioResult {
  const counted = i.added_enplanements * i.share_of_growth;
  const profitPerEp = s.revenue_per_enplanement - s.opex_per_enplanement;
  const profit = counted * profitPerEp;
  const capex = counted * s.capex_per_added_enplanement;
  return {
    id: s.id,
    label: s.label,
    revenue_per_enplanement: r2(s.revenue_per_enplanement),
    opex_per_enplanement: r2(s.opex_per_enplanement),
    operating_profit_per_enplanement: r2(profitPerEp),
    operating_margin_pct: s.revenue_per_enplanement > 0 ? Math.round((profitPerEp / s.revenue_per_enplanement) * 1000) / 10 : 0,
    capex_per_added_enplanement: Math.round(s.capex_per_added_enplanement),
    added_enplanements_counted: Math.round(counted),
    added_annual_revenue_usd_m: m(counted * s.revenue_per_enplanement),
    added_annual_operating_profit_usd_m: m(profit),
    capex_usd_m: m(capex),
    simple_payback_years: profit > 0 ? Math.round((capex / profit) * 10) / 10 : null,
    breakeven_capex_per_enplanement: profitPerEp > 0 ? Math.round(profitPerEp * i.horizon_years) : null,
    horizon_years: i.horizon_years,
    ...(s.basis ? { basis: s.basis } : {}),
  };
}
