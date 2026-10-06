import assert from "node:assert/strict";
import test from "node:test";
import { buildPlanningCandidates, DEFAULT_TASK_ESTIMATE_MINUTES, getTaskPlanningMinutes, getOpenParentTaskIds } from "../lib/planning-candidates";
import { proposeWorkday } from "../lib/work-planner";
import { createPlanningWorkspace, type OperatingPlan } from "../lib/operating-plans";
import { validatePlanningWrite } from "../lib/planning-updates";
import type { TaskItem } from "../lib/types";

const TODAY = "2026-09-17"; // Thursday
const TOMORROW = "2026-09-18";
const task = (id: TaskItem["id"], patch: Partial<TaskItem> = {}): TaskItem => ({
  id, title: `Work ${id}`, description: "", due: "", recurrence: "One-time",
  priority: "Normal", done: false, ...patch,
});
const plan = (id: string, patch: Partial<OperatingPlan> = {}): OperatingPlan => ({
  id, ownerId: "employee-42", title: "An adjustable operating plan", outcome: "A reviewed outcome",
  status: "active", revision: 1, updatedAt: "2026-09-17T12:00:00.000Z", history: [],
  routines: [{ id: "review", title: "Review commitments", minutes: 45, priority: "normal", weekdays: [4] }],
  ...patch,
});

test("candidate conversion works across departments without role-specific targets", () => {
  const candidates = buildPlanningCandidates([
    task("engineering", { category: "Project Work" }),
    task("sales", { category: "Sales" }),
    task("operations", { category: "Operations" }),
  ], [], TODAY, TODAY, {});
  assert.equal(candidates.length, 3);
  assert.ok(candidates.every((item) => item.minutes === DEFAULT_TASK_ESTIMATE_MINUTES));
  assert.deepEqual(candidates.map((item) => item.sourceId), ["engineering", "sales", "operations"]);
});

test("explicit task estimates override the default and invalid values do not", () => {
  const candidates = buildPlanningCandidates([task(3), task("long"), task("zero"), task("fractional"), task("huge")], [], TODAY, TODAY, {
    "3": 15, long: 480, zero: 0, fractional: 1.5, huge: 481,
  });
  assert.deepEqual(candidates.map((item) => item.minutes), [15, 480, 25, 25, 25]);
  assert.equal(candidates[0].id, "task:3");
  assert.equal(getTaskPlanningMinutes({ id: 3 }, { "3": 15 }), candidates[0].minutes);
  assert.equal(getTaskPlanningMinutes({ id: "constructor" }, {}), DEFAULT_TASK_ESTIMATE_MINUTES);
});

test("completed tasks are excluded and waiting or blocked work is explained by the engine", () => {
  const candidates = buildPlanningCandidates([
    task("done", { done: true }), task("ready"),
    task("blocked", { status: "Blocked" }), task("waiting", { status: "Waiting" }),
    task("review", { status: "In Review" }),
  ], [], TODAY, TODAY, {});
  assert.deepEqual(candidates.map((item) => item.sourceId), ["ready", "blocked", "waiting", "review"]);
  assert.deepEqual(candidates.filter((item) => item.blocked).map((item) => item.sourceId), ["blocked", "waiting"]);
  const result = proposeWorkday(TODAY, { start: "09:00", end: "17:00", reserveMinutes: 60, weekdays: [4] }, [], candidates);
  assert.deepEqual(result.suggested.map((item) => item.sourceId), ["ready", "review"]);
  assert.equal(result.unscheduled.length, 2);
  assert.ok(result.unscheduled.every((item) => /Blocked/.test(item.reason)));
});

test("open direct children suppress parent effort, including nested hierarchies", () => {
  const candidates = buildPlanningCandidates([
    task("parent"), task("child", { parentId: "parent" }),
    task("grandchild", { parentId: "child" }),
    task("other-parent"), task("finished-child", { parentId: "other-parent", done: true }),
    task("blocked-parent"), task("blocked-child", { parentId: "blocked-parent", status: "Blocked" }),
  ], [], TODAY, TODAY, {});
  assert.deepEqual(candidates.map((item) => item.sourceId), ["grandchild", "other-parent", "blocked-child"]);
});

test("parent eligibility includes other assignees without returning their task details", () => {
  const records = [task("parent", { ownerProfileId: "aby" }), task("private-child", { parentId: "parent", ownerProfileId: "sean", title: "Private engineering details" }), task("done", { parentId: "finished-parent", done: true }), task("zero", { parentId: 0 }), task("self", { parentId: "self" })];
  const before = structuredClone(records);
  assert.deepEqual(getOpenParentTaskIds(records), ["parent", "0"]);
  assert.deepEqual(records, before);
});

