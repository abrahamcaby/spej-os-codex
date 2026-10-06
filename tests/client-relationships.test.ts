import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { accountRelationship, addRelationshipDays, clientPlanIssue, matchesRelationshipView } from "../lib/client-relationships";
import { cleanAccounts, cleanActivities, cleanContacts, cleanOpportunities, cleanProjects } from "../lib/operations";
import { applyAgentWorkspaceActions } from "../lib/agent-workspace";
import { readGtmAgentContext, prepareGtmAgentProposal } from "../lib/gtm-agent-contract";
import { workspaceFingerprint } from "../lib/agent-session";
import { buildDirectorAttention } from "../lib/director-dashboard";
import { gtmMetrics } from "../lib/gtm-metrics";
import { initializeWorkspaceStore, readWorkspaceState, writeWorkspaceState } from "../lib/workspace-store";
import type { AccountItem, TaskItem, WorkspaceState } from "../lib/types";

const empty = (): WorkspaceState => ({ reminders: [], tasks: [], content: [], accounts: [], contacts: [], activities: [], opportunities: [], partnerships: [], projects: [], campaigns: [], marketingMetrics: [] });
const account = (changes: Partial<AccountItem> = {}) => cleanAccounts([{ id: "a", name: "Example account", type: "Client", ...changes }])[0];
const plan = (changes: Partial<AccountItem> = {}) => account({ clientStatus: "Past client", checkInCadence: "30 days", nextCheckIn: "2026-08-20", checkInReason: "Review future possibilities", checkInOwner: "Sagar", ...changes });
const now = new Date(2026, 7, 31, 12);
const task = (changes: Partial<TaskItem> = {}): TaskItem => ({ id: "t", title: "Agreed client follow-up", description: "", due: "2026-08-31", relatedType: "account", relatedId: "a", recurrence: "One-time", priority: "Normal", done: false, owner: "Aby", ...changes });
const profile = (a: AccountItem, state = empty()) => accountRelationship(a, state, "2026-08-31");

test("legacy client records stay unclassified rather than guessed current or past", () => {
  const a = account(); const result = profile(a);
  assert.equal(a.clientStatus, "Unclassified"); assert.equal(a.status, "Active");
  assert.equal(result.needsClassification, true); assert.equal(matchesRelationshipView(result, "Prospecting"), false);
  assert.equal(matchesRelationshipView(result, "Current clients"), false);
});

test("current client, partner and active buyer views overlap without changing people", () => {
  const state = empty(); const a = account({ clientStatus: "Current client", isPartner: true });
  state.contacts = cleanContacts([{ id: "c", accountId: "a", name: "Person", lifecycleStage: "Network", source: "Personal network", relationshipStrength: "Strong" }]);
  state.opportunities = cleanOpportunities([{ id: "o", name: "Expansion", accountId: "a", stage: "Proposal & Decision" }]);
  const result = profile(a, state);
  for (const view of ["Current clients", "Partners & network", "Active opportunities"] as const) assert.equal(matchesRelationshipView(result, view), true);
  assert.equal(state.contacts[0].lifecycleStage, "Network"); assert.equal(state.contacts[0].source, "Personal network");
});

test("one completed project never marks an account past or ends another engagement", () => {
  const state = empty(); state.projects = cleanProjects([{ id: "p1", name: "Completed", accountId: "a", phase: "Delivery", operationalStatus: "Complete", commercialStatus: "Contracted" }, { id: "p2", name: "Continuing", accountId: "a", phase: "Design", operationalStatus: "Active", commercialStatus: "Contracted" }]);
  const result = profile(account(), state);
  assert.equal(result.clientStatus, "Unclassified"); assert.equal(result.currentProjects.length, 1); assert.equal(result.completedProjects.length, 1);
  assert.match(clientPlanIssue(account({ clientStatus: "Past client" }), state), /contracted project work open/);
  assert.equal(clientPlanIssue(account({ clientStatus: "Current client" }), state), "");
});

