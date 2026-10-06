import "server-only";

import { createHash } from "node:crypto";
import type { AiModelsResponse } from "../types";
import { isValidAiModelId } from "../ai-providers";
import { getCustomBackgroundAiAdapter } from "./custom-background-ai-host";

type CustomModel = Readonly<{ id: string; label: string }>;

export type CustomBackgroundAiInput = Readonly<{
  model: string;
  prompt: string;
  maxOutputTokens: number;
  signal: AbortSignal;
}>;

export type CustomBackgroundAiOutput = Readonly<{
  model: string;
  text: string;
  /** Map only a genuinely completed provider response to this value. */
  finishReason: "complete";
}>;

/** Server-owned configuration, never a browser-supplied provider definition. */
export type CustomBackgroundAiAdapter = Readonly<{
  id: string;
  revision: string;
  label: string;
  models: readonly CustomModel[];
  defaultModel: string;
  generate(input: CustomBackgroundAiInput): Promise<CustomBackgroundAiOutput>;
}>;

export type CustomBackgroundAiRunOptions = {
  model?: string;
  prompt: string;
  maxOutputTokens?: number;
  webSearch?: boolean;
};

const UNCONFIGURED = "The custom Background Intelligence provider is not configured. IT must install and approve its server-side adapter first.";
const DEFAULT_LABEL = "Custom company provider";
const MAX_PROMPT_CHARS = 200_000;
const MAX_OUTPUT_CHARS = 128_000;
const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_TIMEOUT_MS = 120_000;

