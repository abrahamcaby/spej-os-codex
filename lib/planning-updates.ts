import type { PlanningWorkspace } from "./operating-plans";
import type { TaskItem } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function identifier(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max
    && !/[\s\p{Cc}]/u.test(value) && !["__proto__", "constructor", "prototype"].includes(value);
}

function minutes(value: unknown): number | undefined {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return undefined;
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/**
 * Validate UI-authored writes before persistence. Unlike the import normalizer,
 * this rejects loss-inducing limits and invalid settings instead of dropping
 * accepted work or substituting defaults. Plan revisions/history are preserved.
 * This is not ownership enforcement; callers still need their own access checks.
 */
export function validatePlanningWrite(next: PlanningWorkspace): PlanningWorkspace {
  if (!isRecord(next) || next.version !== 1 || !Array.isArray(next.plans)
    || !isRecord(next.preferences) || !isRecord(next.days) || !isRecord(next.estimates)) {
    throw new Error("Planning data has an unsupported format. Your saved work was not changed.");
  }
  const start = minutes(next.preferences.start);
  const end = minutes(next.preferences.end);
  if (start === undefined || end === undefined || start >= end) {
    throw new Error("Working hours must use HH:mm and end after they start on the same day.");
  }
  const reserve = next.preferences.reserveMinutes;
  if (!Number.isInteger(reserve) || reserve < 0 || reserve > 480) {
    throw new Error("Reserved time must be a whole number from 0 to 480 minutes.");
  }
  if (reserve > end - start) {
    throw new Error("Reserved time cannot exceed the selected working window. Reduce the reserve or extend your hours.");
  }
  const weekdays = next.preferences.weekdays;
  if (!Array.isArray(weekdays) || weekdays.length > 7
    || weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
    || new Set(weekdays).size !== weekdays.length) {
    throw new Error("Working days must be unique weekday numbers from 0 (Sunday) to 6 (Saturday).");
  }

  const entries = Object.entries(next.days);
  const populatedDays: Array<[string, PlanningWorkspace["days"][string]]> = [];
  for (const [date, blocks] of entries) {
    if (!validDate(date) || !Array.isArray(blocks)) {
      throw new Error("Each planning day needs a valid YYYY-MM-DD date and a list of time blocks.");
    }
    if (blocks.length === 0) continue;
    if (blocks.length > 100) {
      throw new Error(`The day ${date} has reached its 100-block limit. Remove an unused block before adding more; nothing was discarded.`);
    }
    const ids = new Set<string>();
    for (const block of blocks) {
      if (!isRecord(block) || !identifier(block.id, 400) || ids.has(block.id)) {
        throw new Error(`Each time block on ${date} needs its own valid ID. Your saved schedule was not changed.`);
      }
      ids.add(block.id);
      if (typeof block.title !== "string" || !block.title.trim() || block.title.length > 200
        || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(block.title)) {
        throw new Error(`Each time block on ${date} needs a title of 1–200 characters.`);
      }
      const blockStart = minutes(block.start);
      const blockEnd = minutes(block.end);
      if (blockStart === undefined || blockEnd === undefined || blockStart >= blockEnd) {
        throw new Error(`Time blocks on ${date} need valid HH:mm times with the end after the start.`);
      }
      if (!["manual", "task", "routine"].includes(block.source)
        || (block.source !== "manual" && !identifier(block.sourceId, 321))
        || (block.sourceId !== undefined && !identifier(block.sourceId, 321))) {
        throw new Error(`A time block on ${date} has an invalid work link. Your saved schedule was not changed.`);
      }
    }
    populatedDays.push([date, blocks]);
  }
  if (populatedDays.length > 366) {
    throw new Error("This workspace has reached its 366-day schedule limit. Download a backup and remove unneeded old blocks before adding another day; nothing was discarded.");
  }

  const estimates = Object.entries(next.estimates);
  if (estimates.length > 1_000) {
    throw new Error("This workspace has reached its 1,000-estimate limit. Remove unused work estimates before adding another; nothing was discarded.");
  }
  for (const [id, estimate] of estimates) {
    if (!identifier(id, 160) || !Number.isInteger(estimate) || estimate < 1 || estimate > 480) {
      throw new Error("Work estimates need a valid task ID and 1–480 whole minutes.");
    }
  }

  // Prune empty dates before applying the limit, but retain every non-empty day
  // and all plan history. Return an independent copy; never mutate caller state.
  return structuredClone({ ...next, days: Object.fromEntries(populatedDays) });
}

/**
 * Accepted blocks link to task IDs, not recurring occurrence IDs. Completing a
 * repeating task here could advance a later occurrence, so open its task view
 * instead. This eligibility check does not grant permission to change a task.
 */
export function canCompletePlannedTask(task: TaskItem, allTasks: TaskItem[]): boolean {
  return !task.done && task.recurrence === "One-time"
    && !allTasks.some((child) => !child.done && child.parentId !== undefined
      && String(child.parentId) === String(task.id));
}
