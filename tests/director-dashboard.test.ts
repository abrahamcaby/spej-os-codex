import assert from "node:assert/strict";
import test from "node:test";
import { buildDirectorAttention, summarizeDirectorAttention } from "../lib/director-dashboard";
import type { WorkspaceState } from "../lib/types";

function workspace(): WorkspaceState {
  return { reminders: [], tasks: [], content: [], accounts: [], contacts: [], activities: [], opportunities: [], partnerships: [], projects: [], campaigns: [], marketingMetrics: [] };
}

test("director attention joins overdue work, missing revenue actions, reviews, and campaign gaps", () => {
  const state = workspace();
  state.tasks.push({ id: "t1", title: "Send proposal", description: "", due: "2026-08-26", recurrence: "One-time", priority: "Urgent", owner: "Aby", status: "In Progress", effort: "Small", done: false });
  state.opportunities.push({ id: "o1", accountId: "a1", name: "AI Office", stage: "Qualify", forecast: "Pipeline", value: 20_000, closeDate: "2026-09-30", owner: "Aby", nextSpejAction: "", nextCustomerDecision: "Confirm sponsor", nextActionDue: "", source: "Referral", notes: "", createdAt: "2026-08-01T00:00:00Z" });
  state.content.push({ id: "c1", title: "Private AI guide", format: "Article", stage: "Drafting", publishDate: "2026-09-03", angle: "", pillar: "Private AI, Sovereignty & Data Residency", stream: "Spej Authority-building content", owner: "Aby", approver: "Ken", reviewStatus: "Pending Review", reviewDue: "2026-08-28", createdAt: "2026-08-01T00:00:00Z" });
  state.campaigns.push({ id: "m1", name: "AI Office launch", status: "Planning", objective: "", audience: "Mid-market leaders", owner: "Aby", primaryChannel: "Multi-channel", startDate: "2026-09-01", endDate: "", successMeasure: "", notes: "", createdAt: "2026-08-01T00:00:00Z" });

  const items = buildDirectorAttention({ ...state, now: new Date(2026, 7, 27, 12) });
  assert.equal(items[0].kind, "task");
  assert.ok(items.some((item) => item.kind === "opportunity" && item.severity === "critical"));
  assert.ok(items.some((item) => item.kind === "review" && item.owner === "Ken"));
  assert.ok(items.some((item) => item.kind === "campaign" && item.severity === "critical"));
  const summary = summarizeDirectorAttention(items, new Date(2026, 7, 27, 12));
  assert.equal(summary.overdue, 1);
  assert.equal(summary.reviews, 1);
});

test("director attention excludes completed and distant healthy work", () => {
  const state = workspace();
  state.tasks.push({ id: "done", title: "Done", description: "", due: "2026-08-20", recurrence: "One-time", priority: "Normal", done: true });
  state.projects.push({ id: "p1", accountId: "", name: "Future delivery", phase: "Delivery", commercialStatus: "Contracted", operationalStatus: "Active", health: "On Track", owner: "Aby", startDate: "2026-10-01", nextMilestone: "Kickoff", dueDate: "2026-10-15", notes: "", createdAt: "2026-08-01T00:00:00Z" });
  const items = buildDirectorAttention({ ...state, now: new Date(2026, 7, 27, 12) });
  assert.equal(items.length, 0);
});

test("completed opportunity actions leave Today while actual linked tasks and legacy actions remain", () => {
  const state = workspace();
  const deal = { accountId: "a1", name: "Reviewed engagement", stage: "Qualify" as const, forecast: "Pipeline" as const, value: 20_000, closeDate: "2026-09-30", owner: "Aby", nextSpejAction: "Confirm sponsor decision", nextCustomerDecision: "Choose sponsor", nextActionDue: "2026-08-20", source: "Referral", notes: "", createdAt: "2026-08-01T00:00:00Z" };
  state.opportunities.push({ ...deal, id: "completed", actionState: "Completed" }, { ...deal, id: "legacy" });
  state.tasks.push({ id: "real-task", title: "Send the promised analysis", description: "", due: "2026-08-26", recurrence: "One-time", priority: "High", owner: "Aby", relatedType: "opportunity", relatedId: "completed", done: false });
  const before = structuredClone(state);
  const items = buildDirectorAttention({ ...state, now: new Date(2026, 7, 27, 12) });
  assert.equal(items.some((item) => item.id === "opportunity:completed"), false);
  assert.ok(items.some((item) => item.id === "opportunity:legacy"));
  assert.ok(items.some((item) => item.id === "task:real-task" && item.severity === "critical"));
  assert.equal(summarizeDirectorAttention(items, new Date(2026, 7, 27, 12)).overdue, 2);
  assert.deepEqual(state, before);
});

