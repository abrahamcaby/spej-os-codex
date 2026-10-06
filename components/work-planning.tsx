"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CalendarDays, Check, Clock3, Download, Plus, Sparkles, X } from "lucide-react";
import { createPlanningWorkspace, normalizePlanningWorkspace, saveOperatingPlan, setOperatingPlanStatus, type OperatingPlan, type PlanningWorkspace, type Routine } from "@/lib/operating-plans";
import { proposeWorkday, type WorkBlock } from "@/lib/work-planner";
import { buildPlanningCandidates, getTaskPlanningMinutes } from "@/lib/planning-candidates";
import { canCompletePlannedTask, validatePlanningWrite } from "@/lib/planning-updates";
import { CompanyCalendar } from "@/components/company-calendar";
import { buildCalendarEntries, type CalendarDeadline } from "@/lib/company-calendar";
import type { TaskItem } from "@/lib/types";
import styles from "./work-planning.module.css";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PRIORITIES = ["urgent", "high", "normal", "low"] as const;
const EMPTY_BLOCKS: WorkBlock[] = [];
const EMPTY_DEADLINES: CalendarDeadline[] = [];
const EMPTY_PARENT_IDS: string[] = [];
type Draft = { id?: string; title: string; outcome: string; routines: Routine[] };
function localDate() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function minutesLabel(n: number) { return n >= 60 ? `${Math.floor(n / 60)}h${n % 60 ? ` ${n % 60}m` : ""}` : `${n}m`; }
function taskMinutes(task: TaskItem, state: PlanningWorkspace) { return getTaskPlanningMinutes(task, state.estimates); }
function Weekdays({ value, change, label }: { value: number[]; change: (v: number[]) => void; label: string }) {
  return <fieldset className={styles.weekdays}><legend>{label}</legend>{DAYS.map((day, index) => <label key={day}><input type="checkbox" checked={value.includes(index)} onChange={() => change(value.includes(index) ? value.filter((n) => n !== index) : [...value, index].sort())}/><span>{day}</span></label>)}</fieldset>;
}

/** Local review surface only. The parent supplies only viewable, owned tasks.
 * Personal preferences never grant access or create company-wide policy. */
