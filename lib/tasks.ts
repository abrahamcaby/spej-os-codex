import type { ProjectItem, TaskCategory, TaskItem, TaskVisibility, TaskWorkspaceId } from "./types";

const RECURRENCES = new Set(["One-time", "Daily", "Weekly", "Monthly"]);
const RECURRING_RECURRENCES = new Set(["Daily", "Weekly", "Monthly"]);
const TASK_CATEGORIES = new Set(["Sales", "Partnerships", "Marketing", "5-3-1", "Content", "Project Work", "Client Delivery", "Operations", "General"]);
const RELATED_TYPES = new Set(["account", "contact", "opportunity", "partnership", "project", "campaign", "content"]);
export const TASK_PRIORITIES = ["Urgent", "High", "Normal", "Low"] as const;
const TASK_PRIORITY_SET = new Set<string>(TASK_PRIORITIES);
export const WORK_STATUSES = ["Not Started", "In Progress", "Waiting", "Blocked", "In Review"] as const;
export const WORK_EFFORTS = ["Quick", "Small", "Medium", "Large"] as const;
export const TASK_VISIBILITIES = ["Private", "Workspace", "Company"] as const satisfies readonly TaskVisibility[];
export const TASK_WORKSPACES = ["gtm", "project-management", "company"] as const satisfies readonly TaskWorkspaceId[];
const WORK_STATUS_SET = new Set<string>(WORK_STATUSES);
const WORK_EFFORT_SET = new Set<string>(WORK_EFFORTS);
const TASK_VISIBILITY_SET = new Set<string>(TASK_VISIBILITIES);
const TASK_WORKSPACE_SET = new Set<string>(TASK_WORKSPACES);
const RAPID_COMPLETION_GUARD_MS = 750;

export type TaskSortMode = "due-asc" | "due-desc" | "priority-desc" | "priority-asc" | "created-desc";
export type TaskWorkspace = "gtm" | "delivery";

/** Keep legacy 5-3-1 work in Sales without rewriting its stored provenance. */
export function taskCategoryForDisplay(task: Pick<TaskItem, "category">): Exclude<TaskCategory, "5-3-1"> {
  return task.category === "5-3-1" ? "Sales" : task.category || "General";
}

export function taskVisibility(task: Pick<TaskItem, "visibility">): TaskVisibility {
  return TASK_VISIBILITY_SET.has(task.visibility || "") ? task.visibility! : "Private";
}

export function taskVisibilityLabel(task: Pick<TaskItem, "visibility">) {
  const visibility = taskVisibility(task);
  return visibility === "Private" ? "Owner only" : visibility === "Company" ? "Company-wide" : "Workspace";
}

/** Resolve the task's stable work area. A linked project always wins. */
export function taskWorkspaceId(task: TaskItem, projects: ProjectItem[]): TaskWorkspaceId {
  if (task.relatedType === "project") {
    const project = projects.find((candidate) => candidate.id === task.relatedId);
    if (project) return project.workArea === "GTM" ? "gtm" : "project-management";
  }
  if (TASK_WORKSPACE_SET.has(task.workspaceId || "")) return task.workspaceId!;
  return task.category === "Project Work" || task.category === "Client Delivery"
    ? "project-management"
    : "gtm";
}

export function taskWorkspaceLabel(task: TaskItem, projects: ProjectItem[]): "GTM" | "Project Management" | "Company" {
  const workspace = taskWorkspaceId(task, projects);
  return workspace === "gtm" ? "GTM" : workspace === "project-management" ? "Project Management" : "Company";
}

/**
 * Project links are authoritative for workspace routing. Category remains the
 * fallback for legacy or currently unlinked work.
 */
export function taskBelongsToWorkspace(
  task: TaskItem,
  projects: ProjectItem[],
  workspace: TaskWorkspace,
) {
  const resolved = taskWorkspaceId(task, projects);
  if (resolved === "company") return true;
  return workspace === "delivery" ? resolved === "project-management" : resolved === "gtm";
}

