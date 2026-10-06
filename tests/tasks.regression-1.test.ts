import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanTaskItems,
  completeTaskItems,
  hasOpenSubtasks,
  inheritedTaskRelationship,
  nextRecurringDue,
  normalizeTaskHierarchy,
  preserveRecurringCompletionHistory,
  removeTaskAndDetachChildren,
  sortTaskItems,
  taskBelongsToWorkspace,
} from "../lib/tasks";
import type { ProjectItem, TaskItem } from "../lib/types";

// Regression: ISSUE-005 — recurring completions disappeared when the series rolled forward
// Found by /qa on 2026-08-25
// Report: .gstack/qa-reports/qa-report-127-0-0-1-2026-08-25.md

const recurring: TaskItem = {
  id: "series-1",
  title: "Publish weekly briefing",
  description: "Ship the niche update.",
  due: "2026-08-25",
  recurrence: "Weekly",
  priority: "Normal",
  done: false,
  createdAt: "2026-08-20T18:00:00.000Z",
};

test("completing a recurring task advances the series and records its occurrence", () => {
  const now = new Date(2026, 7, 25, 12);
  const result = completeTaskItems([recurring], recurring.id, {
    now,
    occurrenceId: "occurrence-1",
  });
  const active = result.find((task) => task.id === recurring.id);
  const occurrence = result.find((task) => task.id === "occurrence-1");

  assert.equal(result.length, 2);
  assert.equal(active?.done, false);
  assert.equal(active?.due, "2026-09-01");
  assert.equal(occurrence?.done, true);
  assert.equal(occurrence?.due, "2026-08-25");
  assert.equal(occurrence?.seriesId, recurring.id);
  assert.equal(occurrence?.completedAt, now.toISOString());
});

test("repeated recurring completions retain every dated occurrence", () => {
  const first = completeTaskItems([recurring], recurring.id, {
    now: new Date(2026, 7, 25, 12),
    occurrenceId: "occurrence-1",
  });
  const second = completeTaskItems(first, recurring.id, {
    now: new Date(2026, 8, 1, 12),
    occurrenceId: "occurrence-2",
  });

  assert.equal(second.filter((task) => !task.done).length, 1);
  assert.equal(second.filter((task) => task.done).length, 2);
  assert.equal(
    second.find((task) => task.id === recurring.id)?.due,
    "2026-09-08",
  );
});

test("a stale double-click cannot complete and advance the same occurrence twice", () => {
  const now = new Date(2026, 7, 25, 12);
  const first = completeTaskItems([recurring], recurring.id, {
    now,
    occurrenceId: "occurrence-1",
    expectedDue: "2026-08-25",
  });
  const second = completeTaskItems(first, recurring.id, {
    now,
    occurrenceId: "occurrence-2",
    expectedDue: "2026-08-25",
  });

  assert.deepEqual(second, first);
  assert.equal(second.filter((task) => task.done).length, 1);
  assert.equal(second.find((task) => task.id === recurring.id)?.due, "2026-09-01");
});

test("a re-rendered double-click cannot complete the newly advanced occurrence", () => {
  const firstTime = new Date(2026, 7, 25, 12);
  const first = completeTaskItems([recurring], recurring.id, {
    now: firstTime,
    occurrenceId: "occurrence-1",
    expectedDue: "2026-08-25",
  });
  const activeDue = first.find((task) => task.id === recurring.id)?.due;
  const second = completeTaskItems(first, recurring.id, {
    now: new Date(firstTime.getTime() + 100),
    occurrenceId: "occurrence-2",
    expectedDue: activeDue,
  });

  assert.deepEqual(second, first);
  assert.equal(second.filter((task) => task.done).length, 1);
  assert.equal(activeDue, "2026-09-01");
});

test("one-time completions keep their original row and completion time", () => {
  const oneTime = { ...recurring, id: "one", recurrence: "One-time" };
  const now = new Date(2026, 7, 25, 15);
  const result = completeTaskItems([oneTime], oneTime.id, { now });

  assert.equal(result.length, 1);
  assert.equal(result[0].done, true);
  assert.equal(result[0].completedAt, now.toISOString());
  assert.equal(result[0].seriesId, undefined);
});

