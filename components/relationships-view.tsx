"use client";
import { AiProfilePanel, ContactNurturePanel } from "./customer-development-panels";
import { contactOutreachGuard } from "@/lib/customer-development";

import { FormEvent, useState } from "react";
import { Archive, ArrowRight, Building2, Check, ExternalLink, Mail, Plus, Search, ShieldCheck, Target, UserRound, UsersRound } from "lucide-react";
import type { AccountItem, ActivityItem, ContactItem, CampaignItem, TaskCategory, TaskItem, OpportunityItem, ProjectItem, PartnershipItem } from "@/lib/types";
import { MAX_FOCUS_ACCOUNTS, MAX_FOCUS_CONTACTS_PER_ACCOUNT, SOCIAL_ACTION_TYPES, localDate, socialSellingProgress } from "@/lib/social-selling";

import { GtmActivityForm } from "./gtm-activity-form";
import { ACQUISITION_MOTIONS, GTM_SOURCE_OPTIONS } from "@/lib/gtm-sources";
import { CONTACT_LIFECYCLES } from "@/lib/gtm-metrics";
import { accountViewLabel, ClientsView } from "./clients-view";
import { accountRelationship, matchesRelationshipView, RELATIONSHIP_VIEWS, type RelationshipView } from "@/lib/client-relationships";
import { getTeamViewProfile } from "@/lib/team-views";
import { outreachGuard, preserveEmploymentHistory, preserveOriginalSource, RELATIONSHIP_ROLES } from "@/lib/relationship-context";
import { RelationshipContextWorkspace } from "./relationship-context-panel";
import { CommunicationTimeline } from "./communication-timeline";
import { PersonCommunicationProfile } from "./person-communication-profile";

type Setter<T> = React.Dispatch<React.SetStateAction<T[]>>;
type AddTask = (input: { title: string; description: string; due?: string; category: TaskCategory; relatedType?: "account" | "contact" | "opportunity" | "partnership" | "project"; relatedId?: string; recurrence?: string; priority?: TaskItem["priority"] }) => void;
type Section = "accounts" | "clients" | "contacts" | "playbook" | "activity" | "connections" | "nurture" | "weekly";
const sourceOptions = GTM_SOURCE_OPTIONS;
const buyingRoles: ContactItem["buyingRole"][] = ["Decision Maker", "Champion", "Influencer", "Technical Evaluator", "Other"];
const companySizeBands: NonNullable<AccountItem["companySizeBand"]>[] = ["Unknown", "1-49", "50-249", "250-999", "1,000-4,999", "5,000+"];

