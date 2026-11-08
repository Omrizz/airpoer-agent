// Exports the tables the agent reads from data/airports.duckdb to snapshot/*.parquet (committed to git).
// Usage: node scripts/export-snapshot.ts   (run after `npm run build-metrics`)
import { DuckDBInstance } from "@duckdb/node-api";
import { mkdirSync } from "node:fs";
import { SNAPSHOT_TABLES } from "../src/data/snapshot.ts";

mkdirSync("snapshot", { recursive: true });
const con = await (await DuckDBInstance.create("data/airports.duckdb", { access_mode: "READ_ONLY" })).connect();
for (const t of SNAPSHOT_TABLES) {
  await con.run(`COPY (SELECT * FROM ${t} ORDER BY 1) TO 'snapshot/${t}.parquet' (FORMAT parquet, COMPRESSION zstd, COMPRESSION_LEVEL 19)`);
  console.log("wrote", t);
}
