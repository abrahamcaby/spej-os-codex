import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { cleanActivities, cleanContacts, cleanOpportunities, cleanPartnerships, cleanProjects } from "../lib/operations";
import { csvCell, gtmMetrics, inMetricPeriod, validMetricDate, type GtmMetricRecords } from "../lib/gtm-metrics";
import { cleanMarketingMetrics, latestMarketingMetrics, marketingMetricValue, upsertMarketingMetric } from "../lib/marketing-metrics";
import { OFFERING_LANES, filterGtmPartners, filterGtmProjects, filterSalesOpportunities } from "../lib/gtm-navigation";
import { applyAgentWorkspaceActions } from "../lib/agent-workspace";
import { initializeWorkspaceStore, readWorkspaceState, writeWorkspaceState } from "../lib/workspace-store";
import type { ContentItem, WorkspaceState } from "../lib/types";

const records = (values: Partial<GtmMetricRecords> = {}): GtmMetricRecords => ({ accounts: [], contacts: [], activities: [], opportunities: [], content: [], ...values });
const rollup = (values: Partial<GtmMetricRecords>) => gtmMetrics(records(values), "2026-08", "2026-08-31");
const activity = (id: string, metricType?: string, contactId = "p1", occurredAt = "2026-08-12") => cleanActivities([{ id, summary: id, metricType, contactId, occurredAt, channel: "Email" }])[0];
const person = (id = "p1") => cleanContacts([{ id, name: id, createdAt: "2026-08-02T00:00:00Z" }])[0];
const post = (changes: Partial<ContentItem> = {}): ContentItem => ({ id: "post", title: "Post", format: "LinkedIn", stream: "Spej Authority-building content", pillar: "Unassigned", stage: "Published", publishDate: "2026-08-02", angle: "", createdAt: "2026-01-01T00:00:00Z", ...changes });
const snapshot = (value: unknown, changes = {}) => ({ id: "m1", period: "2026-08", metricKey: "linkedin-posts", source: "Spej LinkedIn", value, updatedAt: "2026-08-20T00:00:00Z", ...changes });
const emptyWorkspace = (): WorkspaceState => ({ reminders: [], tasks: [], accounts: [], contacts: [], activities: [], content: [], opportunities: [], partnerships: [], projects: [], campaigns: [], marketingMetrics: [] });

test("outreach attempts count events while unique people count linked contact IDs", () => {
  const result = rollup({ contacts: [person()], activities: [activity("a", "Outreach sent"), activity("b", "Follow-up sent"), activity("c", "Call attempted"), activity("d", "Outreach sent", ""), activity("e", "Outreach sent", "missing")] });
  assert.equal(result.outreachCount, 5); assert.equal(result.uniquePeople, 1); assert.equal(result.unlinkedOutreach, 2); assert.equal(result.firstContactedPeople, 1);
});

test("first recorded contact uses prior typed history rather than every repeat month", () => {
  const result = rollup({ contacts: [person()], activities: [activity("before", "Outreach sent", "p1", "2026-07-31"), activity("this", "Outreach sent")] });
  assert.equal(result.uniquePeople, 1); assert.equal(result.firstContactedPeople, 0);
});

test("replies, profile reviews, comments and legacy notes are not outgoing attempts", () => {
  const result = rollup({ contacts: [person()], activities: [activity("reply", "Reply received"), activity("comment", "Comment made"), { ...activity("profile"), actionType: "Profile review" }, { ...activity("legacy"), channel: "Meeting" }] });
  assert.equal(result.outreachCount, 0); assert.equal(result.replies, 1); assert.equal(result.comments, 1); assert.equal(result.meetingsHeld, 0); assert.equal(result.unclassifiedActivities, 2);
});

test("booked, held, cancellation and no-show are independent dated events", () => {
  const data = [activity("booking", "Meeting booked", "p1", "2026-07-30"), activity("held", "Meeting held"), activity("cancel", "Meeting cancelled"), activity("no-show", "Meeting no-show")];
  const result = rollup({ activities: data });
  assert.equal(result.meetingsBooked, 0); assert.equal(result.meetingsHeld, 1); assert.equal(result.noShows, 1); assert.equal(result.meetingsCancelled, 1);
  assert.equal(gtmMetrics(records({ activities: data }), "2026-07", "2026-08-31").meetingsBooked, 1);
});

