"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight, Bot, CalendarDays, Check, ChevronRight, CircleAlert, Database, FileText, LoaderCircle,
  MessageSquareText, ShieldCheck, Sparkles, X,
} from "lucide-react";
import type { AgentWorkspaceProposal, PublicSettings, WorkspaceState } from "@/lib/types";
import { agentRecordCoverage, workspaceFingerprint } from "@/lib/agent-session";
import { AI_PROVIDER_LABELS, isAiReady } from "@/lib/ai-providers";

type Message = {
  id: string;
  role: "user" | "agent";
  text: string;
  proposal?: AgentWorkspaceProposal;
  intakeId?: string;
  applied?: boolean;
  discarded?: boolean;
};

type MeetingIntakeSummary = {
  id: string;
  title: string;
  meetingDate: string;
  sourceKind: "Pasted transcript" | "Meeting notes";
  status: "ready" | "processing" | "proposed" | "needs_clarification" | "applied" | "discarded" | "failed";
  updatedAt: string;
  errorText?: string;
};

type MeetingIntakeDetail = MeetingIntakeSummary & {
  bodyText: string;
  context: { accountId?: string; opportunityId?: string; projectId?: string };
};

const examples = [
  "I met a decision maker from a new account at an in-person event. Add the records and create a follow-up for Friday.",
  "Turn my notes about the AI Office conversation into an opportunity and the next three tasks.",
  "Which relationships have no recent recorded activity, and which follow-ups are due?",
  "Add this idea to Spej authority-building content and make a production task for next week.",
  "Update the selected delivery project to At Risk, record the blocker, and create the next project task.",
  "Record this month’s website visitors and LinkedIn impressions in GTM Metrics.",
];

function collectionLabel(value: string) {
  return ({
    accounts: "CRM account", contacts: "person", activities: "relationship activity",
    opportunities: "opportunity", partnerships: "partnership", projects: "project",
    campaigns: "campaign",
    tasks: "task", content: "content item", reminders: "saved item", marketingMetrics: "marketing metric",
  } as Record<string, string>)[value] || value;
}

const fieldLabels: Record<string, string> = {
  accountId: "Account", contactId: "Person", opportunityId: "Opportunity", projectId: "Project", campaignId: "Campaign",
  relatedId: "Linked record", relatedType: "Linked record type", parentId: "Parent task", nextSpejAction: "Next Spej action",
  nextCustomerDecision: "Next customer decision", nextActionDue: "Next-action due", sourceArtifactId: "Meeting source",
  sourceLabel: "Source", workArea: "Work area", projectType: "Project type", operationalStatus: "Project status",
  commercialStatus: "Commercial handoff status", startDate: "Start date", endDate: "Target completion", dueDate: "Due date",
  nextMilestone: "Next milestone", successMeasure: "Success measure", reviewStatus: "Review status", reviewDue: "Review due",
  publishDate: "Publish date", acquisitionMotion: "Acquisition motion", salesRoute: "Sales route", partnerAccountId: "Partner account",
  occurredAt: "Date", metricType: "Metric type", actionType: "Action type", checkInCadence: "Check-in cadence",
  companySizeBand: "Company size", valueConfidence: "Value confidence", annualRevenuePotential: "Potential annual revenue",
  revenueModel: "Revenue model", timeToRevenue: "Time to revenue", seriousness: "Buying seriousness",
  primaryContactId: "Primary buying contact", decisionAccess: "Decision-maker access", stakeholderCoverage: "Stakeholder coverage",
  strategicFit: "Strategic fit", expansionPotential: "Expansion potential", priorityEvidence: "Priority evidence",
};

function fieldLabel(key: string) {
  return fieldLabels[key] || key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
}

