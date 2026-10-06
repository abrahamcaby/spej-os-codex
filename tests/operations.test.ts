import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { cleanAccounts, cleanActivities, cleanContacts, cleanOpportunities, cleanPartnerships, cleanProjects } from "../lib/operations";
import { initializeWorkspaceStore, readWorkspaceState, writeWorkspaceState } from "../lib/workspace-store";
import { cleanMarketingMetrics, marketingMetricValue } from "../lib/marketing-metrics";
import { cleanCampaigns } from "../lib/campaigns";
import { preserveEmploymentHistory } from "../lib/relationship-context";

test("operating records use governed values and preserve unknown relationship sources", () => {
  const [account] = cleanAccounts([{ id: "a1", name: "Example", type: "Invalid", status: "Active", owner: "Aby" }]);
  const [opportunity] = cleanOpportunities([{ id: "o1", accountId: "a1", name: "Adoption program", stage: "Invalid", forecast: "Commit", value: "25000", source: "LinkedIn 5-3-1" }]);
  assert.equal(account.type, "Prospect");
  assert.equal(opportunity.stage, "Explore");
  assert.equal(opportunity.forecast, "Commit");
  assert.equal(opportunity.value, 25_000);
  assert.equal(opportunity.source, "LinkedIn 5-3-1");
});

test("priority inputs normalize safely and persist without calculated scores", () => {
  const [account] = cleanAccounts([{ id: "a1", name: "Example", companySizeBand: "1,000-4,999" }]);
  const [opportunity] = cleanOpportunities([{
    id: "o1", accountId: "a1", name: "Expansion", value: "750000", valueConfidence: "Validated",
    annualRevenuePotential: "250000", revenueModel: "Mixed", timeToRevenue: "31-90 days", seriousness: "Active buying",
    primaryContactId: "c1", decisionAccess: "Decision maker", stakeholderCoverage: "Multi-threaded", strategicFit: "High", expansionPotential: "High",
    priorityEvidence: "Confirmed in a reviewed meeting.", priorityEvidenceSourceIds: ["meeting:123", "", 42, "meeting:123"], priorityStatus: "Human confirmed", priorityReviewedAt: "2026-09-02",
    attentionOverride: "Priority", attentionOverrideReason: "Weekly account-plan review.", priorityIndex: 99,
  }]);
  assert.equal(account.companySizeBand, "1,000-4,999");
  assert.equal(opportunity.annualRevenuePotential, 250_000);
  assert.equal(opportunity.decisionAccess, "Decision maker");
  assert.deepEqual(opportunity.priorityEvidenceSourceIds, ["meeting:123", "meeting:123"]);
  assert.equal("priorityIndex" in opportunity, false);

  const [invalid] = cleanOpportunities([{ name: "Invalid", annualRevenuePotential: -50, seriousness: "Certain", decisionAccess: "CEO" }]);
  assert.equal(invalid.annualRevenuePotential, 0);
  assert.equal(invalid.seriousness, "Unknown");
  assert.equal(invalid.decisionAccess, "Unknown");
});

test("5-3-1 activity remains separate from opportunities and partnerships", () => {
  const [activity] = cleanActivities([{ summary: "Commented on the buyer's post", channel: "LinkedIn 5-3-1", occurredAt: "2026-08-27" }]);
  const [partnership] = cleanPartnerships([{ name: "Referral motion", type: "Referral", stage: "Engaging" }]);
  assert.equal(activity.channel, "LinkedIn 5-3-1");
  assert.equal(partnership.type, "Referral");
  assert.equal(partnership.stage, "Engaging");
});

test("project cleaning migrates legacy phases and preserves the broader project taxonomy", () => {
  const [legacyClient, legacyGtm, partialLegacyGtm, modern] = cleanProjects([
    { id: "legacy-client", name: "Legacy discovery", phase: "Discovery" },
    { id: "legacy-gtm", name: "Legacy internal", phase: "Internal" },
    { id: "partial-legacy-gtm", name: "Partially classified internal", phase: "Internal", workArea: "GTM" },
    { id: "modern", name: "Plooms rollout", phase: "Not Applicable", workArea: "Client Delivery", projectType: "Plooms", playbook: "Plooms Implementation", opportunityId: "o1", endDate: "2026-12-01", updatedAt: "2026-09-01T12:00:00Z" },
  ]);
  assert.deepEqual([legacyClient.workArea, legacyClient.projectType, legacyClient.playbook, legacyClient.phase], ["Client Delivery", "Client Project", "Discovery / Design / Delivery", "Discovery"]);
  assert.deepEqual([legacyGtm.workArea, legacyGtm.projectType, legacyGtm.playbook, legacyGtm.phase], ["GTM", "Internal Initiative", "Not set", "Not Applicable"]);
  assert.deepEqual([partialLegacyGtm.workArea, partialLegacyGtm.projectType, partialLegacyGtm.playbook, partialLegacyGtm.phase], ["GTM", "Internal Initiative", "Not set", "Not Applicable"]);
  assert.deepEqual([modern.workArea, modern.projectType, modern.playbook, modern.phase, modern.opportunityId, modern.endDate], ["Client Delivery", "Plooms", "Plooms Implementation", "Not Applicable", "o1", "2026-12-01"]);
});