/** Subtasks keep the same business-record link unless an edited task already has one. */
export function inheritedTaskRelationship(
  parent?: Pick<TaskItem, "relatedType" | "relatedId">,
  existing?: Pick<TaskItem, "relatedType" | "relatedId">,
) {
  return {
    relatedType: existing?.relatedType ?? parent?.relatedType,
    relatedId: existing?.relatedId ?? parent?.relatedId,
  } satisfies Pick<TaskItem, "relatedType" | "relatedId">;
}

/** Subtasks inherit workspace/visibility; ownership may be delegated explicitly. */
export function inheritedTaskAccess(
  parent?: Pick<TaskItem, "owner" | "ownerProfileId" | "visibility" | "workspaceId">,
  existing?: Pick<TaskItem, "owner" | "ownerProfileId" | "visibility" | "workspaceId">,
) {
  if (parent) {
    const visibility = taskVisibility(parent);
    const canDelegate = visibility !== "Private";
    return {
      owner: canDelegate ? existing?.owner ?? parent.owner : parent.owner,
      ownerProfileId: canDelegate ? existing?.ownerProfileId ?? parent.ownerProfileId : parent.ownerProfileId,
      visibility,
      workspaceId: parent.workspaceId,
    } satisfies Pick<TaskItem, "owner" | "ownerProfileId" | "visibility" | "workspaceId">;
  }
  return {
    owner: existing?.owner,
    ownerProfileId: existing?.ownerProfileId,
    visibility: taskVisibility(existing || {}),
    workspaceId: existing?.workspaceId,
  } satisfies Pick<TaskItem, "owner" | "ownerProfileId" | "visibility" | "workspaceId">;
}

export function taskPriorityRank(value: TaskItem["priority"]) {
  const index = TASK_PRIORITIES.indexOf(value);
  return index < 0 ? TASK_PRIORITIES.indexOf("Normal") : index;
}

export function taskDueValue(value: string, now = new Date()) {
  const normalized = value === "Today" ? localDateValue(now) : value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return Number.POSITIVE_INFINITY;
  const [year, month, day] = normalized.split("-").map(Number);
  return new Date(year, month - 1, day, 12).getTime();
}

export function sortTaskItems(tasks: TaskItem[], mode: TaskSortMode) {
  return [...tasks].sort((left, right) => {
    if (mode === "created-desc")
      return (right.createdAt || "").localeCompare(left.createdAt || "") || left.title.localeCompare(right.title);
    if (mode === "priority-desc" || mode === "priority-asc") {
      const delta = taskPriorityRank(left.priority) - taskPriorityRank(right.priority);
      return (mode === "priority-desc" ? delta : -delta) || taskDueValue(left.due) - taskDueValue(right.due) || left.title.localeCompare(right.title);
    }
    const delta = taskDueValue(left.due) - taskDueValue(right.due);
    return (mode === "due-asc" ? delta : -delta) || taskPriorityRank(left.priority) - taskPriorityRank(right.priority) || left.title.localeCompare(right.title);
  });
}

export function hasOpenSubtasks(tasks: TaskItem[], parentId: TaskItem["id"]) {
  return tasks.some((task) => !task.done && String(task.parentId) === String(parentId));
}

export function removeTaskAndDetachChildren(tasks: TaskItem[], taskId: TaskItem["id"]) {
  return tasks
    .filter((task) => task.id !== taskId)
    .map((task) => String(task.parentId) === String(taskId) ? { ...task, parentId: undefined } : task);
}

