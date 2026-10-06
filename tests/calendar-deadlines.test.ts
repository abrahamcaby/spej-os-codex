import assert from "node:assert/strict";
import test from "node:test";
import { buildPersonalCalendarDeadlines } from "../lib/calendar-deadlines";
import { buildCalendarEntries } from "../lib/company-calendar";
import { getTeamViewProfile } from "../lib/team-views";
import type { AccountItem, CampaignItem, ContactItem, ContentItem, OpportunityItem, PartnershipItem, ProjectItem, TaskItem, WorkspaceState } from "../lib/types";

const DATE = "2026-09-17";
const CREATED = "2026-09-01T12:00:00.000Z";
const viewer = getTeamViewProfile("aby")!;
const engineer = getTeamViewProfile("sean")!;
const allRoutes = () => true;
function workspace(): WorkspaceState {
  return { reminders: [], tasks: [], content: [], accounts: [], contacts: [], activities: [], opportunities: [], partnerships: [], projects: [], campaigns: [], marketingMetrics: [] };
}
const task = (patch: Partial<TaskItem> = {}): TaskItem => ({ id: "task", title: "Review work", description: "", due: DATE, recurrence: "One-time", priority: "Normal", owner: "Aby", ownerProfileId: "aby", done: false, ...patch });
const project = (patch: Partial<ProjectItem> = {}): ProjectItem => ({ id: "project", accountId: "account", name: "Implementation", phase: "Delivery", workArea: "Client Delivery", commercialStatus: "Contracted", operationalStatus: "Active", owner: "Aby", ownerProfileId: "aby", nextMilestone: "Review acceptance", dueDate: DATE, endDate: "2026-09-25", notes: "", createdAt: CREATED, ...patch });
const content = (patch: Partial<ContentItem> = {}): ContentItem => ({ id: "content", title: "Implementation guide", format: "Article", stage: "Drafting", publishDate: "2026-09-23", angle: "", pillar: "Data Readiness, Integration & Legacy Systems", stream: "Spej Authority-building content", owner: "Aby", ownerProfileId: "aby", approver: "Sean", approverProfileId: "sean", reviewStatus: "Pending Review", reviewDue: DATE, createdAt: CREATED, ...patch });
const campaign = (patch: Partial<CampaignItem> = {}): CampaignItem => ({ id: "campaign", name: "Educational series", status: "Active", objective: "", audience: "", owner: "Aby", ownerProfileId: "aby", primaryChannel: "Multi-channel", startDate: DATE, endDate: "2026-09-25", successMeasure: "", notes: "", createdAt: CREATED, ...patch });
const opportunity = (patch: Partial<OpportunityItem> = {}): OpportunityItem => ({ id: "opportunity", accountId: "account", name: "Possible engagement", stage: "Qualify", forecast: "Pipeline", value: 10_000, closeDate: "2026-10-01", owner: "Aby", ownerProfileId: "aby", nextSpejAction: "Confirm requirements", nextCustomerDecision: "Review scope", nextActionDue: DATE, source: "Referral", notes: "", createdAt: CREATED, ...patch });
const partnership = (patch: Partial<PartnershipItem> = {}): PartnershipItem => ({ id: "partner", accountId: "account", name: "Delivery partnership", type: "Delivery", stage: "Active", health: "Healthy", owner: "Aby", ownerProfileId: "aby", nextAction: "Review handoff", dueDate: DATE, notes: "", createdAt: CREATED, ...patch });
const account = (patch: Partial<AccountItem> = {}): AccountItem => ({ id: "account", name: "Example organization", type: "Client", status: "Active", owner: "Aby", ownerProfileId: "aby", website: "", notes: "", nextCheckIn: DATE, nextMeetingDate: "2026-09-23", createdAt: CREATED, ...patch });
const contact = (patch: Partial<ContactItem> = {}): ContactItem => ({ id: "contact", accountId: "account", name: "Example contact", title: "Project lead", email: "lead@example.test", relationshipStrength: "Developing", nextAction: "Confirm requirements", nextActionDue: DATE, source: "Referral", lastContact: "", notes: "", createdAt: CREATED, ...patch });
function populated(): WorkspaceState {
  return { ...workspace(), tasks: [task()], projects: [project()], content: [content()], campaigns: [campaign()], opportunities: [opportunity()], partnerships: [partnership()], accounts: [account()], contacts: [contact()] };
}

