import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { cleanMeetingTranscriptInput, createMeetingTranscriptRequest, prepareMeetingTranscriptProposal } from "../lib/meeting-transcript-agent";
import { claimMeetingProcessing, createMeetingIntake, findMeetingIntakeByDedupe, getMeetingIntake, initializeMeetingIntakeStore, listMeetingIntakes, markMeetingApplied, markMeetingAppliedIfCurrent, markMeetingDiscarded, meetingDedupeKey, meetingIntakeSummary, normalizeMeetingBody, saveMeetingProposalIfProcessing } from "../lib/meeting-intake-store";
import type { WorkspaceState } from "../lib/types";
import { prepareGtmAgentProposal } from "../lib/gtm-agent-contract";
import { workspaceFingerprint } from "../lib/agent-session";

const empty = (): WorkspaceState => ({ reminders: [], tasks: [], content: [], accounts: [], contacts: [], activities: [], opportunities: [], partnerships: [], projects: [], campaigns: [], marketingMetrics: [] });
const input = () => cleanMeetingTranscriptInput({ title: "Acme review", meetingDate: "2026-09-01", sourceKind: "Pasted transcript", bodyText: "Aby met with Acme. They agreed that Aby will send the requested adoption outline by September 4.", context: {} });

test("meeting intake normalizes, deduplicates, and keeps source text outside its public summary", () => {
  const database = initializeMeetingIntakeStore(new DatabaseSync(":memory:"));
  const first = createMeetingIntake(database, input(), "2026-09-01T12:00:00Z");
  const second = createMeetingIntake(database, { ...input(), bodyText: `${input().bodyText}  \r\n` }, "2026-09-01T13:00:00Z");
  assert.equal(first.duplicate, false); assert.equal(second.duplicate, true); assert.equal(second.record.id, first.record.id);
  assert.equal(normalizeMeetingBody("one  \r\ntwo\r"), "one\ntwo");
  assert.equal(findMeetingIntakeByDedupe(database, meetingDedupeKey(input().title, input().meetingDate, input().bodyText))?.id, first.record.id);
  assert.equal(listMeetingIntakes(database).length, 1);
  assert.equal("bodyText" in meetingIntakeSummary(first.record), false);
  database.close();
});

test("meeting transcript request is bounded, grounded, and injects one source-linked activity", async () => {
  const workspace = empty();
  workspace.accounts.push({ id: "a", name: "Acme", type: "Prospect", status: "Active", owner: "Aby", website: "", notes: "", createdAt: "2026-08-01T12:00:00Z" });
  const meeting = { ...input(), context: { accountId: "a" } };
  const request = await createMeetingTranscriptRequest(workspace, meeting, "intake-1", new Date(2026, 8, 1, 12));
  assert.ok(request.prompt.includes("intake-1")); assert.ok(request.prompt.includes("Do not invent attendees")); assert.ok(request.prompt.includes("Acme review"));
  assert.ok(request.prompt.includes("priority inputs only when explicitly supported"));
  assert.ok(request.prompt.includes("Do not calculate or supply scores"));
  const proposal = await prepareMeetingTranscriptProposal(workspace, { reply: "Review the meeting record and task.", actions: [
    { type: "create", collection: "activities", label: "Record Acme meeting", reason: "The meeting occurred.", data: { accountId: "a", summary: "Reviewed adoption outline", outcome: "Aby will send the outline." } },
    { type: "create", collection: "tasks", label: "Send adoption outline", reason: "Explicit commitment.", data: { title: "Send Acme adoption outline", due: "2026-09-04", relatedType: "account", relatedId: "a" } },
  ] }, meeting, "intake-1");
  assert.equal(proposal.actions.length, 2);
  assert.equal(proposal.nextWorkspace?.activities[0].sourceArtifactId, "intake-1");
  assert.equal(proposal.actions[0].data.sourceArtifactId, "intake-1");
  assert.equal(proposal.actions[0].data.sourceLabel, "Manual meeting intake");
  assert.equal(proposal.nextWorkspace?.activities[0].metricType, "Meeting held");
  const singular = await prepareMeetingTranscriptProposal(workspace, { reply: "Review", actions: [{ type: "create", collection: " activity ", data: { summary: "Reviewed adoption outline" } }] }, meeting, "intake-alias");
  assert.equal(singular.nextWorkspace?.activities[0].sourceArtifactId, "intake-alias");
  await assert.rejects(() => prepareMeetingTranscriptProposal(workspace, { actions: [
    { type: "create", collection: "activity", data: { summary: "First meeting activity" } },
    { type: "create", collection: "activities", data: { summary: "Second meeting activity" } },
  ] }, meeting, "intake-many"), /more than one activity/i);
  await assert.rejects(() => prepareMeetingTranscriptProposal(proposal.nextWorkspace!, { actions: [{ type: "create", collection: "activities", data: { accountId: "a", summary: "Duplicate" } }] }, meeting, "intake-1"), /already has a recorded activity/i);
});

