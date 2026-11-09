import { query } from "./db.ts";

/**
 * Data for the decorative welcome-screen backdrop: the busiest lower-48 airports and the
 * busiest routes between them over the last 12 months of T-100 traffic. Not used by any
 * scoring or tool output; it only gives the animation a real network to follow.
 */
export interface Backdrop {
  airports: { iata: string; lat: number; lon: number; pax: number }[];
  routes: { a: string; b: string; pax: number }[];
}

const AIRPORTS = 60;
const ROUTES = 160;

let cache: Promise<Backdrop> | null = null;

export function backdrop(): Promise<Backdrop> {
  cache ??= build().catch((e) => { cache = null; throw e; });
  return cache;
}

async function build(): Promise<Backdrop> {
  const airports = await query<{ iata: string; lat: number; lon: number; pax: number }>(`
    SELECT m.iata, r.lat, r.lon, m.ltm_pax AS pax
    FROM airport_metrics m JOIN airports_ref r USING (iata)
    WHERE m.ltm_pax IS NOT NULL AND r.lat BETWEEN 24 AND 50 AND r.lon BETWEEN -125 AND -66
    ORDER BY m.ltm_pax DESC LIMIT ${AIRPORTS}`);
  const codes = airports.map((a) => `'${a.iata.replace(/[^A-Z0-9]/g, "")}'`).join(",");
  // Undirected pairs (a < b) so each route is drawn once; flow direction is chosen per particle.
  const routes = await query<{ a: string; b: string; pax: number }>(`
    WITH bounds AS (SELECT max(YEAR*12+MONTH-1) AS latest FROM t100)
    SELECT least(ORIGIN, DEST) AS a, greatest(ORIGIN, DEST) AS b, sum(PASSENGERS) AS pax
    FROM t100, bounds
    WHERE YEAR*12+MONTH-1 > latest - 12 AND ORIGIN IN (${codes}) AND DEST IN (${codes}) AND ORIGIN <> DEST
    GROUP BY 1, 2 ORDER BY pax DESC LIMIT ${ROUTES}`);
  return {
    airports: airports.map((a) => ({ iata: a.iata, lat: +a.lat.toFixed(3), lon: +a.lon.toFixed(3), pax: Math.round(a.pax) })),
    routes: routes.map((r) => ({ a: r.a, b: r.b, pax: Math.round(r.pax) })),
  };
}
