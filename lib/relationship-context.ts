import { cleanAcquisitionMotion } from "./gtm-sources";
import { cleanAiProfile, cleanContactNurture, cleanDiscoveryEconomics } from "./customer-development";
import { metricDay, validMetricDate } from "./gtm-metrics";
import type { AccountItem, ActivityItem, ContactItem, DeliveryContext, EvidenceFact, NurturePlan, OpportunityItem, OriginSnapshot, OutreachHold, RelationshipConnection } from "./types";

export const FACT_KINDS = ["Customer statement", "Internal observation", "Hypothesis", "AI suggestion"] as const;
export const FACT_STATUSES = ["Current", "Conflicting", "Superseded"] as const;
export const CONNECTION_KINDS = ["Confirmed relationship", "Public affiliation", "Possible introduction", "Actual introduction"] as const;
export const INTRODUCTION_STATUSES = ["Not requested", "Offered", "Requested", "Completed", "Accepted"] as const;
export const CONNECTION_CONFIDENCES = ["Unknown", "Low", "Medium", "High"] as const;
export const NURTURE_APPROACHES = ["Responsive", "Deferred", "Dormant", "Internal builder", "Introducer", "Existing client", "Poor fit"] as const;
export const RELATIONSHIP_ROLES = ["Buyer", "Introducer", "Partner", "Adviser", "Client contact"] as const;
export const CAPTURE_METHODS = ["Direct entry", "Forwarded email", "Pasted message", "Meeting transcript", "Voice transcript"] as const;
export const VALUE_MEANINGS = ["Unknown", "Estimated", "Proposed", "Contracted", "Invoiced", "Paid"] as const;
export const ACTION_STATES = ["Suggested", "Assigned", "Agreed", "Scheduled", "Completed"] as const;

function text(value: unknown, limit = 2_000) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function choice<T extends string>(value: unknown, choices: readonly T[], fallback: T): T {
  return choices.includes(value as T) ? value as T : fallback;
}

function day(value: unknown) {
  const valueText = text(value, 40);
  return validMetricDate(valueText) ? valueText : "";
}

/** Historical events never receive an import date or a future scheduled date. */
export function pastRelationshipDate(value: unknown, today = metricDay()) {
  const valueDay = day(value);
  return valueDay && valueDay <= today ? valueDay : "";
}

function capturedTimestamp(value: unknown, today = metricDay()) {
  const candidate = text(value, 40);
  if (!candidate || !validMetricDate(candidate.slice(0, 10))) return "";
  const time = Date.parse(candidate);
  if (!Number.isFinite(time)) return "";
  const instant = new Date(time);
  return metricDay(instant) <= today ? instant.toISOString() : "";
}

function boundedRecords<T>(value: unknown, max: number, clean: (item: Record<string, unknown>) => T | undefined): T[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, max).flatMap((candidate) => {
    const item = record(candidate);
    const result = item ? clean(item) : undefined;
    return result ? [result] : [];
  });
}

