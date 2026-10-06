import type { AccountItem, ContactItem, OpportunityItem, ProjectItem } from "./types";
import { projectDefaults } from "./gtm-navigation";

export type DeliveryContext = NonNullable<ProjectItem["deliveryContext"]>;
export const DELIVERY_CONTEXT_LABELS: Record<keyof DeliveryContext, string> = {
  scope: "Agreed scope", deliverables: "Agreed deliverables", startConditions: "Start conditions",
  customerCounterpart: "Customer counterpart", commitments: "Customer and Spej commitments",
  openQuestions: "Open questions", expansionIdeas: "Future expansion (outside committed scope)",
  verifiedOutcomes: "Verified delivery outcomes", sourceEvidence: "Commercial evidence / document reference",
};

export function deliveryHandoffIssue(opportunity: OpportunityItem | undefined, account: AccountItem | undefined, context: DeliveryContext, projects: ProjectItem[]) {
  if (!opportunity || opportunity.archivedAt || opportunity.stage !== "Closed Won") return "Choose an available won opportunity.";
  if (!account || account.archivedAt || account.id !== opportunity.accountId) return "The won opportunity needs an available account.";
  if (projects.some((item) => item.opportunityId === opportunity.id)) return "This opportunity already has a delivery tracker. Review the existing project, including archived work.";
  if (!opportunity.owner.trim() || opportunity.owner === "Unassigned") return "Assign the opportunity owner before preparing delivery.";
  for (const key of ["scope", "deliverables", "startConditions", "customerCounterpart", "sourceEvidence"] as const) {
    if (!context[key]?.trim()) return `Add ${DELIVERY_CONTEXT_LABELS[key].toLowerCase()} before creating the delivery tracker.`;
  }
  return "";
}

/** A reviewed won deal creates one tracker. Creation never records an actual start. */
export function createDeliveryHandoff(opportunity: OpportunityItem, account: AccountItem, context: DeliveryContext, projects: ProjectItem[], now = new Date().toISOString()): ProjectItem {
  const issue = deliveryHandoffIssue(opportunity, account, context, projects);
  if (issue) throw new Error(issue);
  const type = opportunity.motion === "AI Office" ? "AI Office" : opportunity.motion === "Plooms" ? "Plooms" : "Client Project";
  const defaults = projectDefaults(type);
  return {
    id: `delivery-${opportunity.id}`, accountId: account.id, opportunityId: opportunity.id,
    name: `${opportunity.name} — delivery`, projectType: type, workArea: "Client Delivery",
    playbook: defaults.playbook, phase: defaults.phase, commercialStatus: "Contracted", operationalStatus: "Not Started",
    owner: opportunity.owner, ownerProfileId: opportunity.ownerProfileId, health: "Unknown",
    startDate: "", endDate: "", nextMilestone: "Confirm start conditions with the customer", dueDate: "",
    successMeasure: opportunity.desiredOutcome || "", risk: "", deliveryContext: context,
    notes: `Customer problem: ${opportunity.painPoint || "Not recorded"}\nAccount brief and original source remain on the linked account.`,
    createdAt: now, updatedAt: now,
  };
}

export function handoffCounterpart(opportunity: OpportunityItem | undefined, contacts: ContactItem[]) {
  return contacts.find((item) => !item.archivedAt && item.id === opportunity?.primaryContactId && item.accountId === opportunity?.accountId)?.name || "";
}
