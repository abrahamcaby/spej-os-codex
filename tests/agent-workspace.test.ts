import assert from "node:assert/strict";
import test from "node:test";
import { applyAgentWorkspaceActions } from "../lib/agent-workspace";
import type { WorkspaceState } from "../lib/types";

function emptyWorkspace(): WorkspaceState {
  return { reminders: [], tasks: [], content: [], accounts: [], contacts: [], activities: [], opportunities: [], partnerships: [], projects: [], campaigns: [], marketingMetrics: [] };
}

test("SOSA cannot rewrite reviewed relationship context or fabricate commercial and action states", () => {
  const guarded = {
    accounts: ["originalSource", "contextFacts", "connections", "nurturePlan", "outreachHold", "aiProfile"],
    contacts: ["relationshipRoles", "employmentHistory", "nurture"],
    projects: ["deliveryContext", "adoptionOutcome", "progressUpdates", "resources", "linkedRecords"],
    activities: ["capturedAt", "captureMethod", "sourceDateKnown"],
    opportunities: ["actionState", "valueMeaning", "discoveryEconomics"],
  };
  for (const [collection, fields] of Object.entries(guarded)) for (const field of fields) {
    assert.throws(() => applyAgentWorkspaceActions(emptyWorkspace(), [{ type: "create", collection, data: { name: "Synthetic", [field]: null } }]), /require human review/);
  }
});

test("SOSA cannot forge, replace or clear activity source provenance", () => {
  const workspace = emptyWorkspace();
  workspace.activities.push({ id: "existing-meeting", accountId: "", contactId: "", channel: "Meeting", metricType: "Meeting held", summary: "Saved meeting", outcome: "", occurredAt: "2026-09-01", createdAt: "2026-09-01T12:00:00Z", sourceArtifactId: "saved-intake", sourceLabel: "Manual meeting intake" });
  const before = structuredClone(workspace);
  for (const type of ["create", "update"] as const) for (const field of ["sourceArtifactId", "sourceLabel"]) for (const value of ["forged-source", "", null]) {
    assert.throws(() => applyAgentWorkspaceActions(workspace, [{ type, collection: "activities", recordId: "existing-meeting", trusted: true, data: { summary: "Changed meeting", [field]: value } }]), /source provenance is server-controlled/i);
  }
  const normalEdit = applyAgentWorkspaceActions(workspace, [{ type: "update", collection: "activities", recordId: "existing-meeting", data: { outcome: "Reviewed follow-up" } }]);
  assert.equal(normalEdit.workspace.activities[0].sourceArtifactId, "saved-intake");
  assert.equal(normalEdit.workspace.activities[0].sourceLabel, "Manual meeting intake");
  assert.equal(normalEdit.workspace.activities[0].outcome, "Reviewed follow-up");
  assert.deepEqual(workspace, before);
});

test("agent proposals can create a linked account, person, and follow-up without writing the source workspace", () => {
  const source = emptyWorkspace();
  const result = applyAgentWorkspaceActions(source, [
    { type: "create", collection: "accounts", label: "Add Acme", data: { name: "Acme", type: "Prospect" } },
    { type: "create", collection: "contacts", label: "Add Sarah", data: { name: "Sarah Chen", accountName: "Acme", buyingRole: "Decision Maker", source: "In-person event" } },
    { type: "create", collection: "tasks", label: "Follow up", data: { title: "Follow up with Sarah", due: "2026-08-28", category: "Sales", done: false } },
  ]);
  assert.equal(source.accounts.length, 0);
  assert.equal(result.workspace.accounts[0].name, "Acme");
  assert.equal(result.workspace.contacts[0].accountId, result.workspace.accounts[0].id);
  assert.equal(result.workspace.contacts[0].source, "In-person event");
  assert.equal(result.workspace.tasks[0].title, "Follow up with Sarah");
  assert.equal(result.workspace.tasks[0].visibility, "Private");
  assert.equal(result.workspace.tasks[0].workspaceId, "gtm");
  assert.equal(result.actions.length, 3);
});