test("projects retain only safe, deduplicated references to canonical Spej records", () => {
  const [project] = cleanProjects([{ name: "Connected delivery", linkedRecords: [
    { sourceSystem: "SharePoint", recordType: "document", externalId: "doc-1", title: "Approved scope", url: "https://example.sharepoint.com/doc-1" },
    { sourceSystem: "SharePoint", recordType: "document", externalId: "doc-1", title: "Duplicate" },
    { sourceSystem: "Spej OS", recordType: "ticket", externalId: "ticket-9", status: "Open", url: "javascript:alert(1)" },
    { sourceSystem: "Unknown", recordType: "unknown", externalId: "fallback" },
    { sourceSystem: "Spej OS", recordType: "decision", externalId: "" },
  ] }]);
  assert.equal(project.linkedRecords?.length, 3);
  assert.deepEqual(project.linkedRecords?.[0], {
    sourceSystem: "SharePoint", recordType: "document", externalId: "doc-1", title: "Approved scope", status: undefined,
    url: "https://example.sharepoint.com/doc-1", updatedAt: undefined,
  });
  assert.equal(project.linkedRecords?.[1].url, undefined);
  assert.deepEqual([project.linkedRecords?.[2].sourceSystem, project.linkedRecords?.[2].recordType], ["Spej OS", "document"]);
});

test("expanded director workspace persists CRM, partnership, project and content records together", () => {
  const database = initializeWorkspaceStore(new DatabaseSync(":memory:"));
  const projects = cleanProjects([{ id: "p1", name: "Client discovery", phase: "Discovery", operationalStatus: "Active" }]);
  writeWorkspaceState(database, {
    reminders: [], tasks: [], content: [],
    accounts: cleanAccounts([{ id: "a1", name: "Example" }]),
    contacts: [], activities: [],
    opportunities: cleanOpportunities([{ id: "o1", accountId: "a1", name: "Adoption program" }]),
    partnerships: cleanPartnerships([{ id: "r1", accountId: "a1", name: "Co-selling" }]),
    projects,
    campaigns: cleanCampaigns([{ id: "c1", name: "AI Office campaign", status: "Active", objective: "Create qualified demand", audience: "Mid-market leaders", endDate: "2026-09-30" }]),
    marketingMetrics: cleanMarketingMetrics([{ id: "m1", period: "2026-08", metricKey: "linkedin-impressions", value: 4200, source: "Spej LinkedIn" }]),
  });
  const saved = readWorkspaceState(database);
  assert.equal(saved.accounts[0].name, "Example");
  assert.equal(saved.opportunities[0].accountId, "a1");
  assert.equal(saved.partnerships[0].name, "Co-selling");
  assert.equal(saved.projects[0].phase, "Discovery");
  assert.equal(saved.projects[0].workArea, "Client Delivery");
  assert.equal(saved.projects[0].projectType, "Client Project");
  assert.equal(saved.projects[0].playbook, "Discovery / Design / Delivery");
  assert.equal(saved.campaigns[0].status, "Active");
  assert.equal(saved.marketingMetrics[0].value, 4200);
});

test("marketing metrics use governed definitions and aggregate count sources", () => {
  const metrics = cleanMarketingMetrics([
    { period: "2026-08", metricKey: "linkedin-followers", value: 100, source: "Spej LinkedIn" },
    { period: "2026-08", metricKey: "linkedin-followers", value: 250, source: "Aby LinkedIn" },
    { period: "2026-13", metricKey: "linkedin-followers", value: 999 },
    { period: "2026-08", metricKey: "made-up", value: 999 },
  ]);
  assert.equal(metrics.length, 2);
  assert.equal(marketingMetricValue(metrics, "2026-08", "linkedin-followers"), 350);
  assert.equal(metrics[0].category, "LinkedIn & 5-3-1");
});

