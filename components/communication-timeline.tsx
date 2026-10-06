"use client";

import { useId, useMemo, useState } from "react";
import { Archive, MessageSquare, Pencil, Search } from "lucide-react";
import type { AccountItem, ActivityItem, ContactItem } from "@/lib/types";
import { ACTIVITY_CHANNELS } from "@/lib/gtm-metrics";
import { communicationActivityDate, sortCommunicationActivities } from "@/lib/communication-history";
import { useLocalDay } from "@/lib/use-local-day";

type Props = {
  activities: ActivityItem[];
  accounts: AccountItem[];
  contacts: ContactItem[];
  title?: string;
  scope?: "all" | "account" | "person";
  onEdit?: (activity: ActivityItem) => void;
  onArchive?: (activity: ActivityItem) => void;
};

/** One history renderer for person profiles, accounts, and the shared activity view. */
export function CommunicationTimeline({ activities, accounts, contacts, title = "Communication history", scope = "all", onEdit, onArchive }: Props) {
  const headingId = useId();
  const today = useLocalDay();
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState("");
  const [person, setPerson] = useState("");
  const [account, setAccount] = useState("");
  const [limit, setLimit] = useState(10);
  const [archiveId, setArchiveId] = useState<string>();
  const accountNames = useMemo(() => new Map(accounts.map((item) => [item.id, item.name])), [accounts]);
  const contactNames = useMemo(() => new Map(contacts.map((item) => [item.id, item.name])), [contacts]);
  const history = useMemo(() => sortCommunicationActivities(activities, today), [activities, today]);
  const needle = query.trim().toLocaleLowerCase();
  const matching = history.filter((item) => (!channel || item.channel === channel) && (!person || item.contactId === person) && (!account || item.accountId === account) && (!needle || [item.summary, item.outcome, item.owner, item.sourceLabel, item.channel, item.metricType, contactNames.get(item.contactId), accountNames.get(item.accountId)].join(" ").toLocaleLowerCase().includes(needle)));
  const knownPeople = contacts.filter((item) => history.some((entry) => entry.contactId === item.id) && (!account || history.some((entry) => entry.contactId === item.id && entry.accountId === account)));
  const knownAccounts = accounts.filter((item) => history.some((entry) => entry.accountId === item.id));
  const clearFilters = () => { setQuery(""); setChannel(""); setPerson(""); setAccount(""); setLimit(10); };

  return <section className="communication-history" aria-labelledby={headingId}>
    <div className="communication-section-heading"><div><h2 id={headingId}>{title}</h2><p>Newest interactions first. The original date stays separate from when you logged it.</p></div><span className="label">{history.length} {history.length === 1 ? "entry" : "entries"}</span></div>
    {history.length > 0 && <div className="communication-filters">
      <label className="communication-search"><span>Search history</span><span><Search size={16} aria-hidden="true"/><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setLimit(10); }} placeholder="Message, notes, or owner"/></span></label>
      <label>Channel<select value={channel} onChange={(event) => { setChannel(event.target.value); setLimit(10); }}><option value="">All channels</option>{ACTIVITY_CHANNELS.map((value) => <option key={value}>{value}</option>)}</select></label>
      {scope === "all" && <label>Account<select value={account} onChange={(event) => { setAccount(event.target.value); setPerson(""); setLimit(10); }}><option value="">All accounts</option>{knownAccounts.map((item) => <option value={item.id} key={item.id}>{item.name}{item.archivedAt ? " (archived)" : ""}</option>)}</select></label>}
      {scope !== "person" && <label>Person<select value={person} onChange={(event) => { setPerson(event.target.value); setLimit(10); }}><option value="">All people</option>{knownPeople.map((item) => <option value={item.id} key={item.id}>{item.name}{item.archivedAt ? " (archived)" : ""}</option>)}</select></label>}
    </div>}
    {history.length > 0 && <p className="communication-results" role="status">Showing {Math.min(limit, matching.length)} of {matching.length} matching {matching.length === 1 ? "entry" : "entries"}{(query || channel || person || account) && <button type="button" className="button button-ghost" onClick={clearFilters}>Clear filters</button>}</p>}
    {matching.length ? <ol className="communication-stream">{matching.slice(0, limit).map((item) => {
      const originalDate = communicationActivityDate(item, today);
      return <li key={item.id} className="communication-entry">
        <div className="communication-entry-icon"><MessageSquare size={18} aria-hidden="true"/></div>
        <article>
          <header><div className="communication-badges"><span className="label label-brief">{item.channel}</span><span className="label">{item.metricType || item.actionType || "Unclassified activity"}</span></div>{originalDate ? <time dateTime={originalDate}>{originalDate}</time> : <span className="communication-muted">Original date unknown</span>}</header>
          <h3>{item.summary}</h3>
          <p className="communication-meta">{scope !== "person" && <span>{contactNames.get(item.contactId) || "Person not linked"}</span>}<span>{accountNames.get(item.accountId) || "Account not linked"}</span><span>Logged by {item.owner || "owner not recorded"}</span></p>
          {item.outcome && (item.outcome.length > 320 ? <details className="communication-message"><summary><span>{item.outcome.slice(0, 240)}…</span><b>Read full message / notes</b></summary><div>{item.outcome}</div></details> : <div className="communication-message communication-message-short">{item.outcome}</div>)}
          <details className="communication-source"><summary>Record details</summary><dl><div><dt>Captured from</dt><dd>{item.captureMethod || "Direct entry"}</dd></div><div><dt>Source reference</dt><dd>{item.sourceLabel || "Not recorded"}</dd></div><div><dt>Purpose</dt><dd>{item.purpose || "Unclassified"}</dd></div><div><dt>Logged at</dt><dd>{item.capturedAt || item.createdAt || "Not recorded"}</dd></div></dl><p>Logging an interaction does not send a message or confirm a sync.</p></details>
          {(onEdit || onArchive) && <div className="communication-entry-actions">{onEdit && <button type="button" className="button button-ghost" aria-label={`Edit activity: ${item.summary}`} onClick={() => onEdit(item)}><Pencil size={13} aria-hidden="true"/> Edit</button>}{onArchive && (archiveId === item.id ? <div className="communication-archive-confirm" role="group" aria-label={`Archive confirmation: ${item.summary}`}><span>Remove from active history?</span><button type="button" className="button button-secondary" onClick={() => { onArchive(item); setArchiveId(undefined); }}>Confirm archive</button><button type="button" className="button button-ghost" onClick={() => setArchiveId(undefined)}>Cancel</button></div> : <button type="button" className="button button-ghost" aria-label={`Archive activity: ${item.summary}`} onClick={() => setArchiveId(item.id)}><Archive size={13} aria-hidden="true"/> Archive</button>)}</div>}
        </article>
      </li>;
    })}</ol> : <div className="communication-empty"><MessageSquare size={24} aria-hidden="true"/><h3>{history.length ? "No matching interactions" : "No activity yet"}</h3><p>{history.length ? "Try a different search or clear the filters." : "Log a call, message, or meeting to start the communication history."}</p></div>}
    {matching.length > limit && <button type="button" className="button button-secondary communication-more" onClick={() => setLimit((value) => value + 10)}>Show more interactions ({matching.length - limit} remaining)</button>}
  </section>;
}
