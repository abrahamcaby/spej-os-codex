import assert from "node:assert/strict";
import test from "node:test";
import { createPlanningWorkspace, saveOperatingPlan, type PlanningWorkspace } from "../lib/operating-plans";
import { canCompletePlannedTask, validatePlanningWrite } from "../lib/planning-updates";
import type { TaskItem } from "../lib/types";

const block = (id = "focus"): PlanningWorkspace["days"][string][number] => ({
  id, title: "Focus", start: "09:00", end: "09:30", source: "manual",
});
const task = (patch: Partial<TaskItem> = {}): TaskItem => ({
  id: "task", title: "Work", description: "", due: "2026-09-17", recurrence: "One-time",
  priority: "Normal", done: false, ...patch,
});
const date = (offset: number) => new Date(Date.UTC(2026, 0, 1 + offset)).toISOString().slice(0, 10);

test("valid writes preserve plan history and return independent data without mutation", () => {
  const original = saveOperatingPlan(createPlanningWorkspace(), { title: "Quality", outcome: "Reliable delivery", routines: [] }, "employee", "2026-09-17T12:00:00Z", "plan");
  const revised = saveOperatingPlan(original, { id: "plan", title: "Quality revised", outcome: "Reliable delivery", routines: [] }, "employee", "2026-09-17T13:00:00Z", "unused");
  revised.days["2026-09-17"] = [block()];
  const snapshot = structuredClone(revised);
  const result = validatePlanningWrite(revised);
  assert.deepEqual(result, snapshot);
  assert.deepEqual(revised, snapshot);
  result.plans[0].history[0].title = "Changed in returned copy";
  result.days["2026-09-17"][0].title = "Changed in returned copy";
  result.preferences.weekdays.push(0);
  assert.deepEqual(revised, snapshot);
});

test("empty dates are pruned before counting the 366-day capacity", () => {
  const workspace = createPlanningWorkspace();
  for (let i = 0; i < 400; i += 1) workspace.days[date(i)] = i < 366 ? [block()] : [];
  const result = validatePlanningWrite(workspace);
  assert.equal(Object.keys(result.days).length, 366);
  assert.equal(Object.keys(workspace.days).length, 400);
  assert.deepEqual(result.days[date(365)], [block()]);
});

test("a 367th populated day is rejected instead of silently discarded", () => {
  const workspace = createPlanningWorkspace();
  for (let i = 0; i < 367; i += 1) workspace.days[date(i)] = [block()];
  const snapshot = structuredClone(workspace);
  assert.throws(() => validatePlanningWrite(workspace), /366-day.*backup/);
  assert.deepEqual(workspace, snapshot);
});

test("100 time blocks are preserved and the 101st is rejected", () => {
  const workspace = createPlanningWorkspace();
  workspace.days["2026-09-17"] = Array.from({ length: 100 }, (_, i) => block(String(i)));
  assert.equal(validatePlanningWrite(workspace).days["2026-09-17"].length, 100);
  workspace.days["2026-09-17"].push(block("101"));
  assert.throws(() => validatePlanningWrite(workspace), /100-block.*nothing was discarded/);
  assert.equal(workspace.days["2026-09-17"].length, 101);
});

test("1,000 estimates are preserved and the 1,001st is rejected", () => {
  const workspace = createPlanningWorkspace();
  workspace.estimates = Object.fromEntries(Array.from({ length: 1_000 }, (_, i) => [`task-${i}`, 30]));
  assert.equal(Object.keys(validatePlanningWrite(workspace).estimates).length, 1_000);
  workspace.estimates.extra = 20;
  assert.throws(() => validatePlanningWrite(workspace), /1,000-estimate/);
  assert.equal(Object.keys(workspace.estimates).length, 1_001);
});

test("reserve must fit the chosen window and never silently resets to a default", () => {
  const workspace = createPlanningWorkspace();
  workspace.preferences = { start: "09:00", end: "11:00", reserveMinutes: 180, weekdays: [4] };
  assert.throws(() => validatePlanningWrite(workspace), /cannot exceed.*working window/);
  assert.equal(workspace.preferences.reserveMinutes, 180);
  workspace.preferences.reserveMinutes = 120;
  assert.equal(validatePlanningWrite(workspace).preferences.reserveMinutes, 120);
  workspace.preferences.reserveMinutes = 0;
  assert.equal(validatePlanningWrite(workspace).preferences.reserveMinutes, 0);
});