test("Today means actual today even when planning a future date", () => {
  const candidates = buildPlanningCandidates([
    task("today", { due: "Today" }), task("fixed", { due: "2026-09-25" }),
    task("unknown", { due: "Unknown" }), task("tbd", { due: " TBD " }), task("blank"),
  ], [], TOMORROW, TODAY, {});
  assert.equal(candidates[0].due, TODAY);
  assert.equal(candidates[1].due, "2026-09-25");
  assert.ok(candidates.slice(2).every((item) => item.due === undefined));
});

test("malformed actual deadlines remain visible for downstream validation", () => {
  const candidates = buildPlanningCandidates([task("bad", { due: "2026-02-30" }), task("unparsed", { due: "sometime next week" })], [], TODAY, TODAY, {});
  const result = proposeWorkday(TODAY, { start: "09:00", end: "17:00", reserveMinutes: 60, weekdays: [4] }, [], candidates);
  assert.equal(result.suggested.length, 0);
  assert.equal(result.unscheduled.length, 2);
  assert.ok(result.unscheduled.every((item) => /Due date/.test(item.reason)));
});

test("only active routines for the selected weekday become candidates", () => {
  const plans = [plan("active"), plan("draft", { status: "draft" }), plan("archived", { status: "archived" })];
  assert.deepEqual(buildPlanningCandidates([], plans, TODAY, TODAY, {}).map((item) => item.sourceId), ["active:review"]);
  assert.deepEqual(buildPlanningCandidates([], plans, TOMORROW, TODAY, {}), []);
  assert.deepEqual(buildPlanningCandidates([], plans, "2026-02-30", TODAY, {}), []);
});

test("matching routine IDs remain scoped to their plans and separate from tasks", () => {
  const candidates = buildPlanningCandidates([task("a:review")], [plan("a"), plan("b")], TODAY, TODAY, {});
  assert.deepEqual(candidates.map((item) => [item.id, item.source, item.sourceId]), [
    ["task:a:review", "task", "a:review"],
    ["routine:a:review", "routine", "a:review"],
    ["routine:b:review", "routine", "b:review"],
  ]);
});

test("unknown task priority uses normal while supported values keep their meaning", () => {
  const candidates = buildPlanningCandidates([
    task("urgent", { priority: "Urgent" }), task("high", { priority: "High" }),
    task("low", { priority: "Low" }), task("unknown", { priority: "Unexpected" as TaskItem["priority"] }),
  ], [], TODAY, TODAY, {});
  assert.deepEqual(candidates.map((item) => item.priority), ["urgent", "high", "low", "normal"]);
});

test("conversion never mutates tasks, operating plans or estimates", () => {
  const values = { tasks: [task("item", { due: "Today" })], plans: [plan("plan")], estimates: { item: 40 } };
  const before = structuredClone(values);
  const result = buildPlanningCandidates(values.tasks, values.plans, TODAY, TODAY, values.estimates);
  result[0].title = "Changed proposal";
  assert.deepEqual(values, before);
});

test("long task snapshot labels can be proposed and accepted without changing canonical tasks", () => {
  const tasks = [
    task("long", { title: "x".repeat(201) }),
    task("emoji-split-boundary", { title: `${"x".repeat(198)}😀 more detail` }),
    task("emoji-whole-boundary", { title: `${"x".repeat(197)}😀 more detail` }),
    task("controls", { title: " \u0000Review\u0007 release\u007f \n" }),
  ];
  const original = structuredClone(tasks);
  const workspace = createPlanningWorkspace();
  const candidates = buildPlanningCandidates(tasks, [], TODAY, TODAY, {});
  assert.equal(candidates[0].title, `${"x".repeat(199)}…`);
  assert.equal(candidates[1].title, `${"x".repeat(198)}…`);
  assert.equal(candidates[2].title, `${"x".repeat(197)}😀…`);
  assert.equal(candidates[3].title, "Review release");
  assert.ok(candidates.every((candidate) => candidate.title.length <= 200));

  const proposal = proposeWorkday(TODAY, workspace.preferences, [], candidates);
  assert.equal(proposal.suggested.length, tasks.length);
  assert.deepEqual(proposal.unscheduled, []);
  const accepted = validatePlanningWrite({ ...workspace, days: { [TODAY]: proposal.suggested } });
  assert.equal(accepted.days[TODAY].length, tasks.length);
  assert.deepEqual(accepted.days[TODAY].map((block) => block.title), candidates.map((candidate) => candidate.title));
  assert.deepEqual(tasks, original);
});
