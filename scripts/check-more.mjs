// Data-check step 2: xlsx readability, SFO / LAX vs SNA / New England on T-100 + OurAirports + TAF.
import { DuckDBInstance } from "@duckdb/node-api";

const db = await DuckDBInstance.create("data/airports.duckdb");
const con = await db.connect();
const q = async (title, sql) => {
  try {
    const r = await con.runAndReadAll(sql);
    console.log(`\n=== ${title} ===`);
    console.table(r.getRowObjectsJson());
  } catch (e) {
    console.log(`\n=== ${title} === FAILED: ${e.message}`);
  }
};

await q("TAF Enplanements.xlsx (peek)", `SELECT * FROM read_xlsx('data/taf/Enplanements.xlsx') LIMIT 3`);
await q("FAA CY2025 commercial enplanements (peek)", `SELECT * FROM read_xlsx('data/raw/faa_cy2025_commercial_enplanements.xlsx') LIMIT 3`);

await q("SFO 2025: capacity vs demand (monthly, passenger classes F,L; origin=SFO)", `
  SELECT MONTH, sum(DEPARTURES_PERFORMED)::BIGINT deps, sum(SEATS)::BIGINT seats, sum(PASSENGERS)::BIGINT pax,
         round(100*sum(PASSENGERS)/sum(SEATS),1) AS load_factor_pct
  FROM t100 WHERE YEAR=2025 AND ORIGIN='SFO' AND CLASS IN ('F','L') AND SEATS>0
  GROUP BY MONTH ORDER BY MONTH`);

await q("Load factor, SFO vs Bay Area peers (2025, departing, passenger classes)", `
  SELECT ORIGIN, sum(DEPARTURES_PERFORMED)::BIGINT deps, sum(SEATS)::BIGINT seats, sum(PASSENGERS)::BIGINT pax,
         round(100*sum(PASSENGERS)/sum(SEATS),1) load_factor_pct
  FROM t100 WHERE YEAR=2025 AND ORIGIN IN ('SFO','OAK','SJC') AND CLASS IN ('F','L') AND SEATS>0 GROUP BY ORIGIN`);

await q("SFO departures 2019-style trend: 2024 vs 2025 (same months 1-12)", `
  SELECT YEAR, sum(DEPARTURES_PERFORMED)::BIGINT deps, sum(SEATS)::BIGINT seats, sum(PASSENGERS)::BIGINT pax
  FROM t100 WHERE ORIGIN='SFO' AND CLASS IN ('F','L') AND YEAR IN (2024,2025) GROUP BY YEAR ORDER BY YEAR`);

await q("LAX vs SNA (2025, departing, passenger classes)", `
  SELECT ORIGIN, sum(DEPARTURES_PERFORMED)::BIGINT deps, sum(SEATS)::BIGINT seats, sum(PASSENGERS)::BIGINT pax,
         round(100*sum(PASSENGERS)/sum(SEATS),1) load_factor_pct,
         round(sum(PASSENGERS)/sum(DEPARTURES_PERFORMED),1) pax_per_departure
  FROM t100 WHERE YEAR=2025 AND ORIGIN IN ('LAX','SNA') AND CLASS IN ('F','L') AND SEATS>0 GROUP BY ORIGIN`);

await q("OurAirports: New England large/medium airports with scheduled service", `
  SELECT iata_code, name, iso_region, type FROM read_csv('data/raw/airports.csv', header=true)
  WHERE iso_country='US' AND iso_region IN ('US-CT','US-ME','US-MA','US-NH','US-RI','US-VT')
    AND scheduled_service='yes' AND iata_code IS NOT NULL AND type IN ('large_airport','medium_airport')
  ORDER BY iso_region, iata_code`);

await q("New England: 2025 passengers & load factor by origin airport (T-100, ranked)", `
  WITH ne AS (
    SELECT iata_code FROM read_csv('data/raw/airports.csv', header=true)
    WHERE iso_country='US' AND iso_region IN ('US-CT','US-ME','US-MA','US-NH','US-RI','US-VT') AND iata_code IS NOT NULL)
  SELECT ORIGIN, any_value(ORIGIN_CITY_NAME) city, sum(DEPARTURES_PERFORMED)::BIGINT deps,
         sum(PASSENGERS)::BIGINT pax, round(100*sum(PASSENGERS)/sum(SEATS),1) load_factor_pct
  FROM t100 WHERE YEAR=2025 AND CLASS IN ('F','L') AND SEATS>0 AND ORIGIN IN (SELECT iata_code FROM ne)
  GROUP BY ORIGIN HAVING sum(PASSENGERS) > 100000 ORDER BY pax DESC`);