export function normalizeTaskHierarchy(tasks: TaskItem[]) {
  const byId = new Map(tasks.map((task) => [String(task.id), task]));
  const normalized = tasks.map((task) => {
    if (task.parentId === undefined) return task;
    const seen = new Set([String(task.id)]);
    let parent = byId.get(String(task.parentId));
    if (!parent) return { ...task, parentId: undefined };
    while (parent.parentId !== undefined) {
      const parentKey = String(parent.id);
      if (seen.has(parentKey)) return { ...task, parentId: undefined };
      seen.add(parentKey);
      const next = byId.get(String(parent.parentId));
      if (!next) return { ...task, parentId: undefined };
      parent = next;
    }
    if (String(parent.id) === String(task.id)) return { ...task, parentId: undefined };
    return String(task.parentId) === String(parent.id) ? task : { ...task, parentId: parent.id };
  });
  const normalizedById = new Map(normalized.map((task) => [String(task.id), task]));
  return normalized.map((task) => {
    if (task.parentId === undefined) return task;
    const parent = normalizedById.get(String(task.parentId));
    return parent ? { ...task, ...inheritedTaskAccess(parent, task) } : task;
  });
}

function localDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromTaskValue(value: string, fallback: Date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(
      fallback.getFullYear(),
      fallback.getMonth(),
      fallback.getDate(),
      12,
    );
  }
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function addRecurrence(date: Date, recurrence: string, anchorDay?: number) {
  const next = new Date(date);
  if (recurrence === "Daily") next.setDate(next.getDate() + 1);
  if (recurrence === "Weekly") next.setDate(next.getDate() + 7);
  if (recurrence === "Monthly") {
    const desiredDay = anchorDay || next.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() + 1);
    const finalDay = new Date(
      next.getFullYear(),
      next.getMonth() + 1,
      0,
      12,
    ).getDate();
    next.setDate(Math.min(desiredDay, finalDay));
  }
  return next;
}

export function nextRecurringDue(
  value: string,
  recurrence: string,
  now = new Date(),
  anchorDay?: number,
) {
  if (!RECURRING_RECURRENCES.has(recurrence)) return localDateValue(now);
  let next = dateFromTaskValue(value, now);
  const today = dateFromTaskValue(localDateValue(now), now);
  const recurrenceAnchor =
    recurrence === "Monthly" && Number.isInteger(anchorDay) && anchorDay! >= 1 && anchorDay! <= 31
      ? anchorDay
      : next.getDate();
  do {
    next = addRecurrence(next, recurrence, recurrenceAnchor);
  } while (next <= today);
  return localDateValue(next);
}

export function completeTaskItems(
  tasks: TaskItem[],
  taskId: TaskItem["id"],
  options: {
    now?: Date;
    occurrenceId?: TaskItem["id"];
    expectedDue?: string;
  } = {},
) {
  const task = tasks.find((candidate) => candidate.id === taskId);
  if (
    !task ||
    task.done ||
    (options.expectedDue !== undefined && task.due !== options.expectedDue)
  ) return tasks;
  const now = options.now || new Date();
  const recentlyCompleted = tasks.some((candidate) => {
    if (!candidate.done || candidate.seriesId !== task.id || !candidate.completedAt)
      return false;
    const elapsed = now.getTime() - Date.parse(candidate.completedAt);
    return Number.isFinite(elapsed) && elapsed >= 0 && elapsed < RAPID_COMPLETION_GUARD_MS;
  });
  if (recentlyCompleted) return tasks;
  const completedAt = now.toISOString();
  if (!RECURRING_RECURRENCES.has(task.recurrence)) {
    return tasks.map((candidate) =>
      candidate.id === taskId ? { ...candidate, done: true, completedAt } : candidate,
    );
  }
  const occurrence: TaskItem = {
    ...task,
    id: options.occurrenceId || crypto.randomUUID(),
    done: true,
    completedAt,
    seriesId: task.id,
  };
  const recurrenceAnchorDay =
    task.recurrence === "Monthly"
      ? task.recurrenceAnchorDay || dateFromTaskValue(task.due, now).getDate()
      : undefined;
  const advanced = tasks.map((candidate) =>
    candidate.id === taskId
      ? {
          ...candidate,
          due: nextRecurringDue(
            candidate.due,
            candidate.recurrence,
            now,
            recurrenceAnchorDay,
          ),
          done: false,
          completedAt: undefined,
          recurrenceAnchorDay,
        }
      : candidate,
  );
  return [occurrence, ...advanced];
}

