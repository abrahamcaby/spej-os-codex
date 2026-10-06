import assert from "node:assert/strict";
import test from "node:test";
import { proposeWorkday, type WorkBlock, type WorkCandidate, type WorkdayPreferences } from "../lib/work-planner";

const weekday = "2026-09-17";
const preferences: WorkdayPreferences = { start: "09:00", end: "17:00", reserveMinutes: 60, weekdays: [1, 2, 3, 4, 5] };
const candidate = (id: string, patch: Partial<WorkCandidate> = {}): WorkCandidate => ({
  id, sourceId: id, source: "task", title: `Work ${id}`, minutes: 30, priority: "normal", ...patch,
});
const block = (id: string, start: string, end: string, patch: Partial<WorkBlock> = {}): WorkBlock => ({
  id, title: id, start, end, source: "manual", ...patch,
});

test("working hours, days, and reserve are configurable without a role-specific schedule", () => {
  const result = proposeWorkday(weekday, { start: "12:15", end: "15:45", reserveMinutes: 15, weekdays: [4] }, [], [candidate("a", { minutes: 100 })]);
  assert.equal(result.availableMinutes, 195);
  assert.equal(result.scheduledMinutes, 100);
  assert.equal(result.reservedMinutes, 15);
  assert.deepEqual(result.suggested.map(({ start, end }) => ({ start, end })), [{ start: "12:15", end: "13:55" }]);
});

test("existing overlapping commitments are unioned and clipped to the working window", () => {
  const result = proposeWorkday(weekday, preferences, [
    block("early", "08:00", "10:00"), block("meeting", "09:30", "11:00"),
    block("nested", "10:00", "10:30"), block("late", "16:00", "18:00"),
    block("outside", "06:00", "07:00"),
  ], [candidate("a", { minutes: 120 })]);
  assert.equal(result.availableMinutes, 240);
  assert.equal(result.scheduledMinutes, 120);
  assert.equal(result.suggested[0].start, "11:00");
  assert.equal(result.suggested[0].end, "13:00");
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /overlap/);
});

test("adjacent commitments do not report an overlap or leave a phantom gap", () => {
  const result = proposeWorkday(weekday, preferences, [block("a", "09:00", "10:00"), block("b", "10:00", "11:00")], [candidate("c")]);
  assert.equal(result.suggested[0].start, "11:00");
  assert.equal(result.warnings.length, 0);
});

test("priority, due date, and input order produce deterministic whole-block suggestions", () => {
  const result = proposeWorkday(weekday, preferences, [], [
    candidate("low", { priority: "low", due: "2020-01-01" }),
    candidate("later", { priority: "high", due: "2026-09-20" }),
    candidate("undated", { priority: "high" }),
    candidate("earlier", { priority: "high", due: "2026-09-18" }),
    candidate("tie", { priority: "high", due: "2026-09-18" }),
    candidate("urgent", { priority: "urgent" }),
  ]);
  assert.deepEqual(result.suggested.map((item) => item.sourceId), ["urgent", "earlier", "tie", "later", "undated", "low"]);
});

test("blocked and duplicate candidates never become new work blocks", () => {
  const result = proposeWorkday(weekday, preferences, [block("scheduled", "15:00", "15:30", { source: "task", sourceId: "existing" })], [
    candidate("waiting", { blocked: true }), candidate("existing-alias", { sourceId: "existing" }),
    candidate("a"), candidate("a", { sourceId: "other" }), candidate("b", { sourceId: "a" }),
    candidate("c", { source: "routine", sourceId: "a" }),
  ]);
  assert.deepEqual(result.suggested.map((item) => item.sourceId), ["a", "a"]);
  assert.equal(result.unscheduled.length, 4);
  assert.match(result.unscheduled[0].reason, /Blocked/);
  assert.match(result.unscheduled[1].reason, /Already scheduled/);
  assert.match(result.unscheduled[2].reason, /Duplicate/);
});

test("accepting and replaying suggestions does not schedule the same sources twice", () => {
  const items = [candidate("one"), candidate("two", { source: "routine" })];
  const first = proposeWorkday(weekday, preferences, [], items);
  const replay = proposeWorkday(weekday, preferences, first.suggested, items);
  assert.equal(replay.suggested.length, 0);
  assert.equal(replay.unscheduled.length, 2);
  assert.ok(replay.unscheduled.every((item) => /Already scheduled/.test(item.reason)));
});

