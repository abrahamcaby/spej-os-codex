import type { CampaignItem, OpportunityItem, ProjectItem } from "./types";

type CampaignReadinessInput = Pick<
  CampaignItem,
  "status" | "objective" | "audience" | "owner" | "startDate" | "endDate" | "successMeasure"
>;

type OpportunityReadinessInput = Pick<
  OpportunityItem,
  "stage" | "accountId" | "owner" | "nextSpejAction" | "nextActionDue" | "painPoint" | "desiredOutcome" | "value" | "closeDate" | "notes"
>;

type ProjectReadinessInput = Pick<
  ProjectItem,
  "operationalStatus" | "workArea" | "projectType" | "playbook" | "owner" | "startDate" | "endDate" | "nextMilestone" | "dueDate" | "successMeasure"
>;

function blank(value: string | undefined) {
  const normalized = value?.trim().toLocaleLowerCase("en-US");
  return !normalized || normalized === "unassigned";
}

function missingMessage(record: string, state: string, fields: string[]) {
  if (!fields.length) return null;
  return `Before marking this ${record} ${state}, add: ${fields.join(", ")}.`;
}

/** Planning remains a lightweight intake state; activation requires an executable brief. */
export function campaignPromotionIssue(input: CampaignReadinessInput) {
  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    return "Campaign end date cannot be before its start date.";
  }
  if (input.status !== "Active" && input.status !== "Complete") return null;
  const missing = [
    blank(input.objective) && "business objective",
    blank(input.audience) && "audience",
    blank(input.owner) && "owner",
    blank(input.startDate) && "start date",
    blank(input.successMeasure) && "success measure",
    input.status === "Complete" && blank(input.endDate) && "end date",
  ].filter((field): field is string => Boolean(field));
  return missingMessage("campaign", input.status.toLowerCase(), missing);
}

/** Explore is the opportunity intake state; later stages must have accountable next steps. */
export function opportunityPromotionIssue(input: OpportunityReadinessInput) {
  if (input.stage === "Explore") return null;

  if (input.stage === "Closed Lost") {
    const missing = [
      blank(input.accountId) && "account",
      blank(input.owner) && "owner",
      blank(input.notes) && "loss reason in commercial context",
    ].filter((field): field is string => Boolean(field));
    return missingMessage("opportunity", "closed lost", missing);
  }

  const missing = [
    blank(input.accountId) && "account",
    blank(input.owner) && "owner",
  ];
  const isOpen = input.stage !== "Closed Won";
  if (isOpen) {
    missing.push(blank(input.nextSpejAction) && "next Spej action");
    missing.push(blank(input.nextActionDue) && "next-action due date");
  }
  if (["Qualify", "Shape & Estimate", "Proposal & Decision", "Contracting", "Closed Won"].includes(input.stage)) {
    missing.push(blank(input.painPoint) && "customer problem");
    missing.push(blank(input.desiredOutcome) && "desired outcome");
  }
  if (["Proposal & Decision", "Contracting", "Closed Won"].includes(input.stage)) {
    missing.push(!(input.value > 0) && "estimated contract value");
    missing.push(blank(input.closeDate) && "close date");
  }
  return missingMessage(
    "opportunity",
    input.stage === "Closed Won" ? "closed won" : `in ${input.stage}`,
    missing.filter((field): field is string => Boolean(field)),
  );
}

/** Not Started remains a project intake state; execution requires an operating plan. */
export function projectPromotionIssue(input: ProjectReadinessInput) {
  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    return "Project target completion cannot be before its start date.";
  }
  if (!["Mobilizing", "Active", "At Gate", "Complete"].includes(input.operationalStatus)) return null;

  const missing = [
    (!input.workArea || input.workArea === "Unclassified") && "area",
    (!input.projectType || input.projectType === "Unclassified") && "type",
    blank(input.owner) && "owner",
    blank(input.startDate) && "start date",
  ];
  if (["Active", "At Gate", "Complete"].includes(input.operationalStatus)) {
    missing.push((!input.playbook || input.playbook === "Not set") && "project workflow");
    missing.push(blank(input.successMeasure) && "success measure");
  }
  if (["Active", "At Gate"].includes(input.operationalStatus)) {
    missing.push(blank(input.nextMilestone) && "next milestone");
    missing.push(blank(input.dueDate) && "milestone due date");
  }
  if (input.operationalStatus === "Complete") missing.push(blank(input.endDate) && "target completion date");
  return missingMessage(
    "project",
    input.operationalStatus === "At Gate" ? "awaiting review" : input.operationalStatus.toLowerCase(),
    missing.filter((field): field is string => Boolean(field)),
  );
}

export function projectTaskLinkIssue(input: {
  projectWorkspace: boolean;
  parentId?: string;
  projectId?: string;
  projects: readonly Pick<ProjectItem, "id" | "archivedAt" | "operationalStatus" | "workArea">[];
}) {
  if (!input.projectWorkspace) return null;
  if (!input.projectId) {
    if (input.parentId) return "The parent task needs a project link before you can add a subtask.";
    const hasEligibleProject = input.projects.some((project) =>
      !project.archivedAt && project.workArea !== "GTM" && !["Complete", "Paused", "Stopped"].includes(project.operationalStatus),
    );
    return hasEligibleProject
      ? "Select a project before saving Project work."
      : "Create an active project before adding Project work.";
  }
  const project = input.projects.find((candidate) => candidate.id === input.projectId);
  if (!project || project.archivedAt) return "Choose an available project before saving Project work.";
  if (project.workArea === "GTM") return "Choose a Projects workspace record, not a GTM initiative.";
  if (["Complete", "Paused", "Stopped"].includes(project.operationalStatus)) return "Choose an active project before saving Project work.";
  return null;
}
