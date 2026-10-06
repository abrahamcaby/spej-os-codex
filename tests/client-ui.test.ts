import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ClientsView } from "../components/clients-view";
import { RelationshipsView } from "../components/relationships-view";
import { RoleHomeSummary } from "../components/personal-home";
import { TodayActionCenter } from "../components/today-action-center";
import { cleanAccounts, cleanContacts } from "../lib/operations";
import { metricDay } from "../lib/gtm-metrics";
import { getTeamViewProfile } from "../lib/team-views";
import type { WorkspaceState } from "../lib/types";

const state = (): WorkspaceState => ({ accounts: cleanAccounts([{ id: "a", name: "Example client", type: "Client", clientStatus: "Past client", owner: "Aby", checkInCadence: "One-time", nextCheckIn: "2026-08-01", lastCheckIn: "2026-08-02", acquisitionMotion: "Referral", source: "Executive introduction", originatingContactId: "c", sourceDate: "2026-07-15" }]), contacts: cleanContacts([{ id: "c", name: "Example person", accountId: "a", lifecycleStage: "Network" }]), tasks: [], activities: [], projects: [], opportunities: [], partnerships: [], campaigns: [], content: [], marketingMetrics: [], reminders: [] });
const noop = () => {};
const previewViewer = getTeamViewProfile("aby")!;

test("client profile renders connected history and completed one-time state", () => {
  const html = renderToStaticMarkup(createElement(ClientsView, { ...state(), setAccounts: noop, setActivities: noop, goTo: noop, initialAccountId: "a" }));
  for (const label of ["Account details", "Example client", "Example person", "Completed — one-time follow-up", "Account source:", "Referral", "Executive introduction", "Deals", "Project history", "Relationship history"]) assert.ok(html.includes(label), label);
});

test("canonical and legacy account deep links open account details without replacing People classification", () => {
  const data = state();
  const html = renderToStaticMarkup(createElement(RelationshipsView, { ...data, setAccounts: noop, setContacts: noop, setActivities: noop, goTo: noop, addTask: noop, initialFocus: "account:a" }));
  const legacy = renderToStaticMarkup(createElement(RelationshipsView, { ...data, setAccounts: noop, setContacts: noop, setActivities: noop, goTo: noop, addTask: noop, initialFocus: "client:a" }));
  assert.ok(html.includes("Account details")); assert.ok(html.includes("Project history")); assert.ok(legacy.includes("Account details")); assert.equal(data.contacts[0].lifecycleStage, "Network");
});

test("stable CRM section routes open People and Activity directly", () => {
  const data = state();
  const people = renderToStaticMarkup(createElement(RelationshipsView, { ...data, setAccounts: noop, setContacts: noop, setActivities: noop, goTo: noop, addTask: noop, initialFocus: "people" }));
  const activity = renderToStaticMarkup(createElement(RelationshipsView, { ...data, setAccounts: noop, setContacts: noop, setActivities: noop, goTo: noop, addTask: noop, initialFocus: "activity" }));
  assert.ok(people.includes("Account link"));
  assert.ok(people.includes("Add person"));
  assert.ok(activity.includes("Log activity"));
  assert.ok(activity.includes("No activity yet"));
});

test("People clearly exposes records that still need an account link", () => {
  const data = state();
  data.contacts.push(...cleanContacts([{ id: "unlinked", name: "Independent contact", accountId: "", source: "In-person event" }]));
  const html = renderToStaticMarkup(createElement(RelationshipsView, { ...data, setAccounts: noop, setContacts: noop, setActivities: noop, goTo: noop, addTask: noop, initialFocus: "unlinked" }));
  for (const label of ["Needs account linking", "Account not linked", "Link account"]) assert.ok(html.includes(label), label);
});

test("Today offers expansion of the combined queue instead of sending hidden check-ins to Tasks", () => {
  const data = state(); data.accounts = Array.from({ length: 15 }, (_, i) => cleanAccounts([{ id: `a${i}`, name: `Client ${i}`, owner: "Aby", checkInCadence: "One-time", nextCheckIn: metricDay() }])[0]);
  const html = renderToStaticMarkup(createElement(TodayActionCenter, { ...data, viewer: previewViewer, goTo: noop, completeTask: noop }));
  assert.ok(html.includes("Show all 15 assigned items")); assert.ok(!html.includes("Open all work"));
});

