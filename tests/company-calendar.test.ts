import assert from "node:assert/strict";
import test from "node:test";
import { buildCalendarEntries, calendarDates, shiftCalendarDate, type CalendarDeadline } from "../lib/company-calendar";
import type { PlanningWorkspace } from "../lib/operating-plans";

const deadline = (patch: Partial<CalendarDeadline> = {}): CalendarDeadline => ({
  id: "task:review", title: "Review release", date: "2026-09-17", label: "Task deadline",
  route: "tasks", recordId: "review", ...patch,
});
const block = (id = "focus"): PlanningWorkspace["days"][string][number] => ({
  id, title: "Review release", start: "09:00", end: "09:30", source: "task", sourceId: "review",
});

test("deadlines are date-only markers, distinct from local timed planning blocks", () => {
  const entries = buildCalendarEntries({ "2026-09-17": [block()] }, [deadline()], "2026-09-17");
  assert.equal(entries.length, 2);
  assert.equal(entries[0].kind, "deadline");
  assert.equal(entries[0].start, undefined);
  assert.equal(entries[0].end, undefined);
  assert.equal(entries[0].route, "tasks");
  assert.equal(entries[0].recordId, "review");
  assert.equal(entries[1].kind, "planned");
  assert.equal(entries[1].label, "Local planning block");
  assert.equal(entries[1].start, "09:00");
  assert.equal(entries[1].end, "09:30");
  assert.equal(entries[1].sourceId, "review");
  assert.equal(entries[1].route, undefined);
  assert.equal(new Set(entries.map((entry) => entry.id)).size, 2);
});

test("identical labels from different canonical sources are not merged", () => {
  const entries = buildCalendarEntries({}, [deadline(), deadline({ id: "project:review", route: "projects", label: "Project deadline" })], "2026-09-17");
  assert.equal(entries.length, 2);
  assert.equal(new Set(entries.map((entry) => entry.id)).size, 2);
});

test("entry identities preserve source separators and unusual string IDs without URI coercion", () => {
  const entries = buildCalendarEntries({ "2026-09-17": [block("a:b"), block("a%3Ab"), block("bad\ud800unit")] }, [
    deadline({ recordId: "1" }), deadline({ recordId: 1 }),
  ], "2026-09-17");
  assert.equal(entries.length, 5);
  assert.equal(new Set(entries.map((entry) => entry.id)).size, 5);
});

test("Today deadlines resolve against actual today without inventing unknown dates", () => {
  const entries = buildCalendarEntries({}, [deadline({ date: " Today " }), deadline({ id: "unknown", date: "TBD" }), deadline({ id: "empty", date: "" })], "2026-09-18");
  assert.equal(entries.length, 1);
  assert.equal(entries[0].date, "2026-09-18");
  assert.deepEqual(buildCalendarEntries({}, [deadline({ date: "Today" })], "invalid"), []);
});

test("invalid dates, times, records and work sources cannot produce fake events", () => {
  const days = {
    "2026-02-30": [block()],
    "2026-09-17": [
      { ...block("end-first"), end: "08:00" }, { ...block("bad-start"), start: "9:00" },
      { ...block("bad-end"), end: "24:00" }, { ...block("no-title"), title: " " },
      { ...block("no-source-id"), sourceId: undefined },
      { ...block("unknown-source"), source: "Outlook" },
    ],
  } as PlanningWorkspace["days"];
  const deadlines = [deadline({ date: "2026-02-29" }), deadline({ date: "0000-01-01" }), deadline({ date: "2026-9-17" }), deadline({ recordId: Number.NaN }), deadline({ route: "" })];
  assert.deepEqual(buildCalendarEntries(days, deadlines, "2026-09-17"), []);
});

test("calendar projection does not mutate canonical deadlines or accepted plans", () => {
  const data = { days: { "2026-09-18": [block("next")], "2026-09-17": [block()] }, deadlines: [deadline({ date: "Today" })] };
  const before = structuredClone(data);
  const entries = buildCalendarEntries(data.days, data.deadlines, "2026-09-17");
  entries[0].title = "Changed projection";
  assert.deepEqual(data, before);
  assert.deepEqual(entries.map((entry) => entry.date), ["2026-09-17", "2026-09-17", "2026-09-18"]);
});

