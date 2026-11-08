// Builds the airport_metrics table in data/airports.duckdb from T-100, On-Time Performance, FAA TAF and OurAirports.
// Usage: npm run build-metrics
import { DuckDBInstance } from "@duckdb/node-api";
import { globSync } from "node:fs";

const otpFiles = globSync("data/otp/*/*.csv").map((f) => f.replaceAll("\\", "/"));
if (otpFiles.length === 0) throw new Error("No on-time files under data/otp/*/*.csv");

const db = await DuckDBInstance.create("data/airports.duckdb");
const con = await db.connect();
const show = async (title: string, sql: string) => {
  console.log(`\n=== ${title} ===`);
  console.table((await con.runAndReadAll(sql)).getRowObjectsJson());
};

await con.run(`
  CREATE OR REPLACE TABLE otp AS
  SELECT Year, Month, Year*12+Month-1 AS ym, Origin, Cancelled, TaxiOut, DepDelayMinutes, DepDel15,
         CarrierDelay, WeatherDelay, NASDelay, SecurityDelay, LateAircraftDelay
  FROM read_csv([${otpFiles.map((f) => `'${f}'`).join(",")}], header = true, union_by_name = true, sample_size = -1)
`);

// Reference table used by the airport resolver and the nearby-airport lookup.
await con.run(`
  CREATE OR REPLACE TABLE airports_ref AS
  SELECT iata_code AS iata, any_value(name) AS name, any_value(municipality) AS city,
         replace(any_value(iso_region), 'US-', '') AS state, any_value(type) AS type,
         any_value(latitude_deg) AS lat, any_value(longitude_deg) AS lon,
         any_value(scheduled_service) AS scheduled_service
  FROM read_csv('data/raw/airports.csv', header = true)
  WHERE iso_country = 'US' AND iata_code IS NOT NULL AND type IN ('large_airport', 'medium_airport', 'small_airport')
  GROUP BY 1
`);

