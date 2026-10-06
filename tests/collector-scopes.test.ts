import assert from "node:assert/strict";
import test from "node:test";
import { industryCacheScope, mentionsCacheScope } from "../lib/collector-scopes";
import { industryAiCacheKey } from "../lib/industry-ai-cache";

const settings: Parameters<typeof industryCacheScope>[0] = {
  industry: {sources:[],keywords:["gardening"],description:"Local gardening news",excludedTerms:[],dailyLimit:30},
  mentions: {terms:["Example"],websites:[],identityAnchors:["Gardening"],negativeTerms:[],strictMode:true,excludeOwnedSites:true},
  ai: {provider:"none",model:"",localBaseUrls:{lmstudio:"http://127.0.0.1:1234",ollama:"http://127.0.0.1:11434"}},
};

test("AI mention cache changes with the reader's niche but keyless collection does not", () => {
  const other = {...settings,industry:{...settings.industry,description:"Commercial landscape suppliers"}};
  assert.equal(mentionsCacheScope(settings),mentionsCacheScope(other));
  assert.notEqual(mentionsCacheScope({...settings,ai:{...settings.ai,provider:"openai"}}),
    mentionsCacheScope({...other,ai:{...settings.ai,provider:"openai"}}));
});

test("changing the selected local runtime invalidates both saved AI response scopes", () => {
  const local = {...settings,ai:{...settings.ai,provider:"ollama" as const}};
  const changed = {...local,ai:{...local.ai,localBaseUrls:{lmstudio:"http://127.0.0.1:1234",ollama:"http://127.0.0.1:11435"}}};
  assert.notEqual(industryCacheScope(local),industryCacheScope(changed));
  assert.notEqual(mentionsCacheScope(local),mentionsCacheScope(changed));
});

test("custom adapter changes partition response and inference caches without changing built-in providers", () => {
  const custom = { ...settings, ai: { ...settings.ai, provider: "custom" as const } };
  assert.notEqual(industryCacheScope(custom, "adapter-v1"), industryCacheScope(custom, "adapter-v2"));
  assert.notEqual(mentionsCacheScope(custom, "adapter-v1"), mentionsCacheScope(custom, "adapter-v2"));
  assert.equal(industryCacheScope(settings, "adapter-v1"), industryCacheScope(settings, "adapter-v2"));
  const options = { niche: "test", keywords: [], excludedTerms: [], limit: 5, now: 0 };
  assert.notEqual(industryAiCacheKey({ ...custom.ai, customProviderScope: "adapter-v1" }, [], options), industryAiCacheKey({ ...custom.ai, customProviderScope: "adapter-v2" }, [], options));
});
