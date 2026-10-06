"use client";

import { FormEvent, useRef, useState } from "react";
import type { AccountItem, ActivityItem, CampaignItem, ContactItem } from "@/lib/types";
import { ACTIVITY_CHANNELS, ACTIVITY_METRIC_TYPES, ACTIVITY_PURPOSES, metricDay, validMetricDate } from "@/lib/gtm-metrics";
import { getTeamViewProfile } from "@/lib/team-views";
import { CAPTURE_METHODS } from "@/lib/relationship-context";
import { ACTIVITY_MESSAGE_MAX_LENGTH } from "@/lib/communication-history";
import { appendDictationNotes } from "@/lib/activity-dictation";
import { ActivityDictation, type ActivityDictationHandle } from "@/components/activity-dictation";

export function GtmActivityForm({ accounts, contacts, campaigns = [], initial, defaults, defaultOwner = "", lockPerson = false, onSave, onCancel }: {
  accounts: AccountItem[]; contacts: ContactItem[]; campaigns?: CampaignItem[]; initial?: ActivityItem; defaults?: Partial<ActivityItem>;
  defaultOwner?: string; lockPerson?: boolean;
  onSave: (item: ActivityItem) => void; onCancel: () => void;
}) {
  const starting = initial || defaults;
  const sourceBound = Boolean(initial?.sourceArtifactId);
  const [type, setType] = useState<ActivityItem["metricType"] | "">(initial ? initial.metricType || "" : defaults?.metricType || "Outreach sent");
  const [purpose, setPurpose] = useState<NonNullable<ActivityItem["purpose"]>>(starting?.purpose || (initial ? "Unclassified" : "Business development"));
  const [channel, setChannel] = useState<ActivityItem["channel"]>(starting?.channel || "Email");
  const [date, setDate] = useState(starting?.sourceDateKnown === false ? "" : starting?.occurredAt || (initial || starting?.captureMethod && starting.captureMethod !== "Direct entry" ? "" : metricDay()));
  const [unknownDate, setUnknownDate] = useState(starting?.sourceDateKnown === false || Boolean(initial && !initial.occurredAt));
  const [captureMethod, setCaptureMethod] = useState<NonNullable<ActivityItem["captureMethod"]>>(starting?.captureMethod || "Direct entry");
  const [sourceLabel, setSourceLabel] = useState(starting?.sourceLabel || "");
  const [owner, setOwner] = useState(starting?.owner || defaultOwner);
  const [accountId, setAccountId] = useState(starting?.accountId || "");
  const [contactId, setContactId] = useState(starting?.contactId || "");
  const [campaignId, setCampaignId] = useState(starting?.campaignId || "");
  const [summary, setSummary] = useState(starting?.summary || "");
  const [outcome, setOutcome] = useState(starting?.outcome || "");
  const [error, setError] = useState("");
  const dictation = useRef<ActivityDictationHandle>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const hasUnappliedDictation = dictation.current?.hasPending();
    dictation.current?.stop();
    if (hasUnappliedDictation) return setError("Review your dictation and choose Apply to notes, or Discard dictation, before saving this activity.");
    if (!type) return setError("Choose what actually happened before classifying this activity.");
    if (!unknownDate && (!validMetricDate(date) || date > metricDay())) return setError("Use the date this action actually happened, not a future planned date. If it is genuinely unknown, choose Original date unknown.");
    if (!owner.trim()) return setError("Add the person who did the activity.");
    if (lockPerson && (!contactId || contactId !== starting?.contactId || accountId !== (starting?.accountId || ""))) return setError("This activity must stay linked to the person and account it was opened for. Close the form and try again.");
    if (outcome.length > ACTIVITY_MESSAGE_MAX_LENGTH) return setError(`Keep Outcome / context within ${ACTIVITY_MESSAGE_MAX_LENGTH.toLocaleString("en-US")} characters.`);
    const normalizedOwner = owner.trim();
    if (captureMethod !== "Direct entry" && !sourceLabel.trim()) return setError("Add a source reference so the original email, message, or transcript can be checked.");
    dictation.current?.cancel();
    const now = new Date().toISOString();
    onSave({ ...initial, id: initial?.id || crypto.randomUUID(), accountId, contactId, opportunityId: initial?.accountId === accountId ? initial.opportunityId : undefined, projectId: initial?.accountId === accountId ? initial.projectId : undefined, metricType: type, purpose, channel, owner: normalizedOwner, ownerProfileId: getTeamViewProfile(normalizedOwner)?.id ?? (initial?.owner === normalizedOwner ? initial.ownerProfileId : undefined), campaignId: campaignId || undefined, summary: summary.trim() || `${type} via ${channel}`, outcome: outcome.trim(), occurredAt: unknownDate ? "" : date, createdAt: initial?.createdAt || now, capturedAt: initial?.capturedAt || initial?.createdAt || now, captureMethod, sourceDateKnown: !unknownDate, sourceLabel: sourceLabel.trim() });
  };
  return <form className="ops-form gtm-activity-form" onSubmit={submit}>
    <div><p className="eyebrow">{initial ? "Update activity" : "Log one completed action"}</p><h2>What happened?</h2><p className="page-description">One record per action. Log an outbound call as attempted or connected, not both. A booking and a held meeting are separate events on their actual dates. Link a person to count unique people contacted.</p></div>
    <div className="ops-form-grid">
      <label>Captured from<select disabled={sourceBound} value={captureMethod} onChange={(e) => { setCaptureMethod(e.target.value as NonNullable<ActivityItem["captureMethod"]>); if (!initial) { setDate(""); setType(""); } }} >{CAPTURE_METHODS.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Activity type<select autoFocus disabled={sourceBound} required value={type} onChange={(e) => setType(e.target.value as NonNullable<ActivityItem["metricType"]>)}><option value="" disabled>Choose activity type</option>{ACTIVITY_METRIC_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Purpose<select value={purpose} onChange={(e) => setPurpose(e.target.value as NonNullable<ActivityItem["purpose"]>)}>{ACTIVITY_PURPOSES.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Channel<select disabled={sourceBound} value={channel} onChange={(e) => setChannel(e.target.value as ActivityItem["channel"])}>{ACTIVITY_CHANNELS.map((item) => <option key={item}>{item}</option>)}</select></label>
      <div className="activity-date-field"><label>Original activity date<input type="date" disabled={sourceBound || unknownDate} required={!unknownDate} max={metricDay()} value={date} onInput={(e) => setDate(e.currentTarget.value)} onChange={(e) => setDate(e.target.value)}/></label><label className="activity-unknown-date"><input type="checkbox" disabled={sourceBound} checked={unknownDate} onChange={(event) => { setUnknownDate(event.target.checked); setDate(""); }}/> Original date unknown</label></div>
      <label>Activity owner<input required maxLength={120} value={owner} onChange={(e) => setOwner(e.target.value)}/></label>
      <label>Account<select disabled={sourceBound || lockPerson} value={accountId} onChange={(e) => { setAccountId(e.target.value); setContactId(""); }}><option value="">Unlinked</option>{accountId && !accounts.some((item) => item.id === accountId) && <option value={accountId}>Linked account (unavailable)</option>}{accounts.filter((item) => !item.archivedAt || item.id === accountId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Person<select disabled={sourceBound || lockPerson} value={contactId} onChange={(e) => { setContactId(e.target.value); const person = contacts.find((item) => item.id === e.target.value); if (person) setAccountId(person.accountId); }}><option value="">Unlinked — excluded from unique people</option>{contactId && !contacts.some((item) => item.id === contactId) && <option value={contactId}>Linked person (unavailable)</option>}{contacts.filter((item) => item.id === contactId || !item.archivedAt && (!accountId || item.accountId === accountId)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {campaigns.length > 0 && <label>Campaign (optional)<select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}><option value="">No campaign</option>{campaigns.filter((item) => !item.archivedAt).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    </div>
    {sourceBound && <p className="page-description">This activity is linked to reviewed meeting evidence. Correct its source date, participants, account, or activity type through the meeting intake review.</p>}
    {lockPerson && !sourceBound && <p className="page-description">This interaction stays linked to this person and the account recorded for it. Editing an older interaction does not move it to a person’s new company.</p>}
    <label>Source reference<input disabled={sourceBound} maxLength={200} required={captureMethod !== "Direct entry"} value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} placeholder="Email subject and sender, message link, or transcript reference"/></label>
    <p className="page-description">Capture time is stored separately. An old message entered today does not become recent buyer engagement. Choose Original date unknown if you cannot verify the date; the entry stays in history but does not update engagement dates or dated metrics. Review existing activity before saving to avoid logging the same exchange twice.</p>
    <p className="page-description">Client and partner relationship care stays out of prospecting totals. A new buying conversation with an existing client can still be Business development. Use Check-in completed only for an actual substantive exchange, not an unanswered message.</p>
    <label>Summary<input maxLength={1000} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder={`${type} via ${channel}`}/></label>
    <label>Outcome / context<textarea className="activity-message-notes" maxLength={ACTIVITY_MESSAGE_MAX_LENGTH} rows={6} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Paste the relevant message, email excerpt, or call notes. What did they say, and what should happen next?"/></label>
    <p className="activity-notes-count">{outcome.length.toLocaleString("en-US")} / {ACTIVITY_MESSAGE_MAX_LENGTH.toLocaleString("en-US")} characters · Add only information your team needs. Log separate exchanges separately.</p>
    <ActivityDictation ref={dictation} maxLength={ACTIVITY_MESSAGE_MAX_LENGTH} onApply={(transcript) => {
      const result = appendDictationNotes(outcome, transcript, ACTIVITY_MESSAGE_MAX_LENGTH);
      if (!result.applied) return result.error;
      setOutcome(result.value);
      setError("");
      return undefined;
    }}/>
    {error && <p role="alert">{error}</p>}
    <div className="form-actions"><button type="button" className="button button-ghost" onClick={() => { dictation.current?.cancel(); onCancel(); }}>Cancel</button><button className="button button-primary">{initial ? "Update activity" : "Save activity"}</button></div>
  </form>;
}
