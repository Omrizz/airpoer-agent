import { renderMarkdown, stripMarkdown } from "./md.js";
import { startBackdrop } from "./backdrop.js";

const $ = (id) => document.getElementById(id);
const log = $("log"), form = $("form"), input = $("input"), sendBtn = $("send"), micBtn = $("mic");
const SAMPLES = [
  ["Rank", "Which airports in New England are strong candidates for terminal expansion?"],
  ["Compare", "Compare LA and Santa Ana airport congestion levels."],
  ["Route mix", "What is the percentage of long haul flights out of Anchorage airport?"],
  ["Demand gap", "What is the unmet flight demand in SFO airport and why?"],
];

let sessionId;
try { sessionId = sessionStorage.getItem("sid"); } catch { /* storage may be blocked */ }
if (!sessionId) { sessionId = crypto.randomUUID(); try { sessionStorage.setItem("sid", sessionId); } catch { /* ignore */ } }
let busy = false;
let stopBackdrop = null;

// ---------- helpers ----------
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const scrollDown = () => window.scrollTo({ top: document.body.scrollHeight });
const money = (v) => (v == null ? null : v < 0.01 ? "<$0.01" : `$${v.toFixed(2)}`);
const fmtArgs = (o) => Object.entries(o ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ");
const COMP = { demand_pressure: "Demand pressure", congestion: "Congestion", growth: "Growth outlook", scale: "Size of prize" };

// ---------- banner + chips ----------
async function init() {
  // Decorative route-network animation behind the welcome screen; removed on the first question.
  const host = el("div", "backdrop-host");
  const placeHost = () => { host.style.top = `${document.querySelector("header").getBoundingClientRect().bottom}px`; };
  placeHost(); window.addEventListener("resize", placeHost);
  document.body.prepend(host);
  startBackdrop(host).then((stop) => {
    if (!$("welcome")) stop?.(); else stopBackdrop = stop;
    if (!stop) host.remove();
  });
  for (const [kind, q] of SAMPLES) {
    const b = el("button", "example"); b.type = "button";
    b.append(el("span", "exkind", kind), el("span", "exq", q));
    b.addEventListener("click", () => ask(q));
    $("chips").append(b);
  }
  loadMethod();
  try {
    const h = await (await fetch("/api/health")).json();
    const banner = $("banner");
    if (h.demo) { banner.textContent = "DEMO MODE: scripted answers built from the real tools, not a language model. Only the four example questions work."; banner.hidden = false; }
    else if (!h.ready) { banner.textContent = "Chat is disabled: no ANTHROPIC_API_KEY found. Put it in .env and restart, or run npm run web:demo."; banner.hidden = false; sendBtn.disabled = true; }
  } catch { /* offline: leave UI usable, errors show on send */ }
}

// ---------- welcome: the scoring method, read from the server's scoring config ----------
async function loadMethod() {
  let m;
  try { const r = await fetch("/api/method"); if (!r.ok) return; m = await r.json(); } catch { return; }
  if (!$("welcome")) return;
  $("methodLede").textContent = `A 0–100 screening score for where added terminal capacity would be used. Each metric is ranked against ${m.peer_set_size} US peer airports as a national percentile, metrics roll up into four components, and the components are weighted into the total.`;
  const bar = $("wbar"), cols = $("wcols");
  bar.setAttribute("aria-label", `Default weights: ${m.components.map((c) => `${c.label} ${c.default_weight_pct}%`).join(", ")}`);
  cols.style.gridTemplateColumns = m.components.map((c) => `${c.default_weight_pct}fr`).join(" ");
  bar.style.gridTemplateColumns = cols.style.gridTemplateColumns;
  for (const c of m.components) {
    const seg = el("span", `c-${c.id}`); seg.title = `${c.label}: ${c.default_weight_pct}%`; bar.append(seg);
    const col = el("div", "wcol");
    const head = el("div", "wcol-head"); head.append(el("span", "wpct", `${c.default_weight_pct}%`), el("span", "wlabel", c.label));
    const ul = el("ul");
    for (const x of c.metrics) ul.append(el("li", null, x.label));
    col.append(head, ul); cols.append(col);
  }
  const a = m.data_as_of ?? {};
  const facts = [
    ["Peer set", `${m.peer_set_size} airports with ${m.peer_set.replace(/^US airports with /, "")}`],
    ["Data window", `Traffic ${a.t100_ltm_window ?? "n/a"}; on-time data from ${a.otp_months?.length ?? 0} sampled months; FAA forecast 2025 edition.`],
    ["Uncertainty", "Each ranking reports a confidence level and re-runs with every weight shifted ±20% to show whether the order holds."],
    ["Not modelled", `${m.not_modelled.join("; ")}.`],
  ];
  for (const [k, v] of facts) { const d = el("div"); d.append(el("dt", null, k), el("dd", null, v)); $("methodFacts").append(d); }
  $("method").hidden = false;
}

// ---------- visualisations built from tool results ----------
// Which metrics feed which component (mirrors src/scoring/config.ts; labels only, no numbers).
const METRICS = {
  demand_pressure: { load_factor: "Load factor (12 mo)", peak_month_load_factor: "Peak-month load factor", demand_supply_gap: "Passenger growth minus seat growth" },
  congestion: { p90_taxi_out: "P90 taxi-out time", pct_dep_delayed_15: "Departures delayed 15+ min", nas_delay_share: "Delay share from air system / volume" },
  growth: { pax_growth_yoy: "Passenger growth, 12 mo vs prior", taf_cagr_10y: "FAA forecast growth, 10-yr CAGR" },
  scale: { forecast_added_enplanements: "FAA forecast added enplanements by 2035", ltm_pax: "Passengers (12 mo)" },
};
const CONF_TIP = { high: "No data-quality flags", medium: "One data-quality flag: see details", low: "Two or more data-quality flags: see details" };

function splitMetric(v) { // "81.3% (p81)" -> ["81.3%", 81]
  const m = /^(.*?)\s*\(p(\d+)\)$/.exec(v ?? "");
  return m ? [m[1], Number(m[2])] : [v ?? "n/a", null];
}

function rankDetail(a, sensRow, data) {
  const box = el("div", "rdetail");
  const facts = [`${a.name ?? a.iata}${a.state ? `, ${a.state}` : ""}`, `national rank ${a.national_rank} of ${data.peer_set_size}`];
  if (sensRow) {
    const [lo, hi] = sensRow.rank_range;
    facts.push(lo === hi ? `rank unchanged when weights shift ${data.sensitivity.shift}` : `rank moves ${lo} to ${hi} when weights shift ${data.sensitivity.shift}`);
  }
  box.append(el("p", "rfacts", facts.join(" · ")));
  const t = el("table", "rtable"), hr = el("tr");
  for (const h of ["Component / metric", "Value", "National percentile", "Score × weight = points"]) hr.append(el("th", null, h));
  const thead = el("thead"); thead.append(hr); t.append(thead);
  const tb = el("tbody");
  for (const [id, label] of Object.entries(COMP)) {
    const c = a.components[id];
    const tr = el("tr", "rcomp");
    const name = el("td"); const sw = el("i", `sw c-${id}`); name.append(sw, label);
    tr.append(name, el("td"), el("td"), el("td", "num", c && c.score != null ? `${c.score} × ${c.weight_pct}% = ${c.points}` : "no data (weight re-spread)"));
    tb.append(tr);
    for (const [mid, mlabel] of Object.entries(METRICS[id])) {
      const [val, pct] = splitMetric(a.metrics?.[mid]);
      const mr = el("tr", "rmetric");
      const pc = el("td");
      if (pct != null) { const m = el("span", "pbar"); const f = el("span"); f.style.width = `${pct}%`; m.append(f); pc.append(m, el("span", "num", `p${pct}`)); } else pc.textContent = "n/a";
      mr.append(el("td", null, mlabel), el("td", "num", val), pc, el("td"));
      tb.append(mr);
    }
  }
  const tot = el("tr", "rtotal"); tot.append(el("td", null, "Total"), el("td"), el("td"), el("td", "num", `${a.score} / 100`)); tb.append(tot);
  t.append(tb);
  const w = el("div", "tablewrap"); w.append(t); box.append(w);
  for (const f of a.flags ?? []) box.append(el("p", "rflag", f.replace(/^\[[a-z_]+\]\s*/, "⚠ ")));
  return box;
}

function renderRank(data) {
  const wrap = el("div", "viz");
  wrap.append(el("h4", null, `Score breakdown: ${data.scope}`));
  const w = data.weights_used_pct ?? {};
  wrap.append(el("p", "vizsub", `Each bar is the 0–100 opportunity score, split into the points each component adds (component score × weight). Percentiles compare against ${data.peer_set_size ?? "all"} US airports with 300k+ departing passengers a year. Click a row for the inputs.`));
  const legend = el("div", "legend");
  for (const [id, label] of Object.entries(COMP)) { const s = el("span"); const i = el("i", `c-${id}`); s.append(i, w[id] != null ? `${label} ${w[id]}%` : label); legend.append(s); }
  wrap.append(legend);
  const sens = new Map((data.sensitivity?.rows ?? []).map((r) => [r.iata, r]));
  for (const a of data.ranked) {
    const det = el("details", "rankrow");
    const row = el("summary", "rank");
    row.append(el("span", "num", String(a.rank)));
    const code = el("span", "code", a.iata); code.title = a.name ?? ""; row.append(code);
    const bar = el("div", "bar"); bar.title = `${a.name ?? a.iata}: ${a.score} points`;
    for (const id of Object.keys(COMP)) {
      const c = a.components[id]; if (!c || !c.points) continue;
      const s = el("span", `c-${id}`); s.style.width = `${c.points}%`; s.title = `${COMP[id]}: ${c.points} pts (score ${c.score} × weight ${c.weight_pct}%)`; bar.append(s);
    }
    const conf = el("span", `confchip ${a.confidence}`, a.confidence); conf.title = `Data confidence: ${CONF_TIP[a.confidence] ?? a.confidence}`;
    row.append(bar, el("span", "num score", String(a.score)), conf);
    det.append(row);
    det.addEventListener("toggle", () => { if (det.open && det.children.length === 1) det.append(rankDetail(a, sens.get(a.iata), data)); }, { once: false });
    wrap.append(det);
  }
  const notes = [];
  if (data.sensitivity) notes.push(`Top ${data.sensitivity.top_k} ${data.sensitivity.stable ? "holds" : "does NOT hold (treat neighbouring ranks as ties)"} when each weight shifts ${data.sensitivity.shift}.`);
  if (data.not_scored_in_scope_total) notes.push(`${data.not_scored_in_scope_total} smaller or seasonal airports in scope were not scored (below the traffic floor or incomplete history), not scored low.`);
  for (const n of notes) wrap.append(el("div", "conf", n));
  return wrap;
}

function renderCompare(data) {
  const wrap = el("div", "viz");
  wrap.append(el("h4", null, "Side by side"));
  const rows = [
    ["Passengers, 12 mo", (a) => a.scale.passengers_12mo?.toLocaleString()],
    ["Departures, 12 mo", (a) => a.scale.passenger_departures_12mo?.toLocaleString()],
    ["Load factor", (a) => a.demand.load_factor_pct != null && `${a.demand.load_factor_pct}%`],
    ["Avg taxi-out", (a) => a.congestion && `${a.congestion.avg_taxi_out_min} min`],
    ["P90 taxi-out", (a) => a.congestion && `${a.congestion.p90_taxi_out_min} min`],
    ["Avg departure delay", (a) => a.congestion && `${a.congestion.avg_departure_delay_min} min`],
    ["Departures delayed 15+ min", (a) => a.congestion && `${a.congestion.pct_departures_delayed_15}%`],
    ["Opportunity score", (a) => a.score && String(a.score.total)],
  ];
  const t = el("table"), thead = el("thead"), hr = el("tr"); hr.append(el("th", null, ""));
  for (const a of data.airports) hr.append(el("th", null, a.iata));
  thead.append(hr); t.append(thead);
  const tb = el("tbody");
  for (const [label, get] of rows) { const tr = el("tr"); tr.append(el("td", null, label)); for (const a of data.airports) tr.append(el("td", null, get(a) || "n/a")); tb.append(tr); }
  t.append(tb);
  const w = el("div", "tablewrap"); w.append(t); wrap.append(w);
  return wrap;
}

// "Data used" line: which datasets and which months the numbers in this answer come from.
function provenance(b) {
  if (!b.sources.size && !b.asOf) return null;
  const d = el("details", "prov");
  const a = b.asOf;
  d.append(el("summary", null, a ? `Data: traffic ${a.t100_ltm_window} · on-time ${a.otp_months?.length ?? 0} sampled months · FAA forecast 2025 edition` : "Data sources"));
  const ul = el("ul");
  for (const src of b.sources) ul.append(el("li", null, src));
  if (a?.otp_months?.length) ul.append(el("li", null, `On-time months sampled: ${a.otp_months.join(", ")} (congestion may not reflect every season)`));
  if (a?.taf_edition) ul.append(el("li", null, a.taf_edition));
  d.append(ul);
  return d;
}

// Lead with the answer, set the caveats apart: the first paragraph becomes the takeaway, and the
// "Assumptions and limits" section (heading or bold line, plus what follows it) moves into a quieter callout.
const LIMITS_RE = /^(assumptions|limits|caveats|assumptions (and|&) (limits|caveats))\s*:?$/i;
function shapeAnswer(root) {
  const first = root.firstElementChild;
  if (first?.tagName === "P") {
    first.classList.add("lead");
    const tag = first.firstElementChild; // "Demo answer (scripted, not model output)." label, if present
    if (tag?.tagName === "STRONG" && /^demo answer/i.test(tag.textContent)) { tag.className = "demo-tag"; tag.textContent = "Demo answer, scripted"; }
  }
  const isHead = (n) => /^H[3-6]$/.test(n.tagName) || (n.tagName === "P" && n.childNodes.length === 1 && n.firstChild.nodeName === "STRONG");
  const head = [...root.children].find((n) => isHead(n) && LIMITS_RE.test(n.textContent.trim()));
  if (!head) return;
  const box = el("aside", "limits");
  box.append(el("h5", null, "Assumptions and limits"));
  let n = head.nextElementSibling;
  while (n && !/^H[3-6]$/.test(n.tagName)) { const next = n.nextElementSibling; box.append(n); n = next; }
  head.replaceWith(box);
}

// ---------- conversation ----------
function addUser(text) { $("welcome")?.remove(); stopBackdrop?.(); stopBackdrop = null; const m = el("div", "msg"); m.append(el("div", "user", text)); log.append(m); scrollDown(); }

function addBot() {
  const msg = el("div", "msg"), box = el("div", "bot");
  const answer = el("div", "answer"); answer.append(el("span", "thinking", "Working on it"));
  const trace = el("details", "trace"); trace.hidden = true;
  const sum = el("summary", null, "Tools used"); const list = el("ul"); trace.append(sum, list);
  const viz = el("div"); const foot = el("div", "foot");
  box.append(answer, viz, trace, foot); msg.append(box); log.append(msg); scrollDown();
  return { answer, trace, sum, list, viz, foot, text: "", items: new Map(), tools: 0, started: false, sources: new Set(), asOf: null };
}

function stopSpeaking() { try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } }
function speak(text) {
  if (!$("speak").checked || !window.speechSynthesis) return;
  stopSpeaking();
  const plain = stripMarkdown(text);
  for (const chunk of plain.match(/[^.!?]+[.!?]*\s*/g) ?? [plain]) { // short utterances: long ones get cut off in some browsers
    const u = new SpeechSynthesisUtterance(chunk.trim()); u.lang = "en-US"; window.speechSynthesis.speak(u);
  }
}

