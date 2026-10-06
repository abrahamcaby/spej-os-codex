import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ClientsView } from "../components/clients-view";
import { GtmActivityForm } from "../components/gtm-activity-form";
import { RelationshipContextPanel, RelationshipContextWorkspace } from "../components/relationship-context-panel";
import { RelationshipsView } from "../components/relationships-view";
import { metricDay } from "../lib/gtm-metrics";
import { cleanAccounts, cleanActivities, cleanContacts } from "../lib/operations";
import type { AccountItem, WorkspaceState } from "../lib/types";

const noop = () => {};
const today = metricDay();
const capturedToday = new Date(`${today}T12:00:00`).toISOString();
const account = (changes: Partial<AccountItem> = {}) => cleanAccounts([{ id: "account", name: "Example organization", owner: "Aby", ...changes }])[0];
const workspace = (accounts: AccountItem[]): WorkspaceState => ({ accounts, contacts: [], activities: [], campaigns: [], content: [], tasks: [], opportunities: [], projects: [], partnerships: [], marketingMetrics: [], reminders: [] });

function fieldValue(html: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const input = html.match(new RegExp(`<label>${escaped}<input\\b[^>]*>`))?.[0];
  assert.ok(input, `Missing input label: ${label}`);
  return input.match(/\bvalue="([^"]*)"/)?.[1];
}

test("account brief keeps original attribution beside subsequent influence and competing evidence", () => {
  const a = account({ source: "Later trade event", acquisitionMotion: "Event", originalSource: { source: "Original executive referral", acquisitionMotion: "Referral", sourceDate: "2020-02-03", originatingContactId: "origin" }, contextFacts: [
    { id: "buyer", topic: "Start timing", text: "Buyer requires a January start", kind: "Customer statement", sourceLabel: "Original buyer email", sourceDate: "2020-04-05", capturedAt: capturedToday, status: "Conflicting" },
    { id: "guess", topic: "Start timing", text: "Internal team thinks December may work", kind: "Hypothesis", sourceLabel: "Internal planning note", sourceDate: "", capturedAt: "", status: "Conflicting" },
  ] });
  const contacts = cleanContacts([{ id: "origin", name: "Original introducer", accountId: "account" }]);
  const state = { ...workspace([a]), contacts };
  const html = renderToStaticMarkup(createElement(ClientsView, { ...state, setAccounts: noop, setActivities: noop, goTo: noop, initialAccountId: "account" }));
  assert.match(html, /Original executive referral/);
  assert.match(html, /Later trade event/);
  assert.match(html, /Original introducer/);
  assert.match(html, /Buyer requires a January start/);
  assert.match(html, /Internal team thinks December may work/);
  assert.match(html, /Customer statement · Conflicting/);
  assert.match(html, /Hypothesis · Conflicting/);
  assert.match(html, /Original date: 2020-04-05/);
  assert.match(html, /Original date: Not recorded · Captured: Not recorded/);
  assert.match(html, /Both versions remain in the history/);
  assert.equal(a.contextFacts?.length, 2);
});

test("account context forms are independent even inside the expanded account view", () => {
  const html = renderToStaticMarkup(createElement(ClientsView, { ...workspace([account()]), setAccounts: noop, setActivities: noop, goTo: noop, initialAccountId: "account" }));
  let depth = 0;
  let forms = 0;
  for (const [tag] of html.matchAll(/<\/?form\b[^>]*>/g)) {
    if (tag.startsWith("</")) depth -= 1;
    else { depth += 1; forms += 1; }
    assert.ok(depth >= 0 && depth <= 1, "Account editors must not nest forms");
  }
  assert.equal(depth, 0);
  assert.ok(forms >= 3, "Evidence, nurture, and hold forms should be rendered independently");
  assert.match(html, /<summary>Add sourced context<\/summary>/);
  assert.match(html, /<summary>Add nurture plan<\/summary>/);
});

