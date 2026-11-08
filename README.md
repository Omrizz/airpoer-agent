# Airport Investment Intelligence Agent

An AI agent that helps analysts screen US airports for terminal-expansion potential. It answers questions such as *"Which airports in New England are strong candidates for terminal expansion?"* or *"What is the unmet flight demand at SFO and why?"*, using public aviation data.

**How AI is used:** Claude picks tools, interprets questions, and explains results. **All numbers come from deterministic code** (scoring, ranking, shares, comparisons), and a grounding check flags any figure in an answer that does not trace back to tool output.

Design docs: [Scoring methodology](docs/SCORING.md) · [Tool contract and agent](docs/TOOLS.md) · [Data check](DATA_CHECK.md)

## Run it

Requires Node 22+ (developed on Node 26).

```bash
npm install
cp .env.example .env        # then put your ANTHROPIC_API_KEY in .env
npm run web                 # chat UI at http://localhost:3000
```

Other commands:

| Command | What it does |
|---|---|
| `npm run chat` | Terminal chat |
| `npm run web:demo` | UI with **scripted** answers built from the real tools (no API key or credits needed; clearly labelled) |
| `npm run eval` | Runs the sample questions, follow-ups and a boundary probe against the live model and writes `docs/EVAL.md` (spends API tokens) |
| `npm test` | 68 tests: scoring, tools against real data, agent loop (scripted fake model), server, markdown renderer |
| `npm run build-metrics` | Rebuilds `airport_metrics` from the downloaded data |

## Data

`data/` is not committed (about 600 MB). To rebuild it:

1. `node scripts/download-t100.mjs 2024 2025 2026`, then unzip each into `data/t100/<year>/` (BTS T-100 segments, all carriers).
2. Download BTS On-Time Performance months from `transtats.bts.gov/PREZIP/` into `data/raw/`, unzip into `data/otp/<month>/`.
3. FAA TAF zip (`taf.faa.gov/Downloads/APO100_TAF_Final_2025.zip`): unzip into `data/taf/`, then `node scripts/xlsx-to-csv.mjs data/taf/Enplanements.xlsx data/taf/enplanements.csv`.
4. OurAirports `airports.csv` into `data/raw/`.
5. `npm run build-metrics`

See [DATA_CHECK.md](DATA_CHECK.md) for sources, quirks and checks.

## Layout
```
src/scoring/   deterministic score, percentile ranking, sensitivity
src/tools/     six tools the agent can call (zod-validated, uniform result envelope)
src/agent/     system prompt, tool loop, grounding check, cost estimate
src/server/    dependency-free HTTP + SSE server (localhost only)
web/           chat UI (vanilla JS): trace, score charts, voice in/out
scripts/       data download/convert, metrics build, CLI chat, eval
```

## Limits (read before trusting a ranking)
- Congestion uses limited on-time data (one summer month so far) and covers large carriers only.
- Scores screen for demand pressure; they do not model cost, returns, or whether the terminal is the binding constraint.
- "Unmet demand" is not directly measurable; the agent reports proxies.
