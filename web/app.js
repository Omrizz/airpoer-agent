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
let isDemo = false;
let currentCtl = null;

// ---------- helpers ----------
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const scrollDown = () => window.scrollTo({ top: document.body.scrollHeight });
const money = (v) => (v == null ? null : v < 0.01 ? "<$0.01" : `$${v.toFixed(2)}`);
const fmtArgs = (o) => Object.entries(o ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ");
const TOOL_LABEL = {
  resolve_airports: "Looking up airports", rank_airports: "Ranking airports", compare_airports: "Comparing airports",
  route_mix: "Checking route mix", demand_gap: "Estimating the demand gap", estimate_upside: "Estimating dollar scenarios", live_status: "Checking live FAA status", get_methodology: "Reading the scoring method",
};
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
    isDemo = !!h.demo;
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

function pointsCell(c) {
  const td = el("td", "num");
  if (!c || c.score == null) { td.textContent = "no data (weight re-spread)"; return td; }
  td.append(el("span", "calc", `${c.score} × ${c.weight_pct}% = `), el("b", null, String(c.points)));
  return td;
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
    tr.append(name, el("td"), el("td"), pointsCell(c));
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
    const code = el("span", "code iata", a.iata); code.title = a.name ?? ""; row.append(code);
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
  const n = (v) => (v == null ? null : Number(v));
  const rows = [
    ["Passengers, 12 mo", (a) => n(a.scale?.passengers_12mo), (v) => v.toLocaleString()],
    ["Departures, 12 mo", (a) => n(a.scale?.passenger_departures_12mo), (v) => v.toLocaleString()],
    ["Load factor", (a) => n(a.demand?.load_factor_pct), (v) => `${v}%`],
    ["Avg taxi-out", (a) => n(a.congestion?.avg_taxi_out_min), (v) => `${v} min`],
    ["P90 taxi-out", (a) => n(a.congestion?.p90_taxi_out_min), (v) => `${v} min`],
    ["Avg departure delay", (a) => n(a.congestion?.avg_departure_delay_min), (v) => `${v} min`],
    ["Departures delayed 15+ min", (a) => n(a.congestion?.pct_departures_delayed_15), (v) => `${v}%`],
    ["Opportunity score", (a) => n(a.score?.total), (v) => String(v)],
  ];
  const t = el("table", "cmp"), thead = el("thead"), hr = el("tr"); hr.append(el("th", null, ""));
  for (const a of data.airports) { const th = el("th", "num"); th.append(el("span", "iata", a.iata)); hr.append(th); }
  thead.append(hr); t.append(thead);
  const tb = el("tbody");
  for (const [label, get, fmt] of rows) {
    const vals = data.airports.map(get), known = vals.filter((v) => v != null);
    const top = known.length >= 2 && new Set(known).size > 1 ? Math.max(...known) : null;
    const tr = el("tr"); tr.append(el("td", null, label));
    vals.forEach((v) => tr.append(el("td", `num${top != null && v === top ? " hi" : ""}`, v == null ? "n/a" : fmt(v))));
    tb.append(tr);
  }
  t.append(tb);
  const w = el("div", "tablewrap"); w.append(t); wrap.append(w);
  wrap.append(el("div", "conf", "Bold marks the higher value in each row. Higher is not always better: more taxi-out or delay means more congestion, which raises the opportunity score."));
  return wrap;
}

// Data panel: which datasets and which months the numbers in this answer come from.
function provenance(b) {
  if (!b.sources.size && !b.asOf) return null;
  const a = b.asOf, panel = el("div", "epanel");
  const ul = el("ul");
  for (const src of b.sources) ul.append(el("li", null, src));
  if (a?.otp_months?.length) ul.append(el("li", null, `On-time months sampled: ${a.otp_months.join(", ")} (congestion may not reflect every season)`));
  if (a?.taf_edition) ul.append(el("li", null, a.taf_edition));
  panel.append(ul);
  return { label: a ? `Data: ${a.t100_ltm_window}` : "Data sources", panel };
}

// One row of chips under an answer; each opens its own panel. Tools, grounding and data in one place.
function addChip(b, label, panel, cls = "") {
  const c = el("button", `echip ${cls}`, label); c.type = "button"; c.setAttribute("aria-expanded", "false");
  panel.hidden = true;
  c.addEventListener("click", () => { panel.hidden = !panel.hidden; c.setAttribute("aria-expanded", String(!panel.hidden)); });
  b.foot.append(c); b.panels.append(panel);
  return c;
}

// Mark airport codes the tools returned, so BOS, LAX and SNA read like terminal signage wherever they appear.
function markCodes(root, codes) {
  if (!codes.size) return;
  const list = [...codes].join("|"), has = new RegExp(`\\b(${list})\\b`), all = new RegExp(`\\b(${list})\\b`, "g");
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement.closest("code, pre, .iata") || !has.test(n.nodeValue) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    const frag = document.createDocumentFragment(); let last = 0; const text = n.nodeValue;
    text.replace(all, (m, _c, off) => { frag.append(text.slice(last, off), el("span", "iata inline", m)); last = off + m.length; return m; });
    frag.append(text.slice(last)); n.replaceWith(frag);
  }
}

