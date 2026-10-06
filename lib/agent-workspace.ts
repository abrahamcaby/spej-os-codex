import { contentPublicationIssue } from "./content-workflow";
import { MAX_FOCUS_ACCOUNTS, MAX_FOCUS_CONTACTS_PER_ACCOUNT } from "./social-selling";
import type {
  AgentWorkspaceAction,
  AgentWorkspaceCollection,
  ContentItem,
  ReminderItem,
  WorkspaceState,
} from "./types";
import {
  cleanAccounts,
  cleanActivities,
  cleanContacts,
  cleanOpportunities,
  cleanPartnerships,
  cleanProjects,
} from "./operations";
import { cleanTaskItems, completeTaskItems, hasOpenSubtasks, inheritedTaskAccess } from "./tasks";
import { cleanMarketingMetrics, upsertMarketingMetric } from "./marketing-metrics";
import { normalizeContentCategory } from "./content-taxonomy";
import { cleanCampaigns } from "./campaigns";
import { clientPlanIssues, taskBelongsToAccount } from "./client-relationships";
import { metricDay, validMetricDate } from "./gtm-metrics";
import { getTeamViewProfile } from "./team-views";

type RawAction = {
  type?: unknown;
  collection?: unknown;
  recordId?: unknown;
  recordName?: unknown;
  label?: unknown;
  reason?: unknown;
  data?: unknown;
};

const collections = new Set<AgentWorkspaceCollection>([
  "reminders", "tasks", "content", "accounts", "contacts", "activities",
  "opportunities", "partnerships", "projects", "campaigns", "marketingMetrics",
]);
const collectionAliases: Record<string, AgentWorkspaceCollection> = {
  reminder: "reminders", task: "tasks", content_item: "content", content: "content",
  account: "accounts", contact: "contacts", person: "contacts", activity: "activities",
  opportunity: "opportunities", partnership: "partnerships", project: "projects",
  campaign: "campaigns",
  metric: "marketingMetrics", marketing_metric: "marketingMetrics", marketingmetrics: "marketingMetrics",
};
const actionTypes = new Set<AgentWorkspaceAction["type"]>(["create", "update", "complete"]);
const contentFormats = new Set<ContentItem["format"]>(["YouTube", "Newsletter", "LinkedIn", "Short-form", "Article", "Other"]);
const contentStages = new Set<ContentItem["stage"]>(["Idea", "Research", "Drafting", "Production", "Scheduled", "Published"]);
const contentStreams = new Set<ContentItem["stream"]>(["Personal LinkedIns", "Spej Authority-building content"]);
const contentReviewStatuses = new Set<ContentItem["reviewStatus"]>(["Not Requested", "Pending Review", "Changes Requested", "Approved"]);

