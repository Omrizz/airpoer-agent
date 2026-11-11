# Airport Investment Intelligence Agent

An AI agent that helps analysts screen US airports for terminal-expansion potential. It answers questions such as *"Which airports in New England are strong candidates for terminal expansion?"* or *"What is the unmet flight demand at SFO and why?"*, using public aviation data.

**How AI is used:** Claude picks tools, interprets questions, and explains results. **All numbers come from deterministic code** (scoring, ranking, shares, comparisons), and a grounding check flags any figure in an answer that does not trace back to tool output.

Design docs: **[Design overview](docs/DESIGN.md)** · [Scoring methodology](docs/SCORING.md) · [Financial scenarios](docs/FINANCE.md) · [Tool contract and agent](docs/TOOLS.md) · [Data check](DATA_CHECK.md)

## Run it

First time? The two-page [run guide (PDF)](docs/RUN_GUIDE.pdf) walks through setup, demo mode and questions to try.

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
| `npm test` | 97 tests: scoring, tools against real data, agent loop (scripted fake model), server, markdown renderer |
| `npm run build-metrics` | Rebuilds `airport_metrics` from the downloaded data |
| `npm run live-sample` | Saves the live FAA NAS Status feed to `samples/` and lists airports with active programs (to capture a real fixture) |
| `npm run export-snapshot` | Writes the tables the agent reads to `snapshot/*.parquet` |

## Data

**Fresh clone: nothing to download.** The processed tables the agent reads are committed as `snapshot/*.parquet` (about 22 MB). On first use the app builds `data/airports.duckdb` from them automatically, so `npm install && npm run web:demo` works straight away.

The raw source files (`data/`, about 600 MB) are not committed. To refresh the data from the public sources, rebuild them, then run `npm run export-snapshot` to update the committed snapshot:

1. `node scripts/download-t100.mjs 2024 2025 2026`, then unzip each into `data/t100/<year>/` (BTS T-100 segments, all carriers).
2. Download BTS On-Time Performance months from `transtats.bts.gov/PREZIP/` into `data/raw/`, unzip into `data/otp/<month>/`.
3. FAA TAF zip (`taf.faa.gov/Downloads/APO100_TAF_Final_2025.zip`): unzip into `data/taf/`, then `node scripts/xlsx-to-csv.mjs data/taf/Enplanements.xlsx data/taf/enplanements.csv`.
4. OurAirports `airports.csv` into `data/raw/`.
5. `npm run build-metrics`

See [DATA_CHECK.md](DATA_CHECK.md) for sources, quirks and checks.

## Layout
```
src/scoring/   deterministic score, percentile ranking, sensitivity
src/finance/   financial scenario assumptions and arithmetic (separate from the score)
src/tools/     eight tools the agent can call (zod-validated, uniform result envelope)
src/agent/     system prompt, tool loop, grounding check, cost estimate
src/data/      DuckDB access, region/window helpers, snapshot loader
src/server/    dependency-free HTTP + SSE server (localhost only)
web/           chat UI (vanilla JS): trace, score charts, voice in/out; welcome backdrop (decorative)
scripts/       data download/convert, metrics build, CLI chat, eval
```

## Welcome backdrop (decorative)

The landing screen shows particles flying the 160 busiest routes between the 60 busiest lower-48 airports (last 12 months of T-100, via `GET /api/backdrop`), spawned in proportion to passengers, with hub dots sized by traffic. It is decoration, not a chart: it has no axes or values, uses a fixed seed so every load looks the same, goes static under reduced-motion, is hidden on phones, and disappears once the first question is asked. It plays no part in scoring.

## Limits (read before trusting a ranking)
- Congestion uses 6 alternating months of on-time data (Jul, Sep, Nov 2025; Jan, Mar, May 2026), so all seasons are represented but not every month, and it covers large reporting carriers only.
- Scores screen for demand pressure; they do not model cost, returns, or whether the terminal is the binding constraint. Dollar figures come only from the separate `estimate_upside` scenarios (stated assumptions, not part of the score).
- "Unmet demand" is not directly measurable; the agent reports proxies.