test("a connected outbound call is one attempt and one connection, without double entry", () => {
  const result = rollup({ contacts: [person()], activities: [activity("call", "Call connected")] });
  assert.equal(result.callsAttempted, 1); assert.equal(result.callsConnected, 1); assert.equal(result.outreachCount, 1); assert.equal(result.uniquePeople, 1);
});

test("future, archived and invalid-date activities are excluded", () => {
  const result = rollup({ contacts: [person()], activities: [activity("future", "Outreach sent", "p1", "2026-09-01"), { ...activity("archived", "Outreach sent"), archivedAt: "2026-08-15" }, activity("invalid", "Outreach sent", "p1", "2026-02-30")] });
  assert.equal(result.outreachCount, 0);
  assert.equal(inMetricPeriod("2026-08-31", "2026-08", "2026-08-20"), false);
});

test("publication counts use actual publication date, not draft or creation date", () => {
  const result = rollup({ content: [post(), post({ id: "blank", publishDate: "" }), post({ id: "draft", stage: "Drafting" }), post({ id: "future", publishDate: "2026-09-01" }), post({ id: "bad", publishDate: "2026-02-30" })] });
  assert.equal(result.published.length, 1); assert.equal(result.undatedPublished, 2);
});

test("people, prospects, leads and partners are not conflated", () => {
  const contacts = cleanContacts([
    { ...person("prospect"), lifecycleStage: "Prospect" },
    { ...person("partner"), lifecycleStage: "Partner" },
    { ...person("lead"), lifecycleStage: "Lead", leadDate: "2026-08-16" },
    { ...person("legacy") },
    { ...person("old-lead"), lifecycleStage: "Customer", leadDate: "2026-07-16" },
  ]);
  const result = rollup({ contacts });
  assert.equal(result.newPeople, 5); assert.equal(result.newProspects, 1); assert.equal(result.newLeads, 1);
  assert.equal(contacts[3].lifecycleStage, "Unclassified");
});

test("win dates never fall back to opportunity creation; current pipeline is separate", () => {
  const opportunities = cleanOpportunities([
    { id: "won", name: "Won", stage: "Closed Won", value: 50, closeDate: "2026-08-03", createdAt: "2026-07-01T00:00:00Z", source: "Partner" },
    { id: "undated", name: "No date", stage: "Closed Won", value: 500, createdAt: "2026-08-03T00:00:00Z" },
    { id: "open", name: "Open", stage: "Explore", value: 100, createdAt: "2026-08-03T00:00:00Z" },
    { id: "archive", name: "Archived", stage: "Explore", value: 1000, archivedAt: "2026-08-04" },
  ]);
  const result = rollup({ opportunities });
  assert.equal(result.wins.length, 1); assert.equal(result.wonValue, 50); assert.equal(result.openPipeline, 100); assert.equal(result.undatedWins, 1);
});

test("monthly totals preserve a genuine zero while rejecting empty and impossible inputs", () => {
  const items = cleanMarketingMetrics([snapshot(0), ...[null, undefined, "", " ", true, [], {}, -1, NaN, Infinity, 1.3].map((value) => snapshot(value))]);
  assert.equal(items.length, 1); assert.equal(items[0].value, 0);
  assert.equal(cleanMarketingMetrics([snapshot(101, { metricKey: "email-open-rate" })]).length, 0);
  assert.equal(cleanMarketingMetrics([snapshot(2, { period: "2026-08-garbage" })]).length, 0);
  assert.equal(marketingMetricValue([], "2026-08", "linkedin-posts"), undefined);
});

test("duplicate source snapshots take the latest total, not their sum", () => {
  const items = cleanMarketingMetrics([snapshot(5, { id: "old" }), snapshot(7, { id: "new", source: " spej linkedin ", updatedAt: "2026-08-21T00:00:00Z" }), snapshot(3, { id: "aby", source: "Aby LinkedIn" })]);
  assert.equal(latestMarketingMetrics(items).length, 2); assert.equal(marketingMetricValue(items, "2026-08", "linkedin-posts"), 10);
  assert.equal(marketingMetricValue(items, "2026-08", "linkedin-posts", "SPEJ LINKEDIN"), 7);
});

test("repeated imports with identical timestamps do not double count", () => {
  const items = cleanMarketingMetrics([snapshot(5, { id: "a" }), snapshot(5, { id: "b" })]);
  assert.equal(marketingMetricValue(items, "2026-08", "linkedin-posts"), 5);
});

