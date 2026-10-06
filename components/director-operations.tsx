"use client";

import { focusedRecords } from "@/lib/record-focus";

import { FormEvent, useState } from "react";
import {
  Archive, ArrowRight, BriefcaseBusiness, CalendarDays, Edit3, Handshake,
  Mail, MessageSquare, Plus, Search, Target,
} from "lucide-react";
import type {
  AccountItem, ActivityItem, ContactItem, OpportunityItem, PartnershipItem, ProjectItem, TaskCategory,
  TaskItem,
} from "@/lib/types";
import { evaluateOpportunityPriority, sortOpportunitiesByPriority, type AttentionTier } from "@/lib/opportunity-priority";
import { opportunityPromotionIssue, projectPromotionIssue } from "@/lib/workflow-readiness";
import { getTeamViewProfile } from "@/lib/team-views";
import { ACTION_STATES, VALUE_MEANINGS } from "@/lib/relationship-context";
import { DeliveryContextDetails, DeliveryHandoffPanel } from "./delivery-handoff-panel";
import { AdoptionPanel, DiscoveryEconomicsPanel } from "./customer-development-panels";
import { ProjectCollaborationPanel } from "./project-collaboration-panel";

import { OFFERING_LABELS, OFFERING_LANES, PARTNER_CATEGORIES, PROJECT_DDD_PHASES, PROJECT_PLAYBOOKS, PROJECT_TYPES, PROJECT_WORK_AREAS, SALES_MOTIONS, SALES_ROUTES, filterGtmPartners, filterGtmProjects, filterSalesOpportunities, projectDefaults, projectDddPhase, projectPlaybook, projectType, projectWorkArea } from "@/lib/gtm-navigation";

type Setter<T> = React.Dispatch<React.SetStateAction<T[]>>;
type AddTask = (input: {
  title: string;
  description: string;
  due?: string;
  category: TaskCategory;
  relatedType?: TaskItem["relatedType"];
  relatedId?: string;
  owner?: string;
  status?: TaskItem["status"];
  effort?: TaskItem["effort"];
}) => void;

import { ACQUISITION_MOTIONS, GTM_SOURCE_OPTIONS } from "@/lib/gtm-sources";
const sourceOptions = GTM_SOURCE_OPTIONS;
const opportunityStages: OpportunityItem["stage"][] = ["Explore", "Validate", "Qualify", "Shape & Estimate", "Proposal & Decision", "Contracting", "Closed Won", "Closed Lost"];
const forecasts: OpportunityItem["forecast"][] = ["Not Forecasted", "Pipeline", "Best Case", "Commit", "Contracted", "Lost"];
const companyValueConfidences: NonNullable<OpportunityItem["valueConfidence"]>[] = ["Unknown", "Rough estimate", "Validated", "Contracted"];
const revenueModels: NonNullable<OpportunityItem["revenueModel"]>[] = ["Unknown", "One-time", "Recurring", "Mixed"];
const revenueTimelines: NonNullable<OpportunityItem["timeToRevenue"]>[] = ["Unknown", "0-30 days", "31-90 days", "91-180 days", "181-365 days", "More than 1 year"];
const seriousnessValues: NonNullable<OpportunityItem["seriousness"]>[] = ["Unknown", "Exploratory", "Engaged", "Active buying", "Commercial commitment"];
const decisionAccessValues: NonNullable<OpportunityItem["decisionAccess"]>[] = ["Unknown", "No direct access", "Influencer", "Champion", "Decision maker", "Economic buyer"];
const stakeholderCoverageValues: NonNullable<OpportunityItem["stakeholderCoverage"]>[] = ["Unknown", "Single-threaded", "Multi-threaded", "Buying group mapped"];
const priorityLevels: NonNullable<OpportunityItem["strategicFit"]>[] = ["Unknown", "Low", "Medium", "High"];
const attentionOverrides: NonNullable<OpportunityItem["attentionOverride"]>[] = ["Automatic", "Strategic", "Priority", "Standard", "Light-touch"];
const partnershipStages: PartnershipItem["stage"][] = ["Identified", "Engaging", "Mutual Fit", "Designing", "Pilot / Activation", "Active", "Paused / Ended"];
const operationalStatuses: ProjectItem["operationalStatus"][] = ["Not Started", "Mobilizing", "Active", "At Gate", "Complete", "Paused", "Stopped"];

function attentionTierLabel(value: string) {
  return value === "Needs inputs" ? "Needs Attention" : value;
}

function projectStatusLabel(value: ProjectItem["operationalStatus"]) {
  if (value === "Not Started") return "Starting";
  if (value === "At Gate") return "Awaiting Review";
  return value;
}

function Heading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{action}</div>;
}

function Label({ children, tone = "" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`label ${tone ? `label-${tone}` : ""}`}>{children}</span>;
}

function Empty({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) {
  return <section className="panel empty-state">{icon}<h2>{title}</h2><p>{copy}</p></section>;
}

function accountName(accounts: AccountItem[], id: string) {
  return accounts.find((account) => account.id === id)?.name || "Unlinked";
}

function dueLabel(value: string) {
  if (!value) return "No date";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: year === new Date().getFullYear() ? undefined : "numeric" }).format(new Date(year, month - 1, day, 12));
}

function localDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function isOverdue(value: string) {
  return Boolean(value && value < localDate());
}

