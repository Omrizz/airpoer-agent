import { z } from "zod";
import { err, ok, type ToolResult } from "./envelope.ts";

export const liveStatusInput = z.object({
  airports: z.array(z.string().regex(/^[A-Za-z]{3}$/, "3-letter airport code")).min(1).max(6).describe("IATA/FAA codes, e.g. ['SFO','OAK']"),
});

export const NAS_URL = "https://nasstatus.faa.gov/api/airport-status-information";
const TIMEOUT_MS = 8000;

interface XNode { tag: string; text: string; children: XNode[] }

/** Minimal tolerant XML reader (no dependency): tags, text, children. Ignores attributes, comments, declarations. */
export function parseXml(xml: string): XNode {
  const root: XNode = { tag: "#root", text: "", children: [] };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([A-Za-z_][\w.\-:]*)[^>]*?(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const top = stack[stack.length - 1]!;
    if (m[1] !== undefined) top.text += m[1];
    else if (m[3]) {
      if (m[2]) { if (stack.length > 1) stack.pop(); }
      else {
        const node: XNode = { tag: m[3], text: "", children: [] };
        top.children.push(node);
        if (!m[4]) stack.push(node);
      }
    } else if (m[5] !== undefined) top.text += m[5];
  }
  return root;
}

const clean = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/\s+/g, " ").trim();

/** Flatten an element's descendants to { tag: text } for leaf nodes (tags that repeat get joined). */
function leaves(n: XNode, out: Record<string, string> = {}): Record<string, string> {
  for (const c of n.children) {
    if (c.children.length) leaves(c, out);
    else if (clean(c.text)) out[c.tag] = out[c.tag] ? `${out[c.tag]}; ${clean(c.text)}` : clean(c.text);
  }
  return out;
}

export interface NasProgram { program: string; details: Record<string, string> }

/**
 * Finds every element that has an <ARPT> child equal to `code` and reports it with the nearest
 * named parent (e.g. "Ground Delay Programs"). Deliberately does not depend on the exact feed layout.
 */
export function programsForAirport(root: XNode, code: string): NasProgram[] {
  const found: NasProgram[] = [];
  const walk = (n: XNode, programName: string) => {
    const name = n.children.find((c) => c.tag.toLowerCase() === "name" && !c.children.length);
    const here = name && clean(name.text) ? clean(name.text) : programName;
    const arpt = n.children.find((c) => c.tag.toUpperCase() === "ARPT");
    if (arpt && clean(arpt.text).toUpperCase() === code) {
      const { ARPT: _a, ...details } = leaves({ ...n, children: n.children.filter((c) => c !== arpt) });
      found.push({ program: here || n.tag.replace(/_/g, " "), details });
    }
    for (const c of n.children) walk(c, here);
  };
  walk(root, "");
  return found;
}

export function updateTime(root: XNode): string | null {
  const find = (n: XNode): string | null => {
    if (/update_?time/i.test(n.tag) && clean(n.text)) return clean(n.text);
    for (const c of n.children) { const r = find(c); if (r) return r; }
    return null;
  };
  return find(root);
}

export async function liveStatus({ airports }: z.infer<typeof liveStatusInput>): Promise<ToolResult<unknown>> {
  const codes = [...new Set(airports.map((a) => a.toUpperCase()))];
  let xml: string;
  try {
    const res = await fetch(NAS_URL, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept: "application/xml,text/xml" } });
    if (!res.ok) return err(`FAA NAS Status returned HTTP ${res.status}.`, "Live status is unavailable right now; answer from the historical data and say so.");
    xml = await res.text();
  } catch (e) {
    return err(`Could not reach FAA NAS Status: ${e instanceof Error ? e.message : String(e)}`, "Live status is unavailable right now; answer from the historical data and say so.");
  }
  const root = parseXml(xml);
  if (!/airport_status|delay|ground|closure/i.test(xml)) return err("FAA NAS Status returned an unexpected response.", "Treat live status as unavailable.");
  const results = codes.map((code) => {
    const programs = programsForAirport(root, code);
    return { airport: code, has_active_programs: programs.length > 0, programs };
  });
  return ok(
    { fetched_at: new Date().toISOString(), faa_update_time: updateTime(root), results },
    {
      assumptions: [
        "Live status is the FAA National Airspace System (NAS) feed at the moment of the call: ground stops, ground delay programs, closures and general delays.",
        "An airport with no entry has no active FAA program right now. That is not evidence about typical conditions.",
      ],
      caveats: [
        "A snapshot of right now. It must not be mixed into the historical scores or compared with 12-month averages.",
        "The feed lists FAA-declared programs only; it does not include every gate or terminal problem.",
      ],
      sources: ["FAA NAS Status, nasstatus.faa.gov"],
    },
  );
}