test("agent proposals update exact records and only complete tasks", () => {
  const source = emptyWorkspace();
  source.accounts.push({ id: "a1", name: "Acme", type: "Prospect", status: "Active", owner: "Aby", website: "", notes: "", createdAt: "2026-08-01T00:00:00Z" });
  source.tasks.push({ id: "t1", title: "Call Acme", description: "", due: "2026-08-27", recurrence: "One-time", priority: "Normal", category: "Sales", done: false });
  const result = applyAgentWorkspaceActions(source, [
    { type: "update", collection: "accounts", recordId: "a1", data: { status: "Nurture" } },
    { type: "complete", collection: "tasks", recordId: "t1", data: {} },
    { type: "complete", collection: "accounts", recordId: "a1", data: {} },
  ]);
  assert.equal(result.workspace.accounts[0].status, "Nurture");
  assert.equal(result.workspace.tasks[0].done, true);
  assert.equal(result.actions.length, 2);
});

test("agent proposals reject oversized change batches", () => {
  assert.throws(() => applyAgentWorkspaceActions(emptyWorkspace(), Array.from({ length: 13 }, (_, index) => ({ type: "create", collection: "tasks", data: { title: `Task ${index}` } }))), /too many changes/i);
});

test("agent proposals link newly created subtasks to their parent by exact name", () => {
  const result = applyAgentWorkspaceActions(emptyWorkspace(), [
    { type: "create", collection: "tasks", label: "Create launch project", data: { title: "Launch the AI Office campaign", due: "2026-09-30", priority: "High", category: "Marketing" } },
    { type: "create", collection: "tasks", label: "Create copy subtask", data: { title: "Approve campaign copy", parentTaskName: "Launch the AI Office campaign", due: "2026-09-05", priority: "Urgent", category: "Marketing" } },
  ]);
  const parent = result.workspace.tasks.find((task) => task.title === "Launch the AI Office campaign");
  const child = result.workspace.tasks.find((task) => task.title === "Approve campaign copy");
  assert.equal(child?.parentId, parent?.id);
  assert.equal(child?.priority, "Urgent");
  assert.equal(child?.visibility, parent?.visibility);
  assert.equal(child?.workspaceId, parent?.workspaceId);
});

test("agent completion preserves recurring rollover and refuses parents with open subtasks", () => {
  const source = emptyWorkspace();
  source.tasks.push({ id: "weekly", title: "Weekly review", description: "", due: "2026-08-27", recurrence: "Weekly", priority: "Normal", done: false });
  let result = applyAgentWorkspaceActions(source, [{ type: "complete", collection: "tasks", recordId: "weekly", data: {} }]);
  assert.equal(result.workspace.tasks.filter((task) => task.seriesId === "weekly").length, 1);
  assert.equal(result.workspace.tasks.find((task) => task.id === "weekly")?.done, false);

  const withChild = emptyWorkspace();
  withChild.tasks.push(
    { id: "parent", title: "Launch", description: "", due: "2026-09-30", recurrence: "One-time", priority: "High", done: false },
    { id: "child", parentId: "parent", title: "Approve copy", description: "", due: "2026-09-05", recurrence: "One-time", priority: "Urgent", done: false },
  );
  result = applyAgentWorkspaceActions(withChild, [{ type: "complete", collection: "tasks", recordId: "parent", data: {} }]);
  assert.equal(result.actions.length, 0);
  assert.equal(result.workspace.tasks.find((task) => task.id === "parent")?.done, false);
});

test("agent proposals can record a governed monthly marketing metric", () => {
  const result = applyAgentWorkspaceActions(emptyWorkspace(), [{
    type: "create", collection: "marketingMetrics", label: "Record website visitors",
    data: { period: "2026-08", metricKey: "website-visitors", value: 1250, source: "Google Analytics" },
  }]);
  assert.equal(result.workspace.marketingMetrics[0].value, 1250);
  assert.equal(result.workspace.marketingMetrics[0].category, "Website & SEO");
  assert.equal(result.actions[0].collection, "marketingMetrics");
});

