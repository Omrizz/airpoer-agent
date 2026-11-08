import { readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentEvent, ChatAgent } from "../agent/agent.ts";
import { estimateCost } from "../agent/cost.ts";

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web");
const STATIC: Record<string, { file: string; type: string }> = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/style.css": { file: "style.css", type: "text/css; charset=utf-8" },
  "/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" },
  "/md.js": { file: "md.js", type: "text/javascript; charset=utf-8" },
};

const MAX_BODY = 16 * 1024;
const MAX_MESSAGE = 2000;
const MAX_SESSIONS = 50;
const SESSION_TTL_MS = 60 * 60 * 1000;

export interface AppOptions {
  /** Creates a fresh agent per chat session. Omit to run without a key (chat returns a helpful 503). */
  agentFactory?: () => ChatAgent;
  /** Shown to the user so scripted demo answers are never mistaken for model output. */
  demo?: boolean;
  /** Port this server will listen on; used to validate the Host header. */
  port: number;
}

interface Session { agent: ChatAgent; busy: boolean; last: number }

const json = (res: http.ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
};

const MAX_DRAIN = 1024 * 1024;

async function readBody(req: http.IncomingMessage): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > MAX_DRAIN) { req.destroy(); throw Object.assign(new Error("Request too large."), { status: 413 }); }
    if (size <= MAX_BODY) chunks.push(c as Buffer); // beyond the limit we keep reading (and discard) so the client gets a clean 413, not a reset
  }
  if (size > MAX_BODY) throw Object.assign(new Error("Request too large."), { status: 413 });
  return Buffer.concat(chunks).toString("utf8");
}

export function createApp(opts: AppOptions): http.Server {
  const sessions = new Map<string, Session>();
  const allowedHosts = new Set([`localhost:${opts.port}`, `127.0.0.1:${opts.port}`, `[::1]:${opts.port}`]);

  const sweep = () => {
    const now = Date.now();
    for (const [id, s] of sessions) if (!s.busy && now - s.last > SESSION_TTL_MS) sessions.delete(id);
  };

  const server = http.createServer(async (req, res) => {
    try {
      // The endpoint spends the user's API credits: accept only same-origin browser traffic on localhost.
      if (!allowedHosts.has(req.headers.host ?? "")) return json(res, 403, { error: "Forbidden host." });
      const origin = req.headers.origin;
      if (origin && !allowedHosts.has(new URL(origin).host)) return json(res, 403, { error: "Forbidden origin." });

      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

      if (req.method === "GET" && STATIC[url.pathname]) {
        const s = STATIC[url.pathname]!;
        const body = await readFile(path.join(WEB_ROOT, s.file));
        res.writeHead(200, { "content-type": s.type, "cache-control": "no-cache", "x-content-type-options": "nosniff" });
        return void res.end(body);
      }

      if (req.method === "GET" && url.pathname === "/api/health") {
        return json(res, 200, { ok: true, ready: !!opts.agentFactory, demo: !!opts.demo });
      }

      if (req.method === "POST" && url.pathname === "/api/reset") {
        const { sessionId } = JSON.parse((await readBody(req)) || "{}") as { sessionId?: string };
        if (sessionId) sessions.delete(sessionId);
        return json(res, 200, { ok: true });
      }

      if (req.method === "POST" && url.pathname === "/api/chat") {
        if (!opts.agentFactory) {
          return json(res, 503, { error: "No ANTHROPIC_API_KEY is configured. Add it to .env (see .env.example) and restart, or run the demo mode." });
        }
        let payload: { sessionId?: unknown; message?: unknown };
        try { payload = JSON.parse(await readBody(req)); } catch (e) {
          return json(res, (e as { status?: number }).status ?? 400, { error: (e as Error).message.includes("large") ? "Request too large." : "Body must be JSON." });
        }
        const message = typeof payload.message === "string" ? payload.message.trim() : "";
        const sessionId = typeof payload.sessionId === "string" && /^[\w-]{8,64}$/.test(payload.sessionId) ? payload.sessionId : null;
        if (!sessionId) return json(res, 400, { error: "Missing or invalid sessionId." });
        if (!message) return json(res, 400, { error: "Message is empty." });
        if (message.length > MAX_MESSAGE) return json(res, 400, { error: `Message is longer than ${MAX_MESSAGE} characters.` });

        sweep();
        let session = sessions.get(sessionId);
        if (!session) {
          if (sessions.size >= MAX_SESSIONS) return json(res, 503, { error: "Too many active sessions. Try again later." });
          session = { agent: opts.agentFactory(), busy: false, last: Date.now() };
          sessions.set(sessionId, session);
        }
        if (session.busy) return json(res, 409, { error: "The previous question is still being answered." });
        session.busy = true;

        res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" });
        let open = true;
        res.on("close", () => { open = false; });
        const send = (ev: Record<string, unknown>) => { if (open) res.write(`data: ${JSON.stringify(ev)}\n\n`); };

        try {
          const r = await session.agent.send(message, (e: AgentEvent) => send(e as unknown as Record<string, unknown>));
          const cost = estimateCost(session.agent.model, r.usage);
          send({
            type: "done",
            text: r.text,
            toolCalls: r.toolCalls.map((c) => c.name),
            grounding: r.grounding,
            usage: r.usage,
            model: session.agent.model,
            estimatedCostUsd: cost,
            iterations: r.iterations,
          });
        } catch (e) {
          const err = e as { apiMessage?: string; status?: number; message?: string };
          const billing = /credit balance/i.test(err.apiMessage ?? err.message ?? "");
          send({
            type: "error",
            message: billing
              ? "The Anthropic account behind this API key has no credit balance. Add credits under Plans & Billing in the Anthropic console."
              : err.status === 401
                ? "The API key was rejected. Check ANTHROPIC_API_KEY in .env."
                : err.status === 429
                  ? "Rate limited by the API. Wait a moment and try again."
                  : "Something went wrong while answering. Try again, or reset the chat.",
          });
          console.error("[chat error]", err.apiMessage ?? err.message ?? e);
        } finally {
          session.busy = false;
          session.last = Date.now();
          res.end();
        }
        return;
      }

      json(res, 404, { error: "Not found." });
    } catch (e) {
      if (!res.headersSent) json(res, (e as { status?: number }).status ?? 500, { error: "Server error." });
      else res.end();
    }
  });
  return server;
}
