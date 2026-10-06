import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  loadDemoFixture,
  seedDemoDatabase,
  seedDemoSettings,
} from "./demo-data.mjs";

const cwd = process.cwd();
const fixturePath = path.join(cwd, "fixtures", "executive-demo-workspace.json");
const portArgument = process.argv.find((value) => value.startsWith("--port="));
const port = Number(portArgument?.split("=")[1] || 3100);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("Use a valid TCP port, for example: npm run demo -- --port=3101");
  process.exit(1);
}

const url = `http://127.0.0.1:${port}`;
try {
  await fetch(`${url}/api/health`, {
    cache: "no-store",
    signal: AbortSignal.timeout(1_500),
  });
  console.error(
    `Port ${port} is already in use. Stop that app or run npm run demo -- --port=${port + 1}.`,
  );
  process.exit(1);
} catch {
  // A connection failure is the expected signal that the demo port is free.
}

const dataDirectory = await mkdtemp(
  path.join(os.tmpdir(), "spej-control-center-executive-demo-"),
);
let child;
let requestedSignal;
const stop = (signal) => {
  requestedSignal = signal;
  if (child && child.exitCode === null && child.signalCode === null)
    child.kill(signal);
};
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => stop(signal));
try {
  const workspace = await loadDemoFixture(fixturePath);
  await seedDemoDatabase(dataDirectory, workspace);
  await seedDemoSettings(dataDirectory);
  console.log("\nSPEJ OS EXECUTIVE DEMO — SYNTHETIC DATA ONLY");
  console.log("No customer records, credentials, or normal Control Center data are loaded.");
  console.log("The temporary demo workspace is removed when the app stops.\n");

  child = spawn(
    process.execPath,
    [path.join(cwd, "scripts", "launch.mjs"), `--port=${port}`],
    {
      cwd,
      env: {
        ...process.env,
        CONTROL_CENTER_DATA_DIR: dataDirectory,
        PORT: String(port),
        SPEJ_EXECUTIVE_DEMO: "1",
        SPEJ_RUNTIME: "local-preview",
        OPENAI_API_KEY: "",
        ANTHROPIC_API_KEY: "",
        GEMINI_API_KEY: "",
        GOOGLE_API_KEY: "",
        XAI_API_KEY: "",
        LM_STUDIO_API_KEY: "",
        LM_API_TOKEN: "",
        OLLAMA_LOCAL_API_KEY: "",
      },
      stdio: "inherit",
    },
  );
  if (requestedSignal) child.kill(requestedSignal);
  const result = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  process.exitCode = result.code ?? (result.signal ? 0 : 1);
} finally {
  await rm(dataDirectory, { recursive: true, force: true });
}
