import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AirportMetrics } from "../scoring/types.ts";
import { buildFromSnapshot } from "./snapshot.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.AIRPORT_DB ?? path.resolve(here, "../../data/airports.duckdb");

const SNAPSHOT_DIR = path.resolve(here, "../../snapshot");

let connection: Promise<DuckDBConnection> | null = null;
export function db(): Promise<DuckDBConnection> {
  connection ??= (async () => {
    // Fresh clone: build the database from the committed parquet snapshot on first use.
    if (!existsSync(DB_PATH)) await buildFromSnapshot(DB_PATH, SNAPSHOT_DIR);
    return (await DuckDBInstance.create(DB_PATH, { access_mode: "READ_ONLY" })).connect();
  })();
  return connection;
}

const plain = (v: unknown): unknown => (typeof v === "bigint" ? Number(v) : v);

/** Run SQL and return plain JS rows (BIGINT -> number). Callers must only interpolate validated values. */
export async function query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const res = await (await db()).runAndReadAll(sql);
  return res.getRowObjects().map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, plain(v)]))) as T[];
}

const n = (v: unknown): number | null => (v == null ? null : Number(v));

let metricsCache: AirportMetrics[] | null = null;
export async function allMetrics(): Promise<AirportMetrics[]> {
  if (metricsCache) return metricsCache;
  const rows = await query(`SELECT * FROM airport_metrics`);
  metricsCache = rows.map((r) => ({
    iata: String(r.iata), name: (r.name as string) ?? null, city: (r.city as string) ?? null, state: (r.state as string) ?? null,
    ltm_pax: n(r.ltm_pax), months_covered: n(r.months_covered), load_factor: n(r.load_factor),
    peak_month_load_factor: n(r.peak_month_load_factor), pax_growth_yoy: n(r.pax_growth_yoy),
    seat_growth_yoy: n(r.seat_growth_yoy), p90_taxi_out_min: n(r.p90_taxi_out_min),
    pct_dep_delayed_15: n(r.pct_dep_delayed_15), nas_delay_share: n(r.nas_delay_share),
    otp_coverage: n(r.otp_coverage), otp_months: n(r.otp_months),
    taf_enpl_2025: n(r.taf_enpl_2025), taf_enpl_2035: n(r.taf_enpl_2035),
  }));
  return metricsCache;
}

export interface DataAsOf {
  t100_through: string; // e.g. "2026-07"
  t100_ltm_window: string; // e.g. "2025-08 to 2026-07"
  otp_months: string[]; // e.g. ["2025-07"]
  taf_edition: string;
  faa_enplanements: string;
}

let asOfCache: DataAsOf | null = null;
export async function dataAsOf(): Promise<DataAsOf> {
  if (asOfCache) return asOfCache;
  const [t] = await query<{ latest: number }>(`SELECT max(YEAR * 12 + MONTH - 1) AS latest FROM t100`);
  const fmt = (idx: number) => `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
  const latest = t!.latest;
  const otp = await query<{ y: number; m: number }>(`SELECT DISTINCT Year AS y, Month AS m FROM otp ORDER BY 1, 2`);
  asOfCache = {
    t100_through: fmt(latest),
    t100_ltm_window: `${fmt(latest - 11)} to ${fmt(latest)}`,
    otp_months: otp.map((o) => `${o.y}-${String(o.m).padStart(2, "0")}`),
    taf_edition: "FAA Terminal Area Forecast, 2025 edition (scenario 1, FY2025-2055)",
    faa_enplanements: "FAA CY2025 commercial service enplanements (cross-check only)",
  };
  return asOfCache;
}

/** Validated IATA code -> safe to inline in SQL. */
export function sqlList(codes: readonly string[]): string {
  for (const c of codes) if (!/^[A-Z]{3}$/.test(c)) throw new Error(`invalid IATA code: ${c}`);
  return codes.map((c) => `'${c}'`).join(",");
}