test("Connections distinguishes an unrequested affiliation from an accepted introduction", () => {
  const accounts = cleanAccounts([{ id: "network", name: "Network account", connections: [
    { id: "route", fromContactId: "connector", toAccountId: "target", context: "Shared professional community", kind: "Public affiliation", introductionStatus: "Not requested", relevance: "May understand the operating problem", nextStep: "Ask whether an introduction is appropriate", confidence: "Low" },
    { id: "actual", fromContactId: "connector", toAccountId: "target", toContactId: "buyer", context: "Introducer connected us by email", kind: "Actual introduction", introductionStatus: "Accepted", relevance: "Buyer accepted a discovery conversation", nextStep: "Agree the discovery agenda", confidence: "High", evidence: "Introduction email", evidenceDate: "2020-04-05", validator: "Aby" },
  ] }, { id: "target", name: "Target organization" }]);
  const contacts = cleanContacts([{ id: "connector", name: "Known connector", accountId: "network" }, { id: "buyer", name: "Potential buyer", accountId: "target" }]);
  const before = JSON.stringify({ accounts, contacts });
  const html = renderToStaticMarkup(createElement(RelationshipContextWorkspace, { view: "connections", accounts, contacts, activities: [], onOpenAccount: noop }));
  const rows = [...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)].map((match) => match[1]);
  assert.equal(rows.length, 2);
  assert.match(rows[0], /Public affiliation/);
  assert.match(rows[0], /Not requested · Low confidence/);
  assert.match(rows[0], /Ask whether an introduction is appropriate/);
  assert.match(rows[1], /Actual introduction/);
  assert.match(rows[1], /Accepted · High confidence/);
  assert.match(rows[1], /Known connector → Target organization → Potential buyer/);
  assert.match(html, /Introduction lifecycle/);
  assert.equal(JSON.stringify({ accounts, contacts }), before, "Rendering must not promote or merge records");
  assert.equal(contacts[1].lifecycleStage, "Unclassified");
});

test("Nurture explains the purpose, pause condition, and still-active outreach hold", () => {
  const a = account({ outreachHold: { active: true, reason: "Coordinate with relationship owner", until: "2020-01-01", releaseCondition: "Owner confirms the timing" }, nurturePlan: { approach: "Dormant", owner: "Alex", nextAction: "Check whether the original problem remains relevant", dueDate: "", trigger: "Buyer confirms the system change", reason: "Understand whether support is still needed", desiredOutcome: "Buyer confirms a current problem", pauseCondition: "No relevant initiative remains", state: "Paused" } });
  const html = renderToStaticMarkup(createElement(RelationshipContextWorkspace, { view: "nurture", accounts: [a], contacts: [], activities: [], onOpenAccount: noop }));
  for (const phrase of ["Dormant · Paused", "Alex", "Buyer confirms the system change", "Understand whether support is still needed", "Buyer confirms a current problem", "No relevant initiative remains", "Coordinate with relationship owner", "explicitly resolved"]) assert.ok(html.includes(phrase), phrase);
  const panel = renderToStaticMarkup(createElement(RelationshipContextPanel, { account: a, accounts: [a], contacts: [], activities: [], onSave: noop }));
  assert.match(panel, /Owner confirms the timing/);
  assert.match(panel, /Condition met — resolve outreach hold/);
});

test("routine outreach is disabled for held accounts without removing manual logging", () => {
  const a = account({ focus531: true, outreachHold: { active: true, reason: "Wait for the buyer's approval", until: "", releaseCondition: "Buyer approves contact" } });
  const state = { ...workspace([a]), contacts: cleanContacts([{ id: "person", name: "Example contact", accountId: a.id, focus531: true }]) };
  const props = { ...state, setAccounts: noop, setContacts: noop, setActivities: noop, addTask: noop, goTo: noop };
  const accountHtml = renderToStaticMarkup(createElement(RelationshipsView, props));
  const peopleHtml = renderToStaticMarkup(createElement(RelationshipsView, { ...props, initialFocus: "people" }));
  const focusHtml = renderToStaticMarkup(createElement(RelationshipsView, { ...props, initialFocus: "531" }));
  for (const html of [accountHtml, peopleHtml]) assert.match(html, /<button[^>]*disabled=""[^>]*>Follow up /);
  assert.match(focusHtml, /<button[^>]*disabled=""[^>]*>Add to Work<\/button>/);
  assert.match(focusHtml, /<button class="log-action">Log done today<\/button>/);
});

test("weekly capture changes do not imply a recent buyer response or an invented source date", () => {
  const a = account({ contextFacts: [
    { id: "new-capture", topic: "Buyer priorities", text: "Historical forwarded context", kind: "Customer statement", sourceLabel: "Forwarded email", sourceDate: "", capturedAt: capturedToday, status: "Current" },
    { id: "unknown-capture", topic: "Systems", text: "Undated imported note", kind: "Internal observation", sourceLabel: "Imported note", sourceDate: "", capturedAt: "", status: "Current" },
  ] });
  const activities = cleanActivities([{ accountId: a.id, summary: "Original buyer reply", metricType: "Reply received", occurredAt: "2020-04-05", captureMethod: "Forwarded email", capturedAt: capturedToday, sourceDateKnown: true }]);
  const weekly = renderToStaticMarkup(createElement(RelationshipContextWorkspace, { view: "weekly", accounts: [a], contacts: [], activities, onOpenAccount: noop }));
  assert.match(weekly, /1 context update captured in the past seven days/);
  assert.doesNotMatch(weekly, /2 context updates/);
  const panel = renderToStaticMarkup(createElement(RelationshipContextPanel, { account: a, accounts: [a], contacts: [], activities, onSave: noop }));
  assert.match(panel, /<dt>Last buyer response<\/dt><dd>2020-04-05<\/dd>/);
  assert.ok(panel.includes(`<dt>Last captured or imported</dt><dd>${today}</dd>`));
  assert.match(panel, /Original date: Not recorded/);
});

