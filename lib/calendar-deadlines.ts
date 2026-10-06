import type { CalendarDeadline } from "./company-calendar";
import type { WorkspaceState } from "./types";
import { ownerMatchesViewer, recordOwnerMatchesViewer, type TeamViewProfile } from "./team-views";
import { previewCanViewTask, previewOwnsTask } from "./task-access-preview";
import { taskWorkspaceId } from "./tasks";

type CalendarRecords = Pick<WorkspaceState, "tasks" | "projects" | "content" | "campaigns" | "opportunities" | "partnerships" | "accounts" | "contacts">;

/** Personal calendar projection, not a production authorization boundary.
 * Source records stay canonical; dates never imply a booked meeting or send.
 * Production must supply permission-filtered records from authenticated APIs. */
export function buildPersonalCalendarDeadlines(
  records: CalendarRecords,
  viewer: TeamViewProfile,
  canViewRoute: (route: string) => boolean,
): CalendarDeadline[] {
  const results: CalendarDeadline[] = [];
  function add(id: string, title: string, date: string | undefined, label: string, route: string, recordId: string | number) {
    if (date?.trim() && canViewRoute(route)) results.push({ id, title, date, label, route, recordId });
  }
  for (const task of records.tasks) {
    if (task.done || !previewOwnsTask(task, viewer) || !previewCanViewTask(task, viewer, records.projects)) continue;
    const route = taskWorkspaceId(task, records.projects) === "project-management" ? "delivery-work" : "tasks";
    add(`task:${task.id}`, task.title, task.due, "Task due", route, task.id);
  }
  for (const project of records.projects) {
    if (project.archivedAt || !recordOwnerMatchesViewer(project, viewer) || ["Complete", "Stopped"].includes(project.operationalStatus)) continue;
    const route = project.workArea === "GTM" ? "gtm-initiatives" : "projects";
    add(`project:${project.id}:milestone`, project.nextMilestone ? `${project.name} · ${project.nextMilestone}` : project.name, project.dueDate, "Project milestone", route, project.id);
    if (project.endDate && project.endDate !== project.dueDate) add(`project:${project.id}:end`, project.name, project.endDate, "Project target finish", route, project.id);
  }
  for (const item of records.content) {
    if (item.stage === "Published") continue;
    const owner = recordOwnerMatchesViewer(item, viewer);
    const reviewer = recordOwnerMatchesViewer({ owner: item.approver, ownerProfileId: item.approverProfileId }, viewer);
    if (owner) add(`content:${item.id}:publish`, item.title, item.publishDate, "Content target publish", "content", item.id);
    if ((owner || reviewer) && item.reviewStatus !== "Approved") add(`content:${item.id}:review`, item.title, item.reviewDue, "Content review due", "content", item.id);
  }
  for (const item of records.campaigns) {
    if (item.archivedAt || item.status === "Complete" || !recordOwnerMatchesViewer(item, viewer)) continue;
    add(`campaign:${item.id}:start`, item.name, item.startDate, "Campaign target start", "campaigns", item.id);
    add(`campaign:${item.id}:end`, item.name, item.endDate, "Campaign target finish", "campaigns", item.id);
  }
  for (const item of records.opportunities) {
    if (item.archivedAt || item.stage.startsWith("Closed") || !recordOwnerMatchesViewer(item, viewer)) continue;
    if (item.actionState !== "Completed") add(`opportunity:${item.id}:followup`, item.nextSpejAction || item.name, item.nextActionDue, "Sales follow-up due", "pipeline", item.id);
    add(`opportunity:${item.id}:close`, item.name, item.closeDate, "Target close · forecast only", "pipeline", item.id);
  }
  for (const item of records.partnerships) {
    if (item.archivedAt || item.stage === "Paused / Ended" || !recordOwnerMatchesViewer(item, viewer)) continue;
    add(`partnership:${item.id}`, item.nextAction || item.name, item.dueDate, "Partner follow-up due", "partnerships", item.id);
  }
  const ownedAccounts = new Set(records.accounts.filter((item) => !item.archivedAt && item.status !== "Inactive" && recordOwnerMatchesViewer(item, viewer)).map((item) => item.id));
  for (const item of records.accounts) {
    if (item.archivedAt || item.status === "Inactive") continue;
    const responsible = item.checkInOwner ? ownerMatchesViewer(item.checkInOwner, viewer) : ownedAccounts.has(item.id);
    if (responsible) add(`account:${item.id}:checkin`, `Review check-in · ${item.name}`, item.nextCheckIn, "Relationship check-in due", "relationships", `client:${item.id}`);
    // A date-only CRM field is not an Outlook event or confirmed invitation.
    if (ownedAccounts.has(item.id)) add(`account:${item.id}:meeting`, item.name, item.nextMeetingDate, "CRM meeting date · time unconfirmed", "relationships", `client:${item.id}`);
  }
  for (const item of records.contacts) {
    if (item.archivedAt) continue;
    if (ownedAccounts.has(item.accountId)) add(`contact:${item.id}:followup`, item.nextAction || `Follow up · ${item.name}`, item.nextActionDue, "Contact follow-up due", "relationships", item.id);
    if (item.nurture?.state === "Active" && ownerMatchesViewer(item.nurture.owner, viewer)) add(`contact:${item.id}:nurture`, item.nurture.nextAction || `Nurture review · ${item.name}`, item.nurture.dueDate, "Nurture review due", "relationships", item.id);
  }
  return results;
}
