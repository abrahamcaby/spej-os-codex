import assert from "node:assert/strict";
import test from "node:test";
import { evaluateOpportunityPriority, PRIORITY_SCORING_VERSION, sortOpportunitiesByPriority } from "../lib/opportunity-priority";
import type { AccountItem, ActivityItem, ContactItem, OpportunityItem } from "../lib/types";

const now = new Date(2026, 8, 2, 12);

function account(overrides: Partial<AccountItem> = {}): AccountItem {
  return { id: "a1", name: "Example account", type: "Prospect", status: "Active", owner: "Owner", website: "", notes: "", companySizeBand: "1,000-4,999", createdAt: "2026-08-01T00:00:00Z", ...overrides };
}

function contact(overrides: Partial<ContactItem> = {}): ContactItem {
  return { id: "c1", accountId: "a1", name: "Primary contact", title: "", email: "", relationshipStrength: "Strong", source: "Referral", lastContact: "2026-08-28", notes: "", createdAt: "2026-08-01T00:00:00Z", ...overrides };
}

function opportunity(overrides: Partial<OpportunityItem> = {}): OpportunityItem {
  return {
    id: "o1", accountId: "a1", name: "Strategic program", stage: "Qualify", forecast: "Pipeline", value: 1_200_000,
    valueConfidence: "Validated", annualRevenuePotential: 800_000, revenueModel: "Recurring", timeToRevenue: "91-180 days",
    seriousness: "Engaged", primaryContactId: "c1", decisionAccess: "Champion", stakeholderCoverage: "Multi-threaded", strategicFit: "High", expansionPotential: "High",
    closeDate: "2027-02-01", owner: "Owner", nextSpejAction: "Confirm buying group", nextCustomerDecision: "Confirm sponsor", nextActionDue: "2026-09-20",
    source: "Referral", notes: "", createdAt: "2026-08-01T00:00:00Z", ...overrides,
  };
}

function activity(overrides: Partial<ActivityItem> = {}): ActivityItem {
  return { id: "x1", accountId: "a1", contactId: "c1", opportunityId: "o1", channel: "Meeting", metricType: "Meeting held", summary: "Discovery discussion", outcome: "Next step agreed", occurredAt: "2026-08-30", createdAt: "2026-08-30T12:00:00Z", ...overrides };
}

function engagementPriority(activities: ActivityItem[], overrides: Partial<OpportunityItem> = {}) {
  return evaluateOpportunityPriority(opportunity({ nextActionDue: "", nextCustomerDecision: "", closeDate: "", timeToRevenue: "Unknown", ...overrides }), account(), [contact()], activities, now);
}

test("priority evaluation is deterministic, bounded, and does not mutate records", () => {
  const deal = opportunity();
  const before = structuredClone(deal);
  const first = evaluateOpportunityPriority(deal, account(), [contact()], [activity()], now);
  const second = evaluateOpportunityPriority(deal, account(), [contact()], [activity()], now);
  assert.deepEqual(first, second);
  assert.deepEqual(deal, before);
  for (const value of [first.strategicValue, first.winReadiness, first.actionUrgency, first.confidence, first.priorityIndex]) {
    if (value !== null) assert.ok(value >= 0 && value <= 100);
  }
});

test("unknown inputs are excluded and visibly lower confidence", () => {
  const sparse = evaluateOpportunityPriority(opportunity({ value: 0, valueConfidence: "Unknown", annualRevenuePotential: 0, strategicFit: "Unknown", expansionPotential: "Unknown", seriousness: "Unknown", decisionAccess: "Unknown", stakeholderCoverage: "Unknown", primaryContactId: undefined, closeDate: "", nextSpejAction: "", nextCustomerDecision: "", nextActionDue: "" }), account({ companySizeBand: "Unknown" }), [], [], now);
  assert.equal(sparse.attentionTier, "Needs inputs");
  assert.equal(sparse.priorityIndex, null);
  assert.ok(sparse.confidence < 35);
  assert.ok(sparse.missingInputs.includes("potential value or annual revenue"));
});

