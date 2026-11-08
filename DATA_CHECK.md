# Data check (2026-11-08)

Goal: confirm the public data can answer the 4 sample questions before writing any agent code.

## Sources that work (all downloaded and loaded into `data/airports.duckdb`)
| Source | How | Files | Notes |
|---|---|---|---|
| BTS T-100 Segment, all carriers (domestic + intl) | `scripts/download-t100.mjs` (posts the TranStats form, table FMG) | 2024, 2025, 2026 Jan-Jul | Seats, departures, passengers, freight, distance, class. No direct file URL exists. |
| BTS On-Time Performance | direct zip: `transtats.bts.gov/PREZIP/On_Time_Reporting_Carrier_On_Time_Performance_1987_present_<Y>_<M>.zip` | 2025-07 loaded | ~30 MB/month. Server is slow; use `curl -C -` to resume. Reporting carriers only. |
| FAA TAF 2025 | `taf.faa.gov/Downloads/APO100_TAF_Final_2025.zip` | Enplanements, Airports, Operations | Non-standard xlsx; DuckDB/exceljs can't read it -> `scripts/xlsx-to-csv.mjs` |
| FAA CY2025 commercial enplanements | faa.gov xlsx | CY24 + CY25 per airport | DuckDB `read_xlsx` works |
| OurAirports | `davidmegginson.github.io/ourairports-data/airports.csv` | all | State/region, IATA, type |

Not found yet: FAA CATS revenue per passenger, DB1B fares, Census growth (all optional).

## Findings per sample question
- **ANC long-haul %** (2025, passenger classes F+L): 3,000+ mi = 2.8% of departures, 6.1% of passengers; 1,500+ mi = 17.7% of departures. Result depends heavily on the threshold. ANC also has MORE all-cargo departures (49.8k) than passenger ones (38.2k), so the scope (passenger vs cargo) must be stated.
- **LAX vs SNA congestion** (Jul 2025, OTP): taxi-out 17.5 vs 16.4 min, dep delay 19.0 vs 18.7 min, similar. LAX handles 5x the departures, so size-adjusted congestion needs a capacity measure.
- **SFO unmet demand**: load factor is 82.3% for 2025 (peak 89.4% in June), vs OAK 73.1% and SJC 74.1%. Only proxies exist: no source measures unmet demand directly. Taxi-out 22 min (2nd worst of the set). SFO seats +5.9% YoY.
- **New England**: 22 scheduled-service airports in OurAirports; 10 have more than 100k T-100 passengers. BOS 21.1M pax, 81.6% LF; PWM 82.4% LF; BTV 81.3%.

## Caveats found
- OTP covers only large reporting carriers: ~50% of ANC, 73-76% of BOS/LAX/SFO passenger departures, 89% of SNA.
- Taxi-out is a proxy for ground congestion, not runway capacity.
- T-100 is by calendar month and class; filter to F+L for passenger analysis.
- OTP loaded for one month only (Jul 2025, a peak month). More months needed to avoid seasonal bias.
