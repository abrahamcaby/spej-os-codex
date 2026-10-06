import type { ContentItem, ContentStage, ContentStream, ReminderItem, WorkspaceState } from "./types";
import { cleanTaskItems, normalizeTaskHierarchy } from "./tasks";
import { cleanAccounts, cleanActivities, cleanContacts, cleanOpportunities, cleanPartnerships, cleanProjects } from "./operations";
import { cleanMarketingMetrics } from "./marketing-metrics";
import { normalizeContentCategory } from "./content-taxonomy";
import { cleanCampaigns } from "./campaigns";

function cleanId(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? value : crypto.randomUUID();
}

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function cleanReminders(value: unknown): ReminderItem[] {
  if (!Array.isArray(value)) throw new Error("Reminders must be a list.");
  if (value.length > 10_000) throw new Error("The reminder list is too large.");
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<ReminderItem>;
    const title = cleanText(candidate.title).trim();
    if (!title) return [];
    return [{
      id: cleanId(candidate.id),
      type: cleanText(candidate.type, candidate.url ? "Link" : "Saved"),
      title,
      source: cleanText(candidate.source, "Manual"),
      note: cleanText(candidate.note, "Saved for later."),
      accent: cleanText(candidate.accent, "teal"),
      url: cleanText(candidate.url) || undefined,
      createdAt: cleanText(candidate.createdAt) || undefined,
      archivedAt: cleanText(candidate.archivedAt) || undefined,
      added: cleanText(candidate.added) || undefined,
    }];
  });
}

const contentStages = new Set<ContentStage>(["Idea", "Research", "Drafting", "Production", "Scheduled", "Published"]);
const contentFormats = new Set<ContentItem["format"]>(["YouTube", "Newsletter", "LinkedIn", "Short-form", "Article", "Other"]);
const contentStreams = new Set<ContentStream>(["Personal LinkedIns", "Spej Authority-building content"]);
const contentReviewStatuses = new Set<ContentItem["reviewStatus"]>(["Not Requested", "Pending Review", "Changes Requested", "Approved"]);

function cleanContent(value: unknown): ContentItem[] {
  if (!Array.isArray(value)) throw new Error("Content must be a list.");
  if (value.length > 10_000) throw new Error("The content list is too large.");
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<ContentItem>;
    const title = cleanText(candidate.title).trim().slice(0, 300);
    if (!title) return [];
    const stream = contentStreams.has(candidate.stream as ContentStream)
      ? candidate.stream as ContentStream
      : "Spej Authority-building content";
    return [{
      id: String(cleanId(candidate.id)),
      title,
      format: contentFormats.has(candidate.format as ContentItem["format"]) ? candidate.format as ContentItem["format"] : "Other",
      stage: contentStages.has(candidate.stage as ContentStage) ? candidate.stage as ContentStage : "Idea",
      publishDate: cleanText(candidate.publishDate).slice(0, 10),
      angle: cleanText(candidate.angle).trim().slice(0, 2_000),
      pillar: normalizeContentCategory(stream, candidate.pillar, candidate.angle),
      stream,
      owner: cleanText(candidate.owner, "Unassigned").trim().slice(0, 120) || "Unassigned",
      ownerProfileId: cleanText(candidate.ownerProfileId).trim().slice(0, 200) || undefined,
      approver: cleanText(candidate.approver, "Unassigned").trim().slice(0, 120) || "Unassigned",
      approverProfileId: cleanText(candidate.approverProfileId).trim().slice(0, 200) || undefined,
      reviewStatus: contentReviewStatuses.has(candidate.reviewStatus) ? candidate.reviewStatus : "Not Requested",
      reviewDue: /^\d{4}-\d{2}-\d{2}$/.test(cleanText(candidate.reviewDue).slice(0, 10)) ? cleanText(candidate.reviewDue).slice(0, 10) : "",
      campaignId: cleanText(candidate.campaignId).trim().slice(0, 100) || undefined,
      sourceUrl: cleanText(candidate.sourceUrl).trim().slice(0, 2_000) || undefined,
      createdAt: cleanText(candidate.createdAt, new Date().toISOString()),
    }];
  });
}

export function normalizeWorkspace(body: Partial<WorkspaceState>): WorkspaceState {
    return {
      reminders: cleanReminders(body.reminders),
      tasks: normalizeTaskHierarchy(cleanTaskItems(body.tasks)),
      content: cleanContent(body.content ?? []),
      accounts: cleanAccounts(body.accounts ?? []),
      contacts: cleanContacts(body.contacts ?? []),
      activities: cleanActivities(body.activities ?? []),
      opportunities: cleanOpportunities(body.opportunities ?? []),
      partnerships: cleanPartnerships(body.partnerships ?? []),
      projects: cleanProjects(body.projects ?? []),
      campaigns: cleanCampaigns(body.campaigns ?? []),
      marketingMetrics: cleanMarketingMetrics(body.marketingMetrics ?? []),
    };
}
