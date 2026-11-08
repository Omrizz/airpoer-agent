// Downloads BTS T-100 Segment (All Carriers, domestic + international) for given years.
// Usage: node scripts/download-t100.mjs 2024 2025 2026
// Source: https://www.transtats.bts.gov  (table FMG). Output: data/raw/t100_segment_<year>.zip
import { writeFileSync, mkdirSync } from "node:fs";

const BASE = "https://www.transtats.bts.gov/DL_SelectFields.aspx?gnoyr_VQ=FMG&QO_fu146_anzr=Nv4%20Pn44vr45";
const FIELDS = [
  "DEPARTURES_SCHEDULED", "DEPARTURES_PERFORMED", "SEATS", "PASSENGERS", "FREIGHT", "MAIL",
  "DISTANCE", "AIR_TIME", "UNIQUE_CARRIER_NAME", "ORIGIN", "ORIGIN_CITY_NAME", "ORIGIN_STATE_ABR",
  "ORIGIN_COUNTRY", "DEST", "DEST_CITY_NAME", "DEST_STATE_ABR", "DEST_COUNTRY", "YEAR", "MONTH", "CLASS",
];

const years = process.argv.slice(2);
if (!years.length) { console.error("give at least one year"); process.exit(1); }
mkdirSync("data/raw", { recursive: true });

const hidden = (html, name) => {
  const m = html.match(new RegExp(`name="${name}"[^>]*value="([^"]*)"`));
  return m ? m[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">") : "";
};

for (const year of years) {
  const get = await fetch(BASE);
  const html = await get.text();
  const cookie = (get.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  const body = new URLSearchParams({
    __EVENTTARGET: "", __EVENTARGUMENT: "",
    __VIEWSTATE: hidden(html, "__VIEWSTATE"),
    __VIEWSTATEGENERATOR: hidden(html, "__VIEWSTATEGENERATOR"),
    __EVENTVALIDATION: hidden(html, "__EVENTVALIDATION"),
    cboGeography: "All", cboYear: year, cboPeriod: "All",
    chkDownloadZip: "on", btnDownload: "Download",
  });
  for (const f of FIELDS) body.set(f, "on");
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie, referer: BASE },
    body,
  });
  const type = res.headers.get("content-type") ?? "";
  const buf = Buffer.from(await res.arrayBuffer());
  if (!type.includes("zip") && !type.includes("octet") && !type.includes("csv")) {
    console.error(`${year}: unexpected response (${type}, ${buf.length} bytes)`);
    writeFileSync(`data/raw/_t100_${year}_error.html`, buf);
    continue;
  }
  writeFileSync(`data/raw/t100_segment_${year}.zip`, buf);
  console.log(`${year}: saved ${(buf.length / 1e6).toFixed(1)} MB (${type})`);
}
