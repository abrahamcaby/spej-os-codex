import assert from "node:assert/strict";
import test from "node:test";
import { cleanAccounts, cleanActivities, cleanContacts, cleanOpportunities, cleanProjects } from "../lib/operations";
import { accountEngagementDates, captureOriginalSource, cleanAccountContext, cleanContactContext, connectionsWorthExploring, outreachGuard, pastRelationshipDate, preserveEmploymentHistory, preserveOriginalSource } from "../lib/relationship-context";
import type { AccountItem } from "../lib/types";

const today = "2026-09-08";
const account = (changes: Partial<AccountItem> = {}) => cleanAccounts([{ id: "a", name: "Example account", ...changes }])[0];

test("legacy records remain valid without inferred relationship or delivery context", () => {
  const a = account();
  assert.equal(a.originalSource, undefined);
  assert.equal(a.contextFacts, undefined);
  assert.equal(a.connections, undefined);
  assert.equal(a.nurturePlan, undefined);
  assert.equal(a.outreachHold, undefined);
  const contact = cleanContacts([{ name: "Person" }])[0];
  assert.equal(contact.relationshipRoles, undefined);
  assert.equal(contact.employmentHistory, undefined);
  const opportunity = cleanOpportunities([{ name: "Possible project" }])[0];
  assert.equal(opportunity.valueMeaning, undefined);
  assert.equal(opportunity.actionState, undefined);
  const project = cleanProjects([{ name: "Delivery" }])[0];
  assert.equal(project.deliveryContext, undefined);
  assert.equal(project.startDate, "");
});

test("original dates preserve valid calendar days but never invent unknown dates", () => {
  assert.equal(pastRelationshipDate("2024-02-29", today), "2024-02-29");
  for (const value of ["2026-02-30", "2025-02-29", "2026-09-09", "2026-09-08T12:00:00Z", "unknown", undefined]) {
    assert.equal(pastRelationshipDate(value, today), "");
  }
  const a = account({ sourceDate: "2999-01-01", originalSource: { source: "Referral", acquisitionMotion: "Referral", sourceDate: "2026-02-30" } });
  assert.equal(a.sourceDate, undefined);
  assert.equal(a.originalSource?.sourceDate, "");
});

test("original attribution survives later influence and an attempted snapshot replacement", () => {
  const first = account({ source: "Introduction by Alana", acquisitionMotion: "Referral", sourceDate: "2026-07-01", referrerContactId: "alana", sourceArtifactId: "email-1" });
  const before = captureOriginalSource(first);
  const persisted = preserveOriginalSource(undefined, first);
  const after = preserveOriginalSource(persisted, { ...persisted, source: "Later event", acquisitionMotion: "Event", originalSource: { source: "Later event", acquisitionMotion: "Event", sourceDate: "2026-08-10" } });
  assert.deepEqual(after.originalSource, before);
  assert.equal(after.source, "Later event");
  assert.equal(after.acquisitionMotion, "Event");
  assert.deepEqual(captureOriginalSource(after), before);
  assert.equal(first.originalSource, undefined);
});

test("a legacy unknown source can receive its first meaningful attribution", () => {
  const empty = preserveOriginalSource(undefined, account());
  const attributed = preserveOriginalSource(empty, { ...empty, source: "Original referral", acquisitionMotion: "Referral", sourceDate: "2026-08-01" });
  assert.equal(attributed.originalSource?.source, "Original referral");
  assert.equal(attributed.originalSource?.sourceDate, "2026-08-01");
  const edited = preserveOriginalSource(attributed, { ...attributed, source: "Later influence" });
  assert.equal(edited.originalSource?.source, "Original referral");
});

