import { cleanAcquisitionMotion } from "./gtm-sources";
import type {
  AccountItem,
  ActivityItem,
  ContactItem,
  OpportunityItem,
  PartnershipItem,
  ProjectItem,
  SocialActionType,
} from "./types";
import { ACTIVITY_CHANNELS, ACTIVITY_METRIC_TYPES, ACTIVITY_PURPOSES, CONTACT_LIFECYCLES, validMetricDate } from "./gtm-metrics";
import { ACTIVITY_MESSAGE_MAX_LENGTH } from "./communication-history";
import { CLIENT_STATUSES, CHECK_IN_CADENCES, OUTREACH_PREFERENCES } from "./client-relationships";
import { PARTNER_CATEGORIES, PROJECT_DDD_PHASES, PROJECT_PLAYBOOKS, PROJECT_TYPES, PROJECT_WORK_AREAS, SALES_ROUTES, projectDefaults } from "./gtm-navigation";
import { cleanAccountContext, cleanActivityContext, cleanContactContext, cleanDeliveryContext, cleanOpportunityContext, pastRelationshipDate } from "./relationship-context";
import { cleanAdoptionOutcome } from "./customer-development";
import { cleanProjectCollaboration } from "./project-collaboration";

function text(value: unknown, fallback = "", limit = 2_000) {
  return (typeof value === "string" ? value : fallback).trim().slice(0, limit);
}

function id(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : crypto.randomUUID();
}

function date(value: unknown) {
  const clean = text(value, "", 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : "";
}

function timestamp(value: unknown) {
  const clean = text(value, "", 40);
  return Number.isFinite(Date.parse(clean)) ? clean : new Date().toISOString();
}

function choice<T extends string>(value: unknown, allowed: readonly T[], fallback: T) {
  return allowed.includes(value as T) ? value as T : fallback;
}

function archive(value: unknown) {
  const clean = text(value, "", 40);
  return Number.isFinite(Date.parse(clean)) ? clean : undefined;
}

const projectRecordSources = ["Spej OS", "SharePoint", "OneDrive", "Microsoft 365", "Other"] as const;
const projectRecordTypes = ["ticket", "quality-item", "document", "transcript", "decision", "approval", "time-entry", "enterprise-engagement"] as const;

function cleanProjectRecordReferences(value: unknown): NonNullable<ProjectItem["linkedRecords"]> {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
    const item = candidate as Record<string, unknown>;
    const externalId = text(item.externalId, "", 200);
    if (!externalId) return [];
    const sourceSystem = choice(item.sourceSystem, projectRecordSources, "Spej OS");
    const recordType = choice(item.recordType, projectRecordTypes, "document");
    const key = `${sourceSystem}:${recordType}:${externalId}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const rawUrl = text(item.url, "", 2_000);
    const url = /^https:\/\//i.test(rawUrl) ? rawUrl : undefined;
    return [{
      sourceSystem,
      recordType,
      externalId,
      title: text(item.title, "", 300) || undefined,
      status: text(item.status, "", 120) || undefined,
      url,
      updatedAt: Number.isFinite(Date.parse(text(item.updatedAt, "", 40))) ? text(item.updatedAt, "", 40) : undefined,
    }];
  }).slice(0, 200);
}

function list<T>(value: unknown, label: string, clean: (item: Record<string, unknown>) => T | null): T[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be a list.`);
  if (value.length > 10_000) throw new Error(`The ${label.toLowerCase()} list is too large.`);
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const result = clean(item as Record<string, unknown>);
    return result ? [result] : [];
  });
}

