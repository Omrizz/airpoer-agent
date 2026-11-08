// Data-check step 1: load T-100 into DuckDB and answer sample questions by hand.
import { DuckDBInstance } from "@duckdb/node-api";

const db = await DuckDBInstance.create("data/airports.duckdb");
const con = await db.connect();

await con.run(`
  CREATE OR REPLACE TABLE t100 AS
  SELECT * FROM read_csv(['data/t100/2024/T_T100_SEGMENT_ALL_CARRIER.csv',
                          'data/t100/2025/T_T100_SEGMENT_ALL_CARRIER.csv',
                          'data/t100/2026/T_T100_SEGMENT_ALL_CARRIER.csv'],
                         header = true, union_by_name = true, auto_detect = true)
`);

const q = async (title, sql) => {
  const r = await con.runAndReadAll(sql);
  console.log(`\n=== ${title} ===`);
  console.table(r.getRowObjectsJson());
};

await q("rows & coverage", `
  SELECT YEAR, count(*) AS rows, min(MONTH) AS min_m, max(MONTH) AS max_m FROM t100 GROUP BY YEAR ORDER BY YEAR`);

await q("service classes (departures performed, 2025)", `
  SELECT CLASS, count(*) rows, sum(DEPARTURES_PERFORMED)::BIGINT deps, sum(PASSENGERS)::BIGINT pax
  FROM t100 WHERE YEAR = 2025 GROUP BY CLASS ORDER BY deps DESC`);

// ANC: share of passenger departures by distance band, 2025, scheduled+non-scheduled passenger classes
await q("ANC departures by distance band (2025, passenger classes F,L)", `
  SELECT CASE WHEN DISTANCE < 500 THEN '1 <500mi'
              WHEN DISTANCE < 1500 THEN '2 500-1499mi'
              WHEN DISTANCE < 3000 THEN '3 1500-2999mi'
              ELSE '4 3000mi+' END AS band,
         sum(DEPARTURES_PERFORMED)::BIGINT AS departures,
         sum(PASSENGERS)::BIGINT AS passengers,
         round(100 * sum(DEPARTURES_PERFORMED) / sum(sum(DEPARTURES_PERFORMED)) OVER (), 1) AS pct_deps,
         round(100 * sum(PASSENGERS) / sum(sum(PASSENGERS)) OVER (), 1) AS pct_pax
  FROM t100
  WHERE YEAR = 2025 AND ORIGIN = 'ANC' AND CLASS IN ('F','L') AND DEPARTURES_PERFORMED > 0
  GROUP BY 1 ORDER BY 1`);

await q("ANC: passenger vs all-cargo departures (2025)", `
  SELECT CASE WHEN CLASS IN ('F','L') THEN 'passenger/combination' ELSE 'all-cargo' END AS kind,
         sum(DEPARTURES_PERFORMED)::BIGINT AS departures,
         round(sum(FREIGHT)/2000)::BIGINT AS freight_tons,
         sum(PASSENGERS)::BIGINT AS passengers
  FROM t100 WHERE YEAR = 2025 AND ORIGIN = 'ANC' GROUP BY 1`);

await q("ANC top destinations by departures (2025)", `
  SELECT DEST, any_value(DEST_CITY_NAME) city, any_value(DISTANCE) miles,
         sum(DEPARTURES_PERFORMED)::BIGINT deps, sum(PASSENGERS)::BIGINT pax
  FROM t100 WHERE YEAR = 2025 AND ORIGIN = 'ANC' AND CLASS IN ('F','L')
  GROUP BY DEST ORDER BY deps DESC LIMIT 12`);

console.log("\nSaved to data/airports.duckdb");
