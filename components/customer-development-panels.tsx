"use client";

import { useState, type FormEvent } from "react";
import type { AccountItem, AdoptionOutcome, AiProfile, ContactItem, ContactNurture, DiscoveryEconomics, OpportunityItem, ProjectItem } from "@/lib/types";
import { AI_CONCERNS, AI_MATURITY, IMPLEMENTATION_READINESS, NURTURE_CHANNELS, NURTURE_METHODS, NURTURE_STATES, cleanAdoptionOutcome, cleanAiProfile, cleanContactNurture, cleanDiscoveryEconomics } from "@/lib/customer-development";
import { useLocalDay } from "@/lib/use-local-day";
import { developmentStyles as styles } from "./customer-development-styles";

type Field<T> = { key: keyof T & string; label: string; options?: readonly string[]; type?: "date"; historical?: boolean; multiline?: boolean };
function Editor<T extends Record<string, string>>({ initial, fields, save, validate }: { initial: T; fields: Field<T>[]; save: (value: T) => void; validate?: (value: T) => string }) {
  const [draft, setDraft] = useState(initial);
  const [message, setMessage] = useState("");
  const today = useLocalDay();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const error = validate?.(draft); if (error) { setMessage(error); return; }
    save(draft); setMessage("Changes queued for saving. Check the workspace save status.");
  };
  return <form className={styles.editor} onSubmit={submit}><div className={styles.fields}>{fields.map((field) => <label key={field.key}>{field.label}{field.options
    ? <select value={draft[field.key]} onChange={(e) => { setDraft({ ...draft, [field.key]: e.target.value }); setMessage(""); }}>{field.options.map((option) => <option key={option}>{option}</option>)}</select>
    : field.multiline ? <textarea maxLength={2000} value={draft[field.key]} onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}/>
    : <input type={field.type || "text"} maxLength={2000} max={field.historical ? today : undefined} value={draft[field.key]} onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}/>}</label>)}</div><button type="submit" className="button button-primary">Save changes</button>{message && <p role="status">{message}</p>}</form>;
}

export function AiProfilePanel({ account, onSave }: { account: AccountItem; onSave: (changes: Partial<AccountItem>) => void }) {
  const profile = account.aiProfile;
  return <section className={styles.panel} aria-label={`AI profile for ${account.name}`}><h4>AI profile</h4><p>AI maturity is not buying intent. Track how this customer uses AI, what concerns them, and what is needed to deliver successfully.</p><div className={styles.summary}><span>{profile?.maturity || "Unknown maturity"}</span><span>{profile?.primaryConcern || "Concern unknown"}</span><span>{profile?.reviewStatus || "Needs review"}</span></div>{profile?.usage && <p><b>Current AI use:</b> {profile.usage}</p>}{profile?.nextQuestion && <p><b>Next discovery question:</b> {profile.nextQuestion}</p>}<details><summary>Edit AI profile</summary><Editor<AiProfile> key={account.id} initial={cleanAiProfile(profile || {})!} fields={[
    { key: "usage", label: "Current tools, use cases and teams using AI", multiline: true },
    { key: "maturity", label: "Current AI maturity", options: AI_MATURITY },
    { key: "implementationReadiness", label: "Readiness for implementation", options: IMPLEMENTATION_READINESS },
    { key: "primaryConcern", label: "Primary concern", options: AI_CONCERNS },
    { key: "otherConcerns", label: "Other concerns / governance gaps" },
    { key: "nextQuestion", label: "Next discovery question" },
    { key: "evidence", label: "Evidence and source (include conflicting information)", multiline: true },
    { key: "evidenceDate", label: "Original evidence date, if known", type: "date", historical: true },
    { key: "reviewer", label: "Reviewed by" },
    { key: "reviewStatus", label: "Review status", options: ["Needs review", "Human reviewed"] },
  ]} validate={(value) => value.reviewStatus === "Human reviewed" && (!value.evidence.trim() || !value.reviewer.trim()) ? "Add the source evidence and reviewer before marking this reviewed." : ""} save={(value) => onSave({ aiProfile: cleanAiProfile(value) })}/></details></section>;
}

