import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import type { AgentEvent, ChatAgent, TurnResult } from "../src/agent/agent.ts";
import { createApp } from "../src/server/server.ts";

// Each test server gets its own port so pooled keep-alive sockets from a previous server are never reused.
let PORT = 20000 + Math.floor(Math.random() * 20000);
let base = `http://localhost:${PORT}`;
const usage = { input: 10, output: 5, cacheRead: 0, cacheWrite: 0 };
const result = (text: string): TurnResult => ({ text, toolCalls: [{ name: "get_methodology", input: {}, ok: true }], grounding: { checked: 2, traced: 2, untraced: [] }, stopReason: "end_turn", usage, iterations: 1 });

class FakeAgent implements ChatAgent {
  readonly model = "claude-opus-5-5";
  gate: Promise<void> | null = null;
  async send(text: string, onEvent: (e: AgentEvent) => void = () => {}) {
    onEvent({ type: "tool_call", id: "t1", name: "get_methodology", input: {} });
    onEvent({ type: "tool_result", id: "t1", name: "get_methodology", ok: true, ms: 3, bytes: 10, content: "{}" });
    await this.gate;
    onEvent({ type: "text_delta", text: `echo: ${text}` });
    return result(`echo: ${text}`);
  }
}

let server: http.Server | undefined;
async function start(opts: Partial<Parameters<typeof createApp>[0]> = {}) {
  PORT += 1; base = `http://localhost:${PORT}`;
  server = createApp({ port: PORT, ...opts });
  await new Promise<void>((r) => server!.listen(PORT, "127.0.0.1", r));
}
afterEach(async () => { if (server) await new Promise((r) => server!.close(r)); server = undefined; });

const post = (path: string, body: unknown, raw = false) =>
  fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: raw ? (body as string) : JSON.stringify(body) });

async function events(res: Response): Promise<any[]> {
  const text = await res.text();
  return text.split("\n\n").filter((f) => f.startsWith("data: ")).map((f) => JSON.parse(f.slice(6)));
}

/** fetch cannot override Host/Origin, so use raw http for the hardening tests. */
const rawGet = (headers: Record<string, string>, p = "/api/health") =>
  new Promise<number>((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port: PORT, path: p, headers }, (res) => { res.resume(); resolve(res.statusCode ?? 0); });
    req.on("error", reject); req.end();
  });

describe("static + health", () => {
  it("serves the page and assets, 404s everything else (no path traversal)", async () => {
    await start();
    expect((await fetch(base + "/")).headers.get("content-type")).toMatch(/text\/html/);
    expect((await fetch(base + "/app.js")).status).toBe(200);
    expect((await fetch(base + "/md.js")).status).toBe(200);
    expect((await fetch(base + "/../package.json")).status).toBe(404);
    expect((await fetch(base + "/%2e%2e/.env")).status).toBe(404);
    expect((await fetch(base + "/nope")).status).toBe(404);
  });
  it("reports readiness and demo mode", async () => {
    await start();
    expect(await (await fetch(base + "/api/health")).json()).toEqual({ ok: true, ready: false, demo: false });
    await afterEachClose();
    await start({ agentFactory: () => new FakeAgent(), demo: true });
    expect(await (await fetch(base + "/api/health")).json()).toEqual({ ok: true, ready: true, demo: true });
  });
});
async function afterEachClose() { if (server) await new Promise((r) => server!.close(r)); server = undefined; }