test("a reserved capacity budget never manufactures a calendar event", () => {
  const result = proposeWorkday(weekday, { ...preferences, start: "09:00", end: "11:00", reserveMinutes: 45 }, [], [
    candidate("a", { minutes: 60 }), candidate("b", { minutes: 30 }), candidate("c", { minutes: 15 }),
  ]);
  assert.equal(result.availableMinutes, 75);
  assert.equal(result.scheduledMinutes, 75);
  assert.equal(result.reservedMinutes, 45);
  assert.deepEqual(result.suggested.map((item) => item.sourceId), ["a", "c"]);
  assert.equal(result.unscheduled[0].candidate.id, "b");
  assert.ok(result.suggested.every((item) => item.source === "task"));
});

test("tasks are not split to fill fragmented time, but smaller work can use a gap", () => {
  const result = proposeWorkday(weekday, { ...preferences, end: "12:00", reserveMinutes: 0 }, [
    block("a", "09:30", "10:00"), block("b", "10:30", "11:00"), block("c", "11:30", "12:00"),
  ], [candidate("large", { minutes: 60, priority: "urgent" }), candidate("small", { minutes: 30 })]);
  assert.equal(result.availableMinutes, 90);
  assert.deepEqual(result.suggested.map((item) => item.sourceId), ["small"]);
  assert.match(result.unscheduled[0].reason, /uninterrupted gap/);
});

test("non-working dates do not receive suggestions, but any weekday can be enabled", () => {
  assert.equal(proposeWorkday("2026-09-19", preferences, [], [candidate("a")]).suggested.length, 0);
  assert.equal(proposeWorkday("2026-09-19", { ...preferences, weekdays: [6] }, [], [candidate("a")]).suggested.length, 1);
  assert.equal(proposeWorkday(weekday, { ...preferences, weekdays: [] }, [], [candidate("a")]).availableMinutes, 0);
});

test("strict date validation includes leap years without rolling an invalid date forward", () => {
  for (const date of ["2026-02-29", "1900-02-29", "2026-04-31", "2026-13-01", "2026-00-10", "2026-09-00", "0000-01-01", "2026-9-17", "2026-09-17T00:00:00Z"]) {
    const result = proposeWorkday(date, preferences, [], [candidate("a")]);
    assert.equal(result.suggested.length, 0, date);
    assert.match(result.warnings[0], /valid date/, date);
  }
  assert.equal(proposeWorkday("2000-02-29", { ...preferences, weekdays: [2] }, [], [candidate("a")]).suggested.length, 1);
  assert.equal(proposeWorkday("2028-02-29", { ...preferences, weekdays: [2] }, [], [candidate("a")]).suggested.length, 1);
});