test("source rates and average positions never get an unweighted cross-account average", () => {
  const items = cleanMarketingMetrics([snapshot(10, { metricKey: "email-open-rate", source: "List A" }), snapshot(50, { metricKey: "email-open-rate", source: "List B" })]);
  assert.equal(marketingMetricValue(items, "2026-08", "email-open-rate"), undefined);
  assert.equal(marketingMetricValue(items, "2026-08", "email-open-rate", "List A"), 10);
});

test("monthly input totals do not alter native published content count", () => {
  assert.equal(rollup({ content: [post()] }).published.length, 1);
  assert.equal(marketingMetricValue(cleanMarketingMetrics([snapshot(8)]), "2026-08", "linkedin-posts"), 8);
});

test("manual metric upsert replaces duplicates and retains a stable record ID", () => {
  const items = cleanMarketingMetrics([snapshot(3), snapshot(4, { id: "duplicate" })]);
  const next = cleanMarketingMetrics([snapshot(9, { id: "new" })])[0];
  const saved = upsertMarketingMetric(items, next);
  assert.equal(saved.length, 1); assert.equal(saved[0].id, "m1"); assert.equal(saved[0].value, 9);
});

test("Sosa uses the same metric upsert and returns the actual changed ID", () => {
  const workspace = emptyWorkspace(); workspace.marketingMetrics = cleanMarketingMetrics([snapshot(3)]);
  const result = applyAgentWorkspaceActions(workspace, [{ type: "create", collection: "marketingMetrics", data: snapshot(9) }]);
  assert.equal(result.workspace.marketingMetrics.length, 1); assert.equal(result.workspace.marketingMetrics[0].value, 9);
  assert.equal(result.actions[0].type, "update"); assert.equal(result.actions[0].recordId, "m1");
  assert.equal(workspace.marketingMetrics[0].value, 3);
});

test("structured activity fields survive Sosa and SQLite round trips", () => {
  const workspace = emptyWorkspace(); workspace.campaigns = [{ id: "camp", name: "Campaign", status: "Active", objective: "", audience: "", owner: "Aby", primaryChannel: "LinkedIn", startDate: "", endDate: "", successMeasure: "", notes: "", createdAt: "2026-08-01" }];
  const result = applyAgentWorkspaceActions(workspace, [{ type: "create", collection: "activities", data: { summary: "Booked demo", metricType: "Meeting booked", channel: "Email", owner: "Ken", occurredAt: "2026-08-02", campaignName: "Campaign" } }]);
  const database = initializeWorkspaceStore(new DatabaseSync(":memory:"));
  try { writeWorkspaceState(database, result.workspace); const saved = readWorkspaceState(database); assert.equal(saved.activities[0].metricType, "Meeting booked"); assert.equal(saved.activities[0].campaignId, "camp"); assert.equal(saved.activities[0].owner, "Ken"); } finally { database.close(); }
});

test("legacy activities stay unclassified and governed type values are enforced", () => {
  const [legacy, invalid] = cleanActivities([{ summary: "Meeting", channel: "Meeting" }, { summary: "Invalid type", metricType: "Inferred success" }]);
  assert.equal(legacy.metricType, undefined); assert.equal(invalid.metricType, undefined);
});

test("offering and partner route remain independent and legacy motions remain valid", () => {
  const opportunities = cleanOpportunities([{ name: "AI Office through MSP", motion: "AI Office", salesRoute: "Partner-sourced", partnerAccountId: "msp", engagementPhase: "Discovery" }, { name: "Legacy MSP", motion: "MSP / Partner" }]);
  assert.equal(opportunities[0].motion, "AI Office"); assert.equal(opportunities[0].salesRoute, "Partner-sourced"); assert.equal(opportunities[0].partnerAccountId, "msp"); assert.equal(opportunities[1].motion, "MSP / Partner");
  const found = filterSalesOpportunities(opportunities, [], { stage: "Active", motion: "AI Office", route: "Partner-sourced", phase: "Discovery", query: "" });
  assert.equal(found.length, 1);
});

test("needs-next-step filter excludes closed deals", () => {
  const opportunities = cleanOpportunities([{ name: "Closed", stage: "Closed Won" }, { name: "Open", stage: "Explore" }]);
  assert.equal(filterSalesOpportunities(opportunities, [], { stage: "Needs next step", motion: "", phase: "", route: "", query: "" }).length, 1);
});