export function ContactNurturePanel({ contact, onSave }: { contact: ContactItem; onSave: (changes: Partial<ContactItem>) => void }) {
  const plan = cleanContactNurture(contact.nurture, contact.accountId, contact.email);
  return <section className={styles.panel} aria-label={`Nurture for ${contact.name}`}><h4>How we nurture this person</h4><p>{plan ? `${plan.method} · ${plan.state} · ${plan.owner || "Owner needed"}` : "No personal or campaign plan recorded."}</p>{plan?.nextAction && <p><b>{plan.channel}:</b> {plan.nextAction} · {plan.dueDate || plan.trigger || "Review date needed"}</p>}<details><summary>{plan ? "Edit nurture approach" : "Set nurture approach"}</summary><p>Campaign = a planned email sequence. Personal = one-on-one email, calls, LinkedIn, meetings or introductions. Coordinated mix uses both with one owner. This demo records plans; it does not enroll recipients or send messages.</p><Editor<ContactNurture> key={`${contact.id}:${contact.accountId}:${contact.email}`} initial={plan || cleanContactNurture({}, contact.accountId, contact.email)!} fields={[
    { key: "method", label: "Nurture method", options: NURTURE_METHODS }, { key: "state", label: "Plan state", options: NURTURE_STATES },
    { key: "owner", label: "Coordination owner" }, { key: "campaign", label: "Email campaign / sequence name (if used)" },
    { key: "channel", label: "Next action channel", options: NURTURE_CHANNELS }, { key: "nextAction", label: "Next useful action" },
    { key: "dueDate", label: "Next action / review date", type: "date" }, { key: "trigger", label: "Or a meaningful trigger" },
    { key: "coordination", label: "Coordination / pause rules (for example: pause for a reply or live deal)", multiline: true },
    { key: "emailEligibility", label: "Email campaign eligibility", options: ["Unknown", "Reviewed eligible", "Ineligible"] },
    { key: "eligibilityEvidence", label: "Eligibility source and reviewer — not just an email address", multiline: true },
  ]} validate={(value) => {
    if (value.emailEligibility === "Reviewed eligible" && (!contact.email || !contact.accountId || !value.eligibilityEvidence.trim())) return "Link the person and email, and record reviewed eligibility evidence first.";
    if (value.state === "Active" && (!value.owner.trim() || !value.nextAction.trim() || (!value.dueDate && !value.trigger.trim()))) return "An active plan needs an owner, next action, and date or trigger.";
    if (value.state === "Active" && value.method !== "Personal" && (!value.campaign.trim() || value.emailEligibility !== "Reviewed eligible")) return "Active campaign plans need a campaign name and reviewed eligibility. Otherwise save as Paused.";
    return "";
  }} save={(value) => onSave({ nurture: cleanContactNurture({ ...value, eligibilityAccountId: contact.accountId, eligibilityEmail: contact.email }, contact.accountId, contact.email) })}/></details></section>;
}

export function AdoptionPanel({ project, onSave }: { project: ProjectItem; onSave: (changes: Partial<ProjectItem>) => void }) {
  const outcome = project.adoptionOutcome;
  const today = useLocalDay();
  return <section className={styles.panel}><h4>Adoption and customer outcomes</h4><p>Technical acceptance: {outcome?.technicalAcceptance || "Unknown"} · Adoption: {outcome?.adoption || "Unknown"}</p>{outcome?.reviewDate && outcome.reviewDate <= today && <p className={styles.notice}>Adoption review due · {outcome.owner || "Assign an owner"}. Completing delivery does not close this review.</p>}{outcome?.target && <p>Target: {outcome.target} · Observed: {outcome.observed || "Not measured yet"}</p>}<details><summary>Review adoption and outcomes</summary><p>Record measured results separately from technical completion. “On target” is a reviewed assessment, not an automatically verified ROI claim.</p><Editor<AdoptionOutcome> key={project.id} initial={cleanAdoptionOutcome(outcome || {})!} fields={[
    { key: "technicalAcceptance", label: "Customer technical acceptance", options: ["Unknown", "Not accepted", "Accepted"] },
    { key: "adoption", label: "Adoption status", options: ["Unknown", "Not started", "Testing", "Below target", "On target"] },
    { key: "measure", label: "Measure and unit (e.g. weekly active users, hours saved)" }, { key: "baseline", label: "Baseline, if known" },
    { key: "target", label: "Target" }, { key: "observed", label: "Observed result — blank means not measured" },
    { key: "evidence", label: "Measurement / acceptance evidence", multiline: true }, { key: "evidenceDate", label: "Evidence date", type: "date", historical: true },
    { key: "owner", label: "Adoption owner" }, { key: "reviewDate", label: "Next review date", type: "date" }, { key: "blocker", label: "Adoption blocker / next intervention", multiline: true },
  ]} validate={(value) => value.adoption === "On target" && (!value.measure.trim() || !value.target.trim() || !value.observed.trim()) ? "Record the measure, target and observed result before marking adoption on target." : (value.technicalAcceptance === "Accepted" || value.adoption === "On target") && (!value.evidence.trim() || !value.owner.trim()) ? "Record evidence and an owner for acceptance or an on-target assessment." : ""} save={(value) => onSave({ adoptionOutcome: cleanAdoptionOutcome(value) })}/></details></section>;
}

export function DiscoveryEconomicsPanel({ opportunity, onSave }: { opportunity: OpportunityItem; onSave: (changes: Partial<OpportunityItem>) => void }) {
  return <section className={styles.panel}><h4>Before investing in discovery</h4><p>Budget: {opportunity.discoveryEconomics?.budgetStatus || "Unknown"} · Delivery capacity: {opportunity.discoveryEconomics?.deliveryCapacity || "Unknown"}</p><details><summary>Review commercial fit and effort</summary><Editor<DiscoveryEconomics> key={opportunity.id} initial={cleanDiscoveryEconomics(opportunity.discoveryEconomics || {})!} fields={[
    { key: "budgetStatus", label: "Customer budget status", options: ["Unknown", "Discussing", "Customer confirmed", "Not funded"] },
    { key: "budgetEvidence", label: "Budget range, currency, evidence and source", multiline: true },
    { key: "deliveryCapacity", label: "Spej delivery capacity", options: ["Unknown", "Needs review", "Available", "Constrained"] },
    { key: "discoveryEffort", label: "Proposed discovery effort and investment limit" }, { key: "nextQuestion", label: "Next qualification question" },
  ]} validate={(value) => value.budgetStatus === "Customer confirmed" && !value.budgetEvidence.trim() ? "Record the customer's budget evidence first." : ""} save={(value) => onSave({ discoveryEconomics: cleanDiscoveryEconomics(value) })}/></details></section>;
}