test("ordinary persisted account edits retain original attribution across later influences", () => {
  const database = initializeWorkspaceStore(new DatabaseSync(":memory:"));
  try {
    const initial = readWorkspaceState(database);
    initial.accounts = cleanAccounts([{ id: "a1", name: "Introduced account", source: "Alana referral", sourceDate: "2026-07-01", acquisitionMotion: "Referral", referrerContactId: "alana", sourceArtifactId: "original-email" }]);
    writeWorkspaceState(database, initial, "2026-08-01T12:00:00Z");
    const saved = readWorkspaceState(database);
    const original = saved.accounts[0].originalSource;
    saved.accounts[0] = { ...saved.accounts[0], source: "Later event", acquisitionMotion: "Event", originalSource: { source: "Replacement", acquisitionMotion: "Outbound", sourceDate: "2026-08-01" } };
    writeWorkspaceState(database, saved, "2026-09-08T12:00:00Z");
    const updated = readWorkspaceState(database);
    assert.deepEqual(updated.accounts[0].originalSource, original);
    assert.equal(updated.accounts[0].originalSource?.source, "Alana referral");
    assert.equal(updated.accounts[0].originalSource?.sourceDate, "2026-07-01");
    assert.equal(updated.accounts[0].source, "Later event");
  } finally { database.close(); }
});

test("ordinary employer edits preserve prior history and leave old activities with their account", () => {
  const database = initializeWorkspaceStore(new DatabaseSync(":memory:"));
  try {
    const initial = readWorkspaceState(database);
    initial.accounts = cleanAccounts([{ id: "old", name: "Original company" }, { id: "new", name: "New company" }]);
    initial.contacts = cleanContacts([{ id: "person", accountId: "old", name: "Contact", title: "Director", employmentHistory: [{ accountId: "earlier", title: "Manager", endedAt: "2025-01-01" }] }]);
    initial.activities = cleanActivities([{ id: "meeting", accountId: "old", contactId: "person", summary: "Original account conversation", metricType: "Meeting held", occurredAt: "2026-07-01" }]);
    writeWorkspaceState(database, initial, "2026-08-01T12:00:00Z");
    const changed = readWorkspaceState(database);
    changed.contacts[0] = { ...changed.contacts[0], accountId: "new", title: "VP", employmentHistory: [] };
    writeWorkspaceState(database, changed, "2026-09-08T12:00:00Z");
    const saved = readWorkspaceState(database);
    assert.equal(saved.contacts[0].accountId, "new");
    assert.deepEqual(saved.contacts[0].employmentHistory, [{ accountId: "old", title: "Director", endedAt: "" }, { accountId: "earlier", title: "Manager", endedAt: "2025-01-01" }]);
    assert.equal(saved.activities[0].accountId, "old");
    assert.equal(saved.activities[0].contactId, "person");
  } finally { database.close(); }
});

test("the first capture timestamp survives later activity edits without replacing its original event date", () => {
  const database = initializeWorkspaceStore(new DatabaseSync(":memory:"));
  try {
    const initial = readWorkspaceState(database);
    initial.activities = cleanActivities([{ id: "email", accountId: "a1", summary: "Forwarded old buyer reply", metricType: "Reply received", occurredAt: "2026-05-10", captureMethod: "Forwarded email", capturedAt: "2026-08-01T09:00:00Z", sourceDateKnown: true }]);
    writeWorkspaceState(database, initial, "2026-08-01T12:00:00Z");
    const changed = readWorkspaceState(database);
    changed.activities[0] = { ...changed.activities[0], summary: "Clarified the historical context", capturedAt: "2026-09-08T12:00:00Z" };
    writeWorkspaceState(database, changed, "2026-09-08T12:00:00Z");
    const saved = readWorkspaceState(database).activities[0];
    assert.equal(saved.capturedAt, "2026-08-01T09:00:00.000Z");
    assert.equal(saved.occurredAt, "2026-05-10");
    assert.equal(saved.captureMethod, "Forwarded email");
    assert.equal(saved.sourceDateKnown, true);
  } finally { database.close(); }
});

test("a UI-preserved employer move persists exactly once with its known or unknown historical date", () => {
  for (const endedAt of ["", "2026-03-15"]) {
    const database = initializeWorkspaceStore(new DatabaseSync(":memory:"));
    try {
      const initial = readWorkspaceState(database);
      initial.contacts = cleanContacts([{ id: "person", accountId: "old", name: "Person", title: "Director" }]);
      writeWorkspaceState(database, initial, "2026-08-01T12:00:00Z");
      const changed = readWorkspaceState(database);
      const original = changed.contacts[0];
      changed.contacts[0] = preserveEmploymentHistory(original, { ...original, accountId: "new", title: "VP" }, endedAt);
      writeWorkspaceState(database, changed, "2026-09-08T12:00:00Z");
      const saved = readWorkspaceState(database);
      assert.deepEqual(saved.contacts[0].employmentHistory, [{ accountId: "old", title: "Director", endedAt }]);
      writeWorkspaceState(database, saved, "2026-09-08T18:00:00Z");
      assert.deepEqual(readWorkspaceState(database).contacts[0].employmentHistory, [{ accountId: "old", title: "Director", endedAt }]);
    } finally { database.close(); }
  }
});
