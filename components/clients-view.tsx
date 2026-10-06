"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, CalendarClock, Check, FileText, Search, UsersRound } from "lucide-react";
import type { AccountItem, ActivityItem, ProjectItem } from "@/lib/types";
import { accountRelationship, addRelationshipDays, CHECK_IN_CADENCES, CLIENT_STATUSES, clientPlanIssue, matchesRelationshipView, OUTREACH_PREFERENCES, RELATIONSHIP_VIEWS, taskBelongsToAccount, type ClientRecords, type RelationshipView } from "@/lib/client-relationships";
import { metricDay } from "@/lib/gtm-metrics";
import { OFFERING_LABELS } from "@/lib/gtm-navigation";
import { projectDddPhase, projectPlaybook, projectType } from "@/lib/gtm-navigation";
import { GtmActivityForm } from "./gtm-activity-form";
import { useLocalDay } from "@/lib/use-local-day";
import { RelationshipContextPanel } from "./relationship-context-panel";
import { CommunicationTimeline } from "./communication-timeline";

type GoTo = (tab: "agent" | "relationships" | "pipeline" | "projects" | "partnerships" | "tasks", recordId?: string | number) => void;
type Props = ClientRecords & {
  accounts: AccountItem[];
  setAccounts: React.Dispatch<React.SetStateAction<AccountItem[]>>;
  setActivities: React.Dispatch<React.SetStateAction<ActivityItem[]>>;
  initialAccountId?: string;
  onAddPerson?: (accountId: string) => void;
  goTo: GoTo;
};

const accountViewLabels: Record<RelationshipView, string> = {
  "All relationships": "All Accounts",
  "Current clients": "Current Clients",
  "Past clients": "Past Clients",
  "Active opportunities": "Open Deals",
  Prospecting: "Prospecting",
  "Partners & network": "Partners & Network",
  "Check-ins due": "Follow-ups Due",
  "Needs classification": "Needs Attention",
};

export function accountViewLabel(view: RelationshipView) {
  return accountViewLabels[view];
}

function projectStatusLabel(value: ProjectItem["operationalStatus"]) {
  if (value === "Not Started") return "Starting";
  if (value === "At Gate") return "Awaiting Review";
  return value;
}

