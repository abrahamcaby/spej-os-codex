"use client";

import { focusedRecords } from "@/lib/record-focus";

import { FormEvent, useMemo, useState } from "react";
import { Archive, ArrowRight, CalendarRange, Edit3, Megaphone, Plus, Target, UsersRound } from "lucide-react";
import type { CampaignItem, ContentItem, TaskCategory, TaskItem } from "@/lib/types";
import { CAMPAIGN_CHANNELS, CAMPAIGN_STATUSES } from "@/lib/campaigns";
import { campaignPromotionIssue } from "@/lib/workflow-readiness";
import { getTeamViewProfile } from "@/lib/team-views";

type Draft = Omit<CampaignItem, "id" | "createdAt" | "archivedAt">;
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

const emptyDraft = (defaultOwner: string): Draft => ({
  name: "",
  status: "Planning",
  objective: "",
  audience: "",
  owner: defaultOwner,
  ownerProfileId: getTeamViewProfile(defaultOwner)?.id,
  primaryChannel: "Multi-channel",
  startDate: "",
  endDate: "",
  successMeasure: "",
  notes: "",
});

function campaignStatusLabel(value: CampaignItem["status"]) {
  return value === "Planning" ? "Starting" : value;
}

function formatDate(value: string) {
  if (!value) return "No date";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(year, month - 1, day, 12));
}