function Label({ children, tone = "" }: { children: React.ReactNode; tone?: string }) { return <span className={`label ${tone ? `label-${tone}` : ""}`}>{children}</span>; }
function Empty({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) { return <section className="panel empty-state">{icon}<h2>{title}</h2><p>{copy}</p></section>; }
function accountName(accounts: AccountItem[], id: string) { return accounts.find((account) => account.id === id)?.name || "Unlinked"; }

export function RelationshipsView({ accounts, setAccounts, contacts, setContacts, activities, setActivities, campaigns, tasks, opportunities, projects, partnerships, goTo, addTask, initialFocus, defaultOwner = "" }: {
  initialFocus?: string | number;
  defaultOwner?: string;
  accounts: AccountItem[]; setAccounts: Setter<AccountItem>; contacts: ContactItem[]; setContacts: Setter<ContactItem>; activities: ActivityItem[]; setActivities: Setter<ActivityItem>; campaigns: CampaignItem[]; tasks: TaskItem[]; addTask: AddTask;
  opportunities: OpportunityItem[]; projects: ProjectItem[]; partnerships: PartnershipItem[];
  goTo: (tab: "agent" | "relationships" | "pipeline" | "projects" | "partnerships" | "tasks", recordId?: string | number) => void;
}) {
  const accountFocus = typeof initialFocus === "string" && initialFocus.startsWith("client:") ? initialFocus.slice(7) : typeof initialFocus === "string" && initialFocus.startsWith("account:") ? initialFocus.slice(8) : undefined;
  const [section, setSection] = useState<Section>(accountFocus !== undefined ? "clients" : initialFocus === "531" ? "playbook" : initialFocus === "connections" || initialFocus === "nurture" || initialFocus === "weekly" ? initialFocus : initialFocus === "activity" ? "activity" : initialFocus === "people" || contacts.some((person) => person.id === initialFocus) ? "contacts" : "accounts");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activityEdit, setActivityEdit] = useState<ActivityItem | undefined>();
  const [motionFilter, setMotionFilter] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState("");
  const [personAccountFilter, setPersonAccountFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState<RelationshipView>("All relationships");
  const [query, setQuery] = useState(contacts.find((item) => item.id === initialFocus)?.name || accounts.find((item) => item.id === initialFocus)?.name || "");
  const [notice, setNotice] = useState("");
  const [archivedActivity, setArchivedActivity] = useState<ActivityItem>();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [draftRoles, setDraftRoles] = useState<string[]>([]);
  const activeAccounts = accounts.filter((item) => !item.archivedAt);
  const activeContacts = contacts.filter((item) => !item.archivedAt);
  const activeActivities = activities.filter((item) => !item.archivedAt);
  const focusedPerson = section === "contacts" ? activeContacts.find((item) => item.id === initialFocus) : undefined;
  const unlinkedPeopleCount = activeContacts.filter((item) => !activeAccounts.some((account) => account.id === item.accountId)).length;
  const progress = socialSellingProgress(accounts, contacts, activities);
  const relationshipRecords = { contacts, activities, opportunities, projects, partnerships, tasks };
  const today = localDate();
  const update = (key: string, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const updateContact = (id: string, changes: Partial<ContactItem>) => setContacts((items) => items.map((item) => item.id === id ? { ...item, ...changes } : item));
  const close = () => { setShowForm(false); setDraft({}); setDraftRoles([]); setEditingId(null); setActivityEdit(undefined); };
  const editRecord = (item: AccountItem | ContactItem) => { setDraft(Object.fromEntries(Object.entries(item).map(([key,value]) => [key,String(value ?? "")]))); setDraftRoles("accountId" in item ? item.relationshipRoles || [] : []); setEditingId(item.id); setShowForm(true); window.scrollTo({ top:0, behavior:"smooth" }); };
  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 3200); };
  const saveActivity = (item: ActivityItem) => setActivities((items) => [item, ...items.filter((current) => current.id !== item.id)]);
  const archiveActivity = (item: ActivityItem) => {
    setActivities((items) => items.map((current) => current.id === item.id ? { ...current, archivedAt: new Date().toISOString() } : current));
    setArchivedActivity(item);
  };
  const undoArchive = () => {
    if (!archivedActivity) return;
    setActivities((items) => items.map((item) => item.id === archivedActivity.id ? { ...item, archivedAt: undefined } : item));
    setArchivedActivity(undefined);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault(); if (!draft.name?.trim()) return;
    const now = new Date().toISOString();
    if (section === "accounts") {
      const owner = (draft.owner || defaultOwner).trim();
      if (!owner) return flash("Choose an account owner before saving.");
      const existing = accounts.find((item) => item.id === editingId);
      const accountId = existing?.id || crypto.randomUUID();
      const initialPersonId = !existing && draft.initialPersonName?.trim() ? crypto.randomUUID() : "";
      const saved: AccountItem = {
        ...existing,
        id: accountId,
        name: draft.name.trim(),
        type: (draft.type || "Prospect") as AccountItem["type"],
        status: (draft.status || "Active") as AccountItem["status"],
        owner,
        ownerProfileId: getTeamViewProfile(owner)?.id ?? (existing?.owner === owner ? existing.ownerProfileId : undefined),
        website: draft.website || "",
        notes: draft.notes || "",
        companySizeBand: (draft.companySizeBand || "Unknown") as AccountItem["companySizeBand"],
        focus531: existing?.focus531 || false,
        acquisitionMotion: (draft.acquisitionMotion || "Unclassified") as AccountItem["acquisitionMotion"],
        source: draft.source || "Unknown / Needs Review",
        originatingContactId: draft.originatingContactId || initialPersonId || undefined,
        referrerContactId: draft.referrerContactId || undefined,
        sourceDate: draft.sourceDate || undefined,
        createdAt: existing?.createdAt || now,
      };
      const preserved = preserveOriginalSource(existing, saved);
      setAccounts((items) => existing ? items.map((item) => item.id === existing.id ? preserved : item) : [preserved, ...items]);
      if (initialPersonId) {
        const initialPerson: ContactItem = {
          id: initialPersonId,
          accountId,
          name: draft.initialPersonName.trim(),
          title: draft.initialPersonTitle || "",
          email: draft.initialPersonEmail || "",
          linkedinUrl: "",
          buyingRole: "Other",
          focus531: false,
          nextActionType: "Comment",
          nextAction: "",
          nextActionDue: "",
          relationshipStrength: "New",
          lifecycleStage: "Prospect",
          acquisitionMotion: (draft.initialPersonAcquisitionMotion || saved.acquisitionMotion || "Unclassified") as ContactItem["acquisitionMotion"],
          source: draft.initialPersonSource || saved.source || "Unknown / Needs Review",
          lastContact: "",
          notes: "Added with the account as its initial contact.",
          createdAt: now,
        };
        setContacts((items) => [initialPerson, ...items]);
      }
    }
    if (section === "contacts") setContacts((items) => {
      const existing = items.find((item) => item.id === editingId);
      const saved: ContactItem = { ...existing, id: existing?.id || crypto.randomUUID(), accountId: draft.accountId || "", name: draft.name.trim(), title: draft.title || "", email: draft.email || "", linkedinUrl: draft.linkedinUrl || "", buyingRole: (draft.buyingRole || "Other") as ContactItem["buyingRole"], focus531: Boolean(existing && existing.accountId === draft.accountId && existing.focus531), nextActionType: existing?.nextActionType || "Comment", nextAction: existing?.nextAction || "", nextActionDue: existing?.nextActionDue || "", relationshipStrength: (draft.relationshipStrength || "New") as ContactItem["relationshipStrength"], lifecycleStage: (draft.lifecycleStage || "Unclassified") as ContactItem["lifecycleStage"], leadDate: draft.leadDate || undefined, acquisitionMotion: (draft.acquisitionMotion || "Unclassified") as ContactItem["acquisitionMotion"], source: draft.source || "Unknown / Needs Review", lastContact: draft.lastContact || "", notes: draft.notes || "", createdAt: existing?.createdAt || now };
      saved.relationshipRoles = draftRoles;
      const preserved = preserveEmploymentHistory(existing, saved, draft.employmentEndedAt || "");
      return existing ? items.map((item) => item.id === existing.id ? preserved : item) : [preserved,...items];
    });
    close();
  };
  const toggleAccountFocus = (account: AccountItem) => {
    if (!account.focus531 && progress.focusedAccounts.length >= MAX_FOCUS_ACCOUNTS) return flash("Your five focus-account slots are full.");
    setAccounts((items) => items.map((item) => item.id === account.id ? { ...item, focus531: !item.focus531 } : item));
    if (account.focus531) setContacts((items) => items.map((item) => item.accountId === account.id ? { ...item, focus531: false } : item));
  };
  const toggleContactFocus = (contact: ContactItem) => {
    const account = activeAccounts.find((item) => item.id === contact.accountId);
    if (!account?.focus531) return flash("Add this person’s account to the five focus accounts first.");
    const selected = activeContacts.filter((item) => item.accountId === contact.accountId && item.focus531).length;
    if (!contact.focus531 && selected >= MAX_FOCUS_CONTACTS_PER_ACCOUNT) return flash("This account already has three focus people.");
    updateContact(contact.id, { focus531: !contact.focus531 });
  };
  const logDone = (contact: ContactItem) => {
    if (progress.completedContactIdsToday.has(contact.id)) return;
    const owner = defaultOwner.trim();
    if (!owner) return flash("Choose a preview identity before logging this action.");
    const actionType = contact.nextActionType || "Comment";
    setActivities((items) => [{ id: crypto.randomUUID(), accountId: contact.accountId, contactId: contact.id, channel: "LinkedIn 5-3-1", purpose: "Business development", actionType, metricType: actionType === "Comment" ? "Comment made" : actionType === "Connect" ? "Connection requested" : ["DM", "Video / audio DM", "Share resource"].includes(actionType) ? "Outreach sent" : undefined, summary: `${actionType}: ${contact.nextAction?.trim() || `Engage thoughtfully with ${contact.name}`}`, outcome: "Completed manually on LinkedIn.", owner, ownerProfileId: getTeamViewProfile(owner)?.id, occurredAt: today, createdAt: new Date().toISOString() }, ...items]);
    flash(`Logged today’s action for ${contact.name}. Communication dates come from the history.`);
  };
  const filteredAccounts = activeAccounts.filter((item) => matchesRelationshipView(accountRelationship(item, relationshipRecords), accountFilter) && `${item.name} ${item.type} ${item.notes}`.toLowerCase().includes(query.toLowerCase()));
  const filteredContacts = activeContacts.filter((item) => {
    const hasActiveAccount = activeAccounts.some((account) => account.id === item.accountId);
    const accountMatches = personAccountFilter === "all" || (personAccountFilter === "unlinked" ? !hasActiveAccount : item.accountId === personAccountFilter);
    return accountMatches && (!motionFilter || (item.acquisitionMotion || "Unclassified") === motionFilter) && (!lifecycleFilter || (item.lifecycleStage || "Unclassified") === lifecycleFilter) && `${item.name} ${item.title} ${item.source} ${item.buyingRole} ${accountName(accounts, item.accountId)}`.toLowerCase().includes(query.toLowerCase());
  });
  const changeSection = (value: Section) => {
    close();
    setQuery("");
    setMotionFilter("");
    setLifecycleFilter("");
    setPersonAccountFilter("all");
    setAccountFilter("All relationships");
    if (value === "contacts") return goTo("relationships", "people");
    if (value === "activity" || value === "connections" || value === "nurture" || value === "weekly") return goTo("relationships", value);
    if (value === "accounts") return goTo("relationships");
    setSection(value);
  };
  const startAddPerson = (accountId = "") => { setSection("contacts"); setEditingId(null); setActivityEdit(undefined); setDraftRoles([]); setDraft({ accountId, acquisitionMotion: motionFilter || "Unclassified", lifecycleStage: lifecycleFilter || "Unclassified" }); setShowForm(true); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const sectionLabels: Partial<Record<Section, string>> = { accounts: "Accounts", contacts: "People", activity: "Activity", connections: "Connections", nurture: "Nurture", weekly: "Weekly review" };
  const sectionButtons = <div className="filter-row">{((section === "playbook" ? ["accounts", "contacts", "activity"] : ["accounts", "contacts", "activity", "connections", "nurture", "weekly"]) as Section[]).map((value) => <button key={value} className={section === value ? "active" : ""} aria-pressed={section === value} onClick={() => changeSection(value)}>{sectionLabels[value]}</button>)}</div>;
  if (section === "clients") return <div className="view ops-view relationships-view"><div className="page-heading"><div><p className="eyebrow">CRM</p><h1>Account details</h1><p className="page-description">One account record connects its people, source, deals, projects, follow-ups, activity, and meeting history.</p></div></div><div className="ops-toolbar">{sectionButtons}</div><ClientsView accounts={accounts} setAccounts={setAccounts} setActivities={setActivities} {...relationshipRecords} initialAccountId={accountFocus} onAddPerson={startAddPerson} goTo={goTo}/></div>;
  const action = focusedPerson ? <div className="communication-profile-actions"><button className="button button-secondary" onClick={() => goTo("relationships", "people")}>Back to People</button><button className="button button-ghost" onClick={() => editRecord(focusedPerson)}>Edit person</button></div> : section === "connections" || section === "nurture" || section === "weekly" ? null : section === "playbook" ? <button className="button button-primary" onClick={() => goTo("tasks")}>View shared work <ArrowRight size={16}/></button> : section === "contacts" ? <button className="button button-primary" onClick={() => startAddPerson()}><Plus size={16}/> Add person</button> : <button className="button button-primary" onClick={() => { setEditingId(null); setActivityEdit(undefined); setDraft({ acquisitionMotion: "Unclassified", ...(section === "accounts" && defaultOwner ? { owner: defaultOwner } : {}) }); setShowForm(true); }}><Plus size={16}/> {section === "accounts" ? "Add account" : "Log activity"}</button>;

  return <div className="view ops-view relationships-view">
    <div className="page-heading"><div><p className="eyebrow">{focusedPerson ? "CRM · Person" : section === "playbook" ? "GTM · Outbound" : "Company records"}</p><h1>{focusedPerson?.name || (section === "playbook" ? "Outbound" : "CRM")}</h1><p className="page-description">{focusedPerson ? "One relationship, every conversation, and a clear next step." : section === "playbook" ? "Email, calls, and LinkedIn follow-ups belong to the same outbound workflow. Use the shared accounts, people, and activity history; keep next steps in Work." : "Accounts are organizations; people are the individuals connected to them. Activity records what happened. Deals and projects remain connected without duplicating either record."}</p></div>{action}</div>
    {notice && <div className="relationship-notice" role="status"><ShieldCheck size={15}/>{notice}</div>}
    {archivedActivity && <div className="relationship-notice" role="status">Interaction archived. <button className="button button-ghost" onClick={undoArchive}>Undo archive</button></div>}
    {!focusedPerson && section !== "playbook" && <div className="ops-metrics"><div><b>{activeAccounts.length}</b><span>accounts</span></div><div><b>{activeContacts.length}</b><span>people</span></div><div><b>{unlinkedPeopleCount}</b><span>need account linking</span></div><div><b>{activeActivities.length}</b><span>recorded activities</span></div></div>}
    <div className="ops-toolbar">{sectionButtons}{!focusedPerson && section !== "activity" && section !== "playbook" && <label className="search-box"><Search size={15} aria-hidden="true"/><input aria-label="Search relationships" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search relationships"/></label>}</div>
    {section === "accounts" && <div className="gtm-inline-filters"><label>Account view<select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value as RelationshipView)}>{RELATIONSHIP_VIEWS.map((value) => <option key={value} value={value}>{accountViewLabel(value)}</option>)}</select></label></div>}
    {(section === "connections" || section === "nurture" || section === "weekly") && <RelationshipContextWorkspace key={section} view={section} accounts={accounts} contacts={contacts} activities={activities} query={query} onOpenAccount={(id) => goTo("relationships", `account:${id}`)} onOpenContact={(id) => goTo("relationships", id)}/>}

    {section === "contacts" && !focusedPerson && <div className="gtm-inline-filters"><label>Account link<select value={personAccountFilter} onChange={(e) => setPersonAccountFilter(e.target.value)}><option value="all">All people</option><option value="unlinked">Needs account linking ({unlinkedPeopleCount})</option>{activeAccounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label><label>Source category<select value={motionFilter} onChange={(e) => setMotionFilter(e.target.value)}><option value="">All source categories</option>{ACQUISITION_MOTIONS.map((item) => <option key={item}>{item}</option>)}</select></label><label>Person status<select value={lifecycleFilter} onChange={(e) => setLifecycleFilter(e.target.value)}><option value="">All statuses</option>{CONTACT_LIFECYCLES.map((item) => <option key={item}>{item}</option>)}</select></label></div>}
    {showForm && section === "activity" && <GtmActivityForm key={activityEdit?.id || "new"} initial={activityEdit} defaultOwner={defaultOwner} accounts={accounts} contacts={contacts} campaigns={campaigns} onSave={(item) => { setActivities((items) => [item, ...items.filter((current) => current.id !== item.id)]); close(); }} onCancel={close}/>}
    {showForm && section !== "activity" && <form className="ops-form" onSubmit={submit}><div><p className="eyebrow">{editingId ? "Edit" : "New"} {section === "contacts" ? "person" : "account"}</p>
      {section === "accounts" && <>
        <label>Organization name<input autoFocus required placeholder="Organization name" value={draft.name || ""} onChange={(e) => update("name", e.target.value)}/></label>
        <div className="ops-form-grid">
          <label>Account type<select value={draft.type || "Prospect"} onChange={(e) => update("type", e.target.value)}><option>Prospect</option><option>Client</option><option>Partner</option><option>Network</option><option>Other</option></select></label>
          <label>Account status<select value={draft.status || "Active"} onChange={(e) => update("status",e.target.value)}><option>Active</option><option>Nurture</option><option>Inactive</option></select></label>
          <label>Company size<select value={draft.companySizeBand || "Unknown"} onChange={(e) => update("companySizeBand", e.target.value)}>{companySizeBands.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label>Owner<input required value={draft.owner || ""} onChange={(e) => update("owner", e.target.value)} placeholder={defaultOwner || "Choose an owner"}/></label>
          <label>Website<input type="url" value={draft.website || ""} onChange={(e) => update("website", e.target.value)}/></label>
          <label>How the account entered CRM<select value={draft.acquisitionMotion || "Unclassified"} onChange={(e) => update("acquisitionMotion", e.target.value)}>{ACQUISITION_MOTIONS.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Specific account source<input list="account-source-options" value={draft.source || ""} onChange={(e) => update("source", e.target.value)} placeholder="Referral, event, website, outreach…"/><datalist id="account-source-options">{sourceOptions.map((source) => <option key={source}>{source}</option>)}</datalist></label>
          <label>Source date<input type="date" max={today} value={draft.sourceDate || ""} onChange={(e) => update("sourceDate", e.target.value)}/></label>
          <label>Originating person<select value={draft.originatingContactId || ""} onChange={(e) => update("originatingContactId", e.target.value)}><option value="">Not recorded</option>{activeContacts.map((person) => <option value={person.id} key={person.id}>{person.name} · {accountName(accounts, person.accountId)}</option>)}</select></label>
          <label>Referred by<select value={draft.referrerContactId || ""} onChange={(e) => update("referrerContactId", e.target.value)}><option value="">No referrer recorded</option>{activeContacts.map((person) => <option value={person.id} key={person.id}>{person.name} · {accountName(accounts, person.accountId)}</option>)}</select></label>
        </div>
        {!editingId && <><p className="eyebrow">Optional initial person</p><p className="form-help">If you already know the first person at this organization, add them now. Their connection source can differ from the account origin.</p><div className="ops-form-grid"><label>Person name<input value={draft.initialPersonName || ""} onChange={(e) => update("initialPersonName", e.target.value)} placeholder="Optional"/></label><label>Job title<input value={draft.initialPersonTitle || ""} onChange={(e) => update("initialPersonTitle", e.target.value)}/></label><label>Email<input type="email" value={draft.initialPersonEmail || ""} onChange={(e) => update("initialPersonEmail", e.target.value)}/></label><label>How this person entered CRM<select value={draft.initialPersonAcquisitionMotion || draft.acquisitionMotion || "Unclassified"} onChange={(e) => update("initialPersonAcquisitionMotion", e.target.value)}>{ACQUISITION_MOTIONS.map((item) => <option key={item}>{item}</option>)}</select></label><label>Specific person source<input list="account-source-options" value={draft.initialPersonSource || ""} onChange={(e) => update("initialPersonSource", e.target.value)} placeholder={draft.source || "Connection source"}/></label></div></>}
        <p className="form-help">Account source explains how the organization entered the CRM. The first known source is preserved in the account brief when this record changes. Add subsequent influence in Connections. Each linked person and opportunity keeps its own source.</p>
        <label>Account notes<textarea placeholder="Account context" value={draft.notes || ""} onChange={(e) => update("notes", e.target.value)}/></label>
      </>}
      {section === "contacts" && <>
        <label>Person’s name<input autoFocus required placeholder="Person's name" value={draft.name || ""} onChange={(e) => update("name", e.target.value)}/></label>
        <div className="ops-form-grid">
          <label>Primary account<select value={draft.accountId || ""} onChange={(e) => update("accountId", e.target.value)}><option value="">Unlinked / independent (temporary)</option>{activeAccounts.map((a) => <option value={a.id} key={a.id}>{a.name}</option>)}</select></label>
          <label>Job title<input value={draft.title || ""} onChange={(e) => update("title", e.target.value)}/></label>
          <label>Buying role<select value={draft.buyingRole || "Other"} onChange={(e) => update("buyingRole", e.target.value)}>{buyingRoles.map((role) => <option key={role}>{role}</option>)}</select></label>
          <label>LinkedIn profile<input type="url" value={draft.linkedinUrl || ""} onChange={(e) => update("linkedinUrl", e.target.value)}/></label>
          <label>Email<input type="email" value={draft.email || ""} onChange={(e) => update("email", e.target.value)}/></label>
          <label>Relationship strength<select value={draft.relationshipStrength || "New"} onChange={(e) => update("relationshipStrength", e.target.value)}><option>New</option><option>Developing</option><option>Strong</option><option>Dormant</option></select></label>
          <label>How this person entered CRM<select value={draft.acquisitionMotion || "Unclassified"} onChange={(e) => update("acquisitionMotion",e.target.value)}>{ACQUISITION_MOTIONS.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Specific person source<input list="person-source-options" value={draft.source || ""} onChange={(e) => update("source",e.target.value)} placeholder="How did this connection start?"/><datalist id="person-source-options">{sourceOptions.map((source) => <option key={source}>{source}</option>)}</datalist></label>
          <label>Person status<select value={draft.lifecycleStage || "Unclassified"} onChange={(e) => update("lifecycleStage", e.target.value)}>{CONTACT_LIFECYCLES.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
          <label>Lead first recorded<input type="date" max={today} required={draft.lifecycleStage === "Lead"} value={draft.leadDate || ""} onInput={(e) => update("leadDate", e.currentTarget.value)} onChange={(e) => update("leadDate", e.target.value)}/></label>
          <p className="form-help">Outreach and reply dates are calculated from this person’s communication history. Log an interaction to update them.</p>
        </div>
        {!draft.accountId && <p className="client-review-note">This person will appear in Needs account linking. Use this temporary option only when the organization is unknown or the person is genuinely independent.</p>}
        <fieldset className="relationship-context-checkboxes"><legend>Relationship roles — select all that apply</legend>{RELATIONSHIP_ROLES.map((role) => <label key={role}><input type="checkbox" checked={draftRoles.includes(role)} onChange={(e) => setDraftRoles((roles) => e.target.checked ? [...roles, role] : roles.filter((value) => value !== role))}/>{role}</label>)}</fieldset>
        {editingId && contacts.find((item) => item.id === editingId)?.accountId !== draft.accountId && <label>Previous employment ended (if known)<input type="date" max={today} value={draft.employmentEndedAt || ""} onChange={(e) => update("employmentEndedAt", e.target.value)}/><span className="form-help">The previous organization and title will remain in employment history. Leave the date blank if unknown.</span></label>}
        <label>Relationship notes<textarea placeholder="Relationship context" value={draft.notes || ""} onChange={(e) => update("notes", e.target.value)}/></label>
      </>}
    </div><div className="form-actions"><button type="button" className="button button-ghost" onClick={close}>Cancel</button><button className="button button-primary">Save</button></div></form>}

    {section === "accounts" && (filteredAccounts.length ? (
      <div className="ops-card-grid">
        {filteredAccounts.map((item) => {
          const linkedPeople = contacts.filter((contact) => !contact.archivedAt && contact.accountId === item.id);
          const guard = outreachGuard(item, activities, today);
          return <article className={`panel ops-card ${item.focus531 ? "focus-card" : ""}`} key={item.id}>
            <div className="ops-card-head"><span className="ops-icon"><Building2 size={17}/></span><div><h3>{item.name}</h3><p>{item.clientStatus === "Current client" || item.clientStatus === "Past client" ? item.clientStatus : item.type} · {item.owner}</p></div><div className="record-card-tools"><button aria-label={`Edit account: ${item.name}`} onClick={() => editRecord(item)}>Edit</button><button title="Archive" onClick={() => setAccounts((values) => values.map((value) => value.id === item.id ? { ...value, archivedAt: new Date().toISOString() } : value))}><Archive size={15}/></button></div></div>
            <div className="ops-card-labels"><Label tone="positive">{item.status}</Label><Label>{item.companySizeBand && item.companySizeBand !== "Unknown" ? `${item.companySizeBand} employees` : "Company size unknown"}</Label><Label>{linkedPeople.length} people</Label>{item.acquisitionMotion && item.acquisitionMotion !== "Unclassified" && <Label>{item.acquisitionMotion}</Label>}{item.source && item.source !== "Unknown / Needs Review" && <Label>{item.source}</Label>}{item.focus531 && <Label tone="brief">Outbound · 5-3-1</Label>}</div>
            {item.notes && <p>{item.notes}</p>}
            {guard.blocked && <p className="client-review-note">Routine outreach paused: {guard.reasons.join(" ")}</p>}
            <AiProfilePanel account={item} onSave={(changes) => setAccounts((values) => values.map((value) => value.id === item.id ? { ...value, ...changes } : value))}/>
            <div className="ops-card-foot split"><button onClick={() => goTo("relationships", `account:${item.id}`)}>Open account</button><button onClick={() => toggleAccountFocus(item)}>{item.focus531 ? "Remove from 5-3-1 focus" : "Add to 5-3-1 focus"}</button><button disabled={guard.blocked} title={guard.reasons.join(" ")} onClick={() => addTask({ title: `Follow up with ${item.name}`, description: item.notes || "Move the relationship forward.", category: "Sales", relatedType: "account", relatedId: item.id })}>Follow up <ArrowRight size={13}/></button></div>
          </article>;
        })}
      </div>
    ) : <Empty icon={<Building2/>} title={activeAccounts.length ? "No matching accounts" : "No accounts yet"} copy={activeAccounts.length ? "Try another search or choose All Accounts." : "Add prospects, clients, partners, and other organizations."}/>)}

    {focusedPerson && <PersonCommunicationProfile contact={focusedPerson} accounts={accounts} contacts={contacts} activities={activities} tasks={tasks} campaigns={campaigns} defaultOwner={defaultOwner} onSaveActivity={saveActivity} onArchiveActivity={archiveActivity} onEditContact={() => editRecord(focusedPerson)} onSaveContact={(changes) => updateContact(focusedPerson.id, changes)} onOpenAccount={(id) => goTo("relationships", `account:${id}`)} onOpenTask={(id) => goTo("tasks", id)} onAddFollowUp={(title, due) => addTask({ title, due, description: `Relationship follow-up with ${focusedPerson.name}`, category: "Sales", relatedType: "contact", relatedId: focusedPerson.id })}/>}
    {section === "contacts" && !focusedPerson && (filteredContacts.length ? (
      <div className="ops-card-grid">
        {filteredContacts.map((item) => {
          const linkedAccount = activeAccounts.find((account) => account.id === item.accountId);
          const guard = contactOutreachGuard(item, linkedAccount ? outreachGuard(linkedAccount, activities, today) : { blocked: false, reasons: [] });
          return <article className={`panel ops-card ${item.focus531 ? "focus-card" : ""}`} key={item.id}>
            <div className="ops-card-head"><span className="ops-icon"><UserRound size={17}/></span><div><h3><button type="button" className="communication-person-link" onClick={() => goTo("relationships", item.id)}>{item.name}</button></h3><p>{item.title || "No title"} · {linkedAccount?.name || "Account not linked"}</p></div><div className="record-card-tools"><button aria-label={`Edit person: ${item.name}`} onClick={() => editRecord(item)}>Edit</button><button title="Archive" onClick={() => setContacts((values) => values.map((value) => value.id === item.id ? { ...value, archivedAt: new Date().toISOString() } : value))}><Archive size={15}/></button></div></div>
            <div className="ops-card-labels">{!linkedAccount && <Label tone="watch">Needs account linking</Label>}<Label tone={item.relationshipStrength === "Strong" ? "positive" : "watch"}>{item.relationshipStrength}</Label><Label>{item.buyingRole}</Label>{linkedAccount?.clientStatus && linkedAccount.clientStatus !== "Unclassified" && <Label>Account: {linkedAccount.clientStatus}</Label>}<Label>{item.acquisitionMotion || "Unclassified source"}</Label><Label>{item.source}</Label>{item.focus531 && <Label tone="brief">Outbound · 5-3-1</Label>}</div>
            <div className="ops-form-grid person-status-fields"><label>Person status<select aria-label={`Lifecycle for ${item.name}`} value={item.lifecycleStage || "Unclassified"} onChange={(e) => updateContact(item.id, { lifecycleStage: e.target.value as ContactItem["lifecycleStage"] })}>{CONTACT_LIFECYCLES.map((stage) => <option key={stage}>{stage}</option>)}</select></label><label>Lead first recorded<input aria-label={`Lead date for ${item.name}`} type="date" max={today} value={item.leadDate || ""} onInput={(e) => updateContact(item.id, { leadDate: e.currentTarget.value || undefined })} onChange={(e) => updateContact(item.id, { leadDate: e.target.value || undefined })}/></label></div>
            <ContactNurturePanel contact={item} onSave={(changes) => updateContact(item.id, changes)}/>
            {item.relationshipRoles?.length ? <p className="form-help">Relationship roles: {item.relationshipRoles.join(" · ")}</p> : null}
            {!!item.employmentHistory?.length && <details className="relationship-context-section"><summary>Previous organizations</summary>{item.employmentHistory.map((employment, index) => <p key={`${employment.accountId}:${index}`}><b>{accountName(accounts, employment.accountId)}</b> · {employment.title || "Title not recorded"} · Ended: {employment.endedAt || "Date not recorded"}</p>)}</details>}
            <div className="relationship-links">{item.linkedinUrl && <a href={item.linkedinUrl} target="_blank" rel="noreferrer"><ExternalLink size={12}/>LinkedIn</a>}{item.email && <a href={`mailto:${item.email}`}><Mail size={12}/>{item.email}</a>}</div>
            {item.notes && <p>{item.notes}</p>}
            {guard.blocked && <p className="client-review-note">Routine outreach paused: {guard.reasons.join(" ")}</p>}
            <div className="ops-card-foot split"><button onClick={() => goTo("relationships", item.id)}>View communication history <ArrowRight size={13}/></button>{linkedAccount ? <button onClick={() => goTo("relationships", `account:${linkedAccount.id}`)}>Open account</button> : <button onClick={() => editRecord(item)}>Link account</button>}{linkedAccount && <button onClick={() => toggleContactFocus(item)}>{item.focus531 ? "Remove from 5-3-1 focus" : "Add to 5-3-1 focus"}</button>}<button disabled={guard.blocked} title={guard.reasons.join(" ")} onClick={() => addTask({ title: `Follow up with ${item.name}`, description: `Relationship follow-up · ${accountName(accounts, item.accountId)}`, category: "Sales", relatedType: "contact", relatedId: item.id })}>Follow up <ArrowRight size={13}/></button></div>
          </article>;
        })}
      </div>
    ) : <Empty icon={<UsersRound/>} title={activeContacts.length ? "No matching people" : "No people yet"} copy={activeContacts.length ? "Clear your search or choose All source categories and All statuses." : "Add people and record how each connection began."}/>)}

    {section === "playbook" && <div className="playbook-stack"><section className="panel playbook-intro"><div><p className="eyebrow">LinkedIn within outbound</p><h2>5-3-1: focused relationship building</h2><p>Five accounts, three people in each, one relevant action. Use this LinkedIn approach alongside your email and call follow-ups on the same CRM records.</p></div><div className="human-loop"><ShieldCheck size={18}/><span><b>Manual action required</b> Complete the comment, message, or connection on LinkedIn, then log it here. No scraping or automated outreach.</span></div></section>
      <div className="ops-metrics" aria-label="5-3-1 LinkedIn progress"><div><b>{progress.focusedAccounts.length}/5</b><span>focus accounts</span></div><div><b>{progress.focusedContacts.length}</b><span>focus people</span></div><div><b>{progress.completedContactIdsToday.size}/{progress.focusedContacts.length}</b><span>people engaged today</span></div><div><b>{progress.activeDaysThisWeek}/7</b><span>active days</span></div></div>
      {!progress.focusedAccounts.length ? <Empty icon={<Target/>} title="Choose your five accounts" copy="Open Accounts and add up to five organizations you want to build credibility with this season."/> : progress.focusedAccounts.map((account) => { const people = activeContacts.filter((contact) => contact.accountId === account.id && contact.focus531); const guard = outreachGuard(account, activities, today); return <section className="panel focus-account" key={account.id}><header><div><span className="ops-icon"><Building2 size={16}/></span><div><h2>{account.name}</h2><p>{people.length}/3 focus people</p></div></div><button onClick={() => { setSection("contacts"); setQuery(account.name); }}>Manage people <ArrowRight size={13}/></button></header>
        {people.length ? <div className="focus-people">{people.map((person) => { const done = progress.completedContactIdsToday.has(person.id); const actionType = person.nextActionType || "Comment"; const personGuard = contactOutreachGuard(person, guard); return <article className={`focus-person ${done ? "done" : ""}`} key={person.id}><div className="focus-person-head"><div><h3>{person.name}</h3><p>{person.title || person.buyingRole || "Relationship"}</p></div>{done ? <Label tone="positive"><Check size={11}/> Done today</Label> : <Label>{person.buyingRole || "Other"}</Label>}</div><div className="focus-action"><label>One next action<select value={actionType} onChange={(event) => updateContact(person.id, { nextActionType: event.target.value as ContactItem["nextActionType"] })}>{SOCIAL_ACTION_TYPES.map((value) => <option key={value}>{value}</option>)}</select></label><label>Action detail<input value={person.nextAction || ""} onChange={(event) => updateContact(person.id, { nextAction: event.target.value })} placeholder="Reference the specific post or topic"/></label><label>Due<input type="date" value={person.nextActionDue || ""} onChange={(event) => updateContact(person.id, { nextActionDue: event.target.value })}/></label></div>{personGuard.blocked && <p className="client-review-note">Routine outreach paused: {personGuard.reasons.join(" ")}</p>}<div className="focus-person-actions">{person.linkedinUrl && <a href={person.linkedinUrl} target="_blank" rel="noreferrer"><ExternalLink size={13}/> Open LinkedIn</a>}<button disabled={personGuard.blocked} title={personGuard.reasons.join(" ")} onClick={() => addTask({ title: `${actionType}: ${person.name}`, description: person.nextAction || `Manual LinkedIn action for ${account.name}.`, due: person.nextActionDue || today, category: "Sales", relatedType: "contact", relatedId: person.id })}>Add to Work</button><button className="log-action" disabled={done} onClick={() => logDone(person)}>{done ? "Logged" : "Log done today"}</button></div></article>; })}</div> : <div className="focus-empty"><UserRound/><p>Select up to three people from this account in the People tab.</p><button onClick={() => { setSection("contacts"); setQuery(account.name); }}>Choose people</button></div>}
      </section>; })}</div>}

    {section === "activity" && <section className="panel communication-timeline-panel"><CommunicationTimeline activities={activities} accounts={accounts} contacts={contacts} onEdit={(item) => { setActivityEdit(item); setShowForm(true); window.scrollTo({ top:0, behavior:"smooth" }); }} onArchive={archiveActivity}/></section>}
  </div>;
}