function fieldValue(key: string, value: unknown, data: Record<string, unknown>, workspace: WorkspaceState) {
  const lists: Record<string, Array<{ id: string | number; name?: string; title?: string }>> = {
    accountId: workspace.accounts, partnerAccountId: workspace.accounts, contactId: workspace.contacts, primaryContactId: workspace.contacts,
    opportunityId: workspace.opportunities, projectId: workspace.projects, campaignId: workspace.campaigns,
    parentId: workspace.tasks,
  };
  let list = lists[key];
  if (key === "relatedId") list = ({ account: workspace.accounts, contact: workspace.contacts, opportunity: workspace.opportunities, partnership: workspace.partnerships, project: workspace.projects, content: workspace.content, campaign: workspace.campaigns } as Record<string, Array<{ id: string | number; name?: string; title?: string }>>)[String(data.relatedType || "")];
  const linked = list?.find((item) => String(item.id) === String(value));
  if (linked) return linked.name || linked.title || String(value);
  return typeof value === "object" ? JSON.stringify(value) : String(value ?? "Cleared");
}

export function summarizeMeetingIntakeHealth(records: ReadonlyArray<Pick<MeetingIntakeSummary, "status">>) {
  return records.reduce((summary, record) => {
    if (record.status === "ready") summary.queued += 1;
    else if (record.status === "processing") summary.processing += 1;
    else if (["proposed", "needs_clarification"].includes(record.status)) summary.awaitingReview += 1;
    else if (record.status === "applied") summary.completed += 1;
    else if (record.status === "discarded") summary.closed += 1;
    else if (record.status === "failed") summary.failed += 1;
    return summary;
  }, { queued: 0, processing: 0, awaitingReview: 0, completed: 0, closed: 0, failed: 0 });
}

const proposalSourceKeys = [
  ["sourceLabel", "Source label"],
  ["sourceArtifactId", "Source record"],
  ["sourceUrl", "Source URL"],
  ["source", "Source"],
] as const;

export function proposalSourceFields(proposal: Pick<AgentWorkspaceProposal, "actions">) {
  const details: Array<{ field: string; value: string }> = [];
  const seen = new Set<string>();
  for (const action of proposal.actions) {
    for (const [key, label] of proposalSourceKeys) {
      const rawValue = action.data[key];
      if (typeof rawValue !== "string" && typeof rawValue !== "number") continue;
      const value = String(rawValue).trim();
      if (!value) continue;
      const fingerprint = `${key}:${value}`;
      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);
      details.push({ field: label, value });
    }
  }
  return details;
}

function ProposalEvidence({ proposal }: { proposal: AgentWorkspaceProposal }) {
  const sources = proposalSourceFields(proposal);
  if (!sources.length) return <div className="agent-evidence-limit"><CircleAlert size={15}/><div><b>Evidence is not attached</b><p>This proposal has no source or provenance fields. Deterministic checks validate record shape, not the truth of the underlying claim. Verify it against the source before applying.</p></div></div>;
  return <div className="agent-provenance"><Database size={15}/><div><b>Source metadata attached</b><small>These origin fields came with the proposal; they are not an independently verified evidence ledger.</small><dl>{sources.map((source) => <div key={`${source.field}:${source.value}`}><dt>{source.field}</dt><dd>{source.value}</dd></div>)}</dl></div></div>;
}

