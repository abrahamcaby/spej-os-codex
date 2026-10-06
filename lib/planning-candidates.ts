import type { OperatingPlan } from "./operating-plans";
import type { TaskItem } from "./types";
import type { WorkCandidate } from "./work-planner";

/** An editable planning assumption, not a measured duration or role target. */
export const DEFAULT_TASK_ESTIMATE_MINUTES = 25;

/** Parent eligibility metadata, without exposing another assignee's task text. */
export function getOpenParentTaskIds(tasks: TaskItem[]): string[] {
  return [...new Set(tasks.filter((task) => !task.done && task.parentId !== undefined && String(task.parentId) !== String(task.id)).map((task) => String(task.parentId)))];
}

/** Shared by the estimate editor and candidate builder to keep values aligned. */
export function getTaskPlanningMinutes(task: Pick<TaskItem, "id">, estimates: Record<string, number>): number {
  const sourceId = String(task.id);
  const estimate = Object.prototype.hasOwnProperty.call(estimates, sourceId) ? estimates[sourceId] : undefined;
  return typeof estimate === "number" && Number.isInteger(estimate) && estimate >= 1 && estimate <= 480
    ? estimate
    : DEFAULT_TASK_ESTIMATE_MINUTES;
}

function taskPriority(value: unknown): WorkCandidate["priority"] {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return normalized === "urgent" || normalized === "high" || normalized === "low"
    ? normalized
    : "normal";
}

/** Keep the local calendar label valid without changing its canonical task. */
function planningTaskTitle(value: string): string {
  const title = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  if (!title) return "Untitled task";
  if (title.length <= 200) return title;
  let shortened = title.slice(0, 199);
  // The ellipsis occupies one UTF-16 code unit. Keep an emoji's two-unit
  // surrogate pair intact if the snapshot boundary would otherwise bisect it.
  const finalUnit = shortened.charCodeAt(shortened.length - 1);
  if (finalUnit >= 0xd800 && finalUnit <= 0xdbff) shortened = shortened.slice(0, -1);
  return `${shortened}…`;
}

function dueDate(value: string, today: string): string | undefined {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || ["unknown", "tbd"].includes(normalized.toLowerCase())) return undefined;
  if (normalized.toLowerCase() === "today") return today;
  // Preserve malformed actual dates so the planning engine explains the issue
  // instead of silently treating an invalid deadline as undated work.
  return normalized;
}

function weekday(date: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith("0000")) return undefined;
  const day = new Date(`${date}T12:00:00.000Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date) return undefined;
  return day.getUTCDay();
}

/**
 * Convert already-authorized, already-owner-filtered records into proposals.
 * This adapter does not authorize access, persist changes, complete tasks, or
 * write calendars. `today` is explicit: selecting tomorrow must not move a
 * legacy "Today" deadline to tomorrow. The downstream planner validates dates.
 */
export function buildPlanningCandidates(
  tasks: TaskItem[],
  plans: OperatingPlan[],
  date: string,
  today: string,
  estimates: Record<string, number>,
): WorkCandidate[] {
  const openTasks = tasks.filter((task) => !task.done);
  const parentsWithOpenChildren = new Set(openTasks.flatMap((task) =>
    task.parentId !== undefined && String(task.parentId) !== String(task.id)
      ? [String(task.parentId)]
      : []));
  const candidates: WorkCandidate[] = openTasks
    .filter((task) => !parentsWithOpenChildren.has(String(task.id)))
    .map((task) => {
      const sourceId = String(task.id);
      const due = dueDate(task.due, today);
      return {
        id: `task:${sourceId}`,
        source: "task",
        sourceId,
        title: planningTaskTitle(task.title),
        minutes: getTaskPlanningMinutes(task, estimates),
        priority: taskPriority(task.priority),
        ...(due !== undefined ? { due } : {}),
        ...(task.status === "Blocked" || task.status === "Waiting" ? { blocked: true } : {}),
      };
    });

  const selectedWeekday = weekday(date);
  if (selectedWeekday === undefined) return candidates;
  for (const plan of plans) {
    if (plan.status !== "active") continue;
    for (const routine of plan.routines) {
      if (!routine.weekdays.includes(selectedWeekday)) continue;
      const sourceId = `${plan.id}:${routine.id}`;
      candidates.push({
        id: `routine:${sourceId}`,
        source: "routine",
        sourceId,
        title: routine.title,
        minutes: routine.minutes,
        priority: routine.priority,
      });
    }
  }
  return candidates;
}
