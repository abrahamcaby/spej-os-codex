import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkTaskRow } from "../components/task-work-row";
import { buildDirectorAttention } from "../lib/director-dashboard";
import { cleanTaskItems, taskCategoryForDisplay } from "../lib/tasks";
import type { TaskCategory, TaskItem } from "../lib/types";

const noop = () => {};
const task = (): TaskItem => ({
  id: "legacy-focus-action", title: "Follow up with a focus contact", description: "Continue the conversation.",
  due: "2026-10-02", recurrence: "One-time", priority: "Normal", owner: "Sagar",
  category: "5-3-1", status: "Not Started", done: false,
});

test("legacy 5-3-1 tasks display within Sales without changing stored records", () => {
  const original = task();
  const before = structuredClone(original);
  assert.equal(taskCategoryForDisplay(original), "Sales");
  assert.equal(cleanTaskItems([original])[0].category, "5-3-1");
  assert.deepEqual(original, before);
});

test("other task categories and missing categories keep their usual display", () => {
  const categories: Exclude<TaskCategory, "5-3-1">[] = [
    "Sales", "Partnerships", "Marketing", "Content", "Project Work", "Client Delivery", "Operations", "General",
  ];
  for (const category of categories) assert.equal(taskCategoryForDisplay({ category }), category);
  assert.equal(taskCategoryForDisplay({}), "General");
});

test("My Work uses the Sales category and keeps the legacy task and destination", () => {
  const original = task();
  const before = structuredClone(original);
  const [item] = buildDirectorAttention({
    tasks: [original], contacts: [], opportunities: [], partnerships: [], projects: [], campaigns: [], content: [],
    now: new Date(2026, 9, 2, 12),
  });
  assert.equal(item.categoryLabel, "Sales");
  assert.match(item.detail, /Sales/);
  assert.doesNotMatch(item.detail, /5-3-1/);
  assert.equal(item.recordId, original.id);
  assert.equal(item.tab, "tasks");
  assert.deepEqual(original, before);
});

test("task row renders a Sales badge for legacy focus work", () => {
  const original = task();
  const html = renderToStaticMarkup(createElement(WorkTaskRow, {
    task: original, workspaceLabel: "GTM", visibilityLabel: "Owner only", dueLabel: "Today", dueToday: true,
    canEdit: true, canChangeOwner: true, owners: ["Sagar"], remainingChildren: 0,
    hasOpenChildren: false, totalChildren: 0, expanded: false,
    onComplete: noop, onEdit: noop, onDelete: noop,
    onOwnerChange: noop, onStatusChange: noop, onPriorityChange: noop,
  }));
  assert.match(html, /work-task-badge-category">Sales<\/span>/);
  assert.doesNotMatch(html, /work-task-badge-category">5-3-1<\/span>/);
  assert.equal(original.category, "5-3-1");
});