test("Today keeps another person's private work hidden and separates shared company work", () => {
  const data = state();
  data.tasks.push(
    { id: "private", title: "Private executive task", description: "", due: metricDay(), recurrence: "One-time", priority: "High", owner: "Sagar", ownerProfileId: "sagar", visibility: "Private", workspaceId: "gtm", category: "Sales", done: false },
    { id: "company", title: "Company planning task", description: "", due: metricDay(), recurrence: "One-time", priority: "Normal", owner: "Joseph", ownerProfileId: "joseph", visibility: "Company", workspaceId: "company", category: "Operations", done: false },
  );
  const mine = renderToStaticMarkup(createElement(TodayActionCenter, { ...data, viewer: previewViewer, goTo: noop, completeTask: noop }));
  const shared = renderToStaticMarkup(createElement(TodayActionCenter, { ...data, viewer: previewViewer, goTo: noop, completeTask: noop, initialScope: "shared" }));
  assert.ok(!mine.includes("Private executive task"));
  assert.ok(!mine.includes("Company planning task"));
  assert.ok(!shared.includes("Private executive task"));
  assert.ok(shared.includes("Company planning task"));
  assert.ok(shared.includes("Company-wide"));
  assert.ok(shared.includes("Owner · Joseph"));
});

test("My Work uses the stable owner profile id even when a display name changes or conflicts", () => {
  const data = state();
  data.tasks.push(
    { id: "stable", title: "Stable owner task", description: "", due: metricDay(), recurrence: "One-time", priority: "High", owner: "Previous display name", ownerProfileId: "aby", visibility: "Private", workspaceId: "gtm", category: "Sales", done: false },
    { id: "conflict", title: "Conflicting label task", description: "", due: metricDay(), recurrence: "One-time", priority: "High", owner: "Aby", ownerProfileId: "sagar", visibility: "Private", workspaceId: "gtm", category: "Sales", done: false },
  );
  const html = renderToStaticMarkup(createElement(TodayActionCenter, { ...data, viewer: previewViewer, goTo: noop, completeTask: noop }));
  assert.ok(html.includes("Stable owner task"));
  assert.ok(!html.includes("Conflicting label task"));
  assert.ok(html.includes("Owner · Aby"));
  assert.ok(!html.includes("Owner · Previous display name"));
});

test("My Work renders mixed responsibilities as two actionable role views", () => {
  const data = state();
  const html = renderToStaticMarkup(createElement(RoleHomeSummary, {
    viewer: { profileId: "sean", displayName: "Sean", focus: ["Technical Delivery", "Project Management"], homeLabel: "Assigned work" },
    accounts: data.accounts,
    contacts: data.contacts,
    opportunities: data.opportunities,
    partnerships: data.partnerships,
    projects: data.projects,
    campaigns: data.campaigns,
    content: data.content,
    tasks: data.tasks,
    goTo: noop,
  }));
  assert.ok(html.includes("Technical work"));
  assert.ok(html.includes(">Projects<"));
  assert.ok(html.includes("Open view"));
  assert.ok(!html.includes("role pulse"));
});

test("client profiles expose exact saved meeting sources through SOSA", () => {
  const data = state();
  data.activities.push({ id: "activity", accountId: "a", contactId: "c", channel: "Meeting", summary: "Discovery call", outcome: "Next step agreed", occurredAt: "2026-08-27", createdAt: "2026-08-27T12:00:00Z", sourceArtifactId: "intake-1", sourceLabel: "Full discovery transcript" });
  const html = renderToStaticMarkup(createElement(ClientsView, { ...data, setAccounts: noop, setActivities: noop, goTo: noop, initialAccountId: "a" }));
  assert.ok(html.includes("Meeting sources"));
  assert.ok(html.includes("Full discovery transcript"));
  assert.ok(html.includes("Open transcript in SOSA"));
});