test("agent proposals create campaigns and link reviewed content by campaign name", () => {
  const result = applyAgentWorkspaceActions(emptyWorkspace(), [
    { type: "create", collection: "campaigns", label: "Create campaign", data: { name: "Private AI briefing", status: "Planning", objective: "Generate qualified conversations", audience: "Mid-market CIOs", owner: "Aby", primaryChannel: "LinkedIn", startDate: "2026-09-01", endDate: "2026-09-30", successMeasure: "Five meetings" } },
    { type: "create", collection: "content", label: "Create article", data: { title: "Private AI without lock-in", format: "Article", stage: "Drafting", stream: "Spej Authority-building content", pillar: "Private AI, Sovereignty & Data Residency", campaignName: "Private AI briefing", owner: "Aby", approver: "Ken", reviewStatus: "Pending Review", reviewDue: "2026-09-10" } },
  ]);
  assert.equal(result.workspace.campaigns[0].name, "Private AI briefing");
  assert.equal(result.workspace.campaigns[0].ownerProfileId, "aby");
  assert.equal(result.workspace.content[0].campaignId, result.workspace.campaigns[0].id);
  assert.equal(result.workspace.content[0].ownerProfileId, "aby");
  assert.equal(result.workspace.content[0].approver, "Ken");
  assert.equal(result.workspace.content[0].approverProfileId, "ken");
});

test("SOSA cannot supply stable identity IDs", () => {
  for (const data of [
    { name: "Unsafe account", owner: "Aby", ownerProfileId: "someone-else" },
    { title: "Unsafe content", owner: "Aby", approver: "Ken", approverProfileId: "someone-else" },
  ]) {
    const collection = "title" in data ? "content" : "accounts";
    assert.throws(
      () => applyAgentWorkspaceActions(emptyWorkspace(), [{ type: "create", collection, data }]),
      /identity IDs must come from Spej identity mapping/i,
    );
  }
});

test("agent project actions use the broader taxonomy and require CRM linkage for client delivery", () => {
  assert.throws(() => applyAgentWorkspaceActions(emptyWorkspace(), [{ type: "create", collection: "projects", data: { name: "Unlinked rollout", projectType: "Plooms", workArea: "Client Delivery" } }]), /related CRM account/i);
  const source = emptyWorkspace();
  source.accounts.push({ id: "a1", name: "Acme", type: "Client", status: "Active", owner: "Aby", website: "", notes: "", createdAt: "2026-08-01T00:00:00Z" });
  source.opportunities.push({ id: "o1", accountId: "a1", name: "Plooms rollout", stage: "Closed Won", forecast: "Contracted", value: 0, closeDate: "", owner: "Aby", nextSpejAction: "", nextCustomerDecision: "", nextActionDue: "", source: "Referral", notes: "", createdAt: "2026-08-01T00:00:00Z" });
  const result = applyAgentWorkspaceActions(source, [{ type: "create", collection: "projects", data: { name: "Plooms implementation", accountId: "a1", opportunityId: "o1", projectType: "Plooms" } }]);
  assert.equal(result.workspace.projects[0].workArea, "Client Delivery");
  assert.equal(result.workspace.projects[0].playbook, "Plooms Implementation");
  assert.equal(result.workspace.projects[0].phase, "Not Applicable");
  assert.equal(result.workspace.projects[0].opportunityId, "o1");
});

test("agent rejects unsupported project taxonomy values and cross-account opportunity links", () => {
  const source = emptyWorkspace();
  source.accounts.push(
    { id: "a1", name: "Acme", type: "Client", status: "Active", owner: "Aby", website: "", notes: "", createdAt: "2026-08-01T00:00:00Z" },
    { id: "a2", name: "Beta", type: "Prospect", status: "Active", owner: "Aby", website: "", notes: "", createdAt: "2026-08-01T00:00:00Z" },
  );
  source.opportunities.push({ id: "o2", accountId: "a2", name: "Beta opportunity", stage: "Explore", forecast: "Pipeline", value: 0, closeDate: "", owner: "Aby", nextSpejAction: "", nextCustomerDecision: "", nextActionDue: "", source: "Inbound", notes: "", createdAt: "2026-08-01T00:00:00Z" });
  assert.throws(() => applyAgentWorkspaceActions(source, [{ type: "create", collection: "projects", data: { name: "Bad type", accountId: "a1", projectType: "Mystery" } }]), /projectType value is not supported/i);
  assert.throws(() => applyAgentWorkspaceActions(source, [{ type: "create", collection: "projects", data: { name: "Wrong deal", accountId: "a1", opportunityId: "o2", projectType: "Client Project" } }]), /different account/i);
});