test("a large slow opportunity stays strategic without being labeled urgent", () => {
  const result = evaluateOpportunityPriority(opportunity(), account(), [contact()], [activity()], now);
  assert.equal(result.attentionTier, "Strategic");
  assert.notEqual(result.actionWindow, "Act now");
  assert.ok((result.strategicValue || 0) > (result.actionUrgency || 0));
});

test("a smaller deadline-driven opportunity is put in the act-now lane", () => {
  const result = evaluateOpportunityPriority(opportunity({ value: 15_000, annualRevenuePotential: 0, valueConfidence: "Rough estimate", strategicFit: "Medium", expansionPotential: "Low", seriousness: "Active buying", decisionAccess: "Decision maker", nextActionDue: "2026-09-01", closeDate: "2026-09-10", timeToRevenue: "0-30 days" }), account({ companySizeBand: "50-249" }), [contact()], [activity()], now);
  assert.equal(result.actionWindow, "Act now");
  assert.ok((result.actionUrgency || 0) >= 80);
});

test("company size alone cannot create a confident top-ranked deal", () => {
  const result = evaluateOpportunityPriority(opportunity({ value: 0, valueConfidence: "Unknown", annualRevenuePotential: 0, strategicFit: "Unknown", expansionPotential: "Unknown", seriousness: "Unknown", decisionAccess: "Unknown", stakeholderCoverage: "Unknown", primaryContactId: undefined, closeDate: "", nextSpejAction: "", nextCustomerDecision: "", nextActionDue: "" }), account({ companySizeBand: "5,000+" }), [], [], now);
  assert.equal(result.attentionTier, "Needs inputs");
  assert.equal(result.priorityIndex, null);
});

test("a manual tier override cannot hide an overdue commitment", () => {
  const result = evaluateOpportunityPriority(opportunity({ nextActionDue: "2026-09-01", attentionOverride: "Light-touch", attentionOverrideReason: "Deliberate account plan", priorityStatus: "Human confirmed", priorityReviewedAt: "2026-09-02" }), account(), [contact()], [activity()], now);
  assert.equal(result.attentionTier, "Light-touch");
  assert.equal(result.actionWindow, "Act now");
});

test("closed opportunities are not actively prioritized and sorting is non-mutating", () => {
  const open = opportunity({ id: "open", nextActionDue: "2026-09-02" });
  const closed = opportunity({ id: "closed", stage: "Closed Won", nextActionDue: "2026-09-01" });
  assert.equal(evaluateOpportunityPriority(closed, account(), [contact()], [activity()], now).attentionTier, "Closed");
  const source = [closed, open];
  const sorted = sortOpportunitiesByPriority(source, [account()], [contact()], [activity()], now);
  assert.deepEqual(source.map((item) => item.id), ["closed", "open"]);
  assert.deepEqual(sorted.map((item) => item.id), ["open", "closed"]);
});

test("date handling uses calendar days rather than UTC clock boundaries", () => {
  const morning = evaluateOpportunityPriority(opportunity({ nextActionDue: "2026-09-03" }), account(), [contact()], [], new Date(2026, 8, 2, 0, 5));
  const evening = evaluateOpportunityPriority(opportunity({ nextActionDue: "2026-09-03" }), account(), [contact()], [], new Date(2026, 8, 2, 23, 55));
  assert.equal(morning.actionWindow, evening.actionWindow);
  assert.equal(morning.actionUrgency, evening.actionUrgency);
});

test("relationship warmth does not substitute for buying readiness", () => {
  const exploratory = opportunity({ stage: "Explore", forecast: "Not Forecasted", seriousness: "Exploratory", decisionAccess: "No direct access", stakeholderCoverage: "Single-threaded" });
  const warmConnector = evaluateOpportunityPriority(exploratory, account(), [contact({ relationshipStrength: "Strong" })], [], now);
  const newRelationship = evaluateOpportunityPriority(exploratory, account(), [contact({ relationshipStrength: "New" })], [], now);
  const activeBuyer = evaluateOpportunityPriority(opportunity({ stage: "Contracting", forecast: "Commit", seriousness: "Commercial commitment", decisionAccess: "Economic buyer", stakeholderCoverage: "Buying group mapped" }), account(), [contact({ relationshipStrength: "New" })], [], now);
  assert.equal(warmConnector.winReadiness, newRelationship.winReadiness);
  assert.equal(warmConnector.confidence, newRelationship.confidence);
  assert.ok((warmConnector.winReadiness || 0) < 30);
  assert.ok((activeBuyer.winReadiness || 0) > 90);
  assert.equal(warmConnector.scoringVersion, PRIORITY_SCORING_VERSION);
});

