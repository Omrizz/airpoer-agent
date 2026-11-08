import { z } from "zod";
import { query, sqlList } from "../data/db.ts";
import { METRO_ALIASES, findRegion, findState, norm, STATE_NAMES } from "../data/regions.ts";
import { ok, SOURCES, type ToolResult } from "./envelope.ts";

export const resolveInput = z.object({
  query: z
    .string()
    .min(1)
    .describe("Free text the user used: an airport code (SFO), name (John Wayne), city, metro (LA, Bay Area), US state, or region (New England)."),
});

interface Match {
  iata: string;
  name: string | null;
  city: string | null;
  state: string | null;
  ltm_pax: number | null;
  why: string;
}

const STOP = new Set(["airport", "international", "intl", "regional", "the", "of", "at", "field", "municipal"]);

async function lookup(codes: string[], why: string): Promise<Match[]> {
  if (!codes.length) return [];
  const rows = await query<Omit<Match, "why">>(`
    SELECT r.iata, coalesce(r.name, m.name) AS name, coalesce(r.city, m.city) AS city, r.state, m.ltm_pax
    FROM airports_ref r LEFT JOIN airport_metrics m USING (iata)
    WHERE r.iata IN (${sqlList(codes)})`);
  const byCode = new Map(rows.map((r) => [r.iata, r]));
  return codes.filter((c) => byCode.has(c)).map((c) => ({ ...byCode.get(c)!, why }));
}

export async function resolveAirports(input: z.infer<typeof resolveInput>): Promise<ToolResult<unknown>> {
  const raw = input.query.trim();
  const t = norm(raw);

  // 1. Named region ("New England", "Pacific Northwest")
  const region = findRegion(raw);
  if (region) {
    const rows = await query<{ n: number }>(`SELECT count(*) AS n FROM airport_metrics WHERE state IN (${region.states.map((s) => `'${s}'`).join(",")}) AND ltm_pax > 0`);
    return ok(
      { kind: "region", region: region.name, states: region.states, airports_with_service: rows[0]!.n, ambiguous: false,
        next_step: "Call rank_airports with this region to score and rank its airports." },
      { assumptions: [`"${raw}" interpreted as: ${region.states.join(", ")}.${region.note ? ` ${region.note}.` : ""}`], sources: [SOURCES.oa] },
    );
  }

  // 2. Metro alias (checked before state so "LA" and "New York" work), 3. state
  const alias = METRO_ALIASES[t];
  const state = findState(raw);
  if (alias) {
    const matches = await lookup(alias.airports, "metro alias");
    return ok(
      { kind: "metro", matches, ambiguous: alias.airports.length > 1 || !!state,
        ...(state ? { also_could_mean_state: state } : {}) },
      { assumptions: [alias.note, ...(state ? [`"${raw}" is also a US state (${STATE_NAMES[state]}); say so if the user meant the state.`] : [])], sources: [SOURCES.oa] },
    );
  }
  if (state) {
    return ok(
      { kind: "state", state, states: [state], ambiguous: false, next_step: "Call rank_airports with this state." },
      { assumptions: [`"${raw}" interpreted as the state ${STATE_NAMES[state]} (${state}).`], sources: [SOURCES.oa] },
    );
  }

  // 4. IATA code
  if (/^[A-Za-z]{3}$/.test(raw)) {
    const matches = await lookup([raw.toUpperCase()], "IATA code");
    if (matches.length) return ok({ kind: "airport", matches, ambiguous: false }, { sources: [SOURCES.oa] });
  }

  // 5. Name / city search: every meaningful token must appear in "name city iata"
  const tokens = t.split(" ").filter((w) => w.length > 1 && !STOP.has(w));
  if (tokens.length) {
    const where = tokens.map((w) => `lower(coalesce(r.name,'') || ' ' || coalesce(r.city,'') || ' ' || r.iata) LIKE '%${w}%'`).join(" AND ");
    const rows = await query<Omit<Match, "why">>(`
      SELECT r.iata, r.name, r.city, r.state, m.ltm_pax
      FROM airports_ref r LEFT JOIN airport_metrics m USING (iata)
      WHERE ${where} AND m.ltm_pax IS NOT NULL
      ORDER BY m.ltm_pax DESC LIMIT 5`);
    if (rows.length) {
      const matches = rows.map((r) => ({ ...r, why: "name/city match" }));
      return ok(
        { kind: "fuzzy", matches, ambiguous: matches.length > 1 },
        { assumptions: ["Matched by name/city text, ordered by passenger volume. Confirm with the user if more than one is plausible."], sources: [SOURCES.oa] },
      );
    }
  }

  return ok(
    { kind: "none", matches: [], ambiguous: false },
    { caveats: [`No US airport with scheduled passenger service matched "${raw}". Ask the user to clarify; do not guess a code.`] },
  );
}
