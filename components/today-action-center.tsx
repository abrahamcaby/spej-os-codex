"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight, CalendarClock, Check, CircleAlert, Clock3, ListChecks,
  MessageSquareWarning, ShieldAlert, UsersRound,
} from "lucide-react";
import type {
  AccountItem, ActivityItem, CampaignItem, ContactItem, ContentItem, OpportunityItem, PartnershipItem,
  ProjectItem, TaskItem,
} from "@/lib/types";
import { buildDirectorAttention, summarizeDirectorAttention, type AttentionTab } from "@/lib/director-dashboard";
import { getTeamViewProfile, ownerMatchesViewer, recordOwnerMatchesViewer, type TeamViewProfile } from "@/lib/team-views";
import { previewCanEditTask, previewCanViewTask } from "@/lib/task-access-preview";
import { taskVisibility } from "@/lib/tasks";
import { useLocalDay } from "@/lib/use-local-day";

function dueLabel(value: string) {
  if (!value) return "Needs a date";
  const today = new Date();
  const local = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (value === local) return "Today";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  const label = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(year, month - 1, day, 12));
  return value < local ? `Overdue · ${label}` : label;
}

export function TodayActionCenter({
  tasks,
  accounts,
  activities,
  contacts,
  opportunities,
  partnerships,
  projects,
  campaigns,
  content,
  viewer,
  goTo,
  completeTask,
  initialScope = "mine",
}: {
  tasks: TaskItem[];
  accounts: AccountItem[];
  activities: ActivityItem[];
  contacts: ContactItem[];
  opportunities: OpportunityItem[];
  partnerships: PartnershipItem[];
  projects: ProjectItem[];
  campaigns: CampaignItem[];
  content: ContentItem[];
  viewer: TeamViewProfile;
  goTo: (tab: AttentionTab, recordId?: string | number) => void;
  completeTask: (task: TaskItem) => void;
  initialScope?: "mine" | "shared";
}) {
  const [scope, setScope] = useState<"mine" | "shared">(initialScope);
  const [showAll, setShowAll] = useState(false);
  const today = useLocalDay();
  const items = useMemo(() => buildDirectorAttention({
    tasks, accounts, activities, contacts, opportunities, partnerships, projects, campaigns, content, now: new Date(`${today}T12:00:00`),
  }), [tasks, accounts, activities, contacts, opportunities, partnerships, projects, campaigns, content, today]);
  const taskForItem = (item: (typeof items)[number]) =>
    item.kind === "task" ? tasks.find((candidate) => candidate.id === item.recordId) : undefined;
  const accessibleItems = items.filter((item) => {
    const task = taskForItem(item);
    return task ? previewCanViewTask(task, viewer, projects) : ownerMatchesViewer(item.owner, viewer);
  });
  const scopedItems = accessibleItems.filter((item) => {
    const task = taskForItem(item);
    if (scope === "shared") return Boolean(task && taskVisibility(task) !== "Private");
    return task ? recordOwnerMatchesViewer(task, viewer) : ownerMatchesViewer(item.owner, viewer);
  });
  const summary = summarizeDirectorAttention(scopedItems);
  const visible = showAll ? scopedItems : scopedItems.slice(0, 12);
  const groups = visible.reduce<Array<{ key: string; label: string; items: typeof visible }>>((result, item) => {
    const task = taskForItem(item);
    const urgent = item.severity !== "normal";
    const key = urgent
      ? "due-now"
      : task && taskVisibility(task) === "Company"
        ? "company"
        : item.workspaceLabel === "Project Management" || item.tab === "projects" || item.tab === "delivery-work"
          ? "project-management"
          : "gtm";
    const label = key === "due-now" ? "Due now" : key === "company" ? "Company-wide" : key === "project-management" ? "Projects" : "Sales & marketing";
    const existing = result.find((group) => group.key === key);
    if (existing) existing.items.push(item);
    else result.push({ key, label, items: [item] });
    return result;
  }, []);

  return <section className="action-center reveal delay-1" aria-labelledby="action-center-title">
    <div className="action-center-head">
      <div>
        <p className="eyebrow">My work</p>
        <h2 id="action-center-title">What needs attention</h2>
        <p>{scope === "mine" ? `Work assigned to ${viewer.displayName}, including owned follow-ups across connected records.` : "Workspace-shared and company-wide tasks this preview profile can access."}</p>
      </div>
      <div className="action-scope" role="group" aria-label="Attention scope">
        <button className={scope === "mine" ? "active" : ""} onClick={() => { setScope("mine"); setShowAll(false); }}>My work</button>
        <button className={scope === "shared" ? "active" : ""} onClick={() => { setScope("shared"); setShowAll(false); }}><UsersRound size={13}/> Shared work</button>
      </div>
    </div>
    <div className="action-summary">
      <div className={summary.overdue ? "alert" : ""}><ShieldAlert/><span><b>{summary.overdue}</b><small>overdue</small></span></div>
      <div><CalendarClock/><span><b>{summary.dueToday}</b><small>due today</small></span></div>
      <div><ListChecks/><span><b>{summary.reviews}</b><small>needs review</small></span></div>
      <div><MessageSquareWarning/><span><b>{summary.blockedOrMissing}</b><small>blocked or needs setup</small></span></div>
    </div>
    {visible.length ? <div className="attention-groups">
      {groups.map((group) => <section className="attention-group" key={group.key} aria-label={`${group.label} work`}>
        <header><b>{group.label}</b><span>{group.items.length}</span></header>
        <div className="attention-list">
          {group.items.map((item) => {
            const task = taskForItem(item);
            const ownerLabel = task?.ownerProfileId
              ? getTeamViewProfile(task.ownerProfileId)?.displayName || item.owner
              : item.owner;
            return <article className={`attention-row severity-${item.severity}`} key={item.id}>
              <span className="attention-signal">{item.severity === "critical" ? <CircleAlert/> : <Clock3/>}</span>
              <div className="attention-copy">
                <span className="attention-tags"><b>{item.workspaceLabel === "Project Management" ? "Projects" : item.workspaceLabel === "GTM" ? "Sales & marketing" : item.workspaceLabel || (item.tab === "projects" || item.tab === "delivery-work" ? "Projects" : "Sales & marketing")}</b><em>{item.categoryLabel || item.label}</em>{item.visibilityLabel && <em>{item.visibilityLabel}</em>}<em>Owner · {ownerLabel}</em></span>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </div>
              <span className="attention-due">{dueLabel(item.due)}</span>
              {task && previewCanEditTask(task, viewer, projects) ? <button className="attention-complete" onClick={() => completeTask(task)} aria-label={`Complete ${task.title}`}><Check size={14}/></button> : <span className="attention-complete-placeholder"/>}
              <button className="attention-open" onClick={() => goTo(item.tab, item.recordId)} aria-label={`Open ${item.label}`}><ArrowRight size={15}/></button>
            </article>;
          })}
        </div>
      </section>)}
    </div> : <div className="action-empty"><Check size={22}/><div><b>No work in this view.</b><p>{scope === "mine" ? "Assigned tasks and owned follow-ups will appear here." : "Only tasks explicitly shared with a workspace or the company appear here."}</p></div></div>}
    {scopedItems.length > 12 && <button className="action-view-all" onClick={() => setShowAll(!showAll)}>{showAll ? "Show fewer" : `Show all ${scopedItems.length} ${scope === "mine" ? "assigned items" : "shared tasks"}`} <ArrowRight size={14}/></button>}
  </section>;
}
