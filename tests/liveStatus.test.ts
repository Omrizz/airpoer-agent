import { afterEach, describe, expect, it, vi } from "vitest";
import { parseXml, programsForAirport, updateTime } from "../src/tools/liveStatus.ts";
import { runTool } from "../src/tools/index.ts";

// Fixture follows the documented shape of the FAA NAS Status feed (not a recorded live response).
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<AIRPORT_STATUS_INFORMATION>
  <Update_Time>Sun Nov 08 17:00:00 2026 GMT</Update_Time>
  <Delay_type>
    <Name>Ground Delay Programs</Name>
    <Ground_Delay_List>
      <Ground_Delay><ARPT>SFO</ARPT><Reason>low ceilings / fog</Reason><Avg>62 minutes</Avg><Max>140 minutes</Max></Ground_Delay>
    </Ground_Delay_List>
  </Delay_type>
  <Delay_type>
    <Name>Ground Stops</Name>
    <Ground_Stop_List><Program><ARPT>EWR</ARPT><Reason>thunderstorms</Reason><End_Time>6:30 pm EST</End_Time></Program></Ground_Stop_List>
  </Delay_type>
  <Delay_type><Name>Airport Closures</Name><Airport_Closure_List/></Delay_type>
</AIRPORT_STATUS_INFORMATION>`;

afterEach(() => vi.unstubAllGlobals());

describe("live_status parser", () => {
  it("finds programs for an airport with their type, reason and numbers", () => {
    const p = programsForAirport(parseXml(XML), "SFO");
    expect(p).toHaveLength(1);
    expect(p[0]!.program).toBe("Ground Delay Programs");
    expect(p[0]!.details).toMatchObject({ Reason: "low ceilings / fog", Avg: "62 minutes" });
  });
  it("returns nothing for an airport with no program, and reads the update time", () => {
    const root = parseXml(XML);
    expect(programsForAirport(root, "LAX")).toEqual([]);
    expect(updateTime(root)).toContain("2026");
  });
});

describe("live_status tool", () => {
  it("reports programs and says an empty result is not typical conditions", async () => {
    vi.stubGlobal("fetch", async () => new Response(XML, { status: 200 }));
    const r = JSON.parse((await runTool("live_status", { airports: ["sfo", "LAX"] })).content);
    expect(r.ok).toBe(true);
    expect(r.data.results[0]).toMatchObject({ airport: "SFO", has_active_programs: true });
    expect(r.data.results[1]).toMatchObject({ airport: "LAX", has_active_programs: false });
    expect(r.assumptions.join(" ")).toMatch(/not evidence about typical/);
  });
  it("fails softly when the API is down", async () => {
    vi.stubGlobal("fetch", async () => { throw new Error("network down"); });
    const out = await runTool("live_status", { airports: ["SFO"] });
    expect(out.is_error).toBe(true);
    expect(out.content).toMatch(/unavailable/);
  });
  it("rejects bad codes before any network call", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect((await runTool("live_status", { airports: ["SFO'; DROP"] })).is_error).toBe(true);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("allPrograms", () => {
  it("lists programs for every airport in the feed", async () => {
    const { allPrograms } = await import("../src/tools/liveStatus.ts");
    const all = allPrograms(parseXml(XML));
    expect(all.map((p) => p.airport).sort()).toEqual(["EWR", "SFO"]);
  });
});