function uniqueIds<T extends { id: string }>(values: T[]) {
  const seen = new Set<string>();
  return values.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function cleanOrigin(value: unknown): OriginSnapshot | undefined {
  const item = record(value);
  if (!item) return undefined;
  return {
    source: text(item.source, 200) || "Unknown / Needs Review",
    acquisitionMotion: cleanAcquisitionMotion(item.acquisitionMotion),
    sourceDate: pastRelationshipDate(item.sourceDate),
    originatingContactId: text(item.originatingContactId, 100) || undefined,
    referrerContactId: text(item.referrerContactId, 100) || undefined,
    sourceArtifactId: text(item.sourceArtifactId, 100) || undefined,
  };
}

function cleanFacts(value: unknown) {
  return uniqueIds(boundedRecords<EvidenceFact>(value, 200, (item) => {
    const factText = text(item.text, 4_000);
    if (!factText) return undefined;
    return {
      id: text(item.id, 100) || crypto.randomUUID(), topic: text(item.topic, 200), text: factText,
      kind: choice(item.kind, FACT_KINDS, "Hypothesis"), sourceLabel: text(item.sourceLabel, 500),
      sourceDate: pastRelationshipDate(item.sourceDate), capturedAt: capturedTimestamp(item.capturedAt),
      status: choice(item.status, FACT_STATUSES, "Current"),
    };
  }));
}

function cleanConnections(value: unknown) {
  return uniqueIds(boundedRecords<RelationshipConnection>(value, 100, (item) => {
    const context = text(item.context);
    const fromContactId = text(item.fromContactId, 100) || undefined;
    const viaContactId = text(item.viaContactId, 100) || undefined;
    const toAccountId = text(item.toAccountId, 100) || undefined;
    const toContactId = text(item.toContactId, 100) || undefined;
    if (!context && !fromContactId && !viaContactId && !toAccountId && !toContactId) return undefined;
    return {
      id: text(item.id, 100) || crypto.randomUUID(), fromContactId, viaContactId, toAccountId, toContactId, context,
      kind: choice(item.kind, CONNECTION_KINDS, "Possible introduction"),
      introductionStatus: choice(item.introductionStatus, INTRODUCTION_STATUSES, "Not requested"),
      validator: text(item.validator, 300), lastInteractionDate: pastRelationshipDate(item.lastInteractionDate),
      relevance: text(item.relevance), nextStep: text(item.nextStep), dueDate: day(item.dueDate),
      evidence: text(item.evidence, 4_000), evidenceDate: pastRelationshipDate(item.evidenceDate),
      confidence: choice(item.confidence, CONNECTION_CONFIDENCES, "Unknown"),
    };
  }));
}

function cleanNurturePlan(value: unknown): NurturePlan | undefined {
  const item = record(value);
  if (!item) return undefined;
  return {
    approach: choice(item.approach, NURTURE_APPROACHES, "Dormant"), owner: text(item.owner, 120),
    nextAction: text(item.nextAction), dueDate: day(item.dueDate), trigger: text(item.trigger), reason: text(item.reason),
    desiredOutcome: text(item.desiredOutcome), pauseCondition: text(item.pauseCondition),
    state: choice(item.state, ["Active", "Paused"] as const, "Paused"),
  };
}

function cleanOutreachHold(value: unknown): OutreachHold | undefined {
  const item = record(value);
  if (!item) return undefined;
  return { active: item.active === true, reason: text(item.reason), until: day(item.until), releaseCondition: text(item.releaseCondition) };
}

export function cleanAccountContext(item: Record<string, unknown>): Pick<AccountItem, "originalSource" | "contextFacts" | "connections" | "nurturePlan" | "outreachHold" | "aiProfile"> {
  return {
    aiProfile: cleanAiProfile(item.aiProfile),
    originalSource: cleanOrigin(item.originalSource),
    contextFacts: item.contextFacts === undefined ? undefined : cleanFacts(item.contextFacts),
    connections: item.connections === undefined ? undefined : cleanConnections(item.connections),
    nurturePlan: cleanNurturePlan(item.nurturePlan), outreachHold: cleanOutreachHold(item.outreachHold),
  };
}

function cleanEmploymentHistory(value: unknown): NonNullable<ContactItem["employmentHistory"]> {
  const seen = new Set<string>();
  return boundedRecords(value, 100, (item) => {
    const accountId = text(item.accountId, 100);
    const title = text(item.title, 300);
    const endedAt = pastRelationshipDate(item.endedAt);
    const key = `${accountId}\0${title}\0${endedAt}`;
    if (!accountId || seen.has(key)) return undefined;
    seen.add(key);
    return { accountId, title, endedAt };
  });
}

export function cleanContactContext(item: Record<string, unknown>): Pick<ContactItem, "relationshipRoles" | "employmentHistory" | "nurture"> {
  return {
    nurture: cleanContactNurture(item.nurture, item.accountId, item.email),
    relationshipRoles: item.relationshipRoles === undefined ? undefined : Array.isArray(item.relationshipRoles)
      ? [...new Set(item.relationshipRoles.slice(0, 50).filter((role) => RELATIONSHIP_ROLES.includes(role as typeof RELATIONSHIP_ROLES[number])))] : [],
    employmentHistory: item.employmentHistory === undefined ? undefined : cleanEmploymentHistory(item.employmentHistory),
  };
}

export function cleanActivityContext(item: Record<string, unknown>): Pick<ActivityItem, "capturedAt" | "captureMethod" | "sourceDateKnown"> {
  return {
    capturedAt: capturedTimestamp(item.capturedAt) || undefined,
    captureMethod: CAPTURE_METHODS.includes(item.captureMethod as typeof CAPTURE_METHODS[number]) ? item.captureMethod as ActivityItem["captureMethod"] : undefined,
    sourceDateKnown: typeof item.sourceDateKnown === "boolean" ? item.sourceDateKnown && Boolean(pastRelationshipDate(item.occurredAt)) : undefined,
  };
}

export function cleanOpportunityContext(item: Record<string, unknown>): Pick<OpportunityItem, "valueMeaning" | "nextActionReason" | "desiredNextOutcome" | "actionState" | "discoveryEconomics"> {
  return {
    discoveryEconomics: cleanDiscoveryEconomics(item.discoveryEconomics),
    valueMeaning: item.valueMeaning === undefined ? undefined : choice(item.valueMeaning, VALUE_MEANINGS, "Unknown"),
    nextActionReason: item.nextActionReason === undefined ? undefined : text(item.nextActionReason),
    desiredNextOutcome: item.desiredNextOutcome === undefined ? undefined : text(item.desiredNextOutcome),
    actionState: item.actionState === undefined ? undefined : choice(item.actionState, ACTION_STATES, "Suggested"),
  };
}

export function cleanDeliveryContext(value: unknown): DeliveryContext | undefined {
  const item = record(value);
  if (!item) return undefined;
  return {
    scope: text(item.scope, 4_000), deliverables: text(item.deliverables, 4_000), startConditions: text(item.startConditions),
    customerCounterpart: text(item.customerCounterpart, 500), commitments: text(item.commitments, 4_000),
    openQuestions: text(item.openQuestions, 4_000), expansionIdeas: text(item.expansionIdeas, 4_000),
    verifiedOutcomes: text(item.verifiedOutcomes, 4_000), sourceEvidence: text(item.sourceEvidence, 4_000),
  };
}

export function captureOriginalSource(account: AccountItem): OriginSnapshot {
  const snapshot = cleanOrigin(account.originalSource);
  return snapshot && hasKnownOrigin(snapshot) ? snapshot : cleanOrigin(account)!;
}

function hasKnownOrigin(origin: OriginSnapshot) {
  return Boolean((origin.source && origin.source !== "Unknown / Needs Review") || origin.acquisitionMotion !== "Unclassified" || origin.originatingContactId || origin.referrerContactId || origin.sourceArtifactId || origin.sourceDate);
}

/** Preserve first attribution when subsequent influence changes editable fields. */
export function preserveOriginalSource(existing: AccountItem | undefined, next: AccountItem): AccountItem {
  const originAccount = existing && hasKnownOrigin(captureOriginalSource(existing)) ? existing : next;
  return { ...next, originalSource: captureOriginalSource(originAccount) };
}

/** A new employer never changes the account on historical activities or deals. */
export function preserveEmploymentHistory(existing: ContactItem | undefined, next: ContactItem, changedAt = ""): ContactItem {
  next = { ...next, nurture: cleanContactNurture(next.nurture, next.accountId, next.email) };
  const nextHistory = cleanEmploymentHistory(next.employmentHistory);
  if (!existing) return { ...next, employmentHistory: nextHistory };
  const suppliedPreviousRole = nextHistory.find((role) => role.accountId === existing.accountId && role.title === existing.title);
  const previousRole = existing.accountId && existing.accountId !== next.accountId
    ? [suppliedPreviousRole || { accountId: existing.accountId, title: existing.title, endedAt: pastRelationshipDate(changedAt) }]
    : [];
  return { ...next, employmentHistory: cleanEmploymentHistory([...previousRole, ...(existing.employmentHistory || []), ...nextHistory]) };
}

export function accountEngagementDates(account: AccountItem, activities: ActivityItem[], today = metricDay()) {
  const related = activities.filter((activity) => !activity.archivedAt && activity.accountId === account.id);
  const knownEvents = related.filter((activity) => activity.sourceDateKnown !== false && pastRelationshipDate(activity.occurredAt, today));
  const last = (types: Array<ActivityItem["metricType"]>) => knownEvents.filter((activity) => types.includes(activity.metricType)).map((activity) => activity.occurredAt).sort().at(-1) || "";
  return {
    lastBuyerResponse: last(["Reply received"]),
    lastSellerOutreach: last(["Outreach sent", "Follow-up sent", "Call attempted", "Connection requested"]),
    lastSubstantiveConversation: last(["Meeting held", "Call connected", "Check-in completed"]),
    nextAgreedStep: day(account.nextMeetingDate) && account.nextMeetingDate! >= today ? account.nextMeetingDate! : "",
    lastCapturedAt: related.map((activity) => capturedTimestamp(activity.capturedAt, today)).filter(Boolean).sort().at(-1) || "",
  };
}

/** Gate generic proactive suggestions; recorded commitments remain visible. */
export function outreachGuard(account: AccountItem, activities: ActivityItem[], today = metricDay()) {
  const reasons: string[] = [];
  if (account.archivedAt) reasons.push("This account is archived.");
  if (account.outreachPreference === "No proactive outreach") reasons.push("No proactive outreach is permitted for this account.");
  if (account.outreachHold?.active) reasons.push(`Outreach hold: ${account.outreachHold.reason || "Coordinate with the relationship owner before outreach."}${account.outreachHold.until ? ` Review date: ${account.outreachHold.until}; the hold must be explicitly resolved.` : " The hold must be explicitly resolved."}`);
  const plan = account.nurturePlan;
  if (plan?.state === "Paused") reasons.push(`Nurture is paused${plan.pauseCondition ? `: ${plan.pauseCondition}` : "."}`);
  if (plan?.state === "Active" && plan.approach === "Deferred" && day(plan.dueDate) > today) reasons.push(`The buyer's deferred review date is ${plan.dueDate}.`);
  if (plan?.state === "Active" && plan.approach === "Deferred" && plan.trigger.trim()) reasons.push(`Deferred until this trigger is confirmed: ${plan.trigger.trim()}. Review and update the nurture plan before proactive outreach; reaching a review date does not confirm that the trigger occurred.`);
  const cutoffDate = new Date(`${today}T12:00:00Z`);
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - 7);
  const cutoff = Number.isFinite(cutoffDate.getTime()) ? cutoffDate.toISOString().slice(0, 10) : today;
  const recent = activities.filter((activity) => !activity.archivedAt && activity.accountId === account.id && activity.sourceDateKnown !== false && pastRelationshipDate(activity.occurredAt, today) && activity.occurredAt >= cutoff && ["Outreach sent", "Follow-up sent", "Reply received", "Call connected"].includes(activity.metricType || ""))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
  if (recent) reasons.push(`Review recent ${recent.metricType?.toLowerCase()} on ${recent.occurredAt}${recent.owner ? `, recorded by ${recent.owner}` : ""}, and coordinate the agreed next step before new outreach.`);
  return { blocked: reasons.length > 0, reasons };
}