test("anticipated and proposed projects are not proof of an active engagement", () => {
  const state = empty(); state.projects = cleanProjects([{ name: "Maybe", accountId: "a", phase: "Discovery", commercialStatus: "Proposed", operationalStatus: "Active" }]);
  assert.equal(profile(account({ clientStatus: "Past client" }), state).currentProjects.length, 0);
  assert.equal(clientPlanIssue(account({ clientStatus: "Past client" }), state), "");
  assert.equal(profile(account({ clientStatus: "Current client" }), empty()).clientStatus, "Current client");
});

test("warm network contacts alone never create buying opportunities", () => {
  const state = empty(); state.contacts = cleanContacts([{ name: "Warm person", accountId: "a", relationshipStrength: "Strong" }]);
  assert.equal(matchesRelationshipView(profile(account({ type: "Network", clientStatus: "Not a client" }), state), "Active opportunities"), false);
});

test("calendar cadence handles month ends, leap years and DST without timezone drift", () => {
  assert.equal(addRelationshipDays("2024-01-31", 30), "2024-03-01");
  assert.equal(addRelationshipDays("2026-03-01", 30), "2026-03-31");
  assert.equal(addRelationshipDays("2026-07-02", 60), "2026-08-31");
  assert.equal(addRelationshipDays("2026-06-02", 90), "2026-08-31");
  assert.equal(addRelationshipDays("2026-02-30", 30), "");
});

test("explicit next date takes precedence over older contact and incomplete plans invent no date", () => {
  assert.equal(profile(plan({ lastCheckIn: "2026-08-01", nextCheckIn: "2026-09-15" })).due, "2026-09-15");
  const a = plan({ nextCheckIn: "", lastCheckIn: "" }); assert.equal(profile(a).due, ""); assert.match(clientPlanIssue(a, empty()), /first check-in date/);
  assert.equal(profile(plan({ checkInCadence: "Not set" })).checkInDue, false);
});

test("a completed meaningful check-in advances cadence without creating tasks", () => {
  const state = empty(); state.activities = cleanActivities([{ summary: "Talked", accountId: "a", purpose: "Client relationship", metricType: "Check-in completed", occurredAt: "2026-08-25" }]);
  assert.equal(profile(plan(), state).due, "2026-09-24"); assert.equal(state.tasks.length, 0);
  assert.equal(profile(plan({ checkInCadence: "One-time" }), state).due, "");
});

test("unanswered outreach and booking logs never complete check-ins; recent exchanges pause only generic prompts", () => {
  for (const metricType of ["Follow-up sent", "Meeting booked", "Meeting cancelled", "Meeting no-show", "Call attempted", "Reply received", "Comment made"]) {
    const state = empty(); state.activities = cleanActivities([{ summary: metricType, metricType, accountId: "a", purpose: "Client relationship", occurredAt: "2026-08-30" }]);
    const result = profile(plan(), state);
    assert.equal(result.due, "2026-08-20");
    assert.equal(result.lastContact, "");
    if (["Follow-up sent", "Reply received"].includes(metricType)) assert.match(result.suppressed, /Review recent/);
    else assert.equal(result.suppressed, "");
  }
});

test("held relationship meetings count; future, archived and different-account activity do not", () => {
  const state = empty(); state.activities = cleanActivities([{ summary: "Meeting", metricType: "Meeting held", purpose: "Client relationship", accountId: "a", occurredAt: "2026-08-30" }]);
  assert.equal(profile(plan(), state).lastContact, "2026-08-30");
  for (const changes of [{ occurredAt: "2026-09-01" }, { accountId: "other" }, { archivedAt: "2026-08-30" }, { sourceDateKnown: false }]) assert.equal(profile(plan(), { ...state, activities: [{ ...state.activities[0], ...changes }] }).lastContact, "");
});

test("a confirmed nearby meeting suppresses only the generic reminder and expires", () => {
  assert.match(profile(plan({ nextMeetingDate: "2026-09-02" })).suppressed, /Meeting planned/);
  assert.equal(profile(plan({ nextMeetingDate: "2026-08-30" })).suppressed, "");
  assert.equal(profile(plan({ nextMeetingDate: "2026-10-01" })).suppressed, "");
});