function text(value: unknown, fallback = "", limit = 2_000) {
  return (typeof value === "string" ? value : fallback).trim().slice(0, limit);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function collectionName(value: unknown) {
  const raw = text(value).toLowerCase();
  if (collections.has(raw as AgentWorkspaceCollection)) return raw as AgentWorkspaceCollection;
  return collectionAliases[raw];
}

function bindPreviewIdentity(data: Record<string, unknown>, supplied: Record<string, unknown>) {
  const bound = { ...data };
  if ("owner" in supplied) bound.ownerProfileId = getTeamViewProfile(supplied.owner as string)?.id;
  if ("approver" in supplied) bound.approverProfileId = getTeamViewProfile(supplied.approver as string)?.id;
  return bound;
}

function cleanReminder(value: Record<string, unknown>): ReminderItem | null {
  const title = text(value.title, "", 300);
  if (!title) return null;
  const url = text(value.url, "", 2_000) || undefined;
  return {
    id: typeof value.id === "string" || typeof value.id === "number" ? value.id : crypto.randomUUID(),
    type: text(value.type, url ? "Link" : "Saved", 80),
    title,
    source: text(value.source, "Agent", 200),
    note: text(value.note, "Saved by Spej Agent."),
    accent: text(value.accent, "teal", 30),
    url,
    createdAt: text(value.createdAt, new Date().toISOString(), 40),
    archivedAt: text(value.archivedAt, "", 40) || undefined,
  };
}

function cleanContent(value: Record<string, unknown>): ContentItem | null {
  const title = text(value.title, "", 300);
  if (!title) return null;
  const stream = contentStreams.has(value.stream as ContentItem["stream"])
    ? value.stream as ContentItem["stream"]
    : "Spej Authority-building content";
  return {
    id: text(value.id, crypto.randomUUID(), 100),
    title,
    format: contentFormats.has(value.format as ContentItem["format"]) ? value.format as ContentItem["format"] : "Other",
    stage: contentStages.has(value.stage as ContentItem["stage"]) ? value.stage as ContentItem["stage"] : "Idea",
    publishDate: /^\d{4}-\d{2}-\d{2}$/.test(text(value.publishDate, "", 10)) ? text(value.publishDate, "", 10) : "",
    angle: text(value.angle),
    pillar: normalizeContentCategory(stream, value.pillar, value.angle),
    stream,
    owner: text(value.owner, "Unassigned", 120) || "Unassigned",
    ownerProfileId: text(value.ownerProfileId, "", 200) || undefined,
    approver: text(value.approver, "Unassigned", 120) || "Unassigned",
    approverProfileId: text(value.approverProfileId, "", 200) || undefined,
    reviewStatus: contentReviewStatuses.has(value.reviewStatus as ContentItem["reviewStatus"])
      ? value.reviewStatus as ContentItem["reviewStatus"]
      : "Not Requested",
    reviewDue: /^\d{4}-\d{2}-\d{2}$/.test(text(value.reviewDue, "", 10)) ? text(value.reviewDue, "", 10) : "",
    campaignId: text(value.campaignId, "", 100) || undefined,
    sourceUrl: text(value.sourceUrl, "", 2_000) || undefined,
    createdAt: text(value.createdAt, new Date().toISOString(), 40),
  };
}

function cleanCollectionRecord(collection: AgentWorkspaceCollection, value: Record<string, unknown>) {
  if (collection === "reminders") return cleanReminder(value);
  if (collection === "content") return cleanContent(value);
  if (collection === "tasks") return cleanTaskItems([value])[0] || null;
  if (collection === "accounts") return cleanAccounts([value])[0] || null;
  if (collection === "contacts") return cleanContacts([value])[0] || null;
  if (collection === "activities") return cleanActivities([value])[0] || null;
  if (collection === "opportunities") return cleanOpportunities([value])[0] || null;
  if (collection === "partnerships") return cleanPartnerships([value])[0] || null;
  if (collection === "projects") return cleanProjects([value])[0] || null;
  if (collection === "campaigns") return cleanCampaigns([value])[0] || null;
  return cleanMarketingMetrics([{ ...value, updatedAt: new Date().toISOString() }])[0] || null;
}

function displayName(value: unknown) {
  const item = record(value);
  return text(item.name || item.title || item.summary || item.metricKey, "record", 120);
}

function uniqueMatch<T>(items: T[], matches: (item: T) => boolean, label: string): T | undefined {
  const found = items.filter(matches);
  if (found.length > 1) throw new Error(`More than one ${label} matches. Use its exact record ID or clarify the account.`);
  if (!found.length) throw new Error(`No matching ${label} was found. Clarify the record before linking it.`);
  return found[0];
}

function resolveReferences(workspace: WorkspaceState, collection: AgentWorkspaceCollection, data: Record<string, unknown>, supplied = data) {
  const resolved = { ...data };
  const link = (field: string, nameField: string, items: Array<{id: string | number; name?: string; title?: string; archivedAt?: string}>, label: string) => {
    const name = text(resolved[nameField]).toLowerCase();
    if (resolved[field]) {
      if (!items.some((item) => !item.archivedAt && String(item.id) === String(resolved[field]))) throw new Error(`The linked ${label} is missing, archived, or belongs to a different account.`);
      return;
    }
    if (!name) return;
    const match = uniqueMatch(items, (item) => !item.archivedAt && text(item.name || item.title).toLowerCase() === name, label);
    if (match) resolved[field] = match.id;
  };
  if (collection === "opportunities") link("partnerAccountId", "partnerAccountName", workspace.accounts, "partner account");
  if (collection === "accounts") {
    if ("originatingContactId" in supplied || "originatingContactName" in supplied) link("originatingContactId", "originatingContactName", workspace.contacts, "originating person");
    if ("referrerContactId" in supplied || "referrerContactName" in supplied) link("referrerContactId", "referrerContactName", workspace.contacts, "referrer");
    if ("checkInContactId" in supplied || "checkInContactName" in supplied) link("checkInContactId", "checkInContactName", workspace.contacts.filter((item) => item.accountId === resolved.id), "check-in person");
    if ("checkInTaskId" in supplied || "checkInTaskName" in supplied) {
      link("checkInTaskId", "checkInTaskName", workspace.tasks.filter((item) => taskBelongsToAccount(item, String(resolved.id || ""), workspace)), "covering task");
      if (resolved.checkInTaskId !== undefined && resolved.checkInTaskId !== null) resolved.checkInTaskId = String(resolved.checkInTaskId);
    }
  }
  if (["contacts", "activities", "opportunities", "partnerships", "projects"].includes(collection)) link("accountId", "accountName", workspace.accounts, "account");
  if (collection === "opportunities") link("primaryContactId", "primaryContactName", workspace.contacts.filter((item) => !resolved.accountId || item.accountId === resolved.accountId), "primary buying contact");
  if (collection === "activities") {
    link("contactId", "contactName", workspace.contacts.filter((item) => !resolved.accountId || item.accountId === resolved.accountId), "person");
    link("opportunityId", "opportunityName", workspace.opportunities.filter((item) => !resolved.accountId || item.accountId === resolved.accountId), "opportunity");
    link("projectId", "projectName", workspace.projects.filter((item) => !resolved.accountId || item.accountId === resolved.accountId), "project");
  }
  if (collection === "projects") link("opportunityId", "opportunityName", workspace.opportunities.filter((item) => !resolved.accountId || item.accountId === resolved.accountId), "opportunity");
  if (collection === "tasks") {
    if (!resolved.parentTaskName && resolved.parentName) resolved.parentTaskName = resolved.parentName;
    link("parentId", "parentTaskName", workspace.tasks.filter((item) => !item.done && item.parentId === undefined), "parent task");
    const collectionForType: Record<string, keyof WorkspaceState> = { account: "accounts", contact: "contacts", opportunity: "opportunities", partnership: "partnerships", project: "projects", content: "content", campaign: "campaigns" };
    const target = collectionForType[String(resolved.relatedType)];
    if (target) {
      if (!resolved.relatedName && resolved.relatedType === "campaign") resolved.relatedName = resolved.campaignName;
      link("relatedId", "relatedName", workspace[target] as Array<{id: string | number; name?: string; title?: string; archivedAt?: string}>, "linked record");
    }
  }
  if (["content", "activities"].includes(collection)) link("campaignId", "campaignName", workspace.campaigns, "campaign");
  return resolved;
}

function findRecordIndex(items: Array<Record<string, unknown>>, action: RawAction) {
  const targetId = typeof action.recordId === "string" || typeof action.recordId === "number" ? String(action.recordId) : "";
  if (targetId) return items.findIndex((item) => String(item.id) === targetId && !item.archivedAt);
  const name = text(action.recordName).toLowerCase();
  if (!name) return -1;
  const found = uniqueMatch(items, (item) => !item.archivedAt && text(item.name || item.title || item.summary || item.metricKey).toLowerCase() === name, "record name");
  return found ? items.indexOf(found) : -1;
}

function focusViolations(workspace: WorkspaceState) {
  const accounts = workspace.accounts.filter((item) => !item.archivedAt && item.focus531);
  const issues = new Map<string, number>([["Choose at most five focus accounts.", Math.max(0, accounts.length - MAX_FOCUS_ACCOUNTS)]]);
  for (const account of accounts) issues.set(`Choose at most three focus people per account: ${account.name} (${account.id}).`, Math.max(0, workspace.contacts.filter((item) => !item.archivedAt && item.accountId === account.id && item.focus531).length - MAX_FOCUS_CONTACTS_PER_ACCOUNT));
  for (const person of workspace.contacts.filter((item) => !item.archivedAt && item.focus531 && !accounts.some((account) => account.id === item.accountId))) issues.set(`A focus person must belong to a selected focus account: ${person.id}.`, 1);
  return issues;
}

function validateSuppliedChoices(data: Record<string, unknown>, cleaned: Record<string, unknown>) {
  for (const key of ["clientStatus", "checkInCadence", "outreachPreference", "purpose", "isPartner"]) {
    if (key in data && data[key] !== cleaned[key]) throw new Error(`The proposed ${key} value is not supported. Clarify the value before applying it.`);
  }
  for (const key of ["lastCheckIn", "nextCheckIn", "nextMeetingDate"]) {
    if (key in data && data[key] !== "" && (typeof data[key] !== "string" || !validMetricDate(data[key] as string))) throw new Error(`The proposed ${key} must be a valid calendar date or an empty string to clear it.`);
  }
  if ("sourceDate" in data && data.sourceDate !== "" && (typeof data.sourceDate !== "string" || !validMetricDate(data.sourceDate))) throw new Error("The proposed sourceDate must be a valid calendar date or an empty string to clear it.");
  if (typeof data.lastCheckIn === "string" && data.lastCheckIn > metricDay()) throw new Error("Last meaningful contact cannot be in the future.");
  if (cleaned.metricType === "Check-in completed" && (!validMetricDate(String(cleaned.occurredAt || "")) || String(cleaned.occurredAt) > metricDay())) throw new Error("A completed check-in needs its actual date, today or earlier.");
  for (const key of ["stage", "status", "type", "motion", "salesRoute", "acquisitionMotion", "partnerCategory", "engagementPhase", "phase", "workArea", "projectType", "playbook", "forecast", "commercialStatus", "operationalStatus", "health", "buyingRole", "relationshipStrength", "lifecycleStage", "channel", "metricType", "nextActionType", "priority", "recurrence", "effort", "relatedType", "visibility", "workspaceId", "format", "stream", "reviewStatus", "companySizeBand", "valueConfidence", "revenueModel", "timeToRevenue", "seriousness", "decisionAccess", "stakeholderCoverage", "strategicFit", "expansionPotential"]) {
    if (key in data && key in cleaned && data[key] !== cleaned[key]) throw new Error(`The proposed ${key} value is not supported. Clarify the value before applying it.`);
  }
}

export function applyAgentWorkspaceActions(
  workspace: WorkspaceState,
  rawActions: unknown,
): { workspace: WorkspaceState; actions: AgentWorkspaceAction[] } {
  if (!Array.isArray(rawActions)) throw new Error("The agent did not return a valid action list.");
  if (rawActions.length > 12) throw new Error("The agent proposed too many changes at once. Ask it to split the work into smaller batches.");
  const next = structuredClone(workspace);
  const actions: AgentWorkspaceAction[] = [];

  for (const candidate of rawActions) {
    if (!candidate || typeof candidate !== "object") continue;
    const raw = candidate as RawAction;
    const type = text(raw.type).toLowerCase() as AgentWorkspaceAction["type"];
    const collection = collectionName(raw.collection);
    if (!actionTypes.has(type) || !collection) continue;
    if (type === "complete" && collection !== "tasks") continue;
    const rawData = record(raw.data);
    if ("archivedAt" in rawData) throw new Error("SOSA cannot archive or restore records through a proposal.");
    if ("ownerProfileId" in rawData || "approverProfileId" in rawData) throw new Error("Stable identity IDs must come from Spej identity mapping, not a SOSA proposal.");
    if (collection === "activities" && ("sourceArtifactId" in rawData || "sourceLabel" in rawData)) throw new Error("Activity source provenance is server-controlled and cannot be supplied or changed by a SOSA proposal.");
    const reviewedContextFields: Record<string, string[]> = {
      accounts: ["originalSource", "contextFacts", "connections", "nurturePlan", "outreachHold", "aiProfile"],
      contacts: ["relationshipRoles", "employmentHistory", "nurture"],
      projects: ["deliveryContext", "adoptionOutcome", "progressUpdates", "resources", "linkedRecords"],
      activities: ["capturedAt", "captureMethod", "sourceDateKnown"],
      opportunities: ["actionState", "valueMeaning", "discoveryEconomics"],
    };
    if (reviewedContextFields[collection]?.some((field) => field in rawData)) throw new Error("Relationship evidence, outreach holds, source history, action commitments, amount meaning, and delivery context require human review in the relevant record panel.");
    if (collection === "tasks" && rawData.done === true && type !== "complete") throw new Error("Use the complete action so task and subtask completion checks run.");
    if (collection === "opportunities") {
      const derivedFields = ["strategicValue", "winReadiness", "actionUrgency", "confidence", "attentionTier", "actionWindow", "recommendedCadence", "priorityIndex", "scoringVersion"];
      if (derivedFields.some((field) => field in rawData)) throw new Error("SOSA cannot write calculated priority fields. Spej OS calculates them from reviewed CRM inputs.");
      const humanOnlyFields = ["priorityStatus", "priorityReviewedAt", "attentionOverride", "attentionOverrideReason", "priorityEvidenceSourceIds"];
      if (humanOnlyFields.some((field) => field in rawData)) throw new Error("Priority confirmation, overrides, review dates, and trusted evidence IDs require a human or trusted integration.");
      if ("annualRevenuePotential" in rawData && (typeof rawData.annualRevenuePotential !== "number" || !Number.isFinite(rawData.annualRevenuePotential) || rawData.annualRevenuePotential < 0)) throw new Error("Potential annual revenue must be a non-negative number.");
    }
    if (collection === "accounts" && "sourceArtifactId" in rawData) throw new Error("Trusted source evidence IDs must come from an approved integration, not a SOSA proposal.");
    let data = type === "create" ? bindPreviewIdentity(resolveReferences(next, collection, rawData), rawData) : rawData;

    if (type === "create") {
      const cleaned = cleanCollectionRecord(collection, { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
      if (!cleaned) continue;
      if (collection === "tasks") {
        const task = cleaned as WorkspaceState["tasks"][number];
        const parent = next.tasks.find((item) => String(item.id) === String(task.parentId));
        if (parent) Object.assign(task, inheritedTaskAccess(parent, task));
      }
      validateSuppliedChoices(data, cleaned as unknown as Record<string, unknown>);
      if (collection === "projects") {
        const project = cleaned as WorkspaceState["projects"][number];
        if (project.workArea === "Client Delivery" && !project.accountId) throw new Error("A new Client Delivery project needs a related CRM account.");
      }
      if (collection === "content") { const item = cleaned as ContentItem; const issue = contentPublicationIssue(item.stage, item.publishDate); if (issue) throw new Error(issue); }
      let appliedType: AgentWorkspaceAction["type"] = type;
      if (collection === "marketingMetrics") {
        const oldIds = new Set(next.marketingMetrics.map((item) => item.id));
        next.marketingMetrics = upsertMarketingMetric(next.marketingMetrics, cleaned as WorkspaceState["marketingMetrics"][number]);
        cleaned.id = next.marketingMetrics[0].id;
        if (oldIds.has(String(cleaned.id))) appliedType = "update";
      } else {
        (next[collection] as unknown[]).unshift(cleaned);
      }
      actions.push({
        id: crypto.randomUUID(), type: appliedType, collection,
        recordId: (cleaned as { id: string | number }).id,
        label: text(raw.label, `${appliedType === "update" ? "Update" : "Create"} ${displayName(cleaned)}`, 180),
        reason: text(raw.reason, "Requested in the conversation.", 400),
        data: cleaned as unknown as Record<string, unknown>,
      });
      continue;
    }

    const items = next[collection] as unknown as Array<Record<string, unknown>>;
    const index = findRecordIndex(items, raw);
    if (index < 0) continue;
    const current = items[index];
    if (type === "complete") {
      if (hasOpenSubtasks(next.tasks, current.id as string | number)) continue;
      const updated = completeTaskItems(next.tasks, current.id as string | number, { expectedDue: String(current.due || "") });
      if (updated === next.tasks) continue;
      next.tasks = updated;
      actions.push({
        id: crypto.randomUUID(), type, collection,
        recordId: current.id as string | number,
        label: text(raw.label, `Complete ${displayName(current)}`, 180),
        reason: text(raw.reason, "Marked complete from the conversation.", 400),
        data: {},
      });
      continue;
    }

    const linkedData = { ...current, ...data };
    for (const [idField, nameField] of [["accountId", "accountName"], ["partnerAccountId", "partnerAccountName"], ["primaryContactId", "primaryContactName"], ["contactId", "contactName"], ["originatingContactId", "originatingContactName"], ["referrerContactId", "referrerContactName"], ["checkInContactId", "checkInContactName"], ["checkInTaskId", "checkInTaskName"], ["campaignId", "campaignName"], ["parentId", "parentTaskName"], ["relatedId", "relatedName"]]) {
      if (data[nameField] && !(idField in data)) delete linkedData[idField];
    }
    data = bindPreviewIdentity(resolveReferences(next, collection, linkedData, rawData), rawData);
    const cleaned = cleanCollectionRecord(collection, { ...data, id: current.id, createdAt: current.createdAt });
    if (!cleaned) continue;
    if (collection === "tasks") {
      const task = cleaned as WorkspaceState["tasks"][number];
      const parent = next.tasks.find((item) => String(item.id) === String(task.parentId));
      if (parent) Object.assign(task, inheritedTaskAccess(parent, task));
    }
    validateSuppliedChoices(rawData, cleaned as unknown as Record<string, unknown>);
    if (collection === "projects") {
      const before = current as unknown as WorkspaceState["projects"][number];
      const project = cleaned as WorkspaceState["projects"][number];
      const existingLegacyGap = before.workArea === "Client Delivery" && !before.accountId;
      if (project.workArea === "Client Delivery" && !project.accountId && !existingLegacyGap) throw new Error("A Client Delivery project needs a related CRM account.");
    }
    if (collection === "content") { const item = cleaned as ContentItem; const issue = contentPublicationIssue(item.stage, item.publishDate); if (issue) throw new Error(issue); }
    if (collection === "marketingMetrics") {
      next.marketingMetrics = upsertMarketingMetric(next.marketingMetrics, cleaned as WorkspaceState["marketingMetrics"][number], String(current.id));
      cleaned.id = next.marketingMetrics[0].id;
    } else {
      items[index] = cleaned as unknown as Record<string, unknown>;
    }
    actions.push({
      id: crypto.randomUUID(), type, collection,
      recordId: cleaned.id,
      label: text(raw.label, `Update ${displayName(current)}`, 180),
      reason: text(raw.reason, "Requested in the conversation.", 400),
      data: Object.fromEntries(Object.entries(cleaned).filter(([key, value]) => !["id", "createdAt"].includes(key) && JSON.stringify(value) !== JSON.stringify(current[key])).map(([key,value]) => [key, value === undefined ? null : value])),
    });
  }
  const previousIssues = focusViolations(workspace);
  for (const [issue, count] of focusViolations(next)) if (count > (previousIssues.get(issue) || 0)) throw new Error(issue);
  for (const account of next.accounts.filter((item) => !item.archivedAt)) {
    const previous = workspace.accounts.find((item) => item.id === account.id);
    const previousPlanIssues = new Set(previous ? clientPlanIssues(previous, workspace) : []);
    for (const issue of clientPlanIssues(account, next)) if (!previousPlanIssues.has(issue)) throw new Error(issue);
  }
  return { workspace: next, actions };
}
