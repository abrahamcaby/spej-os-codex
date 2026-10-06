import type {
  AccountItem,
  ActivityItem,
  CampaignItem,
  ContactItem,
  ContentItem,
  OpportunityItem,
  PartnershipItem,
  ProjectItem,
  TaskItem,
} from "./types";
import { projectDddPhase, projectPlaybook, projectType } from "./gtm-navigation";
import { accountRelationship } from "./client-relationships";
import { evaluateOpportunityPriority } from "./opportunity-priority";
import { taskBelongsToWorkspace, taskCategoryForDisplay, taskVisibilityLabel, taskWorkspaceLabel } from "./tasks";

export type AttentionTab = "tasks" | "delivery-work" | "relationships" | "pipeline" | "partnerships" | "projects" | "campaigns" | "content";
export type AttentionSeverity = "critical" | "high" | "normal";

export type DirectorAttentionItem = {
  id: string;
  kind: "task" | "relationship" | "opportunity" | "partnership" | "project" | "campaign" | "content" | "review";
  label: string;
  title: string;
  detail: string;
  owner: string;
  due: string;
  severity: AttentionSeverity;
  tab: AttentionTab;
  recordId: string | number;
  priorityIndex?: number;
  workspaceLabel?: "GTM" | "Project Management" | "Company";
  categoryLabel?: string;
  visibilityLabel?: string;
};

type DirectorAttentionInput = {
  accounts?: AccountItem[];
  activities?: ActivityItem[];
  tasks: TaskItem[];
  contacts: ContactItem[];
  opportunities: OpportunityItem[];
  partnerships: PartnershipItem[];
  projects: ProjectItem[];
  campaigns: CampaignItem[];
  content: ContentItem[];
  now?: Date;
};

function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(value: Date, days: number) {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12);
  date.setDate(date.getDate() + days);
  return localDate(date);
}

function inAttentionWindow(value: string, today: string, end: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value <= end;
}

function severityForDate(value: string, today: string): AttentionSeverity {
  if (value && value < today) return "critical";
  if (value === today) return "high";
  return "normal";
}

function rank(value: AttentionSeverity) {
  return value === "critical" ? 0 : value === "high" ? 1 : 2;
}