test("SOSA may propose priority facts but cannot write scores or human approvals", () => {
  const source = emptyWorkspace();
  source.accounts.push({ id: "a1", name: "Example", type: "Prospect", status: "Active", owner: "Owner", website: "", notes: "", createdAt: "2026-08-01T00:00:00Z" });
  source.contacts.push({ id: "c1", accountId: "a1", name: "Buyer", title: "", email: "", relationshipStrength: "Developing", source: "Referral", lastContact: "", notes: "", createdAt: "2026-08-01T00:00:00Z" });
  const result = applyAgentWorkspaceActions(source, [{ type: "create", collection: "opportunities", data: { accountId: "a1", name: "Program", seriousness: "Engaged", decisionAccess: "Champion", primaryContactId: "c1", annualRevenuePotential: 250000, strategicFit: "High", priorityEvidence: "Explicitly described in the request." } }]);
  assert.equal(result.workspace.opportunities[0].primaryContactId, "c1");
  assert.equal(result.workspace.opportunities[0].annualRevenuePotential, 250000);
  assert.equal(result.workspace.opportunities[0].priorityStatus, "Needs review");
  for (const data of [{ priorityIndex: 99 }, { attentionTier: "Strategic" }, { priorityStatus: "Human confirmed" }, { attentionOverride: "Strategic" }, { priorityEvidenceSourceIds: ["made-up"] }]) {
    assert.throws(() => applyAgentWorkspaceActions(source, [{ type: "create", collection: "opportunities", data: { accountId: "a1", name: "Unsafe", ...data } }]), /cannot write calculated|require a human/i);
  }
});

test("SOSA cannot link an opportunity to a primary contact from another account", () => {
  const source = emptyWorkspace();
  source.accounts.push(
    { id: "a1", name: "Alpha", type: "Prospect", status: "Active", owner: "Owner", website: "", notes: "", createdAt: "2026-08-01T00:00:00Z" },
    { id: "a2", name: "Beta", type: "Prospect", status: "Active", owner: "Owner", website: "", notes: "", createdAt: "2026-08-01T00:00:00Z" },
  );
  source.contacts.push({ id: "c2", accountId: "a2", name: "Other buyer", title: "", email: "", relationshipStrength: "Strong", source: "Inbound", lastContact: "", notes: "", createdAt: "2026-08-01T00:00:00Z" });
  assert.throws(() => applyAgentWorkspaceActions(source, [{ type: "create", collection: "opportunities", data: { accountId: "a1", name: "Wrong contact", primaryContactId: "c2" } }]), /different account/i);
});

test("SOSA resolves reviewed account provenance while trusted evidence stays adapter-only", () => {
  const source = emptyWorkspace();
  source.contacts.push(
    { id: "origin", accountId: "", name: "Original contact", title: "", email: "", relationshipStrength: "Developing", source: "In-person event", lastContact: "", notes: "", createdAt: "2026-08-01T00:00:00Z" },
    { id: "referrer", accountId: "", name: "Trusted referrer", title: "", email: "", relationshipStrength: "Strong", source: "Professional network", lastContact: "", notes: "", createdAt: "2026-08-01T00:00:00Z" },
  );
  const result = applyAgentWorkspaceActions(source, [{
    type: "create",
    collection: "accounts",
    data: { name: "Example account", acquisitionMotion: "Referral", source: "Referral / introduction", sourceDate: "2026-08-30", originatingContactName: "Original contact", referrerContactName: "Trusted referrer" },
  }]);
  assert.equal(result.workspace.accounts[0].originatingContactId, "origin");
  assert.equal(result.workspace.accounts[0].referrerContactId, "referrer");
  assert.equal(result.workspace.accounts[0].sourceDate, "2026-08-30");
  assert.throws(() => applyAgentWorkspaceActions(source, [{ type: "create", collection: "accounts", data: { name: "Unsafe", sourceArtifactId: "invented" } }]), /trusted source evidence IDs/i);
  assert.throws(() => applyAgentWorkspaceActions(source, [{ type: "create", collection: "accounts", data: { name: "Bad date", sourceDate: "sometime" } }]), /sourceDate must be a valid calendar date/i);
});
