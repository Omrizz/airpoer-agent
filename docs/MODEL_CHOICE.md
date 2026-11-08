# Model choice and token cost

**Question:** which model is the cheapest that still does this job well? **Method:** run the same 8 questions (5 cases: the exam's four sample questions with follow-ups, plus an out-of-scope probe) on each model with identical tools and prompt, then read the answers. Full table: [eval/COMPARISON.md](eval/COMPARISON.md). Per-run reports: `docs/EVAL.md`, `docs/eval/*.md`.

## Results (8 questions, estimated from token usage)
| Model | Checks passed | Cost for all 8 | Per question | Notes |
|---|---|---|---|---|
| Claude Opus 5.5 | 34-35 / 35 | $0.29-0.30 | about $0.04 | Most thorough: proactively ran a second query so the Anchorage answer covered cargo-inclusive share |
| Claude Sonnet 5.5 | 35 / 35 | $0.11-0.16 | about $0.02 | Correct and candid; offered the cargo version instead of assuming |
| Claude Haiku 5.5 | 35 / 35 | about $0.01 | about $0.001 | Passed checks, but made factual slips that the checks missed (below, and in [MODEL_FINDINGS.md](MODEL_FINDINGS.md)) |

Repeated runs of the same model varied by 10-40% in cost (the model chooses how many tool calls to make), so read these as ranges. Effort level mattered far less than model: Opus at `low` effort cost about 15% less than at `medium`.

## What the checks missed, and what fixed it
The automatic checks (right tool called, required points mentioned, no tool errors, figures traced to tool output) passed for all models, so I read every answer. Three real problems appeared that no check caught:
1. **A cap quoted as a count.** The ranking tool listed only the 15 largest unscored airports, and the model said "15 airports weren't scored" (the true count was 65). Fixed in the tool: it now returns the total and says to quote it. All three models then reported 65 correctly.
2. **A guessed direction.** Haiku said that including cargo would make the Anchorage long-haul share "much lower"; the data says the opposite (29.5% of all departures vs 2.8% of passenger departures). No figure was involved, so the grounding check could not flag it. Root cause: the tool warned that cargo matters but did not provide the number. Fixed in the tool: `route_mix` now returns the share for passenger, cargo and all flights in one call. After the fix, Haiku, Sonnet and Opus all report the correct cargo-inclusive figures.
3. **A check that was too strict.** The Opus SFO answer was marked as failing because it said unmet demand "can't be measured directly" rather than one of my listed phrases. The answer was correct; the check wording was widened. The stored report still shows the original 34/35.

**Lesson:** when a caveat depends on a number, put the number in the tool result. This makes cheaper models safer and removes a model call, which lowers cost and risk together.

## Recommendation
- The workload is tool-heavy: every figure comes from deterministic code, and the model only routes and explains. That is why a small model can do it, and why a local model was not needed.
- **Decision: Sonnet 5.5 is the default.** It was correct on every item checked, honest about what it had not computed, and costs about half of Opus. **Opus 5.5** is the option for open-ended multi-step analysis (it was the only model to proactively complete the Anchorage cargo view before the tool fix). **Haiku 5.5 is not used for the answering step**: a separate hand review of the same runs found it reversed a signal (said Burlington's passengers grew slower than seats when the tool said faster), drew a false inference about cargo, and garbled a sentence. Its roughly 40x lower price would suit narrow jobs such as classification, not explaining figures to analysts.
- Switch with `ANTHROPIC_MODEL` and `ANTHROPIC_EFFORT`. That review also suggests Sonnet at `low` effort is a further saving (about 25% cheaper in these runs) with no quality loss it could see; the default stays at `medium` until that is checked on a larger set.
- Cost levers already in place: prompt caching (most input tokens are cache reads at about a tenth of the price), compact tool outputs, a static system prompt, parallel tool calls, and an 8-round tool cap.

## Limits of this evidence
- 8 questions, one or two runs each. Model output varies from run to run, so differences between Sonnet and Haiku in particular are not statistically established.
- The checks are loose, and answer quality was judged by reading. A larger question set with a graded rubric would be needed for stronger claims.
- Costs are estimates from token counts and list prices, not billing data.