async function ask(text) {
  text = text.trim();
  if (!text || busy) return;
  busy = true; sendBtn.disabled = true; stopSpeaking();
  addUser(text); input.value = ""; autosize();
  const b = addBot();
  let timer = 0; // setTimeout, not requestAnimationFrame: rAF stops entirely in background tabs
  const paint = () => { timer = 0; b.answer.innerHTML = renderMarkdown(b.text); shapeAnswer(b.answer); scrollDown(); };

  const handle = (ev) => {
    if (ev.type === "text_delta") { b.text += ev.text; if (!timer) timer = setTimeout(paint, 50); }
    else if (ev.type === "tool_call") {
      b.tools++; b.trace.hidden = false; b.sum.textContent = `Tools used (${b.tools})`;
      const li = el("li"); const st = el("span", "st run", "…"); const code = el("code", null, `${ev.name}(${fmtArgs(ev.input)})`);
      li.append(st, code); b.list.append(li); b.items.set(ev.id, { st, code });
    } else if (ev.type === "tool_result") {
      const it = b.items.get(ev.id);
      if (it) { it.st.className = `st ${ev.ok ? "ok" : "err"}`; it.st.textContent = ev.ok ? `✓ ${ev.ms} ms` : "✗ error"; }
      try {
        const payload = JSON.parse(ev.content);
        if (ev.ok && payload.ok) { for (const src of payload.sources ?? []) b.sources.add(src); b.asOf ??= payload.data_as_of; }
        if (ev.ok && payload.ok && ev.name === "rank_airports" && payload.data.ranked?.length) { b.viz.replaceChildren(renderRank(payload.data)); }
        if (ev.ok && payload.ok && ev.name === "compare_airports") { b.viz.replaceChildren(renderCompare(payload.data)); }
      } catch { /* non-JSON: no chart */ }
    } else if (ev.type === "notice") { b.foot.before(el("div", "notice", ev.message)); }
    else if (ev.type === "done") {
      if (timer) clearTimeout(timer);
      b.text = ev.text || b.text; paint();
      const lim = b.answer.querySelector(".limits"); if (lim) b.viz.after(lim); // answer, then chart, then caveats
      const g = ev.grounding;
      if (g && g.checked) {
        const ok = g.untraced.length === 0;
        const badge = el("span", `badge ${ok ? "good" : "warn"}`, ok ? `All ${g.checked} figures traced to tool output` : `${g.untraced.length} of ${g.checked} figures not traced to tool output`);
        if (!ok) badge.title = `Not traced: ${g.untraced.join(", ")}. These may be derived values (ratios, differences) or errors; check against the tool trace.`;
        b.foot.append(badge);
      }
      const cost = money(ev.estimatedCostUsd);
      const u = ev.usage;
      b.foot.append(el("span", null, `${ev.model}${cost ? ` · ≈${cost}` : ""}${u && (u.input || u.output) ? ` · ${(u.input + u.cacheRead + u.cacheWrite).toLocaleString()} in (${u.cacheRead.toLocaleString()} cached) / ${u.output.toLocaleString()} out` : ""}`));
      const prov = provenance(b);
      if (prov) b.foot.after(prov);
      scrollDown();
      speak(b.text);
    } else if (ev.type === "error") {
      b.answer.replaceChildren(el("span", "error", ev.message));
    }
  };

  try {
    const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId, message: text }) });
    if (!res.ok) { const j = await res.json().catch(() => ({})); b.answer.replaceChildren(el("span", "error", j.error ?? `Request failed (${res.status}).`)); }
    else {
      const reader = res.body.getReader(), dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, idx); buf = buf.slice(idx + 2);
          if (frame.startsWith("data: ")) { try { handle(JSON.parse(frame.slice(6))); } catch { /* ignore malformed frame */ } }
        }
      }
    }
  } catch {
    b.answer.replaceChildren(el("span", "error", "Could not reach the server. Is it still running?"));
  } finally {
    busy = false; sendBtn.disabled = false; input.focus();
  }
}

