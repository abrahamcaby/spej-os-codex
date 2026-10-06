import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { ACTIVITY_CHANNELS, gtmMetrics } from "../lib/gtm-metrics";
import { accountEngagementDates, outreachGuard } from "../lib/relationship-context";
import { accountRelationship } from "../lib/client-relationships";
import { ACTIVITY_MESSAGE_MAX_LENGTH, communicationActivityDate, contactCommunicationActivities, contactCommunicationDates, nextContactFollowUp, sortCommunicationActivities } from "../lib/communication-history";
import { applyAgentWorkspaceActions } from "../lib/agent-workspace";
import { cleanAccounts, cleanActivities, cleanContacts } from "../lib/operations";
import { initializeWorkspaceStore, readWorkspaceState, writeWorkspaceState } from "../lib/workspace-store";
import type { ActivityItem, ContactItem, ContactNurture, TaskItem, WorkspaceState } from "../lib/types";

const today = "2026-09-18";
const person = (changes: Partial<ContactItem> = {}) => cleanContacts([{ id: "person", name: "Example person", accountId: "current-employer", ...changes }])[0];
const activity = (id: string, changes: Partial<ActivityItem> = {}): ActivityItem => ({ id, accountId: "current-employer", contactId: "person", channel: "Email", metricType: "Outreach sent", summary: id, outcome: "", occurredAt: "2026-09-10", createdAt: "2026-09-11T12:00:00Z", ...changes });
const task = (id: string, changes: Partial<TaskItem> = {}): TaskItem => ({ id, title: `Follow up ${id}`, description: "", due: "2026-09-20", recurrence: "One-time", priority: "Normal", done: false, relatedType: "contact", relatedId: "person", ...changes });
const nurture = (changes: Partial<ContactNurture> = {}): ContactNurture => ({ method: "Personal", state: "Active", owner: "Aby", channel: "Email", campaign: "", nextAction: "Send the promised example", dueDate: "2026-09-19", trigger: "", coordination: "", emailEligibility: "Unknown", eligibilityEvidence: "", eligibilityAccountId: "", eligibilityEmail: "", ...changes });
const workspace = (changes: Partial<WorkspaceState> = {}): WorkspaceState => ({ reminders: [], tasks: [], content: [], accounts: [], contacts: [], activities: [], opportunities: [], partnerships: [], projects: [], campaigns: [], marketingMetrics: [], ...changes });

test("timeline follows the exact person across channels and employers, not everyone at their company", () => {
  const activities = [activity("sms", { channel: "Text / SMS", occurredAt: "2026-09-14" }), activity("old-employer", { accountId: "old-employer", channel: "LinkedIn", occurredAt: "2026-09-12" }), activity("other-person", { contactId: "someone-else", occurredAt: "2026-09-17" }), activity("unlinked", { contactId: "", occurredAt: "2026-09-18" }), activity("archived", { archivedAt: "2026-09-16", occurredAt: "2026-09-15" })];
  const original = structuredClone(activities);
  assert.deepEqual(contactCommunicationActivities("person", activities).map((item) => item.id), ["sms", "old-employer"]);
  assert.deepEqual(activities, original);
  assert.deepEqual(contactCommunicationActivities("", activities), []);
});

test("timeline uses actual date first, preserves unknown dates, and deterministically breaks ties", () => {
  const activities = [
    activity("undated", { occurredAt: "", capturedAt: "2026-09-18T10:00:00Z" }),
    activity("old-captured-now", { occurredAt: "2026-05-01", capturedAt: "2026-09-18T11:00:00Z" }),
    activity("new", { occurredAt: "2026-09-17", createdAt: "2026-09-17T11:00:00Z" }),
    activity("same-c", { occurredAt: "2026-09-16", capturedAt: "2026-09-17T12:00:00Z", createdAt: "2026-09-17T12:00:00Z" }),
    activity("same-b", { occurredAt: "2026-09-16", capturedAt: "2026-09-17T12:00:00Z", createdAt: "2026-09-17T12:00:00Z" }),
    activity("same-a", { occurredAt: "2026-09-16", capturedAt: "2026-09-18T12:00:00Z" }),
  ];
  assert.deepEqual(contactCommunicationActivities("person", activities).map((item) => item.id), ["new", "same-a", "same-b", "same-c", "old-captured-now", "undated"]);
  assert.deepEqual(contactCommunicationActivities("person", [...activities].reverse()).map((item) => item.id), ["new", "same-a", "same-b", "same-c", "old-captured-now", "undated"]);
  assert.equal(communicationActivityDate(activities[0], today), undefined);
});

