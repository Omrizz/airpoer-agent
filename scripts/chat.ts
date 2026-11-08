// Terminal chat with the agent. Usage: npm run chat   (reads ANTHROPIC_API_KEY from .env)
import readline from "node:readline/promises";
import { Agent, type AgentEvent } from "../src/agent/agent.ts";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set. Put it in .env (see .env.example) and run: npm run chat");
  process.exit(1);
}

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
let agent = new Agent();
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
console.log("Airport Investment Intelligence Agent. Ask a question, /reset to start over, /exit to quit.\n");

const show = (e: AgentEvent) => {
  if (e.type === "text_delta") process.stdout.write(e.text);
  else if (e.type === "tool_call") console.log(dim(`\n  -> ${e.name}(${JSON.stringify(e.input)})`));
  else if (e.type === "tool_result") console.log(dim(`  <- ${e.name} ${e.ok ? "ok" : "ERROR"} (${e.ms} ms, ${(e.bytes / 1024).toFixed(1)} KB)`));
  else if (e.type === "notice") console.log(dim(`  [${e.message}]`));
};

for (;;) {
  const q = (await rl.question("\nyou> ")).trim();
  if (!q) continue;
  if (q === "/exit") break;
  if (q === "/reset") { agent = new Agent(); console.log("(conversation cleared)"); continue; }
  try {
    process.stdout.write("\nagent> ");
    const r = await agent.send(q, show);
    console.log();
    if (r.grounding.untraced.length) console.log(dim(`  [${r.grounding.untraced.length} figure(s) not traced to tool output: ${r.grounding.untraced.join(", ")}]`));
  } catch (e) {
    console.error(`\nError: ${e instanceof Error ? e.message : String(e)}`);
  }
}
rl.close();