// Suggested next questions, built from what the tools just returned (real-agent mode only: demo mode cannot take follow-ups).
function followUps(b) {
  const out = [];
  for (const r of [...b.results].reverse()) {
    const d = r.data, ap = r.input?.airport;
    if (r.name === "rank_airports" && d?.ranked?.length >= 2) {
      const [x, y] = d.ranked;
      out.push(`Why does ${x.iata} rank above ${y.iata}?`, "Re-rank with congestion weighted more heavily");
      if (d.sensitivity && !d.sensitivity.stable) out.push("Which of these ranks are too close to call?");
      else if (d.not_scored_in_scope_total) out.push("Which airports in this region were not scored, and why?");
    } else if (r.name === "compare_airports" && d?.airports?.length >= 2) {
      const [x, y] = d.airports.map((a) => a.iata);
      out.push(`Which of ${x} and ${y} has the stronger case for terminal expansion?`, `What is the unmet demand at ${x}?`);
    } else if (r.name === "route_mix" && ap) {
      out.push(`How does the long-haul share at ${ap} change if long-haul means 2,000+ miles?`, `Is ${ap} a strong candidate for terminal expansion?`);
    } else if (r.name === "demand_gap" && ap) {
      out.push(`Is the terminal likely the binding constraint at ${ap}?`, `How does ${ap} rank nationally for expansion potential?`);
    } else continue;
    break;
  }
  return out.slice(0, 3);
}

// Lead with the answer, set the caveats apart: the first paragraph becomes the takeaway, and the
// "Assumptions and limits" section (heading or bold line, plus what follows it) moves into a quieter callout.
const LIMITS_RE = /^(assumptions|limits|caveats|assumptions (and|&) (limits|caveats))\s*:?$/i;
function shapeAnswer(root, codes) {
  const first = root.firstElementChild;
  if (first?.tagName === "P") {
    first.classList.add("lead");
    const tag = first.firstElementChild; // "Demo answer (scripted, not model output)." label, if present
    if (tag?.tagName === "STRONG" && /^demo answer/i.test(tag.textContent)) { tag.className = "demo-tag"; tag.textContent = "Demo answer, scripted"; }
  }
  const isHead = (n) => /^H[3-6]$/.test(n.tagName) || (n.tagName === "P" && n.childNodes.length === 1 && n.firstChild.nodeName === "STRONG");
  const head = [...root.children].find((n) => isHead(n) && LIMITS_RE.test(n.textContent.trim()));
  if (!head) { markCodes(root, codes); return; }
  const box = el("aside", "limits");
  box.append(el("h5", null, "Assumptions and limits"));
  let n = head.nextElementSibling;
  while (n && !isHead(n)) { const next = n.nextElementSibling; box.append(n); n = next; }
  head.replaceWith(box);
  markCodes(root, codes);
}

// ---------- conversation ----------
function addUser(text) { $("welcome")?.remove(); stopBackdrop?.(); stopBackdrop = null; const m = el("div", "msg"); m.append(el("div", "user", text)); log.append(m); scrollDown(); }