function normalizedAction(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function normalizedOwner(value: string) {
  return value.trim().toLowerCase();
}

function taskDue(value: string, today: string) {
  return value === "Today" ? today : value;
}

function linkedTaskCoversAction(
  tasks: TaskItem[],
  relatedType: NonNullable<TaskItem["relatedType"]>,
  relatedId: string,
  action: string,
  owner: string,
  due: string,
  today: string,
) {
  const expectedAction = normalizedAction(action);
  const expectedOwner = normalizedOwner(owner);
  // Missing canonical fields are themselves the alert; a task cannot make those
  // fields complete, and an unassigned action cannot be safely deduplicated.
  if (!expectedAction || !due || !expectedOwner || expectedOwner === "unassigned") return false;
  return tasks.some((task) =>
    task.relatedType === relatedType &&
    task.relatedId === relatedId &&
    normalizedAction(task.title) === expectedAction &&
    Boolean(task.owner && normalizedOwner(task.owner) !== "unassigned") &&
    normalizedOwner(task.owner || "") === expectedOwner &&
    taskDue(task.due, today) === due
  );
}

export function buildDirectorAttention(input: DirectorAttentionInput) {
  const now = input.now || new Date();
  const today = localDate(now);
  const end = addDays(now, 7);
  const items: DirectorAttentionItem[] = [];
  const openTasks = input.tasks.filter((task) => !task.done);
  const accountOwners = new Map((input.accounts || []).map((account) => [account.id, account.owner]));

  for (const account of input.accounts || []) {
    if (account.archivedAt) continue;
    const profile = accountRelationship(account, { ...input, activities: input.activities || [] }, today);
    const taskSuppression = profile.suppressed.startsWith("Covered by task:");
    const coveringTask = taskSuppression ? openTasks.find((task) => String(task.id) === account.checkInTaskId) : undefined;
    const taskCoversCheckIn = Boolean(coveringTask && coveringTask.owner &&
      normalizedOwner(coveringTask.owner) !== "unassigned" &&
      normalizedOwner(coveringTask.owner) === normalizedOwner(profile.owner) &&
      taskDue(coveringTask.due, today) === profile.due);
    const suppressedByPlan = Boolean(profile.suppressed && !taskSuppression);
    if (!profile.checkInEnabled || suppressedByPlan || taskCoversCheckIn || !profile.due || profile.due > end) continue;
    items.push({ id: `check-in:${account.id}`, kind: "relationship", label: "Client / relationship check-in", title: `Check in with ${account.name}`, detail: account.checkInReason || `${profile.clientStatus} · routine relationship review`, owner: profile.owner, due: profile.due, severity: severityForDate(profile.due, today), tab: "relationships", recordId: `client:${account.id}` });
  }

  for (const task of input.tasks) {
    if (task.done) continue;
    const statusDetail = task.status && task.status !== "Not Started" ? task.status : taskCategoryForDisplay(task);
    items.push({
      id: `task:${task.id}`,
      kind: "task",
      label: "Work",
      title: task.title,
      detail: `${statusDetail} · ${task.effort || "Small"}`,
      owner: task.owner?.trim() || "Unassigned",
      due: task.due,
      severity: task.status === "Blocked" || task.due < today ? "critical" : task.status === "In Review" || task.due === today ? "high" : "normal",
      tab: taskBelongsToWorkspace(task, input.projects, "delivery") ? "delivery-work" : "tasks",
      recordId: task.id,
      workspaceLabel: taskWorkspaceLabel(task, input.projects),
      categoryLabel: taskCategoryForDisplay(task),
      visibilityLabel: taskVisibilityLabel(task),
    });
  }

  for (const contact of input.contacts) {
    const plan = contact.nurture;
    if (!contact.archivedAt && plan && plan.state !== "Ended" && plan.dueDate && inAttentionWindow(plan.dueDate, today, end) && !linkedTaskCoversAction(openTasks, "contact", contact.id, plan.nextAction, plan.owner, plan.dueDate, today)) {
      items.push({ id: `nurture:${contact.id}`, kind: "relationship", label: "Nurture review", title: `Review nurture: ${contact.name}`,
        detail: `${plan.method} · ${plan.state} · ${plan.nextAction || "Decide the next useful step"}. Review only; this does not send or resume outreach.`,
        owner: plan.owner || accountOwners.get(contact.accountId) || "Unassigned", due: plan.dueDate, severity: severityForDate(plan.dueDate, today), tab: "relationships", recordId: contact.id });
    }
    if (contact.archivedAt || !contact.nextActionDue || !inAttentionWindow(contact.nextActionDue, today, end)) continue;
    const owner = accountOwners.get(contact.accountId) || "Unassigned";
    if (linkedTaskCoversAction(openTasks, "contact", contact.id, contact.nextAction || "", owner, contact.nextActionDue, today)) continue;
    items.push({
      id: `relationship:${contact.id}`,
      kind: "relationship",
      label: "Relationship",
      title: contact.nextAction || `Move ${contact.name} forward`,
      detail: `${contact.name} · ${contact.nextActionType || "Follow up"}`,
      owner,
      due: contact.nextActionDue,
      severity: severityForDate(contact.nextActionDue, today),
      tab: "relationships",
      recordId: contact.id,
    });
  }

  for (const opportunity of input.opportunities) {
    if (opportunity.archivedAt || opportunity.stage.startsWith("Closed") || opportunity.actionState === "Completed") continue;
    const missingNextAction = !opportunity.nextSpejAction.trim() || !opportunity.nextActionDue;
    if (!missingNextAction && !inAttentionWindow(opportunity.nextActionDue, today, end)) continue;
    const owner = opportunity.owner || "Unassigned";
    if (!missingNextAction && linkedTaskCoversAction(openTasks, "opportunity", opportunity.id, opportunity.nextSpejAction, owner, opportunity.nextActionDue, today)) continue;
    const priority = evaluateOpportunityPriority(opportunity, (input.accounts || []).find((account) => account.id === opportunity.accountId), input.contacts.filter((contact) => contact.accountId === opportunity.accountId), input.activities || [], now);
    items.push({
      id: `opportunity:${opportunity.id}`,
      kind: "opportunity",
      label: "Opportunity",
      title: opportunity.nextSpejAction || `Define the next action for ${opportunity.name}`,
      detail: `${opportunity.name} · ${opportunity.stage} · ${priority.attentionTier} · ${priority.actionWindow}`,
      owner,
      due: opportunity.nextActionDue,
      severity: missingNextAction || opportunity.nextActionDue < today ? "critical" : severityForDate(opportunity.nextActionDue, today),
      tab: "pipeline",
      recordId: opportunity.id,
      priorityIndex: priority.priorityIndex ?? undefined,
    });
  }

  for (const partnership of input.partnerships) {
    if (partnership.archivedAt || partnership.stage === "Paused / Ended") continue;
    const missingNextAction = !partnership.nextAction.trim() || !partnership.dueDate;
    if (!missingNextAction && !inAttentionWindow(partnership.dueDate, today, end) && partnership.health !== "At Risk") continue;
    const owner = partnership.owner || "Unassigned";
    if (!missingNextAction && partnership.health !== "At Risk" && linkedTaskCoversAction(openTasks, "partnership", partnership.id, partnership.nextAction, owner, partnership.dueDate, today)) continue;
    items.push({
      id: `partnership:${partnership.id}`,
      kind: "partnership",
      label: "Partnership",
      title: partnership.nextAction || `Define the next commitment for ${partnership.name}`,
      detail: `${partnership.name} · ${partnership.health}`,
      owner,
      due: partnership.dueDate,
      severity: missingNextAction || partnership.health === "At Risk" || partnership.dueDate < today ? "critical" : severityForDate(partnership.dueDate, today),
      tab: "partnerships",
      recordId: partnership.id,
    });
  }

  for (const project of input.projects) {
    const adoption = project.adoptionOutcome;
    if (!project.archivedAt && project.operationalStatus !== "Stopped" && adoption?.reviewDate && inAttentionWindow(adoption.reviewDate, today, end)) {
      items.push({ id: `adoption:${project.id}`, kind: "project", label: "Adoption review",
        title: `Review adoption: ${project.name}`, detail: `${adoption.adoption} · ${adoption.blocker || adoption.measure || "Measure customer use and outcomes"}`,
        owner: adoption.owner || project.owner || "Unassigned", due: adoption.reviewDate,
        severity: adoption.adoption === "Below target" ? "critical" : severityForDate(adoption.reviewDate, today), tab: "projects", recordId: project.id });
    }
    if (project.archivedAt || ["Complete", "Stopped"].includes(project.operationalStatus)) continue;
    const missingMilestone = !project.nextMilestone.trim() || !project.dueDate;
    if (!missingMilestone && !inAttentionWindow(project.dueDate, today, end) && project.health !== "At Risk") continue;
    const owner = project.owner || "Unassigned";
    if (!missingMilestone && project.health !== "At Risk" && linkedTaskCoversAction(openTasks, "project", project.id, project.nextMilestone, owner, project.dueDate, today)) continue;
    items.push({
      id: `project:${project.id}`,
      kind: "project",
      label: "Project",
      title: project.nextMilestone || `Define the next milestone for ${project.name}`,
      detail: `${project.name} · ${projectType(project)}${projectPlaybook(project) === "Discovery / Design / Delivery" ? ` · ${projectDddPhase(project)}` : ""} · ${project.health || "Unknown"}`,
      owner,
      due: project.dueDate,
      severity: missingMilestone || project.health === "At Risk" || project.dueDate < today ? "critical" : severityForDate(project.dueDate, today),
      tab: "projects",
      recordId: project.id,
    });
  }

  for (const campaign of input.campaigns) {
    if (campaign.archivedAt || ["Paused", "Complete"].includes(campaign.status)) continue;
    const missingPlan = !campaign.objective.trim() || !campaign.successMeasure.trim() || !campaign.endDate;
    if (!missingPlan && !inAttentionWindow(campaign.endDate, today, end)) continue;
    items.push({
      id: `campaign:${campaign.id}`,
      kind: "campaign",
      label: "Campaign",
      title: missingPlan ? `Complete the campaign plan for ${campaign.name}` : `Campaign deadline: ${campaign.name}`,
      detail: `${campaign.status} · ${campaign.primaryChannel}`,
      owner: campaign.owner || "Unassigned",
      due: campaign.endDate,
      severity: missingPlan || campaign.endDate < today ? "critical" : severityForDate(campaign.endDate, today),
      tab: "campaigns",
      recordId: campaign.id,
    });
  }

  for (const item of input.content) {
    if (item.stage === "Published") continue;
    const reviewNeedsAttention = item.reviewStatus === "Pending Review" || item.reviewStatus === "Changes Requested";
    const publishNeedsAttention = Boolean(item.publishDate && inAttentionWindow(item.publishDate, today, end));
    if (!reviewNeedsAttention && !publishNeedsAttention) continue;
    const due = reviewNeedsAttention ? item.reviewDue || item.publishDate : item.publishDate;
    const owner = reviewNeedsAttention ? item.approver || "Unassigned" : item.owner || "Unassigned";
    const action = reviewNeedsAttention
      ? `${item.reviewStatus === "Changes Requested" ? "Address changes for" : "Review"} ${item.title}`
      : `Publish ${item.title}`;
    const actionDue = reviewNeedsAttention ? item.reviewDue || "" : item.publishDate;
    // Keep review alerts as review items even when an explicit task also exists;
    // otherwise the task loses the queue's review semantics and summary count.
    if (!reviewNeedsAttention && linkedTaskCoversAction(openTasks, "content", item.id, action, owner, actionDue, today)) continue;
    items.push({
      id: `${reviewNeedsAttention ? "review" : "content"}:${item.id}`,
      kind: reviewNeedsAttention ? "review" : "content",
      label: reviewNeedsAttention ? "Review" : "Content",
      title: item.title,
      detail: reviewNeedsAttention ? `${item.reviewStatus} · ${item.approver || "Unassigned reviewer"}` : `${item.stage} · ${item.format}`,
      owner,
      due,
      severity: item.reviewStatus === "Changes Requested" || (due && due < today) ? "critical" : due === today ? "high" : "normal",
      tab: "content",
      recordId: item.id,
    });
  }

  return items.sort((left, right) =>
    rank(left.severity) - rank(right.severity) ||
    (left.due || "9999-12-31").localeCompare(right.due || "9999-12-31") ||
    (right.priorityIndex || 0) - (left.priorityIndex || 0) ||
    left.title.localeCompare(right.title)
  );
}

export function summarizeDirectorAttention(items: DirectorAttentionItem[], now = new Date()) {
  const today = localDate(now);
  return {
    overdue: items.filter((item) => item.due && item.due < today).length,
    dueToday: items.filter((item) => item.due === today).length,
    reviews: items.filter((item) => item.kind === "review" || item.detail.startsWith("In Review")).length,
    blockedOrMissing: items.filter((item) => item.severity === "critical" && (!item.due || /Blocked|Define|Complete the campaign plan/.test(`${item.detail} ${item.title}`))).length,
  };
}
