// Minimal converter for the FAA TAF .xlsx files (inline strings, single sheet, "x:" namespace prefix).
// Usage: node scripts/xlsx-to-csv.mjs data/taf/Enplanements.xlsx data/taf/enplanements.csv
// Uses the `unzip` binary (ships with Git for Windows) to stream the sheet XML.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const [src, dst] = process.argv.slice(2);
const xml = execFileSync("unzip", ["-p", src, "xl/worksheets/sheet1.xml"], { maxBuffer: 1 << 30 }).toString("utf8");

const colIndex = (ref) => ref.replace(/\d+/g, "").split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
const unesc = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const csv = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

const lines = [];
for (const rowMatch of xml.matchAll(/<x:row\b[^>]*>(.*?)<\/x:row>/gs)) {
  const cells = [];
  for (const c of rowMatch[1].matchAll(/<x:c\b([^>]*?)(?:\/>|>(.*?)<\/x:c>)/gs)) {
    const ref = /r="([A-Z]+\d+)"/.exec(c[1])[1];
    const body = c[2] ?? "";
    const t = /<x:t[^>]*>(.*?)<\/x:t>/s.exec(body)?.[1] ?? /<x:v>(.*?)<\/x:v>/s.exec(body)?.[1] ?? "";
    cells[colIndex(ref)] = unesc(t);
  }
  lines.push(Array.from(cells, (v) => csv(v ?? "")).join(","));
}
writeFileSync(dst, lines.join("\n"));
console.log(`${src} -> ${dst}: ${lines.length} rows`);
