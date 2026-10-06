import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { loadDemoFixture, seedDemoDatabase, seedDemoSettings } from "./demo-data.mjs";

// Isolated synthetic runtime. Never falls back to the user's normal database.
const cwd = process.cwd();
const portArg = process.argv.find((arg) => arg.startsWith("--port="));
const port = Number(portArg?.split("=")[1] || 3102);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Choose a port from 1024 to 65535.");
const directory = await mkdtemp(path.join(os.tmpdir(), "spej-company-demo-"));
let child;
let stopping = false;
const stop = () => { stopping = true; child?.kill("SIGTERM"); };
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
try {
  await seedDemoDatabase(directory, await loadDemoFixture(path.join(cwd, "fixtures/executive-demo-workspace.json")));
  await seedDemoSettings(directory);
  const dev = process.argv.includes("--dev");
  console.log(`Spej OS company planning preview: http://127.0.0.1:${port}/?tab=today`);
  console.log("Synthetic company records only. Personal planning stays in this browser. No Microsoft or Plooms connection.");
  child = spawn(process.execPath, [path.join(cwd, "node_modules/next/dist/bin/next"), dev ? "dev" : "start", ...(dev ? ["--webpack"] : []), "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd, stdio: "inherit", env: {
      ...process.env, CONTROL_CENTER_DATA_DIR: directory, SPEJ_EXECUTIVE_DEMO: "1", SPEJ_RUNTIME: "local-preview",
      ...(dev ? { SPEJ_PREVIEW_BUILD: "1" } : { SPEJ_PREVIEW_BUILD: "0" }),
      OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "", GEMINI_API_KEY: "", GOOGLE_API_KEY: "", XAI_API_KEY: "", LM_STUDIO_API_KEY: "", LM_API_TOKEN: "", OLLAMA_LOCAL_API_KEY: "",
    },
  });
  if (stopping) child.kill("SIGTERM");
  const result = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", (code) => resolve(code)); });
  process.exitCode = typeof result === "number" ? result : 0;
} finally {
  await rm(directory, { recursive: true, force: true });
}