test("editing an activity with an unknown original date leaves the date blank", () => {
  const initial = cleanActivities([{ id: "historical", summary: "Undated imported reply", occurredAt: "", metricType: "Reply received", sourceDateKnown: false, captureMethod: "Forwarded email", capturedAt: capturedToday }])[0];
  const html = renderToStaticMarkup(createElement(GtmActivityForm, { accounts: [], contacts: [], initial, onSave: noop, onCancel: noop }));
  assert.equal(fieldValue(html, "Original activity date"), "");
  const legacy = renderToStaticMarkup(createElement(GtmActivityForm, { accounts: [], contacts: [], initial: { ...initial, sourceDateKnown: undefined, occurredAt: "" }, onSave: noop, onCancel: noop }));
  assert.equal(fieldValue(legacy, "Original activity date"), "");
});

test("forwarded activity entry requires its original date while direct entry keeps today's convenience", () => {
  const props = { accounts: [], contacts: [], onSave: noop, onCancel: noop };
  const forwarded = renderToStaticMarkup(createElement(GtmActivityForm, { ...props, defaults: { captureMethod: "Forwarded email" } }));
  const dated = renderToStaticMarkup(createElement(GtmActivityForm, { ...props, defaults: { captureMethod: "Forwarded email", occurredAt: "2020-04-05" } }));
  const direct = renderToStaticMarkup(createElement(GtmActivityForm, props));
  assert.equal(fieldValue(forwarded, "Original activity date"), "");
  assert.equal(fieldValue(dated, "Original activity date"), "2020-04-05");
  assert.equal(fieldValue(direct, "Original activity date"), today);
});

test("a potential validation contact does not become a claim of completed validation", () => {
  const a = account({ connections: [{ id: "possible", fromContactId: "connector", toAccountId: "target", context: "Possible introduction route", kind: "Possible introduction", introductionStatus: "Not requested", validator: "Alex", lastInteractionDate: "", relevance: "May help understand the need", nextStep: "Ask Alex to validate the relationship", dueDate: "", evidence: "Internal note", evidenceDate: "2020-04-05", confidence: "Low" }] });
  const accounts = [a, account({ id: "target", name: "Target account" })];
  const contacts = cleanContacts([{ id: "connector", name: "Potential connector", accountId: a.id }]);
  const html = renderToStaticMarkup(createElement(RelationshipContextPanel, { account: a, accounts, contacts, activities: [], onSave: noop }));
  assert.match(html, /Validation contact: Alex/);
  assert.doesNotMatch(html, /Validated by/);
  assert.match(html, /Ask Alex to validate the relationship/);
});

test("evening captures display and enter weekly review on their local day", (context) => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = "America/New_York";
  context.mock.timers.enable({ apis: ["Date"], now: new Date("2026-09-09T02:00:00Z") });
  try {
    assert.equal(metricDay(), "2026-09-08");
    const a = account({ contextFacts: [{ id: "evening", topic: "Buyer priorities", text: "Context captured this evening", kind: "Customer statement", sourceLabel: "Evening forwarded email", sourceDate: "2020-04-05", capturedAt: "2026-09-09T01:00:00Z", status: "Current" }] });
    const activities = cleanActivities([{ accountId: a.id, summary: "Old email captured this evening", metricType: "Reply received", occurredAt: "2020-04-05", captureMethod: "Forwarded email", capturedAt: "2026-09-09T01:00:00Z", sourceDateKnown: true }]);
    const panel = renderToStaticMarkup(createElement(RelationshipContextPanel, { account: a, accounts: [a], contacts: [], activities, onSave: noop }));
    assert.match(panel, /<dt>Last captured or imported<\/dt><dd>2026-09-08<\/dd>/);
    assert.match(panel, /Original date: 2020-04-05 · Captured: 2026-09-08/);
    assert.doesNotMatch(panel, /Captured: 2026-09-09/);
    const weekly = renderToStaticMarkup(createElement(RelationshipContextWorkspace, { view: "weekly", accounts: [a], contacts: [], activities, onOpenAccount: noop }));
    assert.match(weekly, /1 context update captured in the past seven days/);
    assert.doesNotMatch(weekly, /No relationship review items/);
  } finally {
    context.mock.timers.reset();
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});
