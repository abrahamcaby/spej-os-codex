"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, CalendarPlus, ExternalLink, Mail, Plus } from "lucide-react";
import type { AccountItem, ActivityItem, CampaignItem, ContactItem, TaskItem } from "@/lib/types";
import { contactCommunicationActivities, contactCommunicationDates, nextContactFollowUp } from "@/lib/communication-history";
import { validMetricDate } from "@/lib/gtm-metrics";
import { useLocalDay } from "@/lib/use-local-day";
import { contactOutreachGuard } from "@/lib/customer-development";
import { outreachGuard } from "@/lib/relationship-context";
import { CommunicationTimeline } from "./communication-timeline";
import { GtmActivityForm } from "./gtm-activity-form";
import { ContactNurturePanel } from "./customer-development-panels";

type Props = {
  contact: ContactItem;
  accounts: AccountItem[];
  contacts: ContactItem[];
  activities: ActivityItem[];
  tasks: TaskItem[];
  campaigns: CampaignItem[];
  defaultOwner: string;
  onSaveActivity: (activity: ActivityItem) => void;
  onArchiveActivity: (activity: ActivityItem) => void;
  onSaveContact: (changes: Partial<ContactItem>) => void;
  onEditContact: () => void;
  onOpenAccount: (id: string) => void;
  onOpenTask: (id: string | number) => void;
  onAddFollowUp: (title: string, due: string) => void;
};

