import type { AirportMetrics, ComponentSpec } from "./types.ts";

const growthCagr = (m: AirportMetrics, years = 10): number | null => {
  const a = m.taf_enpl_2025;
  const b = m.taf_enpl_2035;
  if (a == null || b == null || a < 50_000 || b <= 0) return null;
  return Math.pow(b / a, 1 / years) - 1;
};

/**
 * The scoring model. Everything an analyst might want to argue about lives here.
 * All metrics are oriented so that HIGHER = stronger case for terminal investment.
 */
export const COMPONENTS: ComponentSpec[] = [
  {
    id: "demand_pressure",
    label: "Demand pressure",
    weight: 0.3,
    metrics: [
      { id: "load_factor", label: "Load factor (12 mo)", unit: "pct", weight: 0.4, value: (m) => m.load_factor },
      { id: "peak_month_load_factor", label: "Peak-month load factor", unit: "pct", weight: 0.3, value: (m) => m.peak_month_load_factor },
      {
        id: "demand_supply_gap",
        label: "Passenger growth minus seat growth",
        unit: "pct",
        weight: 0.3,
        value: (m) => (m.pax_growth_yoy == null || m.seat_growth_yoy == null ? null : m.pax_growth_yoy - m.seat_growth_yoy),
      },
    ],
  },
  {
    id: "congestion",
    label: "Congestion",
    weight: 0.25,
    metrics: [
      { id: "p90_taxi_out", label: "P90 taxi-out time", unit: "min", weight: 0.4, value: (m) => m.p90_taxi_out_min },
      { id: "pct_dep_delayed_15", label: "Departures delayed 15+ min", unit: "pct", weight: 0.4, value: (m) => m.pct_dep_delayed_15 },
      { id: "nas_delay_share", label: "Share of delay minutes from air-system/volume (NAS)", unit: "pct", weight: 0.2, value: (m) => m.nas_delay_share },
    ],
  },
  {
    id: "growth",
    label: "Growth outlook",
    weight: 0.25,
    metrics: [
      { id: "pax_growth_yoy", label: "Passenger growth, last 12 mo vs prior", unit: "pct", weight: 0.5, value: (m) => m.pax_growth_yoy },
      { id: "taf_cagr_10y", label: "FAA forecast enplanement growth, 10-yr CAGR", unit: "pct", weight: 0.5, value: (m) => growthCagr(m) },
    ],
  },
  {
    id: "scale",
    label: "Size of prize",
    weight: 0.2,
    metrics: [
      {
        id: "forecast_added_enplanements",
        label: "FAA forecast added enplanements by 2035",
        unit: "count",
        weight: 0.6,
        value: (m) => (m.taf_enpl_2025 == null || m.taf_enpl_2035 == null ? null : Math.max(0, m.taf_enpl_2035 - m.taf_enpl_2025)),
      },
      { id: "ltm_pax", label: "Passengers (12 mo)", unit: "count", weight: 0.4, value: (m) => m.ltm_pax },
    ],
  },
];

export const DEFAULT_WEIGHTS: Record<string, number> = Object.fromEntries(COMPONENTS.map((c) => [c.id, c.weight]));

/** Peer set: only airports with real scheduled traffic and a full year of data are ranked. */
export const UNIVERSE = {
  minLtmPax: 300_000,
  minMonthsCovered: 10,
};

/** OTP covers only large reporting carriers; below this share of T-100 departures we warn. */
export const LOW_OTP_COVERAGE = 0.6;
/** Fewer OTP months than this means congestion may reflect one season. */
export const MIN_OTP_MONTHS = 6;

/**
 * Editorial (not data-derived) caveats: the terminal is not the binding constraint.
 * Deliberately short and incomplete; extend only with a citable reason.
 */
export const EDITORIAL_CONSTRAINTS: Record<string, string> = {
  SFO: "Closely spaced parallel runways and fog limit arrivals; a bigger terminal may not raise throughput.",
  LGA: "Slot-controlled and runway/footprint constrained; added terminal capacity cannot add many more flights.",
  DCA: "Slot- and perimeter-rule-controlled; flights are capped by policy, not by the terminal.",
};
