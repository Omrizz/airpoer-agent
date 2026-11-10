# Financial scenarios (`estimate_upside`)

**Question it answers:** *if the FAA's forecast passenger growth at this airport needs new capacity, roughly what could that growth earn, what might the capacity cost, and does it pay back?*

It is **separate from the investment score**. The score ranks airports from observed data; this tool puts illustrative dollars on one airport from stated assumptions. The two are never blended, and the agent is told never to use the dollar figures to re-rank airports. Assumptions live in `src/finance/config.ts`, the arithmetic in `src/finance/upside.ts` (pure functions, unit-tested), and the user can override them in chat (`custom`).

## What it computes
For one airport:
1. **Added passengers** = FAA forecast enplanements for 2035 minus 2025, times the *share of that growth the project is assumed to enable* (default 100%, an upper bound).
2. For each scenario: added annual revenue = passengers x revenue per enplanement; added annual operating profit = passengers x (revenue - operating cost) per enplanement; capital cost = passengers x build cost per added annual enplanement.
3. **Simple payback** = capital cost / added annual operating profit, at the full 2035 run rate. **Breakeven build cost** = operating profit per enplanement x horizon years (default 25): the most the project could cost per added annual enplanement and still be repaid in that time.

## Scenarios and where each number comes from
| | Revenue / enplanement | Operating cost / enplanement | Build cost / added annual enplanement |
|---|---|---|---|
| **Optimistic** | $48.69 (Boston, FY2025) | $23.85 (Boston) | $415 (Newark Terminal A, gross new capacity) |
| **Base** | $34.28 (US national, FY2025) | $21.54 (US national) | $510 (Orlando Terminal C) |
| **Conservative** | $27.45 (Portland ME, FY2025) | $18.63 (Portland ME) | $1,350 (Newark Terminal A, capacity added over the terminal it replaced) |

- **Revenue and cost** are FAA CATS Form 127 figures for fiscal 2025. The national totals ($34.5B revenue, $21.9B operating expense excluding depreciation, 56% of revenue aeronautical) are from [DWU's airport finance briefing](https://dwuconsulting.com/videos/dwu-data-briefing-fifteen-years-of-airport-finance). Airport figures are from `dwuconsulting.com/airports/<code>`, where DWU shows the filed CATS line items and calculates the per-enplanement values. This is a third-party presentation of FAA data, not the FAA site itself.
- **Build cost** uses two recent large-hub projects: [Orlando Terminal C](https://canada.constructconnect.com/dcn/news/usa/2022/10/2-8-billion-terminal-c-opens-at-orlando-international-airport/embed) ($2.8B, adds 10-12M passengers a year) and [Newark Terminal A](https://constructiondive.com/news/newark-airport-unveils-27b-terminal-a-airtrain-project-still-delayed/641063) ($2.7B, capacity above 13M a year, replacing a 9M-a-year terminal). Two annual passengers are counted as one enplanement.
- The optimistic, base and conservative columns are *combinations* chosen to span a plausible range; they are not forecasts, and no source says these combinations occur together.

For 18 airports we hold their own FY2025 CATS figures: the top 15 of the national ranking plus New England BDL and BTV, and ATL, BOS, LAX, JFK, PWM, SNA from earlier. Where they exist, `estimate_upside` adds a headline scenario at the airport's own revenue and operating cost (before depreciation, line 6.7), sets `revenue_and_cost_source` to `airport_filed`, and the answer must say so. Other airports get only the generic scenarios (`benchmark`). Build cost is a benchmark in both cases, because filings show what was spent, not what new capacity costs.

The 12 newest airports are in `snapshot/airport_finance_fy2025.csv` (also `src/finance/filed.ts`). They come from DWU's copy of the filed forms; EWR, BTV and FLL were checked line by line against cats.airports.faa.gov and matched. SFB, PIE and BGR have no DWU page and stay on the benchmark.

## Reading the results honestly
- **Payback years are the same for every airport** under a given scenario, because the assumptions are per passenger. Only the dollar size differs, with forecast growth. The tool says so, and the investment score remains the ranking.
- Revenue per passenger varies widely (FY2025: $13.82 at Atlanta, $64.40 at JFK), so a generic figure can be far off for any one airport.
- The base case implies a long payback (about 40 years) and a breakeven build cost (about $319 at 25 years) below the two reference projects' costs. This says operating profit alone rarely repays a large new terminal; such projects are funded with airline rates, passenger facility charges, grants and bonds, which the tool does not model.
- Cost anchors are two large-hub megaprojects (2022-23 dollars). Renovations and small-airport projects can cost very differently.
- Counting all forecast growth as dependent on the project overstates the benefit if existing capacity can absorb some of it; lower `share_of_forecast_growth` to test.
- Not modelled: ramp-up, discounting, inflation, financing, taxes, concession terms, and the possibility that marginal revenue per added passenger differs from the average.

## Not yet done (next phase)
Per-airport CATS revenue and cost for the rest of the scored airports (done for the shortlist; the FAA site has no bulk export). Remaining spot-checks: 9 of the 12 newest airports are not independently checked.
