import assert from "node:assert/strict";
import test from "node:test";
import {
  createPlanningWorkspace,
  normalizePlanningWorkspace,
  saveOperatingPlan,
  setOperatingPlanStatus,
  type Routine,
} from "../lib/operating-plans";

const OWNER = "employee-42";
const NOW = "2026-09-17T14:00:00.000Z";
const LATER = "2026-09-18T14:00:00.000Z";
const routine = (overrides: Partial<Routine> = {}): Routine => ({
  id: "review", title: "Review project commitments", minutes: 30,
  weekdays: [1, 3, 5], priority: "normal", ...overrides,
});
const input = () => ({ title: "Delivery quality", outcome: "Close commitments with evidence", routines: [routine()] });
function saved() {
  return saveOperatingPlan(createPlanningWorkspace(), input(), OWNER, NOW, "plan-1");
}

test("neutral defaults are editable and each workspace gets its own arrays", () => {
  const first = createPlanningWorkspace();
  const second = createPlanningWorkspace();
  assert.deepEqual(first, { version: 1, plans: [], preferences: { start: "09:00", end: "17:00", reserveMinutes: 60, weekdays: [1, 2, 3, 4, 5] }, estimates: {}, days: {} });
  first.preferences.weekdays.push(0);
  first.plans.push(saved().plans[0]);
  assert.equal(second.preferences.weekdays.length, 5);
  assert.equal(second.plans.length, 0);
});

test("arbitrary stable owner IDs work without a hardcoded team or business plan", () => {
  const workspace = saved();
  assert.equal(workspace.plans[0].ownerId, OWNER);
  assert.equal(workspace.plans[0].status, "draft");
  assert.equal(workspace.plans[0].revision, 1);
  assert.deepEqual(normalizePlanningWorkspace(workspace, "another-employee").plans, []);
  assert.deepEqual(normalizePlanningWorkspace(workspace, ""), createPlanningWorkspace());
});

test("bad input, unknown versions, and malformed owners fail closed", () => {
  for (const raw of [null, [], false, "plan", { version: 2, plans: saved().plans }, { plans: saved().plans }]) {
    assert.deepEqual(normalizePlanningWorkspace(raw, OWNER), createPlanningWorkspace());
  }
  assert.deepEqual(normalizePlanningWorkspace(saved(), "__proto__"), createPlanningWorkspace());
  const mixed = { ...saved(), plans: [...saved().plans, { ...saved().plans[0], id: "other", ownerId: "another-employee" }] };
  assert.equal(normalizePlanningWorkspace(mixed, OWNER).plans.length, 1);
});

test("edits retain immutable prior content with stable routine IDs", () => {
  const original = saved();
  const snapshot = structuredClone(original);
  const next = saveOperatingPlan(original, { ...input(), id: "plan-1", title: "Review service quality", routines: [routine({ minutes: 45 })] }, OWNER, LATER, "unused");
  assert.deepEqual(original, snapshot);
  assert.equal(next.plans[0].revision, 2);
  assert.equal(next.plans[0].routines[0].id, "review");
  assert.equal(next.plans[0].history[0].routines[0].minutes, 30);
  assert.equal(next.plans[0].history[0].recordedAt, NOW);
  next.plans[0].history[0].routines[0].weekdays.push(0);
  assert.deepEqual(original.plans[0].routines[0].weekdays, [1, 3, 5]);
});

test("active edits create a content revision and retain active status", () => {
  const active = setOperatingPlanStatus(saved(), "plan-1", "active", OWNER, LATER);
  assert.equal(active.plans[0].revision, 1);
  const edited = saveOperatingPlan(active, { ...input(), id: "plan-1", outcome: "A revised, reviewed objective" }, OWNER, LATER, "unused");
  assert.equal(edited.plans[0].status, "active");
  assert.equal(edited.plans[0].revision, 2);
  assert.equal(edited.plans[0].history.length, 1);
  assert.equal(setOperatingPlanStatus(edited, "plan-1", "draft", OWNER, LATER).plans[0].status, "draft");
  assert.equal(setOperatingPlanStatus(edited, "plan-1", "archived", OWNER, LATER).plans[0].status, "archived");
});

