import { z } from "zod";
import { compareAirports, compareInput } from "./compare.ts";
import { demandGap, demandGapInput } from "./demandGap.ts";
import { err, type ToolResult } from "./envelope.ts";
import { liveStatus, liveStatusInput } from "./liveStatus.ts";
import { methodology, methodologyInput } from "./methodology.ts";
import { rankAirports, rankInput } from "./rank.ts";
import { resolveAirports, resolveInput } from "./resolve.ts";
import { routeMix, routeMixInput } from "./routeMix.ts";

export interface ToolDef {
  name: string;
  description: string;
  input: z.ZodType;
  run: (input: never) => Promise<ToolResult<unknown>>;
}

const def = <S extends z.ZodType>(name: string, description: string, input: S, run: (i: z.infer<S>) => Promise<ToolResult<unknown>>): ToolDef => ({
  name, description, input, run: run as ToolDef["run"],
});

export const TOOLS: ToolDef[] = [
  def(
    "resolve_airports",
    "Turn what the user typed (airport code, airport/city name, metro like 'LA' or 'Bay Area', US state, or region like 'New England') into airport codes or a list of states. Call this FIRST whenever the user names a place instead of a 3-letter code, and whenever a name could be ambiguous. If `ambiguous` is true, tell the user which airport(s) you assumed.",
    resolveInput,
    resolveAirports,
  ),
  def(
    "rank_airports",
    "Rank US airports by the deterministic Investment Opportunity Score (demand pressure, congestion, growth outlook, size of prize), nationally or within a region/state. Use for 'which airports are strong candidates for terminal expansion/renovation'. Returns scores, per-component and per-metric breakdown, flags, a sensitivity check, and airports in scope that were not scored. Optional `weights` re-weight the components if the user asks to emphasise something.",
    rankInput,
    rankAirports,
  ),
  def(
    "compare_airports",
    "Compare 2-6 airports side by side on scale, demand (load factor, growth), and congestion (taxi-out, delays), with deterministic 'who is higher' contrasts and the score. Use for 'compare X and Y congestion/demand'. Resolve names to codes first.",
    compareInput,
    compareAirports,
  ),
  def(
    "route_mix",
    "Distance and service-type breakdown of departures from one airport: share of flights/passengers beyond a long-haul threshold (default 3,000 miles), distance bands, threshold sensitivity, passenger vs all-cargo mix, top long-haul destinations. Use for 'what percent of flights from X are long-haul' and similar route-length questions. The long-haul definition and passenger-vs-cargo scope MUST be stated in the answer.",
    routeMixInput,
    routeMix,
  ),
  def(
    "demand_gap",
    "Evidence about unmet or constrained demand at one airport: monthly load factors, months above a 'full' threshold, a seat-shortfall proxy, demand-vs-seat growth, ground congestion, and nearby alternatives that may absorb spill. Unmet demand is NOT directly measurable; this tool returns proxies and a list of what cannot be measured. Use for 'what is the unmet demand at X and why'.",
    demandGapInput,
    demandGap,
  ),
  def(
    "live_status",
    "Current FAA National Airspace System status (live API call) for 1-6 airports: active ground stops, ground delay programs, closures and general delays, with reasons. Use only when the user asks what is happening NOW or about current delays. It is a point-in-time reading, separate from the historical scores; never use it to compute or adjust a score.",
    liveStatusInput,
    liveStatus,
  ),
  def(
    "get_methodology",
    "Return the scoring method: peer set, components, metric weights, flags, and what is not modelled. Use when the user asks how scores work, why a weight is what it is, or what the limits are.",
    methodologyInput,
    methodology,
  ),
];

/** Tool definitions in the shape the Anthropic Messages API expects. */
export function anthropicTools() {
  return TOOLS.map((t) => {
    const { $schema: _omit, ...schema } = z.toJSONSchema(t.input, { target: "draft-7", io: "input" }) as Record<string, unknown>;
    return { name: t.name, description: t.description, input_schema: schema as { type: "object"; [k: string]: unknown } };
  });
}

const MAX_RESULT_CHARS = 40_000;

/** Validate input, run the tool, and serialise. Never throws: failures become is_error results the model can react to. */
export async function runTool(name: string, rawInput: unknown): Promise<{ content: string; is_error: boolean }> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return { content: JSON.stringify(err(`Unknown tool "${name}".`)), is_error: true };
  const parsed = tool.input.safeParse(rawInput ?? {});
  if (!parsed.success) {
    return { content: JSON.stringify(err("Invalid input.", z.prettifyError(parsed.error))), is_error: true };
  }
  try {
    const result = await tool.run(parsed.data as never);
    let content = JSON.stringify(result);
    if (content.length > MAX_RESULT_CHARS) {
      content = JSON.stringify(err("Result too large.", "Narrow the request (fewer airports or a smaller top_n)."));
      return { content, is_error: true };
    }
    return { content, is_error: !result.ok };
  } catch (e) {
    return { content: JSON.stringify(err(`Tool failed: ${e instanceof Error ? e.message : String(e)}`)), is_error: true };
  }
}