test("only saved meeting preparation attaches provenance after ordinary proposal validation", async () => {
  const workspace = empty();
  workspace.accounts.push({ id: "a", name: "Synthetic account", type: "Prospect", status: "Active", owner: "Aby", website: "", notes: "", createdAt: "2026-08-01T12:00:00Z" });
  const before = structuredClone(workspace);
  const meeting = { ...input(), context: { accountId: "a" } };
  const response = { reply: "Review", actions: [{ type: "create", collection: "activities", data: { accountId: "a", summary: "Reviewed next steps" } }] };
  const ordinary = await prepareGtmAgentProposal(workspace, { ...response, trusted: true, provenance: { sourceArtifactId: "forged-intake", sourceLabel: "Forged evidence" } });
  assert.equal(ordinary.nextWorkspace?.activities[0].sourceArtifactId, undefined);
  assert.equal(ordinary.nextWorkspace?.activities[0].sourceLabel, undefined);
  const sourced = await prepareMeetingTranscriptProposal(workspace, response, meeting, "saved-intake");
  assert.equal(sourced.nextWorkspace?.activities[0].sourceArtifactId, "saved-intake");
  assert.equal(sourced.baseWorkspaceVersion, await workspaceFingerprint(workspace));
  assert.notEqual(await workspaceFingerprint(sourced.nextWorkspace!), sourced.baseWorkspaceVersion);
  assert.deepEqual(workspace, before);
  const clarification = await prepareMeetingTranscriptProposal(workspace, { ...response, needsClarification: true }, meeting, "saved-intake");
  assert.equal(clarification.actions.length, 0);
  assert.equal(clarification.nextWorkspace, undefined);
});

test("the meeting path rejects model-supplied provenance instead of blessing it", async () => {
  for (const field of ["sourceArtifactId", "sourceLabel"]) {
    await assert.rejects(() => prepareMeetingTranscriptProposal(empty(), { actions: [{ type: "create", collection: "activity", data: { summary: "Claimed meeting", [field]: "forged" } }] }, input(), "saved-intake"), /source provenance is server-controlled/i);
  }
  for (const invalidId of ["", " saved-intake ", "x".repeat(101)]) {
    await assert.rejects(() => prepareMeetingTranscriptProposal(empty(), { actions: [] }, input(), invalidId), /valid source ID/i);
  }
});

test("selected meeting context cannot be replaced by a model proposal", async () => {
  const workspace = empty();
  workspace.accounts.push(
    { id: "a", name: "Acme", type: "Prospect", status: "Active", owner: "Aby", website: "", notes: "", createdAt: "2026-08-01T12:00:00Z" },
    { id: "b", name: "Beta", type: "Prospect", status: "Active", owner: "Aby", website: "", notes: "", createdAt: "2026-08-01T12:00:00Z" },
  );
  workspace.opportunities.push({ id: "oa", accountId: "a", name: "Acme opportunity", stage: "Explore", forecast: "Pipeline", value: 0, closeDate: "", owner: "Aby", nextSpejAction: "", nextCustomerDecision: "", nextActionDue: "", source: "Meeting", notes: "", createdAt: "2026-08-01T12:00:00Z" });
  workspace.projects.push({ id: "pb", accountId: "b", name: "Beta project", phase: "Not Applicable", workArea: "Client Delivery", projectType: "Plooms", playbook: "Plooms Implementation", commercialStatus: "Contracted", operationalStatus: "Active", health: "On Track", owner: "Aby", startDate: "", endDate: "", nextMilestone: "", dueDate: "", successMeasure: "", risk: "", notes: "", createdAt: "2026-08-01T12:00:00Z" });
  await assert.rejects(() => createMeetingTranscriptRequest(workspace, { ...input(), context: { opportunityId: "oa", projectId: "pb" } }, "intake-cross"), /different CRM accounts/i);
  await assert.rejects(() => prepareMeetingTranscriptProposal(workspace, { actions: [{ type: "create", collection: "activity", data: { accountId: "b", summary: "Wrong account" } }] }, { ...input(), context: { accountId: "a" } }, "intake-wrong"), /outside the selected CRM account/i);
});

