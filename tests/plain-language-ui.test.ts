import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CampaignsView } from "../components/campaigns-view";
import { MarketingMetricsView } from "../components/marketing-metrics";
import { PartnershipsView, PipelineView, ProjectsView } from "../components/director-operations";
import { RelationshipsView } from "../components/relationships-view";
import { cleanAccounts, cleanContacts, cleanOpportunities } from "../lib/operations";
import { cleanCampaigns } from "../lib/campaigns";

const noop = () => {};

test("GTM reporting uses the plain-language performance and content labels", () => {
  const html = renderToStaticMarkup(createElement(MarketingMetricsView, {
    metrics: [], setMetrics: noop, accounts: [], contacts: [], activities: [], setActivities: noop,
    opportunities: [], campaigns: [], content: [], goTo: noop,
  }));
  for (const label of ["GTM Performance", "Content", "Data Sources", "Export results"]) assert.ok(html.includes(label), label);
  assert.ok(!html.includes(">GTM Metrics<"));
});

test("CRM and pipeline expose clear account, source, and deal-priority language", () => {
  const accounts = cleanAccounts([{ id: "a", name: "Example account" }]);
  const contacts = cleanContacts([{ id: "c", accountId: "a", name: "Example person", acquisitionMotion: "Inbound", source: "Website" }]);
  const crm = renderToStaticMarkup(createElement(RelationshipsView, {
    accounts, setAccounts: noop, contacts, setContacts: noop, activities: [], setActivities: noop,
    campaigns: [], tasks: [], opportunities: [], projects: [], partnerships: [], goTo: noop, addTask: noop,
    initialFocus: "people",
  }));
  for (const label of ["CRM", "Accounts", "People", "Activity", "Account link", "Source category", "Person status"]) assert.ok(crm.includes(label), label);
  assert.ok(!crm.includes(">Client Follow-ups<"));

  const opportunities = cleanOpportunities([{ id: "o", accountId: "a", name: "Example deal", stage: "Qualify" }]);
  const pipeline = renderToStaticMarkup(createElement(PipelineView, {
    opportunities, setOpportunities: noop, accounts, contacts, activities: [], addTask: noop, initialFocus: "o",
  }));
  for (const label of ["Sales Pipeline", "Needs Attention", "Deal priority factors", "Data confidence"]) assert.ok(pipeline.includes(label), label);
});

test("partner, project, and campaign views keep stored statuses but show clear labels", () => {
  const partners = renderToStaticMarkup(createElement(PartnershipsView, {
    partnerships: [], setPartnerships: noop, accounts: [], addTask: noop,
  }));
  assert.ok(partners.includes(">Partners<"));
  assert.ok(partners.includes("Add partner"));

  const projects = renderToStaticMarkup(createElement(ProjectsView, {
    projects: [], setProjects: noop, accounts: [], addTask: noop, workspace: "delivery",
  }));
  for (const label of ["All Projects", "Starting", "Awaiting Review"]) assert.ok(projects.includes(label), label);

  const campaigns = cleanCampaigns([{ id: "campaign", name: "Example campaign", status: "Planning" }]);
  const campaignHtml = renderToStaticMarkup(createElement(CampaignsView, {
    campaigns, setCampaigns: noop, content: [], tasks: [], addTask: noop,
  }));
  assert.ok(campaignHtml.includes(">Starting<"));
  assert.ok(!campaignHtml.includes(">Planning<"));
});
