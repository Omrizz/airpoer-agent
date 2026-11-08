import { renderMarkdown, stripMarkdown } from "./md.js";

const $ = (id) => document.getElementById(id);
const log = $("log"), form = $("form"), input = $("input"), sendBtn = $("send"), micBtn = $("mic");
const SAMPLES = [
  "Which airports in New England are strong candidates for terminal expansion?",
  "Compare LA and Santa Ana airport congestion levels.",
  "What is the percentage of long haul flights out of Anchorage airport?",
  "What is the unmet flight demand in SFO airport and why?",
];

let sessionId;
try { sessionId = sessionStorage.getItem("sid"); } catch { /* storage may be blocked */ }
if (!sessionId) { sessionId = crypto.randomUUID(); try { sessionStorage.setItem("sid", sessionId); } catch { /* ignore */ } }
let busy = false;

// ---------- helpers ----------
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const scrollDown = () => window.scrollTo({ top: document.body.scrollHeight });
const money = (v) => (v == null ? null : v < 0.01 ? "<$0.01" : `$${v.toFixed(2)}`);
const fmtArgs = (o) => Object.entries(o ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ");
const COMP = { demand_pressure: "Demand pressure", congestion: "Congestion", growth: "Growth outlook", scale: "Size of prize" };

// ---------- banner + chips ----------
async function init() {
  for (const q of SAMPLES) {
    const b = el("button", "chip", q); b.type = "button";
    b.addEventListener("click", () => ask(q));
    $("chips").append(b);
  }
  try {
    const h = await (await fetch("/api/health")).json();
    const banner = $("banner");
    if (h.demo) { banner.textContent = "DEMO MODE: scripted answers built from the real tools, not a language model. Only the four example questions work."; banner.hidden = false; }
    else if (!h.ready) { banner.textContent = "Chat is disabled: no ANTHROPIC_API_KEY found. Put it in .env and restart, or run npm run web:demo."; banner.hidden = false; sendBtn.disabled = true; }
  } catch { /* offline: leave UI usable, errors show on send */ }
}

// ---------- visualisations built from tool results ----------
function renderRank(data) {
  const wrap = el("div", "viz");
  wrap.append(el("h4", null, `Score breakdown: ${data.scope} (points contributed by each component)`));
  const legend = el("div", "legend");
  for (const [id, label] of Object.entries(COMP)) { const s = el("span"); const i = el("i", `c-${id}`); s.append(i, label); legend.append(s); }
  wrap.append(legend);
  for (const a of data.ranked) {
    const row = el("div", "rank");
    row.append(el("span", "num", String(a.rank)));
    const code = el("span", "code", a.iata); code.title = a.name ?? ""; row.append(code);
    const bar = el("div", "bar"); bar.title = `${a.name ?? a.iata} · confidence ${a.confidence}`;
    for (const id of Object.keys(COMP)) {
      const c = a.components[id]; if (!c || !c.points) continue;
      const s = el("span", `c-${id}`); s.style.width = `${c.points}%`; s.title = `${COMP[id]}: ${c.points} pts (score ${c.score}, weight ${c.weight_pct}%)`; bar.append(s);
    }
    row.append(bar, el("span", "num", String(a.score)));
    wrap.append(row);
  }
  if (data.sensitivity) wrap.append(el("div", "conf", `Top ${data.sensitivity.top_k} ${data.sensitivity.stable ? "holds" : "does NOT hold"} when each weight shifts ${data.sensitivity.shift}.`));
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

// ---------- conversation ----------
function addUser(text) { $("welcome")?.remove(); const m = el("div", "msg"); m.append(el("div", "user", text)); log.append(m); scrollDown(); }

function addBot() {
  const msg = el("div", "msg"), box = el("div", "bot");
  const answer = el("div", "answer"); answer.append(el("span", "thinking", "Working on it"));
  const trace = el("details", "trace"); trace.hidden = true;
  const sum = el("summary", null, "Tools used"); const list = el("ul"); trace.append(sum, list);
  const viz = el("div"); const foot = el("div", "foot");
  box.append(answer, viz, trace, foot); msg.append(box); log.append(msg); scrollDown();
  return { answer, trace, sum, list, viz, foot, text: "", items: new Map(), tools: 0, started: false };
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
  const paint = () => { timer = 0; b.answer.innerHTML = renderMarkdown(b.text); scrollDown(); };

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
        if (ev.ok && payload.ok && ev.name === "rank_airports" && payload.data.ranked?.length) { b.viz.replaceChildren(renderRank(payload.data)); }
        if (ev.ok && payload.ok && ev.name === "compare_airports") { b.viz.replaceChildren(renderCompare(payload.data)); }
      } catch { /* non-JSON: no chart */ }
    } else if (ev.type === "notice") { b.foot.before(el("div", "notice", ev.message)); }
    else if (ev.type === "done") {
      if (timer) clearTimeout(timer);
      b.text = ev.text || b.text; paint();
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
