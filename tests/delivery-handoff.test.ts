import assert from "node:assert/strict";
import test from "node:test";
import { createDeliveryHandoff, deliveryHandoffIssue, type DeliveryContext } from "../lib/delivery-handoff";
import { cleanProjects } from "../lib/operations";
import type { AccountItem, OpportunityItem } from "../lib/types";

const account: AccountItem = { id: "synthetic-account", name: "Synthetic delivery test", type: "Client", status: "Active", owner: "Aby", website: "", notes: "", createdAt: "2026-09-01T00:00:00Z" };
const opportunity: OpportunityItem = { id: "synthetic-won", accountId: account.id, name: "Reviewed rollout", stage: "Closed Won", forecast: "Contracted", value: 1000, closeDate: "2026-09-01", owner: "Aby", motion: "AI Office", nextSpejAction: "Review start conditions", nextCustomerDecision: "Confirm counterpart", nextActionDue: "2026-09-15", source: "Referral", notes: "", createdAt: account.createdAt };
const context: DeliveryContext = { scope: "One team", deliverables: "Configured pilot", startConditions: "Security approval and kickoff", customerCounterpart: "Synthetic sponsor", commitments: "Customer provides sample data", openQuestions: "Hosting decision", expansionIdeas: "Second team — not contracted", verifiedOutcomes: "", sourceEvidence: "Synthetic signed scope reference" };

test("a reviewed won deal creates a linked tracker without inventing a start or outcome", () => {
  const project = createDeliveryHandoff(opportunity, account, context, [], "2026-09-08T12:00:00Z");
  assert.equal(project.operationalStatus, "Not Started");
  assert.equal(project.commercialStatus, "Contracted");
  assert.equal(project.startDate, "");
  assert.equal(project.dueDate, "");
  assert.equal(project.opportunityId, opportunity.id);
  assert.equal(project.accountId, account.id);
  assert.equal(project.deliveryContext?.verifiedOutcomes, "");
  assert.equal(project.deliveryContext?.expansionIdeas, context.expansionIdeas);
  assert.deepEqual(cleanProjects([project])[0].deliveryContext, context);
});

test("handoff requires reviewed evidence, start conditions and a valid won opportunity", () => {
  for (const field of ["scope", "deliverables", "startConditions", "customerCounterpart", "sourceEvidence"] as const) {
    assert.throws(() => createDeliveryHandoff(opportunity, account, { ...context, [field]: "" }, []), /before creating/);
  }
  assert.match(deliveryHandoffIssue({ ...opportunity, stage: "Contracting" }, account, context, []), /won opportunity/);
  assert.match(deliveryHandoffIssue(opportunity, { ...account, id: "other" }, context, []), /available account/);
  assert.match(deliveryHandoffIssue({ ...opportunity, owner: "Unassigned" }, account, context, []), /owner/);
});

test("handoff cannot duplicate an existing or archived tracker", () => {
  const project = createDeliveryHandoff(opportunity, account, context, []);
  for (const existing of [project, { ...project, archivedAt: "2026-09-08T12:00:00Z" }]) {
    assert.throws(() => createDeliveryHandoff(opportunity, account, context, [existing]), /already has a delivery tracker/);
  }
});
