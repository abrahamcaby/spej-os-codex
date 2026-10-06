import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GtmActivityForm } from "../components/gtm-activity-form";
import { proposalSourceFields, SpejAgent, summarizeMeetingIntakeHealth } from "../components/spej-agent";
import { PREVIEW_ACCESS_NOTICE } from "../lib/task-access-preview";
import type { PublicSettings, WorkspaceState } from "../lib/types";

const noop = () => {};

const settings = (): PublicSettings => ({
  general: { workspaceName: "Spej OS" },
  industry: { sources: [], keywords: [], description: "", excludedTerms: [], dailyLimit: 10 },
  mentions: { profiles: [], terms: [], websites: [], identityAnchors: [], negativeTerms: [], strictMode: true, excludeOwnedSites: true },
  newsletters: { googleClientId: "", googleClientSecretSet: false, connected: false, connectedEmail: "", gmailQuery: "" },
  audience: { accounts: [] },
  ai: {
    provider: "none",
    model: "",
    localBaseUrls: { lmstudio: "http://127.0.0.1:1234", ollama: "http://127.0.0.1:11434" },
    keySet: { openai: false, anthropic: false, gemini: false, xai: false, lmstudio: false, ollama: false },
    keySource: { openai: "none", anthropic: "none", gemini: "none", xai: "none", lmstudio: "none", ollama: "none" },
  },
  dailyBrief: { sourceLabels: [], lookbackDays: 7, sections: { industry: 3, mentions: 3, newsletters: 3 } },
});

const workspace = (): WorkspaceState => ({
  reminders: [], tasks: [], content: [], accounts: [], contacts: [], activities: [],
  opportunities: [], partnerships: [], projects: [], campaigns: [], marketingMetrics: [],
});

test("new GTM activity uses the selected preview person instead of a hard-coded teammate", () => {
  const html = renderToStaticMarkup(createElement(GtmActivityForm, {
    accounts: [], contacts: [], defaultOwner: "Sagar", onSave: noop, onCancel: noop,
  }));
  assert.ok(html.includes('value="Sagar"'));
  assert.ok(!html.includes('value="Aby"'));
});

test("SOSA labels a local model as preview-only and does not imply production status", () => {
  const off = renderToStaticMarkup(createElement(SpejAgent, {
    command: "", setCommand: noop, settings: settings(), workspace: workspace(), onApply: noop, openAiSettings: noop,
  }));
  assert.ok(off.includes("Preview model off"));
  assert.ok(off.includes("Production SOSA status is not checked here"));
  assert.ok(off.includes("existing SOSA service remains authoritative"));
  assert.ok(off.includes("Contract defined"));
  assert.ok(off.includes("Preview ready"));
  assert.ok(off.includes("Not connected"));
  assert.ok(off.includes("Durable production SOSA run history, retries, costs, and audit events are not connected here"));
  assert.ok(!off.includes("Available scope"));
  assert.ok(!off.includes("No model connected"));
  assert.ok(!off.includes("Connect a model to begin"));

  const configured = settings();
  configured.ai.provider = "openai";
  configured.ai.keySet.openai = true;
  const on = renderToStaticMarkup(createElement(SpejAgent, {
    command: "", setCommand: noop, settings: configured, workspace: workspace(), onApply: noop, openAiSettings: noop,
  }));
  assert.ok(on.includes("Preview model · OpenAI"));
  assert.ok(on.includes("Local pilot processing only"));
});

test("meeting intake health is derived only from saved local statuses", () => {
  assert.deepEqual(summarizeMeetingIntakeHealth([
    { status: "ready" },
    { status: "processing" },
    { status: "proposed" },
    { status: "needs_clarification" },
    { status: "applied" },
    { status: "discarded" },
    { status: "failed" },
  ]), { queued: 1, processing: 1, awaitingReview: 2, completed: 1, closed: 1, failed: 1 });
});

test("proposal provenance shows only source fields that are actually present", () => {
  const sourced = proposalSourceFields({ actions: [{
    id: "proposal-1", type: "create", collection: "activities", label: "Record meeting", reason: "Requested by the user",
    data: { sourceLabel: "Manual meeting intake", sourceArtifactId: "meeting-1", notes: "Reviewed notes" },
  }, {
    id: "proposal-2", type: "create", collection: "content", label: "Save idea", reason: "Captured in the meeting",
    data: { sourceLabel: "Manual meeting intake", sourceUrl: "https://example.com/source" },
  }] });
  assert.deepEqual(sourced, [
    { field: "Source label", value: "Manual meeting intake" },
    { field: "Source record", value: "meeting-1" },
    { field: "Source URL", value: "https://example.com/source" },
  ]);
  assert.deepEqual(proposalSourceFields({ actions: [{
    id: "proposal-3", type: "update", collection: "accounts", label: "Update account", reason: "Requested by the user",
    data: { notes: "No source metadata supplied" },
  }] }), []);
});

test("the access disclaimer explicitly rejects authentication and authorization claims", () => {
  assert.match(PREVIEW_ACCESS_NOTICE, /Demo visualization only/);
  assert.match(PREVIEW_ACCESS_NOTICE, /not authentication or authorization/);
  assert.match(PREVIEW_ACCESS_NOTICE, /server before returning records/);
});