function addBot() {
  const msg = el("div", "msg"), box = el("div", "bot");
  const answer = el("div", "answer");
  const live = el("div", "live thinking", "Working on it");
  const toolsPanel = el("div", "epanel"); const list = el("ul"); toolsPanel.append(list);
  const viz = el("div"); const foot = el("div", "foot"); const panels = el("div", "panels");
  box.append(answer, viz, live, foot, panels); msg.append(box); log.append(msg); scrollDown();
  return { msg, answer, live, toolsPanel, list, viz, foot, panels, text: "", items: new Map(), running: new Map(), tools: 0, sources: new Set(), asOf: null, codes: new Set(), results: [], calls: new Map() };
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
  busy = true; stopSpeaking();
  currentCtl = new AbortController();
  sendBtn.textContent = "Stop"; sendBtn.classList.add("stop"); sendBtn.setAttribute("aria-label", "Stop answering");
  document.querySelectorAll(".followups").forEach((f) => f.remove());
  addUser(text); input.value = ""; autosize();
  const b = addBot();
  let timer = 0; // setTimeout, not requestAnimationFrame: rAF stops entirely in background tabs
  const paint = () => { timer = 0; b.answer.innerHTML = renderMarkdown(b.text); shapeAnswer(b.answer, b.codes); scrollDown(); };

  const handle = (ev) => {
    if (ev.type === "text_delta") { b.text += ev.text; if (!timer) timer = setTimeout(paint, 50); }
    else if (ev.type === "tool_call") {
      b.tools++; b.calls.set(ev.id, ev);
      const ap = ev.input?.airport; if (typeof ap === "string" && /^[A-Z]{3}$/.test(ap)) b.codes.add(ap);
      for (const x of ev.input?.airports ?? []) if (/^[A-Z]{3}$/.test(x)) b.codes.add(x);
      const li = el("li"); const st = el("span", "st run", "…"); const code = el("code", null, `${ev.name}(${fmtArgs(ev.input)})`);
      li.append(st, code); b.list.append(li); b.items.set(ev.id, { st, code });
      b.running.set(ev.id, TOOL_LABEL[ev.name] ?? ev.name); b.live.textContent = `${[...new Set(b.running.values())].join(", ")}`;
    } else if (ev.type === "tool_result") {
      const it = b.items.get(ev.id);
      if (it) { it.st.className = `st ${ev.ok ? "ok" : "err"}`; it.st.textContent = ev.ok ? `✓ ${ev.ms} ms` : "✗ error"; }
      b.running.delete(ev.id); b.live.textContent = b.running.size ? [...new Set(b.running.values())].join(", ") : "Writing the answer";
      try {
        const payload = JSON.parse(ev.content);
        if (ev.ok && payload.ok) {
          for (const src of payload.sources ?? []) b.sources.add(src); b.asOf ??= payload.data_as_of;
          b.results.push({ name: ev.name, input: b.calls.get(ev.id)?.input, data: payload.data });
          for (const r of payload.data?.ranked ?? []) if (r.iata) b.codes.add(r.iata);
          for (const r of payload.data?.airports ?? []) if (r.iata) b.codes.add(r.iata);
        }
        if (ev.ok && payload.ok && ev.name === "rank_airports" && payload.data.ranked?.length) { b.viz.replaceChildren(renderRank(payload.data)); }
        if (ev.ok && payload.ok && ev.name === "compare_airports") { b.viz.replaceChildren(renderCompare(payload.data)); }
      } catch { /* non-JSON: no chart */ }
    } else if (ev.type === "notice") { b.live.before(el("div", "notice", ev.message)); }
    else if (ev.type === "done") {
      if (timer) clearTimeout(timer);
      b.text = ev.text || b.text; paint();
      const lim = b.answer.querySelector(".limits"); if (lim) b.viz.after(lim); // answer, then chart, then caveats
      b.live.remove();
      if (b.tools) addChip(b, `Tools used (${b.tools})`, b.toolsPanel);
      const g = ev.grounding;
      if (g && g.checked) {
        const ok = g.untraced.length === 0;
        const panel = el("div", "epanel");
        panel.textContent = ok
          ? `All ${g.checked} figures in this answer were found in the tools' raw output.`
          : `Not found in tool output: ${g.untraced.join(", ")}. These may be derived values (ratios, differences) or mistakes; check them against the tools used.`;
        addChip(b, ok ? `All ${g.checked} figures traced to tool output` : `${g.untraced.length} of ${g.checked} figures not traced to tool output`, panel, ok ? "good" : "warn");
      }
      const prov = provenance(b);
      if (prov) addChip(b, prov.label, prov.panel);
      const cost = money(ev.estimatedCostUsd);
      const u = ev.usage;
      b.foot.append(el("span", "meta", `${ev.model}${cost ? ` · ≈${cost}` : ""}${u && (u.input || u.output) ? ` · ${(u.input + u.cacheRead + u.cacheWrite).toLocaleString()} in (${u.cacheRead.toLocaleString()} cached) / ${u.output.toLocaleString()} out` : ""}`));
      const next = isDemo ? [] : followUps(b);
      if (next.length) {
        const f = el("div", "followups"); f.append(el("span", "fhead", "Ask next"));
        for (const q of next) { const c = el("button", "fchip", q); c.type = "button"; c.addEventListener("click", () => ask(q)); f.append(c); }
        b.msg.append(f);
      }
      scrollDown();
      speak(b.text);
    } else if (ev.type === "error") {
      b.live.remove(); b.answer.replaceChildren(el("span", "error", ev.message));
    }
  };

  try {
    const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId, message: text }), signal: currentCtl.signal });
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
    if (currentCtl.signal.aborted) {
      if (timer) clearTimeout(timer);
      b.live.remove();
      if (b.text) { paint(); b.msg.querySelector(".bot").append(el("div", "notice", "Stopped before finishing. This answer may be incomplete.")); }
      else b.answer.replaceChildren(el("span", "notice", "Stopped."));
    } else { b.live.remove(); b.answer.replaceChildren(el("span", "error", "Could not reach the server. Is it still running?")); }
  } finally {
    busy = false; currentCtl = null; sendBtn.textContent = "Send"; sendBtn.classList.remove("stop"); sendBtn.removeAttribute("aria-label"); input.focus();
  }
}

// ---------- input ----------
function autosize() {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
  input.style.overflowY = input.scrollHeight > 160 ? "auto" : "hidden"; // no scrollbar for one-line input
}
input.addEventListener("input", autosize);
input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!busy) form.requestSubmit(); } });
// The Send button doubles as Stop while an answer is running. Handled on click, before the form's required-field check blocks an empty box.
sendBtn.addEventListener("click", (e) => { if (busy) { e.preventDefault(); currentCtl?.abort(); } });
form.addEventListener("submit", (e) => { e.preventDefault(); if (!busy) ask(input.value); });

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