// ---------- input ----------
function autosize() {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
  input.style.overflowY = input.scrollHeight > 160 ? "auto" : "hidden"; // no scrollbar for one-line input
}
input.addEventListener("input", autosize);
input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
form.addEventListener("submit", (e) => { e.preventDefault(); ask(input.value); });

$("newchat").addEventListener("click", async () => {
  stopSpeaking();
  await fetch("/api/reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId }) }).catch(() => {});
  sessionId = crypto.randomUUID(); try { sessionStorage.setItem("sid", sessionId); } catch { /* ignore */ }
  location.reload();
});

// ---------- voice (progressive enhancement: Chromium/Safari) ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (window.speechSynthesis) $("speakWrap").hidden = false;
if (SR) {
  micBtn.hidden = false;
  const rec = new SR(); rec.lang = "en-US"; rec.interimResults = true; rec.continuous = false;
  let listening = false, finalText = "";
  rec.onresult = (e) => {
    let interim = ""; finalText = "";
    for (const r of e.results) (r.isFinal ? (finalText += r[0].transcript) : (interim += r[0].transcript));
    input.value = (finalText || interim).trim(); autosize();
  };
  rec.onend = () => { listening = false; micBtn.classList.remove("live"); micBtn.setAttribute("aria-pressed", "false"); if (finalText.trim() && !busy) ask(finalText); finalText = ""; };
  rec.onerror = () => { listening = false; micBtn.classList.remove("live"); };
  micBtn.addEventListener("click", () => {
    if (listening) { rec.stop(); return; }
    stopSpeaking(); finalText = ""; listening = true; micBtn.classList.add("live"); micBtn.setAttribute("aria-pressed", "true");
    try { rec.start(); } catch { listening = false; }
  });
}

init();