function taskIdentity(task: Pick<TaskItem, "id">) {
  return `${typeof task.id}:${String(task.id)}`;
}

export function preserveRecurringCompletionHistory(
  existing: TaskItem[],
  incoming: TaskItem[],
) {
  const immutable = new Map(
    existing
      .filter((task) => task.done && task.seriesId !== undefined)
      .map((task) => [taskIdentity(task), task]),
  );
  const retained = new Set<string>();
  const merged = incoming.map((task) => {
    const key = taskIdentity(task);
    const prior = immutable.get(key);
    if (!prior) return task;
    retained.add(key);
    return prior;
  });
  for (const [key, task] of immutable) {
    if (!retained.has(key)) merged.push(task);
  }
  return merged;
}

function cleanId(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? value
    : crypto.randomUUID();
}

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function cleanTaskItems(value: unknown): TaskItem[] {
  if (!Array.isArray(value)) throw new Error("Tasks must be a list.");
  if (value.length > 10_000) throw new Error("The task list is too large.");
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<TaskItem>;
    const title = cleanText(candidate.title).trim();
    if (!title) return [];
    const recurrence = cleanText(candidate.recurrence, "One-time");
    const category = cleanText(candidate.category, "General");
    const relatedType = cleanText(candidate.relatedType);
    const priority = cleanText(candidate.priority, "Normal");
    const status = cleanText(candidate.status, "Not Started");
    const effort = cleanText(candidate.effort, "Small");
    const visibility = cleanText(candidate.visibility, "Private");
    const workspaceId = cleanText(candidate.workspaceId);
    return [{
      id: cleanId(candidate.id),
      title,
      description: cleanText(
        candidate.description,
        "No additional details.",
      ),
      due: cleanText(candidate.due, "Today"),
      recurrence: RECURRENCES.has(recurrence) ? recurrence : "One-time",
      priority: TASK_PRIORITY_SET.has(priority) ? priority as TaskItem["priority"] : "Normal",
      owner: cleanText(candidate.owner, "Unassigned").trim().slice(0, 120) || "Unassigned",
      ownerProfileId: cleanText(candidate.ownerProfileId).trim().slice(0, 200) || undefined,
      visibility: TASK_VISIBILITY_SET.has(visibility) ? visibility as TaskItem["visibility"] : "Private",
      workspaceId: TASK_WORKSPACE_SET.has(workspaceId)
        ? workspaceId as TaskItem["workspaceId"]
        : category === "Project Work" || category === "Client Delivery"
          ? "project-management"
          : "gtm",
      status: WORK_STATUS_SET.has(status) ? status as TaskItem["status"] : "Not Started",
      effort: WORK_EFFORT_SET.has(effort) ? effort as TaskItem["effort"] : "Small",
      parentId:
        typeof candidate.parentId === "string" || typeof candidate.parentId === "number"
          ? candidate.parentId
          : undefined,
      category: TASK_CATEGORIES.has(category) ? category as TaskItem["category"] : "General",
      relatedType: RELATED_TYPES.has(relatedType) ? relatedType as TaskItem["relatedType"] : undefined,
      relatedId: cleanText(candidate.relatedId) || undefined,
      done: candidate.done === true,
      createdAt: cleanText(candidate.createdAt) || undefined,
      completedAt: cleanText(candidate.completedAt) || undefined,
      seriesId:
        typeof candidate.seriesId === "string" ||
        typeof candidate.seriesId === "number"
          ? candidate.seriesId
          : undefined,
      recurrenceAnchorDay:
        typeof candidate.recurrenceAnchorDay === "number" &&
        Number.isInteger(candidate.recurrenceAnchorDay) &&
        candidate.recurrenceAnchorDay >= 1 &&
        candidate.recurrenceAnchorDay <= 31
          ? candidate.recurrenceAnchorDay
          : undefined,
    }];
  });
}
