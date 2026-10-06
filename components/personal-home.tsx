"use client";

import type { FormEvent } from "react";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Clapperboard,
  FolderKanban,
  ListTodo,
  Network,
  Send,
  Sparkles,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type {
  AccountItem,
  CampaignItem,
  ContactItem,
  ContentItem,
  OpportunityItem,
  PartnershipItem,
  ProjectItem,
  TaskItem,
} from "@/lib/types";
import { taskWorkspaceId } from "@/lib/tasks";
import {
  getRoleHomeModules,
  ownerMatchesViewer,
  recordOwnerMatchesViewer,
  type TeamHomeModule,
  type TeamViewerReference,
} from "@/lib/team-views";

export type HomeSosaBarProps = {
  viewerName: string;
  command: string;
  setCommand: (value: string) => void;
  openSosa: () => void;
};

export type RoleHomeViewer = {
  profileId?: string;
  displayName: string;
  focus: string[];
  homeLabel: string;
};

export type PersonalHomeTab =
  | "agent"
  | "today"
  | "relationships"
  | "gtm"
  | "pipeline"
  | "content"
  | "campaigns"
  | "tasks"
  | "metrics"
  | "intelligence"
  | "delivery"
  | "projects"
  | "delivery-work";

export type RoleHomeSummaryProps = {
  selectedModules?: readonly TeamHomeModule[];
  scope?: "mine" | "visible-workspace";
  canViewTab?: (route: string) => boolean;
  viewer: RoleHomeViewer;
  accounts: AccountItem[];
  contacts: ContactItem[];
  opportunities: OpportunityItem[];
  partnerships: PartnershipItem[];
  projects: ProjectItem[];
  campaigns: CampaignItem[];
  content: ContentItem[];
  tasks: TaskItem[];
  goTo: (tab: PersonalHomeTab, recordId?: string | number) => void;
};

type PulseMetric = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tab: PersonalHomeTab;
  alert?: boolean;
};

type QuickLink = {
  label: string;
  tab: PersonalHomeTab;
  icon: LucideIcon;
};

type RoleModuleView = {
  id: TeamHomeModule["id"] | "general";
  label: string;
  description: string;
  route: PersonalHomeTab;
  metrics: PulseMetric[];
  links: QuickLink[];
};

function compactCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}


export function HomeSosaBar({ viewerName, command, setCommand, openSosa }: HomeSosaBarProps) {
  const firstName = viewerName.trim().split(/\s+/)[0] || "there";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    openSosa();
  }

  return (
    <section className="home-sosa-bar panel" aria-labelledby="home-sosa-title">
      <span className="home-sosa-mark" aria-hidden="true"><Sparkles size={18} /></span>
      <div className="home-sosa-copy">
        <p className="eyebrow">SOSA</p>
        <h2 id="home-sosa-title">What can I help with, {firstName}?</h2>
        <p id="home-sosa-description">
          SOSA can prepare updates and carry out approved actions across Spej OS. Nothing changes from this box; you review the work in the SOSA workspace first.
        </p>
      </div>
      <form className="home-sosa-form" onSubmit={submit}>
        <label className="home-sosa-input-wrap">
          <span className="home-sosa-visually-hidden">Message SOSA</span>
          <input
            aria-describedby="home-sosa-description"
            onChange={(event) => setCommand(event.target.value)}
            placeholder="Prepare a client update, add follow-ups, or review today’s work…"
            value={command}
          />
        </label>
        <button className="button button-primary" type="submit">
          {command.trim() ? "Review in SOSA" : "Open SOSA"}
          <Send size={14} aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}

