import type { AccountItem, ActivityItem, ContactItem, ContentItem, OpportunityItem } from "./types";
import { cleanAcquisitionMotion } from "./gtm-sources";

export const ACTIVITY_METRIC_TYPES = ["Outreach sent", "Follow-up sent", "Reply received", "Call attempted", "Call connected", "Incoming call connected", "Meeting booked", "Meeting held", "Meeting cancelled", "Meeting no-show", "Comment made", "Connection requested", "Check-in completed", "Other"] as const;
export const ACTIVITY_PURPOSES = ["Unclassified", "Business development", "Client relationship", "Partner relationship"] as const;
export const CONTACT_LIFECYCLES = ["Unclassified", "Prospect", "Lead", "Customer", "Partner", "Network"] as const;
export const ACTIVITY_CHANNELS = ["LinkedIn 5-3-1", "LinkedIn", "Email", "Text / SMS", "WhatsApp", "Meeting", "Call", "Referral", "Event", "Content", "Other"] as const satisfies readonly ActivityItem["channel"][];

export function validMetricDate(value: string | undefined): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function metricMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function metricDay(date = new Date()) {
  return `${metricMonth(date)}-${String(date.getDate()).padStart(2, "0")}`;
}

export function inMetricPeriod(value: string | undefined, period: string, through = metricDay()) {
  const date = value?.includes("T") && Number.isFinite(Date.parse(value)) ? metricDay(new Date(value)) : value;
  return Boolean(validMetricDate(date) && date!.startsWith(`${period}-`) && date! <= through);
}

export type GtmMetricRecords = {
  accounts: AccountItem[];
  contacts: ContactItem[];
  activities: ActivityItem[];
  opportunities: OpportunityItem[];
  content: ContentItem[];
};

const outreachTypes: Array<ActivityItem["metricType"]> = ["Outreach sent", "Follow-up sent", "Call attempted", "Call connected", "Connection requested"];
// Preserve historical totals, but report missing purpose separately instead of
// relabeling legacy records as confirmed prospecting. Explicit care is excluded.
const inProspectingTotals = (item: ActivityItem) => item.purpose !== "Client relationship" && item.purpose !== "Partner relationship";