test("client delivery tasks route from Today to the delivery workspace", () => {
  const state = workspace();
  state.tasks.push(
    { id: "delivery", title: "Run workshop", description: "", due: "2026-08-27", recurrence: "One-time", priority: "High", category: "Client Delivery", done: false },
    { id: "sales", title: "Send follow-up", description: "", due: "2026-08-27", recurrence: "One-time", priority: "High", category: "Sales", done: false },
  );
  const items = buildDirectorAttention({ ...state, now: new Date(2026, 7, 27, 12) });
  assert.equal(items.find((item) => item.recordId === "delivery")?.tab, "delivery-work");
  assert.equal(items.find((item) => item.recordId === "sales")?.tab, "tasks");
});

test("Today includes the complete open task backlog and routes linked GTM initiatives correctly", () => {
  const state = workspace();
  state.projects.push({ id: "gtm-project", accountId: "", name: "Launch initiative", phase: "Not Applicable", workArea: "GTM", commercialStatus: "Not Applicable", operationalStatus: "Active", owner: "Aby", nextMilestone: "Launch", dueDate: "2026-12-01", notes: "", createdAt: "2026-08-01T00:00:00Z" });
  state.tasks.push({ id: "future", title: "Prepare launch assets", description: "", due: "2026-12-01", recurrence: "One-time", priority: "Normal", relatedType: "project", relatedId: "gtm-project", category: "Project Work", done: false });
  const items = buildDirectorAttention({ ...state, now: new Date(2026, 7, 27, 12) });
  assert.equal(items.find((item) => item.recordId === "future")?.tab, "tasks");
});

test("Today avoids duplicate record actions when a matching open linked task exists", () => {
  const state = workspace();
  state.opportunities.push({ id: "o1", accountId: "a1", name: "AI Office", stage: "Qualify", forecast: "Pipeline", value: 20_000, closeDate: "2026-09-30", owner: "Aby", nextSpejAction: "Send proposal", nextCustomerDecision: "Confirm sponsor", nextActionDue: "2026-08-27", source: "Referral", notes: "", createdAt: "2026-08-01T00:00:00Z" });
  state.tasks.push({ id: "t1", title: "Send proposal", description: "", due: "2026-08-27", recurrence: "One-time", priority: "High", owner: "Aby", relatedType: "opportunity", relatedId: "o1", done: false });
  const items = buildDirectorAttention({ ...state, now: new Date(2026, 7, 27, 12) });
  assert.equal(items.filter((item) => item.recordId === "o1").length, 0);
  assert.equal(items.filter((item) => item.recordId === "t1").length, 1);
});

