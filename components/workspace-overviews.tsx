"use client";

import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clapperboard,
  FolderKanban,
  Handshake,
  ListTodo,
  Network,
  Radio,
  Sparkles,
  Target,
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
import { projectDddPhase, projectPlaybook, projectType } from "@/lib/gtm-navigation";
import { taskBelongsToWorkspace } from "@/lib/tasks";

type WorkspaceTab =
  | "agent"
  | "gtm-linkedin"
  | "relationships"
  | "pipeline"
  | "partnerships"
  | "content"
  | "campaigns"
  | "tasks"
  | "metrics"
  | "intelligence"
  | "delivery"
  | "projects"
  | "delivery-work";

type GoTo = (tab: WorkspaceTab, recordId?: string | number) => void;

function compactCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function dateLabel(value: string) {
  if (!value) return "No date";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: year === new Date().getFullYear() ? undefined : "numeric",
  }).format(new Date(year, month - 1, day, 12));
}

export function GtmWorkspaceHome({
  accounts,
  contacts,
  opportunities,
  partnerships,
  campaigns,
  content,
  tasks,
  projects,
  goTo,
}: {
  accounts: AccountItem[];
  contacts: ContactItem[];
  opportunities: OpportunityItem[];
  partnerships: PartnershipItem[];
  campaigns: CampaignItem[];
  content: ContentItem[];
  tasks: TaskItem[];
  projects: ProjectItem[];
  goTo: GoTo;
}) {
  const activeAccounts = accounts.filter((item) => !item.archivedAt && item.status === "Active");
  const activeContacts = contacts.filter((item) => !item.archivedAt);
  const openOpportunities = opportunities.filter((item) => !item.archivedAt && !item.stage.startsWith("Closed"));
  const activePartnerships = partnerships.filter((item) => !item.archivedAt && item.stage !== "Paused / Ended");
  const activeCampaigns = campaigns.filter((item) => !item.archivedAt && !["Paused", "Complete"].includes(item.status));
  const activeContent = content.filter((item) => item.stage !== "Published");
  const openGtmTasks = tasks.filter((item) => !item.done && taskBelongsToWorkspace(item, projects, "gtm"));
  const pipelineValue = openOpportunities.reduce((sum, item) => sum + item.value, 0);

  const modules = [
    {
      title: "CRM",
      copy: "Shared account and people records, relationship status, source history, and completed activity.",
      metric: `${activeAccounts.length} active accounts · ${activeContacts.length} people`,
      icon: Network,
      tab: "relationships" as const,
    },
    {
      title: "LinkedIn Focus",
      copy: "The 5-3-1 relationship workflow: five accounts, three people in each, and one relevant action.",
      metric: `${accounts.filter((item) => !item.archivedAt && item.focus531).length}/5 focus accounts`,
      icon: Target,
      tab: "gtm-linkedin" as const,
    },
    {
      title: "Pipeline",
      copy: "AI Office, Plooms, and client-project opportunities with stage, value, decisions, and next steps.",
      metric: `${openOpportunities.length} open · ${compactCurrency(pipelineValue)}`,
      icon: BriefcaseBusiness,
      tab: "pipeline" as const,
    },
    {
      title: "Content",
      copy: "Campaigns, Personal LinkedIns, Spej authority content, production, review, and publishing.",
      metric: `${activeCampaigns.length} campaigns · ${activeContent.length} content items`,
      icon: Clapperboard,
      tab: "content" as const,
    },
    {
      title: "Work",
      copy: "Sales, partner, marketing, and content work with owners and deadlines.",
      metric: `${openGtmTasks.length} open work items`,
      icon: ListTodo,
      tab: "tasks" as const,
    },
    {
      title: "GTM Performance",
      copy: "Prospecting and publishing inputs, channel performance, meetings, pipeline, and business outcomes.",
      metric: "Recorded activity and source totals",
      icon: BarChart3,
      tab: "metrics" as const,
    },
    {
      title: "Intelligence",
      copy: "Industry news, Spej mentions, newsletters, and saved research for sales and content decisions.",
      metric: "One deduplicated research queue",
      icon: Radio,
      tab: "intelligence" as const,
    },
  ];

  return (
    <div className="view workspace-home">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Spej OS workspace</p>
          <h1>GTM</h1>
          <p className="page-description">
            Sales, partners, marketing, content, prospecting, and performance in one workspace. CRM and Projects use the same accounts, opportunities, and project records.
          </p>
        </div>
        <button className="button button-primary" onClick={() => goTo("agent")}>
          <Sparkles size={15} /> Ask SOSA
        </button>
      </div>

      <div className="workspace-kpis" aria-label="GTM summary">
        <div><b>{openOpportunities.length}</b><span>open opportunities</span></div>
        <div><b>{compactCurrency(pipelineValue)}</b><span>open pipeline</span></div>
        <div><b>{activePartnerships.length}</b><span>active partners</span></div>
        <div><b>{openGtmTasks.length}</b><span>open work items</span></div>
      </div>

      <section className="workspace-module-grid" aria-label="GTM sections">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <button key={module.title} className="panel workspace-module-card" onClick={() => goTo(module.tab)}>
              <span className="workspace-module-icon"><Icon size={19} /></span>
              <span>
                <b>{module.title}</b>
                <span className="workspace-module-copy">{module.copy}</span>
                <small>{module.metric}</small>
              </span>
              <ArrowRight size={17} />
            </button>
          );
        })}
      </section>

      <section className="panel connected-lifecycle" aria-labelledby="gtm-lifecycle-title">
        <div>
          <p className="eyebrow">Sales to delivery</p>
          <h2 id="gtm-lifecycle-title">One record from sale to project</h2>
          <p>When an opportunity is won, its account, people, deal details, and next steps stay linked to the project. Project teams see the delivery information they need.</p>
        </div>
        <ol>
          <li><span>1</span><b>Account & people</b><small>CRM</small></li>
          <li><span>2</span><b>Opportunity</b><small>GTM</small></li>
          <li><span>3</span><b>Signed work</b><small>Shared</small></li>
          <li><span>4</span><b>Project & outcomes</b><small>Projects</small></li>
        </ol>
        <button className="button button-secondary" onClick={() => goTo("delivery")}>
          Open Projects <ArrowRight size={14} />
        </button>
      </section>
    </div>
  );
}