export function RoleHomeSummary({
  selectedModules,
  scope = "mine",
  canViewTab = () => true,
  viewer,
  accounts,
  contacts,
  opportunities,
  partnerships,
  projects,
  campaigns,
  content,
  tasks,
  goTo,
}: RoleHomeSummaryProps) {
  const viewerReference: TeamViewerReference = viewer.profileId
    ? { profileId: viewer.profileId, displayName: viewer.displayName }
    : { displayName: viewer.displayName };
  const isMine = (record: { owner?: unknown; ownerProfileId?: unknown }) =>
    scope === "visible-workspace" || recordOwnerMatchesViewer(record, viewerReference);
  const openOpportunities = opportunities.filter((item) => !item.archivedAt && !item.stage.startsWith("Closed") && isMine(item));
  const trackedProjects = projects.filter((item) => !item.archivedAt && !["Complete", "Stopped"].includes(item.operationalStatus) && isMine(item));
  const activeProjects = trackedProjects.filter((item) => ["Mobilizing", "Active", "At Gate"].includes(item.operationalStatus));
  const openTasks = tasks.filter((item) => !item.done && isMine(item));
  const activeContent = content.filter((item) => !["Idea", "Published"].includes(item.stage));
  const activeCampaigns = campaigns.filter((item) => !item.archivedAt && ["Planning", "Active"].includes(item.status));
  const activePartnerships = partnerships.filter((item) => !item.archivedAt && item.stage !== "Paused / Ended");

  const myAccounts = accounts.filter((item) => !item.archivedAt && isMine(item));
  const myAccountIds = new Set(myAccounts.map((item) => item.id));
  const myOpportunities = openOpportunities.filter(isMine);
  const myProjects = activeProjects.filter(isMine);
  const myTrackedProjects = trackedProjects.filter(isMine);
  const myTasks = openTasks.filter(isMine);
  const myGtmTasks = myTasks.filter((item) => taskWorkspaceId(item, projects) === "gtm");
  const myProjectTasks = myTasks.filter((item) => taskWorkspaceId(item, projects) === "project-management");
  const myContentTasks = myTasks.filter((item) => item.relatedType === "content" || item.category === "Content");
  const myContent = activeContent.filter(isMine);
  const myCampaigns = activeCampaigns.filter(isMine);
  const myPartnerships = activePartnerships.filter(isMine);
  const myReviewActions = content.filter((item) =>
    (item.reviewStatus === "Pending Review" && (scope === "visible-workspace" || ownerMatchesViewer(item.approver, viewerReference)))
    || (item.reviewStatus === "Changes Requested" && isMine(item)),
  );
  const contactFollowUps = contacts.filter((item) =>
    !item.archivedAt && myAccountIds.has(item.accountId) && Boolean(item.nextAction?.trim()),
  ).length;
  const accountCheckIns = accounts.filter((item) => {
    if (item.archivedAt || !item.nextCheckIn) return false;
    return scope === "visible-workspace" || ownerMatchesViewer(item.checkInOwner || item.owner, viewerReference);
  }).length;

  const companyPipeline = openOpportunities.reduce((sum, item) => sum + item.value, 0);
  const myPipeline = myOpportunities.reduce((sum, item) => sum + item.value, 0);
  const atRiskProjects = activeProjects.filter((item) => item.health === "At Risk");
  const myAtRiskProjects = myTrackedProjects.filter((item) => item.health === "At Risk");
  const blockedTasks = openTasks.filter((item) => item.status === "Blocked");
  const unassignedTasks = openTasks.filter((item) =>
    !item.ownerProfileId?.trim() && (!item.owner?.trim() || item.owner.trim().toLocaleLowerCase() === "unassigned"),
  );
  const taskExceptions = openTasks.filter((item) => item.status === "Blocked" || unassignedTasks.includes(item));
  const pendingTeamReviews = myReviewActions.filter((item) => item.reviewStatus === "Pending Review");
  const relationshipFollowUps = contactFollowUps + accountCheckIns;

  function roleModuleView(module: TeamHomeModule): RoleModuleView {
    if (module.id === "leadership") {
      return {
        ...module,
        route: module.route as PersonalHomeTab,
        metrics: [
          { label: "Open pipeline", value: compactCurrency(companyPipeline), detail: `${openOpportunities.length} open opportunities`, icon: BriefcaseBusiness, tab: "pipeline" },
          { label: "Active projects", value: String(activeProjects.length), detail: `${atRiskProjects.length} need attention`, icon: FolderKanban, tab: "projects", alert: atRiskProjects.length > 0 },
          { label: "Work exceptions", value: String(taskExceptions.length), detail: `${blockedTasks.length} blocked · ${unassignedTasks.length} unassigned`, icon: TriangleAlert, tab: "today", alert: taskExceptions.length > 0 },
          { label: "Reviews waiting", value: String(pendingTeamReviews.length), detail: "Content awaiting team review", icon: Clapperboard, tab: "content" },
        ],
        links: [
          { label: "Pipeline", tab: "pipeline", icon: BriefcaseBusiness },
          { label: "Projects", tab: "projects", icon: FolderKanban },
          { label: "Performance", tab: "metrics", icon: BarChart3 },
        ],
      };
    }
    if (module.id === "gtm") {
      return {
        ...module,
        route: module.route as PersonalHomeTab,
        metrics: [
          { label: "My opportunities", value: String(myOpportunities.length), detail: `${compactCurrency(myPipeline)} recorded open value`, icon: BriefcaseBusiness, tab: "pipeline" },
          { label: "Follow-ups", value: String(relationshipFollowUps), detail: `${myAccounts.length} accounts · ${myPartnerships.length} active partnerships`, icon: Network, tab: "relationships" },
          { label: "Sales & marketing work", value: String(myGtmTasks.length), detail: `${myGtmTasks.filter((item) => item.status === "Blocked").length} blocked`, icon: ListTodo, tab: "tasks", alert: myGtmTasks.some((item) => item.status === "Blocked") },
          { label: "Campaigns & content", value: String(myCampaigns.length + myContent.length), detail: `${myCampaigns.length} campaigns · ${myReviewActions.length} review actions`, icon: Clapperboard, tab: "content" },
        ],
        links: [
          { label: "Sales & marketing", tab: "gtm", icon: BarChart3 },
          { label: "CRM", tab: "relationships", icon: Network },
          { label: "Content", tab: "content", icon: Clapperboard },
        ],
      };
    }
    if (module.id === "projects") {
      const workInReview = myProjectTasks.filter((item) => item.status === "In Review").length;
      return {
        ...module,
        route: module.route as PersonalHomeTab,
        metrics: [
          { label: "My active projects", value: String(myProjects.length), detail: `${myAtRiskProjects.length} need attention`, icon: FolderKanban, tab: "projects", alert: myAtRiskProjects.length > 0 },
          { label: "My project work", value: String(myProjectTasks.length), detail: `${workInReview} awaiting review`, icon: ListTodo, tab: "delivery-work" },
          { label: "Projects needing attention", value: String(myAtRiskProjects.length), detail: "Within your active projects", icon: TriangleAlert, tab: "projects", alert: myAtRiskProjects.length > 0 },
          { label: "Work awaiting review", value: String(workInReview), detail: "Assigned project work", icon: Sparkles, tab: "delivery-work" },
        ],
        links: [
          { label: "Projects", tab: "delivery", icon: FolderKanban },
          { label: "Project work", tab: "delivery-work", icon: ListTodo },
          { label: "Ask SOSA", tab: "agent", icon: Sparkles },
        ],
      };
    }
    if (module.id === "content-qa") {
      const changesRequested = content.filter((item) => item.reviewStatus === "Changes Requested" && isMine(item)).length;
      return {
        ...module,
        route: module.route as PersonalHomeTab,
        metrics: [
          { label: "Content in progress", value: String(myContent.length), detail: "Owned by you", icon: Clapperboard, tab: "content" },
          { label: "Reviews waiting", value: String(myReviewActions.length), detail: `${changesRequested} with changes requested`, icon: Sparkles, tab: "content", alert: changesRequested > 0 },
          { label: "Content work", value: String(myContentTasks.length), detail: `${myContentTasks.filter((item) => item.status === "Blocked").length} blocked`, icon: ListTodo, tab: "tasks", alert: myContentTasks.some((item) => item.status === "Blocked") },
          { label: "Active campaigns", value: String(myCampaigns.length), detail: "Owned by you", icon: BarChart3, tab: "campaigns" },
        ],
        links: [
          { label: "Content", tab: "content", icon: Clapperboard },
          { label: "Campaigns", tab: "campaigns", icon: BarChart3 },
          { label: "My work", tab: "today", icon: ListTodo },
        ],
      };
    }

    const technicalReview = myProjectTasks.filter((item) => item.status === "In Review").length;
    const blockedTechnical = myProjectTasks.filter((item) => item.status === "Blocked").length;
    const technicalInProgress = myProjectTasks.filter((item) => item.status === "In Progress").length;
    return {
      ...module,
      route: module.route as PersonalHomeTab,
      metrics: [
        { label: "Technical work", value: String(myProjectTasks.length), detail: "Assigned project and delivery work", icon: ListTodo, tab: "delivery-work" },
        { label: "Work in progress", value: String(technicalInProgress), detail: "Technical work currently underway", icon: FolderKanban, tab: "delivery-work" },
        { label: "Blocked work", value: String(blockedTechnical), detail: "Assigned to you", icon: TriangleAlert, tab: "delivery-work", alert: blockedTechnical > 0 },
        { label: "Work awaiting review", value: String(technicalReview), detail: "Technical work in review", icon: Sparkles, tab: "delivery-work" },
      ],
      links: [
        { label: "Technical work", tab: "delivery-work", icon: ListTodo },
        { label: "Projects", tab: "projects", icon: FolderKanban },
        { label: "Ask SOSA", tab: "agent", icon: Sparkles },
      ],
    };
  }

  const configuredModules = (selectedModules || getRoleHomeModules(viewerReference)).filter((module) => canViewTab(module.route)).map(roleModuleView);
  const modules: RoleModuleView[] = configuredModules.length ? configuredModules : [{
    id: "general",
    label: "Work overview",
    description: viewer.homeLabel,
    route: "today",
    metrics: [
      { label: "My open work", value: String(myTasks.length), detail: `${myTasks.filter((item) => item.status === "Blocked").length} blocked`, icon: ListTodo, tab: "today", alert: myTasks.some((item) => item.status === "Blocked") },
      { label: "My opportunities", value: String(myOpportunities.length), detail: `${compactCurrency(myPipeline)} recorded open value`, icon: BriefcaseBusiness, tab: "pipeline" },
      { label: "My active projects", value: String(myProjects.length), detail: `${myAtRiskProjects.length} need attention`, icon: FolderKanban, tab: "projects", alert: myAtRiskProjects.length > 0 },
      { label: "Content in progress", value: String(myContent.length), detail: "Owned by you", icon: Clapperboard, tab: "content" },
    ],
    links: [
      { label: "CRM", tab: "relationships", icon: Network },
      { label: "Projects", tab: "projects", icon: FolderKanban },
      { label: "Ask SOSA", tab: "agent", icon: Sparkles },
    ],
  }];

  return (
    <div className={`personal-home-modules personal-home-modules-${modules.length}`} aria-label={`Work views for ${viewer.displayName}`}>
      {(selectedModules ? configuredModules : modules).map((module) => (
        <section className={`personal-home-summary personal-home-summary-${module.id} panel`} aria-labelledby={`role-module-${module.id}`} key={module.id}>
          <div className="personal-home-header">
            <div>
              <p className="eyebrow">{scope === "mine" ? "My records" : "Available demo workspace"}</p>
              <h2 id={`role-module-${module.id}`}>{module.label}</h2>
              <p>{module.description}</p>
            </div>
            <button className="personal-home-focus" type="button" onClick={() => goTo(module.route)}>
              Open view <ArrowRight size={12} aria-hidden="true" />
            </button>
          </div>

          <div className="personal-home-metrics">
            {module.metrics.filter((metric) => canViewTab(metric.tab)).map((metric) => {
              const Icon = metric.icon;
              return (
                <button
                  className={metric.alert ? "personal-home-metric is-alert" : "personal-home-metric"}
                  key={metric.label}
                  onClick={() => goTo(metric.tab)}
                  type="button"
                >
                  <Icon size={17} aria-hidden="true" />
                  <span><b>{metric.value}</b><small>{scope === "visible-workspace" ? metric.label.replace(/^My /, "").replace(/^my /, "") : metric.label}</small></span>
                  <p>{scope === "visible-workspace" ? metric.detail.replaceAll("Owned by you", "Within available demo records").replaceAll("Assigned to you", "Within available demo records").replaceAll("your active projects", "available active projects") : metric.detail}</p>
                  <span className="home-sosa-visually-hidden">Open {metric.label}</span>
                </button>
              );
            })}
          </div>

          <nav className="personal-home-links" aria-label={`${module.label} links`}>
            <span>Open</span>
            {module.links.filter((link) => canViewTab(link.tab)).map((link) => {
              const Icon = link.icon;
              return (
                <button type="button" key={`${link.tab}-${link.label}`} onClick={() => goTo(link.tab)}>
                  <Icon size={14} aria-hidden="true" />
                  {link.label}
                  <ArrowRight size={13} aria-hidden="true" />
                </button>
              );
            })}
          </nav>
        </section>
      ))}
    </div>
  );
}