test("overdue recurrences advance to the first date after completion day", () => {
  assert.equal(
    nextRecurringDue("2026-08-20", "Daily", new Date(2026, 7, 25, 12)),
    "2026-08-26",
  );
});

test("monthly recurrences retain their anchor day after a short month", () => {
  const monthly = {
    ...recurring,
    id: "monthly-series",
    due: "2027-01-31",
    recurrence: "Monthly",
  };
  const february = completeTaskItems([monthly], monthly.id, {
    now: new Date(2027, 0, 31, 12),
    occurrenceId: "january-occurrence",
  });
  const march = completeTaskItems(february, monthly.id, {
    now: new Date(2027, 1, 28, 12),
    occurrenceId: "february-occurrence",
  });

  assert.equal(
    february.find((task) => task.id === monthly.id)?.due,
    "2027-02-28",
  );
  assert.equal(
    march.find((task) => task.id === monthly.id)?.due,
    "2027-03-31",
  );
});

test("workspace cleaning preserves completion history metadata", () => {
  const [cleaned] = cleanTaskItems([{
    ...recurring,
    id: "occurrence-1",
    done: true,
    completedAt: "2026-08-25T19:00:00.000Z",
    seriesId: recurring.id,
  }]);

  assert.equal(cleaned.completedAt, "2026-08-25T19:00:00.000Z");
  assert.equal(cleaned.seriesId, recurring.id);
});

test("recurring completion history survives omission or mutation", () => {
  const occurrence = {
    ...recurring,
    id: "occurrence-1",
    done: true,
    completedAt: "2026-08-25T19:00:00.000Z",
    seriesId: recurring.id,
  };
  assert.deepEqual(
    preserveRecurringCompletionHistory([occurrence], []),
    [occurrence],
  );
  assert.deepEqual(
    preserveRecurringCompletionHistory(
      [occurrence],
      [{ ...occurrence, title: "Changed", completedAt: "2026-08-26T00:00:00.000Z" }],
    ),
    [occurrence],
  );
  const oneTime = { ...occurrence, id: "one-time", seriesId: undefined };
  assert.deepEqual(preserveRecurringCompletionHistory([oneTime], []), []);
});

test("task cleaning preserves one-level hierarchy and governed priority", () => {
  const [parent, child, fallback] = cleanTaskItems([
    { ...recurring, id: "parent", title: "Launch campaign", priority: "Urgent" },
    { ...recurring, id: "child", title: "Approve copy", parentId: "parent", priority: "High" },
    { ...recurring, id: "fallback", title: "Legacy task", priority: "Whatever" },
  ]);
  assert.equal(child.parentId, parent.id);
  assert.equal(parent.priority, "Urgent");
  assert.equal(fallback.priority, "Normal");
});

test("task cleaning governs owner, work status, effort, and campaign links", () => {
  const [task, fallback] = cleanTaskItems([
    { ...recurring, id: "owned", owner: "Ken", status: "In Review", effort: "Medium", relatedType: "campaign", relatedId: "campaign-1" },
    { ...recurring, id: "fallback-work", owner: "", status: "Invented", effort: "Huge" },
  ]);
  assert.equal(task.owner, "Ken");
  assert.equal(task.status, "In Review");
  assert.equal(task.effort, "Medium");
  assert.equal(task.relatedType, "campaign");
  assert.equal(fallback.owner, "Unassigned");
  assert.equal(fallback.status, "Not Started");
  assert.equal(fallback.effort, "Small");
});

test("task sorting supports deadline and priority without mutating the source", () => {
  const tasks = cleanTaskItems([
    { ...recurring, id: "later", title: "Later", due: "2026-09-10", priority: "Low" },
    { ...recurring, id: "urgent", title: "Urgent", due: "2026-09-05", priority: "Urgent" },
    { ...recurring, id: "soon", title: "Soon", due: "2026-09-01", priority: "Normal" },
  ]);
  assert.deepEqual(sortTaskItems(tasks, "due-asc").map((task) => task.id), ["soon", "urgent", "later"]);
  assert.deepEqual(sortTaskItems(tasks, "priority-desc").map((task) => task.id), ["urgent", "soon", "later"]);
  assert.deepEqual(tasks.map((task) => task.id), ["later", "urgent", "soon"]);
});