const accountTypes = ["Prospect", "Client", "Partner", "Network", "Other"] as const;
const accountStatuses = ["Active", "Nurture", "Inactive"] as const;
const companySizeBands = ["Unknown", "1-49", "50-249", "250-999", "1,000-4,999", "5,000+"] as const;
const strengths = ["New", "Developing", "Strong", "Dormant"] as const;
const buyingRoles = ["Decision Maker", "Champion", "Influencer", "Technical Evaluator", "Other"] as const;
const socialActions = ["Comment", "Connect", "DM", "Video / audio DM", "Profile review", "Share resource", "Other"] as const satisfies readonly SocialActionType[];
const opportunityStages = ["Explore", "Validate", "Qualify", "Shape & Estimate", "Proposal & Decision", "Contracting", "Closed Won", "Closed Lost"] as const;
const forecasts = ["Not Forecasted", "Pipeline", "Best Case", "Commit", "Contracted", "Lost"] as const;
const opportunityMotions = ["AI Office", "Plooms", "Individual Project", "MSP / Partner", "Other"] as const;
const engagementPhases = ["Discovery", "Design", "Delivery", "Not Applicable"] as const;
const valueConfidences = ["Unknown", "Rough estimate", "Validated", "Contracted"] as const;
const revenueModels = ["Unknown", "One-time", "Recurring", "Mixed"] as const;
const timeToRevenueValues = ["Unknown", "0-30 days", "31-90 days", "91-180 days", "181-365 days", "More than 1 year"] as const;
const seriousnessValues = ["Unknown", "Exploratory", "Engaged", "Active buying", "Commercial commitment"] as const;
const decisionAccessValues = ["Unknown", "No direct access", "Influencer", "Champion", "Decision maker", "Economic buyer"] as const;
const stakeholderCoverageValues = ["Unknown", "Single-threaded", "Multi-threaded", "Buying group mapped"] as const;
const priorityLevels = ["Unknown", "Low", "Medium", "High"] as const;
const priorityStatuses = ["Needs review", "Human confirmed"] as const;
const attentionOverrides = ["Automatic", "Strategic", "Priority", "Standard", "Light-touch"] as const;
const partnershipTypes = ["Referral", "Strategic alliance", "Technology", "Delivery", "Channel / co-selling"] as const;
const partnershipStages = ["Identified", "Engaging", "Mutual Fit", "Designing", "Pilot / Activation", "Active", "Paused / Ended"] as const;
const healthValues = ["Unknown", "Healthy", "Watch", "At Risk"] as const;
const projectPhases = [...PROJECT_DDD_PHASES, "Internal"] as const;
const commercialStatuses = ["Not Applicable", "Anticipated", "Shaping", "Proposed", "Contracting", "Contracted", "Declined"] as const;
const operationalStatuses = ["Not Started", "Mobilizing", "Active", "At Gate", "Complete", "Paused", "Stopped"] as const;
const projectHealth = ["Unknown", "On Track", "Watch", "At Risk"] as const;

export function cleanAccounts(value: unknown): AccountItem[] {
  return list(value, "Accounts", (item) => {
    const name = text(item.name, "", 300);
    if (!name) return null;
    return { ...cleanAccountContext(item), id: id(item.id), name, type: choice(item.type, accountTypes, "Prospect"), status: choice(item.status, accountStatuses, "Active"), owner: text(item.owner, "Unassigned", 120), ownerProfileId: text(item.ownerProfileId, "", 200) || undefined, website: text(item.website, "", 1_000), notes: text(item.notes),
      acquisitionMotion: cleanAcquisitionMotion(item.acquisitionMotion), source: text(item.source, "Unknown / Needs Review", 200),
      sourceDate: pastRelationshipDate(item.sourceDate) || undefined,
      originatingContactId: text(item.originatingContactId, "", 100) || undefined, referrerContactId: text(item.referrerContactId, "", 100) || undefined,
      sourceArtifactId: text(item.sourceArtifactId, "", 100) || undefined,
      companySizeBand: choice(item.companySizeBand, companySizeBands, "Unknown"), focus531: item.focus531 === true,
      clientStatus: choice(item.clientStatus, CLIENT_STATUSES, "Unclassified"), isPartner: item.isPartner === true,
      outreachPreference: choice(item.outreachPreference, OUTREACH_PREFERENCES, "Allowed"), checkInCadence: choice(item.checkInCadence, CHECK_IN_CADENCES, "Not set"),
      checkInOwner: text(item.checkInOwner, "", 120), checkInContactId: text(item.checkInContactId, "", 100), checkInReason: text(item.checkInReason, "", 1000),
      lastCheckIn: validMetricDate(text(item.lastCheckIn)) ? text(item.lastCheckIn) : "", nextCheckIn: validMetricDate(text(item.nextCheckIn)) ? text(item.nextCheckIn) : "",
      nextMeetingDate: validMetricDate(text(item.nextMeetingDate)) ? text(item.nextMeetingDate) : "", checkInTaskId: text(item.checkInTaskId, "", 100),
      createdAt: timestamp(item.createdAt), archivedAt: archive(item.archivedAt) };
  });
}

