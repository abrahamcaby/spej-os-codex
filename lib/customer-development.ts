import { metricDay, validMetricDate } from "./gtm-metrics";
import type { AdoptionOutcome, AiProfile, ContactItem, ContactNurture, DiscoveryEconomics } from "./types";

export const AI_MATURITY = ["Unknown", "Exploring", "Piloting", "In production", "Scaling"] as const;
export const IMPLEMENTATION_READINESS = ["Unknown", "Needs foundations", "Partly ready", "Ready for scoped work"] as const;
export const AI_CONCERNS = ["Unknown", "Security / governance", "Cost / ROI", "Adoption", "Data readiness", "Capability / capacity", "Other"] as const;
export const NURTURE_METHODS = ["Personal", "Campaign", "Coordinated mix"] as const;
export const NURTURE_STATES = ["Active", "Paused", "Ended"] as const;
export const NURTURE_CHANNELS = ["Email", "LinkedIn", "Call", "Meeting", "Introduction", "Event", "Other"] as const;
const obj = (value: unknown): Record<string, unknown> | undefined => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const text = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 2000) : "";
const pick = <T extends string>(value: unknown, choices: readonly T[], fallback: T): T => choices.includes(value as T) ? value as T : fallback;
const date = (value: unknown) => validMetricDate(text(value)) ? text(value) : "";
const past = (value: unknown) => date(value) <= metricDay() ? date(value) : "";

export function cleanAiProfile(value: unknown): AiProfile | undefined {
  const item = obj(value); if (!item) return undefined;
  const evidence = text(item.evidence), reviewer = text(item.reviewer);
  return {
    usage: text(item.usage), maturity: pick(item.maturity, AI_MATURITY, "Unknown"),
    implementationReadiness: pick(item.implementationReadiness, IMPLEMENTATION_READINESS, "Unknown"),
    primaryConcern: pick(item.primaryConcern, AI_CONCERNS, "Unknown"), otherConcerns: text(item.otherConcerns),
    nextQuestion: text(item.nextQuestion), evidence, evidenceDate: past(item.evidenceDate), reviewer,
    reviewStatus: item.reviewStatus === "Human reviewed" && evidence && reviewer ? "Human reviewed" : "Needs review",
  };
}

export function cleanContactNurture(value: unknown, accountId: unknown, email: unknown): ContactNurture | undefined {
  const item = obj(value); if (!item) return undefined;
  const method = pick(item.method, NURTURE_METHODS, "Personal");
  const bound = text(item.eligibilityAccountId) === text(accountId) && text(item.eligibilityEmail).toLowerCase() === text(email).toLowerCase();
  const eligibilityEvidence = text(item.eligibilityEvidence);
  const eligibility = pick(item.emailEligibility, ["Unknown", "Reviewed eligible", "Ineligible"] as const, "Unknown");
  const emailEligibility = eligibility === "Reviewed eligible" && (!bound || !text(email) || !text(accountId) || !eligibilityEvidence) ? "Unknown" : eligibility;
  const state = pick(item.state, NURTURE_STATES, "Paused");
  const complete = text(item.owner) && text(item.nextAction) && (date(item.dueDate) || text(item.trigger)) && (method === "Personal" || (text(item.campaign) && emailEligibility === "Reviewed eligible"));
  return {
    method, state: state === "Active" && !complete ? "Paused" : state,
    owner: text(item.owner), channel: pick(item.channel, NURTURE_CHANNELS, "Email"), campaign: text(item.campaign),
    nextAction: text(item.nextAction), dueDate: date(item.dueDate), trigger: text(item.trigger), coordination: text(item.coordination),
    emailEligibility, eligibilityEvidence, eligibilityAccountId: text(item.eligibilityAccountId), eligibilityEmail: text(item.eligibilityEmail),
  };
}

/** Contact rules can only restrict the account-level guard. No outbound send is implemented here. */
export function contactOutreachGuard(contact: ContactItem, accountGuard: { blocked: boolean; reasons: string[] }) {
  const reasons = [...accountGuard.reasons];
  const plan = cleanContactNurture(contact.nurture, contact.accountId, contact.email);
  if (plan?.state === "Paused" || plan?.state === "Ended") reasons.push(`This person's nurture plan is ${plan.state.toLowerCase()}.`);
  if (plan?.method === "Campaign") reasons.push("Campaign-only plan: coordinate with the campaign owner before personal outreach.");
  return { blocked: accountGuard.blocked || reasons.length > 0, reasons };
}

export function cleanAdoptionOutcome(value: unknown): AdoptionOutcome | undefined {
  const item = obj(value); if (!item) return undefined;
  const supported = Boolean(text(item.evidence) && text(item.owner));
  const acceptance = pick(item.technicalAcceptance, ["Unknown", "Not accepted", "Accepted"] as const, "Unknown");
  const adoption = pick(item.adoption, ["Unknown", "Not started", "Testing", "Below target", "On target"] as const, "Unknown");
  return {
    technicalAcceptance: acceptance === "Accepted" && !supported ? "Unknown" : acceptance,
    adoption: adoption === "On target" && (!supported || !text(item.measure) || !text(item.target) || !text(item.observed)) ? "Unknown" : adoption,
    measure: text(item.measure), baseline: text(item.baseline), target: text(item.target), observed: text(item.observed),
    evidence: text(item.evidence), evidenceDate: past(item.evidenceDate), owner: text(item.owner), reviewDate: date(item.reviewDate), blocker: text(item.blocker),
  };
}

export function cleanDiscoveryEconomics(value: unknown): DiscoveryEconomics | undefined {
  const item = obj(value); if (!item) return undefined;
  const budgetEvidence = text(item.budgetEvidence);
  const status = pick(item.budgetStatus, ["Unknown", "Discussing", "Customer confirmed", "Not funded"] as const, "Unknown");
  return { budgetStatus: status === "Customer confirmed" && !budgetEvidence ? "Unknown" : status, budgetEvidence,
    deliveryCapacity: pick(item.deliveryCapacity, ["Unknown", "Needs review", "Available", "Constrained"] as const, "Unknown"),
    discoveryEffort: text(item.discoveryEffort), nextQuestion: text(item.nextQuestion) };
}