test("unknown, future, impossible, and timestamp values never become an actual day", () => {
  for (const occurredAt of ["", "unknown", "2026-02-30", "2999-01-01", "2026-09-10T12:00:00Z"]) {
    const item = activity(occurredAt, { occurredAt, capturedAt: "2026-09-18T12:00:00Z" });
    assert.equal(communicationActivityDate(item, today), undefined);
    assert.equal(contactCommunicationDates("person", [item], today).lastOutreach, undefined);
  }
  const explicitlyUnknown = activity("source-unknown", { sourceDateKnown: false, occurredAt: "2026-09-10" });
  assert.equal(communicationActivityDate(explicitlyUnknown, today), undefined);
  assert.equal(communicationActivityDate(activity("leap", { occurredAt: "2024-02-29" }), today), "2024-02-29");
});

test("shared sorting preserves all visible people, excludes archives, and honors the supplied day", () => {
  const values = [activity("tomorrow", { occurredAt: "2026-09-19" }), activity("known", { contactId: "another-person", occurredAt: "2026-09-18" }), activity("archived", { archivedAt: today }), activity("unknown", { occurredAt: "", createdAt: "2026-09-01T12:00:00Z" })];
  const before = structuredClone(values);
  assert.deepEqual(sortCommunicationActivities(values, today).map((item) => item.id), ["known", "tomorrow", "unknown"]);
  assert.deepEqual(sortCommunicationActivities(values, "2026-09-19").map((item) => item.id), ["tomorrow", "known", "unknown"]);
  assert.deepEqual(values, before);
});

test("sending unanswered outreach never creates a reply or conversation", () => {
  const activities = ["Outreach sent", "Follow-up sent", "Call attempted", "Connection requested"].map((metricType, index) => activity(String(index), { metricType: metricType as ActivityItem["metricType"], occurredAt: `2026-09-${10 + index}` }));
  assert.deepEqual(contactCommunicationDates("person", activities, today), { lastOutreach: "2026-09-13", lastReply: undefined, lastConversation: undefined, lastInteraction: "2026-09-13" });
});

test("actual reply and completed conversation remain separate from attempts, bookings, and capture dates", () => {
  const activities = [activity("sent", { occurredAt: "2026-09-16" }), activity("reply", { metricType: "Reply received", occurredAt: "2026-09-12", capturedAt: "2026-09-18T12:00:00Z" }), activity("held", { metricType: "Meeting held", occurredAt: "2026-09-14" }), activity("booked", { metricType: "Meeting booked", occurredAt: "2026-09-17" }), activity("no-show", { metricType: "Meeting no-show", occurredAt: "2026-09-18" })];
  assert.deepEqual(contactCommunicationDates("person", activities, today), { lastOutreach: "2026-09-16", lastReply: "2026-09-12", lastConversation: "2026-09-14", lastInteraction: "2026-09-18" });
  assert.equal(contactCommunicationDates("person", [activity("call", { metricType: "Call connected" })], today).lastConversation, "2026-09-10");
  assert.equal(contactCommunicationDates("person", [activity("check-in", { metricType: "Check-in completed" })], today).lastConversation, "2026-09-10");
});

test("editing, unlinking, archiving, and deleting events recalculates recency from remaining evidence", () => {
  const older = activity("older", { metricType: "Reply received", occurredAt: "2026-09-05" });
  const newest = activity("newest", { metricType: "Reply received", occurredAt: "2026-09-12" });
  assert.equal(contactCommunicationDates("person", [older, newest], today).lastReply, "2026-09-12");
  for (const changes of [{ occurredAt: "2026-09-01" }, { contactId: "other-person" }, { archivedAt: today }, { sourceDateKnown: false }]) {
    assert.equal(contactCommunicationDates("person", [older, { ...newest, ...changes }], today).lastReply, "2026-09-05");
  }
  assert.equal(contactCommunicationDates("person", [older], today).lastReply, "2026-09-05");
  assert.deepEqual(contactCommunicationDates("person", [], today), { lastOutreach: undefined, lastReply: undefined, lastConversation: undefined, lastInteraction: undefined });
});