export type ConnectionExploration = {
  connection: RelationshipConnection;
  path: string;
  reason: string;
  nextStep: string;
  referenceIssues: string[];
  reviewRequired: boolean;
};

/** Explicit recorded routes only: affiliations never create leads or revenue. */
export function connectionsWorthExploring(account: AccountItem, accounts: AccountItem[], contacts: ContactItem[]): ConnectionExploration[] {
  if (account.archivedAt) return [];
  return (account.connections || []).map((connection) => {
    const referenceIssues: string[] = [];
    const person = (id: string | undefined) => {
      if (!id) return "";
      const contact = contacts.find((item) => item.id === id && !item.archivedAt);
      if (!contact) { referenceIssues.push("A linked person is missing or archived."); return "Unavailable person"; }
      return contact.name;
    };
    const organization = (id: string | undefined) => {
      if (!id) return "";
      const linked = accounts.find((item) => item.id === id && !item.archivedAt);
      if (!linked) { referenceIssues.push("A linked organization is missing or archived."); return "Unavailable organization"; }
      return linked.name;
    };
    const from = person(connection.fromContactId);
    const via = person(connection.viaContactId);
    const destination = organization(connection.toAccountId);
    const to = person(connection.toContactId);
    const destinationPerson = contacts.find((item) => !item.archivedAt && item.id === connection.toContactId);
    if (connection.toAccountId && destinationPerson && destinationPerson.accountId !== connection.toAccountId) referenceIssues.push("The destination person's current organization differs from this recorded path; review their relationship history.");
    const path = [from, via, destination, to].filter(Boolean).join(" → ") || account.name;
    return {
      connection, path, reason: connection.relevance || connection.context || "Relevance has not been recorded.",
      nextStep: connection.nextStep || "Confirm the connection and record a specific next step.", referenceIssues,
      reviewRequired: referenceIssues.length > 0 || !connection.validator || !connection.evidence || !connection.evidenceDate || connection.confidence === "Unknown" || connection.kind === "Public affiliation" || connection.kind === "Possible introduction",
    };
  });
}