test("only an explicitly linked relevant covering task suppresses a generic check-in", () => {
  const state = empty(); state.tasks = [task()];
  assert.equal(profile(plan(), state).suppressed, "");
  assert.match(profile(plan({ checkInTaskId: "t" }), state).suppressed, /Covered by task/);
  for (const changes of [{ done: true }, { relatedId: "other" }, { due: "2026-10-01" }]) assert.equal(profile(plan({ checkInTaskId: "t" }), { ...state, tasks: [task(changes)] }).suppressed, "");
});

test("no proactive outreach pauses routine prompts but preserves explicit promises in Today", () => {
  const state = empty(); state.accounts = [plan({ outreachPreference: "No proactive outreach" })]; state.tasks = [task()];
  const result = buildDirectorAttention({ ...state, now });
  assert.ok(result.some((item) => item.id === "task:t")); assert.equal(result.some((item) => item.id === "check-in:a"), false);
});

test("an account hold pauses generic check-ins while both opportunities and promised tasks stay visible", () => {
  const state = empty();
  state.accounts = [plan({ outreachHold: { active: true, reason: "Coordinate the CIO introduction", until: "2026-08-25", releaseCondition: "Account owner confirms" } })];
  state.tasks = [task()];
  state.opportunities = cleanOpportunities([
    { id: "first", accountId: "a", name: "First engagement", owner: "Aby", nextSpejAction: "Confirm scope", nextActionDue: "2026-08-31" },
    { id: "second", accountId: "a", name: "Second engagement", owner: "Sagar", nextSpejAction: "Prepare decision brief", nextActionDue: "2026-08-31" },
  ]);
  const before = structuredClone(state);
  const held = profile(state.accounts[0], state);
  const attention = buildDirectorAttention({ ...state, now });
  assert.match(held.suppressed, /CIO introduction.*explicitly resolved/);
  assert.equal(held.checkInDue, false);
  assert.equal(held.due, "2026-08-20");
  assert.equal(attention.some((item) => item.id === "check-in:a"), false);
  for (const id of ["task:t", "opportunity:first", "opportunity:second"]) assert.ok(attention.some((item) => item.id === id), id);
  assert.deepEqual(state, before);
  assert.equal(profile({ ...state.accounts[0], outreachHold: { ...state.accounts[0].outreachHold!, active: false } }, state).checkInDue, true);
});

test("recent teammate activity pauses generic check-ins using the original date and then expires", () => {
  const state = empty(); state.accounts = [plan()]; state.tasks = [task()];
  state.activities = cleanActivities([{ summary: "Owner sent the agreed context", accountId: "a", owner: "Sean", metricType: "Outreach sent", occurredAt: "2026-08-30", createdAt: "2026-08-31T12:00:00Z" }]);
  assert.match(profile(state.accounts[0], state).suppressed, /Sean/);
  const attention = buildDirectorAttention({ ...state, now });
  assert.ok(attention.some((item) => item.id === "task:t"));
  assert.equal(attention.some((item) => item.id === "check-in:a"), false);
  for (const changes of [{ occurredAt: "2026-08-23" }, { occurredAt: "2026-09-01" }, { sourceDateKnown: false }, { accountId: "another-account" }]) {
    assert.equal(profile(state.accounts[0], { ...state, activities: [{ ...state.activities[0], ...changes }] }).suppressed, "");
  }
});

test("Today has one stable check-in per account, correct owner and a client-view deep link", () => {
  const state = empty(); state.accounts = [plan()]; state.contacts = cleanContacts([{ name: "One", accountId: "a" }, { name: "Two", accountId: "a" }]);
  const result = buildDirectorAttention({ ...state, now }).filter((item) => item.id === "check-in:a");
  assert.equal(result.length, 1); assert.equal(result[0].owner, "Sagar"); assert.equal(result[0].recordId, "client:a");
  assert.deepEqual(buildDirectorAttention({ ...state, now }), buildDirectorAttention({ ...state, now }));
  assert.equal(state.tasks.length, 0);
});

test("archives generate no check-ins and identical company names stay independent", () => {
  const state = empty(); state.accounts = [plan(), plan({ id: "b", archivedAt: "2026-08-31" }), plan({ id: "c" })];
  const checks = buildDirectorAttention({ ...state, now }).filter((item) => item.id.startsWith("check-in:"));
  assert.deepEqual(checks.map((item) => item.id), ["check-in:a", "check-in:c"]);
});