function publicLabel(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  const label = value.trim();
  if (!label || label.length > 100 || /[\u0000-\u001f\u007f<>]/.test(label) || /https?:\/\//i.test(label)) return;
  return label;
}

function snapshotAdapter(adapter: CustomBackgroundAiAdapter | undefined): CustomBackgroundAiAdapter | undefined {
  if (!adapter || typeof adapter !== "object" ||
      typeof adapter.id !== "string" || !/^[a-z0-9][a-z0-9._-]{0,99}$/i.test(adapter.id) ||
      typeof adapter.revision !== "string" || !/^[a-z0-9][a-z0-9._-]{0,59}$/i.test(adapter.revision) ||
      typeof adapter.generate !== "function" || !Array.isArray(adapter.models) ||
      adapter.models.length < 1 || adapter.models.length > 100) return;
  const label = publicLabel(adapter.label);
  if (!label) return;
  const models: CustomModel[] = [];
  const ids = new Set<string>();
  for (const item of adapter.models) {
    if (!item || typeof item !== "object" || !isValidAiModelId(item.id) || ids.has(item.id)) return;
    const modelLabel = publicLabel(item.label);
    if (!modelLabel) return;
    ids.add(item.id);
    models.push(Object.freeze({ id: item.id, label: modelLabel }));
  }
  if (!ids.has(adapter.defaultModel)) return;
  return Object.freeze({
    id: adapter.id,
    revision: adapter.revision,
    label,
    models: Object.freeze(models),
    defaultModel: adapter.defaultModel,
    generate: adapter.generate.bind(adapter),
  });
}

/**
 * The explicit adapter argument exists for server composition and offline tests.
 * It is not a registration API and never changes the application's host adapter.
 */
export function createCustomBackgroundAiRuntime(
  adapter?: CustomBackgroundAiAdapter,
  options: { timeoutMs?: number } = {},
) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS)
    throw new Error("The custom provider timeout must be between 1 and 120000 milliseconds.");
  let configured: CustomBackgroundAiAdapter | undefined;
  try { configured = snapshotAdapter(adapter); } catch { /* A broken host configuration is unavailable, not public diagnostics. */ }

  function requireAdapter() {
    if (!configured) throw new Error(UNCONFIGURED);
    return configured;
  }

  return {
    cacheScope(): string {
      if (!configured) return "custom:unavailable";
      const metadata = [configured.id, configured.revision, configured.defaultModel,
        [...configured.models].map(({ id, label }) => [id, label]).sort(([left], [right]) => left.localeCompare(right))];
      return `custom:${createHash("sha256").update(JSON.stringify(metadata)).digest("hex")}`;
    },
    status(): { available: boolean; label: string } {
      // Availability means a valid adapter is registered, not an authenticated
      // connectivity check, permission grant, quota guarantee, or healthy sync.
      return { available: Boolean(configured), label: configured?.label || DEFAULT_LABEL };
    },
    async models(): Promise<AiModelsResponse> {
      const provider = requireAdapter();
      return {
        provider: "custom",
        models: provider.models.map(({ id, label }) => ({ id, label })),
        defaultModel: provider.defaultModel,
        checkedAt: new Date().toISOString(),
        cached: false,
        localOnly: false,
      };
    },
    async run(input: CustomBackgroundAiRunOptions): Promise<{ provider: "custom"; model: string; text: string }> {
      const provider = requireAdapter();
      if (input.webSearch !== undefined && typeof input.webSearch !== "boolean")
        throw new Error("Choose whether to request web research explicitly.");
      if (input.webSearch)
        throw new Error("The custom Background Intelligence provider does not support live web research. It can summarize and rank collected content; no fallback provider was called.");
      const model = input.model === undefined || input.model === "" || input.model === "default" ? provider.defaultModel : input.model;
      if (!isValidAiModelId(model) || !provider.models.some((item) => item.id === model))
        throw new Error("Choose a model approved by the custom provider's server-side adapter.");
      if (typeof input.prompt !== "string" || !input.prompt.trim() || input.prompt.length > MAX_PROMPT_CHARS || input.prompt.includes("\0"))
        throw new Error("The custom provider requires a nonempty prompt of at most 200000 characters.");
      const maxOutputTokens = input.maxOutputTokens ?? 4_000;
      if (!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > 8_000)
        throw new Error("The custom provider output allowance must be a whole number between 1 and 8000 tokens.");

      const controller = new AbortController();
      let timedOut = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          timedOut = true;
          reject(new Error("deadline"));
          controller.abort();
        }, timeoutMs);
      });
      let output: unknown;
      try {
        const request = Promise.resolve().then(() => provider.generate(Object.freeze({
          model, prompt: input.prompt, maxOutputTokens, signal: controller.signal,
        })));
        output = await Promise.race([request, deadline]);
      } catch {
        throw new Error(timedOut
          ? "The custom Background Intelligence provider timed out. No incomplete result was saved; no fallback provider was called."
          : "The custom Background Intelligence provider could not complete this request. Ask IT to check its configuration and server-side diagnostics; no fallback provider was called.");
      } finally {
        if (timeout !== undefined) clearTimeout(timeout);
      }
      // Do not expose upstream bodies, diagnostics, finish states, or unapproved
      // model substitutions. A callback must explicitly attest to completion.
      let text: string | undefined;
      try {
        if (output && typeof output === "object") {
          const result = output as Record<string, unknown>;
          if (result.model === model && result.finishReason === "complete" &&
              typeof result.text === "string" && result.text.length <= MAX_OUTPUT_CHARS && !result.text.includes("\0")) {
            text = result.text.trim();
          }
        }
      } catch { /* Never forward upstream object access errors to clients. */ }
      if (!text)
        throw new Error("The custom Background Intelligence provider returned an empty, incomplete, or invalid answer. This result was not saved.");
      return { provider: "custom", model, text };
    },
  };
}

function hostedRuntime() {
  try { return createCustomBackgroundAiRuntime(getCustomBackgroundAiAdapter()); }
  catch { return createCustomBackgroundAiRuntime(); }
}

export function getCustomBackgroundAiStatus() {
  return hostedRuntime().status();
}

export function customBackgroundAiCacheScope(): string {
  return hostedRuntime().cacheScope();
}

export function discoverCustomBackgroundAiModels() {
  return hostedRuntime().models();
}

export function runCustomBackgroundAi(input: CustomBackgroundAiRunOptions) {
  return hostedRuntime().run(input);
}
