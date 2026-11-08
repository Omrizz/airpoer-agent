// Data-check step 3: congestion metrics from BTS On-Time Performance (reporting carriers only).
import { DuckDBInstance } from "@duckdb/node-api";
import { globSync } from "node:fs";

const files = globSync("data/otp/*/*.csv").map((f) => f.replaceAll("\\", "/"));
console.log("OTP files:", files);

const db = await DuckDBInstance.create("data/airports.duckdb");
const con = await db.connect();
const q = async (title, sql) => {
  const r = await con.runAndReadAll(sql);
  console.log(`\n=== ${title} ===`);
  console.table(r.getRowObjectsJson());
};

await con.run(`
  CREATE OR REPLACE TABLE otp AS
  SELECT Year, Month, FlightDate, Reporting_Airline AS carrier, Origin, Dest, Cancelled, Diverted,
         DepDelayMinutes, DepDel15, TaxiOut, TaxiIn, ArrDelayMinutes, ArrDel15,
         CarrierDelay, WeatherDelay, NASDelay, SecurityDelay, LateAircraftDelay, Distance
  FROM read_csv([${files.map((f) => `'${f}'`).join(",")}], header = true, union_by_name = true, sample_size = -1)
`);

await q("rows by month", `SELECT Year, Month, count(*) flights FROM otp GROUP BY 1,2 ORDER BY 1,2`);

await q("Departure-side congestion by airport (reporting-carrier flights only)", `
  SELECT Origin, count(*) deps,
         round(avg(TaxiOut),1) AS avg_taxi_out_min,
         round(quantile_cont(TaxiOut, 0.9),1) AS p90_taxi_out_min,
         round(avg(DepDelayMinutes),1) AS avg_dep_delay_min,
         round(100*avg(DepDel15::DOUBLE),1) AS pct_dep_delayed_15,
         round(100*avg(Cancelled::DOUBLE),2) AS pct_cancelled
  FROM otp WHERE Origin IN ('LAX','SNA','SFO','OAK','SJC','ANC','BOS','JFK') GROUP BY 1 ORDER BY avg_taxi_out_min DESC`);

await q("Delay-cause minutes per delayed flight (share of attributed delay minutes)", `
  SELECT Origin,
         round(100*sum(NASDelay)/nullif(sum(CarrierDelay+WeatherDelay+NASDelay+SecurityDelay+LateAircraftDelay),0),1) pct_nas,
         round(100*sum(WeatherDelay)/nullif(sum(CarrierDelay+WeatherDelay+NASDelay+SecurityDelay+LateAircraftDelay),0),1) pct_weather,
         round(100*sum(CarrierDelay)/nullif(sum(CarrierDelay+WeatherDelay+NASDelay+SecurityDelay+LateAircraftDelay),0),1) pct_carrier,
         round(100*sum(LateAircraftDelay)/nullif(sum(CarrierDelay+WeatherDelay+NASDelay+SecurityDelay+LateAircraftDelay),0),1) pct_late_aircraft
  FROM otp WHERE Origin IN ('LAX','SNA','SFO','ANC','BOS') GROUP BY 1`);

await q("Which carriers report ANC departures in OTP (coverage caveat)", `
  SELECT carrier, count(*) deps FROM otp WHERE Origin='ANC' GROUP BY 1 ORDER BY 2 DESC`);

await q("OTP coverage vs T-100 for July 2025 (departures) at key airports", `
  SELECT o.Origin, o.n AS otp_deps, t.n AS t100_pax_deps, round(100.0*o.n/t.n,0) AS otp_coverage_pct
  FROM (SELECT Origin, count(*) n FROM otp WHERE Month=7 AND Year=2025 GROUP BY 1) o
  JOIN (SELECT ORIGIN, sum(DEPARTURES_PERFORMED) n FROM t100 WHERE YEAR=2025 AND MONTH=7 AND CLASS IN ('F','L') GROUP BY 1) t
    ON o.Origin = t.ORIGIN
  WHERE o.Origin IN ('LAX','SNA','SFO','ANC','BOS','OAK','SJC') ORDER BY 1`);
