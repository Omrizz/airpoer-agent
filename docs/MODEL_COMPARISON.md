# Model comparison

Same evaluation (7 questions across 5 cases, 35 deterministic checks), run once per setup. Costs are estimates from token usage; they are not billing figures.

| Setup | Checks passed | Total cost | Avg cost / question | Avg output tokens | Avg words | Avg model calls | Figures traced | Failed checks |
|---|---|---|---|---|---|---|---|---|
| opus-5-5 / medium | 35/35 | $0.30 | $0.043 | 1254 | 428 | 2.0 | 93% | none |
| opus-5-5 / low | 35/35 | $0.26 | $0.037 | 977 | 366 | 2.0 | 92% | none |
| sonnet-5-5 / medium | 35/35 | $0.16 | $0.023 | 836 | 323 | 1.9 | 94% | none |
| sonnet-5-5 / low | 35/35 | $0.12 | $0.017 | 794 | 320 | 1.9 | 95% | none |
| haiku-5-5 / medium | 35/35 | $0.01 | $0.001 | 1307 | 325 | 2.0 | 95% | none |

## How to read this
- **Checks are shallow.** They test tool selection, required mentions and tool errors, not whether an answer is correct or well judged. Read the per-setup reports in `docs/eval/` before choosing.
- **One run per setup.** Model output varies between runs, so small differences in cost or check counts are noise.
- **Figures traced** is the share of numbers in answers that the grounding check could match to tool output. Derived values (ratios, differences) appear as untraced by design.
- Haiku 5.5 runs without the server-side refusal fallback (not available for that model).
