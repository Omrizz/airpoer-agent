import { query } from "./db.ts";

let latest: number | null = null;
/** Month index (year*12 + month-1) of the latest T-100 month loaded. */
export async function latestIdx(): Promise<number> {
  if (latest == null) latest = (await query<{ l: number }>(`SELECT max(YEAR*12+MONTH-1) AS l FROM t100`))[0]!.l;
  return latest;
}

/** SQL predicate selecting the last 12 months (or the 12 before that when `back` = 12). */
export async function ltmPredicate(back = 0, col = "YEAR*12+MONTH-1"): Promise<string> {
  const l = await latestIdx();
  return `(${col}) > ${l - 12 - back} AND (${col}) <= ${l - back}`;
}

/** Passenger service classes: F scheduled passenger/cargo, L non-scheduled passenger/cargo. */
export const PASSENGER_CLASSES = "'F','L'";
/** All-cargo service classes: G scheduled all-cargo, P non-scheduled all-cargo. */
export const CARGO_CLASSES = "'G','P'";
