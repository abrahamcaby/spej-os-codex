import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkTaskRow, type WorkTaskRowProps } from "../components/task-work-row";
import type { TaskItem } from "../lib/types";

const noop = () => {};
const task = (patch: Partial<TaskItem> = {}): TaskItem => ({
  id: "review", title: "Review release readiness", description: "Check the acceptance criteria.",
  due: "2026-09-17", recurrence: "One-time", priority: "High", owner: "Person One",
  status: "In Progress", effort: "Medium", category: "Project Work", visibility: "Workspace", done: false,
  ...patch,
});
function props(patch: Partial<WorkTaskRowProps> = {}): WorkTaskRowProps {
  return {
    task: task(), workspaceLabel: "Projects", visibilityLabel: "Workspace members", dueLabel: "Sep 17", dueToday: false,
    canEdit: true, canChangeOwner: true, owners: ["Person One", "Person Two", "Unassigned"],
    remainingChildren: 0, hasOpenChildren: false, totalChildren: 0, expanded: false,
    onComplete: noop, onToggleChildren: noop, onEdit: noop, onAddSubtask: noop,
    onDelete: noop, onOwnerChange: noop, onStatusChange: noop, onPriorityChange: noop,
    ...patch,
  };
}
function render(patch: Partial<WorkTaskRowProps> = {}) {
  return renderToStaticMarkup(createElement(WorkTaskRow, props(patch)));
}
function openingTag(html: string, tag: string, className: string): string {
  const result = html.match(new RegExp(`<${tag}\\b[^>]*class="${className}(?: [^"]*)?"[^>]*>`))?.[0];
  assert.ok(result, `Missing ${tag}.${className}`);
  return result;
}

test("owner, status, priority and due have visible labels beside their controls", () => {
  const html = render();
  for (const label of ["Owner", "Status", "Priority", "Due"]) {
    assert.match(html, new RegExp(`<span class="work-task-field-label"[^>]*>${label}<\\/span>`));
  }
  for (const label of ["Owner", "Status", "Priority"]) {
    assert.ok(html.includes(`aria-label="${label} for Review release readiness"`));
  }
  assert.match(openingTag(html, "button", "work-task-due-value"), /aria-label="Edit due date for Review release readiness: Sep 17"/);
  const withoutSelects = html.replace(/<select\b[\s\S]*?<\/select>/g, "");
  assert.doesNotMatch(withoutSelects, /Person One|In Progress|Owner ·|Status ·/);
  assert.equal((html.match(/<option value="Person One"/g) || []).length, 1);
});

test("read-only rows disable every mutation control and omit the delete menu", () => {
  const html = render({ canEdit: false, canChangeOwner: true });
  for (const className of ["work-task-owner", "work-task-status", "work-task-priority"]) {
    assert.match(openingTag(html, "select", className), /disabled=""/);
  }
  for (const className of ["work-task-complete", "work-task-edit", "work-task-add"]) {
    assert.match(openingTag(html, "button", className), /disabled=""/);
  }
  assert.match(html, /Read only in this view\. Task changes are unavailable\./);
  assert.doesNotMatch(html, /work-task-delete|work-task-more/);
  assert.doesNotMatch(html, /<button\b[^>]*class="work-task-due-value/);
  assert.match(html, /<p\b[^>]*class="work-task-due-value/);
});

test("private task owners cannot be cleared through the inline Unassigned option", () => {
  const html = render({ task: task({ visibility: "Private" }), visibilityLabel: "Owner only" });
  const unassigned = html.match(/<option\b[^>]*value="Unassigned"[^>]*>/)?.[0];
  assert.ok(unassigned, "The unassigned option remains explainable but unavailable for private work");
  assert.match(unassigned, /disabled=""/);
  const shared = render({ task: task({ visibility: "Workspace" }) });
  assert.doesNotMatch(shared.match(/<option\b[^>]*value="Unassigned"[^>]*>/)?.[0] || "", /disabled=""/);
});

test("owner permissions disable reassignment without disabling otherwise editable work", () => {
  const html = render({ canEdit: true, canChangeOwner: false });
  assert.match(openingTag(html, "select", "work-task-owner"), /disabled=""/);
  assert.doesNotMatch(openingTag(html, "select", "work-task-status"), /disabled=""/);
  assert.doesNotMatch(openingTag(html, "button", "work-task-edit"), /disabled=""/);
});

test("known open children block completion even when none are visible in this view", () => {
  const html = render({ remainingChildren: 0, totalChildren: 0, hasOpenChildren: true });
  const button = openingTag(html, "button", "work-task-complete");
  assert.match(button, /disabled=""/);
  assert.match(button, /Complete open subtasks before completing/);
  assert.match(openingTag(render({ task: task({ done: true }) }), "button", "work-task-complete"), /disabled=""/);
  assert.doesNotMatch(openingTag(render(), "button", "work-task-complete"), /disabled=""/);
});

test("child disclosure exposes expansion state and is absent on subtask rows", () => {
  const expanded = render({ totalChildren: 3, remainingChildren: 2, hasOpenChildren: true, expanded: true });
  assert.match(openingTag(expanded, "button", "work-task-expand"), /aria-expanded="true"/);
  assert.match(expanded, /2 open of 3 visible subtasks/);
  const collapsed = render({ totalChildren: 3, expanded: false });
  assert.match(openingTag(collapsed, "button", "work-task-expand"), /aria-expanded="false"/);
  assert.match(collapsed, /Show subtasks for/);
  const child = render({ totalChildren: 3, isSubtask: true });
  assert.doesNotMatch(child, /work-task-expand|work-task-add/);
  assert.match(child, /is-subtask/);
});

test("quoted and markup-looking task titles remain text, including accessible labels", () => {
  const title = 'Review "sign-off" <script>alert("x")</script> & launch';
  const html = render({ task: task({ title }) });
  assert.doesNotMatch(html, /<script>|<\/script>/);
  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.match(html, /aria-label="Owner for Review &quot;sign-off&quot;/);
  assert.match(html, /&amp; launch/);
});

test("long task titles remain available in full without mutating canonical values", () => {
  const record = task({ title: `Review ${"acceptance criteria ".repeat(60)}😀` });
  const before = structuredClone(record);
  const html = render({ task: record, focused: true });
  assert.ok(html.includes(`>${record.title}</h3>`));
  assert.match(html, /work-task-row is-focused/);
  assert.deepEqual(record, before);
});

test("delete is placed inside a closed secondary actions disclosure", () => {
  const html = render();
  const disclosure = html.match(/<details\b[^>]*class="work-task-more"[^>]*>([\s\S]*?)<\/details>/);
  assert.ok(disclosure, "Editable rows provide a secondary actions menu");
  assert.doesNotMatch(disclosure[0].split(">")[0], /\bopen(?:=|\s|$)/);
  assert.match(disclosure[1], /<summary\b[^>]*aria-label="More actions for/);
  assert.match(disclosure[1], /class="work-task-delete"/);
  assert.equal((html.match(/class="work-task-delete"/g) || []).length, 1);
  assert.doesNotMatch(html.replace(disclosure[0], ""), /work-task-delete/);
});

test("recurring completion copy and linked-record access remain explicit", () => {
  const html = render({ task: task({ recurrence: "Weekly" }), relatedLabel: "Release project", onOpenRelated: noop });
  assert.match(openingTag(html, "button", "work-task-complete"), /Complete and reschedule/);
  assert.match(html, /Repeats: Weekly/);
  assert.match(openingTag(html, "button", "work-task-related"), /type="button"/);
  assert.match(html, /Linked: Release project/);
});