export function DeliveryWorkspaceHome({
  accounts,
  opportunities,
  projects,
  tasks,
  goTo,
}: {
  accounts: AccountItem[];
  opportunities: OpportunityItem[];
  projects: ProjectItem[];
  tasks: TaskItem[];
  goTo: GoTo;
}) {
  const today = localDate();
  const accountNames = new Map(accounts.map((item) => [item.id, item.name]));
  const activeProjects = projects.filter((item) => !item.archivedAt && !["Complete", "Stopped"].includes(item.operationalStatus));
  const projectTasks = tasks.filter((item) => !item.done && taskBelongsToWorkspace(item, projects, "delivery"));
  const atRisk = activeProjects.filter((item) => item.health === "At Risk");
  const overdue = activeProjects.filter((item) => item.dueDate && item.dueDate < today);
  const coveredOpportunityIds = new Set(projects.filter((item) => !item.archivedAt && item.opportunityId).map((item) => item.opportunityId));
  const wonWithoutProject = opportunities.filter((item) => !item.archivedAt && item.stage === "Closed Won" && !coveredOpportunityIds.has(item.id));
  const orderedProjects = [...activeProjects].sort((left, right) => (left.dueDate || "9999-12-31").localeCompare(right.dueDate || "9999-12-31"));
  const linkedProjectRecords = activeProjects.flatMap((project) => project.linkedRecords || []);
  const countLinked = (...types: NonNullable<ProjectItem["linkedRecords"]>[number]["recordType"][]) => linkedProjectRecords.filter((record) => types.includes(record.recordType)).length;

  return (
    <div className="view workspace-home delivery-home">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Spej OS workspace</p>
          <h1>Projects</h1>
          <p className="page-description">
            All company projects for AI Office, Plooms, client work, events, partner enablement, marketing, product development, and internal work. Each project stays linked to its CRM account, opportunity, and work items.
          </p>
        </div>
        <button className="button button-primary" onClick={() => goTo("projects")}>
          <FolderKanban size={15} /> All Projects
        </button>
      </div>

      <div className="workspace-kpis" aria-label="Projects summary">
        <div><b>{activeProjects.length}</b><span>open projects</span></div>
        <div className={atRisk.length ? "metric-alert" : ""}><b>{atRisk.length}</b><span>at risk</span></div>
        <div className={overdue.length ? "metric-alert" : ""}><b>{overdue.length}</b><span>overdue milestones</span></div>
        <div><b>{projectTasks.length}</b><span>open work items</span></div>
      </div>

      <div className="delivery-overview-grid">
        <section className="panel delivery-portfolio-preview">
          <header>
            <div><p className="eyebrow">Projects</p><h2>Current projects</h2></div>
            <button className="text-button" onClick={() => goTo("projects")}>All Projects <ArrowRight size={13} /></button>
          </header>
          {orderedProjects.length ? (
            <div className="delivery-project-list">
              {orderedProjects.slice(0, 6).map((project) => {
                const linkedTasks = projectTasks.filter((task) => task.relatedType === "project" && task.relatedId === project.id).length;
                return (
                  <button key={project.id} onClick={() => goTo("projects", project.id)}>
                    <span className={`project-health-dot health-${(project.health || "Unknown").toLowerCase().replaceAll(" ", "-")}`} />
                    <span><b>{project.name}</b><small>{accountNames.get(project.accountId) || "Internal / unlinked"} · {projectType(project)}{projectPlaybook(project) === "Discovery / Design / Delivery" ? ` · ${projectDddPhase(project)}` : ""} · {project.owner}</small></span>
                    <span><b>{project.nextMilestone || "Milestone not defined"}</b><small>{dateLabel(project.dueDate)} · {linkedTasks} open work items</small></span>
                    <ArrowRight size={15} />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="workspace-empty"><CheckCircle2 size={22} /><p>No open projects are recorded.</p></div>
          )}
        </section>

        <aside className="delivery-side-stack">
          <section className="panel delivery-alert-card">
            <span className="workspace-module-icon"><CircleAlert size={18} /></span>
            <div><p className="eyebrow">Needs Attention</p><h2>{wonWithoutProject.length} won deals need a project</h2><p>These won opportunities are not linked to a project yet. Confirm the scope and project type first.</p></div>
            <button className="button button-ghost" onClick={() => goTo("pipeline")}>Review deals <ArrowRight size={13} /></button>
          </section>
          <section className="panel delivery-alert-card">
            <span className="workspace-module-icon"><CalendarClock size={18} /></span>
            <div><p className="eyebrow">Work</p><h2>{projectTasks.length} open work items</h2><p>Project work can have separate owners, priorities, subtasks, and deadlines.</p></div>
            <button className="button button-ghost" onClick={() => goTo("delivery-work")}>Open Work <ArrowRight size={13} /></button>
          </section>
        </aside>
      </div>

      <section className="panel project-connected-panel" aria-label="Connected project records">
        <header>
          <div><p className="eyebrow">Existing Spej OS foundations</p><h2>Connected project records</h2><p>Authorized references appear here after IT connects the existing services. Private records stay in their canonical system.</p></div>
          <span className="label label-verified">Reference only</span>
        </header>
        <div className="project-connected-grid">
          <article><span><ListTodo size={17} /></span><div><b>Tickets &amp; quality</b><p>Issues, QA checks, owners, status, and due dates.</p><small>{countLinked("ticket", "quality-item")} linked</small></div></article>
          <article><span><Network size={17} /></span><div><b>Files &amp; meeting records</b><p>Permission-aware SharePoint, OneDrive, and transcript references.</p><small>{countLinked("document", "transcript")} linked</small></div></article>
          <article><span><CheckCircle2 size={17} /></span><div><b>Decisions &amp; approvals</b><p>Recorded decisions, review gates, approvers, and evidence.</p><small>{countLinked("decision", "approval")} linked</small></div></article>
          <article><span><CalendarClock size={17} /></span><div><b>Time &amp; enterprise delivery</b><p>Time entries and enterprise-management records retained in Spej OS.</p><small>{countLinked("time-entry", "enterprise-engagement")} linked</small></div></article>
        </div>
      </section>

      <section className="panel shared-record-note">
        <Handshake size={20} />
        <div><b>Connected, not duplicated</b><p>CRM holds company and people records. GTM manages commercial work. Projects manages execution. The same records and approved SOSA actions appear wherever they are relevant.</p></div>
        <button className="button button-secondary" onClick={() => goTo("agent")}><Sparkles size={14} /> Use SOSA</button>
      </section>
    </div>
  );
}