describe("chat endpoint", () => {
  it("returns a helpful 503 when no key is configured", async () => {
    await start();
    const r = await post("/api/chat", { sessionId: "session-abc123", message: "hi" });
    expect(r.status).toBe(503);
    expect((await r.json()).error).toMatch(/ANTHROPIC_API_KEY/);
  });

  it("streams tool events, text, and a done event with grounding and cost", async () => {
    await start({ agentFactory: () => new FakeAgent() });
    const r = await post("/api/chat", { sessionId: "session-abc123", message: "hello" });
    expect(r.headers.get("content-type")).toMatch(/text\/event-stream/);
    const evs = await events(r);
    expect(evs.map((e) => e.type)).toEqual(["tool_call", "tool_result", "text_delta", "done"]);
    const done = evs.at(-1);
    expect(done.text).toBe("echo: hello");
    expect(done.grounding.checked).toBe(2);
    expect(done.estimatedCostUsd).toBeGreaterThan(0);
    expect(done.model).toBe("claude-opus-5-5");
  });

  it("keeps one agent per session and a fresh one after reset", async () => {
    let created = 0;
    await start({ agentFactory: () => { created++; return new FakeAgent(); } });
    const s = "session-keep-1";
    await (await post("/api/chat", { sessionId: s, message: "a" })).text();
    await (await post("/api/chat", { sessionId: s, message: "b" })).text();
    expect(created).toBe(1);
    await post("/api/reset", { sessionId: s });
    await (await post("/api/chat", { sessionId: s, message: "c" })).text();
    expect(created).toBe(2);
  });

  it("validates input", async () => {
    await start({ agentFactory: () => new FakeAgent() });
    expect((await post("/api/chat", { message: "hi" })).status).toBe(400); // no session
    expect((await post("/api/chat", { sessionId: "bad id!", message: "hi" })).status).toBe(400);
    expect((await post("/api/chat", { sessionId: "session-abc123", message: "   " })).status).toBe(400);
    expect((await post("/api/chat", { sessionId: "session-abc123", message: "x".repeat(2001) })).status).toBe(400);
    expect((await post("/api/chat", "{not json", true)).status).toBe(400);
    expect((await post("/api/chat", JSON.stringify({ sessionId: "session-abc123", message: "x".repeat(20000) }), true)).status).toBe(413);
  });

  it("rejects a second question while the first is still running", async () => {
    const agent = new FakeAgent();
    let release!: () => void;
    agent.gate = new Promise<void>((r) => (release = r));
    await start({ agentFactory: () => agent });
    const first = post("/api/chat", { sessionId: "session-busy-1", message: "slow" });
    await new Promise((r) => setTimeout(r, 100));
    expect((await post("/api/chat", { sessionId: "session-busy-1", message: "again" })).status).toBe(409);
    release();
    expect((await events(await first)).at(-1).type).toBe("done");
  });

  it("turns a billing failure into a clear, non-leaky error event", async () => {
    const agent = new FakeAgent();
    agent.send = async () => { throw Object.assign(new Error("400 {...}"), { apiMessage: "Your credit balance is too low to access the Anthropic API.", status: 400 }); };
    await start({ agentFactory: () => agent });
    const evs = await events(await post("/api/chat", { sessionId: "session-err-1", message: "hi" }));
    expect(evs.at(-1).type).toBe("error");
    expect(evs.at(-1).message).toMatch(/no credit balance/);
    expect(JSON.stringify(evs)).not.toMatch(/sk-ant|req_/);
  });
});

describe("hardening", () => {
  it("refuses unexpected Host headers (DNS rebinding) and cross-origin requests", async () => {
    await start({ agentFactory: () => new FakeAgent() });
    expect(await rawGet({ host: `localhost:${PORT}` })).toBe(200);
    expect(await rawGet({ host: `evil.example:${PORT}` })).toBe(403);
    expect(await rawGet({ host: `localhost:${PORT}`, origin: "https://evil.example" })).toBe(403);
    expect(await rawGet({ host: `localhost:${PORT}`, origin: `http://localhost:${PORT}` })).toBe(200);
  });
});

describe("welcome backdrop data", () => {
  it("serves real airports and routes between them", async () => {
    await start();
    const res = await fetch(base + "/api/backdrop");
    expect(res.status).toBe(200);
    const d = await res.json() as { airports: { iata: string; lat: number; lon: number; pax: number }[]; routes: { a: string; b: string; pax: number }[] };
    expect(d.airports.length).toBeGreaterThan(20);
    expect(d.routes.length).toBeGreaterThan(50);
    const codes = new Set(d.airports.map((a) => a.iata));
    for (const r of d.routes) { expect(codes.has(r.a) && codes.has(r.b)).toBe(true); expect(r.a < r.b).toBe(true); }
    for (const a of d.airports) { expect(a.lat).toBeGreaterThan(24); expect(a.lon).toBeLessThan(-66); }
  }, 60000);
});

describe("welcome method card data", () => {
  it("serves the scoring components, weights summing to 100, and the peer set size", async () => {
    await start();
    const res = await fetch(base + "/api/method");
    expect(res.status).toBe(200);
    const d = await res.json() as { components: { id: string; default_weight_pct: number; metrics: unknown[] }[]; peer_set_size: number; data_as_of: { t100_ltm_window: string } };
    expect(d.components.map((c) => c.id)).toEqual(["demand_pressure", "congestion", "growth", "scale"]);
    expect(d.components.reduce((s, c) => s + c.default_weight_pct, 0)).toBe(100);
    expect(d.peer_set_size).toBeGreaterThan(50);
    expect(d.data_as_of.t100_ltm_window).toMatch(/\d{4}-\d{2} to \d{4}-\d{2}/);
  }, 60000);
});