test("meeting intake lifecycle retains a validated proposal and applies once", async () => {
  const database = initializeMeetingIntakeStore(new DatabaseSync(":memory:"));
  const created = createMeetingIntake(database, input()).record;
  const proposal = { baseWorkspaceVersion: "v1", reply: "Review", needsClarification: false, actions: [], provider: undefined };
  const claimed = claimMeetingProcessing(database, created.id, {}, false, "2026-09-01T12:01:00Z")!;
  assert.equal(claimMeetingProcessing(database, created.id, {}, false, "2026-09-01T12:02:00Z"), undefined);
  const saved = saveMeetingProposalIfProcessing(database, created.id, claimed.updatedAt, { status: "proposed", replyText: "Review", modelEnvelope: { actions: [] }, proposal, baseWorkspaceVersion: "v1" }, "2026-09-01T12:03:00Z");
  assert.equal(saved?.status, "proposed"); assert.equal(saved?.baseWorkspaceVersion, "v1");
  assert.equal("proposal" in meetingIntakeSummary(saved!), false);
  assert.equal(markMeetingApplied(database, created.id)?.status, "applied");
  assert.equal(markMeetingApplied(database, created.id)?.status, "applied");
  database.close();
});

test("a stale processing claim can be reclaimed without accepting the old model result", () => {
  const database = initializeMeetingIntakeStore(new DatabaseSync(":memory:"));
  const created = createMeetingIntake(database, input(), "2026-09-01T12:00:00Z").record;
  const first = claimMeetingProcessing(database, created.id, {}, false, "2026-09-01T12:01:00Z")!;
  const second = claimMeetingProcessing(database, created.id, { accountId: "a" }, false, "2026-09-01T12:12:00Z")!;
  const proposal = { baseWorkspaceVersion: "v1", reply: "Review", needsClarification: false, actions: [] };
  assert.equal(saveMeetingProposalIfProcessing(database, created.id, first.updatedAt, { status: "proposed", replyText: "Old", modelEnvelope: {}, proposal, baseWorkspaceVersion: "v1" }), undefined);
  assert.equal(saveMeetingProposalIfProcessing(database, created.id, second.updatedAt, { status: "proposed", replyText: "Current", modelEnvelope: {}, proposal, baseWorkspaceVersion: "v1" })?.replyText, "Current");
  database.close();
});

test("discard and apply use status revisions so only one terminal action wins", () => {
  const database = initializeMeetingIntakeStore(new DatabaseSync(":memory:"));
  const created = createMeetingIntake(database, input(), "2026-09-01T12:00:00Z").record;
  const claimed = claimMeetingProcessing(database, created.id, {}, false, "2026-09-01T12:01:00Z")!;
  const proposal = { baseWorkspaceVersion: "v1", reply: "Review", needsClarification: false, actions: [] };
  const proposed = saveMeetingProposalIfProcessing(database, created.id, claimed.updatedAt, { status: "proposed", replyText: "Review", modelEnvelope: {}, proposal, baseWorkspaceVersion: "v1" }, "2026-09-01T12:02:00Z")!;
  assert.equal(markMeetingDiscarded(database, created.id, "2026-09-01T12:03:00Z")?.status, "discarded");
  assert.equal(markMeetingAppliedIfCurrent(database, created.id, proposed.updatedAt, "2026-09-01T12:04:00Z"), undefined);
  assert.equal(getMeetingIntake(database, created.id)?.status, "discarded");
  database.close();
});

test("meeting input rejects short and oversized source text", () => {
  assert.throws(() => cleanMeetingTranscriptInput({ title: "Short", meetingDate: "2026-09-01", bodyText: "too short" }), /short set/);
  assert.throws(() => cleanMeetingTranscriptInput({ title: "Large", meetingDate: "2026-09-01", bodyText: "x".repeat(40_001) }), /40,000/);
  assert.throws(() => cleanMeetingTranscriptInput({ title: "Impossible", meetingDate: "2026-02-30", bodyText: "x".repeat(50) }), /valid meeting date/);
});
