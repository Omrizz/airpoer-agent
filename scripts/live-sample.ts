// Saves the live FAA NAS Status feed and lists every airport with an active program.
// Use it to capture a real sample while some airport has a delay, then turn the saved file into a test fixture.
// Usage: npm run live-sample
import { mkdirSync, writeFileSync } from "node:fs";
import { allPrograms, NAS_URL, parseXml, updateTime } from "../src/tools/liveStatus.ts";

const res = await fetch(NAS_URL, { signal: AbortSignal.timeout(15000), headers: { accept: "application/xml,text/xml" } });
if (!res.ok) throw new Error(`FAA NAS Status returned HTTP ${res.status}`);
const xml = await res.text();

mkdirSync("samples", { recursive: true });
const file = `samples/nas-status-${new Date().toISOString().replace(/[:.]/g, "-")}.xml`;
writeFileSync(file, xml);

const root = parseXml(xml);
const programs = allPrograms(root);
console.log(`FAA update time: ${updateTime(root) ?? "(not found)"}`);
console.log(`Saved raw feed: ${file} (${xml.length} bytes)`);
if (programs.length === 0) {
  console.log("\nNo airport has an active program right now, so this sample does not exercise the program parser.");
  console.log("Try again during storms or fog (evenings, US East coast) and keep the file that lists programs.");
} else {
  console.log(`\n${programs.length} active program(s):`);
  for (const p of programs) console.log(`- ${p.airport}: ${p.program} ${JSON.stringify(p.details)}`);
  console.log("\nSend this output and the saved file back so it can become a test fixture.");
}
