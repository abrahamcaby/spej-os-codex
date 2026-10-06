import { spawn } from "node:child_process";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";

async function availableLoopbackPort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const address = probe.address();
  if (!address || typeof address === "string")
    throw new Error("Could not allocate an isolated smoke-test port.");
  await new Promise((resolve) => probe.close(resolve));
  return address.port;
}

const port = await availableLoopbackPort();
const packageMetadata = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const dataDirectory = await mkdtemp(
  path.join(os.tmpdir(), "control-center-smoke-"),
);
const server = spawn(
  process.execPath,
  [
    path.join("scripts", "launch.mjs"),
    "--no-open",
    `--port=${port}`,
  ],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CONTROL_CENTER_DATA_DIR: dataDirectory,
      PORT: String(port),
      SPEJ_RUNTIME: "local-preview",
      OPENAI_API_KEY: "",
      ANTHROPIC_API_KEY: "",
      GEMINI_API_KEY: "",
      GOOGLE_API_KEY: "",
    },
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  },
);
let output = "";
server.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  output += chunk.toString();
});
const exited = new Promise((resolve) =>
  server.once("exit", (code, signal) => resolve({ code, signal })),
);

async function waitForExit(timeoutMs) {
  let timeout;
  try {
    return await Promise.race([
      exited,
      new Promise((resolve) => {
        timeout = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

async function forceStopServerTree() {
  if (!server.pid) return;
  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const killer = spawn(
        "taskkill",
        ["/pid", String(server.pid), "/T", "/F"],
        { stdio: "ignore", windowsHide: true },
      );
      killer.once("error", resolve);
      killer.once("exit", resolve);
    });
    return;
  }
  try {
    process.kill(-server.pid, "SIGKILL");
  } catch {
    server.kill("SIGKILL");
  }
}

async function stopServerOnce() {
  if (server.exitCode !== null || server.signalCode !== null) return exited;
  if (server.connected) {
    await new Promise((resolve) => {
      server.send({ type: "shutdown" }, (error) => {
        if (error) server.kill("SIGTERM");
        resolve();
      });
    });
  } else {
    server.kill("SIGTERM");
  }
  let result = await waitForExit(10_000);
  if (result) return result;
  await forceStopServerTree();
  result = await waitForExit(5_000);
  if (!result)
    throw new Error(`Could not stop the smoke-test server.\n${output}`);
  return result;
}

let stopPromise;
function stopServer() {
  stopPromise ??= stopServerOnce();
  return stopPromise;
}

let dataCleanupPromise;
function removeDataDirectory() {
  dataCleanupPromise ??= rm(dataDirectory, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 250,
  });
  return dataCleanupPromise;
}

let handlingSignal = false;
async function handleSignal(signal) {
  if (handlingSignal) return;
  handlingSignal = true;
  try {
    await stopServer();
    await removeDataDirectory();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
  process.exit(signal === "SIGINT" ? 130 : 143);
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => void handleSignal(signal));

try {
  const deadline = Date.now() + 30_000;
  let response;
  while (Date.now() < deadline) {
    const result = await Promise.race([
      exited,
      new Promise((resolve) => setTimeout(() => resolve(null), 200)),
    ]);
    if (result)
      throw new Error(
        `Server exited before startup (${result.code ?? result.signal}).\n${output}`,
      );
    try {
      response = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok) break;
    } catch {
      // Keep polling until the startup deadline.
    }
  }
  if (!response?.ok)
    throw new Error(`Health endpoint did not become ready.\n${output}`);
  const health = await response.json();
  if (
    health.service !== "control-center" ||
    health.version !== packageMetadata.version ||
    health.scope !== "local-preview" ||
    health.productionReady !== false
  )
    throw new Error(
      "Health endpoint did not identify itself as a non-production local preview.",
    );
  const home = await fetch(`http://127.0.0.1:${port}/`);
  if (!home.ok || !(await home.text()).includes("Control Center"))
    throw new Error("The dashboard home page did not render.");
  const getJson = async (pathname) => {
    const result = await fetch(`http://127.0.0.1:${port}${pathname}`);
    if (!result.ok)
      throw new Error(`${pathname} returned HTTP ${result.status}.`);
    return result.json();
  };
  const settings = await getJson("/api/settings");
  if (
    settings.general?.workspaceName !== "Spej" ||
    settings.industry?.sources?.length !== 20 ||
    settings.industry?.keywords?.length !== 9 ||
    !settings.industry?.description?.includes("strong Spej content") ||
    settings.industry?.excludedTerms?.length !== 0 ||
    settings.industry?.dailyLimit !== 30 ||
    !settings.mentions?.terms?.includes("Spej") ||
    !settings.mentions?.websites?.includes("spej.ai") ||
    !settings.mentions?.identityAnchors?.includes("Spej") ||
    !["spej-ai", "sagar-pandya", "aby-abraham"].every((id) => settings.mentions?.profiles?.some((profile) => profile.id === id && profile.enabled)) ||
    settings.mentions?.negativeTerms?.length !== 0 ||
    settings.mentions?.excludeOwnedSites !== true ||
    settings.audience?.accounts?.length !== 0 ||
    settings.newsletters?.connected !== false ||
    settings.dailyBrief?.sections?.industry !== 5 ||
    settings.dailyBrief?.sections?.mentions !== 5 ||
    settings.dailyBrief?.sections?.newsletters !== 5 ||
    settings.ai?.provider !== "none" ||
    "apiKeys" in (settings.ai || {})
  ) {
    throw new Error(
      "A fresh install did not expose the expected Spej preset safely.",
    );
  }
  const secretProbe = "smoke-key-must-never-return";
  const saveSecret = await fetch(`http://127.0.0.1:${port}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...settings,
      ai: {
        provider: "openai",
        model: "gpt-5-mini-smoke-probe",
        apiKeys: { openai: secretProbe },
      },
    }),
  });
  if (!saveSecret.ok) throw new Error("The Settings API could not save an optional AI key.");
  const secretReadbackText = await (await fetch(`http://127.0.0.1:${port}/api/settings`)).text();
  const secretReadback = JSON.parse(secretReadbackText);
  if (
    secretReadbackText.includes(secretProbe) ||
    secretReadback.ai?.keySet?.openai !== true ||
    secretReadback.ai?.provider !== "openai" ||
    secretReadback.ai?.model !== "gpt-5-mini-smoke-probe"
  ) throw new Error("The Settings API did not keep the optional AI key server-side.");
  const settingsWithoutAi = structuredClone(secretReadback);
  delete settingsWithoutAi.ai;
  const preserveSecret = await fetch(`http://127.0.0.1:${port}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settingsWithoutAi),
  });
  if (!preserveSecret.ok)
    throw new Error("The Settings API rejected a backward-compatible save without AI fields.");
  const preservedReadbackText = await (await fetch(`http://127.0.0.1:${port}/api/settings`)).text();
  const preservedReadback = JSON.parse(preservedReadbackText);
  if (
    preservedReadbackText.includes(secretProbe) ||
    preservedReadback.ai?.keySet?.openai !== true ||
    preservedReadback.ai?.provider !== "openai" ||
    preservedReadback.ai?.model !== "gpt-5-mini-smoke-probe"
  ) throw new Error("A Settings save without AI fields changed the saved AI configuration.");
  const clearSecret = await fetch(`http://127.0.0.1:${port}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...secretReadback,
      ai: { provider: "none", model: "", clearKeys: ["openai"] },
    }),
  });
  if (!clearSecret.ok) throw new Error("The Settings API could not clear an optional AI key.");
  const clearedReadbackText = await (await fetch(`http://127.0.0.1:${port}/api/settings`)).text();
  const clearedReadback = JSON.parse(clearedReadbackText);
  if (
    clearedReadbackText.includes(secretProbe) ||
    clearedReadback.ai?.keySet?.openai !== false
  ) throw new Error("The Settings API did not clear the optional AI key.");
  const workspace = await getJson("/api/workspace");
  if (
    workspace.initialized !== false ||
    workspace.tasks?.length !== 0 ||
    workspace.reminders?.length !== 0 ||
    workspace.content?.length !== 0 ||
    workspace.accounts?.length !== 0 ||
    workspace.contacts?.length !== 0 ||
    workspace.activities?.length !== 0 ||
    workspace.opportunities?.length !== 0 ||
    workspace.partnerships?.length !== 0 ||
    workspace.campaigns?.length !== 0 ||
    workspace.projects?.length !== 0 ||
    workspace.marketingMetrics?.length !== 0
  ) {
    throw new Error("A fresh install did not start with an empty workspace.");
  }
  const metricWorkspace = {
    ...workspace,
    contacts: [{ id: "smoke-person", name: "Smoke prospect", lifecycleStage: "Lead", leadDate: "2026-08-01" }],
    activities: [{ id: "smoke-activity", summary: "Smoke booking", contactId: "smoke-person", channel: "Email", metricType: "Meeting booked", owner: "Test owner", occurredAt: "2026-08-01" }],
    opportunities: [{ id: "smoke-opp", name: "Smoke AI Office", motion: "AI Office", salesRoute: "Partner-sourced", partnerAccountId: "smoke-partner" }],
    partnerships: [{ id: "smoke-partner-record", name: "Smoke MSP", partnerCategory: "MSP", type: "Referral" }],
    marketingMetrics: [{ id: "smoke-metric", period: "2026-08", metricKey: "linkedin-posts", value: 5, source: "Smoke account" }],
  };
  const savedMetrics = await fetch(`http://127.0.0.1:${port}/api/workspace`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(metricWorkspace) });
  if (!savedMetrics.ok) throw new Error("The GTM metrics workspace could not be saved.");
  const metricReadback = await getJson("/api/workspace");
  if (metricReadback.activities?.[0]?.metricType !== "Meeting booked" || metricReadback.activities?.[0]?.owner !== "Test owner" || metricReadback.contacts?.[0]?.leadDate !== "2026-08-01" || metricReadback.opportunities?.[0]?.salesRoute !== "Partner-sourced" || metricReadback.partnerships?.[0]?.partnerCategory !== "MSP" || metricReadback.marketingMetrics?.[0]?.value !== 5) throw new Error("GTM metrics and sales classifications did not survive API persistence.");
  for (const pathname of [
    "/api/live/industry",
    "/api/live/mentions",
    "/api/live/audience",
    "/api/live/newsletters",
    "/api/brief",
  ]) {
    const live = await getJson(pathname);
    const expectedConfigured = pathname === "/api/live/industry" || pathname === "/api/live/mentions";
    if (pathname !== "/api/brief" && (live.configured !== expectedConfigured || !Array.isArray(live.items)))
      throw new Error(`${pathname} did not start in the expected Spej setup mode.`);
    if (pathname === "/api/brief" &&
        (live.snapshot?.length !== 3 ||
         live.snapshot.find((section) => section.category === "industry")?.configured !== true ||
         live.snapshot.find((section) => section.category === "mentions")?.configured !== true ||
         live.snapshot.find((section) => section.category === "newsletters")?.configured !== false)) {
      throw new Error("A fresh daily brief did not reflect the Spej source preset.");
    }
  }
  const saveBrief = await fetch(`http://127.0.0.1:${port}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...clearedReadback,
      dailyBrief: { ...clearedReadback.dailyBrief, sections: { industry: 3, mentions: 0, newsletters: 2 } },
    }),
  });
  if (!saveBrief.ok) throw new Error("Daily brief preferences could not be saved.");
  const briefReadback = await getJson("/api/brief");
  if (JSON.stringify(briefReadback.snapshot?.map(({ category, requestedCount }) => [category, requestedCount])) !==
      JSON.stringify([["industry", 3], ["newsletters", 2]])) {
    throw new Error("Daily brief preferences did not control the saved snapshot.");
  }
  for (const invalid of [
    { ...clearedReadback, ai: { ...clearedReadback.ai, model: "someone@example.com" } },
    { ...clearedReadback, newsletters: { ...clearedReadback.newsletters, googleClientId: "someone@example.com" } },
  ]) {
    const rejected = await fetch(`http://127.0.0.1:${port}/api/settings`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(invalid),
    });
    if (rejected.status !== 400) throw new Error("Configuration fields accepted an autofilled email address.");
  }
  const blocked = await fetch(`http://127.0.0.1:${port}/api/settings`, {
    headers: { Host: "attacker.example", Origin: "http://attacker.example" },
  });
  if (blocked.status !== 403)
    throw new Error(
      `Foreign Host probe returned HTTP ${blocked.status}, expected 403.`,
    );
  if (server.exitCode !== null || server.signalCode !== null)
    throw new Error(`The launcher exited during smoke verification.\n${output}`);
  console.log(
    "Golden-path launcher smoke passed: local-preview health, false production readiness, home page, Spej preset, empty private workspace, and localhost boundary.",
  );
} finally {
  await stopServer();
  await removeDataDirectory();
}