test("linked tasks only cover the same opportunity action, owner, and deadline", () => {
  const state = workspace();
  const opportunity = { accountId: "a1", stage: "Qualify" as const, forecast: "Pipeline" as const, value: 20_000, closeDate: "2026-09-30", owner: "Aby", nextSpejAction: "Call buyer", nextCustomerDecision: "Confirm sponsor", nextActionDue: "2026-08-26", source: "Referral", notes: "", createdAt: "2026-08-01T00:00:00Z" };
  state.opportunities.push(
    { ...opportunity, id: "different-purpose", name: "Different purpose" },
    { ...opportunity, id: "different-owner", name: "Different owner" },
    { ...opportunity, id: "missing-task-owner", name: "Missing task owner" },
    { ...opportunity, id: "different-deadline", name: "Different deadline" },
    { ...opportunity, id: "future-task", name: "Future task" },
    { ...opportunity, id: "exact", name: "Exact duplicate" },
    { ...opportunity, id: "missing", name: "Missing action", nextSpejAction: "" },
  );
  const task = { description: "", recurrence: "One-time", priority: "High" as const, owner: "Aby", due: "2026-08-26", title: "Call buyer", relatedType: "opportunity" as const, done: false };
  state.tasks.push(
    { ...task, id: "purpose-task", relatedId: "different-purpose", title: "Prepare account plan" },
    { ...task, id: "owner-task", relatedId: "different-owner", owner: "Ken" },
    { ...task, id: "unowned-task", relatedId: "missing-task-owner", owner: undefined },
    { ...task, id: "deadline-task", relatedId: "different-deadline", due: "2026-10-15" },
    { ...task, id: "future-linked-task", relatedId: "future-task", owner: "Ken", due: "2026-10-15", title: "Prepare account plan" },
    { ...task, id: "exact-task", relatedId: "exact" },
    { ...task, id: "missing-task", relatedId: "missing", title: "Define the next action for Missing action" },
  );

  const items = buildDirectorAttention({ ...state, now: new Date(2026, 7, 27, 12) });
  const opportunityIds = items.filter((item) => item.kind === "opportunity").map((item) => item.recordId);
  assert.ok(opportunityIds.includes("different-purpose"));
  assert.ok(opportunityIds.includes("different-owner"));
  assert.ok(opportunityIds.includes("missing-task-owner"));
  assert.ok(opportunityIds.includes("different-deadline"));
  assert.ok(opportunityIds.includes("future-task"));
  assert.ok(opportunityIds.includes("missing"));
  assert.equal(opportunityIds.includes("exact"), false);
});

test("linked tasks cannot hide an approver's review or remove it from the review count", () => {
  const state = workspace();
  state.content.push(
    { id: "review", title: "Private AI guide", format: "Article", stage: "Drafting", publishDate: "2026-09-03", angle: "", pillar: "Private AI, Sovereignty & Data Residency", stream: "Spej Authority-building content", owner: "Aby", approver: "Ken", reviewStatus: "Pending Review", reviewDue: "2026-08-26", createdAt: "2026-08-01T00:00:00Z" },
    { id: "covered-review", title: "Buyer guide", format: "Article", stage: "Drafting", publishDate: "2026-09-03", angle: "", pillar: "Private AI, Sovereignty & Data Residency", stream: "Spej Authority-building content", owner: "Aby", approver: "Ken", reviewStatus: "Pending Review", reviewDue: "2026-08-27", createdAt: "2026-08-01T00:00:00Z" },
  );
  state.tasks.push(
    { id: "production", title: "Produce: Private AI guide", description: "", due: "2026-08-26", recurrence: "One-time", priority: "High", owner: "Aby", relatedType: "content", relatedId: "review", done: false },
    { id: "review-task", title: "Review: Buyer guide", description: "", due: "2026-08-27", recurrence: "One-time", priority: "High", owner: "Ken", relatedType: "content", relatedId: "covered-review", done: false },
  );

  const items = buildDirectorAttention({ ...state, now: new Date(2026, 7, 27, 12) });
  assert.ok(items.some((item) => item.id === "review:review" && item.owner === "Ken"));
  assert.ok(items.some((item) => item.id === "review:covered-review" && item.owner === "Ken"));
  assert.equal(summarizeDirectorAttention(items, new Date(2026, 7, 27, 12)).reviews, 2);
});

test("matching tasks never hide critical At Risk partnership or project context", () => {
  const state = workspace();
  state.partnerships.push({ id: "partner", accountId: "a1", name: "Partner", type: "Strategic alliance", stage: "Active", health: "At Risk", owner: "Aby", nextAction: "Repair executive alignment", dueDate: "2026-10-15", notes: "", createdAt: "2026-08-01T00:00:00Z" });
  state.projects.push({ id: "project", accountId: "a1", name: "Delivery", phase: "Delivery", commercialStatus: "Contracted", operationalStatus: "Active", health: "At Risk", owner: "Aby", nextMilestone: "Recover delivery plan", dueDate: "2026-10-15", notes: "", createdAt: "2026-08-01T00:00:00Z" });
  state.tasks.push(
    { id: "partner-task", title: "Repair executive alignment", description: "", due: "2026-10-15", recurrence: "One-time", priority: "High", owner: "Aby", relatedType: "partnership", relatedId: "partner", done: false },
    { id: "project-task", title: "Recover delivery plan", description: "", due: "2026-10-15", recurrence: "One-time", priority: "High", owner: "Aby", relatedType: "project", relatedId: "project", done: false },
  );

  const items = buildDirectorAttention({ ...state, now: new Date(2026, 7, 27, 12) });
  assert.ok(items.some((item) => item.id === "partnership:partner" && item.severity === "critical"));
  assert.ok(items.some((item) => item.id === "project:project" && item.severity === "critical"));
});

