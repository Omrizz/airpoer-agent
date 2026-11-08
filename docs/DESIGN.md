# Design: Airport Investment Intelligence Agent

A chat agent that helps analysts screen US airports for terminal-expansion potential. This is the short version; details are in [SCORING.md](SCORING.md), [TOOLS.md](TOOLS.md), [MODEL_CHOICE.md](MODEL_CHOICE.md) and [../DATA_CHECK.md](../DATA_CHECK.md).

## Architecture
```
Chat UI (browser; text + voice in/out; trace and score charts)
   |  SSE
HTTP server (localhost) --> Agent loop (Claude, tool use, in-memory history)
                               |-- resolve_airports   "LA", "New England" -> codes / states
                               |-- rank_airports      Investment Opportunity Score + breakdown + sensitivity
                               |-- compare_airports   X vs Y on scale, demand, congestion
                               |-- route_mix          long-haul share, distance bands, passenger vs cargo
                               |-- demand_gap         unmet-demand proxies, nearby alternatives
                               |-- live_status        FAA NAS Status (live API call)
                               `-- get_methodology
                                         |
                        Deterministic TypeScript (zod-validated, unit-tested)
                                         |
                    DuckDB snapshot: BTS T-100, BTS On-Time, FAA TAF, OurAirports
```
Every tool returns one envelope: `{ data, assumptions, caveats, data_as_of, sources }`, or `{ ok: false, error, hint }`. The agent is told to quote the data, restate the assumptions that matter and surface the caveats.

## Where AI is used, and where it is not
| Claude does | Code does (never the model) |
|---|---|
| Understands the question and picks tools | Every score, rank, share, ratio and comparison |
| Resolves ambiguity ("LA" -> LAX, stated aloud) | Region expansion (New England -> CT, ME, MA, NH, RI, VT), airport lookup |
| Chains tools and reuses results for follow-ups | Weight changes ("weight growth more" becomes a `weights` argument), sensitivity runs |
| Writes the explanation and states assumptions | Missing-data handling, confidence and flags |

Guardrail in code: a **grounding check** compares each figure in the answer with the numbers in the tool outputs and reports any it cannot trace. It finds invented numbers; it cannot tell whether a traced number is used correctly (we found one such error by reading answers, see MODEL_CHOICE.md).

## Scoring methodology (summary)
Question answered: *where would extra terminal capacity be absorbed by demand that already exists or is forecast?*

- Each metric becomes a **national percentile** (0-100), so units never need reconciling and outliers cannot dominate. Regional questions filter after scoring, so a score means the same thing in every answer.
- Four components, default weights editable in `src/scoring/config.ts` or per question: **demand pressure 30%** (load factor, peak-month load factor, passenger growth minus seat growth), **congestion 25%** (P90 taxi-out, share of departures delayed 15+ min, air-system share of delay), **growth outlook 25%** (last-12-month growth, FAA 10-year forecast CAGR), **size of prize 20%** (forecast added enplanements, passengers).
- Missing metrics are dropped and weights renormalised, never scored as zero. Every score decomposes to component, metric, raw value and percentile.
- Reported with every score: flags (single-season on-time data, low on-time coverage, short history, missing component, editorial constraint), a confidence level, and a **sensitivity check** (each weight x0.8 and x1.2; does the top K hold?).
- **Peer set:** 179 airports with at least 300k departing passengers and 10 of 12 months of data. Smaller airports are reported as *not scored*, never as scoring low.
- **Feasibility caveat:** a short, hand-written list (SFO, LGA, DCA) flags airports where the runway or policy, not the terminal, is the binding constraint. It is labelled editorial because it is not derived from data.

## How the four sample questions are handled
| Question | Approach | What is surfaced |
|---|---|---|
| New England candidates | `resolve_airports` then `rank_airports` | Peer-set floor, top-5 stability, one month of congestion data |
| LA vs Santa Ana congestion | `compare_airports` (LAX, SNA) | LA assumed to mean LAX, ~5x scale difference, on-time coverage |
| Anchorage long-haul % | `route_mix` | No standard definition: default 3,000+ mi, sensitivity 1,500-4,000 mi; cargo departures outnumber passenger ones, so passenger, cargo and all-flights shares are all returned |
| SFO unmet demand and why | `demand_gap` | Not directly measurable; proxies only (load factor, months above 85%, seat-shortfall proxy, growth, congestion, OAK/SJC spill), plus the runway/fog note |

## Key tradeoffs
1. **Snapshot plus one live call, not live everywhere.** BTS and FAA publish bulk files, not query APIs. A DuckDB snapshot is reproducible, fast and keeps every number traceable to a dated source; it is committed as parquet so a fresh clone runs with no downloads. `live_status` calls the FAA NAS Status feed for "right now" questions only and is deliberately kept out of the score, because a point-in-time delay says nothing about typical conditions.
2. **Percentile ranks over raw weighted sums.** Robust and unit-free, but they say only *relative* position today. They cannot say how large the gap is or what the absolute return would be.
3. **Transparent weights over fitted weights.** There is no ground truth for "profitable renovation", so fitting would be false precision. Weights are judgement calls, shown and changeable, and the sensitivity check tests whether the answer depends on them.
4. **Proxies, stated as proxies.** Taxi-out and delay stand in for congestion; load factor and spill stand in for unmet demand. The agent must say so and must not give one confident "unmet demand" number.
5. **Hand-rolled tool loop over the SDK tool runner.** The UI needs per-tool events (call, result, latency) and full control of history.
6. **Model choice by measurement.** Sonnet 5.5 is the default: correct on every checked item at about half the cost of Opus. Haiku passed the automatic checks but made errors only reading found, so it is not used for answers.

## Assumptions, uncertainty and scope (what the agent must say)
- Data window: T-100 through the latest loaded month (12-month window); FAA TAF 2025 edition. Each answer names its period from `data_as_of`.
- **Congestion rests on limited on-time data** (one summer month in the committed snapshot) and on large reporting carriers only (about 50% of ANC and 73-76% of BOS/LAX/SFO passenger departures). Every airport carries the `single_season_otp` flag until more months are loaded.
- Scores screen for demand pressure. They do not model construction cost, returns, gate or runway capacity, or whether the terminal is the binding constraint.
- Leisure-heavy secondary airports (e.g. SFB, PIE) score high on load factor and growth and may overstate terminal need.
- FAA forecasts are smooth and are the FAA's, not ours. Not used: FAA CATS revenue per passenger, DB1B fares and Census growth (none loaded); these would add a dollar estimate and a fare-based unmet-demand signal.
- `live_status` depends on an external service and fails softly; the agent then says live status is unavailable.

## Verification
75 tests (scoring, tools against the real snapshot, agent loop with a scripted fake model, server, live-status parser with a fixture). `npm run eval` runs the sample questions, follow-ups and an out-of-scope probe against the live model; results are in [EVAL.md](EVAL.md).