test("an unverified problem note cannot raise readiness", () => {
  const base = opportunity({ seriousness: "Unknown", decisionAccess: "Unknown", stakeholderCoverage: "Unknown", painPoint: "" });
  const unknown = evaluateOpportunityPriority(base, account(), [contact()], [], now);
  const hypothesis = evaluateOpportunityPriority({ ...base, painPoint: "We suspect the organization needs automation" }, account(), [contact()], [], now);
  assert.equal(hypothesis.winReadiness, unknown.winReadiness);
  assert.equal(hypothesis.confidence, unknown.confidence);
});

test("a forwarded old buyer response retains its original engagement age", () => {
  const original = activity({ metricType: "Reply received", channel: "Email", occurredAt: "2026-05-01", createdAt: "2026-05-01T12:00:00Z" });
  const imported = { ...original, createdAt: "2026-09-02T12:00:00Z" };
  const old = engagementPriority([original]);
  const forwarded = engagementPriority([imported]);
  assert.equal(forwarded.actionUrgency, old.actionUrgency);
  assert.equal(forwarded.actionUrgency, 8);
  assert.ok((engagementPriority([activity({ metricType: "Reply received" })]).actionUrgency || 0) > (forwarded.actionUrgency || 0));
});

test("outreach, unknown source dates, invalid dates and future activity cannot renew engagement", () => {
  const excluded = [
    activity({ metricType: "Outreach sent" }),
    activity({ metricType: "Follow-up sent" }),
    activity({ metricType: "Meeting booked" }),
    activity({ metricType: undefined }),
    activity({ sourceDateKnown: false }),
    activity({ occurredAt: "2026-02-30" }),
    activity({ occurredAt: "2026-09-03" }),
    activity({ archivedAt: "2026-09-01T12:00:00Z" }),
  ];
  for (const candidate of excluded) assert.equal(engagementPriority([candidate]).actionUrgency, null, JSON.stringify(candidate));
  for (const metricType of ["Reply received", "Meeting held", "Call connected", "Incoming call connected", "Check-in completed"] as const) {
    assert.equal(engagementPriority([activity({ metricType })]).actionUrgency, 100);
  }
});

test("incoming-call evidence requires a known actual date and the same buying relationship", () => {
  const incoming = activity({ metricType: "Incoming call connected", channel: "Call" });
  assert.equal(engagementPriority([incoming]).actionUrgency, 100);
  for (const changes of [{ contactId: "another-person", opportunityId: undefined }, { opportunityId: "another-opportunity" }, { accountId: "another-account" }, { occurredAt: "" }, { sourceDateKnown: false }, { occurredAt: "2026-09-03" }, { archivedAt: "2026-09-01T12:00:00Z" }]) {
    assert.equal(engagementPriority([{ ...incoming, ...changes }]).actionUrgency, null);
  }
});

test("two opportunities sharing one account and contact retain separate engagement evidence", () => {
  const secondOpportunityReply = activity({ opportunityId: "o2", metricType: "Reply received" });
  assert.equal(engagementPriority([secondOpportunityReply]).actionUrgency, null);
  assert.equal(engagementPriority([secondOpportunityReply], { id: "o2" }).actionUrgency, 100);
  const contactOnlyReply = activity({ opportunityId: undefined, metricType: "Reply received" });
  assert.equal(engagementPriority([contactOnlyReply]).actionUrgency, 100);
  assert.equal(engagementPriority([contactOnlyReply], { primaryContactId: "another-person" }).actionUrgency, null);
  assert.equal(engagementPriority([activity({ accountId: "another-account" })]).actionUrgency, null);
});