test("a selected check-in task must retain the check-in owner and due date", () => {
  const state = workspace();
  state.accounts.push(
    { id: "mismatch", name: "Mismatch client", type: "Client", status: "Active", owner: "Sagar", website: "", notes: "", clientStatus: "Current client", checkInCadence: "One-time", checkInOwner: "Sagar", nextCheckIn: "2026-08-26", checkInTaskId: "wrong-cover", createdAt: "2026-08-01T00:00:00Z" },
    { id: "covered", name: "Covered client", type: "Client", status: "Active", owner: "Sagar", website: "", notes: "", clientStatus: "Current client", checkInCadence: "One-time", checkInOwner: "Sagar", nextCheckIn: "2026-08-27", checkInTaskId: "exact-cover", createdAt: "2026-08-01T00:00:00Z" },
  );
  state.tasks.push(
    { id: "wrong-cover", title: "Check in with Mismatch client", description: "", due: "2026-09-02", recurrence: "One-time", priority: "Normal", owner: "Ken", relatedType: "account", relatedId: "mismatch", done: false },
    { id: "exact-cover", title: "Check in with Covered client", description: "", due: "2026-08-27", recurrence: "One-time", priority: "Normal", owner: "Sagar", relatedType: "account", relatedId: "covered", done: false },
  );

  const items = buildDirectorAttention({ ...state, now: new Date(2026, 7, 27, 12) });
  assert.ok(items.some((item) => item.id === "check-in:mismatch"));
  assert.equal(items.some((item) => item.id === "check-in:covered"), false);
});

test("relationship actions use the linked account owner", () => {
  const state = workspace();
  state.accounts.push({ id: "a1", name: "Example", type: "Prospect", status: "Active", owner: "Sagar", website: "", notes: "", createdAt: "2026-08-01T00:00:00Z" });
  state.contacts.push({ id: "c1", accountId: "a1", name: "Decision maker", title: "", email: "", relationshipStrength: "Developing", source: "Referral", lastContact: "", nextAction: "Follow up", nextActionDue: "2026-08-27", notes: "", createdAt: "2026-08-01T00:00:00Z" });
  const items = buildDirectorAttention({ ...state, now: new Date(2026, 7, 27, 12) });
  assert.equal(items.find((item) => item.recordId === "c1")?.owner, "Sagar");
});

test("Today keeps deadlines primary and uses Priority Intelligence only as a tie-breaker", () => {
  const state = workspace();
  state.accounts.push({ id: "a1", name: "Example", type: "Prospect", status: "Active", owner: "Owner", website: "", notes: "", companySizeBand: "5,000+", createdAt: "2026-08-01T00:00:00Z" });
  const base = { accountId: "a1", stage: "Qualify" as const, forecast: "Pipeline" as const, valueConfidence: "Validated" as const, seriousness: "Engaged" as const, decisionAccess: "Champion" as const, stakeholderCoverage: "Multi-threaded" as const, strategicFit: "High" as const, expansionPotential: "High" as const, closeDate: "2026-12-01", owner: "Owner", nextSpejAction: "Send follow-up", nextCustomerDecision: "Confirm scope", nextActionDue: "2026-09-03", source: "Referral", notes: "", createdAt: "2026-08-01T00:00:00Z" };
  state.opportunities.push(
    { ...base, id: "small", name: "Smaller opportunity", value: 15_000 },
    { ...base, id: "large", name: "Strategic opportunity", value: 2_000_000, annualRevenuePotential: 1_000_000 },
    { ...base, id: "future", name: "Future strategic opportunity", value: 2_000_000, annualRevenuePotential: 1_000_000, nextActionDue: "2026-10-15" },
  );
  const items = buildDirectorAttention({ ...state, now: new Date(2026, 8, 2, 12) });
  assert.deepEqual(items.filter((item) => item.kind === "opportunity").map((item) => item.recordId), ["large", "small"]);
  assert.equal(items.some((item) => item.recordId === "future"), false);
  assert.match(items.find((item) => item.recordId === "large")?.detail || "", /Strategic/);
});
