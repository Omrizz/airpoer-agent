// Decorative welcome-screen backdrop: "Prevailing Routes".
// Particles fly the real busiest US routes (last 12 months of T-100), spawned in proportion to
// passengers, along gently curved arcs. Eastbound flights move a little faster than westbound,
// as they do riding the jet stream. Seeded, so every load draws the same network.
// Not a chart: no axes, no values, and it disappears as soon as a question is asked.

const SEED = 1925; // Air Mail Act: the year US commercial air routes began.
const MAX_PARTICLES = 420;
const JET_STREAM = 0.18; // eastbound speed boost / westbound drag

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
function rgba(color, alpha) {
  const ctx = rgba.ctx ??= document.createElement("canvas").getContext("2d");
  ctx.fillStyle = "#000"; ctx.fillStyle = color; // normalises any CSS colour to #rrggbb
  const hex = ctx.fillStyle.replace("#", "");
  const n = parseInt(hex.length === 3 ? hex.replace(/./g, "$&$&") : hex, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export async function startBackdrop(host) {
  let data;
  try {
    const res = await fetch("/api/backdrop");
    if (!res.ok) return null;
    data = await res.json();
  } catch { return null; }
  if (!data.airports?.length || !data.routes?.length || !host.isConnected) return null;

  const canvas = document.createElement("canvas");
  canvas.className = "backdrop"; canvas.setAttribute("aria-hidden", "true");
  host.prepend(canvas);
  const ctx = canvas.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const dark = matchMedia("(prefers-color-scheme: dark)");

  const byCode = new Map(data.airports.map((a) => [a.iata, a]));
  const routes = data.routes.filter((r) => byCode.has(r.a) && byCode.has(r.b));
  const maxPax = Math.max(...data.airports.map((a) => a.pax));
  const totalRoute = routes.reduce((s, r) => s + r.pax, 0);
  const cum = []; routes.reduce((s, r) => (cum.push(s + r.pax / totalRoute), s + r.pax / totalRoute), 0);

  let W = 0, H = 0, project = () => [0, 0], palette = {}, rand = mulberry32(SEED);
  let particles = [], raf = 0, alive = true;

  function layout() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = host.clientWidth; H = host.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Equirectangular with cos(mid-latitude) correction: close enough for the lower 48, and cheap.
    const k = Math.cos((38 * Math.PI) / 180);
    const xs = data.airports.map((a) => a.lon * k), ys = data.airports.map((a) => -a.lat);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const pad = Math.max(24, Math.min(W, H) * 0.08);
    const s = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (y1 - y0));
    const ox = (W - (x1 - x0) * s) / 2, oy = (H - (y1 - y0) * s) / 2;
    project = (lat, lon) => [ox + (lon * k - x0) * s, oy + (-lat - y0) * s];
    for (const r of routes) { // cache geometry per route: endpoints and a curved control point
      const A = byCode.get(r.a), B = byCode.get(r.b);
      const [ax, ay] = project(A.lat, A.lon), [bx, by] = project(B.lat, B.lon);
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
      r.geo = { ax, ay, bx, by, cx: (ax + bx) / 2 - (dy / len) * len * 0.14, cy: (ay + by) / 2 + (dx / len) * len * 0.14, len, eastward: bx > ax };
    }
  }

  function colours() {
    const isDark = dark.matches;
    palette = {
      trail: [css("--c1"), css("--c3"), css("--c4")].map((c) => rgba(c || "#2f6fdd", isDark ? 0.55 : 0.42)),
      hub: rgba(css("--muted") || "#5b6577", isDark ? 0.35 : 0.28),
      arc: rgba(css("--muted") || "#5b6577", isDark ? 0.1 : 0.08),
    };
  }

  const pickRoute = () => { const u = rand(); let i = cum.findIndex((c) => c >= u); return routes[i < 0 ? routes.length - 1 : i]; };
  function spawn(t0 = 0) {
    const r = pickRoute(), forward = rand() < 0.5;
    const east = forward === r.geo.eastward;
    const pxPerSec = 70 * (east ? 1 + JET_STREAM : 1 - JET_STREAM) * (0.85 + rand() * 0.3);
    return { r, forward, t: t0, dt: pxPerSec / r.geo.len, colour: palette.trail[Math.floor(rand() * palette.trail.length)], x: NaN, y: NaN };
  }
  const point = (g, t) => { const u = 1 - t; return [u * u * g.ax + 2 * u * t * g.cx + t * t * g.bx, u * u * g.ay + 2 * u * t * g.cy + t * t * g.by]; };

  function drawHubs() {
    ctx.fillStyle = palette.hub;
    for (const a of data.airports) {
      const [x, y] = project(a.lat, a.lon);
      ctx.beginPath(); ctx.arc(x, y, 1.2 + 4.5 * Math.sqrt(a.pax / maxPax), 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawStatic() { // reduced motion: the network as faint arcs, weighted by traffic
    ctx.clearRect(0, 0, W, H);
    const top = routes[0].pax;
    for (const r of routes) {
      const g = r.geo;
      ctx.strokeStyle = palette.arc.replace(/[\d.]+\)$/, `${(0.06 + 0.3 * Math.sqrt(r.pax / top)).toFixed(3)})`);
      ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(g.ax, g.ay); ctx.quadraticCurveTo(g.cx, g.cy, g.bx, g.by); ctx.stroke();
    }
    drawHubs();
  }

  let last = 0;
  function frame(now) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    // Fade previous frame toward transparent so trails decay without painting a background.
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,0.075)"; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
    ctx.lineWidth = 1.3; ctx.lineCap = "round";
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.t += p.dt * dt;
      if (p.t >= 1) { particles[i] = spawn(); continue; }
      const [x, y] = point(p.r.geo, p.forward ? p.t : 1 - p.t);
      if (!Number.isNaN(p.x)) { ctx.strokeStyle = p.colour; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(x, y); ctx.stroke(); }
      p.x = x; p.y = y;
    }
    if (particles.length < MAX_PARTICLES && rand() < 0.6) particles.push(spawn());
    drawHubs();
    raf = requestAnimationFrame(frame);
  }

  function restart() {
    cancelAnimationFrame(raf); rand = mulberry32(SEED); last = 0;
    layout(); colours();
    particles = Array.from({ length: Math.round(MAX_PARTICLES * 0.6) }, () => spawn(rand()));
    if (reduce.matches) drawStatic(); else { ctx.clearRect(0, 0, W, H); raf = requestAnimationFrame(frame); }
  }

  let resizeTimer = 0;
  const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(restart, 150); };
  const ro = new ResizeObserver(onResize); ro.observe(host);
  reduce.addEventListener("change", restart); dark.addEventListener("change", restart);
  restart();
  requestAnimationFrame(() => canvas.classList.add("on"));

  return function stop() {
    alive = false; cancelAnimationFrame(raf); ro.disconnect();
    reduce.removeEventListener("change", restart); dark.removeEventListener("change", restart);
    canvas.classList.remove("on");
    setTimeout(() => canvas.remove(), 600);
  };
}
