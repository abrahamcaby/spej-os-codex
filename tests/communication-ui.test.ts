import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CommunicationTimeline } from "../components/communication-timeline";
import { PersonCommunicationProfile } from "../components/person-communication-profile";
import { RelationshipsView } from "../components/relationships-view";
import { ClientsView } from "../components/clients-view";
import { cleanAccounts, cleanActivities, cleanContacts } from "../lib/operations";
import type { ActivityItem, TaskItem } from "../lib/types";
import { previewCanViewTask } from "../lib/task-access-preview";
import { getTeamViewProfile } from "../lib/team-views";

const noop = () => {};
const accounts = cleanAccounts([{ id: "a", name: "Example company", owner: "Aby" }, { id: "old", name: "Former company" }]);
const contacts = cleanContacts([{ id: "p", name: "Example person", accountId: "a", lastContact: "2026-01-09", notes: "Relationship context" }, { id: "other", name: "Other person", accountId: "a" }]);
const event = (changes: Partial<ActivityItem> = {}) => cleanActivities([{ id: "event", accountId: "a", contactId: "p", channel: "Email", metricType: "Outreach sent", summary: "Shared an example", outcome: "First line\nSecond line", occurredAt: "2020-02-01", owner: "Aby", createdAt: "2026-01-03T10:00:00Z", ...changes }])[0];
const profileProps = { contact: contacts[0], accounts, contacts, activities: [] as ActivityItem[], tasks: [] as TaskItem[], campaigns: [], defaultOwner: "Aby", onSaveActivity: noop, onArchiveActivity: noop, onSaveContact: noop, onEditContact: noop, onOpenAccount: noop, onOpenTask: noop, onAddFollowUp: noop };
const relationshipProps = { accounts, contacts, activities: [], tasks: [], campaigns: [], opportunities: [], projects: [], partnerships: [], setAccounts: noop, setContacts: noop, setActivities: noop, goTo: noop, addTask: noop, defaultOwner: "Aby" };

test("person route opens a profile with exact-person communication and dates rather than a search result", () => {
  const html = renderToStaticMarkup(createElement(RelationshipsView, { ...relationshipProps, initialFocus: "p", activities: [event(), event({ id: "reply", metricType: "Reply received", summary: "Their answer", occurredAt: "2020-02-02" }), event({ id: "other", contactId: "other", summary: "Other person's private conversation", occurredAt: "2020-02-03" })] }));
  for (const text of ["Back to People", "Log interaction", "Communication history", "Last outreach", "Last reply", "Last conversation", "Next follow-up", "Their answer"]) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /Other person&#x27;s private conversation|Other person&#x27;/);
  assert.doesNotMatch(html, /Search relationships/);
  assert.doesNotMatch(html, /recorded activities<\/span>/);
  assert.match(html, /<dt>Last outreach<\/dt><dd>2020-02-01/);
  assert.match(html, /<dt>Last reply<\/dt><dd>2020-02-02/);
});

test("legacy contact date is reference only, never a derived reply or outreach", () => {
  const html = renderToStaticMarkup(createElement(PersonCommunicationProfile, profileProps));
  assert.match(html, /<dt>Last outreach<\/dt><dd>Not recorded/);
  assert.match(html, /<dt>Last reply<\/dt><dd>Not recorded/);
  assert.match(html, /Earlier contact-date record/);
  assert.match(html, /2026-01-09 was previously entered/);
  assert.match(html, /syncing are not connected/);
});

test("every timeline entry keeps channel, activity type, person and owner visible", () => {
  const html = renderToStaticMarkup(createElement(CommunicationTimeline, { accounts, contacts, activities: [event({ channel: "Text / SMS", summary: "Text follow-up", metricType: "Follow-up sent" })] }));
  for (const text of ["Text / SMS", "Follow-up sent", "Example person", "Example company", "Logged by ", "Aby", "2020-02-01", "First line\nSecond line", "All channels", "All people", "All accounts", "Search history"]) assert.ok(html.includes(text), text);
});

test("unknown original dates never display today's capture as the interaction date", () => {
  const html = renderToStaticMarkup(createElement(CommunicationTimeline, { accounts, contacts, activities: [event({ occurredAt: "", sourceDateKnown: false })] }));
  assert.match(html, /Original date unknown/);
  assert.doesNotMatch(html, /<time/);
  assert.match(html, /Logged at/);
});

test("person history retains earlier employer context and offers edit/archive with safe labels", () => {
  const html = renderToStaticMarkup(createElement(PersonCommunicationProfile, { ...profileProps, activities: [event({ accountId: "old", outcome: "Long message ".repeat(150) + "unique final sentence" })] }));
  for (const text of ["Former company", "Read full message / notes", "unique final sentence", "Edit activity: Shared an example", "Archive activity: Shared an example"]) assert.ok(html.includes(text), text);
});

test("account history paginates all records instead of silently truncating to eight", () => {
  const activities = Array.from({ length: 12 }, (_, i) => event({ id: `event-${i}`, summary: `History ${i}`, occurredAt: `2020-02-${String(i + 1).padStart(2, "0")}` }));
  const html = renderToStaticMarkup(createElement(ClientsView, { ...relationshipProps, activities, initialAccountId: "a" }));
  assert.match(html, /Relationship history/);
  assert.match(html, /12 entries/);
  assert.match(html, /Show more interactions \(2 remaining\)/);
  assert.match(html, /Last relationship check-in/);
});

test("archived and other-person interactions cannot enter a profile stream", () => {
  const html = renderToStaticMarkup(createElement(PersonCommunicationProfile, { ...profileProps, activities: [event({ summary: "Archived secret", archivedAt: "2026-01-03T11:00:00Z" }), event({ id: "other", contactId: "other", summary: "Other contact secret" })] }));
  assert.doesNotMatch(html, /Archived secret|Other contact secret/);
  assert.match(html, /No activity yet/);
});

test("relationship hold stays visible without preventing logging completed interactions", () => {
  const held = cleanAccounts([{ ...accounts[0], outreachHold: { active: true, reason: "Coordinate with owner", until: "", releaseCondition: "Owner confirms" } }]);
  const html = renderToStaticMarkup(createElement(PersonCommunicationProfile, { ...profileProps, accounts: held }));
  assert.match(html, /Routine outreach paused/);
  assert.match(html, /Coordinate with owner/);
  assert.match(html, /Log interaction/);
});

test("private follow-up dates and titles stay out of another viewer's profile", () => {
  const privateTask: TaskItem = { id: "secret", title: "Private follow-up detail", description: "", category: "Sales", due: "2026-01-01", recurrence: "One-time", priority: "Normal", done: false, relatedType: "contact", relatedId: "p", owner: "Sagar", ownerProfileId: "sagar", visibility: "Private" };
  const tasks = [privateTask].filter((item) => previewCanViewTask(item, getTeamViewProfile("aby")!, []));
  const html = renderToStaticMarkup(createElement(PersonCommunicationProfile, { ...profileProps, tasks }));
  assert.doesNotMatch(html, /Private follow-up detail/);
  assert.match(html, /Not scheduled/);
});

test("message content is escaped rather than rendered as HTML", () => {
  const html = renderToStaticMarkup(createElement(CommunicationTimeline, { accounts, contacts, activities: [event({ outcome: "<img src=x onerror=alert(1)>" })] }));
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img src="?x/);
});