test("week dates start Monday and cover year boundaries", () => {
  assert.deepEqual(calendarDates("2026-09-20", "week"), ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20"]);
  assert.deepEqual(calendarDates("2027-01-01", "week"), ["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"]);
});

test("month grids contain complete Monday-first weeks including adjacent dates", () => {
  const september = calendarDates("2026-09-17", "month");
  assert.equal(september[0], "2026-08-31");
  assert.equal(september.at(-1), "2026-10-04");
  assert.equal(september.length, 35);
  const february = calendarDates("2021-02-15", "month");
  assert.equal(february[0], "2021-02-01");
  assert.equal(february.at(-1), "2021-02-28");
  assert.equal(february.length, 28);
  const august = calendarDates("2026-08-15", "month");
  assert.equal(august.length, 42);
  assert.equal(august[0], "2026-07-27");
  assert.equal(august.at(-1), "2026-09-06");
});

test("month navigation clamps dates correctly for leap years and year rollover", () => {
  assert.equal(shiftCalendarDate("2026-01-31", 1, "month"), "2026-02-28");
  assert.equal(shiftCalendarDate("2028-01-31", 1, "month"), "2028-02-29");
  assert.equal(shiftCalendarDate("2000-01-31", 1, "month"), "2000-02-29");
  assert.equal(shiftCalendarDate("1900-01-31", 1, "month"), "1900-02-28");
  assert.equal(shiftCalendarDate("2026-12-31", 1, "month"), "2027-01-31");
  assert.equal(shiftCalendarDate("2026-01-31", -1, "month"), "2025-12-31");
  assert.equal(shiftCalendarDate("2028-02-29", 12, "month"), "2029-02-28");
});

test("week navigation stays date-only across DST and year boundaries", () => {
  assert.equal(shiftCalendarDate("2026-03-08", 1, "week"), "2026-03-15");
  assert.equal(shiftCalendarDate("2026-11-01", -1, "week"), "2026-10-25");
  assert.equal(shiftCalendarDate("2026-12-31", 1, "week"), "2027-01-07");
});

test("invalid or out-of-range navigation fails closed, including small years", () => {
  for (const anchor of ["2026-02-29", "2026-09-31", "0000-01-01", "10000-01-01", "2026-9-01", "bad"]) {
    assert.deepEqual(calendarDates(anchor, "month"), []);
    assert.equal(shiftCalendarDate(anchor, 1, "month"), "");
  }
  assert.equal(shiftCalendarDate("0001-01-01", -1, "month"), "");
  assert.equal(shiftCalendarDate("9999-12-31", 1, "week"), "");
  assert.equal(shiftCalendarDate("9999-12-31", 1, "month"), "");
  assert.equal(shiftCalendarDate("2026-09-17", Number.MAX_SAFE_INTEGER, "week"), "");
  assert.equal(shiftCalendarDate("2026-09-17", Number.POSITIVE_INFINITY, "month"), "");
  assert.equal(shiftCalendarDate("2026-09-17", 0.5, "month"), "");
  assert.equal(shiftCalendarDate("0001-01-31", 1, "month"), "0001-02-28");
  assert.equal(calendarDates("0001-01-01", "week")[0], "0001-01-01");
  assert.deepEqual(calendarDates("9999-12-31", "month"), []);
});

test("calendar date arithmetic is independent of host timezone", () => {
  const original = process.env.TZ;
  try {
    for (const timezone of ["Pacific/Honolulu", "America/New_York", "Pacific/Kiritimati"]) {
      process.env.TZ = timezone;
      assert.equal(calendarDates("2026-09-20", "week")[0], "2026-09-14");
      assert.equal(shiftCalendarDate("2026-03-08", 1, "week"), "2026-03-15");
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});
