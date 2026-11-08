import { DuckDBInstance } from "@duckdb/node-api";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";

export const SNAPSHOT_TABLES = ["airports_ref", "airport_metrics", "otp", "t100"] as const;

/**
 * Builds a DuckDB file from the committed parquet snapshot (snapshot/*.parquet),
 * so a fresh clone runs without downloading ~600 MB of raw BTS/FAA files.
 * Writes to a temp file and renames, so a half-built database is never opened.
 */
export async function buildFromSnapshot(dbPath: string, snapshotDir: string): Promise<void> {
  for (const t of SNAPSHOT_TABLES) {
    if (!existsSync(path.join(snapshotDir, `${t}.parquet`))) {
      throw new Error(`No database at ${dbPath} and no snapshot file ${t}.parquet in ${snapshotDir}. See README "Data".`);
    }
  }
  mkdirSync(path.dirname(dbPath), { recursive: true });
  // Unique temp name: several processes (e.g. parallel test workers) may build at once.
  const tmp = `${dbPath}.${process.pid}.building`;
  rmSync(tmp, { force: true });
  const inst = await DuckDBInstance.create(tmp);
  const con = await inst.connect();
  for (const t of SNAPSHOT_TABLES) {
    const f = path.join(snapshotDir, `${t}.parquet`).replaceAll("\\", "/");
    await con.run(`CREATE TABLE ${t} AS SELECT * FROM read_parquet('${f}')`);
  }
  con.closeSync();
  inst.closeSync();
  if (existsSync(dbPath)) rmSync(tmp, { force: true });
  else renameSync(tmp, dbPath);
}
