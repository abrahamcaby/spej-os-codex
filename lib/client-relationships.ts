import type { AccountItem, ActivityItem, ContactItem, OpportunityItem, PartnershipItem, ProjectItem, TaskItem } from "./types";
import { metricDay, validMetricDate } from "./gtm-metrics";
import { outreachGuard } from "./relationship-context";

export const CLIENT_STATUSES = ["Unclassified", "Not a client", "Current client", "Past client"] as const;
export const CHECK_IN_CADENCES = ["Not set", "One-time", "30 days", "60 days", "90 days"] as const;
export const OUTREACH_PREFERENCES = ["Allowed", "No proactive outreach"] as const;
export const RELATIONSHIP_VIEWS = ["All relationships", "Current clients", "Past clients", "Active opportunities", "Prospecting", "Partners & network", "Check-ins due", "Needs classification"] as const;
export type RelationshipView = typeof RELATIONSHIP_VIEWS[number];
export type ClientRecords = {
  contacts: ContactItem[]; activities: ActivityItem[]; opportunities: OpportunityItem[];
  projects: ProjectItem[]; partnerships: PartnershipItem[]; tasks: TaskItem[];
};

/** Calendar days, not 24-hour durations: stable across DST and month boundaries. */
export function addRelationshipDays(value: string, days: number) {
  if (!validMetricDate(value)) return "";
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function taskBelongsToAccount(task: TaskItem, accountId: string, records: Pick<ClientRecords, "contacts" | "opportunities" | "projects" | "partnerships">) {
  if (task.relatedType === "account") return task.relatedId === accountId;
  const linked = task.relatedType === "contact" ? records.contacts : task.relatedType === "opportunity" ? records.opportunities : task.relatedType === "project" ? records.projects : task.relatedType === "partnership" ? records.partnerships : [];
  return linked.some((item) => !item.archivedAt && item.id === task.relatedId && item.accountId === accountId);
}

export function accountRelationship(account: AccountItem, records: ClientRecords, today = metricDay()) {
  const people = records.contacts.filter((item) => !item.archivedAt && item.accountId === account.id);
  const opportunities = records.opportunities.filter((item) => !item.archivedAt && item.accountId === account.id);
  const openOpportunities = opportunities.filter((item) => !item.stage.startsWith("Closed"));
  const projects = records.projects.filter((item) => !item.archivedAt && item.accountId === account.id);
  // Shaping/proposed work is not proof of an active paying client.
  const currentProjects = projects.filter((item) => item.commercialStatus === "Contracted" && !["Complete", "Stopped"].includes(item.operationalStatus));
  const completedProjects = projects.filter((item) => item.operationalStatus === "Complete");
  const partnerships = records.partnerships.filter((item) => !item.archivedAt && item.accountId === account.id);
  const partner = Boolean(account.isPartner || account.type === "Partner" || partnerships.length);
  const clientStatus = account.clientStatus || "Unclassified";
  const hasClientHistory = clientStatus === "Current client" || clientStatus === "Past client" || account.type === "Client" || currentProjects.length > 0 || completedProjects.length > 0 || opportunities.some((item) => item.stage === "Closed Won");
  const needsClassification = clientStatus === "Unclassified" && hasClientHistory;
  const statusConflict = (clientStatus === "Past client" || clientStatus === "Not a client") && currentProjects.length > 0;
  const activities = records.activities.filter((item) => !item.archivedAt && (item.accountId === account.id || (!item.accountId && people.some((person) => person.id === item.contactId))))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const meaningfulDates = activities.filter((item) => item.sourceDateKnown !== false && (item.metricType === "Check-in completed" || (["Client relationship", "Partner relationship"].includes(item.purpose || "") && ["Meeting held", "Call connected", "Incoming call connected"].includes(item.metricType || ""))) && validMetricDate(item.occurredAt) && item.occurredAt <= today).map((item) => item.occurredAt);
  const lastContact = [account.lastCheckIn || "", ...meaningfulDates].filter((date) => validMetricDate(date) && date <= today).sort().at(-1) || "";
  const cadence = account.checkInCadence || "Not set";
  const days = cadence === "30 days" ? 30 : cadence === "60 days" ? 60 : cadence === "90 days" ? 90 : 0;
  let due = validMetricDate(account.nextCheckIn) ? account.nextCheckIn! : "";
  const completedOneTime = cadence === "One-time" && Boolean(due && lastContact && lastContact >= due);
  // An actual completed conversation on/after a planned check-in closes that cycle.
  if (lastContact && (!due || lastContact >= due)) due = days ? addRelationshipDays(lastContact, days) : "";
  const coverageTask = records.tasks.find((task) => String(task.id) === account.checkInTaskId && !task.done && taskBelongsToAccount(task, account.id, records) && validMetricDate(task.due) && task.due <= addRelationshipDays(today, 7));
  const meetingCovers = validMetricDate(account.nextMeetingDate) && Boolean(due && due <= account.nextMeetingDate!) && account.nextMeetingDate! >= today && account.nextMeetingDate! <= addRelationshipDays(today, 7);
  const outreach = outreachGuard(account, records.activities, today);
  // Only the derived routine prompt is paused. Saved actions/tasks retain their
  // dates and completion state, including when a hold's review date has passed.
  const suppressed = outreach.blocked ? outreach.reasons.join(" ") : coverageTask ? `Covered by task: ${coverageTask.title}` : meetingCovers ? `Meeting planned: ${account.nextMeetingDate}` : "";
  const checkInEnabled = cadence !== "Not set" && !account.archivedAt;
  return { account, clientStatus, hasClientHistory, needsClassification, statusConflict, partner, people, opportunities, openOpportunities, projects, currentProjects, completedProjects, partnerships, activities, lastContact, due, checkInEnabled, completedOneTime, suppressed,
    checkInDue: checkInEnabled && !suppressed && Boolean(due && due <= today),
    needsPlanDate: checkInEnabled && !due && !completedOneTime,
    owner: account.checkInOwner || account.owner || "Unassigned",
  };
}

export function matchesRelationshipView(profile: ReturnType<typeof accountRelationship>, view: RelationshipView) {
  if (profile.account.archivedAt) return false;
  if (view === "Current clients") return profile.clientStatus === "Current client";
  if (view === "Past clients") return profile.clientStatus === "Past client";
  if (view === "Active opportunities") return profile.openOpportunities.length > 0;
  if (view === "Prospecting") return profile.account.type === "Prospect" && !profile.hasClientHistory && profile.openOpportunities.length === 0;
  if (view === "Partners & network") return profile.partner || profile.account.type === "Network";
  if (view === "Check-ins due") return profile.checkInDue;
  if (view === "Needs classification") return profile.needsClassification || profile.statusConflict;
  return true;
}

/** Reject newly introduced contradictions; legacy ambiguity is left for review. */
export function clientPlanIssues(account: AccountItem, records: ClientRecords) {
  const issues: string[] = [];
  if (account.checkInContactId && !records.contacts.some((item) => !item.archivedAt && item.id === account.checkInContactId && item.accountId === account.id)) issues.push("The check-in person must belong to this account.");
  if (account.checkInTaskId && !records.tasks.some((task) => String(task.id) === account.checkInTaskId && taskBelongsToAccount(task, account.id, records))) issues.push("Choose a covering task linked to this account or one of its people, deals, partnerships or projects.");
  if (accountRelationship(account, records).statusConflict) issues.push("This account still has contracted project work open. Review those engagements before marking it as a past client or not a client.");
  if (account.checkInCadence === "One-time" && !validMetricDate(account.nextCheckIn)) issues.push("Choose a date for the one-time check-in.");
  else if (account.checkInCadence && account.checkInCadence !== "Not set" && account.outreachPreference !== "No proactive outreach" && !validMetricDate(account.nextCheckIn) && !validMetricDate(account.lastCheckIn) && !accountRelationship(account, records).lastContact) issues.push("Set the first check-in date or record a past meaningful conversation to start the plan.");
  return issues;
}

export function clientPlanIssue(account: AccountItem, records: ClientRecords) { return clientPlanIssues(account, records)[0] || ""; }