await con.run(`
  CREATE OR REPLACE TABLE airport_metrics AS
  WITH
  bounds AS (SELECT max(YEAR*12+MONTH-1) AS latest FROM t100),
  pax AS (
    SELECT ORIGIN AS iata, ORIGIN_STATE_ABR AS state, ORIGIN_CITY_NAME AS city, YEAR*12+MONTH-1 AS ym,
           DEPARTURES_PERFORMED AS deps, SEATS AS seats, PASSENGERS AS pax
    FROM t100 WHERE CLASS IN ('F','L') AND ORIGIN_COUNTRY = 'US' AND SEATS > 0),
  ltm   AS (SELECT p.* FROM pax p, bounds b WHERE p.ym >  b.latest - 12 AND p.ym <= b.latest),
  prior AS (SELECT p.* FROM pax p, bounds b WHERE p.ym >  b.latest - 24 AND p.ym <= b.latest - 12),
  monthly AS (SELECT iata, ym, sum(pax) / sum(seats) AS lf FROM ltm GROUP BY 1, 2),
  cur AS (SELECT iata, any_value(state) AS state, any_value(city) AS city, sum(deps) AS deps,
                 sum(seats) AS seats, sum(pax) AS pax, count(DISTINCT ym) AS months FROM ltm GROUP BY 1),
  prv AS (SELECT iata, sum(seats) AS seats, sum(pax) AS pax FROM prior GROUP BY 1),
  pk  AS (SELECT iata, max(lf) AS peak_lf FROM monthly GROUP BY 1),
  otp_months AS (SELECT DISTINCT ym FROM otp),
  otp_n AS (SELECT count(DISTINCT ym) AS n FROM otp),
  otp_agg AS (
    SELECT Origin AS iata, count(*) AS flights,
           quantile_cont(TaxiOut, 0.9) AS p90_taxi_out,
           avg(DepDel15::DOUBLE) AS pct_del15,
           sum(NASDelay) / nullif(sum(CarrierDelay + WeatherDelay + NASDelay + SecurityDelay + LateAircraftDelay), 0) AS nas_share
    FROM otp GROUP BY 1),
  otp_t100 AS (SELECT iata, sum(deps) AS deps FROM pax WHERE ym IN (SELECT ym FROM otp_months) GROUP BY 1),
  taf AS (
    SELECT trim(locid) AS iata,
           -- aac = domestic air carrier; us_flag / frgn_flag = international legs. Total = all five (validated vs FAA CY2025).
           max(CASE WHEN ayear = 2025 THEN aac + aat + commuter + us_flag + frgn_flag END) AS e2025,
           max(CASE WHEN ayear = 2035 THEN aac + aat + commuter + us_flag + frgn_flag END) AS e2035
    FROM read_csv('data/taf/enplanements.csv', header = true) WHERE scenario = 1 GROUP BY 1),
  oa AS (
    SELECT iata_code AS iata, any_value(name) AS name
    FROM read_csv('data/raw/airports.csv', header = true)
    WHERE iso_country = 'US' AND iata_code IS NOT NULL AND type IN ('large_airport', 'medium_airport') GROUP BY 1)
  SELECT cur.iata, oa.name, cur.city, cur.state,
         cur.pax AS ltm_pax, cur.months AS months_covered,
         cur.pax / cur.seats AS load_factor, pk.peak_lf AS peak_month_load_factor,
         CASE WHEN prv.pax  > 0 THEN cur.pax  / prv.pax  - 1 END AS pax_growth_yoy,
         CASE WHEN prv.seats > 0 THEN cur.seats / prv.seats - 1 END AS seat_growth_yoy,
         otp_agg.p90_taxi_out AS p90_taxi_out_min, otp_agg.pct_del15 AS pct_dep_delayed_15,
         otp_agg.nas_share AS nas_delay_share,
         CASE WHEN otp_t100.deps > 0 THEN least(1.0, otp_agg.flights / otp_t100.deps) END AS otp_coverage,
         CASE WHEN otp_agg.flights IS NOT NULL THEN (SELECT n FROM otp_n) END AS otp_months,
         taf.e2025 AS taf_enpl_2025, taf.e2035 AS taf_enpl_2035
  FROM cur
  LEFT JOIN prv USING (iata) LEFT JOIN pk USING (iata) LEFT JOIN otp_agg USING (iata)
  LEFT JOIN otp_t100 USING (iata) LEFT JOIN taf USING (iata) LEFT JOIN oa USING (iata)
`);

await show("window", `SELECT (SELECT max(YEAR*12+MONTH-1) FROM t100) AS latest_ym_index,
  (SELECT max(YEAR) || '-' || lpad(max(MONTH)::VARCHAR, 2, '0') FROM t100 WHERE YEAR = (SELECT max(YEAR) FROM t100)) AS latest_t100,
  (SELECT string_agg(DISTINCT Year || '-' || lpad(Month::VARCHAR, 2, '0'), ', ') FROM otp) AS otp_months`);
await show("rows", `SELECT count(*) airports, count(*) FILTER (WHERE ltm_pax >= 300000 AND months_covered >= 10) in_universe,
  count(*) FILTER (WHERE ltm_pax >= 300000 AND p90_taxi_out_min IS NULL) universe_missing_otp,
  count(*) FILTER (WHERE ltm_pax >= 300000 AND taf_enpl_2025 IS NULL) universe_missing_taf FROM airport_metrics`);

// Cross-check our departing-passenger totals against FAA's official CY2025 enplanements.
await show("sanity: T-100 LTM pax vs FAA CY2025 enplanements (ratio should be ~1; LTM window is Aug25-Jul26)", `
  SELECT m.iata, m.ltm_pax::BIGINT AS t100_ltm, f."CY 25 Enplanements"::BIGINT AS faa_cy25,
         round(m.ltm_pax / f."CY 25 Enplanements", 3) AS ratio, m.taf_enpl_2025::BIGINT AS taf_2025
  FROM airport_metrics m JOIN read_xlsx('data/raw/faa_cy2025_commercial_enplanements.xlsx') f ON f.Locid = m.iata
  WHERE m.iata IN ('ATL','BOS','LAX','SFO','ANC','PWM','SNA') ORDER BY m.ltm_pax DESC`);