test("client and partner care stay in history but outside business-development counters", () => {
  const state = empty(); state.contacts = cleanContacts([{ id: "p", name: "Person" }]);
  state.activities = cleanActivities([{ summary: "Care", purpose: "Client relationship", metricType: "Follow-up sent", contactId: "p", occurredAt: "2026-07-30" }, { summary: "New project", purpose: "Business development", metricType: "Outreach sent", contactId: "p", occurredAt: "2026-08-02" }, { summary: "Customer meeting", purpose: "Client relationship", metricType: "Meeting held", occurredAt: "2026-08-03" }, { summary: "Partner call", purpose: "Partner relationship", metricType: "Call connected", occurredAt: "2026-08-03" }]);
  const totals = gtmMetrics(state, "2026-08", "2026-08-31");
  assert.equal(totals.activities.length, 3); assert.equal(totals.outreachCount, 1); assert.equal(totals.firstContactedPeople, 1); assert.equal(totals.meetingsHeld, 0); assert.equal(totals.callsConnected, 0); assert.equal(totals.clientCareActivities, 1); assert.equal(totals.partnerCareActivities, 1);
});

test("legacy activity purpose is not invented and compatibility counting is disclosed", () => {
  const state = empty(); state.activities = cleanActivities([{ summary: "Legacy", metricType: "Outreach sent", occurredAt: "2026-08-03" }]);
  const totals = gtmMetrics(state, "2026-08", "2026-08-31");
  assert.equal(state.activities[0].purpose, undefined); assert.equal(totals.outreachCount, 1); assert.equal(totals.unclassifiedPurposeActivities, 1);
});

test("SOSA changes client plans without rewriting source, projects, contacts or focus", async () => {
  const state = empty(); state.accounts = [account({ focus531: true })]; state.contacts = cleanContacts([{ id: "c", accountId: "a", name: "Person", lifecycleStage: "Network" }]);
  const result = await prepareGtmAgentProposal(state, { actions: [{ type: "update", collection: "accounts", recordId: "a", data: { clientStatus: "Past client", isPartner: true, checkInCadence: "60 days", nextCheckIn: "2026-10-01", checkInContactId: "c", checkInOwner: "Sagar" } }] });
  assert.equal(result.nextWorkspace?.accounts[0].clientStatus, "Past client"); assert.equal(result.nextWorkspace?.accounts[0].focus531, true);
  assert.equal(result.nextWorkspace?.contacts[0].lifecycleStage, "Network"); assert.equal(state.accounts[0].clientStatus, "Unclassified");
  assert.notEqual(await workspaceFingerprint(state), await workspaceFingerprint(result.nextWorkspace!));
});

test("SOSA rejects invalid status, cadence, booleans, calendar dates and person linkage", () => {
  const state = empty(); state.accounts = [account()]; state.contacts = cleanContacts([{ id: "wrong", name: "Person", accountId: "other" }]);
  for (const data of [{ clientStatus: "Former-ish" }, { checkInCadence: "33 days" }, { isPartner: "true" }, { nextCheckIn: "2026-02-30" }, { lastCheckIn: "2099-01-01" }, { checkInContactId: "wrong" }, { checkInCadence: "30 days" }]) assert.throws(() => applyAgentWorkspaceActions(state, [{ type: "update", collection: "accounts", recordId: "a", data }]));
  assert.throws(() => applyAgentWorkspaceActions(state, [{ type: "create", collection: "activities", data: { summary: "Event", purpose: "Assumed success" } }]), /purpose/);
});

test("SOSA cannot mark past client while contracted work is open, including coordinated proposals", () => {
  const state = empty(); state.accounts = [account({ clientStatus: "Current client" })]; state.projects = cleanProjects([{ name: "Active", accountId: "a", commercialStatus: "Contracted", operationalStatus: "Active" }]);
  assert.throws(() => applyAgentWorkspaceActions(state, [{ type: "update", collection: "accounts", recordId: "a", data: { clientStatus: "Past client" } }]), /contracted project work open/);
  const result = applyAgentWorkspaceActions(state, [{ type: "update", collection: "projects", recordId: state.projects[0].id, data: { operationalStatus: "Complete" } }, { type: "update", collection: "accounts", recordId: "a", data: { clientStatus: "Past client" } }]);
  assert.equal(result.workspace.accounts[0].clientStatus, "Past client");
});