test("evidence keeps original dates, capture dates and competing statements separately", () => {
  const facts = cleanAccountContext({ contextFacts: [
    { id: "f1", topic: "Start timing", text: "Buyer requested a January start", kind: "Customer statement", sourceLabel: "Email from buyer", sourceDate: "2026-07-20", capturedAt: "2026-09-08T09:00:00Z", status: "Conflicting" },
    { id: "f2", topic: "Start timing", text: "We think December is possible", kind: "Hypothesis", sourceDate: "2026-08-20", status: "Conflicting" },
    { id: "f3", text: "Potential next step", kind: "AI suggestion", sourceDate: "2999-01-01", capturedAt: "invalid", status: "Superseded" },
  ] }).contextFacts!;
  assert.equal(facts.length, 3);
  assert.equal(facts[0].sourceDate, "2026-07-20");
  assert.equal(facts[0].capturedAt, "2026-09-08T09:00:00.000Z");
  assert.equal(facts[0].kind, "Customer statement");
  assert.equal(facts[1].status, "Conflicting");
  assert.equal(facts[1].kind, "Hypothesis");
  assert.equal(facts[1].capturedAt, "");
  assert.equal(facts[2].sourceDate, "");
  assert.equal(facts[2].capturedAt, "");
  assert.equal(facts[2].status, "Superseded");
});

test("forwarding an old email never refreshes buyer engagement", () => {
  const a = account();
  const activities = cleanActivities([{ id: "email", accountId: a.id, summary: "Historical buyer reply forwarded for context", metricType: "Reply received", occurredAt: "2026-05-11", capturedAt: "2026-09-08T12:00:00Z", captureMethod: "Forwarded email", sourceDateKnown: true, createdAt: "2026-09-08T12:00:00Z" }]);
  const dates = accountEngagementDates(a, activities, today);
  assert.equal(dates.lastBuyerResponse, "2026-05-11");
  assert.equal(dates.lastCapturedAt, "2026-09-08T12:00:00.000Z");
  assert.equal(dates.lastSellerOutreach, "");
  assert.equal(dates.lastSubstantiveConversation, "");
  assert.equal(outreachGuard(a, activities, today).blocked, false);
});

test("capture without a known original date never becomes a buyer response", () => {
  const a = account();
  const activity = cleanActivities([{ accountId: "a", summary: "Undated pasted message", metricType: "Reply received", occurredAt: today, sourceDateKnown: false, captureMethod: "Pasted message", capturedAt: "2026-09-08T12:00:00Z" }])[0];
  assert.equal(activity.occurredAt, "");
  assert.equal(activity.sourceDateKnown, false);
  assert.equal(accountEngagementDates(a, [activity], today).lastBuyerResponse, "");
  assert.equal(outreachGuard(a, [{ ...activity, occurredAt: today }], today).blocked, false);
});

