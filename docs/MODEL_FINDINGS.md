# Model comparison: what the answers showed

Companion to `MODEL_COMPARISON.md` (generated; overwritten on each `npm run compare-models`). This file is a hand review of the answers in `docs/eval/`. One run per setup, read by one reviewer, not blind: treat it as evidence, not proof.

## Cost
| Setup | Avg cost / question | Avg output words |
|---|---|---|
| opus-5-5 / medium | $0.043 | 428 |
| opus-5-5 / low | $0.037 | 366 |
| sonnet-5-5 / medium | $0.023 | 323 |
| sonnet-5-5 / low | $0.017 | 320 |
| haiku-5-5 / medium | $0.001 | 325 |

All five passed all 35 automatic checks, so the checks do not separate them. The differences below came from reading the answers.

## Errors and gaps found
| Finding | Setup | Detail |
|---|---|---|
| **Reversed a signal** | Haiku | Described Burlington (BTV) as "passengers growing 3.8 points slower than seats". The tool reported passenger growth *above* seat growth by 3.8 points (demand outpacing supply). Opus and Sonnet read it correctly. |
| **False inference about cargo** | Haiku | Said including cargo "would make the all-flights share lower" and that it did not calculate it. The computed all-flights long-haul share at Anchorage is 29.5%, about ten times the passenger-only 2.8%, because most long trans-Pacific legs are cargo. |
| **Garbled sentence** | Haiku | "ranks 7th nationally 94th" (7th in region, 94th nationally). |
| **Offered instead of computing** | Sonnet (both), Opus low | Correctly said cargo would change the Anchorage answer a lot, but offered to run it rather than running `route_mix` with `service: "all"`. Honest, but the user's question is left half-answered. |
| **Completed the second view** | Opus medium only | Ran the all-flights view and reported 29.5%, with the threshold sensitivity table. It labelled its own cargo-only arithmetic (51.6%) as derived. |

Spot checks that every setup got right: the Anchorage passenger long-haul share (2.8%), the LAX/SNA scale and coverage figures, SFO's June-only breach of 85% load factor, and declining the stock-purchase question.

## What this suggests
- **Haiku 5.5 is too risky for the answering step** despite costing about 40 times less. Its errors were in the direction and meaning of facts, and the checks did not catch them. It could still suit narrow jobs such as classification.
- **Sonnet 5.5 at low effort is the best cost/quality point** in this run: correct on every item I verified, about 60% cheaper per question than Opus at medium effort, and the shortest answers.
- **Opus at medium effort was the most thorough** (the only one to complete the Anchorage all-flights view) at a few cents more per question.
- **Effort mattered less than model**: low vs medium changed cost by 10-25% within a model, with no quality loss I could see.
- **A prompt change would likely help every setup**: when a tool caveat says an alternative scope changes the answer materially and a tool can compute it, run it instead of offering to. Not applied yet.

## Limits of this comparison
Seven questions, one run each; the checks are shallow; the reviewer knew which model wrote each answer; the data and tools changed slightly between the first eval and this one because the code was being edited at the same time. Small cost differences are within run-to-run noise.
