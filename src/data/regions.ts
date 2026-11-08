/** US state names/abbreviations and the named regions an analyst might use. Deterministic, no LLM. */
export const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  PR: "Puerto Rico", VI: "U.S. Virgin Islands", GU: "Guam",
};

const NEW_ENGLAND = ["CT", "ME", "MA", "NH", "RI", "VT"];
const MID_ATLANTIC = ["NJ", "NY", "PA"];
const SOUTH_ATLANTIC = ["DE", "DC", "FL", "GA", "MD", "NC", "SC", "VA", "WV"];
const EAST_SOUTH_CENTRAL = ["AL", "KY", "MS", "TN"];
const WEST_SOUTH_CENTRAL = ["AR", "LA", "OK", "TX"];
const EAST_NORTH_CENTRAL = ["IL", "IN", "MI", "OH", "WI"];
const WEST_NORTH_CENTRAL = ["IA", "KS", "MN", "MO", "NE", "ND", "SD"];
const MOUNTAIN = ["AZ", "CO", "ID", "MT", "NV", "NM", "UT", "WY"];
const PACIFIC = ["AK", "CA", "HI", "OR", "WA"];

/** US Census Bureau regions/divisions, plus a few common informal names. */
export const REGIONS: Record<string, { states: string[]; note?: string }> = {
  "new england": { states: NEW_ENGLAND },
  "mid atlantic": { states: MID_ATLANTIC },
  northeast: { states: [...NEW_ENGLAND, ...MID_ATLANTIC], note: "Census Northeast = New England + Mid-Atlantic" },
  "south atlantic": { states: SOUTH_ATLANTIC },
  "east south central": { states: EAST_SOUTH_CENTRAL },
  "west south central": { states: WEST_SOUTH_CENTRAL },
  south: { states: [...SOUTH_ATLANTIC, ...EAST_SOUTH_CENTRAL, ...WEST_SOUTH_CENTRAL], note: "Census South" },
  "east north central": { states: EAST_NORTH_CENTRAL },
  "west north central": { states: WEST_NORTH_CENTRAL },
  midwest: { states: [...EAST_NORTH_CENTRAL, ...WEST_NORTH_CENTRAL], note: "Census Midwest" },
  mountain: { states: MOUNTAIN },
  pacific: { states: PACIFIC },
  west: { states: [...MOUNTAIN, ...PACIFIC], note: "Census West" },
  "pacific northwest": { states: ["OR", "WA"], note: "Informal: Oregon and Washington only" },
  southwest: { states: ["AZ", "NM", "TX", "OK"], note: "Informal; definitions vary" },
  "great lakes": { states: ["IL", "IN", "MI", "MN", "NY", "OH", "PA", "WI"], note: "Informal: Great Lakes states" },
  "gulf coast": { states: ["AL", "FL", "LA", "MS", "TX"], note: "Informal: Gulf states" },
};

export const norm = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

const NAME_TO_ABBR = new Map(Object.entries(STATE_NAMES).map(([abbr, name]) => [norm(name), abbr]));

export function findRegion(text: string): { name: string; states: string[]; note?: string } | null {
  const t = norm(text).replace(/^(the|in|around|near)\s+/, "").replace(/\s+(region|area|states?)$/, "");
  const hit = REGIONS[t];
  return hit ? { name: t, ...hit } : null;
}

export function findState(text: string): string | null {
  const t = norm(text).replace(/^(the|in|state of)\s+/, "");
  if (NAME_TO_ABBR.has(t)) return NAME_TO_ABBR.get(t)!;
  const up = text.trim().toUpperCase();
  return STATE_NAMES[up] ? up : null;
}

/** Hand-written metro aliases: "LA", "Bay Area", "NYC". Primary airport first. Editorial, small, extendable. */
export const METRO_ALIASES: Record<string, { airports: string[]; note: string }> = {
  "la": { airports: ["LAX", "BUR", "LGB", "ONT", "SNA"], note: "Los Angeles area. LAX is the primary airport; BUR, LGB, ONT and SNA are the nearby alternatives." },
  "los angeles": { airports: ["LAX", "BUR", "LGB", "ONT", "SNA"], note: "LAX is the primary airport; BUR, LGB, ONT and SNA are the nearby alternatives." },
  "santa ana": { airports: ["SNA"], note: "John Wayne Airport (Orange County)." },
  "john wayne": { airports: ["SNA"], note: "John Wayne Airport, Santa Ana (SNA)." },
  "orange county": { airports: ["SNA"], note: "John Wayne Airport (SNA) is the Orange County commercial airport." },
  "nyc": { airports: ["JFK", "LGA", "EWR"], note: "New York City area." },
  "new york": { airports: ["JFK", "LGA", "EWR"], note: "New York metro airports (EWR is in New Jersey)." },
  "bay area": { airports: ["SFO", "OAK", "SJC"], note: "San Francisco Bay Area." },
  "san francisco": { airports: ["SFO"], note: "SFO; Oakland (OAK) and San Jose (SJC) are the nearby alternatives." },
  "dc": { airports: ["DCA", "IAD", "BWI"], note: "Washington, DC area." },
  "washington": { airports: ["DCA", "IAD", "BWI"], note: "Washington, DC area (state of Washington is a different match: use 'Washington state')." },
  "chicago": { airports: ["ORD", "MDW"], note: "Chicago area." },
  "dallas": { airports: ["DFW", "DAL"], note: "Dallas area." },
  "houston": { airports: ["IAH", "HOU"], note: "Houston area." },
  "miami": { airports: ["MIA", "FLL"], note: "South Florida (FLL is Fort Lauderdale)." },
  "boston": { airports: ["BOS"], note: "Boston Logan; PVD, MHT and ORH are regional alternatives." },
};