export function CampaignsView({ campaigns, setCampaigns, content, tasks, addTask, initialFocus, defaultOwner = "" }: {
  initialFocus?: string | number;
  defaultOwner?: string;
  campaigns: CampaignItem[];
  setCampaigns: React.Dispatch<React.SetStateAction<CampaignItem[]>>;
  content: ContentItem[];
  tasks: TaskItem[];
  addTask: AddTask;
}) {
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(defaultOwner));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [referenceDate] = useState(() => new Date());
  const active = campaigns.filter((item) => !item.archivedAt);
  const today = referenceDate.toISOString().slice(0, 10);
  const soon = new Date(referenceDate.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  const linkedContentCount = content.filter((item) => item.campaignId && active.some((campaign) => campaign.id === item.campaignId)).length;
  const endingSoon = active.filter((item) => item.status === "Active" && item.endDate && item.endDate >= today && item.endDate <= soon).length;
  const byStatus = useMemo(() => CAMPAIGN_STATUSES.map((status) => ({ status, items: focusedRecords(active, initialFocus).filter((item) => item.status === status) })), [active, initialFocus]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setFormError("");
    setDraft((current) => ({ ...current, [key]: value }));
  };
  const close = () => { setDraft(emptyDraft(defaultOwner)); setEditingId(null); setShowForm(false); setFormError(""); };
  const edit = (campaign: CampaignItem) => {
    const { id: _id, createdAt: _createdAt, archivedAt: _archivedAt, ...values } = campaign;
    void _id; void _createdAt; void _archivedAt;
    setDraft(values);
    setEditingId(campaign.id);
    setFormError("");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) return;
    const owner = draft.owner.trim();
    const existing = editingId ? active.find((item) => item.id === editingId) : undefined;
    const savedDraft: Draft = {
      ...draft,
      owner,
      ownerProfileId: getTeamViewProfile(owner)?.id ?? (existing?.owner === owner ? existing.ownerProfileId : undefined),
    };
    const issue = campaignPromotionIssue(savedDraft);
    if (issue) { setFormError(issue); return; }
    if (editingId) {
      setCampaigns((items) => items.map((item) => item.id === editingId ? { ...item, ...savedDraft, name: draft.name.trim() } : item));
    } else {
      setCampaigns((items) => [{ ...savedDraft, id: crypto.randomUUID(), name: draft.name.trim(), createdAt: new Date().toISOString() }, ...items]);
    }
    close();
  };

  return <div className="view ops-view campaigns-view">
    <div className="page-heading">
      <div><p className="eyebrow">Content</p><h1>Campaigns</h1><p className="page-description">Connect an audience and objective to content, work, dates, and measurable outcomes.</p></div>
      <button className="button button-primary" onClick={() => { setEditingId(null); setDraft(emptyDraft(defaultOwner)); setFormError(""); setShowForm(true); }}><Plus size={16}/> New campaign</button>
    </div>
    <div className="ops-metrics">
      <div><b>{active.filter((item) => item.status === "Active").length}</b><span>active campaigns</span></div>
      <div><b>{active.filter((item) => item.status === "Planning").length}</b><span>starting</span></div>
      <div><b>{linkedContentCount}</b><span>content items</span></div>
      <div className={endingSoon ? "metric-alert" : ""}><b>{endingSoon}</b><span>ending this week</span></div>
    </div>
    {showForm && <form className="ops-form campaign-form" onSubmit={submit}>
      <div>
        <p className="eyebrow">{editingId ? "Edit campaign" : "New campaign"}</p>
        <p className="form-help">Starting can be saved as a lightweight intake. Active and Complete campaigns need an accountable, measurable brief.</p>
        <label>Campaign name<input autoFocus required placeholder="Name the campaign" value={draft.name} onChange={(event) => update("name", event.target.value)}/></label>
        <div className="ops-form-grid">
          <label>Status<select value={draft.status} onChange={(event) => update("status", event.target.value as CampaignItem["status"])}>{CAMPAIGN_STATUSES.map((value) => <option key={value} value={value}>{campaignStatusLabel(value)}</option>)}</select></label>
          <label>Owner<input value={draft.owner} onChange={(event) => update("owner", event.target.value)}/></label>
          <label>Primary channel<select value={draft.primaryChannel} onChange={(event) => update("primaryChannel", event.target.value as CampaignItem["primaryChannel"])}>{CAMPAIGN_CHANNELS.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Start<input type="date" value={draft.startDate} onChange={(event) => update("startDate", event.target.value)}/></label>
          <label>End<input type="date" value={draft.endDate} onChange={(event) => update("endDate", event.target.value)}/></label>
        </div>
        <label>Business objective<textarea placeholder="What business outcome should this campaign create?" value={draft.objective} onChange={(event) => update("objective", event.target.value)}/></label>
        <label>Audience<textarea placeholder="Be specific about the audience and account segment." value={draft.audience} onChange={(event) => update("audience", event.target.value)}/></label>
        <label>Success measure<textarea placeholder="How will we know it worked?" value={draft.successMeasure} onChange={(event) => update("successMeasure", event.target.value)}/></label>
        <label>Notes<textarea placeholder="Context, offers, dependencies, or distribution notes" value={draft.notes} onChange={(event) => update("notes", event.target.value)}/></label>
        {formError && <p className="form-error" role="alert">{formError}</p>}
      </div>
      <div className="form-actions"><button type="button" className="button button-ghost" onClick={close}>Cancel</button><button className="button button-primary">{editingId ? "Save changes" : "Create campaign"}</button></div>
    </form>}
    {active.length ? <div className="campaign-board">
      {byStatus.filter((group) => initialFocus === undefined || group.items.length > 0).map((group) => <section className="campaign-column" key={group.status}>
        <header><span>{campaignStatusLabel(group.status)}</span><b>{group.items.length}</b></header>
        <div>{group.items.map((item) => {
          const campaignContent = content.filter((contentItem) => contentItem.campaignId === item.id);
          const campaignTasks = tasks.filter((task) => !task.done && task.relatedType === "campaign" && task.relatedId === item.id);
          return <article className="panel campaign-card" key={item.id}>
            <div className="campaign-card-head"><span><Megaphone size={15}/>{item.primaryChannel}</span><div><button onClick={() => edit(item)} title="Edit campaign"><Edit3 size={14}/></button><button onClick={() => setCampaigns((values) => values.map((value) => value.id === item.id ? { ...value, archivedAt: new Date().toISOString() } : value))} title="Archive campaign"><Archive size={14}/></button></div></div>
            <h3>{item.name}</h3>
            <p>{item.objective || "Objective needs to be defined."}</p>
            <div className="campaign-facts">
              <span><UsersRound size={12}/>{item.audience || "Audience not defined"}</span>
              <span><CalendarRange size={12}/>{formatDate(item.startDate)} – {formatDate(item.endDate)}</span>
              <span><Target size={12}/>{item.successMeasure || "Success measure not defined"}</span>
            </div>
            <div className="campaign-rollup"><span><b>{campaignContent.length}</b> content</span><span><b>{campaignTasks.length}</b> open work items</span><span>Owner <b>{item.owner}</b></span></div>
            <div className="campaign-card-actions"><button onClick={() => edit(item)}>Open plan <ArrowRight size={13}/></button><button onClick={() => addTask({ title: `Advance ${item.name}`, description: item.objective || "Move the campaign forward.", due: item.endDate, category: "Marketing", relatedType: "campaign", relatedId: item.id, owner: item.owner, status: "Not Started", effort: "Medium" })}>Add to Work <Plus size={13}/></button></div>
          </article>;
        })}{!group.items.length && <p className="content-empty">Nothing here yet</p>}</div>
      </section>)}
    </div> : <section className="panel empty-state"><Megaphone size={26}/><h2>No campaigns yet</h2><p>Create a campaign when several content pieces, channels, or team commitments serve one measurable objective.</p></section>}
  </div>;
}