test("stable owner IDs override display labels and unknown IDs do not fall back", () => {
  const records = workspace();
  records.tasks = [task({ id: "owned-by-id", owner: "Old display label" }), task({ id: "other-by-id", owner: "Aby", ownerProfileId: "sean" }), task({ id: "unknown-id", owner: "Aby", ownerProfileId: "unknown" }), task({ id: "legacy", ownerProfileId: undefined })];
  records.projects = [project({ id: "other-project", owner: "Aby", ownerProfileId: "sean" }), project({ id: "own-project", owner: "Old display label", endDate: undefined })];
  const entries = buildPersonalCalendarDeadlines(records, viewer, allRoutes);
  assert.deepEqual(entries.filter((entry) => entry.id.startsWith("task:")).map((entry) => entry.recordId), ["owned-by-id", "legacy"]);
  assert.ok(entries.some((entry) => entry.id === "project:own-project:milestone"));
  assert.ok(entries.every((entry) => entry.recordId !== "other-project"));
});

test("another profile's tasks are excluded even if company-wide or workspace-visible", () => {
  const records = workspace();
  records.tasks = [task({ id: "mine" }), task({ id: "other-company", ownerProfileId: "sean", visibility: "Company" }), task({ id: "other-workspace", ownerProfileId: "sean", visibility: "Workspace", workspaceId: "gtm" })];
  assert.deepEqual(buildPersonalCalendarDeadlines(records, viewer, allRoutes).map((entry) => entry.recordId), ["mine"]);
  assert.deepEqual(buildPersonalCalendarDeadlines(records, engineer, allRoutes).map((entry) => entry.recordId), ["other-company", "other-workspace"]);
});

test("hidden routes omit their deadlines even when the viewer owns every record", () => {
  const records = populated();
  assert.deepEqual(buildPersonalCalendarDeadlines(records, viewer, () => false), []);
  const entries = buildPersonalCalendarDeadlines(records, viewer, (route) => route === "projects");
  assert.equal(entries.length, 2);
  assert.ok(entries.every((entry) => entry.route === "projects" && entry.recordId === "project"));
});

test("completed, published, stopped, ended, inactive and archived records are omitted", () => {
  const records = workspace();
  records.tasks = [task({ done: true })];
  records.projects = [project({ id: "complete", operationalStatus: "Complete" }), project({ id: "stopped", operationalStatus: "Stopped" }), project({ id: "archived", archivedAt: CREATED })];
  records.content = [content({ stage: "Published" })];
  records.campaigns = [campaign({ status: "Complete" }), campaign({ id: "archived-campaign", archivedAt: CREATED })];
  records.opportunities = [opportunity({ stage: "Closed Won" }), opportunity({ id: "lost", stage: "Closed Lost" }), opportunity({ id: "archived-opportunity", archivedAt: CREATED })];
  records.partnerships = [partnership({ stage: "Paused / Ended" }), partnership({ id: "archived-partner", archivedAt: CREATED })];
  records.accounts = [account({ status: "Inactive" }), account({ id: "archived-account", archivedAt: CREATED })];
  records.contacts = [contact({ archivedAt: CREATED })];
  assert.deepEqual(buildPersonalCalendarDeadlines(records, viewer, allRoutes), []);
});

test("project milestones and distinct finish dates are retained with correct workspace routes", () => {
  const records = workspace();
  records.projects = [project(), project({ id: "same-date", endDate: DATE }), project({ id: "initiative", workArea: "GTM", endDate: undefined })];
  const entries = buildPersonalCalendarDeadlines(records, viewer, allRoutes);
  assert.deepEqual(entries.filter((entry) => entry.recordId === "project").map((entry) => [entry.id, entry.date, entry.route]), [
    ["project:project:milestone", DATE, "projects"], ["project:project:end", "2026-09-25", "projects"],
  ]);
  assert.equal(entries.filter((entry) => entry.recordId === "same-date").length, 1);
  assert.equal(entries.find((entry) => entry.recordId === "initiative")?.route, "gtm-initiatives");
  assert.match(entries[0].title, /Review acceptance/);
});

test("inactive accounts do not infer ordinary contact follow-up responsibility", () => {
  const records = workspace();
  records.accounts = [account({ status: "Inactive" })];
  records.contacts = [contact()];
  assert.deepEqual(buildPersonalCalendarDeadlines(records, viewer, allRoutes), []);
});

