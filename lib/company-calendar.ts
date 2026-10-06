import type { PlanningWorkspace } from "./operating-plans";
import type { WorkBlock } from "./work-planner";

export type CalendarDeadline = {
  id: string;
  title: string;
  date: string;
  label: string;
  route: string;
  recordId: string | number;
};

export type CalendarEntry = {
  id: string;
  title: string;
  date: string;
  start?: string;
  end?: string;
  kind: "planned" | "deadline";
  label: string;
  sourceId?: string;
  source?: WorkBlock["source"];
  route?: string;
  recordId?: string | number;
};

type DateParts = { year: number; month: number; day: number };
type CalendarView = "week" | "month";

function monthLength(year: number, month: number): number {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

function parseDate(value: unknown): DateParts | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > monthLength(year, month)) return undefined;
  return { year, month, day };
}

function dateValue({ year, month, day }: DateParts): Date {
  // UTC is only an arithmetic tool here, never a real appointment timezone.
  // setUTCFullYear avoids Date.UTC's special handling of years 00–99.
  const value = new Date(0);
  value.setUTCHours(12, 0, 0, 0);
  value.setUTCFullYear(year, month - 1, day);
  return value;
}

function dateString(value: Date): string | undefined {
  if (!Number.isFinite(value.getTime())) return undefined;
  const year = value.getUTCFullYear();
  if (year < 1 || year > 9999) return undefined;
  return `${String(year).padStart(4, "0")}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

function addDays(parts: DateParts, days: number): string | undefined {
  if (!Number.isSafeInteger(days)) return undefined;
  const value = dateValue(parts);
  value.setUTCDate(value.getUTCDate() + days);
  return dateString(value);
}

function minutes(value: unknown): number | undefined {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return undefined;
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}

function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Read-only projection of an owner's local schedule and already-authorized
 * canonical deadlines. This does not authorize records or connect to Outlook.
 * Deadlines remain date-only markers, never invented meetings or busy blocks.
 */
export function buildCalendarEntries(
  days: PlanningWorkspace["days"],
  deadlines: CalendarDeadline[],
  today: string,
): CalendarEntry[] {
  const entries: CalendarEntry[] = [];
  if (isRecord(days)) {
    for (const [date, blocks] of Object.entries(days)) {
      if (!parseDate(date) || !Array.isArray(blocks)) continue;
      for (const block of blocks) {
        if (!isRecord(block) || !text(block.id) || !text(block.title)
          || typeof block.source !== "string" || !["manual", "task", "routine"].includes(block.source)) continue;
        const start = minutes(block.start);
        const end = minutes(block.end);
        if (start === undefined || end === undefined || end <= start) continue;
        if (block.source !== "manual" && !text(block.sourceId)) continue;
        if (block.sourceId !== undefined && !text(block.sourceId)) continue;
        entries.push({
          id: JSON.stringify(["planned", date, block.id]),
          title: block.title.trim(), date,
          start: block.start as string, end: block.end as string,
          kind: "planned", label: "Local planning block",
          source: block.source as WorkBlock["source"],
          ...(typeof block.sourceId === "string" ? { sourceId: block.sourceId } : {}),
        });
      }
    }
  }
  if (Array.isArray(deadlines)) {
    for (const deadline of deadlines) {
      if (!isRecord(deadline) || !text(deadline.id) || !text(deadline.title)
        || !text(deadline.label) || !text(deadline.route) || typeof deadline.date !== "string") continue;
      if (!(typeof deadline.recordId === "string" && text(deadline.recordId))
        && !(typeof deadline.recordId === "number" && Number.isFinite(deadline.recordId))) continue;
      const date = deadline.date.trim().toLowerCase() === "today" ? today : deadline.date.trim();
      if (!parseDate(date)) continue;
      entries.push({
        id: JSON.stringify(["deadline", deadline.route, deadline.id, deadline.recordId, date]),
        title: deadline.title.trim(), date, kind: "deadline", label: deadline.label.trim(),
        route: deadline.route, recordId: deadline.recordId as string | number,
      });
    }
  }
  return entries.sort((a, b) => a.date.localeCompare(b.date)
    || (a.kind === b.kind ? 0 : a.kind === "deadline" ? -1 : 1)
    || (a.start ?? "").localeCompare(b.start ?? "")
    || a.id.localeCompare(b.id));
}

/** Monday-first weeks, or all full weeks touching the anchor's month. */
export function calendarDates(anchor: string, view: CalendarView): string[] {
  const parsed = parseDate(anchor);
  if (!parsed || !["week", "month"].includes(view)) return [];
  const first = view === "month" ? { ...parsed, day: 1 } : parsed;
  const offset = (dateValue(first).getUTCDay() + 6) % 7;
  const count = view === "week" ? 7 : Math.ceil((offset + monthLength(parsed.year, parsed.month)) / 7) * 7;
  const dates: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const date = addDays(first, index - offset);
    // Never emit partial weeks or dates outside the supported four-digit years.
    if (!date) return [];
    dates.push(date);
  }
  return dates;
}

/** Move by full weeks/months. Invalid dates or out-of-range shifts return "". */
export function shiftCalendarDate(anchor: string, amount: number, view: CalendarView): string {
  const parsed = parseDate(anchor);
  if (!parsed || !Number.isSafeInteger(amount)) return "";
  if (view === "week") return addDays(parsed, amount * 7) ?? "";
  if (view !== "month") return "";
  const index = (parsed.year - 1) * 12 + parsed.month - 1 + amount;
  if (!Number.isSafeInteger(index) || index < 0 || index >= 9999 * 12) return "";
  const year = Math.floor(index / 12) + 1;
  const month = index % 12 + 1;
  return dateString(dateValue({ year, month, day: Math.min(parsed.day, monthLength(year, month)) })) ?? "";
}