test("client status and plans survive the normal SQLite round trip without a schema migration", () => {
  const state = empty(); state.accounts = [plan({ isPartner: true, checkInOwner: "Sagar", lastCheckIn: "2026-07-10" })];
  const database = initializeWorkspaceStore(new DatabaseSync(":memory:"));
  try { writeWorkspaceState(database, state); const saved = readWorkspaceState(database); assert.equal(saved.accounts[0].clientStatus, "Past client"); assert.equal(saved.accounts[0].checkInCadence, "30 days"); assert.equal(saved.accounts[0].isPartner, true); assert.equal(saved.accounts[0].checkInOwner, "Sagar"); } finally { database.close(); }
});

test("agent context exposes deterministic client counts and check-in queue without provider credentials", async () => {
  const state = empty(); state.accounts = [plan(), account({ id: "current", clientStatus: "Current client" })];
  const context = await readGtmAgentContext(state, now);
  assert.equal(context.clientSummary.currentClients, 1); assert.equal(context.clientSummary.pastClients, 1); assert.equal(context.clientSummary.checkInsDue, 1); assert.equal(context.relationshipCheckIns[0].owner, "Sagar");
});

test("one-time reminders require a scheduled date and distinguish completion from missing setup", () => {
  const incomplete = plan({ checkInCadence: "One-time", nextCheckIn: "", lastCheckIn: "2026-08-01" });
  assert.match(clientPlanIssue(incomplete, empty()), /date for the one-time/); assert.equal(profile(incomplete).needsPlanDate, true);
  const completed = profile(plan({ checkInCadence: "One-time", lastCheckIn: "2026-08-25" }));
  assert.equal(completed.completedOneTime, true); assert.equal(completed.needsPlanDate, false);
});

test("a meeting before a later planned check-in does not hide that future reminder", () => {
  assert.equal(profile(plan({ nextCheckIn: "2026-09-06", nextMeetingDate: "2026-09-02" })).suppressed, "");
});

test("an old dangling plan reference does not block unrelated SOSA account notes", () => {
  const state = empty(); state.accounts = [account({ checkInContactId: "gone" })];
  const result = applyAgentWorkspaceActions(state, [{ type: "update", collection: "accounts", recordId: "a", data: { notes: "New context" } }]);
  assert.equal(result.workspace.accounts[0].notes, "New context"); assert.equal(result.workspace.accounts[0].checkInContactId, "gone");
});

test("a legacy plan error cannot mask a newly introduced active-work contradiction", () => {
  const state = empty(); state.accounts = [account({ clientStatus: "Past client", checkInContactId: "gone" })];
  assert.throws(() => applyAgentWorkspaceActions(state, [{ type: "create", collection: "projects", data: { name: "New active work", accountId: "a", commercialStatus: "Contracted", operationalStatus: "Active" } }]), /contracted project work open/);
});

test("covering task names resolve numeric task IDs without silently dropping the link", () => {
  const state = empty(); state.accounts = [plan()]; state.tasks = [task({ id: 42 })];
  const result = applyAgentWorkspaceActions(state, [{ type: "update", collection: "accounts", recordId: "a", data: { checkInTaskName: "Agreed client follow-up" } }]);
  assert.equal(result.workspace.accounts[0].checkInTaskId, "42");
});

test("completed check-in proposals require a real past or present event date", () => {
  for (const occurredAt of ["", "2026-02-30", "2099-01-01"]) assert.throws(() => applyAgentWorkspaceActions(empty(), [{ type: "create", collection: "activities", data: { summary: "Check-in", metricType: "Check-in completed", occurredAt } }]), /completed check-in needs its actual date/);
});

test("the combined attention model retains every derived check-in beyond the first twelve", () => {
  const state = empty(); state.accounts = Array.from({ length: 15 }, (_, i) => plan({ id: `a${i}`, name: `Account ${i}` }));
  const items = buildDirectorAttention({ ...state, now });
  assert.equal(items.filter((item) => item.id.startsWith("check-in:")).length, 15);
});
