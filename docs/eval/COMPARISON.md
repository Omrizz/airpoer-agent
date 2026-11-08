# Eval comparison

Same 8 questions (5 cases incl. follow-ups and an out-of-scope probe), same tools, same system prompt. Checks are deterministic (tool use, required mentions, no tool errors); they do not rate answer quality. Cost is estimated from token usage and published per-token prices.

| Model | Effort | Checks | Total cost | Per question | Model calls | Output tokens | Avg words | Figures traced | Run time (UTC) |
|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 | medium | 35/35 | $0.010 | $0.001 | 13 | 9,355 | 335 | 192/206 (93%) | 2026-11-08 15:18 |
| claude-haiku-5-5 | medium | 35/35 | $0.008 | $0.001 | 14 | 9,150 | 325 | 179/188 (95%) | 2026-11-08 15:20 |
| claude-opus-5-5 | low | 35/35 | $0.256 | $0.037 | 14 | 6,836 | 366 | 194/210 (92%) | 2026-11-08 15:18 |
| claude-opus-5-5 | medium | 35/35 | $0.301 | $0.043 | 14 | 8,777 | 428 | 232/250 (93%) | 2026-11-08 15:16 |
| claude-opus-5-5 | medium | 34/35 | $0.286 | $0.041 | 15 | 8,120 | 413 | 193/210 (92%) | 2026-11-08 15:19 |
| claude-sonnet-5-5 | low | 35/35 | $0.119 | $0.017 | 13 | 5,557 | 320 | 191/202 (95%) | 2026-11-08 15:19 |
| claude-sonnet-5-5 | medium | 35/35 | $0.163 | $0.023 | 13 | 5,853 | 323 | 184/196 (94%) | 2026-11-08 15:18 |
| claude-sonnet-5-5 | medium | 35/35 | $0.110 | $0.016 | 13 | 5,996 | 335 | 186/199 (93%) | 2026-11-08 15:19 |

## Failed checks
- **claude-opus-5-5 (medium, docs/EVAL.json)**: 4.ask: mentions /proxy|proxies|cannot be measured|not directly/i
