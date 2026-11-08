import { z } from "zod";
import { COMPONENTS, DEFAULT_WEIGHTS, UNIVERSE } from "../scoring/index.ts";
import { ok, SOURCES, type ToolResult } from "./envelope.ts";

export const methodologyInput = z.object({});

export async function methodology(): Promise<ToolResult<unknown>> {
  return ok(
    {
      purpose: "Screening score for where extra terminal capacity would be absorbed by existing or forecast demand.",
      peer_set: `US airports with at least ${UNIVERSE.minLtmPax.toLocaleString()} departing passengers in the last 12 months and at least ${UNIVERSE.minMonthsCovered} months of data.`,
      method: "Each metric becomes a national percentile (0-100). A component score is the weighted mean of its metric percentiles; the total is the weighted mean of component scores. Missing metrics are dropped and weights re-normalised, never counted as zero.",
      components: COMPONENTS.map((c) => ({
        id: c.id, label: c.label, default_weight_pct: Math.round((DEFAULT_WEIGHTS[c.id] ?? c.weight) * 100),
        metrics: c.metrics.map((m) => ({ id: m.id, label: m.label, weight_in_component_pct: Math.round(m.weight * 100) })),
      })),
      flags: {
        single_season_otp: "Congestion based on fewer than 6 months of on-time data.",
        low_otp_coverage: "On-time data covers under 60% of departures.",
        short_history: "Fewer than 12 months of passenger data.",
        missing_component: "A whole component has no data; the score is re-weighted.",
        editorial_constraint: "Hand-written note (not data-derived) that the terminal may not be the binding constraint.",
      },
      confidence: "high = no issues, medium = one, low = two or more.",
      sensitivity: "Rankings are re-run with each component weight scaled by 0.8 and 1.2 to show whether the top airports hold.",
      not_modelled: ["Construction cost or financial return", "Runway, airspace or gate capacity", "Local politics, land, environmental limits", "Fares and yield"],
    },
    { sources: [SOURCES.t100, SOURCES.otp, SOURCES.taf] },
  );
}