export function SpejAgent({
  settings,
  workspace,
  onApply,
  openAiSettings,
  initialIntakeId,
  command, setCommand,
}: {
  command: string;
  setCommand: (value: string) => void;
  settings: PublicSettings;
  workspace: WorkspaceState;
  onApply: (workspace: WorkspaceState) => void;
  openAiSettings: () => void;
  initialIntakeId?: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [mode, setMode] = useState<"ask" | "meeting">("ask");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const workspaceRef = useRef(workspace);
  useEffect(() => { workspaceRef.current = workspace; }, [workspace]);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [meetingBody, setMeetingBody] = useState("");
  const [meetingSourceKind, setMeetingSourceKind] = useState<MeetingIntakeSummary["sourceKind"]>("Pasted transcript");
  const [meetingAccountId, setMeetingAccountId] = useState("");
  const [meetingOpportunityId, setMeetingOpportunityId] = useState("");
  const [meetingProjectId, setMeetingProjectId] = useState("");
  const [recentIntakes, setRecentIntakes] = useState<MeetingIntakeSummary[]>([]);
  const openedIntakeId = useRef("");
  const previewModelReady = isAiReady(settings.ai);
  const providerLabel = previewModelReady ? `Preview model · ${AI_PROVIDER_LABELS[settings.ai.provider]}` : "Preview model off";

  const refreshIntakes = async () => {
    try {
      const response = await fetch("/api/agent/transcripts", { cache: "no-store" });
      if (response.ok) setRecentIntakes(((await response.json()) as { records?: MeetingIntakeSummary[] }).records || []);
    } catch { /* Recent intake history is supplementary to the main agent flow. */ }
  };
  useEffect(() => { window.queueMicrotask(() => { void refreshIntakes(); }); }, []);

  const openRecentIntake = useCallback(async (item: Pick<MeetingIntakeSummary, "id">) => {
    setError("");
    try {
      const response = await fetch(`/api/agent/transcripts/${encodeURIComponent(item.id)}`, { cache: "no-store" });
      const payload = await response.json() as { error?: string; intake?: MeetingIntakeDetail };
      if (!response.ok || !payload.intake) throw new Error(payload.error || "The saved meeting could not be opened.");
      const saved = payload.intake;
      openedIntakeId.current = item.id;
      setMode("meeting"); setMeetingTitle(saved.title); setMeetingDate(saved.meetingDate); setMeetingSourceKind(saved.sourceKind); setMeetingBody(saved.bodyText);
      setMeetingAccountId(saved.context.accountId || ""); setMeetingOpportunityId(saved.context.opportunityId || ""); setMeetingProjectId(saved.context.projectId || "");
      if (["applied", "discarded"].includes(saved.status)) {
        setMessages((messages) => [...messages, { id: crypto.randomUUID(), role: "agent", text: `${saved.title} was ${saved.status}. Its saved source is loaded below for reference; no new changes were prepared.` }]);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setMessages((messages) => [...messages, { id: crypto.randomUUID(), role: "agent", text: saved.status === "proposed" ? "The saved meeting is loaded. Choose Save source and prepare review to reopen its validated proposal." : saved.status === "needs_clarification" ? "The saved meeting is loaded. Adjust its notes or record context, then reprocess it." : "The saved meeting is loaded and ready to process." }]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The saved meeting could not be opened."); }
  }, []);
  useEffect(() => {
    if (!initialIntakeId) {
      openedIntakeId.current = "";
      return;
    }
    if (openedIntakeId.current === initialIntakeId) return;
    void openRecentIntake({ id: initialIntakeId });
  }, [initialIntakeId, openRecentIntake]);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const value = command.trim();
    if (!value || loading) return;
    setError("");
    setCommand("");
    setMessages((items) => [...items, { id: crypto.randomUUID(), role: "user", text: value }]);
    setLoading(true);
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: value, history: messages.slice(-10).map((item) => ({ role: item.role === "agent" ? "assistant" : "user", text: item.text.slice(0, 1800), status: item.proposal?.actions.length ? item.applied ? "applied" : item.discarded ? "discarded" : "proposed" : undefined })) }),
      });
      const payload = await response.json() as AgentWorkspaceProposal & { error?: string; needsSetup?: boolean };
      if (!response.ok) {
        if (payload.needsSetup) openAiSettings();
        throw new Error(payload.error || "SOSA could not prepare that request.");
      }
      setMessages((items) => [...items, {
        id: crypto.randomUUID(), role: "agent", text: payload.reply, proposal: payload,
      }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "SOSA could not prepare that request.");
    } finally {
      setLoading(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const submitMeeting = async (event: FormEvent) => {
    event.preventDefault();
    if (!meetingTitle.trim() || meetingBody.trim().length < 40 || !meetingDate || loading) return;
    setError("");
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", text: `Process meeting: ${meetingTitle.trim()} · ${meetingDate}` };
    setMessages((items) => [...items, userMessage]);
    setLoading(true);
    try {
      const response = await fetch("/api/agent/transcripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: meetingTitle, meetingDate, sourceKind: meetingSourceKind, bodyText: meetingBody, context: { accountId: meetingAccountId || undefined, opportunityId: meetingOpportunityId || undefined, projectId: meetingProjectId || undefined } }),
      });
      const payload = await response.json() as { error?: string; needsSetup?: boolean; duplicate?: boolean; processing?: boolean; intake?: MeetingIntakeSummary; proposal?: AgentWorkspaceProposal };
      if (!response.ok) {
        if (payload.needsSetup && payload.intake) {
          setMessages((items) => [...items, { id: crypto.randomUUID(), role: "agent", text: "Meeting notes saved in this local preview. Configure an optional preview model when you are ready to prepare reviewable changes. The production SOSA service is not connected here." }]);
          setMeetingTitle(""); setMeetingBody(""); setMeetingOpportunityId(""); setMeetingProjectId("");
          await refreshIntakes();
          return;
        }
        throw new Error(payload.error || "SOSA could not process that meeting.");
      }
      if (payload.processing && payload.intake) {
        setMessages((items) => [...items, { id: crypto.randomUUID(), role: "agent", text: "This meeting is already being processed. Its result will remain attached to the saved meeting record." }]);
        await refreshIntakes();
        return;
      }
      if (payload.intake && !payload.proposal && ["applied", "discarded"].includes(payload.intake.status)) {
        setMessages((items) => [...items, { id: crypto.randomUUID(), role: "agent", text: `This meeting was already ${payload.intake?.status}. No second change set was created.` }]);
        await refreshIntakes();
        return;
      }
      if (!payload.intake || !payload.proposal) throw new Error("The meeting was saved, but no reviewable proposal was returned. Load it from Recent meetings and retry.");
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "agent", text: `${payload.duplicate ? "This source was already processed. " : ""}${payload.proposal?.reply || "Meeting processed."}`, proposal: payload.proposal, intakeId: payload.intake?.id }]);
      setMeetingTitle(""); setMeetingBody(""); setMeetingOpportunityId(""); setMeetingProjectId("");
      await refreshIntakes();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "SOSA could not process that meeting.");
      await refreshIntakes();
    } finally { setLoading(false); }
  };

  const apply = async (message: Message) => {
    if (!message.proposal?.nextWorkspace || !message.proposal.actions.length || applyingId) return;
    setApplyingId(message.id); setError("");
    try {
      const current = workspaceRef.current;
      if (!message.proposal.baseWorkspaceVersion || await workspaceFingerprint(current) !== message.proposal.baseWorkspaceVersion || current !== workspaceRef.current) {
        setError("The workspace changed after this proposal was prepared. Ask SOSA to prepare it again so newer work is not overwritten.");
        return;
      }
      if (message.intakeId) {
        const response = await fetch(`/api/agent/transcripts/${encodeURIComponent(message.intakeId)}/apply`, { method: "POST" });
        const payload = await response.json() as { error?: string; workspace?: WorkspaceState };
        if (!response.ok || !payload.workspace) throw new Error(payload.error || "The meeting changes could not be applied.");
        onApply(payload.workspace);
        await refreshIntakes();
      } else onApply(message.proposal.nextWorkspace);
      setMessages((items) => items.map((item) => item.id === message.id ? { ...item, applied: true } : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The proposal could not be checked safely. Please try again."); }
    finally { setApplyingId(null); }
  };

  const discard = async (message: Message) => {
    if (message.intakeId) {
      try {
        const response = await fetch(`/api/agent/transcripts/${encodeURIComponent(message.intakeId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "discard" }) });
        const payload = await response.json() as { error?: string };
        if (!response.ok) throw new Error(payload.error || "The meeting proposal could not be discarded.");
        await refreshIntakes();
      } catch (cause) { setError(cause instanceof Error ? cause.message : "The meeting proposal could not be discarded."); return; }
    }
    setMessages((items) => items.map((item) => item.id === message.id ? { ...item, discarded: true } : item));
  };

  const coverage = agentRecordCoverage(workspace);
  const intakeHealth = summarizeMeetingIntakeHealth(recentIntakes);
  const capabilities = [
    {
      title: "Workspace action contract",
      status: "Contract defined",
      tone: "defined",
      copy: `CRM, pipeline, partnerships, Projects, tasks, campaigns, content, saved items, and metrics. ${coverage.included} of ${coverage.total} active records are included in this bounded preview context, with at most 300 from each collection.`,
    },
    {
      title: "Preview model processing",
      status: previewModelReady ? "Preview ready" : "Not connected",
      tone: previewModelReady ? "ready" : "disconnected",
      copy: previewModelReady ? "The locally configured preview provider can prepare changes for review; it cannot act without approval." : "No model is configured for this local preview. Saved workspace data and the action contract remain available.",
    },
    {
      title: "Local meeting intake",
      status: "Preview ready",
      tone: "ready",
      copy: "Pasted notes and transcripts can be saved locally. Preparing a proposal requires the preview model, deterministic validation, and human approval.",
    },
    {
      title: "Production SOSA and live services",
      status: "Not connected",
      tone: "disconnected",
      copy: "This preview cannot inspect production identity, permissions, tools, run history, Microsoft 365, tickets, news, or social accounts.",
    },
  ];

  return <div className="view agent-view">
    <div className="page-heading agent-heading">
      <div><p className="eyebrow">Spej OS assistant</p><h1>SOSA</h1><p className="page-description">Try the proposed SOSA workspace with local preview data. With a configured preview AI provider, it can prepare coordinated changes across CRM, GTM, Projects, tasks, campaigns, content, and metrics. This standalone build still needs production identity, model connections, governed tools, and server-enforced permissions.</p></div>
      <div className={`agent-connection ${previewModelReady ? "ready" : ""}`}><span><i/><b>{providerLabel}</b><small>{previewModelReady ? "Local pilot processing only" : "Production SOSA status is not checked here"}</small></span><button onClick={openAiSettings}>{previewModelReady ? "Preview settings" : "Configure preview"}<ChevronRight size={14}/></button></div>
    </div>

    <div className="agent-layout">
      <section className="panel agent-chat">
        <div className="agent-chat-head"><span><Bot size={18}/><b>SOSA workspace</b></span><small><Database size={13}/>{coverage.included}/{coverage.total} active records · bounded context</small></div>
        <div className="agent-mode-switch" role="tablist" aria-label="SOSA input mode"><button role="tab" aria-selected={mode === "ask"} className={mode === "ask" ? "active" : ""} onClick={() => setMode("ask")}><MessageSquareText size={14}/> Ask SOSA</button><button role="tab" aria-selected={mode === "meeting"} className={mode === "meeting" ? "active" : ""} onClick={() => setMode("meeting")}><FileText size={14}/> Process meeting</button></div>
        {mode === "meeting" && <form className="agent-meeting-form" onSubmit={submitMeeting}><div className="agent-meeting-grid"><label>Meeting title<input required value={meetingTitle} onChange={(event) => setMeetingTitle(event.target.value)} placeholder="Account, project, or internal meeting"/></label><label>Meeting date<input required type="date" value={meetingDate} onChange={(event) => setMeetingDate(event.target.value)}/></label><label>Source<select value={meetingSourceKind} onChange={(event) => setMeetingSourceKind(event.target.value as MeetingIntakeSummary["sourceKind"])}><option>Pasted transcript</option><option>Meeting notes</option></select></label></div><label>Notes or transcript<textarea required minLength={40} maxLength={40000} value={meetingBody} onChange={(event) => setMeetingBody(event.target.value)} placeholder="Paste the meeting transcript or detailed notes here…" rows={10}/><small>{meetingBody.length.toLocaleString()} / 40,000 characters</small></label><details className="agent-meeting-context"><summary>Optional record context</summary><div className="agent-meeting-grid"><label>CRM account<select value={meetingAccountId} onChange={(event) => { const accountId = event.target.value; setMeetingAccountId(accountId); if (!workspace.opportunities.some((item) => item.id === meetingOpportunityId && item.accountId === accountId)) setMeetingOpportunityId(""); if (!workspace.projects.some((item) => item.id === meetingProjectId && (!item.accountId || item.accountId === accountId))) setMeetingProjectId(""); }}><option value="">Let SOSA identify it</option>{workspace.accounts.filter((item) => !item.archivedAt).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Opportunity<select value={meetingOpportunityId} onChange={(event) => { const id = event.target.value; setMeetingOpportunityId(id); const opportunity = workspace.opportunities.find((item) => item.id === id); if (opportunity) setMeetingAccountId(opportunity.accountId); }}><option value="">None selected</option>{workspace.opportunities.filter((item) => !item.archivedAt && (!meetingAccountId || item.accountId === meetingAccountId)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Project<select value={meetingProjectId} onChange={(event) => { const id = event.target.value; setMeetingProjectId(id); const project = workspace.projects.find((item) => item.id === id); if (project?.accountId) setMeetingAccountId(project.accountId); }}><option value="">None selected</option>{workspace.projects.filter((item) => !item.archivedAt && (!meetingAccountId || !item.accountId || item.accountId === meetingAccountId)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div></details><div className="agent-meeting-actions"><p><ShieldCheck size={14}/> Saved in this local preview and sent only to its configured preview AI provider. The existing production SOSA service and Microsoft 365 are not connected here.</p><button className="button button-primary" disabled={loading || !meetingTitle.trim() || meetingBody.trim().length < 40}><Sparkles size={14}/> {previewModelReady ? "Save source and prepare review" : "Save meeting notes"}</button></div></form>}
        <div className="agent-thread" aria-live="polite">
          {!messages.length && mode === "ask" && <div className="agent-welcome"><span><Sparkles size={24}/></span><h2>Enter a work request</h2><p>Ask a question or specify an update across CRM, GTM, Projects, content, tasks, and metrics. SOSA will show proposed fields for review before anything is saved.</p><div className="agent-examples">{examples.map((example) => <button key={example} onClick={() => { setCommand(example); inputRef.current?.focus(); }}><MessageSquareText size={14}/><span>{example}</span><ArrowRight size={13}/></button>)}</div></div>}
          {!messages.length && mode === "meeting" && <div className="agent-welcome agent-meeting-empty"><span><FileText size={24}/></span><h2>Turn a meeting into reviewable work</h2><p>Paste meeting notes or a transcript above. SOSA can propose supported CRM activity, opportunity updates, projects, tasks, campaigns, and content ideas without inventing commitments.</p></div>}
          {messages.map((message) => <article className={`agent-message ${message.role}`} key={message.id}>
            <div className="agent-message-mark">{message.role === "agent" ? <Bot size={15}/> : "AA"}</div>
            <div className="agent-message-body"><p>{message.text}</p>
              {message.proposal?.actions.length ? <div className={`agent-proposal ${message.applied ? "applied" : message.discarded ? "discarded" : ""}`}>
                <header><span><ShieldCheck size={16}/><b>{message.proposal.actions.length} proposed {message.proposal.actions.length === 1 ? "change" : "changes"}</b></span>{message.applied && <em><Check size={13}/> Applied</em>}{message.discarded && <em><X size={13}/> Discarded</em>}</header>
                <div>{message.proposal.actions.map((action) => <div className="agent-action" key={action.id}><span className={`agent-action-type ${action.type}`}>{action.type}</span><section><b>{action.label}</b><small>{collectionLabel(action.collection)} · {action.reason}</small><details className="agent-field-preview"><summary>Review exact fields</summary><dl>{Object.entries(action.data).filter(([key]) => !["id","createdAt"].includes(key)).map(([key,value]) => <div key={key}><dt>{fieldLabel(key)}</dt><dd>{fieldValue(key, value, action.data, message.proposal?.nextWorkspace || workspace)}</dd></div>)}{!Object.keys(action.data).length && <p>Complete this task using its saved deadline and recurrence rules.</p>}</dl></details></section></div>)}</div>
                <ProposalEvidence proposal={message.proposal}/>
                {!message.applied && !message.discarded && <footer><button className="button button-ghost" onClick={() => void discard(message)}>Discard</button><button className="button button-primary" disabled={Boolean(applyingId)} onClick={() => void apply(message)}><Check size={15}/> Apply changes</button></footer>}
              </div> : null}
            </div>
          </article>)}
          {loading && <article className="agent-message agent"><div className="agent-message-mark"><Bot size={15}/></div><div className="agent-thinking"><LoaderCircle size={16}/><span>Reading the connected workspace and preparing a safe proposal…</span></div></article>}
        </div>
        {error && <div className="agent-error" role="alert"><CircleAlert size={16}/><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss"><X size={14}/></button></div>}
        {mode === "ask" && <form className="agent-composer" onSubmit={submit}><textarea ref={inputRef} value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }} placeholder="Tell SOSA what happened or what you want done…" rows={3}/><div><span><ShieldCheck size={13}/> Nothing changes until you approve it.</span><button className="button button-primary" disabled={!command.trim() || loading}>Send <ArrowRight size={14}/></button></div></form>}
      </section>
      <aside className="agent-side">
        <section className="panel"><p className="eyebrow">Local preview capability map</p><h2>Status and coverage</h2><p className="agent-capability-intro">These statuses describe this preview only, not the production SOSA service.</p><div className="agent-capability-list">{capabilities.map((capability) => <article key={capability.title}><div><b>{capability.title}</b><span className={`agent-capability-status ${capability.tone}`}>{capability.status}</span></div><small>{capability.copy}</small></article>)}</div></section>
        <section className="panel"><p className="eyebrow">Local preview activity</p><h2>Meeting intake health</h2><div className="agent-intake-health" aria-label="Saved meeting intake status counts">{[
          ["Queued", intakeHealth.queued],
          ["Processing", intakeHealth.processing],
          ["Awaiting review", intakeHealth.awaitingReview],
          ["Completed", intakeHealth.completed],
          ["Closed", intakeHealth.closed],
          ["Failed", intakeHealth.failed],
        ].map(([label, count]) => <div key={label}><b>{count}</b><span>{label}</span></div>)}</div><p className="agent-run-history-note"><CircleAlert size={14}/> Counts come only from saved local meeting statuses. Durable production SOSA run history, retries, costs, and audit events are not connected here.</p><h3 className="agent-recent-heading">Recent meetings</h3>{recentIntakes.length ? <div className="agent-intake-list">{recentIntakes.slice(0, 5).map((item) => <button type="button" key={item.id} onClick={() => void openRecentIntake(item)}><CalendarDays size={13}/><span><b>{item.title}</b><small>{item.meetingDate} · {item.status.replaceAll("_", " ")}</small></span><em>{item.status === "proposed" ? "Review" : item.status === "needs_clarification" ? "Clarify" : item.status === "failed" ? "Retry" : item.status === "ready" ? "Open" : item.status === "processing" ? "View" : "Audit"}</em></button>)}</div> : <p>No meeting notes or transcripts have been saved yet.</p>}</section>
        <section className="panel"><h2>Current boundary</h2><p>Conversation stays available while you move between tabs, but resets on reload. Meeting sources are stored separately in the local preview. The production SOSA service status is not checked here. Live news, Outlook, Teams, SharePoint, tickets, and social accounts remain disconnected, and any preview cloud requests go only to the provider selected in local settings.</p></section>
        <section className="panel agent-trust"><ShieldCheck size={19}/><div><b>Human approval stays in the loop</b><p>The model interprets your request. Deterministic rules validate the records. You approve the proposed changes before they are written.</p></div></section>
      </aside>
    </div>
  </div>;
}
