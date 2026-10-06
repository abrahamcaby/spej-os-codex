import type { AccountItem, ActivityItem, ContactItem, OpportunityItem } from "./types";
import { metricDay, validMetricDate } from "./gtm-metrics";
import { outreachGuard } from "./relationship-context";

export const PRIORITY_SCORING_VERSION = "1.1";

export type AttentionTier = "Strategic" | "Priority" | "Standard" | "Light-touch" | "Needs inputs" | "Closed";
export type ActionWindow = "Act now" | "This week" | "Scheduled" | "Nurture" | "Needs scheduling" | "Closed";

export type OpportunityPriority = {
  strategicValue: number | null;
  winReadiness: number | null;
  actionUrgency: number | null;
  confidence: number;
  attentionTier: AttentionTier;
  actionWindow: ActionWindow;
  recommendedCadence: string;
  priorityIndex: number | null;
  reasons: string[];
  missingInputs: string[];
  scoringVersion: string;
};

type WeightedFactor = { score?: number; weight: number; confidence?: number };

function bounded(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function weightedMean(factors: WeightedFactor[]) {
  const known = factors.filter((factor) => Number.isFinite(factor.score));
  if (!known.length) return null;
  const total = known.reduce((sum, factor) => sum + factor.weight, 0);
  return bounded(known.reduce((sum, factor) => sum + (factor.score || 0) * factor.weight, 0) / total);
}

function coverage(factors: WeightedFactor[]) {
  const total = factors.reduce((sum, factor) => sum + factor.weight, 0);
  const known = factors.filter((factor) => Number.isFinite(factor.score));
  if (!total || !known.length) return 0;
  return known.reduce((sum, factor) => sum + factor.weight * (factor.confidence ?? 0.75), 0) / total;
}

function band(value: number | undefined, bands: Array<[number, number]>) {
  if (!Number.isFinite(value) || Number(value) < 0) return undefined;
  for (const [minimum, score] of bands) if (Number(value) >= minimum) return score;
  return 0;
}

function choice<T extends string>(value: T | undefined, scores: Partial<Record<T, number>>) {
  if (!value || value === "Unknown") return undefined;
  return scores[value];
}

function dayNumber(value: string) {
  if (!validMetricDate(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const millis = Date.UTC(year, month - 1, day);
  return Number.isFinite(millis) ? Math.floor(millis / 86_400_000) : undefined;
}

function localDay(now: Date) {
  return dayNumber(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`) || 0;
}

function dueScore(value: string, now: Date) {
  const due = dayNumber(value);
  if (due === undefined) return undefined;
  const days = due - localDay(now);
  if (days < 0) return 100;
  if (days <= 2) return 95;
  if (days <= 7) return 82;
  if (days <= 14) return 68;
  if (days <= 30) return 52;
  if (days <= 90) return 32;
  return 15;
}

function activityRecency(activities: ActivityItem[], opportunity: OpportunityItem, now: Date) {
  const today = localDay(now);
  const exchanges: Array<ActivityItem["metricType"]> = ["Reply received", "Meeting held", "Call connected", "Check-in completed"];
  const linked = activities.filter((item) => !item.archivedAt
    && item.sourceDateKnown !== false
    && exchanges.includes(item.metricType)
    && (!item.accountId || item.accountId === opportunity.accountId)
    && (item.opportunityId
      ? item.opportunityId === opportunity.id
      : Boolean(opportunity.primaryContactId && item.contactId === opportunity.primaryContactId)));
  // Capture/import time and seller activity cannot renew buyer engagement.
  const dates = linked.map((item) => dayNumber(item.occurredAt)).filter((value): value is number => value !== undefined && value <= today);
  if (!dates.length) return undefined;
  const days = today - Math.max(...dates);
  if (days <= 7) return 100;
  if (days <= 14) return 82;
  if (days <= 30) return 62;
  if (days <= 60) return 40;
  if (days <= 90) return 22;
  return 8;
}

function valueEvidenceConfidence(value: OpportunityItem["valueConfidence"]) {
  return value === "Contracted" ? 1 : value === "Validated" ? 0.9 : value === "Rough estimate" ? 0.65 : 0.35;
}

function actionWindow(opportunity: OpportunityItem, urgency: number | null, now: Date): ActionWindow {
  if (opportunity.stage.startsWith("Closed")) return "Closed";
  if (opportunity.actionState === "Completed") return "Needs scheduling";
  const due = dayNumber(opportunity.nextActionDue);
  const days = due === undefined ? undefined : due - localDay(now);
  if (days !== undefined && days <= 2) return "Act now";
  if (days !== undefined && days <= 7) return "This week";
  if (!opportunity.nextActionDue || !opportunity.nextSpejAction.trim()) return "Needs scheduling";
  if ((urgency || 0) >= 55 || ["Active buying", "Commercial commitment"].includes(opportunity.seriousness || "")) return "Scheduled";
  return "Nurture";
}

function actionLabel(state: OpportunityItem["actionState"]) {
  if (state === "Agreed" || state === "Scheduled") return "agreed commitment";
  if (state === "Suggested") return "suggested next action";
  if (state === "Assigned") return "assigned next action";
  return "recorded next action";
}

function tierCadence(tier: AttentionTier, window: ActionWindow, state: OpportunityItem["actionState"]) {
  if (window === "Closed") return "No active follow-up";
  if (state === "Completed") return "Review the completed action's outcome and choose the next step";
  const verb = state === "Agreed" || state === "Scheduled" || state === "Assigned" ? "Complete" : "Review";
  if (window === "Act now") return `${verb} the ${actionLabel(state)} today`;
  if (window === "This week") return `${verb} the ${actionLabel(state)} this week`;
  if (window === "Needs scheduling") return "Qualify the missing facts and set one dated next action";
  if (tier === "Strategic") return "Weekly executive attention";
  if (tier === "Priority") return "Weekly review";
  if (tier === "Standard") return "Review every two weeks";
  if (tier === "Light-touch") return "Monthly or trigger-based follow-up";
  return "Complete the missing priority inputs";
}

export function evaluateOpportunityPriority(
  opportunity: OpportunityItem,
  account?: AccountItem,
  accountContacts: ContactItem[] = [],
  relatedActivities: ActivityItem[] = [],
  now = new Date(),
): OpportunityPriority {
  if (opportunity.stage.startsWith("Closed")) return {
    strategicValue: null, winReadiness: null, actionUrgency: null, confidence: 100,
    attentionTier: "Closed", actionWindow: "Closed", recommendedCadence: "No active follow-up",
    priorityIndex: null, reasons: ["The opportunity is closed."], missingInputs: [], scoringVersion: PRIORITY_SCORING_VERSION,
  };

  const amount = opportunity.value > 0 ? opportunity.value : undefined;
  const annual = (opportunity.annualRevenuePotential || 0) > 0 ? opportunity.annualRevenuePotential : undefined;
  const valueConfidence = valueEvidenceConfidence(opportunity.valueConfidence);
  const strategicFactors: WeightedFactor[] = [
    { score: band(amount, [[2_000_000, 100], [1_000_000, 93], [500_000, 84], [250_000, 74], [100_000, 62], [50_000, 51], [25_000, 41], [10_000, 31], [1, 20]]), weight: 30, confidence: valueConfidence },
    { score: band(annual, [[1_000_000, 100], [500_000, 91], [250_000, 82], [100_000, 72], [50_000, 61], [25_000, 50], [10_000, 36], [1, 20]]), weight: 25, confidence: valueConfidence },
    { score: choice(opportunity.expansionPotential, { Low: 25, Medium: 60, High: 95 }), weight: 15 },
    { score: choice(opportunity.strategicFit, { Low: 20, Medium: 60, High: 95 }), weight: 20 },
    { score: choice(account?.companySizeBand, { "1-49": 20, "50-249": 42, "250-999": 65, "1,000-4,999": 84, "5,000+": 100 }), weight: 10 },
  ];

  const primary = accountContacts.find((contact) => !contact.archivedAt && contact.accountId === opportunity.accountId && contact.id === opportunity.primaryContactId);
  const stageScores: Record<OpportunityItem["stage"], number> = { Explore: 20, Validate: 32, Qualify: 48, "Shape & Estimate": 63, "Proposal & Decision": 78, Contracting: 92, "Closed Won": 100, "Closed Lost": 0 };
  const forecastScore = opportunity.forecast === "Contracted" ? 100 : opportunity.forecast === "Commit" ? 88 : opportunity.forecast === "Best Case" ? 68 : opportunity.forecast === "Pipeline" ? 48 : opportunity.forecast === "Lost" ? 0 : 25;
  const readinessFactors: WeightedFactor[] = [
    // Relationship warmth and an unverified problem note are not buying signals.
    { score: choice(opportunity.seriousness, { Exploratory: 20, Engaged: 48, "Active buying": 78, "Commercial commitment": 100 }), weight: 40 },
    { score: choice(opportunity.decisionAccess, { "No direct access": 10, Influencer: 35, Champion: 62, "Decision maker": 86, "Economic buyer": 100 }), weight: 30 },
    { score: choice(opportunity.stakeholderCoverage, { "Single-threaded": 25, "Multi-threaded": 72, "Buying group mapped": 100 }), weight: 20 },
    { score: Math.round((stageScores[opportunity.stage] + forecastScore) / 2), weight: 10, confidence: 0.7 },
  ];

  const actionCompleted = opportunity.actionState === "Completed";
  const urgencyFactors: WeightedFactor[] = [
    { score: actionCompleted ? undefined : dueScore(opportunity.nextActionDue, now), weight: 35, confidence: 0.95 },
    { score: dueScore(opportunity.closeDate, now), weight: 25, confidence: opportunity.valueConfidence === "Contracted" ? 1 : 0.7 },
    { score: !actionCompleted && opportunity.nextCustomerDecision.trim() ? Math.max(55, dueScore(opportunity.nextActionDue, now) || 55) : undefined, weight: 15, confidence: 0.7 },
    { score: choice(opportunity.timeToRevenue, { "0-30 days": 100, "31-90 days": 82, "91-180 days": 62, "181-365 days": 40, "More than 1 year": 20 }), weight: 15 },
    { score: activityRecency(relatedActivities, opportunity, now), weight: 10, confidence: 0.8 },
  ];

  const strategicValue = weightedMean(strategicFactors);
  const winReadiness = weightedMean(readinessFactors);
  const actionUrgency = weightedMean(urgencyFactors);
  const confidence = bounded(100 * (0.45 * coverage(strategicFactors) + 0.30 * coverage(readinessFactors) + 0.25 * coverage(urgencyFactors)));
  const dimensions = [
    strategicValue === null ? undefined : { score: strategicValue, weight: 45 },
    winReadiness === null ? undefined : { score: winReadiness, weight: 30 },
    actionUrgency === null ? undefined : { score: actionUrgency, weight: 25 },
  ].filter((value): value is { score: number; weight: number } => Boolean(value));
  const rawIndex = dimensions.length ? weightedMean(dimensions) : null;
  const priorityIndex = rawIndex === null || confidence < 35 ? null : bounded(50 + (rawIndex - 50) * (0.35 + 0.65 * confidence / 100));

  let attentionTier: AttentionTier = priorityIndex === null ? "Needs inputs"
    : strategicValue !== null && strategicValue >= 82 ? "Strategic"
      : priorityIndex >= 68 ? "Priority" : priorityIndex >= 48 ? "Standard" : "Light-touch";
  const override = opportunity.attentionOverride;
  if (override && override !== "Automatic" && opportunity.priorityStatus === "Human confirmed" && dayNumber(opportunity.priorityReviewedAt || "") !== undefined && opportunity.attentionOverrideReason?.trim()) attentionTier = override;
  const nextWindow = actionWindow(opportunity, actionUrgency, now);

  const missingInputs: string[] = [];
  if (amount === undefined && annual === undefined) missingInputs.push("potential value or annual revenue");
  if (!account?.companySizeBand || account.companySizeBand === "Unknown") missingInputs.push("company size");
  if (!opportunity.strategicFit || opportunity.strategicFit === "Unknown") missingInputs.push("strategic fit");
  if (!opportunity.seriousness || opportunity.seriousness === "Unknown") missingInputs.push("buying seriousness");
  if (!opportunity.decisionAccess || opportunity.decisionAccess === "Unknown") missingInputs.push("decision-maker access");
  if (!primary) missingInputs.push("primary buying contact");
  if (actionCompleted || !opportunity.nextSpejAction.trim() || !opportunity.nextActionDue) missingInputs.push("one dated next action");

  const outreach = account?.id === opportunity.accountId ? outreachGuard(account, relatedActivities, metricDay(now)) : { blocked: false, reasons: [] };
  const reasons: string[] = outreach.reasons.length ? [outreach.reasons.join(" ")] : [];
  if (actionCompleted) reasons.push("The previous action is completed. Its old due date no longer creates an overdue action.");
  if (strategicValue !== null && strategicValue >= 75) reasons.push("High potential value or strategic upside.");
  if (winReadiness !== null && winReadiness >= 70) reasons.push("Buying signals and stakeholder access indicate strong readiness.");
  if (nextWindow === "Act now") reasons.push(`The ${actionLabel(opportunity.actionState)} is due or overdue.`);
  else if (nextWindow === "This week") reasons.push(`The ${actionLabel(opportunity.actionState)} falls within seven days.`);
  if (actionUrgency !== null && actionUrgency < 40 && strategicValue !== null && strategicValue >= 75) reasons.push("Strategically important, but not currently urgent.");
  if (confidence < 55) reasons.push("The ranking is provisional because important evidence is missing or unconfirmed.");
  if (!reasons.length) reasons.push("The recommendation balances value, readiness, and recorded timing.");

  return {
    strategicValue, winReadiness, actionUrgency, confidence, attentionTier, actionWindow: nextWindow,
    recommendedCadence: outreach.blocked
      ? `Coordinate with the account owner before new outreach.${!actionCompleted && opportunity.nextSpejAction.trim() && dayNumber(opportunity.nextActionDue) !== undefined ? " Keep the recorded next action and due date." : " Review the hold, nurture plan and recent activity before choosing the next step."}`
      : tierCadence(attentionTier, nextWindow, opportunity.actionState), priorityIndex,
    reasons: reasons.slice(0, 4), missingInputs, scoringVersion: PRIORITY_SCORING_VERSION,
  };
}

export function sortOpportunitiesByPriority(
  opportunities: OpportunityItem[],
  accounts: AccountItem[],
  contacts: ContactItem[],
  activities: ActivityItem[],
  now = new Date(),
) {
  const evaluations = new Map(opportunities.map((opportunity) => [opportunity.id, evaluateOpportunityPriority(
    opportunity,
    accounts.find((account) => account.id === opportunity.accountId),
    contacts.filter((contact) => contact.accountId === opportunity.accountId),
    activities,
    now,
  )]));
  const windowRank: Record<ActionWindow, number> = { "Act now": 5, "This week": 4, "Needs scheduling": 3, Scheduled: 2, Nurture: 1, Closed: 0 };
  return [...opportunities].sort((left, right) => {
    const a = evaluations.get(left.id)!;
    const b = evaluations.get(right.id)!;
    return windowRank[b.actionWindow] - windowRank[a.actionWindow]
      || (b.priorityIndex ?? -1) - (a.priorityIndex ?? -1)
      || (left.actionState === "Completed" ? "9999-12-31" : left.nextActionDue || "9999-12-31").localeCompare(right.actionState === "Completed" ? "9999-12-31" : right.nextActionDue || "9999-12-31")
      || left.name.localeCompare(right.name);
  });
}
