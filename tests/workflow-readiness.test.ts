import assert from "node:assert/strict";
import test from "node:test";
import {
  campaignPromotionIssue,
  opportunityPromotionIssue,
  projectPromotionIssue,
  projectTaskLinkIssue,
} from "../lib/workflow-readiness";

const campaign = {
  status: "Planning" as const,
  objective: "",
  audience: "",
  owner: "",
  startDate: "",
  endDate: "",
  successMeasure: "",
};

test("campaigns remain lightweight in Starting but require an executable brief when promoted", () => {
  assert.equal(campaignPromotionIssue(campaign), null);
  const issue = campaignPromotionIssue({ ...campaign, status: "Active" });
  for (const field of ["business objective", "audience", "owner", "start date", "success measure"]) {
    assert.match(issue || "", new RegExp(field));
  }
  assert.match(campaignPromotionIssue({ ...campaign, status: "Active", owner: "Unassigned" }) || "", /owner/);
  assert.equal(campaignPromotionIssue({
    ...campaign,
    status: "Active",
    objective: "Create qualified demand",
    audience: "Mid-market operations leaders",
    owner: "Aby",
    startDate: "2026-09-01",
    successMeasure: "Ten qualified meetings",
  }), null);
  assert.match(campaignPromotionIssue({
    ...campaign,
    status: "Complete",
    objective: "Create qualified demand",
    audience: "Mid-market operations leaders",
    owner: "Aby",
    startDate: "2026-09-01",
    successMeasure: "Ten qualified meetings",
  }) || "", /end date/);
  assert.match(campaignPromotionIssue({ ...campaign, startDate: "2026-09-10", endDate: "2026-09-01" }) || "", /cannot be before/);
});

const opportunity = {
  stage: "Explore" as const,
  accountId: "",
  owner: "",
  nextSpejAction: "",
  nextActionDue: "",
  painPoint: "",
  desiredOutcome: "",
  value: 0,
  closeDate: "",
  notes: "",
};

test("opportunity stage gates preserve intake and raise requirements as commercial commitment increases", () => {
  assert.equal(opportunityPromotionIssue(opportunity), null);
  const validation = opportunityPromotionIssue({ ...opportunity, stage: "Validate" });
  for (const field of ["account", "owner", "next Spej action", "next-action due date"]) {
    assert.match(validation || "", new RegExp(field));
  }
  assert.match(opportunityPromotionIssue({ ...opportunity, stage: "Validate", owner: "Unassigned" }) || "", /owner/);
  assert.equal(opportunityPromotionIssue({
    ...opportunity,
    stage: "Validate",
    accountId: "account-1",
    owner: "Sagar",
    nextSpejAction: "Confirm discovery call",
    nextActionDue: "2026-09-10",
  }), null);
  const proposal = opportunityPromotionIssue({
    ...opportunity,
    stage: "Proposal & Decision",
    accountId: "account-1",
    owner: "Sagar",
    nextSpejAction: "Send proposal",
    nextActionDue: "2026-09-10",
  });
  for (const field of ["customer problem", "desired outcome", "estimated contract value", "close date"]) {
    assert.match(proposal || "", new RegExp(field));
  }
  assert.equal(opportunityPromotionIssue({
    ...opportunity,
    stage: "Closed Won",
    accountId: "account-1",
    owner: "Sagar",
    painPoint: "Manual intake",
    desiredOutcome: "Faster service",
    value: 100_000,
    closeDate: "2026-09-15",
  }), null);
  assert.match(opportunityPromotionIssue({ ...opportunity, stage: "Closed Lost", accountId: "account-1", owner: "Sagar" }) || "", /loss reason/);
});

const project = {
  operationalStatus: "Not Started" as const,
  workArea: "Unclassified" as const,
  projectType: "Unclassified" as const,
  playbook: "Not set" as const,
  owner: "",
  startDate: "",
  endDate: "",
  nextMilestone: "",
  dueDate: "",
  successMeasure: "",
};

test("project stage gates preserve intake and require an operating plan before execution", () => {
  assert.equal(projectPromotionIssue(project), null);
  const active = projectPromotionIssue({ ...project, operationalStatus: "Active" });
  for (const field of ["area", "type", "owner", "start date", "project workflow", "success measure", "next milestone", "milestone due date"]) {
    assert.match(active || "", new RegExp(field));
  }
  assert.match(projectPromotionIssue({ ...project, operationalStatus: "Active", owner: "Unassigned" }) || "", /owner/);
  const executable = {
    ...project,
    operationalStatus: "Active" as const,
    workArea: "Product" as const,
    projectType: "Product Development" as const,
    playbook: "Product Development" as const,
    owner: "Sean",
    startDate: "2026-09-01",
    nextMilestone: "Pilot ready",
    dueDate: "2026-09-20",
    successMeasure: "Pilot acceptance",
  };
  assert.equal(projectPromotionIssue(executable), null);
  assert.match(projectPromotionIssue({ ...executable, operationalStatus: "Complete", endDate: "" }) || "", /target completion date/);
  assert.match(projectPromotionIssue({ ...executable, startDate: "2026-10-01", endDate: "2026-09-01" }) || "", /cannot be before/);
});

test("Project work cannot be created without an eligible project link", () => {
  const activeProject = { id: "active", operationalStatus: "Active" as const, workArea: "Product" as const };
  const completedProject = { id: "complete", operationalStatus: "Complete" as const, workArea: "Client Delivery" as const };
  const pausedProject = { id: "paused", operationalStatus: "Paused" as const, workArea: "Product" as const };
  const gtmProject = { id: "gtm", operationalStatus: "Active" as const, workArea: "GTM" as const };

  assert.equal(projectTaskLinkIssue({ projectWorkspace: false, projects: [] }), null);
  assert.match(projectTaskLinkIssue({ projectWorkspace: true, projects: [] }) || "", /Create an active project/);
  assert.match(projectTaskLinkIssue({ projectWorkspace: true, projects: [activeProject] }) || "", /Select a project/);
  assert.equal(projectTaskLinkIssue({ projectWorkspace: true, projectId: "active", projects: [activeProject] }), null);
  assert.match(projectTaskLinkIssue({ projectWorkspace: true, projectId: "complete", projects: [completedProject] }) || "", /active project/);
  assert.match(projectTaskLinkIssue({ projectWorkspace: true, projectId: "paused", projects: [pausedProject] }) || "", /active project/);
  assert.match(projectTaskLinkIssue({ projectWorkspace: true, projectId: "gtm", projects: [gtmProject] }) || "", /GTM initiative/);
  assert.match(projectTaskLinkIssue({ projectWorkspace: true, parentId: "parent", projects: [activeProject] }) || "", /parent task needs a project link/);
});