test("reserve accepts 480 within a long window and rejects invalid or larger values", () => {
  for (const reserveMinutes of [-1, 0.5, 481, NaN, Infinity]) {
    const workspace = createPlanningWorkspace();
    workspace.preferences = { start: "00:00", end: "23:59", reserveMinutes, weekdays: [1] };
    assert.throws(() => validatePlanningWrite(workspace), /0 to 480/);
  }
  const workspace = createPlanningWorkspace();
  workspace.preferences.reserveMinutes = 480;
  assert.equal(validatePlanningWrite(workspace).preferences.reserveMinutes, 480);
});

test("invalid preferences and unsupported versions fail with no normalization", () => {
  for (const [start, end] of [["9:00", "17:00"], ["09:00", "24:00"], ["17:00", "09:00"], ["09:00", "09:00"]]) {
    const workspace = createPlanningWorkspace();
    workspace.preferences.start = start;
    workspace.preferences.end = end;
    assert.throws(() => validatePlanningWrite(workspace), /Working hours/);
  }
  for (const weekdays of [[-1], [7], [1.5], [1, 1]]) {
    const workspace = createPlanningWorkspace();
    workspace.preferences.weekdays = weekdays;
    assert.throws(() => validatePlanningWrite(workspace), /unique weekday/);
  }
  const unsupported = { ...createPlanningWorkspace(), version: 2 } as unknown as PlanningWorkspace;
  assert.throws(() => validatePlanningWrite(unsupported), /unsupported format/);
});

test("malformed dates, blocks, links, and estimates cannot be silently lost on reload", () => {
  for (const key of ["2026-02-29", "2026-09-31", "2026-9-17", "0000-01-01"]) {
    const workspace = createPlanningWorkspace();
    workspace.days[key] = [block()];
    assert.throws(() => validatePlanningWrite(workspace), /valid YYYY-MM-DD/);
  }
  const invalidBlocks = [
    { ...block(), end: "08:00" }, { ...block(), title: " " }, { ...block(), id: "bad id" },
    { ...block(), source: "task" as const }, { ...block(), source: "routine" as const, sourceId: "bad id" },
  ];
  for (const item of invalidBlocks) {
    const workspace = createPlanningWorkspace();
    workspace.days["2026-09-17"] = [item];
    assert.throws(() => validatePlanningWrite(workspace));
  }
  const workspace = createPlanningWorkspace();
  workspace.days["2026-09-17"] = [block(), block()];
  assert.throws(() => validatePlanningWrite(workspace), /own valid ID/);
  delete workspace.days["2026-09-17"];
  workspace.estimates.task = 0;
  assert.throws(() => validatePlanningWrite(workspace), /1–480 whole minutes/);
});

test("overlapping historical blocks are preserved for the planner to flag, not removed", () => {
  const workspace = createPlanningWorkspace();
  workspace.days["2026-09-17"] = [block("a"), block("b")];
  assert.deepEqual(validatePlanningWrite(workspace).days, workspace.days);
});

test("completion eligibility permits only unfinished one-time tasks", () => {
  assert.equal(canCompletePlannedTask(task(), []), true);
  assert.equal(canCompletePlannedTask(task({ done: true }), []), false);
  for (const recurrence of ["Daily", "Weekly", "Monthly", "", "Custom", "one-time"]) {
    assert.equal(canCompletePlannedTask(task({ recurrence }), []), false, recurrence);
  }
});

test("parents with unfinished children cannot be completed from a planned block", () => {
  const parent = task({ id: 42 });
  assert.equal(canCompletePlannedTask(parent, [parent, task({ id: "child", parentId: "42" })]), false);
  assert.equal(canCompletePlannedTask(parent, [parent, task({ id: "child", parentId: 42, done: true })]), true);
  assert.equal(canCompletePlannedTask(parent, [parent, task({ id: "other-child", parentId: "other-parent" })]), true);
  assert.equal(canCompletePlannedTask(task({ id: "undefined" }), [task({ id: "unrelated" })]), true);
});