export function WorkPlanning({ ownerId, displayName, tasks, openTask, completeTask, askSosa, compact = false, deadlines = EMPTY_DEADLINES, openRecord, openCalendar, parentIdsWithOpenWork = EMPTY_PARENT_IDS }: {
  ownerId: string; displayName: string; tasks: TaskItem[]; openTask: (task: TaskItem) => void;
  completeTask: (task: TaskItem) => void; askSosa: (context: string) => void;
  compact?: boolean; deadlines?: CalendarDeadline[];
  parentIdsWithOpenWork?: string[];
  openRecord?: (route: string, recordId: string | number) => void; openCalendar?: () => void;
}) {
  const [workspace, setWorkspace] = useState(createPlanningWorkspace);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"calendar" | "day" | "plans" | "availability">(compact ? "day" : "calendar");
  const [connections, setConnections] = useState(false);
  const [date, setDate] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [proposal, setProposal] = useState<{ signature: string; blocks: WorkBlock[] } | null>(null);
  const [blockForm, setBlockForm] = useState(false);
  const stored = useRef<string | null>(null);
  const key = `spej-os-next:planning:v1:${encodeURIComponent(ownerId)}`;

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const raw = localStorage.getItem(key);
        stored.current = raw;
        const parsed = raw ? JSON.parse(raw) : null;
        if (raw && parsed?.version !== 1) throw new Error("Saved planning data has an unsupported format. It has not been overwritten.");
        setWorkspace(raw ? normalizePlanningWorkspace(parsed, ownerId) : createPlanningWorkspace());
        setDate(localDate());
        setReady(true);
      } catch (e) { setError(e instanceof Error ? e.message : "Planning storage is unavailable. No saved work was changed."); }
    });
    return () => { cancelled = true; };
  }, [key, ownerId]);

  function commit(next: PlanningWorkspace, message: string) {
    if (!ready) return false;
    try {
      const validated = validatePlanningWrite(next);
      if (localStorage.getItem(key) !== stored.current) throw new Error("This plan changed in another window. Refresh before editing so neither version is overwritten.");
      const raw = JSON.stringify(validated);
      localStorage.setItem(key, raw);
      stored.current = raw;
      setWorkspace(validated);
      setError(""); setNotice(message); setProposal(null);
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save. Your previous plan is unchanged."); return false; }
  }
  const blocks = workspace.days[date] || EMPTY_BLOCKS;
  const today = localDate();
  const calendarEntries = useMemo(() => buildCalendarEntries(workspace.days, deadlines, today), [workspace.days, deadlines, today]);
  const activePlans = workspace.plans.filter((plan) => plan.status === "active");
  const parentIds = useMemo(() => new Set(parentIdsWithOpenWork), [parentIdsWithOpenWork]);
  const candidates = useMemo(() => buildPlanningCandidates(tasks, workspace.plans, date, today, workspace.estimates).filter((candidate) => candidate.source !== "task" || !parentIds.has(candidate.sourceId)), [tasks, workspace.plans, date, today, workspace.estimates, parentIds]);
  const unscheduledCandidates = useMemo(() => candidates.filter((candidate) => !blocks.some((block) => block.source === candidate.source && block.sourceId === candidate.sourceId)), [candidates, blocks]);
  const result = useMemo(() => proposeWorkday(date, workspace.preferences, blocks, unscheduledCandidates), [date, workspace.preferences, blocks, unscheduledCandidates]);
  const signature = JSON.stringify([date, workspace.preferences, blocks, candidates]);
  const proposalCurrent = proposal?.signature === signature;

  function savePlan(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    try {
      const next = saveOperatingPlan(workspace, draft, ownerId, new Date().toISOString(), crypto.randomUUID());
      if (commit(next, draft.id ? "New revision saved. Previously accepted time blocks are unchanged." : "Plan saved as a draft. Activate it when you are ready.")) setDraft(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Check your plan fields."); }
  }
  function status(plan: OperatingPlan, value: OperatingPlan["status"]) {
    try { commit(setOperatingPlanStatus(workspace, plan.id, value, ownerId, new Date().toISOString()), value === "active" ? "Plan active. Its routines are now available to the planner." : "Plan paused or archived. Existing time blocks remain until you remove them."); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not change plan status."); }
  }
  function addBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") || "").trim(), start = String(data.get("start")), end = String(data.get("end"));
    if (!title || start >= end || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end)) { setError("Give the time block a title and an end time after its start."); return; }
    if (blocks.some((block) => start < block.end && end > block.start)) { setError("That time overlaps an accepted block. Remove or change the existing block first."); return; }
    if (commit({ ...workspace, days: { ...workspace.days, [date]: [...blocks, { id: crypto.randomUUID(), title, start, end, source: "manual" }] } }, "Time reserved locally. No Outlook meeting was created.")) setBlockForm(false);
  }
  function exportBackup() {
    const blob = new Blob([JSON.stringify(workspace, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = `spej-planning-${ownerId}.json`; link.click(); URL.revokeObjectURL(url);
  }
  function discuss() {
    askSosa(`Help me review my work plan. Do not change calendars or send messages. These are local planning preferences, not company policy.\nSelected day: ${date}. Work window: ${workspace.preferences.start}-${workspace.preferences.end}, reserve ${workspace.preferences.reserveMinutes} minutes.\nActive plans: ${activePlans.map((plan) => `${plan.title} (revision ${plan.revision}): ${plan.outcome}`).join("; ") || "None yet"}.\nAccepted blocks: ${blocks.map((block) => `${block.start}-${block.end} ${block.title}`).join("; ") || "None"}.\nAvailable minutes after commitments/reserve: ${result.availableMinutes}.\nProposed work: ${result.suggested.map((block) => `${block.start}-${block.end} ${block.title}`).join("; ") || "None fits"}.\nNot scheduled: ${result.unscheduled.map((entry) => `${entry.candidate.title}: ${entry.reason}`).join("; ") || "None"}.\nExplain the tradeoffs and ask only for missing decisions. Current task records remain authoritative; this planning snapshot is context only.`);
  }

  return <section className={`${styles.shell} ${compact ? styles.compact : ""}`} aria-label={compact ? "Optional daily time-blocking" : "Calendar and planning"}>
    {!compact && <><header className={styles.header}><div><p className="eyebrow">Calendar · {displayName}</p><h1>Your schedule, in one place.</h1><p>Planned time and assigned deadlines from across Spej OS.</p></div></header>
    <div className={styles.tabs} role="group" aria-label="Calendar and planning views">{([['calendar', 'Calendar'], ['day', 'Work schedule']] as const).map(([value, label]) => <button aria-pressed={tab === value} className={tab === value ? styles.selected : ""} key={value} onClick={() => { setTab(value); }}>{label}</button>)}<details className={styles.settingsMenu}><summary>Planning settings</summary><div><button onClick={() => setTab("availability")}>Working hours</button><button onClick={() => setTab("plans")}>Goals & recurring work</button></div></details></div></>}
    {compact ? <p className={styles.boundary}>Optional: turn your existing tasks into time blocks. You review the suggestion first. <button onClick={openCalendar}>Open Calendar & working hours</button></p> : <p className={styles.boundary}>Local time blocks are saved for {displayName} in this browser. Demo profiles are not secure accounts. Microsoft calendars are not connected.</p>}
    {connections && <section className={styles.connectionDetails} aria-label="Microsoft calendar connection details"><div className={styles.toolbar}><h3>Outlook & Teams · not connected</h3><button onClick={() => setConnections(false)} aria-label="Close connection details"><X size={15}/></button></div><p>This preview does not read Outlook calendars, reserve time in Microsoft 365, or send Teams invitations. Its blocks are local to this browser.</p><p>The live connection needs your company’s Microsoft sign-in and calendar permissions, selection of personal and shared calendars, and an engineering-managed sync service. Connected events should retain their source, show last successful sync and errors, and require approval before invitations or changes.</p><p>Spej OS deadlines will stay linked to their source records. They are not automatically meetings or busy time.</p></section>}
    {error && <p className={styles.error} role="alert">{error}</p>}{notice && <p className={styles.notice} role="status">{notice}</p>}
    {!ready ? <p>Planning is loading. If storage is unavailable, refresh after enabling browser storage.</p> : <>
      {tab === "calendar" && <CompanyCalendar entries={calendarEntries} date={date} onDateChange={(value) => { setDate(value); setProposal(null); }} onPlanDay={() => setTab("day")} onOpenRecord={(route, id) => openRecord?.(route, id)} onConnections={() => setConnections(!connections)}/>}
      {tab === "day" && <>
        <div className={styles.toolbar}><label className={styles.date}><CalendarDays size={17}/>Planning date<input aria-label="Planning date" type="date" value={date} onChange={(e) => { if (e.target.value) { setDate(e.target.value); setProposal(null); } }}/></label><div className={styles.actions}><button onClick={() => setBlockForm(!blockForm)}><Plus size={15}/> Reserve time</button><button onClick={discuss}><Sparkles size={15}/> Discuss with SOSA</button><button className={styles.primary} onClick={() => { setProposal({ signature, blocks: result.suggested }); setNotice("Review the suggested blocks below. Nothing has been added yet."); }}>Suggest my day</button></div></div>
        <details><summary>How the suggestion is calculated</summary><p className={styles.muted}>It uses your task priorities, due dates, effort estimates, working hours, and reserved time. It suggests time blocks, not a new task list.</p><div className={styles.stats}><div><small>Available after commitments & reserve</small><strong>{minutesLabel(result.availableMinutes)}</strong></div><div><small>Work that fits</small><strong>{minutesLabel(result.scheduledMinutes)}</strong></div><div><small>Protected buffer / breaks</small><strong>{minutesLabel(result.reservedMinutes)}</strong></div><div><small>Needs a decision</small><strong>{result.unscheduled.length}</strong></div></div></details>
        <p className={styles.muted}>Suggestions use the full work window, including earlier time today. Reserve elapsed or unavailable time before accepting.</p>
        {result.warnings.map((warning) => <p className={styles.warning} key={warning}>{warning}</p>)}
        {blockForm && <form className={styles.inlineForm} onSubmit={addBlock}><label>Block title<input name="title" maxLength={200} placeholder="Meeting, lunch, focus time…" required/></label><label>Starts<input name="start" aria-label="Block starts" type="time" required defaultValue="12:00"/></label><label>Ends<input name="end" aria-label="Block ends" type="time" required defaultValue="12:30"/></label><button type="submit" className={styles.primary}>Reserve locally</button><button type="button" onClick={() => setBlockForm(false)}>Cancel</button></form>}
        <div className={styles.dayGrid}><div><h3>Accepted schedule <span>{blocks.length}</span></h3>{blocks.length ? <ol className={styles.timeline}>{[...blocks].sort((a, b) => a.start.localeCompare(b.start)).map((block) => {
          const task = block.source === "task" ? tasks.find((item) => String(item.id) === block.sourceId) : undefined;
          const canComplete = task && !parentIds.has(String(task.id)) && canCompletePlannedTask(task, tasks);
          return <li key={block.id}><span className={styles.time}>{block.start}<small>{block.end}</small></span><div><strong>{block.title}</strong><small>{task?.done ? "Task completed" : block.source === "manual" ? "Reserved time" : block.source === "routine" ? "Accepted plan routine" : "Linked work · open to manage"}</small></div>{task && <button aria-label={`Open ${block.title}`} onClick={() => openTask(task)}>Open</button>}{canComplete && <button aria-label={`Complete ${block.title}`} onClick={() => completeTask(task)}><Check size={15}/></button>}<button aria-label={`Remove time block ${block.title}`} onClick={() => commit({ ...workspace, days: { ...workspace.days, [date]: blocks.filter((item) => item.id !== block.id) } }, "Time block removed. The underlying task or plan is unchanged.")}><X size={14}/></button></li>;
        })}</ol> : <div className={styles.empty}><Clock3 size={24}/><h4>Your day is open to plan.</h4><p>Reserve existing commitments, set your availability, then review a suggestion based on your work and active plans.</p></div>}
          {proposal && <div className={styles.proposal}><h3>Suggested blocks</h3><p>Rules-based planning: priority, due dates, and available time. No AI connection needed.</p>{!proposalCurrent ? <p className={styles.warning}>Your work or settings changed. Generate a fresh suggestion before accepting.</p> : <>{proposal.blocks.map((block) => <div className={styles.suggestion} key={block.id}><b>{block.start}–{block.end}</b><span>{block.title}</span></div>)}{!proposal.blocks.length && <p>No additional work fits. Check availability, existing blocks, or the decision list.</p>}<button disabled={!proposal.blocks.length} className={styles.primary} onClick={() => { if (proposal.signature === signature) commit({ ...workspace, days: { ...workspace.days, [date]: [...blocks, ...proposal.blocks] } }, "Schedule accepted locally. Tasks were not duplicated and no external calendar was changed."); }}>Accept {proposal.blocks.length} local blocks</button></>}</div>}
        </div><aside><details><summary>Unscheduled work ({result.unscheduled.length})</summary>{result.unscheduled.length ? result.unscheduled.map(({ candidate, reason }) => <article className={styles.decision} key={candidate.id}><strong>{candidate.title}</strong><p>{reason}</p><small>{minutesLabel(candidate.minutes)} · {candidate.source === "routine" ? "Plan routine" : "Assigned task"}</small></article>) : <p className={styles.muted}>All eligible work fits.</p>}</details><details className={styles.estimates}><summary>Adjust task durations</summary><p>Each task starts with a 25-minute placeholder unless you adjust it. These are planning estimates, not measured effort; original tasks are unchanged.</p>{tasks.filter((task) => !task.done).map((task) => <label key={task.id}><span>{task.title}</span><input aria-label={`Minutes for ${task.title}`} type="number" min={1} max={480} value={taskMinutes(task, workspace)} onChange={(e) => { const value = Number(e.target.value); if (Number.isInteger(value) && value >= 1 && value <= 480) commit({ ...workspace, estimates: { ...workspace.estimates, [String(task.id)]: value } }, "Estimate updated."); }}/><small>min</small></label>)}</details></aside></div>
      </>}
      {tab === "plans" && <>
        <div className={styles.toolbar}><div><h3>Optional goals & recurring work</h3><p className={styles.muted}>A goal groups repeat responsibilities, such as a weekly project review. You can schedule your tasks without creating a goal here.</p></div><button className={styles.primary} onClick={() => { setDraft({ title: "", outcome: "", routines: [] }); setError(""); }}><Plus size={15}/> Add goal</button></div>
        {draft && <form className={styles.editor} onSubmit={savePlan}><h3>{draft.id ? "Edit plan · save a new revision" : "Create a plan"}</h3><div className={styles.twoColumns}><label>Plan name<input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={200} placeholder="e.g. Improve release reliability" required/></label><label>Desired outcome<textarea value={draft.outcome} onChange={(e) => setDraft({ ...draft, outcome: e.target.value })} maxLength={4000} placeholder="What should be different when this plan works?" required/></label></div><h4>Optional recurring work</h4><p>Choose days and effort. These are suggestions for your schedule, not automatically created tasks or mandatory company policy.</p>{draft.routines.map((routine, i) => <div className={styles.routine} key={routine.id}><div className={styles.routineFields}><label>Routine name<input aria-label={`Routine ${i + 1} name`} required maxLength={200} value={routine.title} onChange={(e) => setDraft({ ...draft, routines: draft.routines.map((r) => r.id === routine.id ? { ...r, title: e.target.value } : r) })}/></label><label>Minutes<input aria-label={`Routine ${i + 1} minutes`} type="number" min={1} max={480} required value={routine.minutes} onChange={(e) => setDraft({ ...draft, routines: draft.routines.map((r) => r.id === routine.id ? { ...r, minutes: Number(e.target.value) } : r) })}/></label><label>Priority<select aria-label={`Routine ${i + 1} priority`} value={routine.priority} onChange={(e) => setDraft({ ...draft, routines: draft.routines.map((r) => r.id === routine.id ? { ...r, priority: e.target.value as Routine["priority"] } : r) })}>{PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}</select></label><button type="button" aria-label={`Remove routine ${i + 1}`} onClick={() => setDraft({ ...draft, routines: draft.routines.filter((r) => r.id !== routine.id) })}><X size={15}/></button></div><Weekdays label={`Days for routine ${i + 1}`} value={routine.weekdays} change={(weekdays) => setDraft({ ...draft, routines: draft.routines.map((r) => r.id === routine.id ? { ...r, weekdays } : r) })}/></div>)}<div className={styles.actions}><button type="button" disabled={draft.routines.length >= 50} onClick={() => setDraft({ ...draft, routines: [...draft.routines, { id: crypto.randomUUID(), title: "", minutes: 30, weekdays: [...workspace.preferences.weekdays], priority: "normal" }] })}><Plus size={15}/> Add routine</button><button type="submit" className={styles.primary}>{draft.id ? "Save new revision" : "Save draft"}</button><button type="button" onClick={() => setDraft(null)}>Cancel</button></div></form>}
        {!workspace.plans.length && !draft && <div className={styles.empty}><h4>No playbook forced on you.</h4><p>Create a plan when you need one. Your assigned work can be scheduled without a plan.</p></div>}
        <div className={styles.planGrid}>{workspace.plans.map((plan) => <article className={styles.planCard} key={plan.id}><div className={styles.planMeta}><span>{plan.status}</span><small>Revision {plan.revision}</small></div><h3>{plan.title}</h3><p>{plan.outcome}</p><small>{plan.routines.length} routines · {plan.routines.reduce((sum, routine) => sum + routine.minutes * routine.weekdays.length, 0)} planned minutes / week</small><div className={styles.actions}><button onClick={() => { setDraft({ id: plan.id, title: plan.title, outcome: plan.outcome, routines: structuredClone(plan.routines) }); setError(""); }}>Edit</button>{plan.status !== "active" ? <button onClick={() => status(plan, "active")}>Activate</button> : <button onClick={() => status(plan, "draft")}>Pause</button>}{plan.status !== "archived" && <button onClick={() => status(plan, "archived")}>Archive</button>}</div>{plan.history.length > 0 && <details><summary>Previous revisions ({plan.history.length})</summary>{[...plan.history].reverse().map((revision) => <div className={styles.history} key={revision.revision}><b>Revision {revision.revision} · {revision.title}</b><p>{revision.outcome}</p><small>{revision.routines.map((routine) => `${routine.title} (${routine.minutes}m)`).join(" · ") || "No routines"}</small></div>)}</details>}</article>)}</div>
      </>}
      {tab === "availability" && <form className={styles.editor} key={JSON.stringify(workspace.preferences)} onSubmit={(event) => {
        event.preventDefault(); const data = new FormData(event.currentTarget);
        const start = String(data.get("start")), end = String(data.get("end")), reserveMinutes = Number(data.get("reserve"));
        const weekdays = data.getAll("weekday").map(Number);
        const windowMinutes = Number(end.slice(0, 2)) * 60 + Number(end.slice(3)) - Number(start.slice(0, 2)) * 60 - Number(start.slice(3));
        if (!start || !end || start >= end || !weekdays.length || !Number.isInteger(reserveMinutes) || reserveMinutes < 0 || reserveMinutes > Math.min(480, windowMinutes)) { setError("Choose a valid working window, at least one day, and a reserve no longer than that window (maximum 480 minutes)."); return; }
        commit({ ...workspace, preferences: { start, end, reserveMinutes, weekdays } }, "Availability saved. Existing blocks stay where you put them.");
      }}><h3>Your available time—not a company quota</h3><p>Defaults are examples. Set your own hours and allow for breaks and interruptions. Times use this device’s local day; live timezone-aware calendar synchronization is not connected.</p><div className={styles.threeColumns}><label>Work starts<input name="start" aria-label="Work starts" type="time" defaultValue={workspace.preferences.start} required/></label><label>Work ends<input name="end" aria-label="Work ends" type="time" defaultValue={workspace.preferences.end} required/></label><label>Unscheduled reserve (minutes)<input name="reserve" type="number" min={0} max={480} defaultValue={workspace.preferences.reserveMinutes} required/></label></div><fieldset className={styles.weekdays}><legend>Working days</legend>{DAYS.map((day, index) => <label key={day}><input name="weekday" value={index} type="checkbox" defaultChecked={workspace.preferences.weekdays.includes(index)}/><span>{day}</span></label>)}</fieldset><p>If you reserve lunch as an explicit time block, reduce the unscheduled reserve if needed to avoid budgeting the same break twice.</p><div className={styles.actions}><button className={styles.primary} type="submit">Save availability</button><button type="button" onClick={exportBackup}><Download size={15}/> Download planning backup</button></div></form>}
    </>}
  </section>;
}
