import { metricDay, validMetricDate } from "./gtm-metrics";
import type { ActivityItem, ContactItem, TaskItem } from "./types";

/** Shared by manual entry, persistence, and reviewed SOSA proposals. */
export const ACTIVITY_MESSAGE_MAX_LENGTH = 20_000;

/** Unknown, invalid, and future source dates never become the capture date. */
export function communicationActivityDate(activity: ActivityItem, today = metricDay()): string | undefined {
  return activity.sourceDateKnown !== false && validMetricDate(activity.occurredAt) && activity.occurredAt <= today
    ? activity.occurredAt
    : undefined;
}

function recordedTime(value: string | undefined) {
  const time = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(time) ? time : 0;
}

/** Active history only; capture timestamps break ties but never become event dates. */
export function sortCommunicationActivities(activities: readonly ActivityItem[], today = metricDay()): ActivityItem[] {
  return activities.filter((activity) => !activity.archivedAt).sort((a, b) => {
    const actualDateOrder = (communicationActivityDate(b, today) || "").localeCompare(communicationActivityDate(a, today) || "");
    return actualDateOrder
      || recordedTime(b.capturedAt) - recordedTime(a.capturedAt)
      || recordedTime(b.createdAt) - recordedTime(a.createdAt)
      || a.id.localeCompare(b.id);
  });
}

/**
 * Inputs must already be permission-filtered. Account IDs are deliberately not
 * used: the person's history follows them without changing their past employer.
 */
export function contactCommunicationActivities(contactId: string, activities: readonly ActivityItem[], today = metricDay()): ActivityItem[] {
  if (!contactId) return [];
  return sortCommunicationActivities(activities.filter((activity) => activity.contactId === contactId), today);
}

const outreachTypes = new Set<ActivityItem["metricType"]>(["Outreach sent", "Follow-up sent", "Call attempted", "Call connected", "Connection requested"]);
const conversationTypes = new Set<ActivityItem["metricType"]>(["Call connected", "Incoming call connected", "Meeting held", "Check-in completed"]);

export type ContactCommunicationDates = {
  lastOutreach: string | undefined;
  lastReply: string | undefined;
  lastConversation: string | undefined;
  lastInteraction: string | undefined;
};

/** Derive recency from actual logged events, not a manually maintained contact field. */
export function contactCommunicationDates(contactId: string, activities: readonly ActivityItem[], today = metricDay()): ContactCommunicationDates {
  const dates: ContactCommunicationDates = { lastOutreach: undefined, lastReply: undefined, lastConversation: undefined, lastInteraction: undefined };
  if (!contactId) return dates;
  for (const activity of activities) {
    if (activity.archivedAt || activity.contactId !== contactId) continue;
    const date = communicationActivityDate(activity, today);
    if (!date) continue;
    const update = (key: keyof ContactCommunicationDates) => {
      if (!dates[key] || dates[key]! < date) dates[key] = date;
    };
    update("lastInteraction");
    if (outreachTypes.has(activity.metricType)) update("lastOutreach");
    if (activity.metricType === "Reply received") update("lastReply");
    if (conversationTypes.has(activity.metricType)) update("lastConversation");
  }
  return dates;
}

export type ContactFollowUp = {
  date: string;
  title: string;
  source: "task" | "nurture" | "contact";
  taskId?: TaskItem["id"];
  overdue: boolean;
};

function taskIsActive(task: TaskItem) {
  // Task deletion currently removes the row. Also fail closed for imports that
  // retain tombstones, without expanding the persistence contract.
  const imported = task as TaskItem & { archivedAt?: string; deletedAt?: string };
  return !task.done && !imported.archivedAt && !imported.deletedAt;
}

/** No hidden/orphaned/deleted parent can make a subtask appear actionable. */
function taskHasActiveParents(task: TaskItem, tasks: ReadonlyMap<string, TaskItem>) {
  const seen = new Set<string>([String(task.id)]);
  let parentId = task.parentId;
  while (parentId !== undefined) {
    if (seen.has(String(parentId))) return false;
    seen.add(String(parentId));
    const parent = tasks.get(String(parentId));
    if (!parent || !taskIsActive(parent)) return false;
    parentId = parent.parentId;
  }
  return true;
}

/**
 * Uses only already-visible tasks explicitly linked to this person. Account-wide
 * work, campaign automation, paused nurture, and undated prompts are not inferred
 * to be personal follow-ups. Past-due open commitments remain visible as overdue.
 */
export function nextContactFollowUp(contact: ContactItem, tasks: readonly TaskItem[], today = metricDay()): ContactFollowUp | undefined {
  if (!contact.id || contact.archivedAt) return undefined;
  const candidates: ContactFollowUp[] = [];
  const add = (date: string | undefined, title: string | undefined, source: ContactFollowUp["source"], taskId?: TaskItem["id"]) => {
    if (!validMetricDate(date) || !title?.trim()) return;
    candidates.push({ date: date!, title: title.trim(), source, ...(taskId !== undefined ? { taskId } : {}), overdue: date! < today });
  };
  const tasksById = new Map(tasks.map((task) => [String(task.id), task]));
  for (const task of tasks) {
    if (task.relatedType === "contact" && task.relatedId === contact.id && taskIsActive(task) && taskHasActiveParents(task, tasksById)) {
      add(task.due, task.title, "task", task.id);
    }
  }
  if (contact.nurture?.state === "Active" && ["Personal", "Coordinated mix"].includes(contact.nurture.method)) {
    add(contact.nurture.dueDate, contact.nurture.nextAction, "nurture");
  }
  add(contact.nextActionDue, contact.nextAction, "contact");
  const sourcePriority = { task: 0, nurture: 1, contact: 2 };
  return candidates.sort((a, b) => a.date.localeCompare(b.date)
    || sourcePriority[a.source] - sourcePriority[b.source]
    || String(a.taskId ?? "").localeCompare(String(b.taskId ?? ""))
    || a.title.localeCompare(b.title))[0];
}
