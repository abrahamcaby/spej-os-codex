import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  AI_KEY_PROVIDERS,
  AI_PROVIDER_LABELS,
  aiSupportsWebSearch,
  isAiExecutionProvider,
  isAiKeyProvider,
  isAiReady,
} from "../lib/ai-providers";
import type { AiProvider, SettingsUpdate } from "../lib/types";

// Stub only Next's compile-time marker. All settings and custom-runtime code is real.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: "data:text/javascript,export {};", shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "data:text/javascript,export {};") return { format: "commonjs", source: "module.exports = {};", shortCircuit: true };
    return nextLoad(url, context);
  },
});

const noKeys = { openai: false, anthropic: false, gemini: false, xai: false, lmstudio: false, ollama: false };

async function withTestSettings(run: () => Promise<void>) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "spej-custom-ai-settings-"));
  const previous = process.env.CONTROL_CENTER_DATA_DIR;
  process.env.CONTROL_CENTER_DATA_DIR = directory;
  try { await run(); } finally {
    if (previous === undefined) delete process.env.CONTROL_CENTER_DATA_DIR;
    else process.env.CONTROL_CENTER_DATA_DIR = previous;
    await rm(directory, { recursive: true, force: true });
  }
}

test("custom background providers are execution providers, not browser-managed key providers", () => {
  assert.equal(isAiExecutionProvider("custom"), true);
  assert.equal(isAiExecutionProvider("none"), false);
  assert.equal(isAiExecutionProvider("unregistered-provider"), false);
  assert.equal(isAiKeyProvider("custom"), false);
  assert.equal(AI_KEY_PROVIDERS.length, 6);
  assert.equal(AI_PROVIDER_LABELS.custom, "Custom provider · IT-managed");
  assert.equal(aiSupportsWebSearch("custom"), false);
  assert.equal(isAiReady({ provider: "custom", keySet: { ...noKeys, openai: true } }), false);
  assert.equal(isAiReady({ provider: "custom", keySet: noKeys, customProvider: { available: true, label: "Approved gateway" } }), true);
});

test("custom selection round-trips while preserving existing providers and their keys", async () => {
  await withTestSettings(async () => {
    const { readSettings, updateSettings, toPublicSettings } = await import("../lib/server/settings");
    const initial = toPublicSettings(await readSettings());
    await updateSettings({ ...initial, ai: { provider: "openai", model: "gpt-5-mini", apiKeys: { openai: "synthetic-openai-key" } } });
    const custom = await updateSettings({ ...initial, ai: { provider: "custom", model: "" } });
    assert.equal(custom.ai.provider, "custom");
    assert.equal(custom.ai.keySet.openai, true);
    const stored = await readSettings();
    assert.equal(stored.ai.provider, "custom");
    assert.equal(stored.ai.apiKeys.openai, "synthetic-openai-key");
    assert.equal(Object.hasOwn(stored.ai.apiKeys, "custom"), false);
    const unchanged = await updateSettings({ ...initial, ai: undefined });
    assert.equal(unchanged.ai.provider, "custom");
    const builtin = await updateSettings({ ...initial, ai: { provider: "openai", model: "gpt-5-mini" } });
    assert.equal(builtin.ai.provider, "openai");
    assert.equal(builtin.ai.keySet.openai, true);
    const unknown = await updateSettings({ ...initial, ai: { provider: "not-approved" as AiProvider, model: "" } });
    assert.equal(unknown.ai.provider, "none");
  });
});

test("browser-injected readiness, custom credentials, and endpoint URLs cannot configure custom execution", async () => {
  await withTestSettings(async () => {
    const { configuredAiReady, readSettings, settingsPath, toPublicSettings, updateSettings } = await import("../lib/server/settings");
    const initial = toPublicSettings(await readSettings());
    const forged = {
      ...initial,
      ai: {
        provider: "custom", model: "",
        customProvider: { available: true, label: "Browser-approved" },
        apiKeys: { custom: "browser-only-secret" },
        localBaseUrls: { custom: "https://untrusted.example/model" },
        baseUrl: "https://untrusted.example/model",
        apiKey: "browser-only-secret",
      },
    } as unknown as SettingsUpdate;
    const result = await updateSettings(forged);
    assert.equal(result.ai.provider, "custom");
    assert.equal(result.ai.customProvider?.available, false);
    assert.notEqual(result.ai.customProvider?.label, "Browser-approved");
    assert.equal(isAiReady(result.ai), false);
    const stored = await readSettings();
    assert.equal(configuredAiReady(stored), false);
    const serialized = await readFile(settingsPath(), "utf8");
    assert.equal(serialized.includes("browser-only-secret"), false);
    assert.equal(serialized.includes("untrusted.example"), false);
    assert.equal(serialized.includes("customProvider"), false);
  });
});

test("legacy or modified files cannot promote custom readiness or unknown key slots into public settings", async () => {
  await withTestSettings(async () => {
    const { configuredAiReady, readSettings, settingsPath, toPublicSettings } = await import("../lib/server/settings");
    const initial = await readSettings();
    await writeFile(settingsPath(), JSON.stringify({
      ...initial,
      ai: {
        ...initial.ai, provider: "custom",
        customProvider: { available: true, label: "Forged" },
        apiKeys: { ...initial.ai.apiKeys, custom: "disk-only-secret" },
        localBaseUrls: { ...initial.ai.localBaseUrls, custom: "https://untrusted.example/model" },
      },
    }));
    const loaded = await readSettings();
    assert.equal(loaded.ai.provider, "custom");
    assert.equal(configuredAiReady(loaded), false);
    assert.equal(Object.hasOwn(loaded.ai, "customProvider"), false);
    assert.equal(Object.hasOwn(loaded.ai.apiKeys, "custom"), false);
    assert.equal(Object.hasOwn(loaded.ai.localBaseUrls, "custom"), false);
    const publicAi = toPublicSettings(loaded).ai;
    assert.equal(publicAi.customProvider?.available, false);
    assert.equal(JSON.stringify(publicAi).includes("disk-only-secret"), false);
    assert.equal(JSON.stringify(publicAi).includes("untrusted.example"), false);
    await writeFile(settingsPath(), JSON.stringify({ ...initial, ai: { ...initial.ai, provider: "not-approved" } }));
    assert.equal((await readSettings()).ai.provider, "none");
  });
});