test("date-only weekday calculation is independent of the host timezone", () => {
  const previousTimezone = process.env.TZ;
  try {
    for (const timezone of ["Pacific/Honolulu", "America/New_York", "Pacific/Kiritimati", "UTC"]) {
      process.env.TZ = timezone;
      const result = proposeWorkday("2026-09-20", { ...preferences, weekdays: [0] }, [], [candidate("a")]);
      assert.equal(result.suggested.length, 1, timezone);
    }
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

test("invalid times and settings fail closed rather than inventing availability", () => {
  for (const patch of [
    { start: "9:00" }, { start: "09:60" }, { end: "24:00" }, { end: "08:00" }, { end: "09:00" },
    { start: " 09:00" }, { reserveMinutes: -1 }, { reserveMinutes: 0.5 }, { reserveMinutes: NaN },
    { weekdays: [7] }, { weekdays: [1.5] },
  ]) {
    const result = proposeWorkday(weekday, { ...preferences, ...patch }, [], [candidate("a")]);
    assert.equal(result.suggested.length, 0, JSON.stringify(patch));
    assert.equal(result.availableMinutes, 0);
    assert.ok(result.warnings.length);
  }
});

test("malformed existing commitments block planning instead of being silently ignored", () => {
  for (const [start, end] of [["09:00", "bad"], ["11:00", "10:00"], ["09:00", "09:00"], ["2026-09-17T09:00", "10:00"]]) {
    const result = proposeWorkday(weekday, preferences, [block("bad", start, end)], [candidate("a")]);
    assert.equal(result.suggested.length, 0);
    assert.match(result.warnings[0], /invalid times/);
    assert.match(result.unscheduled[0].reason, /Correct existing/);
  }
});

test("invalid durations, priorities, identities, and due dates are explained individually", () => {
  const items = [0, -1, 0.5, Infinity, NaN].map((minutes, index) => candidate(String(index), { minutes }));
  items.push(candidate("bad-due", { due: "2026-02-30" }));
  items.push(candidate("bad-priority", { priority: "critical" as WorkCandidate["priority"] }));
  items.push(candidate("bad-source", { source: "made-up" as WorkCandidate["source"] }));
  items.push(candidate("empty-source", { sourceId: " " }));
  items.push(candidate("good"));
  const result = proposeWorkday(weekday, preferences, [], items);
  assert.deepEqual(result.suggested.map((item) => item.sourceId), ["good"]);
  assert.equal(result.unscheduled.length, 9);
  assert.ok(result.unscheduled.every((item) => item.reason.length > 10));
});

test("a full day and an excessive reserve produce no negative capacities", () => {
  const full = proposeWorkday(weekday, preferences, [block("all", "08:00", "18:00")], [candidate("a")]);
  assert.equal(full.availableMinutes, 0);
  assert.equal(full.reservedMinutes, 0);
  assert.equal(full.suggested.length, 0);
  const reserved = proposeWorkday(weekday, { ...preferences, reserveMinutes: 1000 }, [], [candidate("a")]);
  assert.equal(reserved.availableMinutes, 0);
  assert.equal(reserved.reservedMinutes, 480);
  assert.match(reserved.warnings[0], /less free time/);
});

test("proposals never mutate preferences, candidates, or existing blocks", () => {
  const input = {
    preferences: structuredClone(preferences),
    existing: [block("a", "12:00", "13:00"), block("b", "10:00", "10:30")],
    candidates: [candidate("a"), candidate("b", { priority: "urgent" })],
  };
  const snapshot = structuredClone(input);
  const first = proposeWorkday(weekday, input.preferences, input.existing, input.candidates);
  assert.deepEqual(input, snapshot);
  assert.deepEqual(first, proposeWorkday(weekday, input.preferences, input.existing, input.candidates));
});

test("suggestion identifiers are distinct even when source IDs contain separators", () => {
  const result = proposeWorkday(weekday, preferences, [], [candidate("a", { sourceId: "a:b" }), candidate("b", { sourceId: "a%3Ab" })]);
  assert.equal(new Set(result.suggested.map((item) => item.id)).size, 2);
});

test("varied busy calendars preserve capacity, full durations, and no new overlaps", () => {
  const time = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  let seed = 781;
  const random = (max: number) => {
    seed = (seed * 16807) % 2147483647;
    return seed % max;
  };
  for (let trial = 0; trial < 80; trial += 1) {
    const commitments = Array.from({ length: 8 }, (_, index) => {
      const start = 480 + random(600);
      return block(String(index), time(start), time(start + 1 + random(120)));
    });
    const items = Array.from({ length: 20 }, (_, index) => candidate(`candidate-${index}`, { minutes: 1 + random(120) }));
    const reserveMinutes = random(90);
    const result = proposeWorkday(weekday, { ...preferences, reserveMinutes }, commitments, items);
    const occupiedMinutes = new Set<number>();
    for (const commitment of commitments) {
      for (let current = Math.max(540, minutes(commitment.start)); current < Math.min(1020, minutes(commitment.end)); current += 1) occupiedMinutes.add(current);
    }
    const freeBefore = 480 - occupiedMinutes.size;
    assert.equal(result.reservedMinutes, Math.min(reserveMinutes, freeBefore));
    assert.equal(result.availableMinutes, freeBefore - result.reservedMinutes);
    assert.ok(result.scheduledMinutes <= result.availableMinutes);
    let totalSuggested = 0;
    for (const suggestion of result.suggested) {
      const start = minutes(suggestion.start);
      const end = minutes(suggestion.end);
      assert.ok(start >= 540 && end <= 1020);
      assert.equal(end - start, items.find((item) => item.sourceId === suggestion.sourceId)!.minutes);
      for (let current = start; current < end; current += 1) {
        assert.equal(occupiedMinutes.has(current), false, `Unexpected conflict in trial ${trial}`);
        occupiedMinutes.add(current);
      }
      totalSuggested += end - start;
    }
    assert.equal(result.scheduledMinutes, totalSuggested);
    assert.equal(result.suggested.length + result.unscheduled.length, items.length);
  }
});
