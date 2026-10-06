import type { AccountItem, OpportunityItem, PartnershipItem, ProjectItem } from "./types";

export const SALES_ROUTES = ["Unclassified", "Direct", "Partner-sourced", "Co-sell"] as const;
export const PARTNER_CATEGORIES = ["Unclassified", "Affiliate / referrer", "MSP", "IT services provider", "Technology partner", "Delivery partner", "Strategic partner", "Other"] as const;
export const SALES_MOTIONS = ["AI Office", "Plooms", "Individual Project", "MSP / Partner", "Other"] as const;
export const PROJECT_WORK_AREAS = ["Unclassified", "Client Delivery", "GTM", "Product", "Internal Operations"] as const satisfies readonly NonNullable<ProjectItem["workArea"]>[];
export const PROJECT_TYPES = ["Unclassified", "AI Office", "Plooms", "Client Project", "Event", "Marketing / Media", "Partner Enablement", "Product Development", "Internal Initiative", "Other"] as const satisfies readonly NonNullable<ProjectItem["projectType"]>[];
export const PROJECT_PLAYBOOKS = ["Not set", "Discovery / Design / Delivery", "AI Office Delivery", "Plooms Implementation", "Event Production", "Marketing / Media", "Partner Enablement", "Product Development", "Custom"] as const satisfies readonly NonNullable<ProjectItem["playbook"]>[];
export const PROJECT_DDD_PHASES = ["Not Applicable", "Discovery", "Design", "Delivery"] as const satisfies readonly ProjectItem["phase"][];

export function projectDefaults(projectType: NonNullable<ProjectItem["projectType"]>) {
  const defaults: Record<NonNullable<ProjectItem["projectType"]>, Pick<Required<ProjectItem>, "workArea" | "playbook" | "phase">> = {
    "AI Office": { workArea: "Client Delivery", playbook: "AI Office Delivery", phase: "Not Applicable" },
    Plooms: { workArea: "Client Delivery", playbook: "Plooms Implementation", phase: "Not Applicable" },
    "Client Project": { workArea: "Client Delivery", playbook: "Discovery / Design / Delivery", phase: "Discovery" },
    Event: { workArea: "GTM", playbook: "Event Production", phase: "Not Applicable" },
    "Marketing / Media": { workArea: "GTM", playbook: "Marketing / Media", phase: "Not Applicable" },
    "Partner Enablement": { workArea: "GTM", playbook: "Partner Enablement", phase: "Not Applicable" },
    "Product Development": { workArea: "Product", playbook: "Product Development", phase: "Not Applicable" },
    "Internal Initiative": { workArea: "Internal Operations", playbook: "Not set", phase: "Not Applicable" },
    Other: { workArea: "Unclassified", playbook: "Not set", phase: "Not Applicable" },
    Unclassified: { workArea: "Unclassified", playbook: "Not set", phase: "Not Applicable" },
  };
  return defaults[projectType];
}
export const OFFERING_LABELS: Record<NonNullable<OpportunityItem["motion"]>, string> = { "AI Office": "AI Office", Plooms: "Plooms", "Individual Project": "Client projects", "MSP / Partner": "MSP / Partner (legacy motion)", Other: "Other / unclassified" };
export const OFFERING_LANES = [
  { motion: "AI Office", title: "AI Office", description: "Direct adoption programs or sales through MSPs, IT providers and affiliates." },
  { motion: "Plooms", title: "Plooms", description: "Spej’s private, open-weight AI platform: product opportunities and adoption." },
  { motion: "Individual Project", title: "Client projects", description: "Project-based client engagements: Discovery, Design and Delivery." },
] as const;

export function filterSalesOpportunities(items: OpportunityItem[], accounts: AccountItem[], filters: { stage: string; motion: string; phase: string; route: string; query: string; acquisition?: string }) {
  return items.filter((item) => {
    if (item.archivedAt) return false;
    if (filters.acquisition && (item.acquisitionMotion || "Unclassified") !== filters.acquisition) return false;
    const closed = item.stage.startsWith("Closed");
    const matchesStage = filters.stage === "All" || (filters.stage === "Active" && !closed) || filters.stage === item.stage || (filters.stage === "Needs next step" && !closed && (item.actionState === "Completed" || !item.nextSpejAction || !item.nextActionDue));
    const haystack = `${item.name} ${accounts.find((account) => account.id === item.accountId)?.name || ""} ${item.source} ${item.motion || ""} ${item.painPoint || ""}`.toLowerCase();
    return matchesStage && (!filters.motion || (item.motion || "Other") === filters.motion) && (!filters.phase || (item.engagementPhase || "Not Applicable") === filters.phase) && (!filters.route || (item.salesRoute || "Unclassified") === filters.route) && haystack.includes(filters.query.trim().toLowerCase());
  });
}

export function projectWorkArea(item: ProjectItem): NonNullable<ProjectItem["workArea"]> {
  if (item.workArea) return item.workArea;
  return item.phase === "Internal" ? "GTM" : "Client Delivery";
}

export function projectType(item: ProjectItem): NonNullable<ProjectItem["projectType"]> {
  if (item.projectType) return item.projectType;
  return item.phase === "Internal" ? "Internal Initiative" : "Client Project";
}

export function projectPlaybook(item: ProjectItem): NonNullable<ProjectItem["playbook"]> {
  if (item.playbook) return item.playbook;
  return item.phase === "Internal" ? "Not set" : "Discovery / Design / Delivery";
}

export function projectDddPhase(item: ProjectItem): ProjectItem["phase"] {
  return item.phase === "Internal" ? "Not Applicable" : item.phase;
}

export function filterGtmProjects(items: ProjectItem[], scope: string, phase: string, status: string, type = "") {
  return items.filter((item) => {
    if (item.archivedAt) return false;
    const workArea = projectWorkArea(item);
    const matchesScope = scope === "All" || scope === "All projects"
      || (scope === "Client projects" && workArea === "Client Delivery")
      || (scope === "Internal GTM" && workArea === "GTM")
      || workArea === scope;
    return matchesScope && (!phase || projectDddPhase(item) === phase) && (!status || item.operationalStatus === status) && (!type || projectType(item) === type);
  });
}

export function filterGtmPartners(items: PartnershipItem[], category: string, stage: string, query: string) {
  return items.filter((item) => !item.archivedAt && (!category || (item.partnerCategory || "Unclassified") === category) && (!stage || item.stage === stage) && `${item.name} ${item.type} ${item.owner} ${item.notes}`.toLowerCase().includes(query.trim().toLowerCase()));
}
