/** One row of the airport_metrics table. Every metric is nullable: missing data must never become a fake 0. */
export interface AirportMetrics {
  iata: string;
  name?: string | null;
  city?: string | null;
  state?: string | null;

  // T-100 (departing passengers, passenger service classes F+L), last 12 months vs prior 12
  ltm_pax: number | null;
  months_covered: number | null;
  load_factor: number | null; // 0..1
  peak_month_load_factor: number | null; // 0..1
  pax_growth_yoy: number | null; // e.g. 0.05 = +5%
  seat_growth_yoy: number | null;

  // BTS On-Time Performance (large reporting carriers only)
  p90_taxi_out_min: number | null;
  pct_dep_delayed_15: number | null; // 0..1
  nas_delay_share: number | null; // 0..1, share of attributed delay minutes
  otp_coverage: number | null; // 0..1, OTP flights / T-100 departures in the same months
  otp_months: number | null;

  // FAA TAF (scenario 1)
  taf_enpl_2025: number | null;
  taf_enpl_2035: number | null;
}

export type ComponentId = "demand_pressure" | "congestion" | "growth" | "scale";

/** A raw or derived number, and whether larger values mean a *better* investment case. */
export interface MetricSpec {
  id: string;
  label: string;
  unit: "pct" | "min" | "count" | "ratio";
  weight: number; // relative weight inside its component
  /** Derive the value from a row. Return null when inputs are missing. */
  value: (m: AirportMetrics) => number | null;
}

export interface ComponentSpec {
  id: ComponentId;
  label: string;
  weight: number; // relative weight in the overall score
  metrics: MetricSpec[];
}

export interface Weights {
  [component: string]: number;
}

export interface MetricResult {
  id: string;
  label: string;
  unit: MetricSpec["unit"];
  value: number | null;
  percentile: number | null; // 0..100 among the peer set
}

export interface ComponentResult {
  id: ComponentId;
  label: string;
  score: number | null; // 0..100
  weight: number; // normalized, after dropping unavailable components
  contribution: number; // points added to the total
  metrics: MetricResult[];
}

export type FlagCode =
  | "short_history"
  | "low_otp_coverage"
  | "single_season_otp"
  | "missing_component"
  | "editorial_constraint";

export interface Flag {
  code: FlagCode;
  message: string;
}

export interface ScoredAirport {
  iata: string;
  name?: string | null;
  city?: string | null;
  state?: string | null;
  score: number; // 0..100
  rank: number; // 1 = best, within the list returned (e.g. after a region filter)
  nationalRank: number; // 1 = best among every airport in the peer set (percentiles are always national)
  confidence: "high" | "medium" | "low";
  components: ComponentResult[];
  drivers: string[]; // human-readable top contributors
  flags: Flag[];
}