export function PersonCommunicationProfile({ contact, accounts, contacts, activities, tasks, campaigns, defaultOwner, onSaveActivity, onArchiveActivity, onSaveContact, onEditContact, onOpenAccount, onOpenTask, onAddFollowUp }: Props) {
  const today = useLocalDay();
  const [logging, setLogging] = useState(false);
  const [editing, setEditing] = useState<ActivityItem>();
  const [addingFollowUp, setAddingFollowUp] = useState(false);
  const [followUpTitle, setFollowUpTitle] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const account = accounts.find((item) => !item.archivedAt && item.id === contact.accountId);
  const history = contactCommunicationActivities(contact.id, activities);
  const dates = contactCommunicationDates(contact.id, activities, today);
  const next = nextContactFollowUp(contact, tasks, today);
  const guard = contactOutreachGuard(contact, account ? outreachGuard(account, activities, today) : { blocked: false, reasons: [] });
  const linkedIn = /^https?:\/\//i.test(contact.linkedinUrl || "") ? contact.linkedinUrl : undefined;
  const closeActivity = () => { setLogging(false); setEditing(undefined); };
  const saveFollowUp = (event: FormEvent) => {
    event.preventDefault();
    if (!followUpTitle.trim() || !validMetricDate(followUpDate)) return setError("Add a follow-up action and a valid date.");
    onAddFollowUp(followUpTitle.trim(), followUpDate);
    setAddingFollowUp(false); setFollowUpTitle(""); setFollowUpDate(""); setError("");
    setNotice("Follow-up added to My Work and linked to this person. Nothing was sent.");
  };

  return <div className="person-communication-profile">
    <section className="panel communication-person-summary" aria-label={`Profile for ${contact.name}`}>
      {!account && <p className="communication-muted">Needs account linking · <button type="button" className="button button-ghost" onClick={onEditContact}>Link account</button></p>}
      <div className="communication-section-heading"><div><p>{contact.title || "Title not recorded"} · {account?.name || "Account not linked"}</p><div className="communication-person-links">{contact.email && <a href={`mailto:${contact.email}`}><Mail size={15} aria-hidden="true"/>{contact.email}</a>}{linkedIn && <a href={linkedIn} target="_blank" rel="noreferrer"><ExternalLink size={15} aria-hidden="true"/>LinkedIn</a>}{account && <button type="button" className="button button-ghost" onClick={() => onOpenAccount(account.id)}>Open account <ArrowRight size={14} aria-hidden="true"/></button>}</div></div><button type="button" className="button button-primary" onClick={() => { setLogging(true); setEditing(undefined); setNotice(""); }}><Plus size={16} aria-hidden="true"/> Log interaction</button></div>
      <dl className="communication-summary-dates"><div><dt>Last outreach</dt><dd>{dates.lastOutreach || "Not recorded"}</dd></div><div><dt>Last reply</dt><dd>{dates.lastReply || "Not recorded"}</dd></div><div><dt>Last conversation</dt><dd>{dates.lastConversation || "Not recorded"}</dd></div><div><dt>Next follow-up</dt><dd>{next ? <>{next.overdue ? "Overdue · " : ""}{next.date}<small>{next.title}</small>{next.taskId !== undefined && <button type="button" className="button button-ghost" onClick={() => onOpenTask(next.taskId!)}>Open work item <ArrowRight size={12}/></button>}</> : "Not scheduled"}</dd></div></dl>
      <p className="communication-muted">These dates come from recorded interactions, not profile edits or import dates. An unanswered message is outreach, not a reply.</p>
      {guard.blocked && <p className="client-review-note">Routine outreach paused: {guard.reasons.join(" ")} You can still log past interactions and record existing follow-up commitments.</p>}
      <div className="communication-profile-actions"><button type="button" className="button button-secondary" aria-expanded={addingFollowUp} onClick={() => { setAddingFollowUp(!addingFollowUp); setError(""); }}><CalendarPlus size={15} aria-hidden="true"/> {addingFollowUp ? "Cancel follow-up" : "Add follow-up"}</button><span className="communication-muted">Manual history · Outlook, Teams, text, and LinkedIn syncing are not connected.</span></div>
      {addingFollowUp && <form className="communication-followup-form" onSubmit={saveFollowUp}><label>Follow-up action<input required maxLength={300} value={followUpTitle} onChange={(event) => setFollowUpTitle(event.target.value)} placeholder="Send the example we discussed"/></label><label>Follow-up date<input required type="date" value={followUpDate} onInput={(event) => setFollowUpDate(event.currentTarget.value)} onChange={(event) => setFollowUpDate(event.target.value)}/></label><button className="button button-primary">Save follow-up</button><p>This creates a work item for you. It does not send or schedule a message.</p>{error && <p role="alert">{error}</p>}</form>}
      {contact.notes && <details className="communication-profile-notes"><summary>Relationship notes</summary><p>{contact.notes}</p></details>}
      {contact.lastContact && <details className="communication-profile-notes"><summary>Earlier contact-date record</summary><p>{contact.lastContact} was previously entered on this profile. It is preserved for reference and does not count as verified outreach or a reply.</p></details>}
      {contact.employmentHistory?.length ? <details className="communication-profile-notes"><summary>Previous organizations</summary>{contact.employmentHistory.map((item, index) => <p key={`${item.accountId}:${index}`}>{accounts.find((entry) => entry.id === item.accountId)?.name || "Previous account"} · {item.title || "Title not recorded"} · Ended: {item.endedAt || "Date not recorded"}</p>)}<p>Earlier interactions retain the account they originally belonged to.</p></details> : null}
    </section>
    {notice && <p className="relationship-notice" role="status">{notice}</p>}
    {(logging || editing) && <GtmActivityForm key={editing?.id || `new:${contact.id}`} accounts={accounts} contacts={contacts} campaigns={campaigns} initial={editing} defaults={{ accountId: contact.accountId, contactId: contact.id, owner: defaultOwner }} lockPerson defaultOwner={defaultOwner} onCancel={closeActivity} onSave={(item) => { onSaveActivity(item); closeActivity(); setNotice("Interaction saved. Communication dates have been recalculated from the history."); }}/>}
    <section className="panel communication-timeline-panel"><CommunicationTimeline activities={history} accounts={accounts} contacts={contacts} scope="person" onEdit={(item) => { setEditing(item); setLogging(false); setNotice(""); }} onArchive={(item) => { onArchiveActivity(item); setNotice(""); }}/></section>
    <details className="panel communication-nurture-details"><summary>Relationship approach &amp; nurture</summary><ContactNurturePanel contact={contact} onSave={onSaveContact}/></details>
  </div>;
}
