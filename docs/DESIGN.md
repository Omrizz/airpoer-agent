# Design: Airport Investment Intelligence Agent

A chat agent that helps analysts screen US airports for terminal-expansion potential. This is the short version; details are in [SCORING.md](SCORING.md), [TOOLS.md](TOOLS.md), [MODEL_CHOICE.md](MODEL_CHOICE.md) and [../DATA_CHECK.md](../DATA_CHECK.md).

**In one paragraph.** The agent answers analyst questions about where terminal expansion would pay off. Claude reads the question, picks tools and writes the explanation; every number comes from deterministic, unit-tested TypeScript over public FAA and BTS data. Airports are ranked by an *Investment Opportunity Score*: 10 KPIs in 4 components, each KPI turned into a national percentile, with weights that are visible, changeable in chat and stress-tested on every answer. Dollar estimates exist but are deliberately kept out of the score. Every answer restates its data window, assumptions and caveats.

## Exam requirements and where they are met
| Requirement | Where | Notes |
|---|---|---|
| Answer the four sample questions | Agent + tools; walkthrough below; recorded runs in [EVAL.md](EVAL.md) | Each has a dedicated tool path |
| Use public aviation data | BTS T-100, BTS On-Time, FAA TAF, OurAirports, FAA CATS figures (snapshot); FAA NAS Status (live API) | BTS and FAA publish bulk files, not query APIs; see tradeoff 1 |
| Rank or compare on defined KPIs | `src/scoring/` (`rank_airports`, `compare_airports`) | KPI table below |
| Explain reasoning | Every score decomposes to component, KPI, raw value, percentile; UI shows the breakdown chart and tool trace | |
| Conversational follow-ups | In-memory history; tools re-called with new arguments ("weight growth more") | Covered in EVAL.md follow-ups |
| Deterministic scoring, not only LLM | All arithmetic in code; grounding check flags untraced figures | |
| Chat interface (voice bonus) | `npm run web`: browser chat with voice in and out (Web Speech API); `npm run chat` in a terminal; `npm run web:demo` runs with no API key | |
| Assumptions, uncertainty, scope | Tool envelope `assumptions` / `caveats` / `data_as_of`; confidence flags; sensitivity check; section below | |
| Design doc: scoring, tradeoffs, AI use | This file | Detail in SCORING.md, FINANCE.md, TOOLS.md, MODEL_CHOICE.md |

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
                               |-- estimate_upside    illustrative dollar scenarios (outside the score)
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
| Explains the financial scenarios and their caveats | Revenue, operating profit, build cost and payback arithmetic |

Guardrail in code: a **grounding check** compares each figure in the answer with the numbers in the tool outputs and reports any it cannot trace. It finds invented numbers; it cannot tell whether a traced number is used correctly (we found one such error by reading answers, see MODEL_CHOICE.md).

## Scoring methodology (summary)
Question answered: *where would extra terminal capacity be absorbed by demand that already exists or is forecast?*

- Each KPI becomes a **national percentile** (0-100), so units never need reconciling and outliers cannot dominate. Regional questions filter after scoring, so a score means the same thing in every answer.
- `score = sum over components of (component weight x weighted mean of its KPI percentiles)`. Higher means a stronger case. Default weights live in `src/scoring/config.ts` and can be changed per question.

| Component (weight) | KPI (weight in component) | Why it signals terminal need | Source |
|---|---|---|---|
| **Demand pressure (30%)** | Load factor, 12 months (.4) | Seats already full: more passengers need more capacity | BTS T-100 |
| | Peak-month load factor (.3) | Terminals are sized for the peak, not the average | BTS T-100 |
| | Passenger growth minus seat growth (.3) | Demand outrunning supply | BTS T-100 |
| **Congestion (25%)** | P90 taxi-out time (.4) | Airport straining at current throughput | BTS On-Time |
| | Departures delayed 15+ min (.4) | Same, from the passenger's side | BTS On-Time |
| | Air-system (NAS) share of delay minutes (.2) | Delay caused by volume, not by airline or weather | BTS On-Time |
| **Growth outlook (25%)** | Passenger growth, last 12 months vs prior (.5) | Current momentum | BTS T-100 |
| | FAA 10-year enplanement CAGR, 2025-2035 (.5) | Forward-looking demand | FAA TAF |
| **Size of prize (20%)** | Forecast added enplanements by 2035 (.6) | Same % growth means millions more passengers at a hub | FAA TAF |
| | Passengers, 12 months (.4) | Scale of the revenue base | BTS T-100 |