export function PipelineView({ opportunities, setOpportunities, accounts, contacts = [], activities = [], addTask, initialFocus, defaultOwner = "" }: {
  initialFocus?: string | number;
  defaultOwner?: string;
  opportunities: OpportunityItem[];
  setOpportunities: Setter<OpportunityItem>;
  accounts: AccountItem[];
  contacts?: ContactItem[];
  activities?: ActivityItem[];
  addTask: AddTask;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [motionFilter, setMotionFilter] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("");
  const [routeFilter, setRouteFilter] = useState("");
  const [acquisitionFilter, setAcquisitionFilter] = useState("");
  const [stageFilter, setStageFilter] = useState<"Active" | "All" | "Closed Won" | "Needs next step">("Active");
  const [priorityFilter, setPriorityFilter] = useState<"All" | AttentionTier | "Act now">("All");
  const [prioritySort, setPrioritySort] = useState<"Recommended" | "Strategic value" | "Win readiness" | "Action urgency" | "Confidence">("Recommended");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const active = opportunities.filter((item) => !item.archivedAt);
  const open = active.filter((item) => !item.stage.startsWith("Closed"));
  const value = open.reduce((sum, item) => sum + item.value, 0);
  const overdue = open.filter((item) => item.actionState !== "Completed" && isOverdue(item.nextActionDue)).length;
  const update = (key: string, next: string) => { setFormError(""); setDraft((current) => ({ ...current, [key]: next })); };
  const close = () => { setDraft({}); setEditingId(null); setShowForm(false); setFormError(""); };
  const edit = (item: OpportunityItem) => {
    setDraft(Object.fromEntries(Object.entries(item).filter(([, field]) => typeof field !== "undefined").map(([key, field]) => [key, String(field)])));
    setEditingId(item.id); setFormError(""); setShowForm(true); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const filtered = initialFocus !== undefined ? focusedRecords(active, initialFocus) : filterSalesOpportunities(active, accounts, { stage: stageFilter, motion: motionFilter, phase: phaseFilter, route: routeFilter, query, acquisition: acquisitionFilter });
  const priorityById = new Map(active.map((item) => [item.id, evaluateOpportunityPriority(item, accounts.find((account) => account.id === item.accountId), contacts.filter((contact) => contact.accountId === item.accountId), activities)]));
  const priorityFiltered = filtered.filter((item) => priorityFilter === "All" || (priorityFilter === "Act now" ? priorityById.get(item.id)?.actionWindow === "Act now" : priorityById.get(item.id)?.attentionTier === priorityFilter));
  const displayed = prioritySort === "Recommended"
    ? sortOpportunitiesByPriority(priorityFiltered, accounts, contacts, activities)
    : [...priorityFiltered].sort((left, right) => {
      const a = priorityById.get(left.id)!;
      const b = priorityById.get(right.id)!;
      const key = prioritySort === "Strategic value" ? "strategicValue" : prioritySort === "Win readiness" ? "winReadiness" : prioritySort === "Action urgency" ? "actionUrgency" : "confidence";
      return (b[key] ?? -1) - (a[key] ?? -1) || left.name.localeCompare(right.name);
    });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name?.trim()) return;
    const existingOpportunity = editingId ? active.find((item) => item.id === editingId) : undefined;
    const owner = (draft.owner || defaultOwner).trim();
    if (!owner) { setFormError("Choose an opportunity owner before saving."); return; }
    const record: OpportunityItem = {
      id: editingId || crypto.randomUUID(), accountId: draft.accountId || "", name: draft.name.trim(),
      stage: (draft.stage || "Explore") as OpportunityItem["stage"], forecast: (draft.forecast || "Not Forecasted") as OpportunityItem["forecast"],
      value: Math.max(0, Number(draft.value) || 0), closeDate: draft.closeDate || "", owner,
      valueMeaning: (draft.valueMeaning || "Unknown") as OpportunityItem["valueMeaning"],
      actionState: (draft.actionState || "Suggested") as OpportunityItem["actionState"],
      nextActionReason: draft.nextActionReason || "", desiredNextOutcome: draft.desiredNextOutcome || "",
      ownerProfileId: getTeamViewProfile(owner)?.id ?? (existingOpportunity?.owner === owner ? existingOpportunity.ownerProfileId : undefined),
      valueConfidence: (draft.valueConfidence || "Unknown") as OpportunityItem["valueConfidence"], annualRevenuePotential: Math.max(0, Number(draft.annualRevenuePotential) || 0), revenueModel: (draft.revenueModel || "Unknown") as OpportunityItem["revenueModel"], timeToRevenue: (draft.timeToRevenue || "Unknown") as OpportunityItem["timeToRevenue"],
      seriousness: (draft.seriousness || "Unknown") as OpportunityItem["seriousness"], primaryContactId: draft.primaryContactId || undefined, decisionAccess: (draft.decisionAccess || "Unknown") as OpportunityItem["decisionAccess"], stakeholderCoverage: (draft.stakeholderCoverage || "Unknown") as OpportunityItem["stakeholderCoverage"],
      strategicFit: (draft.strategicFit || "Unknown") as OpportunityItem["strategicFit"], expansionPotential: (draft.expansionPotential || "Unknown") as OpportunityItem["expansionPotential"], priorityEvidence: draft.priorityEvidence || "", priorityEvidenceSourceIds: existingOpportunity?.priorityEvidenceSourceIds || [],
      priorityStatus: (draft.priorityStatus || "Needs review") as OpportunityItem["priorityStatus"], priorityReviewedAt: draft.priorityReviewedAt || "", attentionOverride: (draft.attentionOverride || "Automatic") as OpportunityItem["attentionOverride"], attentionOverrideReason: draft.attentionOverrideReason || "",
      motion: (draft.motion || "Other") as OpportunityItem["motion"], salesRoute: (draft.salesRoute || "Unclassified") as OpportunityItem["salesRoute"], partnerAccountId: draft.partnerAccountId || undefined, engagementPhase: (draft.engagementPhase || "Not Applicable") as OpportunityItem["engagementPhase"],
      painPoint: draft.painPoint || "", desiredOutcome: draft.desiredOutcome || "", nextSpejAction: draft.nextSpejAction || "",
      nextCustomerDecision: draft.nextCustomerDecision || "", nextActionDue: draft.nextActionDue || "", source: draft.source || "Unknown / Needs Review", acquisitionMotion: (draft.acquisitionMotion || "Unclassified") as OpportunityItem["acquisitionMotion"],
      notes: draft.notes || "", createdAt: existingOpportunity?.createdAt || new Date().toISOString(),
    };
    const issue = opportunityPromotionIssue(record);
    if (issue) { setFormError(issue); return; }
    setOpportunities((items) => editingId ? items.map((item) => item.id === editingId ? { ...item, ...record } : item) : [record, ...items]);
    close();
  };

  return <div className="view ops-view">
    <Heading eyebrow="Sales" title="Sales Pipeline" description="Track AI Office, Plooms, and client-project deals. Record the offering, sales route, source category, and specific source separately." action={<button className="button button-primary" onClick={() => { setEditingId(null); setFormError(""); setDraft({ acquisitionMotion: acquisitionFilter || "Unclassified", motion: motionFilter && motionFilter !== "MSP / Partner" ? motionFilter : "Other", salesRoute: routeFilter || "Unclassified", engagementPhase: phaseFilter || "Not Applicable", owner: defaultOwner }); setShowForm(true); }}><Plus size={16}/> Add opportunity</button>}/>
    <div className="ops-metrics"><div><b>{open.length}</b><span>active opportunities</span></div><div><b>{new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)}</b><span>open pipeline</span></div><div><b>{open.filter((item) => item.forecast === "Commit").length}</b><span>commit</span></div><div className={overdue ? "metric-alert" : ""}><b>{overdue}</b><span>overdue actions</span></div></div>
    <section className="offering-lanes" aria-label="Sales offering lanes">{OFFERING_LANES.map((lane) => <button key={lane.motion} aria-pressed={motionFilter === lane.motion} className={motionFilter === lane.motion ? "active" : ""} onClick={() => setMotionFilter(motionFilter === lane.motion ? "" : lane.motion)}><b>{lane.title}</b><p>{lane.description}</p><small>{open.filter((item) => item.motion === lane.motion).length} open opportunities · {motionFilter === lane.motion ? "Click to show all" : "Filter this offering"}</small></button>)}</section>
    <div className="ops-toolbar"><div className="filter-row">{(["Active", "Needs next step", "All", "Closed Won"] as const).map((option) => <button key={option} className={stageFilter === option ? "active" : ""} onClick={() => setStageFilter(option)}>{option === "Closed Won" ? "Won" : option === "Needs next step" ? "Needs Attention" : option}</button>)}</div><label className="search-box"><Search size={15}/><input aria-label="Search pipeline" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pipeline"/></label></div>
    <div className="gtm-inline-filters"><label>Offering<select value={motionFilter} onChange={(e) => setMotionFilter(e.target.value)}><option value="">All offerings</option>{SALES_MOTIONS.filter((item) => item !== "MSP / Partner" || active.some((record) => record.motion === item)).map((item) => <option key={item} value={item}>{OFFERING_LABELS[item]}</option>)}</select></label><label>Sales route<select value={routeFilter} onChange={(e) => setRouteFilter(e.target.value)}><option value="">All sales routes</option>{SALES_ROUTES.map((item) => <option key={item}>{item}</option>)}</select></label><label>Source category<select value={acquisitionFilter} onChange={(e) => setAcquisitionFilter(e.target.value)}><option value="">All source categories</option>{ACQUISITION_MOTIONS.map((item) => <option key={item}>{item}</option>)}</select></label><label>Delivery phase<select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)}><option value="">All phases</option>{["Discovery", "Design", "Delivery", "Not Applicable"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Deal priority<select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as typeof priorityFilter)}>{["All", "Strategic", "Priority", "Standard", "Light-touch", "Needs inputs", "Act now"].map((item) => <option key={item} value={item}>{attentionTierLabel(item)}</option>)}</select></label><label>Sort by<select value={prioritySort} onChange={(e) => setPrioritySort(e.target.value as typeof prioritySort)}>{["Recommended", "Strategic value", "Win readiness", "Action urgency", "Confidence"].map((item) => <option key={item} value={item}>{item === "Confidence" ? "Data confidence" : item}</option>)}</select></label><button className="button button-ghost" onClick={() => { setMotionFilter(""); setPhaseFilter(""); setRouteFilter(""); setAcquisitionFilter(""); setPriorityFilter("All"); setPrioritySort("Recommended"); setQuery(""); setStageFilter("Active"); }}>Reset filters</button></div><p className="gtm-period-note">{displayed.length} matching opportunities. Deal priority separates strategic value, buyer readiness, and timing. A large deal is not automatically urgent. Delivery phase here means the scope being sold; approved execution progress lives in Projects.</p>
    {showForm && <form className="ops-form" onSubmit={submit}><div><p className="eyebrow">{editingId ? "Edit opportunity" : "New opportunity"}</p><p className="form-help">Explore can be saved as a lightweight intake. Progressing a deal requires an account, owner, and dated next action; later stages require a qualified problem, outcome, value, and close date.</p><label>Opportunity name<input autoFocus required placeholder="Name the opportunity" value={draft.name || ""} onChange={(event) => update("name", event.target.value)}/></label><div className="ops-form-grid">
      <label>Account<select value={draft.accountId || ""} onChange={(event) => update("accountId", event.target.value)}><option value="">Unlinked</option>{accounts.filter((item) => !item.archivedAt).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Offering<select value={draft.motion || "Other"} onChange={(event) => update("motion", event.target.value)}>{SALES_MOTIONS.filter((item) => item !== "MSP / Partner" || (Boolean(editingId) && draft.motion === item)).map((option) => <option key={option} value={option}>{OFFERING_LABELS[option]}</option>)}</select></label>
      <label>Sales route<select value={draft.salesRoute || "Unclassified"} onChange={(event) => update("salesRoute", event.target.value)}>{SALES_ROUTES.map((option) => <option key={option}>{option}</option>)}</select></label><label>Partner account<select value={draft.partnerAccountId || ""} onChange={(event) => update("partnerAccountId", event.target.value)}><option value="">No partner linked</option>{accounts.filter((item) => !item.archivedAt).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Delivery phase<select value={draft.engagementPhase || "Not Applicable"} onChange={(event) => update("engagementPhase", event.target.value)}>{["Discovery", "Design", "Delivery", "Not Applicable"].map((option) => <option key={option}>{option}</option>)}</select></label>
      <label>Stage<select value={draft.stage || "Explore"} onChange={(event) => update("stage", event.target.value)}>{opportunityStages.map((option) => <option key={option}>{option}</option>)}</select></label>
      <label>Forecast<select value={draft.forecast || "Not Forecasted"} onChange={(event) => update("forecast", event.target.value)}>{forecasts.map((option) => <option key={option}>{option}</option>)}</select></label>
      <label>Deal amount<input type="number" min="0" value={draft.value || ""} onChange={(event) => update("value", event.target.value)}/></label>
      <label>What this amount means<select value={draft.valueMeaning || "Unknown"} onChange={(event) => update("valueMeaning", event.target.value)}>{VALUE_MEANINGS.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Next action state<select value={draft.actionState || "Suggested"} onChange={(event) => update("actionState", event.target.value)}>{ACTION_STATES.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Why this next action?<textarea value={draft.nextActionReason || ""} onChange={(event) => update("nextActionReason", event.target.value)} maxLength={2000}/></label>
      <label>Desired next-step outcome<textarea value={draft.desiredNextOutcome || ""} onChange={(event) => update("desiredNextOutcome", event.target.value)} maxLength={2000}/></label>
      <label>Close date<input type="date" value={draft.closeDate || ""} onInput={(event) => update("closeDate", event.currentTarget.value)} onChange={(event) => update("closeDate", event.target.value)}/></label>
      <label>Next action due<input type="date" value={draft.nextActionDue || ""} onChange={(event) => update("nextActionDue", event.target.value)}/></label>
      <label>Owner<input value={draft.owner || defaultOwner} onChange={(event) => update("owner", event.target.value)}/></label>
      <label>Source category<select value={draft.acquisitionMotion || "Unclassified"} onChange={(event) => update("acquisitionMotion", event.target.value)}>{ACQUISITION_MOTIONS.map((option) => <option key={option}>{option}</option>)}</select></label><label>Specific source<input list="opportunity-sources" value={draft.source || ""} onChange={(event) => update("source", event.target.value)} placeholder="e.g. LinkedIn, conference, or introduction"/><datalist id="opportunity-sources">{sourceOptions.map((option) => <option key={option} value={option}/>)}</datalist></label>
    </div><details className="priority-form-section"><summary>Deal priority factors</summary><p className="form-help">SOSA can propose these facts with evidence. The official recommendation is calculated deterministically after review.</p><div className="ops-form-grid"><label>Data confidence<select value={draft.valueConfidence || "Unknown"} onChange={(event) => update("valueConfidence", event.target.value)}>{companyValueConfidences.map((option) => <option key={option}>{option}</option>)}</select></label><label>Potential annual revenue<input type="number" min="0" value={draft.annualRevenuePotential || ""} onChange={(event) => update("annualRevenuePotential", event.target.value)}/></label><label>Revenue model<select value={draft.revenueModel || "Unknown"} onChange={(event) => update("revenueModel", event.target.value)}>{revenueModels.map((option) => <option key={option}>{option}</option>)}</select></label><label>Time to revenue<select value={draft.timeToRevenue || "Unknown"} onChange={(event) => update("timeToRevenue", event.target.value)}>{revenueTimelines.map((option) => <option key={option}>{option}</option>)}</select></label><label>Buyer engagement<select value={draft.seriousness || "Unknown"} onChange={(event) => update("seriousness", event.target.value)}>{seriousnessValues.map((option) => <option key={option}>{option}</option>)}</select></label><label>Primary buying contact<select value={draft.primaryContactId || ""} onChange={(event) => update("primaryContactId", event.target.value)}><option value="">Not selected</option>{contacts.filter((contact) => !contact.archivedAt && contact.accountId === draft.accountId).map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</select></label><label>Decision-maker access<select value={draft.decisionAccess || "Unknown"} onChange={(event) => update("decisionAccess", event.target.value)}>{decisionAccessValues.map((option) => <option key={option}>{option}</option>)}</select></label><label>Stakeholder coverage<select value={draft.stakeholderCoverage || "Unknown"} onChange={(event) => update("stakeholderCoverage", event.target.value)}>{stakeholderCoverageValues.map((option) => <option key={option}>{option}</option>)}</select></label><label>Strategic fit<select value={draft.strategicFit || "Unknown"} onChange={(event) => update("strategicFit", event.target.value)}>{priorityLevels.map((option) => <option key={option}>{option}</option>)}</select></label><label>Expansion potential<select value={draft.expansionPotential || "Unknown"} onChange={(event) => update("expansionPotential", event.target.value)}>{priorityLevels.map((option) => <option key={option}>{option}</option>)}</select></label><label>Data review status<select value={draft.priorityStatus || "Needs review"} onChange={(event) => update("priorityStatus", event.target.value)}><option value="Needs review">Needs Attention</option><option>Human confirmed</option></select></label><label>Reviewed date<input type="date" value={draft.priorityReviewedAt || ""} onChange={(event) => update("priorityReviewedAt", event.target.value)}/></label><label>Priority override<select value={draft.attentionOverride || "Automatic"} onChange={(event) => update("attentionOverride", event.target.value)}>{attentionOverrides.map((option) => <option key={option}>{option}</option>)}</select></label></div><label>Priority evidence<textarea placeholder="What was said, observed, or confirmed?" value={draft.priorityEvidence || ""} onChange={(event) => update("priorityEvidence", event.target.value)}/></label><label>Priority override reason<textarea placeholder="Why should the calculated priority be overridden?" value={draft.attentionOverrideReason || ""} onChange={(event) => update("attentionOverrideReason", event.target.value)}/></label></details><label>Customer problem<textarea placeholder="Customer pain or current-state problem" value={draft.painPoint || ""} onChange={(event) => update("painPoint", event.target.value)}/></label><label>Desired business outcome<textarea placeholder="What outcome is the customer trying to achieve?" value={draft.desiredOutcome || ""} onChange={(event) => update("desiredOutcome", event.target.value)}/></label><label>Next Spej action<textarea placeholder="Be specific about the next action" value={draft.nextSpejAction || ""} onChange={(event) => update("nextSpejAction", event.target.value)}/></label><label>Next customer action or decision<textarea placeholder="What needs to happen on the customer side?" value={draft.nextCustomerDecision || ""} onChange={(event) => update("nextCustomerDecision", event.target.value)}/></label><label>Commercial context<textarea placeholder="Evidence, decision criteria, risk, or loss reason" value={draft.notes || ""} onChange={(event) => update("notes", event.target.value)}/></label>{formError && <p className="form-error" role="alert">{formError}</p>}</div><div className="form-actions"><button type="button" className="button button-ghost" onClick={close}>Cancel</button><button className="button button-primary">{editingId ? "Save changes" : "Save opportunity"}</button></div></form>}
    {displayed.length ? <div className="pipeline-list">{displayed.map((item) => { const priority = priorityById.get(item.id)!; return <article className="panel pipeline-card" key={item.id}><div className="pipeline-main"><div className="ops-card-labels"><Label tone={item.stage === "Closed Won" ? "positive" : "brief"}>{item.stage}</Label><Label tone={priority.attentionTier === "Strategic" || priority.attentionTier === "Priority" ? "positive" : priority.attentionTier === "Needs inputs" ? "watch" : ""}>{attentionTierLabel(priority.attentionTier)}</Label><Label tone={priority.actionWindow === "Act now" ? "high" : priority.actionWindow === "This week" ? "watch" : ""}>{priority.actionWindow}</Label><Label>{OFFERING_LABELS[item.motion || "Other"]}</Label><Label>{item.salesRoute || "Unclassified route"}</Label><Label>Source category: {item.acquisitionMotion || "Unclassified"}</Label>{item.partnerAccountId && <Label>Partner: {accountName(accounts, item.partnerAccountId)}</Label>}{item.engagementPhase && item.engagementPhase !== "Not Applicable" && <Label>{item.engagementPhase}</Label>}</div><h2>{item.name}</h2><p>{accountName(accounts, item.accountId)} · Owner {item.owner}</p><div className="priority-factor-strip" aria-label="Deal priority factors"><div><span>Strategic value</span><b>{priority.strategicValue ?? "—"}</b></div><div><span>Win readiness</span><b>{priority.winReadiness ?? "—"}</b></div><div><span>Action urgency</span><b>{priority.actionUrgency ?? "—"}</b></div><div><span>Data confidence</span><b>{priority.confidence}%</b></div></div><details className="priority-explanation"><summary>Why this deal priority?</summary><p><b>{priority.recommendedCadence}</b></p><ul>{priority.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>{priority.missingInputs.length > 0 && <p className="priority-missing"><b>Missing:</b> {priority.missingInputs.join(", ")}.</p>}</details><DiscoveryEconomicsPanel opportunity={item} onSave={(changes) => setOpportunities((values) => values.map((value) => value.id === item.id ? { ...value, ...changes } : value))}/>{(item.painPoint || item.desiredOutcome) && <div className="opportunity-context">{item.painPoint && <div><small>Problem</small><p>{item.painPoint}</p></div>}{item.desiredOutcome && <div><small>Desired outcome</small><p>{item.desiredOutcome}</p></div>}</div>}<div className="pipeline-actions"><div><small>Next Spej action · {item.actionState || "Unclassified"}</small><b>{item.nextSpejAction || "Not defined"}</b>{item.nextActionReason && <p>Why: {item.nextActionReason}</p>}{item.desiredNextOutcome && <p>Target outcome: {item.desiredNextOutcome}</p>}</div><div><small>Next customer decision</small><b>{item.nextCustomerDecision || "Not defined"}</b></div></div></div><aside><div className="record-card-tools"><button onClick={() => edit(item)}><Edit3 size={13}/> Edit</button><button className="icon-text danger" onClick={() => setOpportunities((values) => values.map((value) => value.id === item.id ? { ...value, archivedAt: new Date().toISOString() } : value))}><Archive size={13}/> Archive</button></div><b>{new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(item.value)}</b><span>Amount: {item.valueMeaning || "Unknown"} · Evidence: {item.valueConfidence || "Unknown"}</span><span>Close {dueLabel(item.closeDate)}</span><Label tone={item.actionState !== "Completed" && (isOverdue(item.nextActionDue) || !item.nextActionDue) ? "high" : ""}>{item.actionState === "Completed" ? "Next action completed" : item.nextActionDue ? `Action ${dueLabel(item.nextActionDue)}` : "No action date"}</Label><button disabled={item.actionState === "Completed"} title={item.actionState === "Completed" ? "Set a new next action before adding more work." : undefined} onClick={() => addTask({ title: item.nextSpejAction || `Advance ${item.name}`, description: `${accountName(accounts, item.accountId)} · ${item.stage}`, due: item.nextActionDue, category: "Sales", relatedType: "opportunity", relatedId: item.id, owner: item.owner, status: "Not Started", effort: "Medium" })}>Add to Work <ArrowRight size={13}/></button></aside></article>; })}</div> : <Empty icon={<Target/>} title="No opportunities in this view" copy="Create an opportunity only when there is a specific customer objective, mutual engagement, and a meaningful next step."/>}
  </div>;
}

export function PartnershipsView({ partnerships, setPartnerships, accounts, addTask, initialFocus, defaultOwner = "" }: {
  initialFocus?: string | number;
  defaultOwner?: string;
  partnerships: PartnershipItem[]; setPartnerships: Setter<PartnershipItem>; accounts: AccountItem[]; addTask: AddTask;
}) {
  const [categoryFilter, setCategoryFilter] = useState("");
  const [partnerStage, setPartnerStage] = useState("");
  const [partnerQuery, setPartnerQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const active = partnerships.filter((item) => !item.archivedAt);
  const filtered = initialFocus !== undefined ? focusedRecords(active, initialFocus) : filterGtmPartners(active, categoryFilter, partnerStage, partnerQuery);
  const update = (key: string, value: string) => { setFormError(""); setDraft((current) => ({ ...current, [key]: value })); };
  const close = () => { setShowForm(false); setEditingId(null); setDraft({}); setFormError(""); };
  const edit = (item: PartnershipItem) => { setDraft(Object.fromEntries(Object.entries(item).map(([key, field]) => [key, String(field)]))); setEditingId(item.id); setFormError(""); setShowForm(true); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const submit = (event: FormEvent) => {
    event.preventDefault(); if (!draft.name?.trim()) return;
    const existingPartnership = editingId ? active.find((item) => item.id === editingId) : undefined;
    const owner = (draft.owner || defaultOwner).trim();
    if (!owner) { setFormError("Choose a partnership owner before saving."); return; }
    const record: PartnershipItem = { id: editingId || crypto.randomUUID(), accountId: draft.accountId || "", name: draft.name.trim(), type: (draft.type || "Strategic alliance") as PartnershipItem["type"], partnerCategory: (draft.partnerCategory || "Unclassified") as PartnershipItem["partnerCategory"], stage: (draft.stage || "Identified") as PartnershipItem["stage"], health: (draft.health || "Unknown") as PartnershipItem["health"], owner, ownerProfileId: getTeamViewProfile(owner)?.id ?? (existingPartnership?.owner === owner ? existingPartnership.ownerProfileId : undefined), nextAction: draft.nextAction || "", dueDate: draft.dueDate || "", notes: draft.notes || "", createdAt: existingPartnership?.createdAt || new Date().toISOString() };
    setPartnerships((items) => editingId ? items.map((item) => item.id === editingId ? { ...item, ...record } : item) : [record, ...items]); close();
  };
  return <div className="view ops-view"><Heading eyebrow="Sales channels" title="Partners" description="Manage MSP, IT-provider, affiliate, and other partner records. Put customer deals in Sales Pipeline and link the partner account." action={<button className="button button-primary" onClick={() => { setEditingId(null); setFormError(""); setDraft({ partnerCategory: categoryFilter || "Unclassified", stage: partnerStage || "Identified", owner: defaultOwner }); setShowForm(true); }}><Plus size={16}/> Add partner</button>}/><div className="ops-metrics"><div><b>{active.length}</b><span>partners</span></div><div><b>{active.filter((item) => item.stage === "Active").length}</b><span>active</span></div><div><b>{active.filter((item) => item.type === "Referral").length}</b><span>referral partners</span></div><div><b>{active.filter((item) => item.health === "At Risk").length}</b><span>at risk</span></div></div>
    <div className="gtm-inline-filters"><label>Partner category<select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="">All partner categories</option>{PARTNER_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label><label>Partner stage<select value={partnerStage} onChange={(e) => setPartnerStage(e.target.value)}><option value="">All stages</option>{partnershipStages.map((item) => <option key={item}>{item}</option>)}</select></label><label>Search<input value={partnerQuery} onChange={(e) => setPartnerQuery(e.target.value)} placeholder="Name, owner, context"/></label></div>
    {showForm && <form className="ops-form" onSubmit={submit}><div><p className="eyebrow">{editingId ? "Edit partner" : "New partner"}</p><label>Partner name<input autoFocus required placeholder="Name the partner relationship" value={draft.name || ""} onChange={(event) => update("name", event.target.value)}/></label><div className="ops-form-grid"><label>Partner account<select value={draft.accountId || ""} onChange={(event) => update("accountId", event.target.value)}><option value="">Unlinked</option>{accounts.filter((item) => !item.archivedAt).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Partner category<select value={draft.partnerCategory || "Unclassified"} onChange={(event) => update("partnerCategory", event.target.value)}>{PARTNER_CATEGORIES.map((option) => <option key={option}>{option}</option>)}</select></label><label>Relationship type<select value={draft.type || "Strategic alliance"} onChange={(event) => update("type", event.target.value)}>{["Referral", "Strategic alliance", "Technology", "Delivery", "Channel / co-selling"].map((option) => <option key={option}>{option}</option>)}</select></label><label>Stage<select value={draft.stage || "Identified"} onChange={(event) => update("stage", event.target.value)}>{partnershipStages.map((option) => <option key={option}>{option}</option>)}</select></label><label>Health<select value={draft.health || "Unknown"} onChange={(event) => update("health", event.target.value)}>{["Unknown", "Healthy", "Watch", "At Risk"].map((option) => <option key={option}>{option}</option>)}</select></label><label>Owner<input value={draft.owner || defaultOwner} onChange={(event) => update("owner", event.target.value)}/></label><label>Next action due<input type="date" value={draft.dueDate || ""} onChange={(event) => update("dueDate", event.target.value)}/></label></div><label>Next action<textarea placeholder="What should happen next?" value={draft.nextAction || ""} onChange={(event) => update("nextAction", event.target.value)}/></label><label>Relationship notes<textarea placeholder="Introductions, co-selling, shared accounts, or other context" value={draft.notes || ""} onChange={(event) => update("notes", event.target.value)}/></label>{formError && <p className="form-error" role="alert">{formError}</p>}</div><div className="form-actions"><button type="button" className="button button-ghost" onClick={close}>Cancel</button><button className="button button-primary">{editingId ? "Save changes" : "Save partner"}</button></div></form>}
    {filtered.length ? <div className="ops-card-grid">{filtered.map((item) => <article className="panel ops-card partnership-card" key={item.id}><div className="ops-card-head"><span className="ops-icon"><Handshake size={17}/></span><div><h3>{item.name}</h3><p>{accountName(accounts, item.accountId)} · {item.type}</p></div><div className="record-card-tools"><button title="Edit" onClick={() => edit(item)}><Edit3 size={14}/></button><button title="Archive" onClick={() => setPartnerships((values) => values.map((value) => value.id === item.id ? { ...value, archivedAt: new Date().toISOString() } : value))}><Archive size={14}/></button></div></div><div className="ops-card-labels"><Label>{item.partnerCategory || "Unclassified"}</Label><Label tone="brief">{item.stage}</Label><Label tone={item.health === "Healthy" ? "positive" : item.health === "At Risk" ? "high" : "watch"}>{item.health}</Label><Label>{item.owner}</Label></div><div className="next-action-box"><small>Next action · {dueLabel(item.dueDate)}</small><b>{item.nextAction || "Not defined"}</b></div>{item.notes && <p>{item.notes}</p>}<div className="ops-card-foot"><button onClick={() => addTask({ title: item.nextAction || `Advance ${item.name}`, description: `${item.type} · ${item.stage}`, due: item.dueDate, category: "Partnerships", relatedType: "partnership", relatedId: item.id, owner: item.owner, status: "Not Started", effort: "Small" })}>Add to Work <ArrowRight size={13}/></button></div></article>)}</div> : <Empty icon={<Handshake/>} title="No partners in this view" copy="Add partner records and track their next actions."/>}
  </div>;
}

function timelinePosition(project: ProjectItem, min: number, span: number) {
  const start = Date.parse(`${project.startDate || project.dueDate}T12:00:00`);
  const end = Date.parse(`${project.endDate || project.dueDate || project.startDate}T12:00:00`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return { left: "0%", width: "12%" };
  const left = Math.max(0, Math.min(96, ((start - min) / span) * 100));
  const width = Math.max(6, Math.min(100 - left, ((Math.max(start, end) - start) / span) * 100 || 6));
  return { left: `${left}%`, width: `${width}%` };
}

export function ProjectsView({ projects, setProjects, accounts, opportunities = [], addTask, initialFocus, workspace = "delivery", defaultOwner = "" }: {
  initialFocus?: string | number;
  defaultOwner?: string;
  projects: ProjectItem[]; setProjects: Setter<ProjectItem>; accounts: AccountItem[]; opportunities?: OpportunityItem[]; addTask: AddTask;
  workspace?: "gtm" | "delivery";
}) {
  const isDelivery = workspace === "delivery";
  const [scope, setScope] = useState(isDelivery ? "All" : "GTM");
  const [typeFilter, setTypeFilter] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [view, setView] = useState<"board" | "timeline">("board");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [referenceDate] = useState(() => new Date());
  const active = projects.filter((item) => !item.archivedAt);
  const summaryProjects = isDelivery ? active : active.filter((item) => projectWorkArea(item) === "GTM");
  const focusedOrFiltered = initialFocus !== undefined ? focusedRecords(active, initialFocus) : filterGtmProjects(active, scope, phaseFilter, statusFilter, typeFilter);
  const filtered = focusedOrFiltered.filter((item) => `${item.name} ${accountName(accounts, item.accountId)} ${item.owner} ${item.nextMilestone} ${item.notes}`.toLowerCase().includes(query.trim().toLowerCase()));
  const byStatus = operationalStatuses.map((status) => ({ status, items: filtered.filter((item) => item.operationalStatus === status) })).filter((group) => initialFocus === undefined || group.items.length > 0);
  const dated = filtered.flatMap((item) => [item.startDate, item.endDate || item.dueDate]).filter((value): value is string => Boolean(value)).map((value) => Date.parse(`${value}T12:00:00`)).filter(Number.isFinite);
  const timelineMin = dated.length ? Math.min(...dated) : referenceDate.getTime();
  const timelineSpan = Math.max(86_400_000, (dated.length ? Math.max(...dated) : timelineMin + 30 * 86_400_000) - timelineMin);
  const update = (key: string, value: string) => { setFormError(""); setDraft((current) => ({ ...current, [key]: value })); };
  const close = () => { setShowForm(false); setEditingId(null); setDraft({}); setFormError(""); };
  const edit = (item: ProjectItem) => { setDraft({ ...Object.fromEntries(Object.entries(item).filter(([, field]) => typeof field !== "undefined").map(([key, field]) => [key, String(field)])), workArea: projectWorkArea(item), projectType: projectType(item), playbook: projectPlaybook(item), phase: projectDddPhase(item) }); setEditingId(item.id); setFormError(""); setShowForm(true); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const selectProjectType = (value: string) => {
    const type = value as NonNullable<ProjectItem["projectType"]>;
    const defaults = projectDefaults(type);
    setFormError("");
    setDraft((current) => ({ ...current, projectType: type, workArea: defaults.workArea, playbook: defaults.playbook, phase: defaults.phase, commercialStatus: defaults.workArea === "Client Delivery" ? current.commercialStatus === "Not Applicable" ? "Anticipated" : current.commercialStatus || "Anticipated" : "Not Applicable" }));
  };
  const selectAccount = (accountId: string) => { setFormError(""); setDraft((current) => ({ ...current, accountId, opportunityId: opportunities.some((item) => item.id === current.opportunityId && item.accountId === accountId) ? current.opportunityId : "" })); };
  const selectOpportunity = (opportunityId: string) => {
    setFormError("");
    const opportunity = opportunities.find((item) => item.id === opportunityId);
    setDraft((current) => ({ ...current, opportunityId, accountId: opportunity?.accountId || current.accountId }));
  };
  const submit = (event: FormEvent) => {
    event.preventDefault(); if (!draft.name?.trim()) return;
    if (draft.workArea === "Client Delivery" && !draft.accountId) { setFormError("Client Delivery projects need a related CRM account."); return; }
    const linkedOpportunity = opportunities.find((item) => item.id === draft.opportunityId);
    if (linkedOpportunity && linkedOpportunity.accountId !== draft.accountId) { setFormError("The source opportunity must belong to the selected CRM account."); return; }
    const now = new Date().toISOString();
    const existingProject = editingId ? active.find((item) => item.id === editingId) : undefined;
    const owner = (draft.owner || defaultOwner).trim();
    if (!owner) { setFormError("Choose a project owner before saving."); return; }
    const record: ProjectItem = { id: editingId || crypto.randomUUID(), accountId: draft.accountId || "", name: draft.name.trim(), workArea: (draft.workArea || "Unclassified") as ProjectItem["workArea"], projectType: (draft.projectType || "Unclassified") as ProjectItem["projectType"], playbook: (draft.playbook || "Not set") as ProjectItem["playbook"], phase: draft.playbook === "Discovery / Design / Delivery" ? (draft.phase || "Discovery") as ProjectItem["phase"] : "Not Applicable", opportunityId: draft.opportunityId || undefined, commercialStatus: (draft.commercialStatus || "Not Applicable") as ProjectItem["commercialStatus"], operationalStatus: (draft.operationalStatus || "Not Started") as ProjectItem["operationalStatus"], health: (draft.health || "Unknown") as ProjectItem["health"], owner, ownerProfileId: getTeamViewProfile(owner)?.id ?? (existingProject?.owner === owner ? existingProject.ownerProfileId : undefined), startDate: draft.startDate || "", endDate: draft.endDate || "", nextMilestone: draft.nextMilestone || "", dueDate: draft.dueDate || "", successMeasure: draft.successMeasure || "", risk: draft.risk || "", notes: draft.notes || "", createdAt: existingProject?.createdAt || now, updatedAt: now };
    const issue = projectPromotionIssue(record);
    if (issue) { setFormError(issue); return; }
    setProjects((items) => editingId ? items.map((item) => item.id === editingId ? { ...item, ...record } : item) : [record, ...items]); close();
  };
  const card = (item: ProjectItem) => {
    const opportunity = opportunities.find((value) => value.id === item.opportunityId);
    const ddd = projectPlaybook(item) === "Discovery / Design / Delivery";
    return <article className="panel project-card" key={item.id}><div><Label tone="brief">{projectType(item)}</Label><div className="record-card-tools"><button title="Edit" onClick={() => edit(item)}><Edit3 size={14}/></button><button title="Archive" onClick={() => setProjects((values) => values.map((value) => value.id === item.id ? { ...value, archivedAt: new Date().toISOString() } : value))}><Archive size={14}/></button></div></div><h3>{item.name}</h3><p>{item.accountId ? accountName(accounts, item.accountId) : "Internal / unlinked"} · {item.owner}</p><div className="ops-card-labels"><Label>{projectWorkArea(item)}</Label>{ddd && <Label>{projectDddPhase(item)}</Label>}<Label tone={item.health === "On Track" ? "positive" : item.health === "At Risk" ? "high" : "watch"}>{item.health || "Unknown"}</Label></div>{opportunity && <p><b>Related opportunity:</b> {opportunity.name}</p>}<div className="next-action-box"><small>Next milestone · {dueLabel(item.dueDate)}</small><b>{item.nextMilestone || "Not defined"}</b></div>{item.successMeasure && <p><b>Success:</b> {item.successMeasure}</p>}{item.risk && <p className="project-risk"><b>Risk:</b> {item.risk}</p>}{projectWorkArea(item) === "Client Delivery" && <><DeliveryContextDetails project={item} setProjects={setProjects}/><AdoptionPanel project={item} onSave={(changes) => setProjects((values) => values.map((value) => value.id === item.id ? { ...value, ...changes } : value))}/></>}<ProjectCollaborationPanel project={item} defaultAuthor={defaultOwner} onSave={(changes) => setProjects((values) => values.map((value) => value.id === item.id ? { ...value, ...changes } : value))}/><button className="project-task" onClick={() => addTask({ title: item.nextMilestone || `Advance ${item.name}`, description: `${projectType(item)} · ${item.operationalStatus}${ddd ? ` · ${projectDddPhase(item)}` : ""}`, due: item.dueDate, category: "Project Work", relatedType: "project", relatedId: item.id, owner: item.owner, status: "Not Started", effort: "Medium" })}>Add to Work <ArrowRight size={13}/></button></article>;
  };

  const startNew = () => { const type = isDelivery ? "Unclassified" : "Marketing / Media"; const defaults = projectDefaults(type); setEditingId(null); setFormError(""); setDraft({ projectType: type, workArea: isDelivery ? "Unclassified" : "GTM", playbook: defaults.playbook, phase: defaults.phase, operationalStatus: statusFilter || "Not Started", commercialStatus: isDelivery ? "Not Applicable" : "Not Applicable", health: "Unknown", owner: defaultOwner }); setShowForm(true); };
  return <div className="view ops-view"><Heading eyebrow={isDelivery ? "Projects" : "GTM"} title={isDelivery ? "All Projects" : "Plans & Initiatives"} description={isDelivery ? "Manage every company project in one view, including AI Office, Plooms, client work, events, partner enablement, marketing, product, and internal work." : "Manage GTM plans using the same project, CRM, work, and opportunity records as the company Projects view."} action={<button className="button button-primary" onClick={startNew}><Plus size={16}/> Add project</button>}/><div className="ops-metrics"><div><b>{summaryProjects.filter((item) => !["Complete", "Stopped"].includes(item.operationalStatus)).length}</b><span>{isDelivery ? "open projects · all areas" : "open projects"}</span></div><div><b>{summaryProjects.filter((item) => item.health === "At Risk").length}</b><span>at risk</span></div><div><b>{summaryProjects.filter((item) => item.operationalStatus === "At Gate").length}</b><span>awaiting review</span></div><div><b>{summaryProjects.filter((item) => isOverdue(item.dueDate) && !["Complete", "Stopped"].includes(item.operationalStatus)).length}</b><span>overdue milestones</span></div></div>
    {isDelivery && <DeliveryHandoffPanel opportunities={opportunities} accounts={accounts} projects={projects} setProjects={setProjects}/>}
    <div className="ops-toolbar"><div className="filter-row"><button className={view === "board" ? "active" : ""} onClick={() => setView("board")}>Board</button><button className={view === "timeline" ? "active" : ""} onClick={() => setView("timeline")}>Timeline</button></div><span className="view-guidance">Area shows where a project belongs. Type shows what it is. Workflow shows how the team runs it.</span></div>
    <div className="gtm-inline-filters">{isDelivery && <label>Area<select value={scope} onChange={(e) => setScope(e.target.value)}><option value="All">All areas</option>{PROJECT_WORK_AREAS.map((item) => <option key={item}>{item}</option>)}</select></label>}<label>Type<select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="">All types</option>{PROJECT_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label><label>Status<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All statuses</option>{operationalStatuses.map((item) => <option key={item} value={item}>{projectStatusLabel(item)}</option>)}</select></label>{isDelivery && <label>Delivery phase<select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)}><option value="">Any phase</option>{PROJECT_DDD_PHASES.filter((item) => item !== "Not Applicable").map((item) => <option key={item}>{item}</option>)}</select></label>}<label className="search-field">Search projects<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, account, owner, milestone"/></label></div>
    {showForm && <form className="ops-form" onSubmit={submit}><div><p className="eyebrow">{editingId ? "Edit project" : "New project"}</p><p className="form-help">Starting can be saved as a lightweight intake. Mobilizing, Active, Awaiting Review, and Complete statuses require progressively stronger operating details.</p><label>Project name<input autoFocus required placeholder="Name the project" value={draft.name || ""} onChange={(event) => update("name", event.target.value)}/></label><div className="ops-form-grid"><label>Area<select value={draft.workArea || "Unclassified"} onChange={(event) => update("workArea", event.target.value)}>{PROJECT_WORK_AREAS.map((option) => <option key={option}>{option}</option>)}</select></label><label>Type<select value={draft.projectType || "Unclassified"} onChange={(event) => selectProjectType(event.target.value)}>{PROJECT_TYPES.map((option) => <option key={option}>{option}</option>)}</select></label><label>Project workflow<select value={draft.playbook || "Not set"} onChange={(event) => update("playbook", event.target.value)}>{PROJECT_PLAYBOOKS.map((option) => <option key={option}>{option}</option>)}</select></label>{draft.playbook === "Discovery / Design / Delivery" && <label>Delivery phase<select value={draft.phase || "Discovery"} onChange={(event) => update("phase", event.target.value)}>{PROJECT_DDD_PHASES.filter((item) => item !== "Not Applicable").map((option) => <option key={option}>{option}</option>)}</select></label>}<label>Related account<select required={draft.workArea === "Client Delivery"} value={draft.accountId || ""} onChange={(event) => selectAccount(event.target.value)}><option value="">Internal / unlinked</option>{accounts.filter((item) => !item.archivedAt).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Related opportunity<select value={draft.opportunityId || ""} onChange={(event) => selectOpportunity(event.target.value)}><option value="">No linked opportunity</option>{opportunities.filter((item) => !item.archivedAt && (!draft.accountId || item.accountId === draft.accountId)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Status<select value={draft.operationalStatus || "Not Started"} onChange={(event) => update("operationalStatus", event.target.value)}>{operationalStatuses.map((option) => <option key={option} value={option}>{projectStatusLabel(option)}</option>)}</select></label><label>Health<select value={draft.health || "Unknown"} onChange={(event) => update("health", event.target.value)}>{["Unknown", "On Track", "Watch", "At Risk"].map((option) => <option key={option}>{option}</option>)}</select></label>{draft.workArea === "Client Delivery" && <label>Commercial handoff status<select value={draft.commercialStatus || "Anticipated"} onChange={(event) => update("commercialStatus", event.target.value)}>{["Anticipated", "Shaping", "Proposed", "Contracting", "Contracted", "Declined"].map((option) => <option key={option}>{option}</option>)}</select></label>}<label>Owner<input value={draft.owner || defaultOwner} onChange={(event) => update("owner", event.target.value)}/></label><label>Start date<input type="date" value={draft.startDate || ""} onChange={(event) => update("startDate", event.target.value)}/></label><label>Target completion<input type="date" value={draft.endDate || ""} onChange={(event) => update("endDate", event.target.value)}/></label><label>Milestone due<input type="date" value={draft.dueDate || ""} onChange={(event) => update("dueDate", event.target.value)}/></label></div><label>Next milestone<textarea placeholder="What is the next accountable milestone?" value={draft.nextMilestone || ""} onChange={(event) => update("nextMilestone", event.target.value)}/></label><label>Success measure<textarea placeholder="How will the team know this project succeeded?" value={draft.successMeasure || ""} onChange={(event) => update("successMeasure", event.target.value)}/></label><label>Current risk or blocker<textarea placeholder="Record the most important current risk, if any" value={draft.risk || ""} onChange={(event) => update("risk", event.target.value)}/></label><label>Project context and notes<textarea placeholder="Dependencies, decisions, or other context" value={draft.notes || ""} onChange={(event) => update("notes", event.target.value)}/></label>{formError && <p className="form-error" role="alert">{formError}</p>}</div><div className="form-actions"><button type="button" className="button button-ghost" onClick={close}>Cancel</button><button className="button button-primary">{editingId ? "Save changes" : "Save project"}</button></div></form>}
    {!filtered.length ? <Empty icon={<BriefcaseBusiness/>} title="No projects in this view" copy={isDelivery ? "Adjust the filters or add a company project." : "Add a project when GTM work needs a shared owner, status, milestone, and risk."}/> : view === "board" ? <div className="project-board project-status-board">{byStatus.map((group) => <section className="project-column" key={group.status}><header><span>{projectStatusLabel(group.status)}</span><b>{group.items.length}</b></header>{group.items.map(card)}{!group.items.length && <p className="content-empty">Nothing here yet</p>}</section>)}</div> : <section className="panel project-timeline"><header><div><p className="eyebrow">Schedule</p><h2>Project dates</h2></div><span>{dueLabel(new Date(timelineMin).toISOString().slice(0, 10))} – {dueLabel(new Date(timelineMin + timelineSpan).toISOString().slice(0, 10))}</span></header><div className="project-timeline-list">{[...filtered].sort((left, right) => (left.startDate || left.dueDate || "9999").localeCompare(right.startDate || right.dueDate || "9999")).map((item) => <button className="project-timeline-row" key={item.id} onClick={() => edit(item)}><span><b>{item.name}</b><small>{projectType(item)} · {item.owner} · {item.health || "Unknown"}</small></span><div><i style={timelinePosition(item, timelineMin, timelineSpan)}/></div><em>{dueLabel(item.startDate || "")} → {dueLabel(item.endDate || item.dueDate)}</em></button>)}</div></section>}
  </div>;
}

export function IntelligenceHub({ goTo }: { goTo: (tab: "industry" | "mentions" | "reminders" | "audience" | "newsletters") => void }) {
  const tools = [
    { id: "industry" as const, icon: <Target/>, title: "AI & industry signals", copy: "Official labs, major publications, and wider AI discovery." },
    { id: "mentions" as const, icon: <MessageSquare/>, title: "Spej mentions", copy: "Identity-aware monitoring for Spej and configured team members." },
    { id: "newsletters" as const, icon: <Mail/>, title: "Newsletter intelligence", copy: "Newsletter stories grouped into topics, once Gmail is connected." },
    { id: "reminders" as const, icon: <CalendarDays/>, title: "Saved research", copy: "Links, stories, and source material worth revisiting." },
  ];
  return <div className="view ops-view"><Heading eyebrow="External intelligence" title="Intelligence" description="News, relevant mentions and saved research that inform sales and content. Your own channel audience readings belong in GTM Performance → Audience source tracker."/><div className="intel-grid">{tools.map((tool) => <button className="panel intel-card" key={tool.id} onClick={() => goTo(tool.id)}><span className="ops-icon">{tool.icon}</span><div><h2>{tool.title}</h2><p>{tool.copy}</p></div><ArrowRight/></button>)}</div></div>;
}