test("incoming connected calls record a conversation without inventing outreach or message replies", () => {
  const incoming = cleanActivities([activity("inbound", { channel: "Call", metricType: "Incoming call connected", occurredAt: "2026-09-17" })])[0];
  assert.equal(incoming.metricType, "Incoming call connected");
  assert.deepEqual(contactCommunicationDates("person", [incoming], today), { lastOutreach: undefined, lastReply: undefined, lastConversation: "2026-09-17", lastInteraction: "2026-09-17" });
  const totals = gtmMetrics(workspace({ contacts: [person()], activities: [incoming] }), "2026-09", today);
  assert.equal(totals.outreachCount, 0);
  assert.equal(totals.callsAttempted, 0);
  assert.equal(totals.callsConnected, 0);
  assert.equal(totals.replies, 0);
  const reviewed = applyAgentWorkspaceActions(workspace(), [{ type: "create", collection: "activities", data: { channel: "Call", metricType: "Incoming call connected", summary: "Caller returned the proposal question", occurredAt: "2026-09-17" } }]);
  assert.equal(reviewed.workspace.activities[0].metricType, "Incoming call connected");
});

test("incoming care conversations update account check-ins and coordinate later outreach", () => {
  const account = cleanAccounts([{ id: "current-employer", name: "Current employer", nextCheckIn: "2026-09-17", checkInCadence: "One-time" }])[0];
  const incoming = activity("inbound", { channel: "Call", metricType: "Incoming call connected", purpose: "Client relationship", occurredAt: "2026-09-17" });
  const dates = accountEngagementDates(account, [incoming], today);
  assert.equal(dates.lastSubstantiveConversation, "2026-09-17");
  assert.equal(dates.lastSellerOutreach, "");
  assert.equal(dates.lastBuyerResponse, "");
  assert.equal(accountRelationship(account, workspace({ activities: [incoming] }), today).completedOneTime, true);
  assert.equal(outreachGuard(account, [incoming], today).blocked, true);
  assert.equal(accountRelationship(account, workspace({ activities: [{ ...incoming, sourceDateKnown: false }] }), today).completedOneTime, false);
  assert.equal(accountRelationship(account, workspace({ activities: [{ ...incoming, archivedAt: today }] }), today).completedOneTime, false);
});

test("historical contact field and today's capture timestamp do not refresh a person's engagement", () => {
  const contact = person({ lastContact: "2026-09-18" });
  const activities = [activity("old", { accountId: "old-employer", occurredAt: "2026-05-10", metricType: "Reply received", capturedAt: "2026-09-18T12:00:00Z", captureMethod: "Forwarded email" })];
  assert.equal(contactCommunicationDates(contact.id, activities, today).lastReply, "2026-05-10");
  assert.equal(activities[0].accountId, "old-employer");
});

test("next follow-up is the earliest exact-contact open commitment, including overdue work", () => {
  const contact = person({ nextAction: "Check the agreement", nextActionDue: "2026-09-22", nurture: nurture() });
  const tasks = [task("future"), task("past", { due: "2026-09-17" }), task("other-person", { relatedId: "someone-else", due: "2026-09-01" }), task("account-wide", { relatedType: "account", relatedId: "current-employer", due: "2026-09-02" }), task("done", { done: true, due: "2026-09-03" }), task("invalid", { due: "2026-02-30" })];
  assert.deepEqual(nextContactFollowUp(contact, tasks, today), { date: "2026-09-17", title: "Follow up past", source: "task", taskId: "past", overdue: true });
  assert.deepEqual(nextContactFollowUp(contact, [], today), { date: "2026-09-19", title: "Send the promised example", source: "nurture", overdue: false });
});

test("only explicit dated Personal or Coordinated mix active nurture becomes a follow-up", () => {
  for (const changes of [{ method: "Campaign" as const }, { state: "Paused" as const }, { state: "Ended" as const }, { nextAction: "" }, { dueDate: "" }, { dueDate: "next week" }]) {
    assert.equal(nextContactFollowUp(person({ nurture: nurture(changes) }), [], today), undefined);
  }
  assert.equal(nextContactFollowUp(person({ email: "person@example.test", nurture: nurture({ method: "Coordinated mix", campaign: "Approved campaign", emailEligibility: "Reviewed eligible", eligibilityAccountId: "current-employer", eligibilityEmail: "person@example.test", eligibilityEvidence: "Reviewed subscription" }) }), [], today)?.source, "nurture");
  assert.equal(nextContactFollowUp(person({ nextActionDue: "2026-09-19" }), [], today), undefined);
  assert.equal(nextContactFollowUp(person({ nextAction: "Reach out" }), [], today), undefined);
  assert.equal(nextContactFollowUp(person({ nextAction: "Reach out", nextActionDue: "2026-09-19" }), [], today)?.source, "contact");
});