test("missing project links fall back to their governed task category", () => {
  const staleGtmTask = { ...recurring, relatedType: "project" as const, relatedId: "missing", category: "Sales" as const };
  const staleDeliveryTask = { ...recurring, relatedType: "project" as const, relatedId: "missing", category: "Project Work" as const };

  assert.equal(taskBelongsToWorkspace(staleGtmTask, [], "gtm"), true);
  assert.equal(taskBelongsToWorkspace(staleGtmTask, [], "delivery"), false);
  assert.equal(taskBelongsToWorkspace(staleDeliveryTask, [], "gtm"), false);
  assert.equal(taskBelongsToWorkspace(staleDeliveryTask, [], "delivery"), true);
});

test("project links route work by the linked project's work area", () => {
  const projects = [
    { id: "gtm-project", workArea: "GTM" },
    { id: "delivery-project", workArea: "Product" },
  ] as ProjectItem[];
  const gtmTask: TaskItem = { ...recurring, id: "gtm-task", relatedType: "project", relatedId: "gtm-project", category: "Project Work" };
  const deliveryTask: TaskItem = { ...recurring, id: "delivery-task", relatedType: "project", relatedId: "delivery-project", category: "Marketing" };
  assert.equal(taskBelongsToWorkspace(gtmTask, projects, "gtm"), true);
  assert.equal(taskBelongsToWorkspace(gtmTask, projects, "delivery"), false);
  assert.equal(taskBelongsToWorkspace(deliveryTask, projects, "delivery"), true);
  assert.equal(taskBelongsToWorkspace(deliveryTask, projects, "gtm"), false);
});

test("subtasks inherit their parent's linked business record", () => {
  assert.deepEqual(
    inheritedTaskRelationship({ relatedType: "opportunity", relatedId: "opp-1" }),
    { relatedType: "opportunity", relatedId: "opp-1" },
  );
  assert.deepEqual(
    inheritedTaskRelationship(
      { relatedType: "project", relatedId: "project-1" },
      { relatedType: "account", relatedId: "account-1" },
    ),
    { relatedType: "account", relatedId: "account-1" },
  );
});

test("removing a parent detaches rather than deletes its subtasks", () => {
  const tasks = cleanTaskItems([
    { ...recurring, id: "parent", title: "Launch campaign" },
    { ...recurring, id: "child", title: "Approve copy", parentId: "parent" },
  ]);
  assert.equal(hasOpenSubtasks(tasks, "parent"), true);
  const remaining = removeTaskAndDetachChildren(tasks, "parent");
  assert.deepEqual(remaining.map((task) => task.id), ["child"]);
  assert.equal(remaining[0].parentId, undefined);
});

test("hierarchy normalization flattens nested tasks and removes cycles or missing parents", () => {
  const tasks = cleanTaskItems([
    { ...recurring, id: "root", title: "Root" },
    { ...recurring, id: "child", title: "Child", parentId: "root" },
    { ...recurring, id: "nested", title: "Nested", parentId: "child" },
    { ...recurring, id: "missing", title: "Missing", parentId: "not-there" },
    { ...recurring, id: "cycle-a", title: "Cycle A", parentId: "cycle-b" },
    { ...recurring, id: "cycle-b", title: "Cycle B", parentId: "cycle-a" },
  ]);
  const normalized = normalizeTaskHierarchy(tasks);
  assert.equal(normalized.find((task) => task.id === "nested")?.parentId, "root");
  assert.equal(normalized.find((task) => task.id === "missing")?.parentId, undefined);
  assert.equal(normalized.find((task) => task.id === "cycle-a")?.parentId, undefined);
  assert.equal(normalized.find((task) => task.id === "cycle-b")?.parentId, undefined);
});