test("no-op saves and status changes do not invent revisions or timestamps", () => {
  const original = saved();
  const next = saveOperatingPlan(original, { ...input(), id: "plan-1" }, OWNER, LATER, "unused");
  assert.deepEqual(next, original);
  assert.deepEqual(setOperatingPlanStatus(original, "plan-1", "draft", OWNER, LATER), original);
});

test("saving never creates tasks, sends, or schedule blocks", () => {
  const result = setOperatingPlanStatus(saved(), "plan-1", "active", OWNER, NOW);
  assert.deepEqual(result.days, {});
  assert.deepEqual(result.estimates, {});
  assert.equal(result.plans.length, 1);
});

test("invalid form values produce readable errors instead of silently losing work", () => {
  const workspace = createPlanningWorkspace();
  const save = (changes: Partial<ReturnType<typeof input>>) => saveOperatingPlan(workspace, { ...input(), ...changes }, OWNER, NOW, "id");
  assert.throws(() => save({ title: " " }), /title/i);
  assert.throws(() => save({ outcome: "" }), /outcome/i);
  assert.throws(() => save({ routines: [routine({ minutes: 0 })] }), /whole minutes/i);
  assert.throws(() => save({ routines: [routine({ minutes: 1.5 })] }), /whole minutes/i);
  assert.throws(() => save({ routines: [routine({ weekdays: [] })] }), /weekday/i);
  assert.throws(() => save({ routines: [routine(), routine()] }), /unique ID/i);
  assert.throws(() => save({ routines: Array.from({ length: 51 }, (_, n) => routine({ id: `routine-${n}` })) }), /50 routines/i);
  assert.throws(() => saveOperatingPlan(workspace, input(), "", NOW, "id"), /owner/i);
  assert.throws(() => saveOperatingPlan(workspace, input(), OWNER, "2026-02-30T12:00:00Z", "id"), /timestamp/i);
});

test("edits cannot cross owners, silently recreate missing plans, or overwrite IDs", () => {
  const existing = saved();
  assert.throws(() => saveOperatingPlan(existing, { ...input(), id: "plan-1" }, "other", NOW, "unused"), /another workspace owner/i);
  assert.throws(() => setOperatingPlanStatus(existing, "plan-1", "active", "other", NOW), /another workspace owner/i);
  assert.throws(() => saveOperatingPlan(existing, { ...input(), id: "missing" }, OWNER, NOW, "unused"), /no longer exists/i);
  assert.throws(() => saveOperatingPlan(existing, input(), OWNER, NOW, "plan-1"), /already uses/i);
  assert.throws(() => setOperatingPlanStatus(existing, "missing", "draft", OWNER, NOW), /no longer exists/i);
});

test("normalizer bounds records, removes duplicates and bad routine values", () => {
  const plan = saved().plans[0];
  const result = normalizePlanningWorkspace({
    ...saved(),
    plans: [
      { ...plan, routines: [routine(), routine(), routine({ id: "bad", minutes: Number.NaN }), routine({ id: "valid", weekdays: [5, 1, 1] })] },
      plan,
      { ...plan, id: "invalid-date", updatedAt: "2026-02-30T12:00:00Z" },
      { ...plan, id: "oversize", title: "x".repeat(201) },
    ],
  }, OWNER);
  assert.equal(result.plans.length, 1);
  assert.equal(result.plans[0].routines.length, 2);
  assert.deepEqual(result.plans[0].routines[1].weekdays, [1, 5]);
  const many = normalizePlanningWorkspace({ ...saved(), plans: Array.from({ length: 70 }, (_, i) => ({ ...plan, id: `p-${i}`, routines: Array.from({ length: 75 }, (_, n) => routine({ id: `r-${n}` })) })) }, OWNER);
  assert.equal(many.plans.length, 50);
  assert.equal(many.plans[0].routines.length, 50);
  assert.throws(() => saveOperatingPlan(many, input(), OWNER, NOW, "one-too-many"), /50-plan limit/i);
});

