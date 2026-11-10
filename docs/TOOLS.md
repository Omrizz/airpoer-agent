# Tool contract and agent design

## Principle
The LLM chooses tools and explains results. **All numbers come from deterministic code.** Tools read a DuckDB snapshot of public data; the model never sees raw files and is told (system prompt + grounding check) not to state figures a tool did not return.

## Envelope (every tool)
```ts
{ ok: true,  data, assumptions[], caveats[], data_as_of, sources[] }
{ ok: false, error, hint? }        // returned to the model as is_error; it can retry or explain
```
- `assumptions`: definitions and thresholds chosen (e.g. "long-haul = 3,000+ miles"). The agent restates the ones that matter.
- `caveats`: limits that apply to this specific result (e.g. cargo outnumbers passenger flights; on-time data months, fewer than 6 flagged).
- `data_as_of`: T-100 window, on-time months, forecast edition, so answers can name their period.

## Tools
| Tool | Input | Answers | Key outputs |
|---|---|---|---|
| `resolve_airports` | `query` (text) | "LA", "Santa Ana", "New England", "SFO" -> codes / states | `kind` (region, state, metro, airport, fuzzy, none), matches, `ambiguous`, assumptions about interpretation |
| `rank_airports` | `region?`, `top_n?`, `weights?` | Which airports are strong expansion candidates | Score, component and metric breakdown with percentiles, strongest signals, confidence, flags, sensitivity of the top K, **airports in scope that were not scored** |
| `compare_airports` | `airports[2..6]` | Compare X and Y on scale, demand, congestion | Per-airport metrics, deterministic "who is higher, by what ratio" contrasts, scores |
| `route_mix` | `airport`, `service?`, `long_haul_miles?`, `year?` | Share of long-haul flights; route-length mix | Share at the chosen threshold, **sensitivity across 1,500-4,000 mi**, distance bands, passenger vs all-cargo mix, top long-haul destinations |
| `demand_gap` | `airport`, `target_load_factor?`, `nearby_miles?` | Unmet / constrained demand and why | Monthly load factors, months above target, seat-shortfall **proxy**, demand-vs-seat growth, congestion, nearby alternatives, evidence list, `cannot_be_measured_here` |
| `estimate_upside` | `airport`, `share_of_forecast_growth?`, `horizon_years?`, `custom?` | What could an expansion be worth in dollars, and would it pay back? | Three scenarios (optimistic, base, conservative): added revenue, operating profit, build cost, payback, breakeven build cost; the airport's own FY2025 CATS figures where held. **Illustrative, outside the score**; see [FINANCE.md](FINANCE.md) |
| `live_status` | `airports[1..6]` | What is happening right now (FAA ground stops, delay programs, closures) | Per-airport active programs with reason and times, FAA update time. **Live HTTP call** to the FAA NAS Status feed; point-in-time only, never used in scoring |
| `get_methodology` | none | How scores work, limits | Peer set, components, weights, flags, what is not modelled |

Validation: inputs are checked with Zod; IATA codes are regex-validated before they reach SQL (tested against injection). Failures never throw: they come back as `is_error` results.

## How each exam question maps
| Question | Tools | Judgement calls surfaced to the user |
|---|---|---|
| Strong New England expansion candidates | `resolve_airports` -> `rank_airports` | Peer-set floor (smaller airports not scored), on-time months (6 alternating), stability of the top 5 |
| LA vs Santa Ana congestion | `resolve_airports` -> `compare_airports` | LA = LAX (alternatives exist), scale difference (~5x departures), on-time coverage |
| % long-haul out of Anchorage | `route_mix` | Threshold (no standard definition; sensitivity shown), cargo flights outnumber passenger flights |
| Unmet demand at SFO and why | `demand_gap` (+ `rank_airports` if asked) | Not directly measurable; proxies only; runway/fog note; spill to OAK/SJC |

## Agent loop (`src/agent/agent.ts`)
- Manual tool loop on the Messages API (beta endpoint, streaming). Chosen over the SDK tool runner because the UI needs per-tool events (call, result, latency) and full control of history.
- Parallel tool calls run concurrently; **all results return in one user message**.
- Assistant turns are stored exactly as returned (thinking blocks included) because the API requires them unchanged.
- Model `claude-sonnet-5-5` by default (chosen by measurement, see [MODEL_CHOICE.md](MODEL_CHOICE.md); override with `ANTHROPIC_MODEL`), adaptive thinking on by default, `effort: medium` (`ANTHROPIC_EFFORT`). No forced `tool_choice` (unsupported on these models; tools are selected from descriptions).
- Prompt caching via top-level `cache_control`; system prompt is static so the prefix stays cacheable.
- Server-side refusal fallback enabled by default (`ANTHROPIC_FALLBACKS=off` disables it).
- Limits: 8 tool rounds per question; stop reasons `max_tokens`, `refusal` and round-limit are surfaced, never hidden.

## Guardrails that are code, not prompts
1. Scoring, ranking, shares and comparisons are computed in tools.
2. **Grounding check** (`grounding.ts`): after each answer, every figure is matched against numbers in the conversation's tool outputs; untraced figures are reported to the UI/eval. Derived numbers (ratios) are expected to show as untraced unless the model labels them derived. Figures are matched allowing for the rounding shown ("2.9B" covers 2.85B-2.95B) and for unit changes: tool fields named `*_usd_m` or `*_usd_b` are in US$ millions or billions, so "$126M" traces to `126.3`. Tools that report money in other units must follow this naming.
3. Tool result size cap and input validation.

## Known limits
- The grounding check finds numbers with no source; it cannot tell whether a traced number is used correctly.
- No streaming of partial tool inputs; tool inputs are small.
- Conversation history is kept in memory per session; no persistence. Context is large enough for a long session, but there is no summarisation.

## Production notes (not built)
- Authentication: this project uses an API key from `.env`. A deployed service should use Workload Identity Federation (short-lived credentials from the platform's identity) instead of a static key.
- Data refresh: monthly job to re-download T-100 and on-time files and rebuild `airport_metrics`.
