// Starts the web UI. Usage: npm run web   (real agent, needs ANTHROPIC_API_KEY)  |  npm run web:demo   (scripted, no API)
import { Agent } from "../agent/agent.ts";
import { DemoAgent } from "./demoAgent.ts";
import { createApp } from "./server.ts";

const port = Number(process.env.PORT ?? 3000);
const demo = process.argv.includes("--demo");
const hasKey = !!process.env.ANTHROPIC_API_KEY;

const agentFactory = demo ? () => new DemoAgent() : hasKey ? () => new Agent() : undefined;
const server = createApp({ agentFactory, demo, port });

// Bind to loopback only: this server spends the owner's API credits and has no login.
server.listen(port, "127.0.0.1", () => {
  console.log(`Airport agent UI: http://localhost:${port}${demo ? "  (DEMO MODE: scripted answers, no model)" : ""}`);
  if (!demo && !hasKey) console.log("No ANTHROPIC_API_KEY found: the page will load but chat is disabled. Put the key in .env or use: npm run web:demo");
});
