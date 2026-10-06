"use client";

import { useState, type FormEvent } from "react";
import type { AccountItem, OpportunityItem, ProjectItem } from "@/lib/types";
import { createDeliveryHandoff, deliveryHandoffIssue, DELIVERY_CONTEXT_LABELS, type DeliveryContext } from "@/lib/delivery-handoff";

type Setter = React.Dispatch<React.SetStateAction<ProjectItem[]>>;
const emptyContext = (): DeliveryContext => ({ scope: "", deliverables: "", startConditions: "", customerCounterpart: "", commitments: "", openQuestions: "", expansionIdeas: "", verifiedOutcomes: "", sourceEvidence: "" });

function ContextFields({ value, change }: { value: DeliveryContext; change: (key: keyof DeliveryContext, value: string) => void }) {
  return <div className="ops-form-grid">{Object.entries(DELIVERY_CONTEXT_LABELS).map(([key, label]) => <label key={key}>{label}<textarea maxLength={2000} value={value[key as keyof DeliveryContext] || ""} onChange={(event) => change(key as keyof DeliveryContext, event.target.value)} /></label>)}</div>;
}

export function DeliveryHandoffPanel({ accounts, opportunities, projects, setProjects }: { accounts: AccountItem[]; opportunities: OpportunityItem[]; projects: ProjectItem[]; setProjects: Setter }) {
  const [selected, setSelected] = useState("");
  const [context, setContext] = useState<DeliveryContext>(emptyContext);
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false);
  const available = opportunities.filter((item) => !item.archivedAt && item.stage === "Closed Won" && !projects.some((project) => project.opportunityId === item.id));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const opportunity = available.find((item) => item.id === selected);
    const account = accounts.find((item) => item.id === opportunity?.accountId);
    const issue = deliveryHandoffIssue(opportunity, account, context, projects);
    if (issue || !opportunity || !account) { setNotice(issue); return; }
    const project = createDeliveryHandoff(opportunity, account, context, projects);
    setProjects((items) => items.some((item) => item.opportunityId === opportunity.id) ? items : [project, ...items]);
    setEditing(false); setSelected(""); setContext(emptyContext()); setNotice("Delivery tracker created as Not Started. Confirm the start conditions before recording an actual start date.");
  };
  return <section className="panel ops-form" aria-label="Sales to delivery handoff">
    <div><h2>Sales to delivery handoff</h2><p>{available.length} won {available.length === 1 ? "opportunity needs" : "opportunities need"} a delivery tracker. Review the agreed work and start conditions together.</p></div>
    {!editing && <button className="button button-secondary" disabled={!available.length} onClick={() => setEditing(true)}>Prepare delivery handoff</button>}
    {editing && <form onSubmit={submit}><label>Won opportunity<select required value={selected} onChange={(event) => { setSelected(event.target.value); setContext(emptyContext()); setNotice(""); }}><option value="">Choose a won opportunity</option>{available.map((item) => <option value={item.id} key={item.id}>{item.name} · {accounts.find((account) => account.id === item.accountId)?.name || "Account missing"}</option>)}</select></label>
      <p>The account, customer problem, desired outcome, and opportunity remain linked. Enter only agreed scope below; keep future ideas in the expansion field.</p>
      <ContextFields value={context} change={(key, value) => setContext((current) => ({ ...current, [key]: value }))}/>
      <div className="form-actions"><button type="button" className="button button-ghost" onClick={() => setEditing(false)}>Cancel</button><button className="button button-primary">Create delivery tracker</button></div>
    </form>}
    {notice && <p role="status">{notice}</p>}
  </section>;
}

export function DeliveryContextDetails({ project, setProjects }: { project: ProjectItem; setProjects: Setter }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DeliveryContext>(() => ({ ...emptyContext(), ...project.deliveryContext }));
  return <details className="delivery-context-details"><summary>Delivery context &amp; start conditions</summary>
    {editing ? <form className="ops-form" onSubmit={(event) => { event.preventDefault(); setProjects((items) => items.map((item) => item.id === project.id ? { ...item, deliveryContext: draft, updatedAt: new Date().toISOString() } : item)); setEditing(false); }}><ContextFields value={draft} change={(key, value) => setDraft((current) => ({ ...current, [key]: value }))}/><div className="form-actions"><button type="button" onClick={() => setEditing(false)}>Cancel</button><button className="button button-primary">Save delivery context</button></div></form> : <><dl>{Object.entries(DELIVERY_CONTEXT_LABELS).map(([key, label]) => <div key={key}><dt><b>{label}</b></dt><dd style={{ margin: "0 0 12px", whiteSpace: "pre-wrap" }}>{project.deliveryContext?.[key as keyof DeliveryContext] || "Not recorded"}</dd></div>)}</dl><p>Scope changes require a recorded customer decision. Keep the decision or approved document reference with the context.</p><button onClick={() => { setDraft({ ...emptyContext(), ...project.deliveryContext }); setEditing(true); }}>Edit delivery context</button></>}
  </details>;
}