test("deleted, archived, completed-parent, missing-parent, and cyclic subtasks do not leak into follow-up", () => {
  const archived = { ...task("archive", { due: "2026-09-10" }), archivedAt: today };
  const deleted = { ...task("deleted", { due: "2026-09-10" }), deletedAt: today };
  const tasks = [archived, deleted, task("done-parent", { done: true }), task("child-done-parent", { parentId: "done-parent", due: "2026-09-10" }), task("orphan", { parentId: "hidden-or-deleted", due: "2026-09-10" }), task("self-cycle", { parentId: "self-cycle", due: "2026-09-10" }), task("cycle-a", { parentId: "cycle-b", due: "2026-09-10" }), task("cycle-b", { parentId: "cycle-a", due: "2026-09-10" })];
  assert.equal(nextContactFollowUp(person(), tasks, today), undefined);
  assert.equal(nextContactFollowUp(person(), [task("parent", { due: "2026-09-21" }), task("child", { parentId: "parent", due: "2026-09-19" })], today)?.taskId, "child");
  assert.equal(nextContactFollowUp(person({ archivedAt: today }), [task("valid")], today), undefined);
});

test("equal follow-up dates prefer actionable tasks and stable task IDs", () => {
  const contact = person({ nextAction: "Contact action", nextActionDue: "2026-09-19", nurture: nurture() });
  const tasks = [task("b", { due: "2026-09-19" }), task("a", { due: "2026-09-19" })];
  assert.equal(nextContactFollowUp(contact, tasks, today)?.taskId, "a");
  assert.equal(nextContactFollowUp(contact, [...tasks].reverse(), today)?.taskId, "a");
  assert.equal(nextContactFollowUp(person(), [task("undated", { due: "Today" })], today), undefined);
});

test("all shared channels survive normalization and unsupported channels remain Other", () => {
  for (const channel of ACTIVITY_CHANNELS) assert.equal(cleanActivities([activity(channel, { channel })])[0].channel, channel);
  assert.equal(cleanActivities([{ ...activity("unknown"), channel: "Unsupported channel" }])[0].channel, "Other");
});

test("long pasted messages survive normalization and SQLite round-trip, with a bounded maximum", () => {
  const body = `First message\nReply\n${"A".repeat(ACTIVITY_MESSAGE_MAX_LENGTH - 20)}`;
  const cleaned = cleanActivities([activity("sms", { channel: "Text / SMS", outcome: body, captureMethod: "Pasted message" })])[0];
  assert.equal(cleaned.outcome, body);
  assert.equal(cleanActivities([activity("long", { outcome: "A".repeat(ACTIVITY_MESSAGE_MAX_LENGTH + 1) })])[0].outcome.length, ACTIVITY_MESSAGE_MAX_LENGTH);
  const database = initializeWorkspaceStore(new DatabaseSync(":memory:"));
  try {
    writeWorkspaceState(database, workspace({ activities: [cleaned] }));
    assert.equal(readWorkspaceState(database).activities[0].outcome, body);
    assert.equal(readWorkspaceState(database).activities[0].channel, "Text / SMS");
  } finally { database.close(); }
});

test("reviewed SOSA create and update preserve long messages and new channels without silent overflow", () => {
  const contact = person();
  const state = workspace({ contacts: [contact], accounts: cleanAccounts([{ id: contact.accountId, name: "Current employer" }]) });
  const body = "A".repeat(ACTIVITY_MESSAGE_MAX_LENGTH);
  const created = applyAgentWorkspaceActions(state, [{ type: "create", collection: "activities", data: { accountId: contact.accountId, contactId: contact.id, channel: "Text / SMS", summary: "Shared examples by text", metricType: "Follow-up sent", occurredAt: "2026-09-10", outcome: body } }]);
  assert.equal(created.workspace.activities[0].outcome, body);
  assert.equal(created.workspace.activities[0].channel, "Text / SMS");
  const updated = applyAgentWorkspaceActions(created.workspace, [{ type: "update", collection: "activities", recordId: created.workspace.activities[0].id, data: { outcome: body, channel: "WhatsApp" } }]);
  assert.equal(updated.workspace.activities[0].outcome, body);
  assert.equal(updated.workspace.activities[0].channel, "WhatsApp");
  assert.throws(() => applyAgentWorkspaceActions(state, [{ type: "create", collection: "activities", data: { summary: "Long", outcome: `${body}A` } }]), /at most 20,000 characters/);
  assert.throws(() => applyAgentWorkspaceActions(created.workspace, [{ type: "update", collection: "activities", recordId: created.workspace.activities[0].id, data: { outcome: `${body}A` } }]), /at most 20,000 characters/);
});