function ClientPlanForm({ account, records, onSave, onCancel }: { account: AccountItem; records: ClientRecords; onSave: (changes: Partial<AccountItem>) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<Partial<AccountItem>>({
    clientStatus: account.clientStatus || "Unclassified", isPartner: Boolean(account.isPartner),
    checkInCadence: account.checkInCadence || "Not set", outreachPreference: account.outreachPreference || "Allowed",
    checkInOwner: account.checkInOwner || account.owner, checkInContactId: account.checkInContactId || "", checkInReason: account.checkInReason || "",
    lastCheckIn: account.lastCheckIn || "", nextCheckIn: account.nextCheckIn || "", nextMeetingDate: account.nextMeetingDate || "", checkInTaskId: account.checkInTaskId || "",
  });
  const [error, setError] = useState("");
  const update = (changes: Partial<AccountItem>) => setDraft((value) => ({ ...value, ...changes }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.checkInOwner?.trim()) return setError("Choose a follow-up owner.");
    const issue = clientPlanIssue({ ...account, ...draft }, records);
    if (issue) return setError(issue);
    if (draft.lastCheckIn && draft.lastCheckIn > metricDay()) return setError("Last relationship check-in must be today or earlier.");
    onSave({ ...draft, checkInOwner: draft.checkInOwner.trim() });
  };
  return <form className="ops-form client-plan-form" onSubmit={submit}>
    <div><p className="eyebrow">Account plan · {account.name}</p><h3>Relationship status and follow-up</h3><p>Client status, partner status, and open deals are tracked separately. Saving this form does not send a message.</p></div>
    <div className="ops-form-grid">
      <label>Client status<select value={draft.clientStatus} onChange={(e) => update({ clientStatus: e.target.value as AccountItem["clientStatus"] })}>{CLIENT_STATUSES.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Partner status<select value={draft.isPartner ? "yes" : "no"} onChange={(e) => update({ isPartner: e.target.value === "yes" })}><option value="no">Not marked as a partner</option><option value="yes">Also a partner</option></select></label>
      <label>Outreach status<select value={draft.outreachPreference} onChange={(e) => update({ outreachPreference: e.target.value as AccountItem["outreachPreference"] })}>{OUTREACH_PREFERENCES.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Follow-up schedule<select value={draft.checkInCadence} onChange={(e) => update({ checkInCadence: e.target.value as AccountItem["checkInCadence"] })}>{CHECK_IN_CADENCES.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Follow-up owner<input required maxLength={120} value={draft.checkInOwner} onChange={(e) => update({ checkInOwner: e.target.value })}/></label>
      <label>Primary contact<select value={draft.checkInContactId} onChange={(e) => update({ checkInContactId: e.target.value })}><option value="">Account-level follow-up</option>{records.contacts.filter((person) => !person.archivedAt && person.accountId === account.id).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
      <label>Last relationship check-in<input type="date" max={metricDay()} value={draft.lastCheckIn} onChange={(e) => update({ lastCheckIn: e.target.value })}/></label>
      <label>Next follow-up date<input type="date" value={draft.nextCheckIn} onChange={(e) => update({ nextCheckIn: e.target.value })}/></label>
      <label>Next confirmed meeting (optional)<input type="date" value={draft.nextMeetingDate} onChange={(e) => update({ nextMeetingDate: e.target.value })}/></label>
      <label>Linked work item<select value={draft.checkInTaskId} onChange={(e) => update({ checkInTaskId: e.target.value })}><option value="">No linked work item</option>{records.tasks.filter((task) => !task.done && taskBelongsToAccount(task, account.id, records)).map((task) => <option key={task.id} value={String(task.id)}>{task.title} · {task.due || "No date"}</option>)}</select></label>
    </div>
    <p>Partner accounts and linked partner records remain visible in Partners.</p>
    <label>Follow-up purpose<textarea maxLength={1000} value={draft.checkInReason} onChange={(e) => update({ checkInReason: e.target.value })} placeholder="Review outcomes, share a relevant update, or revisit a prior discussion."/></label>
    <p className="page-description">A follow-up stays open until a completed conversation is recorded on or after its date. Completed meetings and calls update the schedule; unanswered messages do not. A confirmed meeting or linked work item prevents a duplicate prompt for seven days.</p>
    {error && <p role="alert">{error}</p>}
    <div className="form-actions"><button type="button" className="button button-ghost" onClick={onCancel}>Cancel</button><button className="button button-primary">Save account plan</button></div>
  </form>;
}

export function ClientsView(props: Props) {
  const today = useLocalDay();
  const { accounts, setAccounts, setActivities, initialAccountId, onAddPerson, goTo } = props;
  const [view, setView] = useState<RelationshipView>("All relationships");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("Next check-in");
  const [expanded, setExpanded] = useState<string | null>(initialAccountId || null);
  const [editing, setEditing] = useState<string | null>(null);
  const [logging, setLogging] = useState<string | null>(null);
  const [editingActivity, setEditingActivity] = useState<ActivityItem>();
  const [notice, setNotice] = useState("");
  const profiles = accounts.filter((account) => !account.archivedAt).map((account) => accountRelationship(account, props, today));
  const visible = profiles.filter((profile) => (!initialAccountId || profile.account.id === initialAccountId) && matchesRelationshipView(profile, view) && `${profile.account.name} ${profile.account.owner} ${profile.account.notes} ${profile.account.checkInReason || ""} ${profile.people.map((person) => person.name).join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => sort === "Name" ? a.account.name.localeCompare(b.account.name) : (a.due || "9999").localeCompare(b.due || "9999") || a.account.name.localeCompare(b.account.name));
  const updateAccount = (id: string, changes: Partial<AccountItem>) => { setAccounts((items) => items.map((item) => item.id === id ? { ...item, ...changes } : item)); setNotice("Account plan saved. Existing deals, projects, and people are unchanged."); };
  return <section className="client-workspace" aria-label="Account details">
    <div className="gtm-section-heading"><div><p className="eyebrow">CRM account view</p><h2>{initialAccountId ? "Account details" : "Account relationships"}</h2><p>Review account status, source, linked people, scheduled follow-ups, open deals, and project history.</p></div>{initialAccountId && <button className="button button-secondary" onClick={() => goTo("relationships")}>Back to Accounts</button>}</div>
    <div className="ops-metrics"><div><b>{profiles.filter((p) => p.clientStatus === "Current client").length}</b><span>current clients</span></div><div><b>{profiles.filter((p) => p.clientStatus === "Past client").length}</b><span>past clients</span></div><div><b>{profiles.filter((p) => p.openOpportunities.length).length}</b><span>accounts with open deals</span></div><div><b>{profiles.filter((p) => p.checkInDue).length}</b><span>follow-ups due</span></div></div>
    {!initialAccountId && <div className="gtm-inline-filters client-filters"><label>Account view<select value={view} onChange={(e) => setView(e.target.value as RelationshipView)}>{RELATIONSHIP_VIEWS.map((value) => <option key={value} value={value}>{accountViewLabel(value)}</option>)}</select></label><label className="search-field">Search<span className="search-box"><Search size={16} aria-hidden="true"/><input aria-label="Search account relationships" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Account, person, or context"/></span></label><label>Arrange by<select value={sort} onChange={(e) => setSort(e.target.value)}><option value="Next check-in">Next follow-up</option><option>Name</option></select></label></div>}
    {notice && <p className="relationship-notice" role="status"><Check size={15}/>{notice}</p>}
    {visible.length === 0 && <div className="panel empty-state"><UsersRound/><h3>No accounts in this view</h3><p>Add an account in CRM, or choose All Accounts. Client records with unclear status are in Needs Attention.</p></div>}
    <div className="client-account-list">{visible.map((profile) => {
      const { account } = profile;
      const person = profile.people.find((item) => item.id === account.checkInContactId);
      const meetingSources = profile.activities.filter((item) => item.sourceArtifactId);
      const accountSource = account;
      const originatingPerson = props.contacts.find((item) => item.id === accountSource.originatingContactId);
      const referrer = props.contacts.find((item) => item.id === accountSource.referrerContactId);
      return <article className="panel client-account" key={account.id}>
        <div className="client-account-heading"><div><h3>{account.name}</h3><p>{profile.owner} · {profile.people.length} people</p></div><div className="ops-card-labels"><span className="label">{profile.clientStatus === "Unclassified" && profile.hasClientHistory ? "Client status needs attention" : profile.clientStatus}</span>{profile.partner && <span className="label label-brief">Partner / network</span>}{profile.openOpportunities.length > 0 && <span className="label label-positive">{profile.openOpportunities.length} open deals</span>}</div></div>
        <div className="client-account-summary"><div><small>Current work</small><strong>{profile.currentProjects.length} active or contracted projects</strong><span>{profile.completedProjects.length} completed projects</span></div><div><small>Last relationship check-in</small><strong>{profile.lastContact || "Not recorded"}</strong><span>{person?.name || "Account-level relationship"}</span></div><div><small>Next follow-up</small><strong>{profile.suppressed || (profile.completedOneTime ? "Completed — one-time follow-up" : !profile.checkInEnabled ? "Not scheduled" : profile.due ? `${profile.checkInDue ? "Due · " : ""}${profile.due}` : "Set a date")}</strong><span>{account.checkInReason || "Add the follow-up purpose"}</span></div></div>
        {(accountSource.source || accountSource.acquisitionMotion || originatingPerson || referrer) && <p className="client-review-note"><b>Account source:</b> {[accountSource.acquisitionMotion, accountSource.source, originatingPerson && `started with ${originatingPerson.name}`, referrer && `referred by ${referrer.name}`, accountSource.sourceDate, accountSource.sourceArtifactId && "source evidence linked"].filter(Boolean).join(" · ")}</p>}
        {profile.statusConflict && <p className="client-review-note">Client status needs review: contracted project work is still open. No status was changed automatically.</p>}
        {profile.needsClassification && <p className="client-review-note">There is client history here. Confirm Current client or Past client; completing one project does not settle the status of other services.</p>}
        <div className="client-actions"><button className="button button-secondary" onClick={() => { setEditing(editing === account.id ? null : account.id); setLogging(null); }}>Edit account plan</button>{onAddPerson && <button className="button button-ghost" onClick={() => onAddPerson(account.id)}>Add person</button>}<button className="button button-ghost" aria-expanded={expanded === account.id} onClick={() => setExpanded(expanded === account.id ? null : account.id)}>People, deals, and history <ArrowRight size={14}/></button><button className="button button-ghost" onClick={() => { setLogging(logging === account.id ? null : account.id); setEditingActivity(undefined); setEditing(null); }}>Log follow-up</button>{profile.checkInDue && <button className="button button-ghost" onClick={() => updateAccount(account.id, { nextCheckIn: addRelationshipDays(metricDay(), 7) })}><CalendarClock size={14}/> Review in 7 days</button>}</div>
        {editing === account.id && (
          <ClientPlanForm key={account.id} account={account} records={props} onCancel={() => setEditing(null)} onSave={(changes) => { updateAccount(account.id, changes); setEditing(null); }}/>
        )}
        {logging === account.id && (
          <GtmActivityForm key={editingActivity?.id || `log:${account.id}`} initial={editingActivity} accounts={accounts} contacts={props.contacts} defaults={{ accountId: account.id, contactId: person?.id || "", owner: profile.owner, purpose: profile.hasClientHistory ? "Client relationship" : profile.partner ? "Partner relationship" : "Business development", metricType: "Check-in completed", channel: "Meeting", summary: `Relationship follow-up with ${account.name}` }} onCancel={() => { setLogging(null); setEditingActivity(undefined); }} onSave={(activity) => { setActivities((items) => [activity, ...items.filter((item) => item.id !== activity.id)]); setLogging(null); setEditingActivity(undefined); setNotice("Interaction saved. Relationship dates reflect the recorded history; unanswered outreach does not complete a check-in."); }}/>
        )}
        {expanded === account.id && <><RelationshipContextPanel account={account} accounts={accounts} contacts={props.contacts} activities={props.activities} onSave={(changes) => updateAccount(account.id, changes)}/><div className="client-history-grid">
          <section><h4>People</h4>{profile.people.length ? profile.people.map((person) => <p key={person.id}><button className="client-text-link" onClick={() => goTo("relationships", person.id)}>{person.name}</button><small>{person.title || person.buyingRole} · {person.relationshipStrength} · {person.source}</small></p>) : <p>No linked people yet.</p>}{onAddPerson && <button className="client-text-link" onClick={() => onAddPerson(account.id)}>Add person to {account.name}</button>}</section>
          <section><h4>Deals</h4>{profile.opportunities.length ? profile.opportunities.map((item) => <p key={item.id}><strong>{item.name}</strong><small>{OFFERING_LABELS[item.motion || "Other"]} · {item.stage}</small>{item.nextSpejAction && <small>Next: {item.nextSpejAction} · {item.nextActionDue || "Date needed"}</small>}</p>) : <p>No linked opportunities. A CRM account does not automatically have an active deal.</p>}<button className="client-text-link" onClick={() => goTo("pipeline")}>Open Sales Pipeline</button></section>
          <section><h4>Project history</h4>{profile.projects.length ? profile.projects.map((item) => <p key={item.id}><strong>{item.name}</strong><small>{projectType(item)}{projectPlaybook(item) === "Discovery / Design / Delivery" ? ` · ${projectDddPhase(item)}` : ""} · {projectStatusLabel(item.operationalStatus)}</small><small>{item.nextMilestone}</small></p>) : <p>No projects are linked to this account yet.</p>}<button className="client-text-link" onClick={() => goTo("projects")}>Open Projects</button></section>
          {account.notes && <section><h4>Account notes</h4><p>{account.notes}</p></section>}
          <section><h4>Meeting sources</h4>{meetingSources.length ? meetingSources.map((item) => <p key={`source:${item.id}`}><strong>{item.sourceLabel || item.summary}</strong><small>{item.occurredAt || "Date not recorded"} · saved meeting source</small><button className="client-text-link" onClick={() => goTo("agent", item.sourceArtifactId)}><FileText size={12}/> Open transcript in SOSA</button></p>) : <p>No meeting source is linked yet. Authorized Outlook or Teams meeting references can appear here after Microsoft Graph is connected. SharePoint and OneDrive file references remain part of the production integration contract, not this preview panel.</p>}</section>
        </div><div className="communication-account-history"><CommunicationTimeline title="Relationship history" scope="account" activities={profile.activities} accounts={accounts} contacts={props.contacts} onEdit={(item) => { setEditingActivity(item); setLogging(account.id); setEditing(null); }}/></div></>}
      </article>;
    })}</div>
    <p className="gtm-period-note">Follow-ups appear in My Work when due within seven days. This is an in-app queue, not an email or Teams notification. No proactive outreach pauses routine prompts only; dated work and customer commitments remain visible.</p>
  </section>;
}