/** Counts observable period events, never unrelated funnel conversion rates. */
export function gtmMetrics(records: GtmMetricRecords, period: string, through = metricDay()) {
  const inPeriod = (value: string | undefined) => inMetricPeriod(value, period, through);
  const activities = records.activities.filter((item) => !item.archivedAt && inPeriod(item.occurredAt));
  const businessActivities = activities.filter(inProspectingTotals);
  const count = (type: ActivityItem["metricType"]) => businessActivities.filter((item) => item.metricType === type).length;
  const outreach = businessActivities.filter((item) => outreachTypes.includes(item.metricType));
  const knownPeople = new Set(records.contacts.filter((item) => !item.archivedAt).map((item) => item.id));
  const contactedIds = new Set(outreach.filter((item) => knownPeople.has(item.contactId)).map((item) => item.contactId));
  const earlierPeople = new Set(records.activities.filter((item) => !item.archivedAt && inProspectingTotals(item) && outreachTypes.includes(item.metricType) && validMetricDate(item.occurredAt) && item.occurredAt < `${period}-01`).map((item) => item.contactId));
  const contacts = records.contacts.filter((item) => !item.archivedAt);
  const opportunities = records.opportunities.filter((item) => !item.archivedAt);
  const published = records.content.filter((item) => item.stage === "Published" && inPeriod(item.publishDate));
  const newOpportunities = opportunities.filter((item) => inPeriod(item.createdAt));
  const wins = opportunities.filter((item) => item.stage === "Closed Won" && inPeriod(item.closeDate));
  const sources = new Map<string, { source: string; people: number; leads: number; opportunities: number; wins: number }>();
  const sourceRow = (source: string) => {
    const key = source.trim().toLowerCase() || "unknown / needs review";
    if (!sources.has(key)) sources.set(key, { source: source.trim() || "Unknown / Needs Review", people: 0, leads: 0, opportunities: 0, wins: 0 });
    return sources.get(key)!;
  };
  contacts.forEach((item) => { if (inPeriod(item.createdAt)) sourceRow(item.source).people++; if (inPeriod(item.leadDate)) sourceRow(item.source).leads++; });
  newOpportunities.forEach((item) => sourceRow(item.source).opportunities++);
  wins.forEach((item) => sourceRow(item.source).wins++);
  const acquisitions = new Map<string, { source: string; people: number; leads: number; opportunities: number; wins: number }>();
  const acquisitionRow = (value: unknown) => {
    const source = cleanAcquisitionMotion(value);
    if (!acquisitions.has(source)) acquisitions.set(source, { source, people: 0, leads: 0, opportunities: 0, wins: 0 });
    return acquisitions.get(source)!;
  };
  contacts.forEach((item) => { if (inPeriod(item.createdAt)) acquisitionRow(item.acquisitionMotion).people++; if (inPeriod(item.leadDate)) acquisitionRow(item.acquisitionMotion).leads++; });
  newOpportunities.forEach((item) => acquisitionRow(item.acquisitionMotion).opportunities++);
  wins.forEach((item) => acquisitionRow(item.acquisitionMotion).wins++);
  return {
    activities, outreach, published, newOpportunities, wins,
    clientCareActivities: activities.filter((item) => item.purpose === "Client relationship").length,
    partnerCareActivities: activities.filter((item) => item.purpose === "Partner relationship").length,
    unclassifiedPurposeActivities: activities.filter((item) => !item.purpose || item.purpose === "Unclassified").length,
    outreachCount: outreach.length,
    uniquePeople: contactedIds.size,
    firstContactedPeople: [...contactedIds].filter((id) => !earlierPeople.has(id)).length,
    unlinkedOutreach: outreach.filter((item) => !knownPeople.has(item.contactId)).length,
    unclassifiedActivities: activities.filter((item) => !item.metricType).length,
    replies: count("Reply received"), callsAttempted: count("Call attempted") + count("Call connected"), callsConnected: count("Call connected"),
    meetingsBooked: count("Meeting booked"), meetingsHeld: count("Meeting held"), meetingsCancelled: count("Meeting cancelled"), noShows: count("Meeting no-show"),
    comments: count("Comment made"), connections: count("Connection requested"), followUps: count("Follow-up sent"),
    newPeople: contacts.filter((item) => inPeriod(item.createdAt)).length,
    newProspects: contacts.filter((item) => item.lifecycleStage === "Prospect" && inPeriod(item.createdAt)).length,
    newLeads: contacts.filter((item) => inPeriod(item.leadDate)).length,
    undatedLeads: contacts.filter((item) => item.lifecycleStage === "Lead" && !validMetricDate(item.leadDate)).length,
    newAccounts: records.accounts.filter((item) => !item.archivedAt && inPeriod(item.createdAt)).length,
    openPipeline: opportunities.filter((item) => !item.stage.startsWith("Closed")).reduce((sum, item) => sum + item.value, 0),
    newPipeline: newOpportunities.reduce((sum, item) => sum + item.value, 0),
    wonValue: wins.reduce((sum, item) => sum + item.value, 0),
    undatedPublished: records.content.filter((item) => item.stage === "Published" && !validMetricDate(item.publishDate)).length,
    undatedWins: opportunities.filter((item) => item.stage === "Closed Won" && !validMetricDate(item.closeDate)).length,
    sourceRows: [...sources.values()].sort((a, b) => (b.people + b.opportunities) - (a.people + a.opportunities)),
    acquisitionRows: [...acquisitions.values()].sort((a, b) => (b.people + b.opportunities) - (a.people + a.opportunities)),
  };
}

/** Neutral deltas compare the same source set; no invented causal attribution. */
export function csvCell(value: string | number) {
  let text = String(value);
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
