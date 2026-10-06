import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import type { StoredSettings } from "../lib/server/settings";

// Replace only the trusted registration module inside this isolated test process.
// No production registration or provider account is modified.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: "data:text/javascript,server-only-stub", shortCircuit: true };
    if (specifier === "./custom-background-ai-host") return { url: "data:text/javascript,custom-test-host", shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "data:text/javascript,server-only-stub") return { format: "commonjs", source: "module.exports = {};", shortCircuit: true };
    if (url === "data:text/javascript,custom-test-host") return {
      format: "commonjs", shortCircuit: true,
      source: `module.exports = { getCustomBackgroundAiAdapter: () => ({
        id: "test-company", revision: "v1", label: "Company test adapter",
        models: [{id:"company-model",label:"Approved model"}], defaultModel: "company-model",
        generate: async (input) => ({model:input.model,finishReason:"complete",text:JSON.stringify({
          fields:Object.keys(input).sort(),prompt:input.prompt,budget:input.maxOutputTokens,cancellable:input.signal instanceof AbortSignal
        })})
      }) };`,
    };
    return nextLoad(url, context);
  },
});

const settings: StoredSettings = {
  general: { workspaceName: "Synthetic routing test" },
  industry: { sources: [], keywords: [], description: "", excludedTerms: [], dailyLimit: 30 },
  mentions: { terms: [], websites: [], identityAnchors: [], negativeTerms: [], strictMode: true, excludeOwnedSites: true },
  newsletters: { googleClientId: "", googleClientSecret: "", connectedEmail: "", refreshToken: "", accessToken: "", accessTokenExpiresAt: 0, gmailQuery: "" },
  audience: { accounts: [] },
  ai: { provider: "custom", model: "", apiKeys: { openai: "test-only-unused-key", anthropic: "", gemini: "", xai: "", lmstudio: "", ollama: "" }, localBaseUrls: { lmstudio: "http://127.0.0.1:1234", ollama: "http://127.0.0.1:11434" } },
  dailyBrief: { sourceLabels: [], lookbackDays: 7, sections: { industry: 5, mentions: 5, newsletters: 5 } },
};

test("configured AI dispatches custom requests only to the host adapter with minimized arguments", async () => {
  const { runConfiguredAi } = await import("../lib/server/ai");
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("No direct provider call permitted in this test."); };
  try {
    const result = await runConfiguredAi(settings, { prompt: "Rank these synthetic headlines", maxOutputTokens: 1200 });
    assert.equal(result.provider, "custom");
    assert.equal(result.model, "company-model");
    assert.deepEqual(JSON.parse(result.text), { fields: ["maxOutputTokens", "model", "prompt", "signal"], prompt: "Rank these synthetic headlines", budget: 1200, cancellable: true });
    await assert.rejects(runConfiguredAi(settings, { prompt: "Research", webSearch: true }), /does not support live web research/);
    await assert.rejects(runConfiguredAi({ ...settings, ai: { ...settings.ai, model: "unapproved-model" } }, { prompt: "Rank" }), /approved/);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});

test("custom model discovery is host-owned and rejects browser destinations or credentials", async () => {
  const { discoverAiModels } = await import("../lib/server/ai-models");
  const { toPublicSettings, configuredAiReady } = await import("../lib/server/settings");
  const result = await discoverAiModels(settings);
  assert.equal(result.provider, "custom");
  assert.deepEqual(result.models, [{ id: "company-model", label: "Approved model" }]);
  assert.equal(configuredAiReady(settings), true);
  assert.deepEqual(toPublicSettings(settings).ai.customProvider, { available: true, label: "Company test adapter" });
  assert.doesNotMatch(JSON.stringify(result), /test-only-unused-key/);
  await assert.rejects(discoverAiModels(settings, { apiKey: "not-accepted" }), /configured by IT/);
  await assert.rejects(discoverAiModels(settings, { baseUrl: "https://not-accepted.example" }), /configured by IT/);
});