test("linked project workspace controls a task's calendar navigation", () => {
  const records = workspace();
  records.projects = [project(), project({ id: "initiative", workArea: "GTM" })];
  records.tasks = [task({ id: "delivery", relatedType: "project", relatedId: "project", category: "Sales" }), task({ id: "growth", relatedType: "project", relatedId: "initiative", category: "Project Work" })];
  const entries = buildPersonalCalendarDeadlines(records, viewer, allRoutes);
  assert.equal(entries.find((entry) => entry.id === "task:delivery")?.route, "delivery-work");
  assert.equal(entries.find((entry) => entry.id === "task:growth")?.route, "tasks");
});

test("content owners see publishing and review dates while reviewers see only review responsibilities", () => {
  const records = workspace();
  records.content = [content()];
  assert.deepEqual(buildPersonalCalendarDeadlines(records, viewer, allRoutes).map((entry) => entry.id), ["content:content:publish", "content:content:review"]);
  assert.deepEqual(buildPersonalCalendarDeadlines(records, engineer, allRoutes).map((entry) => entry.id), ["content:content:review"]);
  records.content[0] = content({ approver: "Sean", approverProfileId: "ken" });
  assert.deepEqual(buildPersonalCalendarDeadlines(records, engineer, allRoutes), []);
  records.content[0] = content({ reviewStatus: "Approved" });
  assert.deepEqual(buildPersonalCalendarDeadlines(records, viewer, allRoutes).map((entry) => entry.id), ["content:content:publish"]);
  assert.deepEqual(buildPersonalCalendarDeadlines(records, engineer, allRoutes), []);
});

test("completed opportunity actions do not remove the separately labelled forecast close date", () => {
  const records = workspace();
  records.opportunities = [opportunity({ actionState: "Completed" })];
  const entries = buildPersonalCalendarDeadlines(records, viewer, allRoutes);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, "opportunity:opportunity:close");
  assert.match(entries[0].label, /forecast only/);
});

test("check-in assignments are distinct from account ownership and meeting-date markers stay unconfirmed", () => {
  const records = workspace();
  records.accounts = [account({ checkInOwner: "Sean" })];
  const ownerDeadlines = buildPersonalCalendarDeadlines(records, viewer, allRoutes);
  const checkInDeadlines = buildPersonalCalendarDeadlines(records, engineer, allRoutes);
  assert.deepEqual(ownerDeadlines.map((entry) => entry.id), ["account:account:meeting"]);
  assert.deepEqual(checkInDeadlines.map((entry) => entry.id), ["account:account:checkin"]);
  const entries = buildCalendarEntries({}, ownerDeadlines, DATE);
  assert.equal(entries[0].recordId, "client:account");
  assert.equal(entries[0].kind, "deadline");
  assert.match(entries[0].label, /CRM meeting date.*time unconfirmed/);
  assert.equal(entries[0].start, undefined);
  assert.equal(entries[0].end, undefined);
});

test("contact follow-up follows account ownership while active nurture follows its explicit owner", () => {
  const records = workspace();
  records.accounts = [account({ nextCheckIn: undefined, nextMeetingDate: undefined })];
  records.contacts = [contact({ nurture: { method: "Personal", state: "Active", owner: "Sean", channel: "Call", campaign: "", nextAction: "Review relationship", dueDate: DATE, trigger: "", coordination: "", emailEligibility: "Unknown", eligibilityEvidence: "", eligibilityAccountId: "account", eligibilityEmail: "lead@example.test" } })];
  assert.deepEqual(buildPersonalCalendarDeadlines(records, viewer, allRoutes).map((entry) => entry.id), ["contact:contact:followup"]);
  assert.deepEqual(buildPersonalCalendarDeadlines(records, engineer, allRoutes).map((entry) => entry.id), ["contact:contact:nurture"]);
  records.contacts[0].nurture!.state = "Paused";
  assert.deepEqual(buildPersonalCalendarDeadlines(records, engineer, allRoutes), []);
});

test("blank dates are omitted and legacy Today is resolved only by the calendar projection", () => {
  const records = workspace();
  records.tasks = [task({ id: "today", due: "Today" }), task({ id: "blank", due: " " }), task({ id: "unknown", due: "TBD" })];
  const deadlines = buildPersonalCalendarDeadlines(records, viewer, allRoutes);
  assert.deepEqual(deadlines.map((entry) => entry.date), ["Today", "TBD"]);
  const entries = buildCalendarEntries({}, deadlines, DATE);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].date, DATE);
});

test("projection preserves every canonical input and returns independent deadline objects", () => {
  const records = populated();
  const original = structuredClone(records);
  const entries = buildPersonalCalendarDeadlines(records, viewer, allRoutes);
  assert.ok(entries.length > 8);
  entries[0].title = "Changed projection";
  assert.deepEqual(records, original);
});