export function cleanContacts(value: unknown): ContactItem[] {
  return list(value, "Contacts", (item) => {
    const name = text(item.name, "", 300);
    if (!name) return null;
    return { ...cleanContactContext(item), id: id(item.id), accountId: text(item.accountId, "", 100), name, title: text(item.title, "", 300), email: text(item.email, "", 320), linkedinUrl: text(item.linkedinUrl, "", 1_000), buyingRole: choice(item.buyingRole, buyingRoles, "Other"), focus531: item.focus531 === true, nextActionType: choice(item.nextActionType, socialActions, "Comment"), nextAction: text(item.nextAction), nextActionDue: date(item.nextActionDue), relationshipStrength: choice(item.relationshipStrength, strengths, "New"), lifecycleStage: choice(item.lifecycleStage, CONTACT_LIFECYCLES, "Unclassified"), leadDate: validMetricDate(text(item.leadDate)) ? text(item.leadDate) : undefined, acquisitionMotion: cleanAcquisitionMotion(item.acquisitionMotion), source: text(item.source, "Unknown / Needs Review", 200), lastContact: date(item.lastContact), notes: text(item.notes), createdAt: timestamp(item.createdAt), archivedAt: archive(item.archivedAt) };
  });
}

export function cleanActivities(value: unknown): ActivityItem[] {
  return list(value, "Activities", (item) => {
    const summary = text(item.summary, "", 1_000);
    if (!summary) return null;
    return { ...cleanActivityContext(item), id: id(item.id), accountId: text(item.accountId, "", 100), contactId: text(item.contactId, "", 100), channel: choice(item.channel, ACTIVITY_CHANNELS, "Other"), actionType: item.actionType ? choice(item.actionType, socialActions, "Other") : undefined, metricType: ACTIVITY_METRIC_TYPES.includes(item.metricType as NonNullable<ActivityItem["metricType"]>) ? item.metricType as ActivityItem["metricType"] : undefined, purpose: item.purpose === undefined ? undefined : choice(item.purpose, ACTIVITY_PURPOSES, "Unclassified"), owner: text(item.owner, "", 120) || undefined, ownerProfileId: text(item.ownerProfileId, "", 200) || undefined, campaignId: text(item.campaignId, "", 100) || undefined, opportunityId: text(item.opportunityId, "", 100) || undefined, projectId: text(item.projectId, "", 100) || undefined, sourceArtifactId: text(item.sourceArtifactId, "", 100) || undefined, sourceLabel: text(item.sourceLabel, "", 200) || undefined, summary, outcome: text(item.outcome, "", ACTIVITY_MESSAGE_MAX_LENGTH), occurredAt: item.sourceDateKnown === false ? "" : pastRelationshipDate(item.occurredAt), createdAt: timestamp(item.createdAt), archivedAt: archive(item.archivedAt) };
  });
}

export function cleanOpportunities(value: unknown): OpportunityItem[] {
  return list(value, "Opportunities", (item) => {
    const name = text(item.name, "", 300);
    if (!name) return null;
    const numericValue = Number(item.value);
    const annualRevenuePotential = Number(item.annualRevenuePotential);
    const priorityEvidenceSourceIds = Array.isArray(item.priorityEvidenceSourceIds)
      ? item.priorityEvidenceSourceIds.flatMap((value) => typeof value === "string" && value.trim() ? [value.trim().slice(0, 120)] : []).slice(0, 20)
      : [];
    return { ...cleanOpportunityContext(item), id: id(item.id), accountId: text(item.accountId, "", 100), name, stage: choice(item.stage, opportunityStages, "Explore"), forecast: choice(item.forecast, forecasts, "Not Forecasted"), value: Number.isFinite(numericValue) && numericValue >= 0 ? Math.round(numericValue) : 0,
      valueConfidence: choice(item.valueConfidence, valueConfidences, "Unknown"), annualRevenuePotential: Number.isFinite(annualRevenuePotential) && annualRevenuePotential >= 0 ? Math.round(annualRevenuePotential) : 0,
      revenueModel: choice(item.revenueModel, revenueModels, "Unknown"), timeToRevenue: choice(item.timeToRevenue, timeToRevenueValues, "Unknown"), seriousness: choice(item.seriousness, seriousnessValues, "Unknown"),
      primaryContactId: text(item.primaryContactId, "", 100) || undefined, decisionAccess: choice(item.decisionAccess, decisionAccessValues, "Unknown"), stakeholderCoverage: choice(item.stakeholderCoverage, stakeholderCoverageValues, "Unknown"),
      strategicFit: choice(item.strategicFit, priorityLevels, "Unknown"), expansionPotential: choice(item.expansionPotential, priorityLevels, "Unknown"), priorityEvidence: text(item.priorityEvidence, "", 2_000), priorityEvidenceSourceIds,
      priorityStatus: choice(item.priorityStatus, priorityStatuses, "Needs review"), priorityReviewedAt: date(item.priorityReviewedAt), attentionOverride: choice(item.attentionOverride, attentionOverrides, "Automatic"), attentionOverrideReason: text(item.attentionOverrideReason, "", 1_000),
      closeDate: date(item.closeDate), owner: text(item.owner, "Unassigned", 120), ownerProfileId: text(item.ownerProfileId, "", 200) || undefined, motion: choice(item.motion, opportunityMotions, "Other"), salesRoute: choice(item.salesRoute, SALES_ROUTES, "Unclassified"), partnerAccountId: text(item.partnerAccountId, "", 100) || undefined, engagementPhase: choice(item.engagementPhase, engagementPhases, "Not Applicable"), painPoint: text(item.painPoint), desiredOutcome: text(item.desiredOutcome), nextSpejAction: text(item.nextSpejAction), nextCustomerDecision: text(item.nextCustomerDecision), nextActionDue: date(item.nextActionDue), acquisitionMotion: cleanAcquisitionMotion(item.acquisitionMotion), source: text(item.source, "Unknown / Needs Review", 200), notes: text(item.notes), createdAt: timestamp(item.createdAt), archivedAt: archive(item.archivedAt) };
  });
}

