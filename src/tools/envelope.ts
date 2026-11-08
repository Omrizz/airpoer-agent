import { dataAsOf, type DataAsOf } from "../data/db.ts";

/**
 * Every tool returns this shape. The agent is instructed to cite `data`, restate `assumptions`
 * that matter to the question, and surface `caveats`. Nothing numeric comes from the model.
 */
export interface ToolOk<T> {
  ok: true;
  data: T;
  assumptions: string[];
  caveats: string[];
  data_as_of: DataAsOf;
  sources: string[];
}
export interface ToolErr {
  ok: false;
  error: string;
  hint?: string;
}
export type ToolResult<T> = ToolOk<T> | ToolErr;

export const SOURCES = {
  t100: "BTS T-100 Segment (All Carriers), transtats.bts.gov",
  otp: "BTS On-Time Performance (reporting carriers), transtats.bts.gov",
  taf: "FAA Terminal Area Forecast, taf.faa.gov",
  oa: "OurAirports, ourairports.com/data",
} as const;

export async function ok<T>(
  data: T,
  opts: { assumptions?: string[]; caveats?: string[]; sources?: string[] } = {},
): Promise<ToolOk<T>> {
  return {
    ok: true,
    data,
    assumptions: opts.assumptions ?? [],
    caveats: opts.caveats ?? [],
    data_as_of: await dataAsOf(),
    sources: opts.sources ?? [],
  };
}

export const err = (error: string, hint?: string): ToolErr => ({ ok: false, error, ...(hint ? { hint } : {}) });

/** Rounding helpers keep tool output compact and stop the model quoting 12 decimals. */
export const r1 = (v: number | null | undefined): number | null => (v == null ? null : Math.round(v * 10) / 10);
export const pct1 = (v: number | null | undefined): number | null => (v == null ? null : Math.round(v * 1000) / 10);
