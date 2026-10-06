import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AiSettingsDraft } from "../components/ai-provider-settings";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".module.css")) return { format: "commonjs", source: "module.exports = {};", shortCircuit: true };
    return nextLoad(url, context);
  },
});

const draft: AiSettingsDraft = {
  provider: "custom", model: "", apiKeys: {}, clearKeys: [],
  keySet: { openai: false, anthropic: false, gemini: false, xai: false, lmstudio: false, ollama: false },
  keySource: { openai: "none", anthropic: "none", gemini: "none", xai: "none", lmstudio: "none", ollama: "none" },
};

async function render(value: AiSettingsDraft) {
  const { AiProviderSettings } = await import("../components/ai-provider-settings");
  return renderToStaticMarkup(createElement(AiProviderSettings, { value, onChange: () => undefined }));
}

test("custom AI is selectable without inventing a connection, model, endpoint or credential", async () => {
  const html = await render(draft);
  assert.match(html, /value="custom" selected="">Custom provider · IT-managed/);
  assert.match(html, /IT setup required/);
  assert.match(html, /Plooms or another company-approved service/);
  assert.match(html, /Saving this selection does not connect Plooms/);
  assert.match(html, /does not provide live web research/);
  assert.match(html, /SOSA is configured separately/);
  assert.match(html, /name="cc-ai-model-choice"[^>]*disabled/);
  assert.doesNotMatch(html, /type="(?:password|url)"|Cloud provider keys|gpt-5-mini|Loading the IT-approved model list/);
});

test("an installed custom adapter shows its public label but never claims successful connectivity", async () => {
  const html = await render({ ...draft, customProvider: { available: true, label: "Approved company AI" } });
  assert.match(html, /Approved company AI · IT adapter installed/);
  assert.match(html, /not proof of provider availability/);
  assert.match(html, /without switching to another provider/);
  assert.match(html, /Loading the IT-approved model list/);
  assert.doesNotMatch(html, /Add a key below|type="password"/);
});

test("built-in providers remain available and keep their existing key inputs", async () => {
  const html = await render({ ...draft, provider: "openai" });
  assert.match(html, /Cloud provider keys/);
  assert.match(html, /OpenAI API key/);
  assert.match(html, /Anthropic API key/);
  assert.match(html, /option value="custom"/);
});
