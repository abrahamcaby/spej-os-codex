"use client";

import { BookOpen, Sparkles } from "lucide-react";

const areas = [
  { label: "SOSA", tabs: ["agent"], purpose: "Ask questions, find records, prepare updates, and review proposed actions. SOSA uses the same permissions and records as the rest of Spej OS.", example: "Show me what needs my attention, why it matters, and which records it is linked to. Do not change anything yet." },
  { label: "CRM", tabs: ["relationships"], purpose: "The company record for accounts, people, relationships, client history, opportunities, partners, activity, and follow-up plans.", example: "Help me add or update an account, the people involved, how the relationship started, and the next action. Ask for anything required." },
  { label: "GTM", tabs: ["gtm"], purpose: "The focused sales and marketing view. It brings together CRM opportunities, partners, campaigns, content, work, performance, and intelligence without duplicating records.", example: "Review GTM and show the highest-priority sales and marketing work, risks, and missing next steps. Do not make changes yet." },
  { label: "Outbound", tabs: ["gtm-linkedin"], purpose: "Coordinate email, calls, and LinkedIn follow-ups over shared CRM accounts and people. The 5-3-1 LinkedIn approach is part of outbound, not a separate GTM motion. Log completed interactions in CRM; put future commitments in Work.", example: "Review outbound follow-ups, including the 5-3-1 LinkedIn approach. Identify missing people or next actions, and do not claim that any action was completed unless it was logged." },
  { label: "Opportunities", tabs: ["pipeline"], purpose: "Track a defined buying objective, stage, value, contacts, next step, and priority. An account or contact does not become an opportunity until there is a real sales motion.", example: "Review opportunities by urgency, value, relationship strength, decision-maker access, and next action. Explain the ranking." },
  { label: "Partners", tabs: ["partnerships"], purpose: "Track MSP, IT provider, affiliate, referral, strategic, and other partner motions separately from direct-client opportunities.", example: "Review active partner motions and identify missing owners, next actions, and follow-up dates." },
  { label: "GTM work", tabs: ["tasks"], purpose: "Sales and marketing tasks with owners, priorities, due dates, categories, links, and subtasks. My Work shows the relevant subset for each person.", example: "Review open GTM work by deadline and priority, including blocked subtasks and records with no next action." },
  { label: "Plans & initiatives", tabs: ["gtm-initiatives"], purpose: "Coordinate a multi-step GTM effort with a shared outcome, owner, milestone, status, and risk. Use a task for a single commitment.", example: "Review GTM plans and identify late milestones, blocked work, missing owners, and the next decision required." },
  { label: "Marketing", tabs: ["campaigns"], purpose: "Coordinate launches, events, series, and distribution across channels. Individual media assets remain in Content and link back to the campaign.", example: "Review active campaigns and show the audience, objective, linked content, owner, next milestone, and result coverage." },
  { label: "Content", tabs: ["content"], purpose: "Manage company content through idea, research, drafting, production, review, scheduled, and published stages.", example: "Help me plan a company content item with the correct category, owner, reviewer, deadline, source, and linked production work." },
  { label: "GTM performance", tabs: ["metrics", "audience"], purpose: "Compare prospecting and publishing inputs with replies, leads, meetings, pipeline, revenue, reach, engagement, and audience growth. Keep source coverage visible.", example: "Summarize recorded GTM inputs and outcomes, show gaps in source coverage, and do not infer attribution that the data does not prove." },
  { label: "Intelligence", tabs: ["intelligence", "industry", "newsletters", "mentions", "reminders"], purpose: "Review industry news, newsletter coverage, verified Spej mentions, and saved research. Link useful evidence to content, accounts, opportunities, or work.", example: "Group repeated coverage, identify the most relevant developments, and show which Spej records or content plans they may affect." },
  { label: "Projects", tabs: ["delivery", "projects", "delivery-work"], purpose: "Plan and deliver client, AI Office, Plooms, event, marketing, partner, product, and internal work. Projects can link to CRM records, documents, decisions, risks, quality checks, and tasks.", example: "Review active projects, milestones, risks, approvals, and project work. Show what needs attention and do not change anything yet." },
];

const journeys = [
  { title: "Record a relationship", tab: "relationships", copy: "Create or update the account and person, record the source and real interaction, then set a dated next action." },
  { title: "Move a sale forward", tab: "pipeline", copy: "Open the opportunity, update the stage only when evidence supports it, and record the decision, owner, and next step." },
  { title: "Run marketing", tab: "content", copy: "Create the content or campaign record, link its work and source material, complete review, then record the actual result." },
  { title: "Deliver work", tab: "projects", copy: "Open the project, review milestones, work, risks, decisions, files, and quality items, then update the canonical record once." },
  { title: "Review results", tab: "metrics", copy: "Compare work completed with responses and business outcomes, inspect missing coverage, and decide what to change." },
];

export function WorkflowGuide({ activeTab, goTo, askSosa }: { activeTab: string; goTo: (tab: string) => void; askSosa: (prompt: string) => void }) {
  const current = areas.find((area) => area.tabs.includes(activeTab));
  if (!current) return null;
  return <section className="workflow-context" aria-label="Page purpose and workflow guide">
    <details className="workflow-guide"><summary><BookOpen size={14}/> What this page is for</summary>
      <div className="workflow-context-line"><p><b>{current.label}</b> · {current.purpose}</p>{activeTab !== "agent" && <button className="button button-ghost" onClick={() => askSosa(current.example)}><Sparkles size={14}/> Ask SOSA about this page</button>}</div>
      <p className="workflow-principle">Records are stored once and shown where they are useful. My Work is the person-level action view; CRM is the shared customer record; GTM is the sales and marketing view; Projects is the delivery view. Permissions control what each person can see and do.</p>
      <div className="workflow-guide-grid">{journeys.map((journey) => <article key={journey.title}><h3>{journey.title}</h3><p>{journey.copy}</p><button className="button button-ghost" onClick={() => goTo(journey.tab)}>Open</button></article>)}</div>
      <p className="workflow-principle">This repository is a working demo. Production identity, tickets, documents, Microsoft 365, audit, feature controls, connectors, and SOSA tools should connect to the existing Spej OS services.</p>
    </details>
  </section>;
}