export function cleanPartnerships(value: unknown): PartnershipItem[] {
  return list(value, "Partnerships", (item) => {
    const name = text(item.name, "", 300);
    if (!name) return null;
    return { id: id(item.id), accountId: text(item.accountId, "", 100), name, type: choice(item.type, partnershipTypes, "Strategic alliance"), partnerCategory: choice(item.partnerCategory, PARTNER_CATEGORIES, "Unclassified"), stage: choice(item.stage, partnershipStages, "Identified"), health: choice(item.health, healthValues, "Unknown"), owner: text(item.owner, "Unassigned", 120), ownerProfileId: text(item.ownerProfileId, "", 200) || undefined, nextAction: text(item.nextAction), dueDate: date(item.dueDate), notes: text(item.notes), createdAt: timestamp(item.createdAt), archivedAt: archive(item.archivedAt) };
  });
}

export function cleanProjects(value: unknown): ProjectItem[] {
  return list(value, "Projects", (item) => {
    const name = text(item.name, "", 300);
    if (!name) return null;
    const suppliedPhase = projectPhases.includes(item.phase as typeof projectPhases[number]) ? item.phase as typeof projectPhases[number] : undefined;
    const legacyInternal = suppliedPhase === "Internal";
    const projectType = choice(item.projectType, PROJECT_TYPES, legacyInternal ? "Internal Initiative" : "Client Project");
    const defaults = projectDefaults(projectType);
    const playbook = choice(item.playbook, PROJECT_PLAYBOOKS, legacyInternal ? "Not set" : defaults.playbook);
    const phase = playbook === "Discovery / Design / Delivery"
      ? (suppliedPhase === "Internal" ? "Not Applicable" : suppliedPhase || defaults.phase)
      : "Not Applicable";
    const createdAt = timestamp(item.createdAt);
    return {
      id: id(item.id), accountId: text(item.accountId, "", 100), name,
      deliveryContext: cleanDeliveryContext(item.deliveryContext),
      adoptionOutcome: cleanAdoptionOutcome(item.adoptionOutcome),
      ...cleanProjectCollaboration(item),
      phase,
      workArea: choice(item.workArea, PROJECT_WORK_AREAS, legacyInternal ? "GTM" : defaults.workArea),
      projectType,
      playbook,
      opportunityId: text(item.opportunityId, "", 100) || undefined,
      commercialStatus: choice(item.commercialStatus, commercialStatuses, projectType === "AI Office" || projectType === "Plooms" || projectType === "Client Project" ? "Anticipated" : "Not Applicable"),
      operationalStatus: choice(item.operationalStatus, operationalStatuses, "Not Started"), health: choice(item.health, projectHealth, "Unknown"), owner: text(item.owner, "Unassigned", 120), ownerProfileId: text(item.ownerProfileId, "", 200) || undefined,
      startDate: date(item.startDate), endDate: date(item.endDate), nextMilestone: text(item.nextMilestone), dueDate: date(item.dueDate), successMeasure: text(item.successMeasure, "", 500), risk: text(item.risk, "", 1_000), linkedRecords: cleanProjectRecordReferences(item.linkedRecords), notes: text(item.notes), createdAt, updatedAt: timestamp(item.updatedAt || createdAt), archivedAt: archive(item.archivedAt),
    };
  });
}
