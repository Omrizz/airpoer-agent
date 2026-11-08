# Scoring methodology (v1)

**Question the score answers:** *where would extra terminal capacity be absorbed by demand that already exists or is forecast?*
It is a **screening** tool for analysts, not a valuation. It does not estimate construction cost, returns, or whether the terminal is the binding constraint.

## Design rules
1. **Deterministic.** The LLM never computes or invents a number. It calls `scoreAirports()` and explains the output.
2. **Rank-based.** Every metric becomes a percentile (0-100) within the national peer set, so units never need to be reconciled and outliers cannot dominate.
3. **Missing data is never zero.** An unavailable metric is dropped and the remaining weights are renormalised. Missing whole components are flagged.
4. **Percentiles are always national.** A regional question ("New England") filters the list *after* scoring, so BOS's 72 means the same thing in every answer.
5. **Every score decomposes**: component -> metric -> raw value and percentile. The agent quotes these directly.

## Peer set
US airports with at least 300k departing passengers in the last 12 months (passenger service classes F+L) and at least 10 of 12 months of data. Currently 179 airports. Smaller airports (e.g. Nantucket, Bar Harbor) are *not scored*, and the agent must say so rather than imply they scored low.

## Components (default weights, editable in `src/scoring/config.ts` or per question)
| Component | Weight | Metrics (weight inside component) | Source |
|---|---|---|---|
| Demand pressure | 30% | load factor 12 mo (.4); peak-month load factor (.3); passenger growth minus seat growth (.3) | BTS T-100 |
| Congestion | 25% | P90 taxi-out (.4); % departures delayed 15+ min (.4); NAS (air-system/volume) share of delay minutes (.2) | BTS On-Time Performance |
| Growth outlook | 25% | passenger growth, last 12 mo vs prior (.5); FAA forecast 10-yr enplanement CAGR 2025-2035 (.5) | T-100, FAA TAF |
| Size of prize | 20% | forecast added enplanements by 2035 (.6); passengers 12 mo (.4) | FAA TAF, T-100 |

`score = sum(component_score x weight)`, where `component_score` is the weighted mean of the metric percentiles. Higher = stronger case.

**Why these.** Load factor and peak load factor show seats already full (a terminal handles *passengers*, not just flights). Passenger growth above seat growth shows demand outrunning supply. Taxi-out and delay share show the airport already straining at its current throughput. The FAA forecast adds forward-looking growth. Size of prize stops tiny fast-growing airports from outranking hubs where the same percentage means millions of passengers.

## Confidence and flags (reported with every score)
| Flag | Trigger | Effect |
|---|---|---|
| `single_season_otp` | fewer than 6 months of on-time data | congestion may be one season only |
| `low_otp_coverage` | on-time data covers under 60% of T-100 departures | congestion may be skewed (reporting carriers only) |
| `short_history` | under 12 months of T-100 data in the window | growth less reliable |
| `missing_component` | a whole component has no data | score re-weighted over the rest |
| `editorial_constraint` | airport is on a short hand-written list (SFO, LGA, DCA) | not data-derived; terminal may not be the bottleneck |

Confidence = high (0 issues), medium (1), low (2+). The editorial flag does not change confidence.

## Sensitivity check
`sensitivity()` re-ranks with each component weight scaled by 0.8 and 1.2 (9 scenarios) and reports min/max rank and how often each top-K airport stays in the top K. Current result: the national top 5 and the New England top 5 are both stable.

## Known limitations (must be stated to users)
- **On-time data is one month so far (July 2025, a peak month)**, so congestion is seasonally biased until more months are loaded. All airports carry the `single_season_otp` flag.
- On-time data covers large reporting carriers only (about 50% of ANC, 73-76% of BOS/LAX/SFO departures).
- Taxi-out and delay are *proxies* for congestion, not runway capacity. No dataset here measures capacity or unmet demand directly.
- Leisure-heavy secondary airports with ultra-low-cost carriers (SFB, PIE) score high on load factor and growth; this reflects the data, and may overstate terminal need.
- The forecast is the FAA's, not ours, and FAA forecasts are known to be smooth.
- Weights are judgement calls. They are not fitted to outcomes (there is no ground truth of "profitable renovation").
- Scores are relative within today's US peer set; they say nothing about absolute return.

## Reproduce
```
npm run build-metrics     # T-100 + OTP + TAF -> airport_metrics table
npm test                  # 18 unit tests on the scoring module
npm run score -- --region NE --detail PWM
```
