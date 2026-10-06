import assert from "node:assert/strict";
import test from "node:test";
import { cleanAdoptionOutcome, cleanAiProfile, cleanContactNurture, cleanDiscoveryEconomics, contactOutreachGuard } from "../lib/customer-development";
import { cleanAccounts, cleanContacts, cleanOpportunities, cleanProjects } from "../lib/operations";
import { normalizeWorkspace } from "../lib/workspace-normalization";
import { buildDirectorAttention } from "../lib/director-dashboard";
import { applyAgentWorkspaceActions } from "../lib/agent-workspace";
import type { WorkspaceState } from "../lib/types";

const empty = (): WorkspaceState => ({ reminders: [], tasks: [], content: [], accounts: [], contacts: [], activities: [], opportunities: [], partnerships: [], projects: [], campaigns: [], marketingMetrics: [] });
test("unknown maturity stays unknown and unsupported human review is not accepted", () => {
  assert.equal(cleanAiProfile(undefined), undefined);
  const profile = cleanAiProfile({ maturity: "expert", usage: "x".repeat(3000), evidenceDate: "2999-01-01", reviewStatus: "Human reviewed" })!;
  assert.equal(profile.maturity, "Unknown"); assert.equal(profile.usage.length, 2000);
  assert.equal(profile.evidenceDate, ""); assert.equal(profile.reviewStatus, "Needs review");
  assert.equal(cleanAiProfile({ evidence: "Customer meeting", reviewer: "Aby", reviewStatus: "Human reviewed" })?.reviewStatus, "Human reviewed");
});
test("campaign eligibility is bound to a specific employer and email", () => {
  const draft = { method: "Campaign", state: "Active", emailEligibility: "Reviewed eligible", eligibilityEvidence: "Reviewed fictional opt-in", eligibilityAccountId: "a1", eligibilityEmail: "person@example.com", campaign: "Briefing", owner: "Aby", nextAction: "Review", dueDate: "2026-09-09" };
  assert.equal(cleanContactNurture(draft, "a1", "person@example.com")?.state, "Active");
  for (const [account, email] of [["a2", "person@example.com"], ["a1", "new@example.com"], ["a1", ""]]) {
    const result = cleanContactNurture(draft, account, email)!;
    assert.equal(result.emailEligibility, "Unknown"); assert.equal(result.state, "Paused");
  }
  const [contact] = cleanContacts([{ id: "c1", accountId: "a1", name: "Example", email: "person@example.com", nurture: draft }]);
  assert.equal(contactOutreachGuard(contact, { blocked: false, reasons: [] }).blocked, true);
  const personal = { ...contact, nurture: { ...contact.nurture!, method: "Personal" as const } };
  assert.equal(contactOutreachGuard(personal, { blocked: true, reasons: ["Account hold"] }).blocked, true);
  assert.equal(contactOutreachGuard({ ...personal, nurture: { ...personal.nurture!, state: "Ended" } }, { blocked: false, reasons: [] }).blocked, true);
});
test("new reviewed fields survive normalization and unrelated SOSA edits", () => {
  const state = empty();
  state.accounts = cleanAccounts([{ id: "a1", name: "Example", aiProfile: { usage: "Internal assistant", maturity: "Piloting" } }]);
  state.contacts = cleanContacts([{ id: "c1", name: "Example person", accountId: "a1", nurture: { method: "Personal", state: "Paused", owner: "Aby" } }]);
  state.opportunities = cleanOpportunities([{ id: "o1", name: "Example deal", accountId: "a1", discoveryEconomics: { budgetStatus: "Discussing", nextQuestion: "Budget?" } }]);
  state.projects = cleanProjects([{ id: "p1", name: "Example project", adoptionOutcome: { adoption: "Testing", observed: "4 weekly users" } }]);
  const normalized = normalizeWorkspace(state);
  assert.equal(normalized.accounts[0].aiProfile?.maturity, "Piloting");
  assert.equal(normalized.contacts[0].nurture?.owner, "Aby");
  assert.equal(normalized.opportunities[0].discoveryEconomics?.nextQuestion, "Budget?");
  assert.equal(normalized.projects[0].adoptionOutcome?.observed, "4 weekly users");
  const changed = applyAgentWorkspaceActions(normalized, [{ type: "update", collection: "accounts", recordId: "a1", data: { notes: "Follow up" } }]);
  assert.deepEqual(changed.workspace.accounts[0].aiProfile, normalized.accounts[0].aiProfile);
  assert.equal(cleanContacts([{ name: "Legacy" }])[0].nurture, undefined);
  assert.equal(cleanProjects([{ name: "Legacy" }])[0].adoptionOutcome, undefined);
});
test("completed projects still surface due adoption reviews", () => {
  const state = empty();
  state.projects = cleanProjects([{ id: "p1", name: "Complete technical work", operationalStatus: "Complete", adoptionOutcome: { adoption: "Below target", owner: "Joseph", reviewDate: "2026-09-09", blocker: "Training needed" } }]);
  const items = buildDirectorAttention({ ...state, now: new Date("2026-09-09T12:00:00") });
  assert.ok(items.some((item) => item.id === "adoption:p1"));
  assert.ok(!items.some((item) => item.id === "project:p1"));
  assert.equal(cleanAdoptionOutcome({ adoption: "excellent", evidenceDate: "2999-01-01" })?.adoption, "Unknown");
  assert.equal(cleanDiscoveryEconomics({ budgetStatus: "Customer confirmed" })?.budgetStatus, "Unknown");
});
