import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { focusedRecords, focusedTaskIds, contentMatchesSearch } from "../lib/record-focus";
import { PipelineView, ProjectsView } from "../components/director-operations";
import { DeliveryWorkspaceHome, GtmWorkspaceHome } from "../components/workspace-overviews";
import { ClientsView } from "../components/clients-view";
import { RelationshipsView } from "../components/relationships-view";
import { WorkflowGuide } from "../components/workflow-guide";
import { cleanOpportunities, cleanProjects } from "../lib/operations";
import type { TaskItem } from "../lib/types";

const noop = () => {};
const task = (id: string, parentId?: string) => ({ id, parentId, title: id, done: false, due: "", recurrence: "One-time", priority: "Normal", description: "" }) as TaskItem;

test("record focus is exact, numeric-ID compatible, non-mutating and fails closed", () => {
  const items = [{ id: "a", name: "Same title" }, { id: "b", name: "Same title" }, { id: 12, name: "Numeric" }];
  assert.equal(focusedRecords(items), items);
  assert.deepEqual(focusedRecords(items, "b"), [items[1]]);
  assert.deepEqual(focusedRecords(items, "12"), [items[2]]);
  assert.deepEqual(focusedRecords(items, "missing"), []);
  assert.equal(items.length, 3);
});

test("task focus preserves parent, siblings and nested children without including unrelated work", () => {
  const tasks = [task("parent"), task("child", "parent"), task("sibling", "parent"), task("nested", "child"), task("other")];
  assert.deepEqual([...focusedTaskIds(tasks, "child")!].sort(), ["parent", "child", "sibling", "nested"].sort());
  assert.equal(tasks[1].parentId, "parent");
  assert.equal(focusedTaskIds(tasks), undefined);
  assert.deepEqual([...focusedTaskIds(tasks, "missing")!], []);
});

test("task focus tolerates orphaned parents and cycles", () => {
  assert.deepEqual([...focusedTaskIds([task("orphan", "missing")], "orphan")!], ["orphan"]);
  assert.deepEqual([...focusedTaskIds([task("a", "b"), task("b", "a")], "a")!].sort(), ["a", "b"]);
});

test("content search matches title, topic and owner, ignores case and blank space", () => {
  const item = { title: "AI strategy", angle: "Board decisions", owner: "Ken", pillar: "Governance" };
  for (const query of [" AI STRATEGY ", "board", "KEN", "governance", " "]) assert.equal(contentMatchesSearch(item, query), true);
  assert.equal(contentMatchesSearch(item, "unrelated"), false);
});

test("a linked closed deal is revealed despite the normal Active filter", () => {
  const opportunities = cleanOpportunities([{ id: "won", name: "Closed deal to inspect", stage: "Closed Won" }, { id: "open", name: "Unrelated open deal", stage: "Explore" }]);
  const html = renderToStaticMarkup(createElement(PipelineView, { opportunities, accounts: [], setOpportunities: noop, addTask: noop, initialFocus: "won" }));
  assert.ok(html.includes("Closed deal to inspect"));
  assert.ok(!html.includes("Unrelated open deal"));
});

test("legacy opportunities render explainable deal priority without stored scores", () => {
  const opportunities = cleanOpportunities([{ id: "open", name: "Opportunity to review", stage: "Qualify", value: 25000, nextSpejAction: "Confirm scope", nextActionDue: "2026-09-05" }]);
  const html = renderToStaticMarkup(createElement(PipelineView, { opportunities, accounts: [], contacts: [], activities: [], setOpportunities: noop, addTask: noop, initialFocus: "open" }));
  assert.ok(html.includes("Strategic value"));
  assert.ok(html.includes("Win readiness"));
  assert.ok(html.includes("Action urgency"));
  assert.ok(html.includes("Why this deal priority?"));
  assert.ok(html.includes("Needs Attention"));
});

test("linked project focus renders the target only without changing full summary totals", () => {
  const projects = cleanProjects([{ id: "one", name: "Chosen project" }, { id: "two", name: "Other project" }]);
  const html = renderToStaticMarkup(createElement(ProjectsView, { projects, accounts: [], setProjects: noop, addTask: noop, initialFocus: "one" }));
  assert.ok(html.includes("Chosen project"));
  assert.ok(!html.includes("Other project"));
  assert.ok(html.includes("<b>2</b>"));
});