Why these weights: demand pressure is the most direct evidence that capacity would be used, so it weighs most. Congestion and growth are equally important but noisier (congestion is a proxy, growth includes the FAA's forecast). Size stops small fast-growing airports outranking hubs, but at 20% it does not let size alone decide. They are judgement calls, not fitted (see tradeoff 3).

- Missing metrics are dropped and weights renormalised, never scored as zero. Every score decomposes to component, metric, raw value and percentile.
- Reported with every score: flags (single-season on-time data, low on-time coverage, short history, missing component, editorial constraint), a confidence level, and a **sensitivity check** (each weight x0.8 and x1.2; does the top K hold?).
- **Peer set:** 179 airports with at least 300k departing passengers and 10 of 12 months of data. Smaller airports are reported as *not scored*, never as scoring low.
- **Feasibility caveat:** a short, hand-written list (SFO, LGA, DCA) flags airports where the runway or policy, not the terminal, is the binding constraint. It is labelled editorial because it is not derived from data.

## How the four sample questions are handled
| Question | Approach | What is surfaced |
|---|---|---|
| New England candidates | `resolve_airports` then `rank_airports` | Peer-set floor, top-5 stability, 6 alternating months of congestion data |
| LA vs Santa Ana congestion | `compare_airports` (LAX, SNA) | LA assumed to mean LAX, ~5x scale difference, on-time coverage |
| Anchorage long-haul % | `route_mix` | No standard definition: default 3,000+ mi, sensitivity 1,500-4,000 mi; cargo departures outnumber passenger ones, so passenger, cargo and all-flights shares are all returned |
| SFO unmet demand and why | `demand_gap` | Not directly measurable; proxies only (load factor, months above 85%, seat-shortfall proxy, growth, congestion, OAK/SJC spill), plus the runway/fog note |

## Key tradeoffs
1. **Snapshot plus one live call, not live everywhere.** BTS and FAA publish bulk files, not query APIs. A DuckDB snapshot is reproducible, fast and keeps every number traceable to a dated source; it is committed as parquet so a fresh clone runs with no downloads. `live_status` calls the FAA NAS Status feed for "right now" questions only and is deliberately kept out of the score, because a point-in-time delay says nothing about typical conditions.
2. **Percentile ranks over raw weighted sums.** Robust and unit-free, but they say only *relative* position today. They cannot say how large the gap is or what the absolute return would be.
3. **Transparent weights over fitted weights.** There is no ground truth for "profitable renovation", so fitting would be false precision. Weights are judgement calls, shown and changeable, and the sensitivity check tests whether the answer depends on them.
4. **Proxies, stated as proxies.** Taxi-out and delay stand in for congestion; load factor and spill stand in for unmet demand. The agent must say so and must not give one confident "unmet demand" number.
5. **Hand-rolled tool loop over the SDK tool runner.** The UI needs per-tool events (call, result, latency) and full control of history.
6. **Dollars as separate scenarios, not part of the score.** "Profitable" needs money, but FAA CATS has no bulk export, so per-airport revenue and cost exist only for the airports we collected by hand, and there is no ground truth for returns. Blending dollars into the score would rank 18 airports on real finances and 160 on a national average. Instead `estimate_upside` gives optimistic, base and conservative scenarios from cited FAA CATS figures and two reference terminal projects, plus a headline scenario at the airport's own FY2025 filed revenue and operating cost for 18 shortlist airports (3 of them checked line by line against the FAA site). Every assumption is visible and changeable. Build cost is always a benchmark. Details in [FINANCE.md](FINANCE.md).
7. **Model choice by measurement.** Sonnet 5.5 is the default: correct on every checked item at about half the cost of Opus. Haiku passed the automatic checks but made errors only reading found, so it is not used for answers.

## Assumptions, uncertainty and scope (what the agent must say)
- Data window: T-100 through the latest loaded month (12-month window); FAA TAF 2025 edition. Each answer names its period from `data_as_of`.
- **Congestion rests on 6 alternating months of on-time data** (Jul, Sep, Nov 2025; Jan, Mar, May 2026: all seasons, not every month) and on large reporting carriers only (about 50% of ANC and 73-76% of BOS/LAX/SFO passenger departures). Airports with fewer than 6 months of on-time data carry the `single_season_otp` flag.
- Scores screen for demand pressure. They do not model construction cost, returns, gate or runway capacity, or whether the terminal is the binding constraint.
- Leisure-heavy secondary airports (e.g. SFB, PIE) score high on load factor and growth and may overstate terminal need.
- FAA forecasts are smooth and are the FAA's, not ours. Dollars: FAA CATS revenue per passenger has no bulk export (one airport at a time), so the score's "size of prize" stays in forecast enplanements. Dollars come from the separate `estimate_upside` scenarios: airport-specific revenue and cost for 18 shortlist airports, national and benchmark figures elsewhere (SFB, PIE and BGR among them), and benchmark build costs from two large-hub projects everywhere (see FINANCE.md). Not used: DB1B fares and Census growth, which would add a fare-based unmet-demand signal and a demand driver.
- `live_status` depends on an external service and fails softly; the agent then says live status is unavailable.

## Verification
97 tests (scoring, tools against the real snapshot, finance arithmetic and tool, agent loop with a scripted fake model, server, live-status parser with a fixture). `npm run eval` runs the sample questions, follow-ups and an out-of-scope probe against the live model; results are in [EVAL.md](EVAL.md) (recorded before the 6-month on-time rebuild and before airport-specific finance figures, so its figures are older than the current data).
