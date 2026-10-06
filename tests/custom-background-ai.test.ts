import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import type { CustomBackgroundAiAdapter, CustomBackgroundAiOutput } from "../lib/server/custom-background-ai";

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

function adapter(overrides: Partial<CustomBackgroundAiAdapter> = {}): CustomBackgroundAiAdapter {
  return {
    id: "test-company", revision: "1", label: "Example company provider",
    models: [{ id: "approved-small", label: "Approved small" }, { id: "approved-large", label: "Approved large" }],
    defaultModel: "approved-small",
    async generate({ model }) { return { model, text: '{"stories":[]}', finishReason: "complete" }; },
    ...overrides,
  };
}

test("the shipped host has no custom adapter, models, or inference fallback", async () => {
  const api = await import("../lib/server/custom-background-ai");
  assert.deepEqual(api.getCustomBackgroundAiStatus(), { available: false, label: "Custom company provider" });
  assert.equal(api.customBackgroundAiCacheScope(), "custom:unavailable");
  await assert.rejects(api.discoverCustomBackgroundAiModels(), /not configured/);
  await assert.rejects(api.runCustomBackgroundAi({ prompt: "Summarize" }), /not configured/);
});

test("model discovery publishes only approved metadata without invoking generation", async () => {
  const { createCustomBackgroundAiRuntime } = await import("../lib/server/custom-background-ai");
  let calls = 0;
  const runtime = createCustomBackgroundAiRuntime(adapter({ generate: async () => { calls++; throw new Error("not expected"); } }));
  assert.deepEqual(runtime.status(), { available: true, label: "Example company provider" });
  const result = await runtime.models();
  assert.equal(result.provider, "custom");
  assert.equal(result.defaultModel, "approved-small");
  assert.equal(result.cached, false);
  assert.equal(result.localOnly, false);
  assert.equal(result.models.length, 2);
  assert.ok(Number.isFinite(Date.parse(result.checkedAt)));
  assert.deepEqual(Object.keys(result.models[0]), ["id", "label"]);
  result.models[0].id = "unapproved";
  assert.equal((await runtime.models()).models[0].id, "approved-small");
  assert.equal(calls, 0);
});

test("custom generation uses the approved default and passes a bounded output budget and abort signal", async () => {
  const { createCustomBackgroundAiRuntime } = await import("../lib/server/custom-background-ai");
  const runtime = createCustomBackgroundAiRuntime(adapter({
    async generate(input) {
      assert.equal(input.model, "approved-small");
      assert.equal(input.prompt, "Rank collected material");
      assert.equal(input.maxOutputTokens, 4_000);
      assert.equal(input.signal.aborted, false);
      assert.ok(Object.isFrozen(input));
      assert.deepEqual(Object.keys(input).sort(), ["maxOutputTokens", "model", "prompt", "signal"]);
      return { model: input.model, text: '  {"stories":[]}  ', finishReason: "complete" };
    },
  }));
  assert.deepEqual(await runtime.run({ prompt: "Rank collected material", model: "default" }), {
    provider: "custom", model: "approved-small", text: '{"stories":[]}',
  });
});

test("explicit approved custom model and token budget are respected", async () => {
  const { createCustomBackgroundAiRuntime } = await import("../lib/server/custom-background-ai");
  const runtime = createCustomBackgroundAiRuntime(adapter({
    async generate(input) {
      assert.equal(input.model, "approved-large");
      assert.equal(input.maxOutputTokens, 512);
      return { model: input.model, text: "Complete", finishReason: "complete" };
    },
  }));
  assert.equal((await runtime.run({ prompt: "Summarize", model: "approved-large", maxOutputTokens: 512 })).model, "approved-large");
});

test("web research, arbitrary models, malformed prompts, and unsafe budgets fail before adapter invocation", async () => {
  const { createCustomBackgroundAiRuntime } = await import("../lib/server/custom-background-ai");
  let calls = 0;
  const runtime = createCustomBackgroundAiRuntime(adapter({ generate: async () => { calls++; throw new Error("not expected"); } }));
  const invalidInputs = [
    { prompt: "Summarize", webSearch: true },
    { prompt: "Summarize", webSearch: "true" as unknown as boolean },
    { prompt: "Summarize", model: "unapproved" },
    { prompt: "Summarize", model: "https://attacker.invalid/model" },
    { prompt: "" }, { prompt: "  " }, { prompt: "has\0null" }, { prompt: "a".repeat(200_001) },
    { prompt: 5 as unknown as string },
    ...[0, -1, 8_001, Infinity, NaN, 1.5].map((maxOutputTokens) => ({ prompt: "Summarize", maxOutputTokens })),
  ];
  for (const input of invalidInputs) await assert.rejects(runtime.run(input));
  assert.equal(calls, 0);
});