test("All Projects and GTM Plans are filtered views over the same records", () => {
  const projects = cleanProjects([
    { id: "client", name: "Client delivery", phase: "Delivery" },
    { id: "internal", name: "Internal launch", phase: "Internal" },
  ]);
  const delivery = renderToStaticMarkup(createElement(ProjectsView, { projects, accounts: [], setProjects: noop, addTask: noop, workspace: "delivery" }));
  const gtm = renderToStaticMarkup(createElement(ProjectsView, { projects, accounts: [], setProjects: noop, addTask: noop, workspace: "gtm" }));
  assert.ok(delivery.includes("All Projects"));
  assert.ok(delivery.includes("Client delivery"));
  assert.ok(delivery.includes("Internal launch"));
  assert.ok(gtm.includes("Plans &amp; Initiatives"));
  assert.ok(gtm.includes("Internal launch"));
  assert.ok(!gtm.includes("Client delivery"));
});

test("workspace landing pages explain the connected GTM and Projects model", () => {
  const common = { accounts: [], opportunities: [], projects: [], tasks: [], goTo: noop };
  const gtm = renderToStaticMarkup(createElement(GtmWorkspaceHome, { ...common, contacts: [], partnerships: [], campaigns: [], content: [] }));
  const delivery = renderToStaticMarkup(createElement(DeliveryWorkspaceHome, common));
  assert.ok(gtm.includes("Sales, partners, marketing"));
  assert.ok(gtm.includes("One record from sale to project"));
  assert.ok(gtm.includes(">Outbound<"));
  assert.ok(gtm.includes("part of the same outbound workflow"));
  assert.ok(!gtm.includes("LinkedIn Focus"));
  assert.ok(!gtm.includes("Personal LinkedIns"));
  assert.ok(delivery.includes(">Projects<"));
  assert.ok(delivery.includes("Connected project records"));
  assert.ok(delivery.includes("Connected, not duplicated"));
});

test("outbound nests 5-3-1 under the shared workflow without installing personal posting chores", () => {
  const html = renderToStaticMarkup(createElement(RelationshipsView, {
    accounts: [], contacts: [], activities: [], campaigns: [], tasks: [], opportunities: [], projects: [], partnerships: [],
    setAccounts: noop, setContacts: noop, setActivities: noop, addTask: noop, goTo: noop, initialFocus: "531",
  }));
  assert.ok(html.includes("<h1>Outbound</h1>"));
  assert.ok(html.includes("Email, calls, and LinkedIn follow-ups belong to the same outbound workflow"));
  assert.ok(html.includes("LinkedIn within outbound"));
  assert.ok(html.includes('aria-label="5-3-1 LinkedIn progress"'));
  assert.ok(html.indexOf("LinkedIn within outbound") < html.indexOf('aria-label="5-3-1 LinkedIn progress"'));
  assert.ok(html.includes("Five accounts, three people in each, one relevant action"));
  assert.ok(html.includes("Manual action required"));
  assert.ok(!html.includes("Add daily LinkedIn tasks"));
  assert.ok(!html.includes("LinkedIn Focus"));
});

test("workflow guidance keeps outbound together and describes one company content workflow", () => {
  const outbound = renderToStaticMarkup(createElement(WorkflowGuide, { activeTab: "gtm-linkedin", goTo: noop, askSosa: noop }));
  const content = renderToStaticMarkup(createElement(WorkflowGuide, { activeTab: "content", goTo: noop, askSosa: noop }));
  assert.ok(outbound.includes("part of outbound, not a separate GTM motion"));
  assert.ok(!outbound.includes("optional"));
  assert.ok(content.includes("Manage company content"));
  assert.ok(!content.includes("Personal LinkedIns"));
});

test("client search has a visible label and horizontal icon wrapper", () => {
  const html = renderToStaticMarkup(createElement(ClientsView, { accounts: [], contacts: [], tasks: [], projects: [], opportunities: [], partnerships: [], activities: [], setAccounts: noop, setActivities: noop, goTo: noop }));
  assert.ok(html.includes('class="search-field">Search<span class="search-box">'));
  assert.ok(html.includes('aria-label="Search account relationships"'));
});