test("Plooms is a primary offering and unknown products stay unclassified", () => {
  const opportunities = cleanOpportunities([{ name: "Plooms pilot", motion: "Plooms", salesRoute: "Direct" }, { name: "Unrelated product", motion: "Unrelated product" }]);
  assert.deepEqual(OFFERING_LANES.map((lane) => lane.motion), ["AI Office", "Plooms", "Individual Project"]);
  const found = filterSalesOpportunities(opportunities, [], { stage: "Active", motion: "Plooms", route: "", phase: "", query: "" });
  assert.equal(found.length, 1); assert.equal(found[0].name, "Plooms pilot");
  assert.equal(opportunities[1].motion, "Other");
  const result = applyAgentWorkspaceActions(emptyWorkspace(), [{ type: "create", collection: "opportunities", data: { name: "Plooms pilot", motion: "Plooms", salesRoute: "Partner-sourced" } }]);
  const database = initializeWorkspaceStore(new DatabaseSync(":memory:"));
  try { writeWorkspaceState(database, result.workspace); assert.equal(readWorkspaceState(database).opportunities[0].motion, "Plooms"); } finally { database.close(); }
});

test("older records with missing optional classifications remain filterable", () => {
  const opportunity = { ...cleanOpportunities([{ name: "Old record" }])[0], motion: undefined, salesRoute: undefined, engagementPhase: undefined };
  assert.equal(filterSalesOpportunities([opportunity], [], { stage: "Active", motion: "Other", route: "Unclassified", phase: "Not Applicable", query: "" }).length, 1);
});

test("project work area and optional DDD phase filter without modifying stored records", () => {
  const projects = cleanProjects([{ name: "Discovery", phase: "Discovery", operationalStatus: "Active" }, { name: "Design", phase: "Design" }, { name: "Marketing", phase: "Internal" }]);
  assert.equal(filterGtmProjects(projects, "Client projects", "Discovery", "Active").length, 1);
  assert.equal(filterGtmProjects(projects, "Internal GTM", "", "").length, 1);
  assert.equal(projects[2].workArea, "GTM");
  assert.equal(projects[2].phase, "Not Applicable");
  assert.equal(projects.length, 3);
});

test("partner category does not overwrite the relationship mechanism", () => {
  const partners = cleanPartnerships([{ name: "Provider", type: "Referral", partnerCategory: "MSP", stage: "Active" }]);
  assert.equal(partners[0].type, "Referral"); assert.equal(partners[0].partnerCategory, "MSP");
  assert.equal(filterGtmPartners(partners, "MSP", "Active", "provider").length, 1);
});

test("date validation rejects impossible dates and permits valid leap days", () => {
  assert.equal(validMetricDate("2026-02-29"), false); assert.equal(validMetricDate("2028-02-29"), true);
  assert.equal(validMetricDate("2026-08-32"), false); assert.equal(validMetricDate("2026-08-31"), true);
});

test("timestamp creation dates are grouped by the same local calendar as reporting months", () => {
  const timestamp = new Date(2026, 7, 31, 23, 30).toISOString();
  assert.equal(inMetricPeriod(timestamp, "2026-08", "2026-08-31"), true);
  assert.equal(inMetricPeriod("2026-09-01", "2026-08", "2026-08-31"), false);
});

test("correcting a source label replaces its old identity and hidden duplicates", () => {
  const items = cleanMarketingMetrics([snapshot(3, { id: "typo", source: "Spej LinkdIn" }), snapshot(2, { id: "old", source: "Spej LinkdIn", updatedAt: "2026-08-19T00:00:00Z" })]);
  const result = upsertMarketingMetric(items, cleanMarketingMetrics([snapshot(7)])[0], "typo");
  assert.equal(result.length, 1); assert.equal(result[0].id, "typo"); assert.equal(result[0].source, "Spej LinkedIn");
});

test("Sosa source corrections cannot leave a duplicate monthly total", () => {
  const workspace = emptyWorkspace(); workspace.marketingMetrics = cleanMarketingMetrics([snapshot(3, { source: "Spej LinkdIn" })]);
  const result = applyAgentWorkspaceActions(workspace, [{ type: "update", collection: "marketingMetrics", recordId: "m1", data: { source: "Spej LinkedIn", value: 7 } }]);
  assert.equal(result.workspace.marketingMetrics.length, 1); assert.equal(result.workspace.marketingMetrics[0].source, "Spej LinkedIn");
});

test("scorecard CSV neutralizes formula text and escapes quotes", () => {
  assert.equal(csvCell("=HYPERLINK(1)"), '"\'=HYPERLINK(1)"');
  assert.equal(csvCell('a"b'), '"a""b"');
  assert.equal(csvCell(12), '"12"');
});