test("evening local captures survive the next UTC date without allowing a future local capture day", () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = "America/New_York";
  try {
    const a = account();
    const activity = cleanActivities([{ accountId: "a", summary: "Historical reply", occurredAt: "2026-05-10", metricType: "Reply received" }])[0];
    const dates = accountEngagementDates(a, [{ ...activity, capturedAt: "2026-09-09T01:00:00Z" }], "2026-09-08");
    assert.equal(dates.lastCapturedAt, "2026-09-09T01:00:00.000Z");
    assert.equal(dates.lastBuyerResponse, "2026-05-10");
    assert.equal(accountEngagementDates(a, [{ ...activity, capturedAt: "2026-09-09T05:00:00Z" }], "2026-09-08").lastCapturedAt, "");
    assert.equal(accountEngagementDates(a, [{ ...activity, capturedAt: "2026-02-30T01:00:00Z" }], "2026-09-08").lastCapturedAt, "");
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

test("buyer, seller, substantive, scheduled and capture dates have independent meanings", () => {
  const a = account({ nextMeetingDate: "2026-09-10" });
  const activities = cleanActivities([
    { id: "out", accountId: "a", summary: "Sent proposal", metricType: "Outreach sent", occurredAt: "2026-09-02" },
    { id: "reply", accountId: "a", summary: "Buyer replied", metricType: "Reply received", occurredAt: "2026-09-03" },
    { id: "talk", accountId: "a", summary: "Discussed constraints", metricType: "Meeting held", occurredAt: "2026-09-04" },
    { id: "book", accountId: "a", summary: "Scheduled next meeting", metricType: "Meeting booked", occurredAt: "2026-09-05" },
    { id: "other", accountId: "b", summary: "Other buyer", metricType: "Reply received", occurredAt: "2026-09-08" },
    { id: "archive", accountId: "a", summary: "Archived event", metricType: "Reply received", occurredAt: "2026-09-08", archivedAt: "2026-09-08T12:00:00Z" },
  ]);
  assert.deepEqual(accountEngagementDates(a, activities, today), { lastBuyerResponse: "2026-09-03", lastSellerOutreach: "2026-09-02", lastSubstantiveConversation: "2026-09-04", nextAgreedStep: "2026-09-10", lastCapturedAt: "" });
  assert.equal(accountEngagementDates(a, [...activities, { ...activities[1], occurredAt: "2026-09-09" }], today).lastBuyerResponse, "2026-09-03");
});

test("an account outreach hold remains active after its review date until explicitly resolved", () => {
  const a = account({ outreachHold: { active: true, reason: "Coordinate CIO outreach with Sagar", until: "2026-08-01", releaseCondition: "Sagar confirms permission" } });
  const held = outreachGuard(a, [], today);
  assert.equal(held.blocked, true);
  assert.match(held.reasons.join(" "), /Coordinate CIO outreach/);
  assert.match(held.reasons.join(" "), /explicitly resolved/);
  const resolved = account({ ...a, outreachHold: { ...a.outreachHold!, active: false } });
  assert.equal(outreachGuard(resolved, [], today).blocked, false);
  assert.equal(resolved.outreachHold?.reason, "Coordinate CIO outreach with Sagar");
  assert.equal(resolved.outreachHold?.releaseCondition, "Sagar confirms permission");
});

test("recent teammate activity blocks generic outreach but does not complete any next step", () => {
  const a = account();
  const activities = cleanActivities([{ accountId: "a", summary: "Awaiting buyer decision", metricType: "Follow-up sent", owner: "Alex", occurredAt: "2026-09-07" }]);
  const guarded = outreachGuard(a, activities, today);
  assert.equal(guarded.blocked, true);
  assert.match(guarded.reasons.join(" "), /Alex/);
  assert.match(guarded.reasons.join(" "), /agreed next step/);
  const opportunity = cleanOpportunities([{ name: "Pending decision", nextCustomerDecision: "Approve the scope", actionState: "Agreed" }])[0];
  assert.equal(opportunity.actionState, "Agreed");
  assert.equal(opportunity.nextCustomerDecision, "Approve the scope");
  assert.equal(outreachGuard(a, [{ ...activities[0], accountId: "b" }], today).blocked, false);
});

test("context-based nurture honors pauses and deferred buyer dates without erasing plans", () => {
  const nurture = { approach: "Deferred" as const, owner: "Sagar", nextAction: "Review budget timing", dueDate: "2026-10-01", trigger: "New budget approved", reason: "Buyer asked us to wait", desiredOutcome: "Agree discovery timing", pauseCondition: "Budget is not approved", state: "Active" as const };
  const a = account({ nurturePlan: nurture });
  assert.equal(outreachGuard(a, [], today).blocked, true);
  assert.equal(outreachGuard(a, [], "2026-10-02").blocked, true);
  assert.equal(outreachGuard(account({ nurturePlan: { ...nurture, trigger: "" } }), [], "2026-10-02").blocked, false);
  const paused = account({ nurturePlan: { ...nurture, state: "Paused", dueDate: "2026-08-01" } });
  assert.equal(outreachGuard(paused, [], today).blocked, true);
  assert.equal(paused.nurturePlan?.nextAction, "Review budget timing");
});

test("a deferred trigger needs explicit review even without a date or after its review date passes", () => {
  const nurture = { approach: "Deferred" as const, owner: "Sagar", nextAction: "Discuss complementary support", dueDate: "", trigger: "The buyer completes its system migration", reason: "Buyer requested time to finish migration", desiredOutcome: "Confirm whether support is wanted", pauseCondition: "Migration is still underway", state: "Active" as const };
  for (const dueDate of ["", "2026-08-01", today, "2026-10-01"]) {
    const a = account({ nurturePlan: { ...nurture, dueDate } });
    const guard = outreachGuard(a, [], today);
    assert.equal(guard.blocked, true);
    assert.match(guard.reasons.join(" "), /system migration/);
    assert.match(guard.reasons.join(" "), /update the nurture plan/);
    assert.equal(a.nurturePlan?.trigger, nurture.trigger);
    assert.equal(a.nurturePlan?.nextAction, nurture.nextAction);
  }
  const reviewed = account({ nurturePlan: { ...nurture, approach: "Responsive" } });
  assert.equal(outreachGuard(reviewed, [], today).blocked, false);
  const confirmed = account({ nurturePlan: { ...nurture, trigger: "", dueDate: "2026-09-07" } });
  assert.equal(outreachGuard(confirmed, [], today).blocked, false);
});

test("relationship paths link two accounts without merging them or qualifying buyers", () => {
  const accounts = cleanAccounts([{ id: "frain", name: "Frain" }, { id: "advanced", name: "Advanced Mechanical" }]);
  const contacts = cleanContacts([{ id: "person-a", name: "Known connector", accountId: "frain", relationshipStrength: "Strong", relationshipRoles: ["Introducer", "Adviser"] }, { id: "person-b", name: "Potential contact", accountId: "advanced" }]);
  accounts[0] = cleanAccounts([{ ...accounts[0], connections: [{ id: "path", fromContactId: "person-a", toAccountId: "advanced", toContactId: "person-b", context: "Shared professional network", kind: "Public affiliation", relevance: "May understand the operating problem", nextStep: "Ask whether an introduction is appropriate", confidence: "High" }] }])[0];
  const original = JSON.stringify({ accounts, contacts });
  const paths = connectionsWorthExploring(accounts[0], accounts, contacts);
  assert.equal(paths.length, 1);
  assert.equal(paths[0].path, "Known connector → Advanced Mechanical → Potential contact");
  assert.match(paths[0].reason, /operating problem/);
  assert.match(paths[0].nextStep, /appropriate/);
  assert.equal(paths[0].reviewRequired, true);
  assert.equal(paths[0].connection.introductionStatus, "Not requested");
  assert.equal(contacts[1].lifecycleStage, "Unclassified");
  assert.equal(accounts.length, 2);
  assert.equal(JSON.stringify({ accounts, contacts }), original);
});

test("missing or archived connection references stay visible for review without leaking archived names", () => {
  const a = cleanAccounts([{ id: "a", name: "Community", connections: [{ id: "route", fromContactId: "missing", toAccountId: "archived", toContactId: "hidden", context: "Possible route" }] }])[0];
  const archived = account({ id: "archived", name: "Archived organization secret", archivedAt: "2026-09-01T12:00:00Z" });
  const contacts = cleanContacts([{ id: "hidden", name: "Archived person secret", archivedAt: "2026-09-01T12:00:00Z" }]);
  const path = connectionsWorthExploring(a, [a, archived], contacts)[0];
  assert.equal(path.referenceIssues.length, 3);
  assert.equal(path.reviewRequired, true);
  assert.doesNotMatch(path.path, /secret/);
  assert.match(path.path, /Unavailable/);
  assert.deepEqual(connectionsWorthExploring(archived, [a, archived], contacts), []);
});

test("employment changes append the previous organization and preserve historical relationships", () => {
  const old = cleanContacts([{ id: "person", name: "Person", accountId: "frain", title: "Director", employmentHistory: [{ accountId: "earlier", title: "Manager", endedAt: "2025-01-01" }] }])[0];
  const moved = preserveEmploymentHistory(old, { ...old, accountId: "advanced", title: "VP", employmentHistory: [] }, today);
  assert.equal(moved.accountId, "advanced");
  assert.deepEqual(moved.employmentHistory, [{ accountId: "frain", title: "Director", endedAt: today }, { accountId: "earlier", title: "Manager", endedAt: "2025-01-01" }]);
  assert.deepEqual(preserveEmploymentHistory(moved, moved, today), moved);
  assert.equal(old.accountId, "frain");
  const pathAccount = cleanAccounts([{ id: "origin", name: "Origin", connections: [{ id: "historic", toAccountId: "frain", toContactId: "person", context: "Original introduction" }] }])[0];
  const path = connectionsWorthExploring(pathAccount, [pathAccount, account({ id: "frain", name: "Frain" })], [moved])[0];
  assert.match(path.referenceIssues.join(" "), /current organization differs/);
});

test("an employer edit leaves the actual departure date unknown unless the user supplied it", () => {
  const original = cleanContacts([{ id: "person", name: "Person", accountId: "old", title: "Director" }])[0];
  const moved = preserveEmploymentHistory(original, { ...original, accountId: "new", title: "VP" });
  assert.deepEqual(moved.employmentHistory, [{ accountId: "old", title: "Director", endedAt: "" }]);
  for (const endedAt of ["", "2026-03-15"]) {
    const uiPrepared = { ...moved, employmentHistory: [{ accountId: "old", title: "Director", endedAt }] };
    const serverPreserved = preserveEmploymentHistory(original, uiPrepared);
    assert.deepEqual(serverPreserved.employmentHistory, uiPrepared.employmentHistory);
  }
});

test("nested cleaners cap malformed inputs and never assume confirmed relationships", () => {
  const result = cleanAccountContext({
    contextFacts: [null, [], "wrong", { id: "same", text: "A".repeat(5_000), kind: "Confirmed" }, { id: "same", text: "Duplicate" }, ...Array.from({ length: 300 }, (_, id) => ({ id: `f${id}`, text: "Fact" }))],
    connections: Array.from({ length: 200 }, (_, id) => ({ id: `c${id}`, context: "Possible path", confidence: "Certain", kind: "Warm lead", introductionStatus: "Qualified" })),
    nurturePlan: [], outreachHold: "invalid", originalSource: [],
  });
  assert.ok(result.contextFacts!.length <= 200);
  assert.equal(result.contextFacts![0].text.length, 4_000);
  assert.equal(result.contextFacts![0].kind, "Hypothesis");
  assert.equal(result.contextFacts!.filter((fact) => fact.id === "same").length, 1);
  assert.equal(result.connections!.length, 100);
  assert.equal(result.connections![0].kind, "Possible introduction");
  assert.equal(result.connections![0].confidence, "Unknown");
  assert.equal(result.connections![0].introductionStatus, "Not requested");
  assert.equal(result.nurturePlan, undefined);
  assert.equal(result.outreachHold, undefined);
  assert.equal(result.originalSource, undefined);
  const people = cleanContactContext({ relationshipRoles: ["Buyer", "Buyer", "Introducer", null, "Warm prospect"], employmentHistory: Array.from({ length: 200 }, (_, id) => ({ accountId: String(id), endedAt: "2999-01-01" })) });
  assert.deepEqual(people.relationshipRoles, ["Buyer", "Introducer"]);
  assert.equal(people.employmentHistory!.length, 100);
  assert.equal(people.employmentHistory![0].endedAt, "");
});

test("delivery context retains start conditions and separates committed scope from expansion", () => {
  const project = cleanProjects([{ name: "Signed project", commercialStatus: "Contracted", operationalStatus: "Not Started", deliveryContext: { scope: "One workflow", deliverables: "Working prototype", startConditions: "Customer provides access", customerCounterpart: "Operations owner", commitments: "Customer reviews design", openQuestions: "Who approves access?", expansionIdeas: "A separate future workflow", verifiedOutcomes: "", sourceEvidence: "Signed scope reference" } }])[0];
  assert.equal(project.startDate, "");
  assert.equal(project.operationalStatus, "Not Started");
  assert.equal(project.deliveryContext?.startConditions, "Customer provides access");
  assert.equal(project.deliveryContext?.scope, "One workflow");
  assert.equal(project.deliveryContext?.expansionIdeas, "A separate future workflow");
  assert.equal(project.deliveryContext?.verifiedOutcomes, "");
});

test("an explicit amount meaning and action state never alter forecast or commercial readiness", () => {
  const opportunity = cleanOpportunities([{ name: "Possible engagement", value: 100_000, valueMeaning: "Estimated", actionState: "Suggested", nextActionReason: "Validate the need", desiredNextOutcome: "Buyer confirms a problem" }])[0];
  assert.equal(opportunity.valueMeaning, "Estimated");
  assert.equal(opportunity.forecast, "Not Forecasted");
  assert.equal(opportunity.seriousness, "Unknown");
  assert.equal(opportunity.actionState, "Suggested");
  assert.equal(opportunity.stage, "Explore");
  const invalid = cleanOpportunities([{ name: "Unknown", valueMeaning: "Definitely paid", actionState: "Sent" }])[0];
  assert.equal(invalid.valueMeaning, "Unknown");
  assert.equal(invalid.actionState, "Suggested");
});