test("incomplete, empty, oversized, or substituted model responses are rejected", async () => {
  const { createCustomBackgroundAiRuntime } = await import("../lib/server/custom-background-ai");
  const invalidOutputs: unknown[] = [
    undefined, null, "raw response", {},
    { model: "approved-small", text: "Partial", finishReason: "length" },
    { model: "approved-small", text: "Partial" },
    { model: "different-model", text: "Complete", finishReason: "complete" },
    { model: "approved-small", text: "  ", finishReason: "complete" },
    { model: "approved-small", text: "unsafe\0text", finishReason: "complete" },
    { model: "approved-small", text: "a".repeat(128_001), finishReason: "complete" },
    { get model() { throw new Error("upstream-secret"); } },
  ];
  for (const output of invalidOutputs) {
    const runtime = createCustomBackgroundAiRuntime(adapter({ generate: async () => output as CustomBackgroundAiOutput }));
    await assert.rejects(runtime.run({ prompt: "Summarize" }), (error: Error) => {
      assert.match(error.message, /empty, incomplete, or invalid/);
      assert.doesNotMatch(error.message, /upstream-secret/);
      return true;
    });
  }
});

test("provider exceptions are sanitized instead of echoing credentials or upstream bodies", async () => {
  const { createCustomBackgroundAiRuntime } = await import("../lib/server/custom-background-ai");
  for (const generate of [
    async () => { throw new Error("Bearer SECRET raw response contains private content"); },
    (() => { throw new Error("Bearer SECRET"); }) as CustomBackgroundAiAdapter["generate"],
  ]) {
    const runtime = createCustomBackgroundAiRuntime(adapter({ generate }));
    await assert.rejects(runtime.run({ prompt: "Summarize" }), (error: Error) => {
      assert.match(error.message, /could not complete/);
      assert.doesNotMatch(error.message, /SECRET|private content|Bearer/);
      return true;
    });
  }
});

test("an unresponsive adapter times out, aborts transport signal, and discards late results", async () => {
  const { createCustomBackgroundAiRuntime } = await import("../lib/server/custom-background-ai");
  let signal: AbortSignal | undefined;
  let complete: ((value: CustomBackgroundAiOutput) => void) | undefined;
  const runtime = createCustomBackgroundAiRuntime(adapter({
    generate(input) {
      signal = input.signal;
      return new Promise((resolve) => { complete = resolve; });
    },
  }), { timeoutMs: 10 });
  await assert.rejects(runtime.run({ prompt: "Summarize" }), /timed out/);
  assert.equal(signal?.aborted, true);
  complete?.({ model: "approved-small", text: "Too late", finishReason: "complete" });
});

test("invalid adapter registrations stay unavailable and never expose raw configuration", async () => {
  const { createCustomBackgroundAiRuntime } = await import("../lib/server/custom-background-ai");
  const badAdapters = [
    adapter({ id: "https://secret.invalid" }), adapter({ revision: "" }),
    adapter({ label: "<script>bad</script>" }), adapter({ models: [] }),
    adapter({ models: [{ id: "approved-small", label: "Okay" }, { id: "approved-small", label: "Duplicate" }] }),
    adapter({ models: [{ id: "https://private.invalid", label: "Bad" }] }),
    adapter({ defaultModel: "not-approved" }),
    adapter({ generate: null as unknown as CustomBackgroundAiAdapter["generate"] }),
    { get id() { throw new Error("secret"); } } as unknown as CustomBackgroundAiAdapter,
  ];
  for (const value of badAdapters) {
    const runtime = createCustomBackgroundAiRuntime(value);
    assert.deepEqual(runtime.status(), { available: false, label: "Custom company provider" });
    assert.equal(runtime.cacheScope(), "custom:unavailable");
    await assert.rejects(runtime.run({ prompt: "Summarize" }), /not configured/);
  }
});

test("timeout configuration cannot disable or exceed the execution deadline", async () => {
  const { createCustomBackgroundAiRuntime } = await import("../lib/server/custom-background-ai");
  for (const timeoutMs of [0, -1, 120_001, Infinity, NaN, 0.5])
    assert.throws(() => createCustomBackgroundAiRuntime(adapter(), { timeoutMs }), /timeout must be/);
});

test("runtime snapshots model policy and cache scope separates adapter identity, revision, default, and allowlist", async () => {
  const { createCustomBackgroundAiRuntime } = await import("../lib/server/custom-background-ai");
  const models = [{ id: "approved-small", label: "Small" }];
  const original = adapter({ models });
  const runtime = createCustomBackgroundAiRuntime(original);
  const scope = runtime.cacheScope();
  models.push({ id: "later-added", label: "Not in snapshot" });
  assert.equal((await runtime.models()).models.length, 1);
  assert.equal(runtime.cacheScope(), scope);
  const baseline = createCustomBackgroundAiRuntime(adapter()).cacheScope();
  for (const changes of [
    { id: "other-company" }, { revision: "2" }, { defaultModel: "approved-large" },
    { models: [{ id: "approved-small", label: "Approved small" }] },
  ]) assert.notEqual(createCustomBackgroundAiRuntime(adapter(changes)).cacheScope(), baseline);
  assert.equal(createCustomBackgroundAiRuntime(adapter({ models: [...adapter().models].reverse() })).cacheScope(), baseline);
  assert.match(baseline, /^custom:[a-f0-9]{64}$/);
});