test("an outreach hold changes the recommendation without hiding a dated commitment", () => {
  const deal = opportunity({ nextActionDue: "2026-09-01" });
  const heldAccount = account({ outreachHold: { active: true, reason: "Coordinate CIO outreach", until: "2026-08-31", releaseCondition: "Owner confirms the introduction" } });
  const before = structuredClone({ deal, heldAccount });
  const held = evaluateOpportunityPriority(deal, heldAccount, [contact()], [], now);
  const released = evaluateOpportunityPriority(deal, { ...heldAccount, outreachHold: { ...heldAccount.outreachHold!, active: false } }, [contact()], [], now);
  assert.equal(held.actionWindow, "Act now");
  assert.equal(held.actionUrgency, released.actionUrgency);
  assert.equal(held.priorityIndex, released.priorityIndex);
  assert.match(held.recommendedCadence, /Coordinate.*Keep the recorded next action and due date/);
  assert.match(held.reasons.join(" "), /CIO outreach.*explicitly resolved/);
  assert.doesNotMatch(released.recommendedCadence, /Coordinate/);
  assert.deepEqual({ deal, heldAccount }, before);
});

test("recent teammate outreach prompts coordination but does not increase buyer engagement", () => {
  const recentOutreach = activity({ channel: "Email", metricType: "Outreach sent", owner: "Another teammate" });
  const baseline = engagementPriority([]);
  const result = engagementPriority([recentOutreach]);
  assert.equal(result.actionUrgency, baseline.actionUrgency);
  assert.match(result.recommendedCadence, /Coordinate with the account owner/);
  assert.match(result.reasons.join(" "), /Another teammate/);
});

test("a completed next action cannot retain overdue urgency or close the opportunity", () => {
  const deal = opportunity({ actionState: "Completed", nextActionDue: "2026-07-01", nextCustomerDecision: "Previously requested decision", closeDate: "", timeToRevenue: "Unknown" });
  const before = structuredClone(deal);
  const result = evaluateOpportunityPriority(deal, account(), [contact()], [], now);
  const withoutStaleActionDate = evaluateOpportunityPriority({ ...deal, nextActionDue: "", nextCustomerDecision: "" }, account(), [contact()], [], now);
  assert.equal(result.actionWindow, "Needs scheduling");
  assert.equal(result.actionUrgency, null);
  assert.equal(result.priorityIndex, withoutStaleActionDate.priorityIndex);
  assert.notEqual(result.attentionTier, "Closed");
  assert.match(result.recommendedCadence, /completed action.*choose the next step/);
  assert.ok(result.missingInputs.includes("one dated next action"));
  assert.deepEqual(deal, before);
  const held = evaluateOpportunityPriority(deal, account({ outreachPreference: "No proactive outreach" }), [contact()], [], now);
  assert.doesNotMatch(held.recommendedCadence, /Keep the recorded next action and due date/);
});

test("completion clears only next-action urgency, retaining other commercial dates", () => {
  const result = engagementPriority([], { actionState: "Completed", nextActionDue: "2026-07-01", closeDate: "2026-09-02" });
  assert.equal(result.actionWindow, "Needs scheduling");
  assert.equal(result.actionUrgency, 95);
});

test("suggested, assigned and legacy actions are not described as agreed commitments", () => {
  for (const actionState of [undefined, "Suggested", "Assigned"] as const) {
    const result = evaluateOpportunityPriority(opportunity({ actionState, nextActionDue: "2026-09-01" }), account(), [contact()], [], now);
    assert.equal(result.actionWindow, "Act now");
    assert.doesNotMatch(`${result.recommendedCadence} ${result.reasons.join(" ")}`, /commitment/i);
    assert.match(result.reasons.join(" "), /action is due or overdue/);
  }
  for (const actionState of ["Agreed", "Scheduled"] as const) {
    const result = evaluateOpportunityPriority(opportunity({ actionState, nextActionDue: "2026-09-01" }), account(), [contact()], [], now);
    assert.match(result.reasons.join(" "), /agreed commitment is due or overdue/);
  }
});