test("preferences and estimates reject invalid windows and unsafe keys", () => {
  const normalized = normalizePlanningWorkspace({
    ...saved(), preferences: { start: "23:00", end: "01:00", reserveMinutes: -30, weekdays: [7] },
    estimates: JSON.parse('{"task-1":45,"task-2":0,"task-3":481,"task-4":1.5,"__proto__":5,"constructor":5}'),
  }, OWNER);
  assert.deepEqual(normalized.preferences, createPlanningWorkspace().preferences);
  assert.deepEqual(normalized.estimates, { "task-1": 45 });
  const custom = normalizePlanningWorkspace({ ...saved(), preferences: { start: "12:00", end: "12:30", reserveMinutes: 70, weekdays: [] } }, OWNER);
  assert.deepEqual(custom.preferences, { start: "12:00", end: "12:30", reserveMinutes: 30, weekdays: [] });
});

test("accepted day blocks survive future plan edits and archive without duplicate IDs", () => {
  const workspace = saved();
  const accepted = { id: "routine:plan-1:review", title: "Review project commitments", start: "10:00", end: "10:30", source: "routine" as const, sourceId: "plan-1:review" };
  workspace.days["2026-09-17"] = [accepted, accepted];
  const edited = saveOperatingPlan(workspace, { ...input(), id: "plan-1", routines: [] }, OWNER, LATER, "unused");
  const archived = setOperatingPlanStatus(edited, "plan-1", "archived", OWNER, LATER);
  assert.deepEqual(archived.days["2026-09-17"], [accepted]);
});

test("day imports reject invalid dates, times, missing sources and oversized entries", () => {
  const valid = { id: "block", title: "Focus work", start: "09:00", end: "10:00", source: "manual" };
  const normalized = normalizePlanningWorkspace({ ...saved(), days: {
    "2026-02-30": [valid],
    "not-a-date": [valid],
    "2026-09-17": [valid, { ...valid, id: "reversed", start: "11:00" }, { ...valid, id: "bad-time", end: "25:00" }, { ...valid, id: "missing-source", source: "task" }, { ...valid, id: "long", title: "x".repeat(201) }],
  } }, OWNER);
  assert.deepEqual(normalized.days, { "2026-09-17": [valid] });
});

test("revision history accepts only unique prior valid versions and remains bounded", () => {
  const plan = saved().plans[0];
  const old = { revision: 1, title: plan.title, outcome: plan.outcome, routines: plan.routines, recordedAt: NOW };
  const workspace = normalizePlanningWorkspace({ ...saved(), plans: [{ ...plan, revision: 3, history: [old, old, { ...old, revision: 3 }, { ...old, revision: 2 }] }] }, OWNER);
  assert.deepEqual(workspace.plans[0].history.map((h) => h.revision), [1, 2]);
  const many = normalizePlanningWorkspace({ ...saved(), plans: [{ ...plan, revision: 201, history: Array.from({ length: 200 }, (_, i) => ({ ...old, revision: i + 1 })) }] }, OWNER);
  assert.equal(many.plans[0].history.length, 100);
  assert.equal(many.plans[0].history[0].revision, 101);
});

test("malformed discriminator objects are ignored without invoking string coercion", () => {
  const malformed = { toString: "not a function", valueOf: "not a function" };
  const workspace = saved();
  const result = normalizePlanningWorkspace({ ...workspace, plans: [
    { ...workspace.plans[0], id: "invalid-status", status: malformed },
    { ...workspace.plans[0], routines: [{ ...routine(), priority: malformed }] },
  ], days: { "2026-09-17": [{ id: "invalid-source", title: "Focus", start: "09:00", end: "10:00", source: malformed }] } }, OWNER);
  assert.equal(result.plans.length, 1);
  assert.deepEqual(result.plans[0].routines, []);
  assert.deepEqual(result.days["2026-09-17"], []);
});

test("calendar blocks, day records and task estimates have storage bounds", () => {
  const blocks = Array.from({ length: 130 }, (_, i) => ({ id: `block-${i}`, title: "Focus", start: "09:00", end: "09:15", source: "manual" }));
  const days = Object.fromEntries(Array.from({ length: 400 }, (_, i) => {
    const day = new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10);
    return [day, blocks];
  }));
  const estimates = Object.fromEntries(Array.from({ length: 1_500 }, (_, i) => [`task-${i}`, 30]));
  const result = normalizePlanningWorkspace({ ...saved(), days, estimates }, OWNER);
  assert.equal(Object.keys(result.days).length, 366);
  assert.equal(Object.values(result.days)[0].length, 100);
  assert.equal(Object.keys(result.estimates).length, 1_000);
});
