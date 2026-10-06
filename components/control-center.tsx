"use client";

import { contentMatchesSearch, focusedRecords, focusedTaskIds } from "@/lib/record-focus";
import { WorkflowGuide } from "./workflow-guide";
import { contentPublicationIssue } from "@/lib/content-workflow";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Activity,
  Archive,
  ArchiveRestore,
  ArrowRight,
  ArrowUpRight,
  AtSign,
  BarChart3,
  Bookmark,
  BriefcaseBusiness,
  Cable,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clapperboard,
  Clock3,
  Copy,
  ExternalLink,
  Eye,
  Facebook,
  FolderKanban,
  Globe2,
  Handshake,
  Inbox,
  Instagram,
  KeyRound,
  LayoutDashboard,
  Link2,
  Linkedin,
  ListTodo,
  LockKeyhole,
  Network,
  Mail,
  Menu,
  Megaphone,
  MessageSquare,
  Music2,
  Moon,
  Newspaper,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Users,
  X,
  Youtube,
} from "lucide-react";
import type {
  AudienceMetric,
  AudiencePlatform,
  DailyBriefItem,
  DailyBriefResponse,
  LiveFeedResponse,
  LiveStory,
  NewsletterFeedResponse,
  PublicSettings,
  ReminderItem,
  SettingsUpdate,
  TaskItem,
  WorkspaceState,
  WorkspaceStateResponse,
  ContentItem,
  ContentCategory,
  ContentStage,
  ContentStream,
  AccountItem,
  ContactItem,
  ActivityItem,
  OpportunityItem,
  PartnershipItem,
  ProjectItem,
  MarketingMetricItem,
  CampaignItem,
  TaskCategory,
  TaskVisibility,
  TaskWorkspaceId,
} from "@/lib/types";
import {
  GOOGLE_OAUTH_CLIENT_ID_ERROR,
  isGoogleOAuthClientId,
} from "@/lib/google-oauth";
import { isDailyBriefItemInWindow } from "@/lib/brief-window";
import {
  AUDIENCE_COMPARISON_WINDOW_LABEL,
  audienceComparisonLabel,
} from "@/lib/audience-growth";
import { SettingsInput } from "@/components/settings-input";
import { AiProviderSettings } from "@/components/ai-provider-settings";
import { DailySnapshot } from "@/components/daily-snapshot";
import { AudienceInsights } from "@/components/audience-insights";
import type { AudienceHistorySeries } from "@/lib/audience-charts";
import { AI_PROVIDER_LABELS, DEFAULT_LOCAL_AI_URLS, isAiReady } from "@/lib/ai-providers";
import { sortFeedStories, selectNewsletterTopics, newsletterSourceOptions } from "@/lib/feed-priority";
import { sortIndustryItems, type IndustrySortOrder } from "@/lib/industry";
import { TASK_PRIORITIES, TASK_VISIBILITIES, TASK_WORKSPACES, WORK_EFFORTS, WORK_STATUSES, completeTaskItems, inheritedTaskAccess, inheritedTaskRelationship, normalizeTaskHierarchy, removeTaskAndDetachChildren, sortTaskItems, taskBelongsToWorkspace, taskDueValue, taskPriorityRank, taskVisibility, taskVisibilityLabel, taskWorkspaceId, taskWorkspaceLabel, type TaskSortMode } from "@/lib/tasks";
import { PREVIEW_OPERATOR_PROFILE_ID, TEAM_VIEW_PROFILES, TEAM_HOME_MODULES, getRoleHomeModules, getTeamViewProfile, type TeamProfileId, type TeamViewProfile } from "@/lib/team-views";
import type { HomeModuleId } from "@/lib/home-layout";
import { PREVIEW_ACCESS_NOTICE, getPreviewAccessPolicy, previewCanEditTask, previewCanViewTask, previewOwnsTask, previewWorkspaceLabels } from "@/lib/task-access-preview";
import { socialSellingProgress } from "@/lib/social-selling";
import { contentCategoriesForStream, normalizeContentCategory } from "@/lib/content-taxonomy";
import { IntelligenceHub, PartnershipsView, PipelineView, ProjectsView } from "@/components/director-operations";
import { RelationshipsView } from "@/components/relationships-view";
import { SpejAgent } from "@/components/spej-agent";
import { MarketingMetricsView } from "@/components/marketing-metrics";
import { CampaignsView } from "@/components/campaigns-view";
import { TodayActionCenter } from "@/components/today-action-center";
import { HomeSosaBar } from "@/components/personal-home";
import { ConfigurableHome } from "@/components/configurable-home";
import { DeliveryWorkspaceHome, GtmWorkspaceHome } from "@/components/workspace-overviews";
import { AccessManagementPanel, type AccessAuditEvent, type AccessFeatureOption, type AccessPrincipalOption, type AccessRecordGrantInput } from "@/components/access-management-panel";
import { evaluatePortalAccess, isStableAccessId, type AccessCapability, type AccessDataScope, type AccessRole, type AccessRule, type AccessSubject, type AccessTenantPolicy } from "@/lib/access-control";
import { projectTaskLinkIssue } from "@/lib/workflow-readiness";
import { spejIndustryDescription, spejIndustryKeywords, spejIndustrySources } from "@/lib/spej-preset";
import {
  applyArchiveToPayload,
  type CachedFeedPayload,
} from "@/lib/live-response";

type Tab =
  | "today"
  | "agent"
  | "gtm"
  | "gtm-linkedin"
  | "delivery"
  | "gtm-initiatives"
  | "delivery-work"
  | "relationships"
  | "pipeline"
  | "partnerships"
  | "projects"
  | "intelligence"
  | "industry"
  | "mentions"
  | "reminders"
  | "audience"
  | "newsletters"
  | "content"
  | "campaigns"
  | "metrics"
  | "tasks"
  | "settings";
type SettingsSection =
  | "general"
  | "access"
  | "industry"
  | "mentions"
  | "newsletters"
  | "audience"
  | "ai"
  | "dailyBrief"
  | "integrations";
type Reminder = ReminderItem;
type Task = TaskItem;

const emptySettings: PublicSettings = {
  general: { workspaceName: "Spej OS" },
  industry: {
    sources: spejIndustrySources,
    keywords: spejIndustryKeywords,
    description: spejIndustryDescription,
    excludedTerms: [],
    dailyLimit: 30,
  },
  mentions: {
    profiles: [
      { id: "spej-ai", label: "Spej AI", type: "company", enabled: true, terms: ["Spej AI", "Spej", "@spejai"], standaloneCompanyTerms: ["Spej AI", "Spej"], websites: ["spej.ai"], officialProfileUrls: ["https://www.linkedin.com/company/spejai"], identityAnchors: ["Sagar Pandya", "Sean Blair", "Alex Krutik", "Joseph Kim", "Ken Peel", "Aby Abraham"], negativeTerms: [] },
      { id: "sagar-pandya", label: "Sagar Pandya", type: "person", enabled: true, terms: ["Sagar Pandya", "@heysagarpandya"], websites: [], officialProfileUrls: ["https://www.linkedin.com/in/heysagarpandya"], identityAnchors: ["Spej", "spej.ai", "Founder of Spej", "CEO of Spej", "Prompt First, Ask Later", "pfalpod.com"], negativeTerms: [] },
      { id: "sean-blair", label: "Sean Blair", type: "person", enabled: true, terms: ["Sean Blair"], websites: [], officialProfileUrls: [], identityAnchors: ["Spej", "spej.ai"], negativeTerms: [] },
      { id: "alex-krutik", label: "Alex Krutik", type: "person", enabled: true, terms: ["Alex Krutik"], websites: [], officialProfileUrls: [], identityAnchors: ["Spej", "spej.ai"], negativeTerms: [] },
      { id: "joseph-kim", label: "Joseph Kim", type: "person", enabled: true, terms: ["Joseph Kim"], websites: [], officialProfileUrls: [], identityAnchors: ["Spej", "spej.ai"], negativeTerms: [] },
      { id: "ken-peel", label: "Ken Peel", type: "person", enabled: true, terms: ["Ken Peel"], websites: [], officialProfileUrls: [], identityAnchors: ["Spej", "spej.ai"], negativeTerms: [] },
      { id: "aby-abraham", label: "Aby C. Abraham", type: "person", enabled: true, terms: ["Aby C. Abraham", "Aby C Abraham", "Aby Abraham", "@abycabraham"], websites: [], officialProfileUrls: ["https://www.linkedin.com/in/abycabraham"], identityAnchors: ["Spej", "spej.ai", "Director of AI Adoption and Strategic Partnerships", "Director, AI Adoption & Strategic Partnerships"], negativeTerms: [] },
    ],
    terms: ["Spej", "@spejai", "Sagar Pandya", "@heysagarpandya", "Sean Blair", "Alex Krutik", "Joseph Kim", "Ken Peel", "Aby C Abraham", "Aby Abraham", "@abycabraham"],
    websites: ["spej.ai"],
    identityAnchors: ["Spej", "spej.ai", "@spejai", "Prompt First, Ask Later", "pfalpod.com", "AI Culture Blueprint", "Middleground", "Director, AI Adoption & Strategic Partnerships", "Director of AI Adoption and Strategic Partnerships"],
    negativeTerms: [],
    strictMode: true,
    excludeOwnedSites: true,
  },
  newsletters: {
    googleClientId: "",
    googleClientSecretSet: false,
    connected: false,
    connectedEmail: "",
    gmailQuery: "newer_than:30d (category:updates OR category:promotions)",
  },
  audience: { accounts: [] },
  ai: {
    provider: "none",
    model: "",
    localBaseUrls: DEFAULT_LOCAL_AI_URLS,
    keySet: { openai: false, anthropic: false, gemini: false, xai: false, lmstudio: false, ollama: false },
    keySource: { openai: "none", anthropic: "none", gemini: "none", xai: "none", lmstudio: "none", ollama: "none" },
  },
  dailyBrief: { sourceLabels: [], lookbackDays: 7, sections: { industry: 5, mentions: 5, newsletters: 5 } },
};

const gtmWorkspaceTabs: Tab[] = [
  "gtm", "gtm-linkedin", "pipeline", "partnerships", "campaigns", "content",
  "tasks", "gtm-initiatives", "metrics", "audience", "intelligence", "industry",
  "mentions", "newsletters", "reminders",
];
const deliveryWorkspaceTabs: Tab[] = ["delivery", "projects", "delivery-work"];
const recordFocusTabs: Tab[] = ["pipeline", "partnerships", "projects", "gtm-initiatives", "content", "campaigns", "tasks", "delivery-work"];

const nav: { id: Tab; label: string; icon: typeof Activity; activeTabs?: Tab[] }[] = [
  { id: "today", label: "My Work", icon: LayoutDashboard },
  { id: "agent", label: "SOSA", icon: Sparkles },
  { id: "relationships", label: "CRM", icon: Network },
  { id: "gtm", label: "GTM", icon: BriefcaseBusiness, activeTabs: gtmWorkspaceTabs },
  { id: "delivery", label: "Projects", icon: FolderKanban, activeTabs: deliveryWorkspaceTabs },
];

const hiddenTabs: { id: Tab; label: string }[] = [
  { id: "gtm-linkedin", label: "LinkedIn Focus" },
  { id: "pipeline", label: "Sales pipeline" }, { id: "partnerships", label: "Partners & affiliates" },
  { id: "gtm-initiatives", label: "Plans & initiatives" },
  { id: "projects", label: "All projects" },
  { id: "campaigns", label: "Campaigns" }, { id: "content", label: "Content" },
  { id: "industry", label: "Industry news" }, { id: "mentions", label: "Spej mentions" },
  { id: "reminders", label: "Saved research" }, { id: "audience", label: "Audience source tracker" },
  { id: "newsletters", label: "Newsletters" }, { id: "tasks", label: "GTM work" },
  { id: "metrics", label: "GTM performance" }, { id: "intelligence", label: "Intelligence" },
  { id: "delivery-work", label: "Project work" },
];
const allowedTabs = new Set<Tab>([...nav.map((item) => item.id), ...hiddenTabs.map((item) => item.id), "settings"]);
const PREVIEW_VIEWER_KEY = "spej-os-preview-viewer";

const PREVIEW_ACCESS_TENANT = "tenant-spej-preview";
const PREVIEW_ACCESS_PORTALS = [
  { id: "my-work", label: "My Work", description: "Assigned tasks, approvals, and authorized updates." },
  { id: "sosa", label: "SOSA", description: "Permission-filtered questions and reviewed actions." },
  { id: "crm", label: "CRM", description: "Accounts, people, opportunities, partners, and activity." },
  { id: "gtm", label: "GTM", description: "Sales, marketing, content, performance, and intelligence." },
  { id: "projects", label: "Projects", description: "Project records, delivery work, risks, quality, and tickets." },
  { id: "admin", label: "Administration", description: "Users, access, feature controls, connectors, audit, and operations." },
] as const;

function previewRole(id: string, label: string, description: string, portalIds: readonly string[], capabilities: readonly AccessCapability[], scopes: readonly AccessDataScope[], portalCapabilities: readonly AccessCapability[] = ["view"]): AccessRole {
  const rules: AccessRule[] = [
    { id: `${id}-portals`, tenantId: PREVIEW_ACCESS_TENANT, effect: "allow", boundary: "portal", portalIds, capabilities: portalCapabilities, scopes: ["company"] },
  ];
  if (capabilities.length) rules.push({ id: `${id}-records`, tenantId: PREVIEW_ACCESS_TENANT, effect: "allow", boundary: "records", portalIds, capabilities, scopes });
  return { id, tenantId: PREVIEW_ACCESS_TENANT, label, description, rules };
}

const PREVIEW_ACCESS_ROLES: readonly AccessRole[] = [
  previewRole("user-gtm", "User · GTM", "Assigned and team CRM/GTM work; no company-wide lead list.", ["my-work", "sosa", "crm", "gtm"], ["view", "create", "edit"], ["own", "assigned", "team"]),
  previewRole("user-projects", "User · Projects", "Assigned and team project work; CRM is not included by default.", ["my-work", "sosa", "projects"], ["view", "create", "edit"], ["own", "assigned", "team"]),
  previewRole("service-department", "Service Department", "Assigned and team service-delivery work.", ["my-work", "sosa", "projects"], ["view", "edit"], ["own", "assigned", "team"]),
  previewRole("leadership-viewer", "Leadership", "Company reporting, approvals, CRM, GTM, and project oversight.", ["my-work", "sosa", "crm", "gtm", "projects"], ["view", "approve"], ["company"]),
  previewRole("company-admin", "Company Admin", "Company configuration without automatic confidential-record access.", ["my-work", "sosa", "admin"], ["admin"], ["company"], ["view", "admin"]),
  previewRole("tenant-super-admin", "Tenant Super Admin", "Tenant operations; confidential records still require an exact grant.", ["my-work", "sosa", "crm", "gtm", "projects", "admin"], ["view", "create", "edit", "approve", "export", "delete", "admin"], ["company"], ["view", "admin"]),
  previewRole("service-integration", "API / MCP service", "SOSA portal access; each callable tool must be allowlisted.", ["sosa"], [], [], ["view"]),
];

function previewRoleIds(profile: TeamViewProfile): string[] {
  const roleIds = new Set<string>();
  if (profile.focusAreas.includes("GTM") || profile.focusAreas.includes("Content")) roleIds.add("user-gtm");
  if (profile.focusAreas.includes("Project Management") || profile.focusAreas.includes("Technical Delivery")) roleIds.add("user-projects");
  if (profile.focusAreas.includes("Leadership")) roleIds.add("leadership-viewer");
  // Aby's home stays focused on GTM and content, while Projects remains
  // available for cross-functional handoffs and work assigned to him.
  if (profile.id === "aby") roleIds.add("user-projects");
  if (profile.id === "aby" || profile.id === "sean") roleIds.add("company-admin");
  return [...roleIds];
}

type PreviewAccessProfile = {
  availableHomeModuleIds?: HomeModuleId[];
  id: string;
  label: string;
  description: string;
  status: "active" | "revoked";
  subject: AccessSubject;
  accessUntil: string;
  additionalScopes: AccessDataScope[];
  additionalCapabilities: AccessCapability[];
};

const PREVIEW_FEATURE_IDS = ["sosa-agent", "microsoft-365", "teams-files"] as const;

function humanAccessProfile(profile: TeamViewProfile): PreviewAccessProfile {
  return {
    availableHomeModuleIds: profile.id === "aby" || profile.id === "sean" ? TEAM_HOME_MODULES.map((module) => module.id) : getRoleHomeModules(profile).map((module) => module.id),
    id: profile.id,
    label: profile.displayName,
    description: [profile.jobTitle, ...profile.focusAreas].filter(Boolean).join(" · "),
    status: "active",
    subject: {
      principalId: `entra-preview:${profile.id}`,
      tenantId: PREVIEW_ACCESS_TENANT,
      profileId: profile.id,
      roleIds: previewRoleIds(profile),
      teamIds: profile.focusAreas.map((area) => `team-${area.toLowerCase().replaceAll(" ", "-")}`),
      principalType: "person",
      featureIds: [...PREVIEW_FEATURE_IDS],
      directRules: [],
    },
    accessUntil: "",
    additionalScopes: [],
    additionalCapabilities: [],
  };
}

function initialPreviewAccessProfiles(): PreviewAccessProfile[] {
  const people = TEAM_VIEW_PROFILES.map(humanAccessProfile);
  return [...people, {
    id: "service-sosa-teams",
    label: "SOSA Teams connector",
    description: "Demo tenant-scoped service account",
    status: "active" as const,
    subject: {
      principalId: "service-preview:sosa-teams",
      tenantId: PREVIEW_ACCESS_TENANT,
      roleIds: ["service-integration"],
      teamIds: [],
      principalType: "service" as const,
      featureIds: ["sosa-agent", "microsoft-365", "teams-files"],
      directRules: [{
        id: "service-tool-crm-search",
        tenantId: PREVIEW_ACCESS_TENANT,
        effect: "allow" as const,
        boundary: "records" as const,
        portalIds: ["sosa"],
        capabilities: ["view" as const],
        scopes: ["selected-records" as const],
        recordKinds: ["tool"],
        recordIds: ["crm.search"],
        reason: "Demo least-privilege tool allowlist",
      }],
    },
    accessUntil: "",
    additionalScopes: [],
    additionalCapabilities: [],
  }];
}

function tabPortal(tab: Tab): string {
  if (tab === "today") return "my-work";
  if (tab === "agent") return "sosa";
  if (tab === "relationships") return "crm";
  if (deliveryWorkspaceTabs.includes(tab)) return "projects";
  if (tab === "settings") return "admin";
  return "gtm";
}

function profileTenantPolicy(profile: PreviewAccessProfile, moduleFlags: readonly AccessFeatureOption[], now = new Date()): AccessTenantPolicy {
  const expired = Boolean(profile.accessUntil && Date.parse(profile.accessUntil) <= now.getTime());
  return {
    tenantId: PREVIEW_ACCESS_TENANT,
    disabledPortalIds: moduleFlags.filter((flag) => !flag.enabled).map((flag) => flag.id),
    revokedPrincipalIds: profile.status === "revoked" || expired ? [profile.subject.principalId] : [],
  };
}

function syncAdditionalAccess(profile: PreviewAccessProfile): PreviewAccessProfile {
  const retained = (profile.subject.directRules || []).filter((rule) => rule.id !== "preview-additional-access");
  const additional = profile.additionalScopes.length && profile.additionalCapabilities.length ? [{
    id: "preview-additional-access",
    tenantId: PREVIEW_ACCESS_TENANT,
    effect: "allow" as const,
    boundary: "records" as const,
    portalIds: ["my-work", "crm", "gtm", "projects"],
    capabilities: profile.additionalCapabilities,
    scopes: profile.additionalScopes,
    ...(profile.accessUntil ? { expiresAt: profile.accessUntil } : {}),
    reason: "Interactive additional-access preview",
  }] : [];
  return { ...profile, subject: { ...profile.subject, directRules: [...retained, ...additional] } };
}

function featureOptionsFor(profile: PreviewAccessProfile): AccessFeatureOption[] {
  const enabled = new Set(profile.subject.featureIds || []);
  const sosaEnabled = !profile.subject.disabledPortalIds?.includes("sosa");
  const expiresAt = profile.accessUntil || undefined;
  return [
    { id: "restricted-documents", label: "Eligible for restricted documents", description: "An exact document grant is still required.", enabled: enabled.has("restricted-documents"), expiresAt },
    { id: "sosa-agent", label: "SOSA agent", description: "Permission-filtered tools and reviewed actions.", enabled: sosaEnabled, expiresAt },
    { id: "microsoft-365", label: "Microsoft 365 context", description: "Approved Outlook and calendar context.", enabled: enabled.has("microsoft-365"), expiresAt },
    { id: "teams-files", label: "Teams and files", description: "Approved Teams, SharePoint, and OneDrive references.", enabled: enabled.has("teams-files"), expiresAt },
  ];
}

function isTab(value: string | null): value is Tab {
  return Boolean(value && allowedTabs.has(value as Tab));
}

const workspaceSections: Array<{ label: string; tabs: Array<{ id: Tab; label: string; icon: typeof Activity }> }> = [
  { label: "Sales", tabs: [{ id: "pipeline", label: "Opportunities", icon: BriefcaseBusiness }, { id: "partnerships", label: "Partners", icon: Handshake }] },
  { label: "Work & planning", tabs: [{ id: "tasks", label: "GTM work", icon: ListTodo }, { id: "gtm-initiatives", label: "Plans & initiatives", icon: FolderKanban }] },
  { label: "Marketing", tabs: [{ id: "campaigns", label: "Campaigns", icon: Megaphone }, { id: "content", label: "Content", icon: Clapperboard }] },
  { label: "Performance", tabs: [{ id: "metrics", label: "GTM metrics", icon: BarChart3 }, { id: "audience", label: "Channel audiences", icon: Users }] },
  { label: "Intelligence", tabs: [{ id: "intelligence", label: "Overview", icon: Radio }, { id: "industry", label: "Industry news", icon: Newspaper }, { id: "mentions", label: "Spej mentions", icon: AtSign }, { id: "newsletters", label: "Newsletters", icon: Mail }, { id: "reminders", label: "Saved research", icon: Bookmark }] },
];

const deliverySectionTabs: Array<{ id: Tab; label: string; icon: typeof Activity }> = [
  { id: "delivery", label: "Overview", icon: LayoutDashboard },
  { id: "projects", label: "All projects", icon: FolderKanban },
  { id: "delivery-work", label: "Work", icon: ListTodo },
];

function WorkspaceSectionNav({ activeTab, goTo }: { activeTab: Tab; goTo: (tab: Tab) => void }) {
  if (deliveryWorkspaceTabs.includes(activeTab)) {
    return <div className="workspace-section-nav"><span>Projects</span><div>{deliverySectionTabs.map((item) => { const Icon = item.icon; return <button aria-current={activeTab === item.id ? "page" : undefined} className={activeTab === item.id ? "active" : ""} key={item.id} onClick={() => goTo(item.id)}><Icon size={13}/>{item.label}</button>; })}</div></div>;
  }
  if (activeTab === "gtm") return null;
  const section = workspaceSections.find((item) => item.tabs.some((tab) => tab.id === activeTab));
  if (!section) return null;
  const tabs = [{ id: "gtm" as Tab, label: "GTM overview", icon: LayoutDashboard }, ...section.tabs];
  return <div className="workspace-section-nav"><span>GTM · {section.label}</span><div>{tabs.map((item) => { const Icon = item.icon; return <button aria-current={activeTab === item.id ? "page" : undefined} className={activeTab === item.id ? "active" : ""} key={item.id} onClick={() => goTo(item.id)}><Icon size={13}/>{item.label}</button>; })}</div></div>;
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}
function Panel({
  children,
  className = "",
  ...props
}: React.ComponentPropsWithoutRef<"section">) {
  return (
    <section className={`panel ${className}`} {...props}>
      {children}
    </section>
  );
}

function MentionIdentityDetails({
  initiallyOpen,
  children,
}: {
  initiallyOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <details
      className="account-card"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      {children}
    </details>
  );
}
function Label({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <span
      className={classNames(
        "label",
        tone && `label-${tone.toLowerCase().replaceAll(" ", "-")}`,
      )}
    >
      {children}
    </span>
  );
}
function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading reveal">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {action}
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  const difference = Date.now() - date.getTime();
  if (difference < 60 * 60 * 1000)
    return `${Math.max(1, Math.round(difference / 60_000))} min ago`;
  if (difference < 24 * 60 * 60 * 1000)
    return `${Math.round(difference / 3_600_000)} hr ago`;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    notation: Math.abs(value) >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTaskDue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(date);
}

function isTaskDueToday(value: string) {
  return value === "Today" || value === localDateValue();
}

function readLegacyList<T>(key: string): T[] {
  try {
    const value = window.localStorage.getItem(key);
    if (!value) return [];
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

const WORKSPACE_RECOVERY_KEY = "control-center-v3-workspace-recovery";
const THEME_STORAGE_KEY = "control-center-theme";

function toggleColorTheme() {
  const root = document.documentElement;
  const nextTheme = root.dataset.theme === "light" ? "dark" : "light";
  root.dataset.theme = nextTheme;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch {
    // The selected theme still applies for this session when storage is unavailable.
  }
}

type WorkspaceRecovery = {
  id: string;
  savedAt: string;
  workspace: WorkspaceState;
};

function readWorkspaceRecovery(): WorkspaceRecovery | null {
  try {
    const value = window.localStorage.getItem(WORKSPACE_RECOVERY_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<WorkspaceRecovery>;
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.savedAt !== "string" ||
      !parsed.workspace ||
      !Array.isArray(parsed.workspace.reminders) ||
      !Array.isArray(parsed.workspace.tasks)
    ) return null;
    for (const key of ["content", "accounts", "contacts", "activities", "opportunities", "partnerships", "projects", "campaigns", "marketingMetrics"] as const)
      if (!Array.isArray(parsed.workspace[key])) parsed.workspace[key] = [];
    return parsed as WorkspaceRecovery;
  } catch {
    return null;
  }
}

function SetupEmpty({
  icon,
  title,
  description,
  onSetup,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onSetup: () => void;
}) {
  return (
    <Panel className="empty-state setup-empty">
      <div className="setup-empty-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{description}</p>
      <button className="button button-primary" onClick={onSetup}>
        <Settings2 size={15} /> Open settings
      </button>
    </Panel>
  );
}

function ErrorNotice({ errors }: { errors: string[] }) {
  const uniqueErrors = Array.from(new Set(errors));
  if (!uniqueErrors.length) return null;
  return (
    <div className="error-notice">
      <CircleAlert size={17} />
      <div>
        <b>Some sources could not be read</b>
        {uniqueErrors.map((error) => (
          <p key={error}>{error}</p>
        ))}
      </div>
    </div>
  );
}

const liveDataCache = new Map<string, unknown>();

function clearLiveDataCache() {
  liveDataCache.clear();
}

function useLiveData<T>(
  endpoint: string,
  refreshEveryMs = 15 * 60 * 1000,
  manualEndpoint = endpoint,
) {
  const initialData = liveDataCache.get(endpoint) as T | undefined;
  const [data, setData] = useState<T | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const load = async (requestEndpoint = endpoint) => {
      setLoading(true);
      try {
        const response = await fetch(requestEndpoint, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok)
          throw new Error(
            payload.errors?.[0] || payload.error || "Live data request failed.",
          );
        if (!cancelled) {
          setData(payload as T);
          liveDataCache.set(endpoint, payload as T);
          setError("");
        }
      } catch (requestError) {
        if (!cancelled)
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Live data request failed.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (nonce > 0) void load(manualEndpoint);
    else void load(endpoint);
    const interval = window.setInterval(
      () => void load(manualEndpoint),
      refreshEveryMs,
    );
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [endpoint, manualEndpoint, nonce, refreshEveryMs]);
  return {
    data,
    loading,
    error,
    refresh: () => setNonce((value) => value + 1),
    mutate: (updater: (current: T) => T) =>
      setData((current) => {
        if (!current) return current;
        const next = updater(current);
        liveDataCache.set(endpoint, next);
        return next;
      }),
  };
}

function LoadingPanel() {
  return (
    <Panel className="empty-state">
      <RefreshCw className="spin" size={24} />
      <h2>Checking live sources</h2>
      <p>This can take a few seconds when several providers are configured.</p>
    </Panel>
  );
}

function LiveLoadError({ error, retry }: { error: string; retry: () => void }) {
  return (
    <Panel className="empty-state error-state" role="alert">
      <CircleAlert size={26} />
      <h2>Live data could not be loaded</h2>
      <p>{error}</p>
      <button className="button button-primary" onClick={retry}>
        <RefreshCw size={15} /> Retry
      </button>
    </Panel>
  );
}

function useArchiveAction<T extends CachedFeedPayload>(
  category: "industry" | "mentions" | "newsletters",
  mutate: (updater: (current: T) => T) => void,
) {
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const update = async (id: string, archived: boolean) => {
    setPending(id);
    setError("");
    try {
      const response = await fetch("/api/library", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, id, archived }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Could not update the archive.");
      liveDataCache.delete("/api/brief");
      mutate((current) => applyArchiveToPayload(current, id, archived));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update the archive.",
      );
    } finally {
      setPending("");
    }
  };
  return { pending, error, update };
}

function briefDueLabel(value?: string) {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function DailyBriefPanel({
  settings,
  openSettings,
  addTask,
  goTo,
}: {
  settings: PublicSettings;
  openSettings: (section?: SettingsSection) => void;
  addTask: (item: DailyBriefItem) => void;
  goTo: (tab: Tab) => void;
}) {
  const { data, loading, error, refresh } = useLiveData<DailyBriefResponse>(
    "/api/brief",
    5 * 60 * 1000,
  );
  const [window, setWindow] = useState<"today" | "week">("today");
  const now = Date.parse(data?.checkedAt || "1970-01-01T00:00:00.000Z");
  const enabledSources = new Set(
    settings.dailyBrief.sourceLabels.map((source) =>
      source.toLocaleLowerCase("en-US"),
    ),
  );
  const items = (data?.items || []).filter((item) => {
    if (!enabledSources.has(item.source.toLocaleLowerCase("en-US"))) return false;
    return isDailyBriefItemInWindow(item, window, now);
  });
  const connected = (data?.sourceStatuses || []).filter(
    (status) => status.state === "live",
  ).length;

  return (
    <Panel className="daily-brief-panel reveal delay-1">
      <div className="daily-brief-head">
        <div>
          <p className="eyebrow">Across your dashboard</p>
          <h2>Daily brief</h2>
          <p>
            Public news and newsletter coverage are merged into unique topics; verified Spej mentions stay separate.
          </p>
        </div>
        <div className="daily-brief-actions">
          <button className="button button-ghost" onClick={() => openSettings("dailyBrief")}>
            <Settings2 size={14} /> Customize
          </button>
          <button
            className="round-link"
            aria-label="Refresh daily brief"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw className={loading ? "spin" : ""} size={15} />
          </button>
        </div>
      </div>
      {error && <p className="save-notice" role="alert">{error}</p>}
      {loading && !data && <p className="brief-loading">Reading your saved dashboard…</p>}
      {!!data?.snapshot?.length && <DailySnapshot sections={data.snapshot} intelligence={data.intelligence} onOpen={goTo} />}
      {data && !data.snapshot?.length && (
        <div className="brief-setup-state">
          <LayoutDashboard size={24} />
          <div>
            <b>Build your own daily snapshot</b>
            <p>Choose how many stories to include from Industry, Mentions, and Newsletters. No extra connection is needed.</p>
          </div>
          <button className="button button-primary" onClick={() => openSettings("dailyBrief")}>Choose sections</button>
        </div>
      )}
      {!!settings.dailyBrief.sourceLabels.length && <div className="brief-private-head">
        <div><p className="eyebrow">Optional private context</p><h3>Messages, meetings & actions</h3></div>
        <div className="filter-row"><button className={window === "today" ? "active" : ""} onClick={() => setWindow("today")}>Today</button><button className={window === "week" ? "active" : ""} onClick={() => setWindow("week")}>Week</button></div>
      </div>}
      {!settings.dailyBrief.sourceLabels.length ? null : error && !data ? (
        <div className="brief-setup-state error-state" role="alert">
          <CircleAlert size={24} />
          <div>
            <b>Daily Brief could not be read</b>
            <p>{error}</p>
          </div>
          <button className="button button-primary" onClick={refresh}>
            Retry
          </button>
        </div>
      ) : loading && !data ? (
        <div className="brief-setup-state">
          <RefreshCw className="spin" size={24} />
          <div>
            <b>Reading local connector data</b>
            <p>This should only take a moment.</p>
          </div>
        </div>
      ) : items.length ? (
        <div className="daily-brief-grid">
          {items.slice(0, 8).map((item) => (
            <article className="daily-brief-item" key={`${item.source}:${item.id}`}>
              <div className="brief-item-meta">
                <Label tone={item.kind === "action" ? "high" : "brief"}>
                  {item.kind}
                </Label>
                <span>{item.source}</span>
                <span>
                  <Clock3 size={11} /> {briefDueLabel(item.dueAt)}
                </span>
              </div>
              <h3>{item.title}</h3>
              {item.summary && <p>{item.summary}</p>}
              <div className="brief-item-actions">
                <button onClick={() => addTask(item)}>
                  <ListTodo size={13} /> Add task
                </button>
                {item.url && (
                  <a href={item.url} target="_blank" rel="noreferrer">
                    Open source <ArrowUpRight size={13} />
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="brief-setup-state">
          <MessageSquare size={24} />
          <div>
            <b>Waiting for the first connector sync</b>
            <p>
              {connected
                ? `${connected} source${connected === 1 ? " has" : "s have"} synced, with no items in this window.`
                : "Open bridge setup to copy the Codex automation prompt or use the local ingest command."}
            </p>
          </div>
          <button
            className="button button-ghost"
            onClick={() => openSettings("integrations")}
          >
            Bridge setup
          </button>
        </div>
      )}
      {!!data?.sourceStatuses.length && (
        <div className="brief-source-strip">
          {data.sourceStatuses.map((status) => (
            <span key={status.source} title={status.message || undefined}>
              <i
                className={
                  status.state === "live"
                    ? "ready"
                    : status.state === "error"
                      ? "error"
                      : ""
                }
              />
              {status.source}
              <small>
                {status.state === "error"
                  ? `failed · ${formatDate(status.lastAttemptAt)}`
                  : status.lastSyncedAt
                  ? `${status.itemCount} · ${formatDate(status.lastSyncedAt)}`
                  : "waiting"}
              </small>
            </span>
          ))}
        </div>
      )}
    </Panel>
  );
}

function newsletterSetupReady(settings: PublicSettings) {
  return settings.newsletters.connected && isAiReady(settings.ai);
}

function activeMentionProfileCount(settings: PublicSettings) {
  if (settings.mentions.profiles)
    return settings.mentions.profiles.filter((profile) => profile.enabled).length;
  return settings.mentions.terms.length + settings.mentions.websites.length;
}

function TodayView({
  canViewTab,
  grantedModuleIds,
  settings,
  viewer,
  agentCommand,
  setAgentCommand,
  tasks,
  opportunities,
  partnerships,
  projects,
  campaigns,
  content,
  accounts,
  contacts,
  activities,
  goTo,
  openSettings,
  addBriefTask,
  completeTask,
}: {
  canViewTab: (route: string) => boolean;
  grantedModuleIds: readonly HomeModuleId[];
  settings: PublicSettings;
  viewer: TeamViewProfile;
  agentCommand: string;
  setAgentCommand: (value: string) => void;
  tasks: Task[];
  opportunities: OpportunityItem[];
  partnerships: PartnershipItem[];
  projects: ProjectItem[];
  campaigns: CampaignItem[];
  content: ContentItem[];
  accounts: AccountItem[];
  contacts: ContactItem[];
  activities: ActivityItem[];
  goTo: (tab: Tab, recordId?: string | number) => void;
  openSettings: (section?: SettingsSection) => void;
  addBriefTask: (item: DailyBriefItem) => void;
  completeTask: (task: Task) => void;
}) {
  const socialProgress = socialSellingProgress(accounts, contacts, activities);
  const industryConfigured =
    settings.industry.sources.length + settings.industry.keywords.length > 0;
  const configured = [
    industryConfigured,
    activeMentionProfileCount(settings) > 0,
    newsletterSetupReady(settings),
    settings.audience.accounts.length > 0,
  ].filter(Boolean).length;
  const roleFocus = viewer.focusAreas.map((area) => area === "Project Management" ? "Projects" : area).join(" and ");
  const showGtmDailyTools = viewer.focusAreas.includes("GTM") || viewer.focusAreas.includes("Content");
  const today = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
  return (
    <div className="view">
      <PageHeading
        eyebrow={today}
        title={`My work · ${viewer.displayName}`}
        description={`Assigned work, deadlines, approvals, and updates for ${roleFocus}. This demo uses the preview selector; production uses the signed-in person's role and permissions.`}
        action={
          <button
            className="button button-ghost"
            onClick={() => openSettings()}
          >
            <Settings2 size={15} /> Settings
          </button>
        }
      />
      <HomeSosaBar
        viewerName={viewer.displayName}
        command={agentCommand}
        setCommand={setAgentCommand}
        openSosa={() => goTo("agent")}
      />
      <TodayActionCenter
        tasks={tasks}
        accounts={accounts}
        activities={activities}
        contacts={contacts}
        opportunities={opportunities}
        partnerships={partnerships}
        projects={projects}
        campaigns={campaigns}
        content={content}
        viewer={viewer}
        goTo={goTo}
        completeTask={completeTask}
      />
      <ConfigurableHome
        key={viewer.id}
        canViewTab={canViewTab}
        grantedModuleIds={grantedModuleIds}
        viewer={{
          profileId: viewer.id,
          displayName: viewer.displayName,
          focus: [...viewer.focusAreas],
          homeLabel: `Assigned work and verified operating signals for ${roleFocus}.`,
        }}
        accounts={accounts}
        contacts={contacts}
        opportunities={opportunities}
        partnerships={partnerships}
        projects={projects}
        campaigns={campaigns}
        content={content}
        tasks={tasks.filter((task) => previewCanViewTask(task, viewer, projects))}
        goTo={goTo}
      />
      <details className="today-system-guide reveal delay-1">
        <summary><span>How Spej OS is organized</span><small>One record system with role-based views</small></summary>
        <div className="today-system-guide-body">
      {configured < 4 && <div className="brief-banner reveal delay-1">
        <div className="brief-mark">
          <Sparkles size={19} />
        </div>
        <p>
          {configured === 0 ? (
            <>
              <strong>Your dashboard is ready to configure.</strong> Add
              industry sources, mention terms, a newsletter Gmail, and audience
              accounts in Settings.
            </>
          ) : (
            <>
              <strong>{configured} of 4 live areas are configured.</strong> Open
              a tracked page for saved results, or use Refresh to check now.
            </>
          )}
        </p>
        <button aria-label="Open settings" onClick={() => openSettings()}>
          <ArrowRight size={18} />
        </button>
      </div>}
      <section className="gtm-boundary reveal delay-1" aria-label="Connected Spej OS workspaces">
        <div className="gtm-boundary-intro"><p className="eyebrow">One system</p><h2>CRM, GTM, and Projects are different views of the same records.</h2><p>People see the work their role requires and only the data their permissions allow. SOSA uses those same records and permissions.</p></div>
        <div className="gtm-boundary-grid">
          <div><span className="gtm-boundary-badge owned">GTM</span><b>Sales and marketing</b><p>Opportunities, partners, campaigns, content, intelligence, metrics, and related work.</p></div>
          <div><span className="gtm-boundary-badge shared">CRM</span><b>Company records</b><p>Accounts, people, relationships, opportunities, activity, and client history are maintained once.</p></div>
          <div><span className="gtm-boundary-badge system">Projects</span><b>Plan and deliver</b><p>Client, AI Office, Plooms, event, marketing, partner, product, and internal work.</p></div>
        </div>
        <div className="gtm-sync-note"><span><i/>Demo mode · company identity, Microsoft 365, and existing Spej OS services still require IT connection</span><button onClick={() => openSettings("integrations")}>See connection plan <ArrowRight size={13}/></button></div>
      </section>
      <section className="operating-map reveal delay-1" aria-label="Spej OS workspaces">
        <div className="operating-map-head"><div><p className="eyebrow">Where to go</p><h2>Open the record you need or ask SOSA.</h2></div><button className="button button-primary" onClick={() => goTo("agent")}><Sparkles size={15}/> Open SOSA</button></div>
        <div className="operating-lanes">
          <button onClick={() => goTo("relationships")}><Network/><span><b>CRM</b><small>Accounts, people, opportunities, clients, partners, and activity</small></span><ArrowRight/></button>
          <button onClick={() => goTo("gtm")}><BriefcaseBusiness/><span><b>GTM</b><small>Sales, marketing, content, performance, intelligence, and related work</small></span><ArrowRight/></button>
          <button onClick={() => goTo("delivery")}><FolderKanban/><span><b>Projects</b><small>Company delivery, milestones, risks, decisions, quality, and work</small></span><ArrowRight/></button>
          <button onClick={() => goTo("content")}><Clapperboard/><span><b>Content</b><small>Personal LinkedIns, Spej authority content, production, and campaigns</small></span><ArrowRight/></button>
          <button onClick={() => goTo("metrics")}><BarChart3/><span><b>GTM performance</b><small>Prospecting and publishing inputs, meetings, pipeline, and outcomes</small></span><ArrowRight/></button>
          <button onClick={() => goTo("intelligence")}><Radio/><span><b>Intelligence</b><small>Industry news, Spej mentions, newsletters, and saved research</small></span><ArrowRight/></button>
        </div>
      </section>
        </div>
      </details>
      {showGtmDailyTools ? (
        <>
          <button className="today-social-strip reveal delay-1" onClick={() => goTo("gtm-linkedin")}><span className="ops-icon"><Linkedin size={17}/></span><span><b>Today’s LinkedIn 5-3-1 tasks</b><small>{socialProgress.focusedAccounts.length}/5 focus accounts · {socialProgress.focusedContacts.length} focus people · {socialProgress.completedContactIdsToday.size} engaged today</small></span><span>{socialProgress.activeDaysThisWeek}/7 active days</span><ArrowRight size={16}/></button>
          <DailyBriefPanel settings={settings} openSettings={openSettings} addTask={addBriefTask} goTo={goTo} />
        </>
      ) : (
        <details className="today-secondary-section reveal delay-1">
          <summary><span>GTM intelligence and 5-3-1</span><small>Available to every team member when needed</small></summary>
          <button className="today-social-strip" onClick={() => goTo("gtm-linkedin")}><span className="ops-icon"><Linkedin size={17}/></span><span><b>LinkedIn 5-3-1</b><small>{socialProgress.focusedAccounts.length}/5 focus accounts · {socialProgress.focusedContacts.length} focus people · {socialProgress.completedContactIdsToday.size} engaged today</small></span><span>{socialProgress.activeDaysThisWeek}/7 active days</span><ArrowRight size={16}/></button>
          <DailyBriefPanel settings={settings} openSettings={openSettings} addTask={addBriefTask} goTo={goTo} />
        </details>
      )}
    </div>
  );
}

function IndustryView({
  saveStory,
  addContentIdea,
  openSettings,
}: {
  saveStory: (story: LiveStory) => void;
  addContentIdea: (title: string, angle: string, sourceUrl?: string) => void;
  openSettings: () => void;
}) {
  const { data, loading, error, refresh, mutate } = useLiveData<LiveFeedResponse>(
    "/api/live/industry",
    15 * 60 * 1000,
    "/api/live/industry?refresh=1",
  );
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"active" | "history" | "archive">("active");
  const [sortOrder, setSortOrder] = useState<IndustrySortOrder>("important");
  const archive = useArchiveAction<LiveFeedResponse>("industry", mutate);
  const sourceItems =
    view === "archive"
      ? data?.archivedItems || []
      : view === "history"
        ? data?.historyItems || []
        : data?.items || [];
  const items = sortIndustryItems(
    sourceItems.filter((item) =>
      `${item.title} ${item.summary} ${item.source}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    ),
    sortOrder,
  );
  const kindLabel = (item: LiveStory) =>
    item.kind === "sitemap"
      ? "New sitemap page"
      : item.kind === "topic"
        ? "Topic discovery"
        : "Live feed";
  return (
    <div className="view">
      <PageHeading
        eyebrow="Live source desk"
        title="Industry"
        description="A bounded briefing of the most useful watched-site and topic updates from the last 24 hours."
        action={
          <button
            className="button button-primary"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw size={15} /> Refresh sources
          </button>
        }
      />
      {loading && !data ? (
        <LoadingPanel />
      ) : !data && error ? (
        <LiveLoadError error={error} retry={refresh} />
      ) : !data?.configured ? (
        <SetupEmpty
          icon={<Globe2 />}
          title="Choose what this page watches"
          description="Add public sites for feed or sitemap tracking, and topics for wider industry-news discovery."
          onSetup={openSettings}
        />
      ) : (
        <>
          <div className="toolbar reveal delay-1">
            <div className="filter-row">
              <button
                className={view === "active" ? "active" : ""}
                onClick={() => setView("active")}
              >
                Important now {data.items.length}
              </button>
              <button
                className={view === "history" ? "active" : ""}
                onClick={() => setView("history")}
              >
                History {data.historyCount || 0}
              </button>
              <button
                className={view === "archive" ? "active" : ""}
                onClick={() => setView("archive")}
              >
                Archived {data.archiveCount || 0}
              </button>
            </div>
            <div className="toolbar-actions">
              <label className="sort-control">
                <span>Sort</span>
                <select
                  aria-label="Sort industry updates"
                  value={sortOrder}
                  onChange={(event) =>
                    setSortOrder(event.target.value as IndustrySortOrder)
                  }
                >
                  <option value="important">Most important</option>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="watched">Watched sites first</option>
                </select>
              </label>
              <label className="search-box">
                <Search size={15} />
                <input
                  aria-label="Search industry updates"
                  placeholder="Search updates"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
            </div>
          </div>
          <div className="industry-curation-strip reveal delay-1">
            <div>
              <Sparkles size={17} />
              <span>
                <b>{data.items.length} surfaced</b>
                <small>
                  from {data.discoveredCount ?? data.items.length} current
                  discoveries · limit {data.surfacedLimit ?? data.items.length}
                </small>
              </span>
            </div>
            <Label tone={data.curationMode === "local" ? "watch" : "verified"}>
              {data.curationMode === "local"
                ? "Local ranking"
                : `${data.curationMode} assisted`}
            </Label>
            <p>
              {data.providerStatuses?.[0]?.message ||
                "Canonical deduplication, relevance, recency, material-change signals, and source diversity determine this queue."}
            </p>
          </div>
          {data.sourceStatuses?.length ? (
            <div className="source-status-grid reveal delay-1">
              {data.sourceStatuses.map((status) => (
                <div
                  className={`source-status status-${status.state}`}
                  key={status.sourceId}
                >
                  <span>
                    <Globe2 size={14} />
                    <b>{status.source}</b>
                  </span>
                  <Label
                    tone={status.mode === "sitemap" ? "brief" : "positive"}
                  >
                    {status.mode}
                  </Label>
                  <p>{status.message}</p>
                  <a href={status.endpoint} target="_blank" rel="noreferrer">
                    View endpoint <ExternalLink size={11} />
                  </a>
                </div>
              ))}
            </div>
          ) : null}
          <ErrorNotice
            errors={[
              ...(data.errors || []),
              ...(error ? [error] : []),
              ...(archive.error ? [archive.error] : []),
            ]}
          />
          <div className="story-stack reveal delay-2">
            {items.map((item, index) => (
              <article className="story-card" key={item.id}>
                <div className="story-index">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="story-body">
                  <div className="story-meta">
                    <span>{item.source}</span>
                    <i />
                    <span>{formatDate(item.publishedAt)}</span>
                    <Label
                      tone={item.kind === "sitemap" ? "brief" : "positive"}
                    >
                      {kindLabel(item)}
                    </Label>
                    {item.importanceScore !== undefined && (
                      <Label tone="verified">
                        {item.importanceScore} importance
                      </Label>
                    )}
                    {view === "history" && (
                      <Label tone="watch">History</Label>
                    )}
                    {view === "archive" && (
                      <Label tone="watch">Archived</Label>
                    )}
                  </div>
                  <h2>{item.title}</h2>
                  <p>
                    {item.summary ||
                      "Open the original source for the full update."}
                  </p>
                  {item.importanceReason && view === "active" && (
                    <p className="importance-reason">
                      <Sparkles size={12} /> {item.importanceReason}
                    </p>
                  )}
                  <div className="story-footer">
                    <span />
                    <div>
                      {view === "active" && (
                        <button
                          title="Add to content pipeline"
                          onClick={() => addContentIdea(item.title, item.summary, item.url)}
                        >
                          <Clapperboard size={16} />
                        </button>
                      )}
                      {view === "active" && (
                        <button
                          title="Save to reminders"
                          onClick={() => saveStory(item)}
                        >
                          <Bookmark size={16} />
                        </button>
                      )}
                      {view === "active" ? (
                        <button
                          title="Archive"
                          disabled={archive.pending === item.id}
                          onClick={() => void archive.update(item.id, true)}
                        >
                          <Archive size={16} />
                        </button>
                      ) : item.workflow?.restoreEligible ? (
                        <button
                          title="Restore from archive"
                          disabled={archive.pending === item.id}
                          onClick={() => void archive.update(item.id, false)}
                        >
                          <ArchiveRestore size={16} />
                        </button>
                      ) : null}
                      <a
                        className="round-link"
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        title="Open original"
                      >
                        <ExternalLink size={16} />
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            ))}
            {!items.length && (
              <Panel className="empty-state">
                <CheckCircle2 size={24} />
                <h2>
                  {view === "archive"
                    ? "Nothing archived yet"
                    : view === "history"
                      ? "Nothing in history yet"
                      : "No current updates found"}
                </h2>
                <p>
                  {view === "archive"
                    ? "Items only appear here after you choose Archive."
                    : view === "history"
                      ? "Updates that left the current 24-hour window remain available here."
                      : "No discovery cleared the current importance threshold. The broad source scan still completed and will check again automatically."}
                </p>
              </Panel>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MentionsView({
  saveStory,
  openSettings,
}: {
  saveStory: (story: LiveStory) => void;
  openSettings: () => void;
}) {
  const { data, loading, error, refresh, mutate } = useLiveData<LiveFeedResponse>(
    "/api/live/mentions",
    15 * 60 * 1000,
    "/api/live/mentions?refresh=1",
  );
  const [view, setView] = useState<"active" | "archive">("active");
  const [sortOrder, setSortOrder] = useState<"priority" | "newest" | "oldest">("priority");
  const archive = useArchiveAction<LiveFeedResponse>("mentions", mutate);
  const items = sortFeedStories(view === "archive" ? data?.archivedItems || [] : data?.items || [], sortOrder);
  const highConfidenceCount = (data?.items || []).filter(
    (item) => item.confidence === "high",
  ).length;
  return (
    <div className="view">
      <PageHeading
        eyebrow="Seven-day web radar"
        title="Mentions"
        description="Verified third-party pages from the past week, matched to the identities you configure and deduplicated against your local archive."
        action={
          <button
            className="button button-ghost"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw size={15} /> Check now
          </button>
        }
      />
      {loading && !data ? (
        <LoadingPanel />
      ) : !data && error ? (
        <LiveLoadError error={error} retry={refresh} />
      ) : !data?.configured ? (
        <SetupEmpty
          icon={<AtSign />}
          title="Tell the radar what to watch"
          description="Add exact aliases plus identity anchors that distinguish you from namesakes."
          onSetup={openSettings}
        />
      ) : (
        <>
          <div className="shelf-controls reveal delay-1">
            <div className="filter-row">
              <button
                className={view === "active" ? "active" : ""}
                onClick={() => setView("active")}
              >
                Past 7 days {data.items.length}
              </button>
              <button
                className={view === "archive" ? "active" : ""}
                onClick={() => setView("archive")}
              >
                Archive & history {data.archiveCount || 0}
              </button>
            </div>
            <div className="live-stamp">
              <i /> Checked {formatDate(data.checkedAt)}
            </div>
          </div>
          <div className="mention-summary reveal delay-1">
            <div>
              <span>High confidence</span>
              <b>{highConfidenceCount}</b>
              <small>Direct identity evidence</small>
            </div>
            <div>
              <span>Needs review</span>
              <b>{data.reviewCount || 0}</b>
              <small>Literal matches when strict mode is off</small>
            </div>
            <div>
              <span>Noise removed</span>
              <b>{data.filteredOut || 0}</b>
              <small>Weak or ambiguous matches</small>
            </div>
            <div className="mention-callout">
              <ShieldCheck size={19} />
              <p>
                <b>Identity-aware filtering</b>Provider query terms never count
                as evidence. Exact aliases and domains can qualify directly;
                ambiguous names require configured identity anchors in strict
                mode.
              </p>
            </div>
          </div>
          {data.providerStatuses?.length ? (
            <div className="provider-status-list reveal delay-1">
              {data.providerStatuses.map((status) => (
                <div key={status.provider} className={`provider-state state-${status.state}`}>
                  <span>
                    <i /> <b>{status.provider}</b>
                  </span>
                  <Label
                    tone={
                      status.state === "live"
                        ? "positive"
                        : status.state === "disabled"
                          ? "watch"
                          : "brief"
                    }
                  >
                    {status.state}
                  </Label>
                  <p>{status.message}</p>
                </div>
              ))}
            </div>
          ) : null}
          <ErrorNotice
            errors={[
              ...(data.errors || []),
              ...(error ? [error] : []),
              ...(archive.error ? [archive.error] : []),
            ]}
          />
          <div className="mention-feed reveal delay-2">
            <div className="feed-sort-bar">
              <span><Sparkles size={14} /> {data.curationMode && data.curationMode !== "local" ? `${AI_PROVIDER_LABELS[data.curationMode]} priority & page summaries` : "Built-in priority · enable AI for richer page summaries"}</span>
              <label>Sort mentions <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as typeof sortOrder)}><option value="priority">Priority</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
            </div>
            {items.map((item) => (
              <article className="mention-card" key={item.id}>
                <div className="network-avatar network-web">
                  {(item.matchedProfileLabel || item.matchedTerm)?.[0]?.toUpperCase() || "@"}
                </div>
                <div className="mention-content">
                  <div className="mention-meta">
                    <b>{item.source}</b>
                    <span>{formatDate(item.publishedAt || item.discoveredAt || "")}</span>
                    <Label
                      tone={item.confidence === "high" ? "verified" : "watch"}
                    >
                      {item.confidence === "high"
                        ? "High confidence"
                        : "Review"}
                    </Label>
                    {(item.matchedProfileLabels?.length
                      ? item.matchedProfileLabels
                      : item.matchedProfileLabel
                        ? [item.matchedProfileLabel]
                        : item.matchedTerm
                          ? [item.matchedTerm]
                          : []).map((label) => <Label key={label}>{label}</Label>)}
                  </div>
                  <p>“{item.title}”</p>
                  <div className="mention-page-summary">{item.aiSummary || item.summary}</div>
                  {item.importanceReason && <div className="priority-reason"><Sparkles size={12} /><span>{item.importanceScore !== undefined ? `${item.importanceScore}/100 · ` : ""}{item.importanceReason}</span></div>}
                  <div className="mention-footer">
                    <span>
                      {item.matchReasons?.join(" · ") ||
                        item.summary.slice(0, 180)}
                    </span>
                  </div>
                </div>
                <div className="mention-actions">
                  {view === "active" && (
                    <button
                      title="Save to reminders"
                      onClick={() => saveStory(item)}
                    >
                      <Bookmark size={16} />
                    </button>
                  )}
                  <a
                    className="round-link"
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${item.title}`}
                  >
                    <ExternalLink size={16} />
                  </a>
                  {view === "active" ? (
                    <button
                      title="Archive"
                      disabled={archive.pending === item.id}
                      onClick={() => void archive.update(item.id, true)}
                    >
                      <Archive size={16} />
                    </button>
                  ) : item.workflow?.restoreEligible ? (
                    <button
                      title="Restore"
                      disabled={archive.pending === item.id}
                      onClick={() => void archive.update(item.id, false)}
                    >
                      <ArchiveRestore size={16} />
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
            {!items.length && (
              <Panel className="empty-state">
                <CheckCircle2 size={26} />
                <h2>
                  {view === "archive"
                    ? "No mention history"
                    : "No verified new mentions found"}
                </h2>
                <p>
                  {view === "archive"
                    ? "Archived and expired mentions remain available here."
                    : "The news collectors and any enabled broad-web research found no new URL with direct identity evidence in the past seven days. Previously archived URLs stay out of this queue."}
                </p>
              </Panel>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function RemindersView({
  reminders,
  addReminder,
  archiveReminder,
}: {
  reminders: Reminder[];
  addReminder: (title: string, note: string, url?: string) => void;
  archiveReminder: (id: string | number, archived: boolean) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [view, setView] = useState<"active" | "archive">("active");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    addReminder(
      title.trim(),
      note.trim(),
      title.startsWith("http") ? title : undefined,
    );
    setTitle("");
    setNote("");
    setShowForm(false);
  };
  const active = reminders
    .filter((item) => !item.archivedAt)
    .sort(
      (left, right) =>
        Date.parse(right.createdAt || "") - Date.parse(left.createdAt || ""),
    );
  const archived = reminders
    .filter((item) => item.archivedAt)
    .sort(
      (left, right) =>
        Date.parse(right.archivedAt || "") - Date.parse(left.archivedAt || ""),
    );
  const items = view === "archive" ? archived : active;
  return (
    <div className="view">
      <PageHeading
        eyebrow="Research library"
        title="Saved research"
        description="Save articles, videos, posts, and ideas without turning them into tasks."
        action={
          <button
            className="button button-primary"
            onClick={() => {
              setView("active");
              setShowForm(true);
            }}
          >
            <Plus size={16} /> Save something
          </button>
        }
      />
      {showForm && (
        <form className="quick-form reveal" onSubmit={submit}>
          <div className="form-icon">
            <Link2 size={20} />
          </div>
          <label>
            <span>Link or title</span>
            <input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Paste a URL or type a title…"
            />
          </label>
          <label>
            <span>Why save it?</span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="A note for future you"
            />
          </label>
          <button className="button button-primary">Save</button>
          <button
            className="icon-button"
            type="button"
            onClick={() => setShowForm(false)}
          >
            <X size={16} />
          </button>
        </form>
      )}
      <div className="shelf-controls reveal delay-1">
        <div className="filter-row">
          <button
            className={view === "active" ? "active" : ""}
            onClick={() => setView("active")}
          >
            Active {active.length}
          </button>
          <button
            className={view === "archive" ? "active" : ""}
            onClick={() => setView("archive")}
          >
            Archive {archived.length}
          </button>
        </div>
        <span className="sort-label">
          <ChevronDown size={15} /> Newest first
        </span>
      </div>
      <div className="reminder-grid reveal delay-2">
        {items.map((item) => (
          <article
            className={`reminder-card accent-${item.accent}`}
            key={item.id}
          >
            <div className="reminder-top">
              <Label>{item.type}</Label>
              <button
                title={
                  view === "archive" ? "Restore reminder" : "Archive reminder"
                }
                onClick={() => archiveReminder(item.id, view === "active")}
              >
                {view === "archive" ? (
                  <ArchiveRestore size={15} />
                ) : (
                  <Archive size={15} />
                )}
              </button>
            </div>
            <div className="reminder-icon">
              <Newspaper />
            </div>
            <h2>{item.title}</h2>
            <p>{item.note}</p>
            <div className="reminder-bottom">
              <span>
                {item.source} ·{" "}
                {item.createdAt
                  ? formatDate(item.createdAt)
                  : item.added || "Saved previously"}
              </span>
              {item.url && (
                <a href={item.url} target="_blank" rel="noreferrer">
                  Open <ArrowUpRight size={14} />
                </a>
              )}
            </div>
          </article>
        ))}
        {view === "active" && (
          <button className="add-card" onClick={() => setShowForm(true)}>
            <Plus />
            <span>
              {reminders.length ? "Save another thing" : "Your shelf is empty"}
            </span>
            <small>Paste any link from the web</small>
          </button>
        )}
        {view === "archive" && !items.length && (
          <Panel className="empty-state">
            <Archive size={24} />
            <h2>No archived reminders</h2>
            <p>
              Archived links and ideas stay available here until you restore
              them.
            </p>
          </Panel>
        )}
      </div>
    </div>
  );
}

function platformColor(platform: AudiencePlatform) {
  return {
    youtube: "#e5484d",
    x: "#15181c",
    instagram: "#b44b91",
    facebook: "#3d73a8",
    linkedin: "#1769aa",
    threads: "#4f5554",
    tiktok: "#1e918c",
  }[platform];
}
function profilePlaceholder(platform: AudiencePlatform) {
  return {
    youtube: "https://youtube.com/@your-handle",
    x: "https://x.com/your-handle",
    instagram: "https://instagram.com/your-handle",
    facebook: "https://facebook.com/your-page",
    linkedin: "https://linkedin.com/in/your-name",
    threads: "https://threads.net/@your-handle",
    tiktok: "https://tiktok.com/@your-handle",
  }[platform];
}
function cachedMetricLabel(item: AudienceMetric) {
  if (item.source?.includes("daily cache")) return "Daily cache";
  return item.source?.includes("(cached)") ? "Cached" : "";
}

function AudienceView({ openSettings }: { openSettings: () => void }) {
  const { data, loading, error, refresh } = useLiveData<{
    configured: boolean;
    checkedAt: string;
    items: AudienceMetric[];
    history?: AudienceHistorySeries[];
  }>("/api/live/audience", 15 * 60 * 1000, "/api/live/audience?refresh=1");
  const items = data?.items || [];
  return (
    <div className="view">
      <PageHeading
        eyebrow="Keyless audience ledger"
        title="Audience source tracker"
        description="Best-effort public totals for the exact profile URLs in Settings, with changes measured against a verified 24–36h baseline instead of the latest refresh."
        action={
          <button
            className="button button-ghost"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw size={15} /> Refresh metrics
          </button>
        }
      />
      {loading && !data ? (
        <LoadingPanel />
      ) : !data && error ? (
        <LiveLoadError error={error} retry={refresh} />
      ) : !data?.configured ? (
        <SetupEmpty
          icon={<Users />}
          title="Add the accounts you care about"
          description="Paste public YouTube, X, Instagram, Facebook, LinkedIn, Threads, or TikTok profile URLs. API keys are optional fallbacks."
          onSetup={openSettings}
        />
      ) : (
        <>
          <AudienceInsights items={items} history={data.history} checkedAt={data.checkedAt} />
          {error && <ErrorNotice errors={[error]} />}
          <div className="platform-table reveal delay-2">
            <div className="platform-head">
              <span>Platform</span>
              <span>Audience</span>
              <span>{AUDIENCE_COMPARISON_WINDOW_LABEL}</span>
              <span>Status</span>
            </div>
            {items.map((item) => {
              const cacheLabel = cachedMetricLabel(item);
              return (
                <div className="platform-row" key={item.id}>
                  <div className="platform-name">
                    <span
                      className="platform-icon"
                      style={{ background: platformColor(item.platform) }}
                    >
                      {item.platform[0].toUpperCase()}
                    </span>
                    <div>
                      <b>{item.label}</b>
                      <small>{item.handle}</small>
                    </div>
                  </div>
                  <div className="platform-total">
                    <strong>
                      {item.error
                        ? item.total === null
                          ? "—"
                          : formatNumber(item.total)
                        : formatNumber(item.total ?? 0)}
                    </strong>
                    <small>
                      {[
                        item.primaryLabel
                          ? `${item.primaryLabel[0].toUpperCase()}${item.primaryLabel.slice(1)}`
                          : "Audience total",
                        item.secondaryLabel && item.secondaryValue !== undefined
                          ? `${formatNumber(item.secondaryValue)} ${item.secondaryLabel}`
                          : "",
                      ].filter(Boolean).join(" · ")}
                    </small>
                  </div>
                  <div className="platform-growth">
                    <b>
                      {item.error && item.stale
                        ? "Last known"
                        : item.change === null
                          ? "Baseline"
                          : `${item.change >= 0 ? "+" : ""}${formatNumber(item.change)}`}
                    </b>
                    <small>
                      {item.error
                        ? item.lastSuccessfulAt
                          ? `Last verified ${formatDate(item.lastSuccessfulAt)}`
                          : item.error
                        : item.change === null
                          ? "Waiting for 24–36h baseline"
                          : audienceComparisonLabel(
                              item.checkedAt,
                              item.changeComparedAt,
                            )}
                    </small>
                  </div>
                  {item.error ? (
                    <Label tone="watch">
                      {item.stale ? "Limited" : "Unavailable"}
                    </Label>
                  ) : (
                    <Label tone={cacheLabel ? "watch" : "positive"}>
                      {cacheLabel || "Public"}
                    </Label>
                  )}
                  {item.error && item.lastSuccessfulAt && (
                    <small className="metric-error">{item.error}</small>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function NewslettersView({
  addReminder,
  addContentIdea,
  openSettings,
  openAiSettings,
}: {
  addReminder: (title: string, note: string, url?: string) => void;
  addContentIdea: (title: string, angle: string, sourceUrl?: string) => void;
  openSettings: () => void;
  openAiSettings: () => void;
}) {
  const { data, loading, error, refresh, mutate } = useLiveData<NewsletterFeedResponse>(
    "/api/live/newsletters",
    15 * 60 * 1000,
    "/api/live/newsletters?refresh=1",
  );
  const [view, setView] = useState<"active" | "archive" | "history">("active");
  const [sortOrder, setSortOrder] = useState<"priority" | "newest" | "oldest">("priority");
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(30);
  const archive = useArchiveAction<NewsletterFeedResponse>(
    "newsletters",
    mutate,
  );
  const sourceItems = view === "archive"
    ? data?.archivedItems || []
    : view === "history"
      ? data?.historyItems || []
      : data?.items || [];
  const sourceOptions = newsletterSourceOptions(sourceItems);
  const items = selectNewsletterTopics(sourceItems, { sortOrder, sources: selectedSources, query });
  const visibleItems = items.slice(0, visibleCount);
  const changeView = (next: typeof view) => { setView(next); setVisibleCount(30); };
  const clearFilters = () => { setSelectedSources([]); setQuery(""); setVisibleCount(30); };
  return (
    <div className="view newsletter-view">
      <PageHeading
        eyebrow="Newsletter intelligence"
        title="Newsletters"
        description="AI reads your newsletters, extracts the actual news, and combines repeated coverage into source-backed stories."
        action={
          <button
            className="button button-primary"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw size={15} /> Refresh intelligence
          </button>
        }
      />
      {loading && !data ? (
        <LoadingPanel />
      ) : !data && error ? (
        <LiveLoadError error={error} retry={refresh} />
      ) : !data?.configured ? (
        <SetupEmpty
          icon={<Mail />}
          title="Connect a newsletter Gmail"
          description="This can be a completely different account from any Gmail connected elsewhere. The dashboard requests read-only access."
          onSetup={openSettings}
        />
      ) : data.aiConfigured === false && !data.items.length && !data.historyItems?.length && !data.archivedItems.length ? (
        <SetupEmpty
          icon={<Sparkles />}
          title="Choose AI for newsletter intelligence"
          description="Connect a cloud AI provider or a loaded LM Studio / Ollama model in AI curation. Newsletter text goes only to the selected provider. Gmail remains read-only."
          onSetup={openAiSettings}
        />
      ) : (
        <>
          <div className="newsletter-status reveal delay-1">
            <div className="status-orb">
              <Inbox size={21} />
            </div>
            <div>
              <b>
                {data.connected
                  ? `${data.items.length} active stories from ${data.issueCount || 0} newsletter issues`
                  : "Saved newsletter intelligence"}
              </b>
              <p>
                {data.newsletterCount || 0} newsletters · {data.mentionCount || 0} source mentions · {data.aiProvider ? AI_PROVIDER_LABELS[data.aiProvider] : "AI"} · checked {formatDate(data.checkedAt)}
                {data.pendingIssueCount ? ` · ${data.pendingIssueCount} older issues queued for background processing` : ""}
                {!data.connected ? " · Gmail disconnected" : ""}
              </p>
            </div>
            <button onClick={openSettings}>
              Manage account <ArrowRight size={14} />
            </button>
          </div>
          <div className="shelf-controls reveal delay-1">
            <div className="filter-row">
              <button
                className={view === "active" ? "active" : ""}
                onClick={() => changeView("active")}
              >
                Past {data.freshnessHours || 36} hours {data.items.length}
              </button>
              <button
                className={view === "history" ? "active" : ""}
                onClick={() => changeView("history")}
              >
                Earlier {data.historyCount || 0}
              </button>
              <button
                className={view === "archive" ? "active" : ""}
                onClick={() => changeView("archive")}
              >
                Archive {data.archiveCount || 0}
              </button>
            </div>
          </div>
          <ErrorNotice
            errors={[
              ...(data.errors || []),
              ...(error ? [error] : []),
              ...(archive.error ? [archive.error] : []),
            ]}
          />
          <div className="newsletter-stack reveal delay-2">
            <div className="newsletter-controls">
              <label className="search-box"><Search size={15} /><input aria-label="Search newsletter stories" autoComplete="off" value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(30); }} placeholder="Search headlines, topics, or sources…" /></label>
              <details className="newsletter-filter-menu">
                <summary><Mail size={14} /> {selectedSources.length ? `${selectedSources.length} selected newsletters` : "All newsletters"}<ChevronDown size={14} /></summary>
                <div className="newsletter-filter-options">
                  <button type="button" onClick={() => { setSelectedSources([]); setVisibleCount(30); }}>All newsletters</button>
                  {sourceOptions.map(({name, count}) => <label key={name}><input type="checkbox" checked={selectedSources.includes(name)} onChange={(event) => { setSelectedSources((current) => event.target.checked ? [...current, name] : current.filter((source) => source !== name)); setVisibleCount(30); }} /><span>{name}</span><small>{count}</small></label>)}
                  {!sourceOptions.length && <p>No newsletters in this view yet.</p>}
                </div>
              </details>
              <label className="feed-sort-select">Sort stories<select value={sortOrder} onChange={(event) => { setSortOrder(event.target.value as typeof sortOrder); setVisibleCount(30); }}><option value="priority">Priority</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
            </div>
            <div className="newsletter-results" aria-live="polite"><span>Showing {visibleItems.length} of {items.length} stories{selectedSources.length ? ` · ${selectedSources.join(", ")}` : ""}</span>{(query || selectedSources.length > 0) && <button onClick={clearFilters}>Clear filters <X size={12} /></button>}</div>
            {visibleItems.map((item) => (
              <article className="newsletter-card" key={item.id}>
                <div className="sender-mark">
                  {item.title[0]?.toUpperCase() || "N"}
                </div>
                <div className="newsletter-copy">
                  <div className="story-meta">
                    <span>
                      {item.coverageCount} report{item.coverageCount === 1 ? "" : "s"}
                    </span>
                    <i />
                    <span>
                      {item.newsletterCount} newsletter{item.newsletterCount === 1 ? "" : "s"}
                    </span>
                    <i />
                    <span>{formatDate(item.receivedAt)}</span>
                    <Label tone={item.coverageCount > 1 ? "positive" : "neutral"}>
                      {item.coverageCount > 1 ? "Cross-reported" : "New story"}
                    </Label>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>
                  {item.importanceReason && <div className="priority-reason"><Sparkles size={12} /><span>{item.importanceScore !== undefined ? `${item.importanceScore}/100 · ` : ""}{item.importanceReason}</span></div>}
                  <div className="newsletter-sources">
                    {item.sourceLinks.slice(0, 4).map((source) => (
                      <a
                        key={source.url}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        title={source.title}
                      >
                        <ExternalLink size={12} /> {source.publisher}
                      </a>
                    ))}
                    {item.sourceLinks.length > 4 && (
                      <details>
                        <summary>+{item.sourceLinks.length - 4} more sources</summary>
                        {item.sourceLinks.slice(4).map((source) => (
                          <a key={source.url} href={source.url} target="_blank" rel="noreferrer" title={source.title}>
                            <ExternalLink size={12} /> {source.publisher}
                          </a>
                        ))}
                      </details>
                    )}
                  </div>
                  <div className="newsletter-byline">
                    Reported by {item.newsletterSources.slice(0, 4).join(", ")}
                    {item.newsletterSources.length > 4
                      ? ` +${item.newsletterSources.length - 4} more`
                      : ""}
                  </div>
                  <div className="newsletter-foot">
                    {view !== "archive" && (
                      <button onClick={() => addContentIdea(item.title, item.summary, item.url)}>
                        <Clapperboard size={14} /> Make content
                      </button>
                    )}
                    {view !== "archive" && (
                      <button
                        onClick={() =>
                          addReminder(
                            item.title,
                            item.summary,
                            item.url,
                          )
                        }
                      >
                        <Bookmark size={14} /> Remind me
                      </button>
                    )}
                    <a href={item.url} target="_blank" rel="noreferrer">
                      <ExternalLink size={14} /> Open source
                    </a>
                    <a href={item.gmailUrl} target="_blank" rel="noreferrer">
                      <Mail size={14} /> Newsletter evidence
                    </a>
                  </div>
                </div>
                {(view === "active" || (view === "archive" && item.workflow?.restoreEligible)) && <button
                  className="mark-read"
                  title={view === "archive" ? "Restore" : "Archive"}
                  disabled={archive.pending === item.id}
                  onClick={() =>
                    void archive.update(item.id, view === "active")
                  }
                >
                  {view === "archive" ? (
                    <ArchiveRestore size={16} />
                  ) : (
                    <Archive size={16} />
                  )}
                </button>}
              </article>
            ))}
            {items.length > visibleCount && <button className="button button-ghost newsletter-load-more" onClick={() => setVisibleCount((count) => count + 30)}>Show 30 more · {items.length - visibleCount} remaining</button>}
            {!items.length && (
              <Panel className="empty-state">
                <CheckCircle2 size={28} />
                <h2>
                  {query || selectedSources.length ? "No stories match these filters" : view === "archive"
                    ? "No archived newsletter stories"
                    : view === "history"
                      ? "No earlier stories yet"
                      : "You’re all caught up"}
                </h2>
                <p>
                  {query || selectedSources.length ? "Try another newsletter, a different search, or clear the filters above." : view === "archive"
                    ? "Archived stories remain stored locally without changing Gmail."
                    : view === "history"
                      ? "Stories outside the current reading window remain here as the mailbox backfill is processed."
                      : "No extracted newsletter stories remain in the active queue."}
                </p>
              </Panel>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const contentStages: ContentStage[] = ["Idea", "Research", "Drafting", "Production", "Scheduled", "Published"];
const contentStreams: ContentStream[] = ["Personal LinkedIns", "Spej Authority-building content"];

function ContentView({
  items,
  setItems,
  campaigns,
  addTask,
  initialFocus,
  defaultOwner,
}: {
  initialFocus?: string | number;
  defaultOwner: string;
  items: ContentItem[];
  setItems: React.Dispatch<React.SetStateAction<ContentItem[]>>;
  campaigns: CampaignItem[];
  addTask: (input: { title: string; description: string; due?: string; category: TaskCategory; relatedType?: Task["relatedType"]; relatedId?: string; owner?: string }) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingContentId, setEditingContentId] = useState<string | null>(null);
  const [contentError, setContentError] = useState("");
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<ContentItem["format"]>("YouTube");
  const [activeStream, setActiveStream] = useState<ContentStream>(items.find((item) => item.id === initialFocus)?.stream || "Spej Authority-building content");
  const [draftStream, setDraftStream] = useState<ContentStream>("Spej Authority-building content");
  const [category, setCategory] = useState<ContentCategory>("Unassigned");
  const [categoryFilter, setCategoryFilter] = useState<ContentCategory | "All">("All");
  const [contentQuery, setContentQuery] = useState("");
  const [stage, setStage] = useState<ContentStage>("Idea");
  const [publishDate, setPublishDate] = useState("");
  const [angle, setAngle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [owner, setOwner] = useState(defaultOwner);
  const [approver, setApprover] = useState("");
  const [reviewStatus, setReviewStatus] = useState<ContentItem["reviewStatus"]>("Not Requested");
  const [reviewDue, setReviewDue] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [visibleByStage, setVisibleByStage] = useState<Record<ContentStage, number>>({
    Idea: 18,
    Research: 18,
    Drafting: 18,
    Production: 18,
    Scheduled: 18,
    Published: 18,
  });
  const openContent = (item?: ContentItem, nextStage?: ContentStage) => {
    setEditingContentId(item?.id || null); setContentError("");
    setTitle(item?.title || ""); setFormat(item?.format || (activeStream === "Personal LinkedIns" ? "LinkedIn" : "YouTube"));
    setDraftStream(item?.stream || activeStream); setCategory(item?.pillar || "Unassigned");
    setStage(nextStage || item?.stage || "Idea"); setPublishDate(item?.publishDate || "");
    setAngle(item?.angle || ""); setSourceUrl(item?.sourceUrl || ""); setOwner(item?.owner || defaultOwner);
    setApprover(item?.approver === "Unassigned" ? "" : item?.approver || ""); setReviewStatus(item?.reviewStatus || "Not Requested");
    setReviewDue(item?.reviewDue || ""); setCampaignId(item?.campaignId || ""); setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    if (!owner.trim()) return setContentError("Choose a content owner before saving.");
    const issue = contentPublicationIssue(stage, publishDate);
    if (issue) return setContentError(issue);
    setItems((values) => {
      const existing = values.find((item) => item.id === editingContentId);
      const saved: ContentItem = {
        ...existing, id: existing?.id || crypto.randomUUID(), title: title.trim(), format, stage, publishDate,
        angle: angle.trim(), pillar: normalizeContentCategory(draftStream, category, angle), stream: draftStream,
        owner: owner.trim(), ownerProfileId: getTeamViewProfile(owner.trim())?.id ?? (existing?.owner === owner.trim() ? existing.ownerProfileId : undefined),
        approver: approver.trim(), approverProfileId: getTeamViewProfile(approver.trim())?.id ?? (existing?.approver === approver.trim() ? existing.approverProfileId : undefined), reviewStatus, reviewDue, campaignId: campaignId || undefined,
        sourceUrl: sourceUrl.trim() || undefined, createdAt: existing?.createdAt || new Date().toISOString(),
      };
      return existing ? values.map((item) => item.id === existing.id ? saved : item) : [saved, ...values];
    });
    setActiveStream(draftStream); setCategoryFilter("All"); setShowForm(false); setEditingContentId(null); setContentError("");
  };
  const streamItems = items
    .filter((item) => item.stream === activeStream)
    .map((item) => ({ ...item, pillar: normalizeContentCategory(item.stream, item.pillar, item.angle) }));
  const activeCategories = contentCategoriesForStream(activeStream);
  const draftCategories = contentCategoriesForStream(draftStream);
  const active = streamItems.filter((item) => !["Idea", "Published"].includes(item.stage)).length;
  const scheduled = streamItems.filter((item) => item.stage === "Scheduled").length;
  const pendingReview = streamItems.filter((item) => item.reviewStatus === "Pending Review" || item.reviewStatus === "Changes Requested").length;
  return (
    <div className="view content-view">
      <PageHeading
        eyebrow="Spej media desk"
        title="Content studio"
        description="Create and produce individual media pieces here. Use campaigns to coordinate a launch or series, and linked tasks for scripting, recording, editing, and review deadlines."
        action={<button className="button button-primary" onClick={() => openContent()}><Plus size={16} /> Add content</button>}
      />
      <div className="content-stream-tabs reveal delay-1" role="tablist" aria-label="Content workspaces">{contentStreams.map((value) => <button role="tab" aria-selected={activeStream === value} className={activeStream === value ? "active" : ""} key={value} onClick={() => { setActiveStream(value); setCategoryFilter("All"); }}><span>{value}</span><b>{items.filter((item) => item.stream === value).length}</b><small>{value === "Personal LinkedIns" ? "Your voice, relationships, and whole-person stories" : "Spej’s editorial franchises, research, and enterprise authority"}</small></button>)}</div>
      {showForm && (
        <form className="content-form reveal" onSubmit={submit}>
          <div className="content-form-copy">
            <p className="eyebrow">{editingContentId ? "Edit content" : "New content"}</p>
            <input autoFocus required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Working title or core idea" />
            <textarea value={angle} onChange={(event) => setAngle(event.target.value)} placeholder="What is the Spej angle? Why should the audience care?" />
            <input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="Source or research link (optional)" />
          </div>
          <div className="content-form-fields">
            <label>Format<select value={format} onChange={(event) => setFormat(event.target.value as ContentItem["format"])}><option>YouTube</option><option>Newsletter</option><option>LinkedIn</option><option>Short-form</option><option>Article</option><option>Other</option></select></label>
            <label>Content workspace<select value={draftStream} onChange={(event) => { setDraftStream(event.target.value as ContentStream); setCategory("Unassigned"); }}>{contentStreams.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>{draftStream === "Personal LinkedIns" ? "Whole-person theme" : "Authority content category"}<select value={category} onChange={(event) => setCategory(event.target.value as ContentCategory)}>{draftCategories.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Stage<select value={stage} onChange={(event) => setStage(event.target.value as ContentStage)}>{contentStages.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>{stage === "Published" ? "Actual publish date" : "Planned publish date"}<input type="date" required={stage === "Published" || stage === "Scheduled"} max={stage === "Published" ? localDateValue() : undefined} value={publishDate} onInput={(event) => setPublishDate(event.currentTarget.value)} onChange={(event) => setPublishDate(event.target.value)} /></label>
            <label>Owner<input required value={owner} onChange={(event) => setOwner(event.target.value)} /></label>
            <label>Reviewer<input value={approver} onChange={(event) => setApprover(event.target.value)} /></label>
            <label>Review status<select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value as ContentItem["reviewStatus"])}><option>Not Requested</option><option>Pending Review</option><option>Changes Requested</option><option>Approved</option></select></label>
            <label>Review due<input type="date" value={reviewDue} onChange={(event) => setReviewDue(event.target.value)} /></label>
            <label>Campaign<select value={campaignId} onChange={(event) => setCampaignId(event.target.value)}><option value="">No campaign</option>{campaigns.filter((item) => !item.archivedAt).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          </div>
          {contentError && <p role="alert">{contentError}</p>}
          <div className="form-actions"><button type="button" className="button button-ghost" onClick={() => { setShowForm(false); setEditingContentId(null); }}>Cancel</button><button className="button button-primary">{editingContentId ? "Save content" : "Add to studio"}</button></div>
        </form>
      )}
      <div className="content-summary reveal delay-1">
        <div><b>{active}</b><span>in progress · excluding ideas</span></div>
        <div><b>{streamItems.filter((item) => item.stage === "Idea").length}</b><span>ideas</span></div>
        <div><b>{scheduled}</b><span>scheduled</span></div>
        <div><b>{pendingReview}</b><span>needs review</span></div>
      </div>
      <div className="content-pillar-bar reveal delay-1"><div><p className="eyebrow">{activeStream === "Personal LinkedIns" ? "Whole-person content" : "Spej authority categories"}</p><span>{activeStream === "Personal LinkedIns" ? "Balance expertise with origin stories, human interests, and visible collaboration." : "Use the topic categories from the Spej Enterprise AI content calendar and idea library."}</span></div>{activeStream === "Personal LinkedIns" ? <div className="filter-row"><button className={categoryFilter === "All" ? "active" : ""} onClick={() => setCategoryFilter("All")}>All</button>{activeCategories.map((value) => <button key={value} className={categoryFilter === value ? "active" : ""} onClick={() => setCategoryFilter(value)}>{value} · {streamItems.filter((item) => item.pillar === value).length}</button>)}</div> : <label className="content-category-filter">Filter by category<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as ContentCategory | "All")}><option value="All">All categories · {streamItems.length}</option>{activeCategories.map((value) => <option key={value} value={value}>{value} · {streamItems.filter((item) => item.pillar === value).length}</option>)}</select></label>}</div>
      <div className="content-search-toolbar"><label className="search-box"><Search size={16} aria-hidden="true"/><input aria-label="Search content library" placeholder="Search titles, topics or owners" value={contentQuery} onChange={(event) => setContentQuery(event.target.value)}/></label><span className="view-guidance">Scroll across stages; scroll within a stage to browse its pieces.</span></div>
      <div className="content-board reveal delay-2" tabIndex={0} aria-label="Content production stages">
        {contentStages.filter((column) => initialFocus === undefined || streamItems.some((item) => String(item.id) === String(initialFocus) && item.stage === column)).map((column) => {
          const columnItems = focusedRecords(streamItems, initialFocus).filter((item) => item.stage === column && (initialFocus !== undefined || categoryFilter === "All" || item.pillar === categoryFilter) && (initialFocus !== undefined || contentMatchesSearch(item, contentQuery)));
          const visibleColumnItems = initialFocus === undefined ? columnItems.slice(0, visibleByStage[column]) : columnItems;
          return <section className="content-column" key={column}>
            <header><span>{column}</span><b>{columnItems.length}</b></header>
            <div className="content-column-items" tabIndex={0} role="region" aria-label={`${column} content`}>
              {visibleColumnItems.map((item) => <article className="content-card" key={item.id}>
                <div><Label tone={column === "Published" ? "positive" : column === "Scheduled" ? "brief" : undefined}>{item.format}</Label><button aria-label={`Delete ${item.title}`} title="Delete content item" onClick={() => { if (window.confirm(`Delete “${item.title}”? This permanently removes the content record. Linked tasks are kept.`)) setItems((values) => values.filter((value) => value.id !== item.id)); }}><Trash2 size={13} /></button></div>
                <h3>{item.title}</h3>
                <div className="record-card-tools"><button onClick={() => openContent(item)} aria-label={`Edit content: ${item.title}`}>Edit details</button><button onClick={() => addTask({ title: `Produce: ${item.title}`, description: item.angle || "Define the next production step.", due: item.reviewDue || item.publishDate, category: "Content", relatedType: "content", relatedId: item.id, owner: item.owner })}>Production task</button></div>
                <span className="content-pillar">{item.pillar}</span>
                {item.angle && <p>{item.angle}</p>}
                {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={11} /> Research source</a>}
                <div className="content-ownership"><span>{item.owner || "Unassigned"}</span>{item.campaignId && <span>{campaigns.find((campaign) => campaign.id === item.campaignId)?.name || "Campaign"}</span>}</div>
                {item.publishDate && <small><Clock3 size={11} /> {formatTaskDue(item.publishDate)}</small>}
                <div className="content-card-controls"><label>Stage<select aria-label={`Move ${item.title}`} value={item.stage} onChange={(event) => { const nextStage = event.target.value as ContentStage; if (nextStage === "Published" || contentPublicationIssue(nextStage, item.publishDate)) openContent(item, nextStage); else setItems((values) => values.map((value) => value.id === item.id ? { ...value, stage: nextStage } : value)); }}>{contentStages.map((value) => <option key={value}>{value}</option>)}</select></label><label>Review<select aria-label={`Review status for ${item.title}`} value={item.reviewStatus || "Not Requested"} onChange={(event) => setItems((values) => values.map((value) => value.id === item.id ? { ...value, reviewStatus: event.target.value as ContentItem["reviewStatus"] } : value))}><option>Not Requested</option><option>Pending Review</option><option>Changes Requested</option><option>Approved</option></select></label></div>
                {(item.reviewStatus === "Pending Review" || item.reviewStatus === "Changes Requested") && <div className="content-review-line"><span>{item.reviewStatus} · {item.approver || "Unassigned"}</span><small>{item.reviewDue ? formatTaskDue(item.reviewDue) : "No review date"}</small></div>}
              </article>)}
              {!columnItems.length && <p className="content-empty">Nothing here yet</p>}
              {visibleColumnItems.length < columnItems.length && <button className="content-load-more" onClick={() => setVisibleByStage((value) => ({ ...value, [column]: value[column] + 18 }))}>Show 18 more <span>{columnItems.length - visibleColumnItems.length} remaining</span></button>}
            </div>
          </section>;
        })}
      </div>
    </div>
  );
}

const taskCategories: TaskCategory[] = ["Sales", "Partnerships", "Marketing", "5-3-1", "Content", "Project Work", "Client Delivery", "Operations", "General"];

function TasksView({
  tasks,
  setTasks,
  projects,
  defaultOwner,
  relatedNames,
  goTo,
  openAccessSettings,
  initialFocus,
  viewer,
  workspace = "gtm",
}: {
  initialFocus?: string | number;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  projects: ProjectItem[];
  defaultOwner: string;
  relatedNames: Record<string, string>;
  goTo: (tab: Tab, recordId?: string | number) => void;
  openAccessSettings: () => void;
  viewer: TeamViewProfile;
  workspace?: "gtm" | "delivery";
}) {
  const isDelivery = workspace === "delivery";
  const viewerAccess = getPreviewAccessPolicy(viewer);
  const scopedCategories: TaskCategory[] = isDelivery ? ["Project Work", "Client Delivery"] : taskCategories.filter((value) => value !== "Project Work" && value !== "Client Delivery");
  const defaultCategory: TaskCategory = isDelivery ? "Project Work" : "General";
  const preferredWorkspaceId: TaskWorkspaceId = isDelivery ? "project-management" : "gtm";
  const defaultWorkspaceId: TaskWorkspaceId = viewerAccess?.workspaceIds.includes(preferredWorkspaceId)
    ? preferredWorkspaceId
    : viewerAccess?.workspaceIds[0] || preferredWorkspaceId;
  const [showForm, setShowForm] = useState(false);
  const [showAllShared, setShowAllShared] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [due, setDue] = useState(localDateValue);
  const [recurrence, setRecurrence] = useState("One-time");
  const [priority, setPriority] = useState<Task["priority"]>("Normal");
  const [owner, setOwner] = useState(defaultOwner);
  const [status, setStatus] = useState<Task["status"]>("Not Started");
  const [effort, setEffort] = useState<Task["effort"]>("Small");
  const [visibility, setVisibility] = useState<TaskVisibility>("Private");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<TaskWorkspaceId>(defaultWorkspaceId);
  const [relatedProjectId, setRelatedProjectId] = useState("");
  const [parentId, setParentId] = useState("");
  const [category, setCategory] = useState<TaskCategory>(defaultCategory);
  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | "All">("All");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<NonNullable<Task["status"]> | "All">("All");
  const [sortMode, setSortMode] = useState<TaskSortMode>("due-asc");
  const [groupMode, setGroupMode] = useState<"category" | "owner" | "none">("category");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const editingTask = editingTaskId ? tasks.find((task) => String(task.id) === editingTaskId) : undefined;
  const canChangeEditingTaskAccess = !editingTask || previewOwnsTask(editingTask, viewer);
  const workspaceOptions = TASK_WORKSPACES.filter((workspaceId) =>
    viewerAccess?.workspaceIds.includes(workspaceId) || ((editingTaskId || parentId) && workspaceId === selectedWorkspaceId),
  );
  const privateTaskNeedsOwner = !parentId && visibility === "Private" && owner === "Unassigned";
  const projectOptions = projects.filter((project) => !project.archivedAt && project.workArea !== "GTM");
  const projectLinkIssue = projectTaskLinkIssue({ projectWorkspace: isDelivery, parentId, projectId: relatedProjectId, projects });
  const taskFormBlocked = privateTaskNeedsOwner || Boolean(projectLinkIssue);
  const resetForm = () => {
    setEditingTaskId(null);
    setTitle("");
    setDescription("");
    setDue(localDateValue());
    setRecurrence("One-time");
    setPriority("Normal");
    setOwner(defaultOwner);
    setStatus("Not Started");
    setEffort("Small");
    setVisibility("Private");
    setSelectedWorkspaceId(defaultWorkspaceId);
    setRelatedProjectId("");
    setParentId("");
    setCategory(defaultCategory);
    setShowForm(false);
  };
  const openCreate = (parent?: Task) => {
    setEditingTaskId(null);
    setTitle("");
    setDescription("");
    setDue(parent?.due || localDateValue());
    setRecurrence("One-time");
    setPriority(parent?.priority || "Normal");
    setOwner(parent?.owner || defaultOwner);
    setStatus("Not Started");
    setEffort(parent?.effort || "Small");
    setVisibility(parent ? taskVisibility(parent) : "Private");
    setSelectedWorkspaceId(parent ? taskWorkspaceId(parent, projects) : defaultWorkspaceId);
    setRelatedProjectId(parent?.relatedType === "project" ? parent.relatedId || "" : "");
    setParentId(parent ? String(parent.id) : "");
    setCategory(parent?.category || defaultCategory);
    setShowForm(true);
  };
  const openEdit = (task: Task) => {
    setEditingTaskId(String(task.id)); setTitle(task.title); setDescription(task.description); setDue(task.due);
    setRecurrence(task.recurrence); setPriority(task.priority); setOwner(task.owner || defaultOwner); setStatus(task.status || "Not Started");
    setEffort(task.effort || "Small"); setVisibility(taskVisibility(task)); setSelectedWorkspaceId(taskWorkspaceId(task, projects)); setRelatedProjectId(task.relatedType === "project" ? task.relatedId || "" : ""); setParentId(task.parentId === undefined ? "" : String(task.parentId)); setCategory(task.category || "General"); setShowForm(true);
    window.scrollTo({top:0, behavior:"smooth"});
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !due || privateTaskNeedsOwner || projectLinkIssue) return;
    const parent = tasks.find((task) => !task.done && String(task.id) === parentId && task.parentId === undefined && previewCanViewTask(task, viewer, projects));
    if (!parent && !viewerAccess?.workspaceIds.includes(selectedWorkspaceId)) return;
    setTasks((values) => {
      const existing = editingTaskId ? values.find((item) => String(item.id) === editingTaskId) : undefined;
      if (editingTaskId && (!existing || existing.done)) return values;
      const canChangeAccess = !existing || previewOwnsTask(existing, viewer);
      const accessInput = canChangeAccess ? {
        ...existing,
        owner,
        ownerProfileId: getTeamViewProfile(owner)?.id,
        visibility,
        workspaceId: selectedWorkspaceId,
      } : existing;
      const relationship = parent
        ? inheritedTaskRelationship(parent, existing)
        : isDelivery
          ? { relatedType: "project" as const, relatedId: relatedProjectId }
          : inheritedTaskRelationship(undefined, existing);
      const record: Task = {
        ...existing,
        id: existing?.id || crypto.randomUUID(),
        title: title.trim(),
        description: description.trim() || "No additional details.",
        due,
        recurrence,
        priority,
        status,
        effort,
        parentId: parent?.id,
        category,
        ...relationship,
        ...inheritedTaskAccess(parent, accessInput),
        done: false,
        createdAt: existing?.createdAt || new Date().toISOString(),
      };
      const next = existing ? values.map((item) => item.id === existing.id ? record : item) : [record, ...values];
      return normalizeTaskHierarchy(next);
    });
    if (parent) setCollapsed((values) => { const next = new Set(values); next.delete(String(parent.id)); return next; });
    resetForm();
  };
  const openSubtasksFor = (task: Task) => tasks.filter((item) => !item.done && String(item.parentId) === String(task.id));
  const complete = (task: Task) => {
    if (openSubtasksFor(task).length) return;
    setTasks((values) => completeTaskItems(values, task.id, { expectedDue: task.due }));
  };
  const remove = (task: Task) => { if (window.confirm(`Delete “${task.title}”? This permanently removes the task. Any subtasks are kept as separate tasks.`)) setTasks((values) => removeTaskAndDetachChildren(values, task.id)); };
  const accessibleTasks = tasks.filter((task) => previewCanViewTask(task, viewer, projects));
  const focusedFamily = focusedTaskIds(accessibleTasks, initialFocus);
  const workspaceTasks = initialFocus !== undefined || showAllShared
    ? accessibleTasks
    : isDelivery
      ? accessibleTasks.filter((task) => taskBelongsToWorkspace(task, projects, "delivery"))
      : accessibleTasks.filter((task) => taskBelongsToWorkspace(task, projects, "gtm"));
  const allOpen = workspaceTasks.filter((task) => !task.done);
  const openIds = new Set(allOpen.map((task) => String(task.id)));
  const isTopLevel = (task: Task) => task.parentId === undefined || !openIds.has(String(task.parentId));
  const categoryMatches = (task: Task) => categoryFilter === "All" || (task.category || "General") === categoryFilter;
  const ownerMatches = (task: Task) => ownerFilter === "All" || (task.owner || "Unassigned") === ownerFilter;
  const statusMatches = (task: Task) => statusFilter === "All" || (task.status || "Not Started") === statusFilter;
  const taskMatches = (task: Task) => focusedFamily ? focusedFamily.has(String(task.id)) : categoryMatches(task) && ownerMatches(task) && statusMatches(task);
  const childrenFor = (task: Task) => allOpen.filter((item) => String(item.parentId) === String(task.id));
  const visibleParents = allOpen.filter(isTopLevel).filter((task) => taskMatches(task) || childrenFor(task).some(taskMatches));
  const groupDue = (task: Task, latest: boolean) => {
    const values = [task, ...childrenFor(task)].map((item) => taskDueValue(item.due)).filter(Number.isFinite);
    if (!values.length) return Number.POSITIVE_INFINITY;
    return latest ? Math.max(...values) : Math.min(...values);
  };
  const groupPriority = (task: Task, lowest: boolean) => {
    const values = [task, ...childrenFor(task)].map((item) => taskPriorityRank(item.priority));
    return lowest ? Math.max(...values) : Math.min(...values);
  };
  const open = [...visibleParents].sort((left, right) => {
    if (sortMode === "created-desc") return (right.createdAt || "").localeCompare(left.createdAt || "") || left.title.localeCompare(right.title);
    if (sortMode === "due-asc" || sortMode === "due-desc") {
      const delta = groupDue(left, sortMode === "due-desc") - groupDue(right, sortMode === "due-desc");
      return (sortMode === "due-asc" ? delta : -delta) || left.title.localeCompare(right.title);
    }
    const delta = groupPriority(left, sortMode === "priority-asc") - groupPriority(right, sortMode === "priority-asc");
    return (sortMode === "priority-desc" ? delta : -delta) || taskDueValue(left.due) - taskDueValue(right.due) || left.title.localeCompare(right.title);
  });
  const openTaskGroups = open.reduce<Array<{ key: string; label: string; tasks: Task[] }>>((groups, task) => {
    const label = groupMode === "category"
      ? task.category || "General"
      : groupMode === "owner"
        ? task.owner || "Unassigned"
        : "All work";
    const key = groupMode === "none" ? "all" : label;
    const existing = groups.find((group) => group.key === key);
    if (existing) existing.tasks.push(task);
    else groups.push({ key, label, tasks: [task] });
    return groups;
  }, []);
  const completed = workspaceTasks
    .filter((task) => task.done && (!focusedFamily || focusedFamily.has(String(task.id))))
    .sort((a, b) =>
      (b.completedAt || b.createdAt || "").localeCompare(
        a.completedAt || a.createdAt || "",
      ),
    );
  const completedToday = workspaceTasks.filter(
    (task) =>
      task.done &&
      task.completedAt &&
      localDateValue(new Date(task.completedAt)) === localDateValue(),
  );
  const dueToday = allOpen.filter((task) => isTaskDueToday(task.due));
  const openSubtaskCount = allOpen.filter((task) => task.parentId !== undefined && openIds.has(String(task.parentId))).length;
  const todayTotal = dueToday.length + completedToday.length;
  const parentOptions = allOpen.filter((task) => isTopLevel(task) && String(task.id) !== editingTaskId);
  const owners = Array.from(new Set([...TEAM_VIEW_PROFILES.map((profile) => profile.displayName), "Unassigned", ...allOpen.map((task) => task.owner || "Unassigned")])).sort();
  const toggleCollapsed = (task: Task) => setCollapsed((values) => {
    const next = new Set(values); const key = String(task.id);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const priorityClass = (value: Task["priority"]) => `task-priority priority-${value.toLowerCase()}`;
  const renderTaskRow = (task: Task, isSubtask = false) => {
    const allChildren = childrenFor(task);
    const visibleChildren = taskMatches(task) ? allChildren : allChildren.filter(taskMatches);
    const remaining = allChildren.length;
    const totalChildren = workspaceTasks.filter((item) => String(item.parentId) === String(task.id) && item.seriesId === undefined).length;
    const completedChildren = totalChildren - remaining;
    const isCollapsed = collapsed.has(String(task.id));
    const canEdit = previewCanEditTask(task, viewer, projects);
    const canChangeAccess = previewOwnsTask(task, viewer);
    return <div className={classNames("task-group", isSubtask && "task-subtask-group")} key={task.id}>
      <div className={classNames("task-row", isSubtask && "task-subtask-row", initialFocus !== undefined && String(initialFocus) === String(task.id) && "task-focused")}>
        <div className="task-leading">
          <button className="round-check" disabled={!canEdit || remaining > 0} title={!canEdit ? "Read-only in this access preview" : remaining ? "Complete the open subtasks first" : undefined} aria-label={!canEdit ? `${task.title} is read-only` : remaining ? `${task.title} has ${remaining} open subtasks` : task.recurrence === "One-time" ? `Complete ${task.title}` : `Complete and reschedule ${task.title}`} onClick={() => complete(task)}><Check size={14}/></button>
          {!isSubtask && totalChildren > 0 && <button className={classNames("task-expand", !isCollapsed && "expanded")} aria-label={`${isCollapsed ? "Show" : "Hide"} subtasks for ${task.title}`} onClick={() => toggleCollapsed(task)}><ChevronDown size={15}/></button>}
        </div>
        <div className="task-copy">
          <span><Label tone="brief">{taskWorkspaceLabel(task, projects)}</Label><Label tone={task.category === "5-3-1" ? "brief" : undefined}>{task.category || "General"}</Label><Label tone={taskVisibility(task) === "Company" ? "positive" : taskVisibility(task) === "Workspace" ? "watch" : undefined}>{taskVisibilityLabel(task)}</Label>{!isSubtask && totalChildren > 0 && <Label tone="brief">Task group</Label>}{!isSubtask && totalChildren > 0 && <Label tone={remaining ? "watch" : "positive"}>{completedChildren}/{totalChildren} subtasks</Label>}{isSubtask && <small className="subtask-kicker">Subtask</small>}</span>
          <b>{task.title}</b>
          <p>{task.description}</p>
          <div className="task-meta"><span>Owner · {task.owner || "Unassigned"}</span><span>{task.status || "Not Started"}</span><span>{task.effort || "Small"}</span>{task.recurrence !== "One-time" && <span>{task.recurrence}</span>}{!canEdit && <span>Read-only preview</span>}{task.relatedType && task.relatedId && <button onClick={() => goTo(task.relatedType === "account" || task.relatedType === "contact" ? "relationships" : task.relatedType === "opportunity" ? "pipeline" : task.relatedType === "partnership" ? "partnerships" : task.relatedType === "project" ? (projects.find((project) => project.id === task.relatedId)?.workArea === "GTM" ? "gtm-initiatives" : "projects") : task.relatedType === "campaign" ? "campaigns" : "content", task.relatedId)}>Linked: {relatedNames[`${task.relatedType}:${task.relatedId}`] || task.relatedType}</button>}</div>
          {canEdit && <button className="add-subtask" aria-label={`Edit task: ${task.title}`} onClick={() => openEdit(task)}>Edit details / deadline</button>}
          {!isSubtask && canEdit && <button className="add-subtask" onClick={() => openCreate(task)}><Plus size={12}/> Add subtask</button>}
        </div>
        <select disabled={!canChangeAccess || (isSubtask && taskVisibility(task) === "Private")} aria-label={`Owner for ${task.title}`} className="task-owner" value={task.owner || "Unassigned"} onChange={(event) => setTasks((values) => normalizeTaskHierarchy(values.map((value) => value.id === task.id ? { ...value, owner: event.target.value, ownerProfileId: getTeamViewProfile(event.target.value)?.id } : value)))}>{owners.map((value) => <option key={value}>{value}</option>)}</select>
        <select disabled={!canEdit} aria-label={`Status for ${task.title}`} className={`task-status status-${(task.status || "Not Started").toLowerCase().replaceAll(" ", "-")}`} value={task.status || "Not Started"} onChange={(event) => setTasks((values) => values.map((value) => value.id === task.id ? { ...value, status: event.target.value as Task["status"] } : value))}>{WORK_STATUSES.map((value) => <option key={value}>{value}</option>)}</select>
        <select
          disabled={!canEdit}
          aria-label={`Priority for ${task.title}`}
          className={priorityClass(task.priority)}
          value={task.priority}
          onChange={(event) => setTasks((values) => values.map((value) => value.id === task.id ? { ...value, priority: event.target.value as Task["priority"] } : value))}
        >
          {TASK_PRIORITIES.map((value) => <option key={value}>{value}</option>)}
        </select>
        <Label tone={isTaskDueToday(task.due) ? "high" : undefined}>{formatTaskDue(task.due)}</Label>
        {canEdit ? <button className="more-button" aria-label={`Delete ${task.title}`} title={isSubtask ? "Delete subtask" : "Delete task; subtasks become top-level tasks"} onClick={() => remove(task)}><Trash2 size={15}/></button> : <span/>}
      </div>
      {!isSubtask && !isCollapsed && visibleChildren.length > 0 && <div className="task-subtasks">{sortTaskItems(visibleChildren, sortMode).map((child) => renderTaskRow(child, true))}</div>}
    </div>;
  };
  return (
    <div className="view">
      <PageHeading
        eyebrow={isDelivery ? "Project execution" : "GTM execution"}
        title={isDelivery ? "Project work" : "GTM Work"}
        description={isDelivery ? "Project commitments across every work type, with owners, priorities, subtasks, and separate deadlines. A project link—not the task category—is the authoritative connection to the portfolio." : "Dated commitments across sales, partnerships, marketing, 5-3-1, and media production. Link work to the relevant account, deal, content, or campaign."}
        action={
          <button
            className="button button-primary"
            onClick={() => openCreate()}
          >
            <Plus size={16} /> Add task
          </button>
        }
      />
      <div className="task-access-strip reveal"><ShieldCheck size={15}/><span><b>{viewer.displayName}&apos;s access preview</b> · {viewerAccess?.role || "Member"} · {(viewerAccess ? previewWorkspaceLabels(viewerAccess) : []).join(" · ") || "No workspace grants"}</span><button type="button" onClick={openAccessSettings}>Access model <ArrowRight size={13}/></button></div>
      {showForm && (
        <form className="task-form reveal" onSubmit={submit}>
          <div>
            <p className="eyebrow">{editingTaskId ? "Edit task" : parentId ? "New subtask" : "New task"}</p>
            <label>
              Task title
              <input
                autoFocus
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="What needs to get done?"
              />
            </label>
            <label>
              Description (optional)
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Add context, acceptance criteria, or a useful handoff note"
              />
            </label>
          </div>
          <div className="task-fields">
            <label>
              Due
              <input
                type="date"
                required
                value={due}
                onInput={(event) => setDue(event.currentTarget.value)}
                onChange={(event) => setDue(event.target.value)}
              />
            </label>
            <label>
              Category
              <select value={category} onChange={(event) => setCategory(event.target.value as TaskCategory)}>
                {(showAllShared || initialFocus !== undefined ? taskCategories : scopedCategories).map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            {isDelivery && <label>
              Project
              <select required disabled={Boolean(parentId)} value={relatedProjectId} onChange={(event) => { setRelatedProjectId(event.target.value); if (event.target.value) setSelectedWorkspaceId("project-management"); }}>
                <option value="">Select a project</option>
                {projectOptions.map((project) => <option key={project.id} value={project.id} disabled={["Complete", "Paused", "Stopped"].includes(project.operationalStatus)}>{project.name}{["Complete", "Paused", "Stopped"].includes(project.operationalStatus) ? ` · ${project.operationalStatus}` : ""}</option>)}
              </select>
            </label>}
            <label>
              Workspace
              <select disabled={isDelivery || Boolean(parentId) || !canChangeEditingTaskAccess} value={selectedWorkspaceId} onChange={(event) => setSelectedWorkspaceId(event.target.value as TaskWorkspaceId)}>
                {workspaceOptions.map((workspaceId) => <option key={workspaceId} value={workspaceId}>{workspaceId === "gtm" ? "GTM" : workspaceId === "project-management" ? "Projects" : "Company"}</option>)}
              </select>
            </label>
            <label>
              Who can see it
              <select disabled={Boolean(parentId) || !canChangeEditingTaskAccess} value={visibility} onChange={(event) => setVisibility(event.target.value as TaskVisibility)}>
                {TASK_VISIBILITIES.map((value) => <option key={value} value={value}>{value === "Private" ? "Owner only" : value === "Company" ? "Company-wide" : "Workspace members"}</option>)}
              </select>
            </label>
            <label>
              Priority
              <select value={priority} onChange={(event) => setPriority(event.target.value as Task["priority"])}>
                {TASK_PRIORITIES.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label>
              Owner
              <select disabled={!canChangeEditingTaskAccess || (Boolean(parentId) && visibility === "Private")} value={owner} onChange={(event) => setOwner(event.target.value)}>
                {owners.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label>
              Status
              <select value={status} onChange={(event) => setStatus(event.target.value as Task["status"])}>
                {WORK_STATUSES.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label>
              Effort
              <select value={effort} onChange={(event) => setEffort(event.target.value as Task["effort"])}>
                {WORK_EFFORTS.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label>
              Repeats
              <select
                value={recurrence}
                onChange={(event) => setRecurrence(event.target.value)}
              >
                <option>One-time</option>
                <option>Daily</option>
                <option>Weekly</option>
                <option>Monthly</option>
              </select>
            </label>
            <label>
              Parent task
              <select disabled={!canChangeEditingTaskAccess || Boolean(editingTaskId && tasks.some((task) => String(task.parentId) === editingTaskId))} value={parentId} onChange={(event) => {
                const nextParentId = event.target.value;
                setParentId(nextParentId);
                const nextParent = tasks.find((task) => String(task.id) === nextParentId);
                if (nextParent) {
                  setVisibility(taskVisibility(nextParent));
                  setSelectedWorkspaceId(taskWorkspaceId(nextParent, projects));
                  setRelatedProjectId(nextParent.relatedType === "project" ? nextParent.relatedId || "" : "");
                  if (taskVisibility(nextParent) === "Private") setOwner(nextParent.owner || "Unassigned");
                } else if (editingTask?.relatedType === "project") {
                  setRelatedProjectId(editingTask.relatedId || "");
                }
              }}>
                <option value="">Top-level task</option>
                {parentOptions.map((task) => <option key={task.id} value={String(task.id)}>{task.title}</option>)}
              </select>
            </label>
          </div>
          <div className="form-actions">
            {privateTaskNeedsOwner && <small className="task-form-error">Owner-only work needs an assigned owner.</small>}
            {projectLinkIssue && <small className="task-form-error" role="alert">{projectLinkIssue}</small>}
            {isDelivery && !projectOptions.some((project) => !["Complete", "Paused", "Stopped"].includes(project.operationalStatus)) && <button type="button" className="button button-ghost" onClick={() => { resetForm(); goTo("projects"); }}>Create project first</button>}
            <button
              type="button"
              className="button button-ghost"
              onClick={resetForm}
            >
              Cancel
            </button>
            <button disabled={taskFormBlocked} className="button button-primary">{editingTaskId ? "Save task" : parentId ? "Add subtask" : "Add task"}</button>
          </div>
        </form>
      )}
      <div className="task-summary reveal delay-1">
        <div>
          <b>{allOpen.length}</b>
          <span>open tasks</span>
        </div>
        <div>
          <b>{dueToday.length}</b>
          <span>due today</span>
        </div>
        <div>
          <b>{openSubtaskCount}</b>
          <span>open subtasks</span>
        </div>
        <div className="task-progress">
          <span>
            <i
              style={{
                width: `${todayTotal ? (completedToday.length / todayTotal) * 100 : 0}%`,
              }}
            />
          </span>
          <small>{completedToday.length} completed today</small>
        </div>
      </div>
      <div className="work-controls reveal delay-1">
        <div className="work-category-filter">
          <button className={categoryFilter === "All" ? "active" : ""} onClick={() => setCategoryFilter("All")}>All <span>{allOpen.length}</span></button>
          {(showAllShared || initialFocus !== undefined ? taskCategories : scopedCategories).map((value) => {
            const count = allOpen.filter((task) => (task.category || "General") === value).length;
            return <button key={value} className={categoryFilter === value ? "active" : ""} onClick={() => setCategoryFilter(value)}>{value} <span>{count}</span></button>;
          })}
          <button className={showAllShared ? "active" : ""} onClick={() => { setShowAllShared((value) => !value); setCategoryFilter("All"); }}>{showAllShared ? `Show ${isDelivery ? "project" : "GTM"} workspace` : "All accessible work"}</button>
        </div>
        <div className="work-filter-selects">
          <label><span>Owner</span><select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}><option>All</option>{owners.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option>All</option>{WORK_STATUSES.map((value) => <option key={value}>{value}</option>)}</select></label>
        </div>
        <label className="sort-control"><span>Group</span><select value={groupMode} onChange={(event) => setGroupMode(event.target.value as typeof groupMode)} aria-label="Group work"><option value="category">Category</option><option value="owner">Owner</option><option value="none">No groups</option></select></label>
        <label className="sort-control"><span>Sort</span><select value={sortMode} onChange={(event) => setSortMode(event.target.value as TaskSortMode)} aria-label="Sort work"><option value="due-asc">Due soonest</option><option value="due-desc">Due latest</option><option value="priority-desc">Priority: highest</option><option value="priority-asc">Priority: lowest</option><option value="created-desc">Recently added</option></select></label>
      </div>
      {open.length ? (
        <div className="task-list reveal delay-2">
          <div className="task-list-head task-list-head-hierarchy">
            <span>Task / subtasks</span>
            <span>Owner</span>
            <span>Status</span>
            <span>Priority</span>
            <span>Due</span>
            <span />
          </div>
          {openTaskGroups.map((group) => <section className="task-list-group" key={group.key} aria-label={`${group.label} tasks`}>
            {groupMode !== "none" && <header className="task-list-group-head"><b>{group.label}</b><span>{group.tasks.length}</span></header>}
            {group.tasks.map((task) => renderTaskRow(task))}
          </section>)}
        </div>
      ) : (
        <Panel className="empty-state">
          <ListTodo size={26} />
          <h2>No open {isDelivery ? "project" : "GTM"} tasks</h2>
          <p>Add the first task when there is something worth committing to, or use All accessible work to review explicitly shared work from another workspace.</p>
        </Panel>
      )}
      {completed.length > 0 && (
        <details className="completed-list" open={initialFocus !== undefined || undefined}>
          <summary>{completed.length} completed</summary>
          {completed.map((task) => (
            <div className="completed-row" key={task.id}>
              <CheckCircle2 size={16} />
              <div className="completed-copy">
                <s>{task.title}</s>
                <small>
                  {task.completedAt
                    ? `Completed ${formatDate(task.completedAt)}`
                    : "Completed"}
                  {` · was due ${formatTaskDue(task.due)}`}
                  {task.seriesId !== undefined ? " · recurring occurrence" : ""}
                  {` · ${taskWorkspaceLabel(task, projects)} · ${task.category || "General"} · ${taskVisibilityLabel(task)} · Owner: ${task.owner || "Unassigned"} · ${task.priority} priority · ${task.effort || "Small"}`}
                </small>
              </div>
              {task.seriesId === undefined && previewCanEditTask(task, viewer, projects) && (
                <button
                  aria-label={`Delete completed ${task.title}`}
                  title="Delete completed task"
                  onClick={() =>
                    window.confirm(`Delete completed task “${task.title}”? This permanently removes its history.`) && setTasks((values) =>
                      values.filter((value) => value.id !== task.id),
                    )
                  }
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </details>
      )}
    </div>
  );
}

function TagEditor({
  label,
  help,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  help: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [value, setValue] = useState("");
  const add = () => {
    const cleaned = value.trim();
    if (!cleaned || values.includes(cleaned)) return;
    onChange([...values, cleaned]);
    setValue("");
  };
  return (
    <div className="settings-field">
      <label>
        {label}
        <small>{help}</small>
      </label>
      <div className="tag-input">
        <SettingsInput
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
        />
        <button type="button" onClick={add}>
          <Plus size={15} /> Add
        </button>
      </div>
      <div className="tag-list">
        {values.map((item) => (
          <span key={item}>
            {item}
            <button
              type="button"
              aria-label={`Remove ${item}`}
              onClick={() =>
                onChange(values.filter((valueItem) => valueItem !== item))
              }
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

type SettingsDraft = Omit<SettingsUpdate, "ai" | "industry" | "mentions"> & {
  industry: PublicSettings["industry"];
  mentions: PublicSettings["mentions"];
  ai: NonNullable<SettingsUpdate["ai"]> & {
    keySet: PublicSettings["ai"]["keySet"];
    keySource: PublicSettings["ai"]["keySource"];
  };
};

function settingsDraft(settings: PublicSettings): SettingsDraft {
  return {
    ...settings,
    newsletters: { ...settings.newsletters, googleClientSecret: "" },
    audience: {
      accounts: settings.audience.accounts.map((account) => ({
        ...account,
        credential: "",
      })),
    },
    ai: { ...settings.ai, apiKeys: {}, clearKeys: [] },
  };
}

function SettingsView({
  settings,
  onSaved,
  viewer,
  accessProfiles,
  setAccessProfiles,
  moduleFlags,
  setModuleFlags,
  accessAudit,
  setAccessAudit,
  canManageAccess,
}: {
  settings: PublicSettings;
  onSaved: (settings: PublicSettings) => void;
  viewer: TeamViewProfile;
  accessProfiles: readonly PreviewAccessProfile[];
  setAccessProfiles: React.Dispatch<React.SetStateAction<PreviewAccessProfile[]>>;
  moduleFlags: readonly AccessFeatureOption[];
  setModuleFlags: React.Dispatch<React.SetStateAction<AccessFeatureOption[]>>;
  accessAudit: readonly AccessAuditEvent[];
  setAccessAudit: React.Dispatch<React.SetStateAction<AccessAuditEvent[]>>;
  canManageAccess: boolean;
}) {
  const router = useRouter();
  const [section, setSection] = useState<SettingsSection>("general");
  const [draft, setDraft] = useState<SettingsDraft>(() =>
    settingsDraft(settings),
  );
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [bridgePromptFallback, setBridgePromptFallback] = useState("");
  const [selectedPrincipalId, setSelectedPrincipalId] = useState<string>(viewer.id);
  const selectedAccessProfile = accessProfiles.find((profile) => profile.id === selectedPrincipalId) || accessProfiles[0]!;
  const updateAccessProfile = (profileId: string, update: (profile: PreviewAccessProfile) => PreviewAccessProfile) => setAccessProfiles((profiles) => profiles.map((profile) => profile.id === profileId ? update(profile) : profile));
  const logAccess = (action: string, detail: string) => setAccessAudit((events) => [{ id: crypto.randomUUID(), occurredAt: new Date().toISOString(), action, detail }, ...events].slice(0, 30));
  useEffect(() => {
    window.queueMicrotask(() => {
      const parameters = new URLSearchParams(window.location.search);
      const requested = parameters.get("section") as SettingsSection | null;
      if (
        requested &&
        [
          "general",
          "access",
          "industry",
          "mentions",
          "newsletters",
          "audience",
          "ai",
          "dailyBrief",
          "integrations",
        ].includes(requested)
      )
        setSection(requested);
      const oauthError = parameters.get("error");
      if (oauthError === "oauth-config")
        setNotice(
          "Save a Google OAuth client ID and secret before choosing an account.",
        );
      if (oauthError === "oauth-client-id")
        setNotice(GOOGLE_OAUTH_CLIENT_ID_ERROR);
      if (oauthError === "oauth-state")
        setNotice(
          "The Google connection expired before it completed. Please try again.",
        );
      if (oauthError === "oauth-exchange")
        setNotice(
          "Google could not complete the connection. Check the OAuth client and redirect URI, then try again.",
        );
      if (parameters.get("connected") === "1")
        setNotice(
          "Saved. The newsletter Gmail account is connected read-only.",
        );
    });
  }, []);
  const save = async () => {
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Could not save settings.");
      const saved = payload as PublicSettings;
      setDraft(settingsDraft(saved));
      onSaved(saved);
      setNotice("Saved. Live pages will use this configuration immediately.");
      return true;
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not save settings.",
      );
      return false;
    } finally {
      setSaving(false);
    }
  };
  const connectGmail = async () => {
    if (
      !draft.newsletters.googleClientId.trim() ||
      (!draft.newsletters.googleClientSecretSet &&
        !draft.newsletters.googleClientSecret?.trim())
    ) {
      setNotice("Add the Google OAuth client ID and secret first.");
      return;
    }
    if (!isGoogleOAuthClientId(draft.newsletters.googleClientId)) {
      setNotice(GOOGLE_OAUTH_CLIENT_ID_ERROR);
      return;
    }
    if (await save()) router.push("/api/auth/google/start");
  };
  const addSource = () =>
    setDraft((value) => ({
      ...value,
      industry: {
        ...value.industry,
        sources: [
          ...value.industry.sources,
          { id: crypto.randomUUID(), name: "", url: "" },
        ],
      },
    }));
  const addAccount = (platform: AudiencePlatform) =>
    setDraft((value) => ({
      ...value,
      audience: {
        accounts: [
          ...value.audience.accounts,
          {
            id: crypto.randomUUID(),
            platform,
            label: platform[0].toUpperCase() + platform.slice(1),
            username: "",
            profileUrl: "",
            accountId: "",
            credential: "",
            credentialSet: false,
          },
        ],
      },
    }));
  const addMentionProfile = () =>
    setDraft((value) => ({
      ...value,
      mentions: {
        ...value.mentions,
        profiles: [
          ...(value.mentions.profiles ?? []),
          {
            id: crypto.randomUUID(),
            label: "New identity",
            type: "custom",
            enabled: true,
            terms: ["New identity"],
            standaloneCompanyTerms: [],
            websites: [],
            officialProfileUrls: [],
            identityAnchors: [],
            negativeTerms: [],
          },
        ],
      },
    }));
  const changeSection = (nextSection: SettingsSection) => {
    setSection(nextSection);
    const url = new URL(window.location.href);
    url.searchParams.set("section", nextSection);
    window.history.replaceState({}, "", url);
  };
  const copyBridgePrompt = async () => {
    if (!draft.dailyBrief.sourceLabels.length) {
      setNotice(
        "Add at least one Daily Brief source before copying the bridge prompt.",
      );
      return;
    }
    const endpoint = `${window.location.origin}/api/brief`;
    const prompt = [
      "Create a read-only recurring Daily Brief sync for my local Control Center.",
      `Use only these installed connector sources: ${draft.dailyBrief.sourceLabels.join(", ")}.`,
      `Look back ${draft.dailyBrief.lookbackDays} days and return only actionable messages, meetings, deadlines, decisions, and genuinely useful context.`,
      "Minimize private content: concise titles and summaries only; never include credentials or full message bodies.",
      `POST the result to ${endpoint} as JSON: {\"sources\":[{\"source\":\"each configured source label\",\"status\":\"success|error\",\"error\":\"required only on error\"}],\"items\":[{\"id\":\"required stable provider ID\",\"source\":\"one successful source label\",\"title\":\"...\",\"summary\":\"...\",\"kind\":\"action|meeting|message|info\",\"occurredAt\":\"ISO date\",\"dueAt\":\"optional ISO date\",\"url\":\"optional source URL\"}]}.`,
      "Include every configured source in sources, even when a successful source has zero items. The items for each successful source must be its complete current set; missing prior items will be removed. Mark unreadable connectors as error and omit their items so the dashboard preserves the last successful set while showing the failure. Keep this operation read-only in every connected app.",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(prompt);
      setBridgePromptFallback("");
      setNotice(
        "Saved to clipboard. Paste the bridge prompt into Codex to create the connector sync.",
      );
    } catch {
      setBridgePromptFallback(prompt);
      setNotice(
        "Clipboard access was blocked. Select the complete prompt shown below and copy it manually.",
      );
    }
  };
  const sections: Array<{
    id: SettingsSection;
    label: string;
    icon: typeof Activity;
  }> = [
    { id: "general", label: "General", icon: Settings2 },
    ...(canManageAccess ? [{ id: "access" as const, label: "People & access", icon: ShieldCheck }] : []),
    { id: "dailyBrief", label: "Daily brief", icon: LayoutDashboard },
    { id: "industry", label: "Industry", icon: Globe2 },
    { id: "mentions", label: "Mentions", icon: AtSign },
    { id: "newsletters", label: "Newsletters", icon: Mail },
    { id: "audience", label: "Audience", icon: Users },
    { id: "ai", label: "AI curation", icon: Sparkles },
    { id: "integrations", label: "Integrations", icon: Cable },
  ];
  return (
    <div className="view">
      <PageHeading
        eyebrow="Administration"
        title="Settings"
        description="Manage this demo's sources and preferences. Company identity, access, connectors, feature controls, audit, and operations use the existing Spej OS services in production."
        action={
          <button
            className="button button-primary"
            onClick={save}
            disabled={saving}
          >
            {saving ? (
              <RefreshCw className="spin" size={15} />
            ) : (
              <Check size={15} />
            )}{" "}
            Save settings
          </button>
        }
      />
      {notice && (
        <div
          className={classNames(
            "save-notice",
            notice.startsWith("Saved") && "success",
          )}
          role="status"
          aria-live="polite"
        >
          {notice}
        </div>
      )}
      <div className="settings-layout reveal delay-1">
        <aside className="settings-nav">
          {sections.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={section === item.id ? "active" : ""}
                onClick={() => changeSection(item.id)}
              >
                <Icon size={16} />
                <span>{item.label}</span>
                <ArrowRight size={14} />
              </button>
            );
          })}
          <div className="settings-security">
            <ShieldCheck size={18} />
            <b>Secrets stay server-side</b>
            <p>Saved credentials are never returned to the browser.</p>
          </div>
        </aside>
        <div className="settings-content" key={section}>
          {section === "dailyBrief" && (
            <Panel className="settings-panel">
              <div className="settings-title"><LayoutDashboard /><div>
                <p className="eyebrow">Your daily snapshot</p><h2>Choose what My Work shows</h2>
                <p>Bring the highest-priority items from your other tabs into one quick brief. Public news and newsletter coverage describing the same development are merged into one evolving topic; verified Spej mentions remain a separate action queue.</p>
              </div></div>
              <div className="brief-settings-grid">
                {(["industry", "mentions", "newsletters"] as const).map((category) => (
                  <label className="brief-setting-card" key={category}>
                    <span>{category === "industry" ? <Radio /> : category === "mentions" ? <AtSign /> : <Mail />}</span>
                    <b>{category === "industry" ? "Industry" : category === "mentions" ? "Mentions" : "Newsletters"}</b>
                    <small>{category === "industry" ? "The most important industry developments." : category === "mentions" ? "The mentions most worth your attention." : "Top news from your newsletter reading queue."}</small>
                    <select aria-label={`${category} stories in daily brief`} value={draft.dailyBrief.sections[category]} onChange={(event) => setDraft((value) => ({...value, dailyBrief: {...value.dailyBrief, sections: {...value.dailyBrief.sections, [category]: Number(event.target.value)}}}))}>
                      <option value={0}>Don&apos;t include</option>
                      {[1,2,3,4,5,6,7,8,9,10].map((count) => <option key={count} value={count}>Top {count} {count === 1 ? "story" : "stories"}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <div className="settings-caveat"><Sparkles size={17} /><p>With a configured AI provider, AI priority and summaries flow into this brief automatically. Without one, saved local ranking is used. Repeated public and newsletter coverage is collapsed, archived stories are excluded, and a short queue is never padded with old news.</p></div>
              <div className="bridge-manual"><b>Want private messages and meetings too?</b><p>That is optional. <button type="button" className="text-button" onClick={() => changeSection("integrations")}>Open Integrations</button> to connect a local automation that can read your private apps. It is not needed for the three sections above.</p></div>
            </Panel>
          )}
          {section === "general" && (
            <Panel className="settings-panel">
              <div className="settings-title">
                <Settings2 />
                <div>
                  <p className="eyebrow">General</p>
                  <h2>Workspace identity</h2>
                  <p>
                    This preview shows the proposed Spej OS shell with focused CRM, GTM, and Projects views over shared records.
                  </p>
                </div>
              </div>
              <div className="settings-field">
                <label>
                  Workspace name
                  <small>Used in local configuration and future deployment mapping.</small>
                </label>
                <SettingsInput
                  value={draft.general.workspaceName}
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      general: { workspaceName: event.target.value },
                    }))
                  }
                  placeholder="Spej OS"
                />
              </div>
            </Panel>
          )}
          {section === "access" && !canManageAccess && (
            <Panel className="settings-panel"><div className="empty-state"><LockKeyhole size={28}/><h2>Access administration is unavailable</h2><p>Your current preview role does not include access administration. Select an authorized preview identity or ask a company administrator.</p></div></Panel>
          )}
          {section === "access" && canManageAccess && (
            <Panel className="settings-panel access-settings-panel">
              {selectedAccessProfile.subject.principalType !== "service" && <fieldset className="settings-field"><legend>Available My Work components</legend><p>Administrator-controlled availability. Each person chooses their own layout within these grants and permitted portals. These demo grants reset on reload.</p>{TEAM_HOME_MODULES.map((module) => <label key={module.id}><input type="checkbox" checked={selectedAccessProfile.availableHomeModuleIds?.includes(module.id) || false} onChange={(event) => {
                const enabled = event.target.checked;
                updateAccessProfile(selectedAccessProfile.id, (profile) => ({ ...profile, availableHomeModuleIds: enabled ? [...new Set([...(profile.availableHomeModuleIds || []), module.id])] : (profile.availableHomeModuleIds || []).filter((id) => id !== module.id) }));
                logAccess(enabled ? "Home component available" : "Home component removed", `${selectedAccessProfile.label} · ${module.label}`);
              }}/> {module.label}</label>)}</fieldset>}
              <AccessManagementPanel
                subjectLabel={`${selectedAccessProfile.label} · demo access`}
                subject={selectedAccessProfile.subject}
                roles={PREVIEW_ACCESS_ROLES}
                portals={PREVIEW_ACCESS_PORTALS}
                tenantPolicy={profileTenantPolicy(selectedAccessProfile, moduleFlags)}
                principalOptions={accessProfiles.map((profile): AccessPrincipalOption => ({ id: profile.id, label: profile.label, description: profile.description, principalType: profile.subject.principalType || "person", status: profile.status }))}
                selectedPrincipalId={selectedAccessProfile.id}
                featureOptions={featureOptionsFor(selectedAccessProfile)}
                moduleFlags={moduleFlags}
                dataScopes={selectedAccessProfile.additionalScopes}
                actionCapabilities={selectedAccessProfile.additionalCapabilities}
                accessUntil={selectedAccessProfile.accessUntil}
                auditEvents={accessAudit}
                onPrincipalChange={setSelectedPrincipalId}
                onPrincipalStatusChange={(status) => {
                  updateAccessProfile(selectedAccessProfile.id, (profile) => ({ ...profile, status }));
                  logAccess(status === "revoked" ? "Identity revoked" : "Identity restored", selectedAccessProfile.label);
                }}
                onRoleAccessChange={(roleId, assigned) => {
                  updateAccessProfile(selectedAccessProfile.id, (profile) => ({ ...profile, subject: { ...profile.subject, roleIds: assigned ? [...new Set([...profile.subject.roleIds, roleId])] : profile.subject.roleIds.filter((id) => id !== roleId) } }));
                  logAccess(assigned ? "Role assigned" : "Role removed", `${selectedAccessProfile.label} · ${roleId}`);
                }}
                onPortalAccessChange={(portalId, allowed) => {
                  updateAccessProfile(selectedAccessProfile.id, (profile) => ({
                    ...profile,
                    subject: { ...profile.subject, directRules: [
                      ...(profile.subject.directRules || []).filter((rule) => rule.id !== `preview-portal-${portalId}`),
                      { id: `preview-portal-${portalId}`, tenantId: PREVIEW_ACCESS_TENANT, effect: allowed ? "allow" : "deny", boundary: "portal", portalIds: [portalId], capabilities: ["view"], scopes: ["company"], ...(profile.accessUntil ? { expiresAt: profile.accessUntil } : {}), reason: "Interactive portal-visibility preview" },
                    ] },
                  }));
                  logAccess(allowed ? "Portal enabled" : "Portal disabled", `${selectedAccessProfile.label} · ${portalId}`);
                }}
                onDataScopeChange={(scope, enabled) => {
                  updateAccessProfile(selectedAccessProfile.id, (profile) => syncAdditionalAccess({ ...profile, additionalScopes: enabled ? [...new Set([...profile.additionalScopes, scope])] : profile.additionalScopes.filter((item) => item !== scope) }));
                  logAccess("Data scope changed", `${selectedAccessProfile.label} · ${scope} ${enabled ? "added" : "removed"}`);
                }}
                onActionCapabilityChange={(capability, enabled) => {
                  updateAccessProfile(selectedAccessProfile.id, (profile) => syncAdditionalAccess({ ...profile, additionalCapabilities: enabled ? [...new Set([...profile.additionalCapabilities, capability])] : profile.additionalCapabilities.filter((item) => item !== capability) }));
                  logAccess("Action access changed", `${selectedAccessProfile.label} · ${capability} ${enabled ? "allowed" : "removed"}`);
                }}
                onFeatureAccessChange={(featureId, enabled) => {
                  updateAccessProfile(selectedAccessProfile.id, (profile) => {
                    if (featureId === "sosa-agent") return { ...profile, subject: { ...profile.subject, disabledPortalIds: enabled ? (profile.subject.disabledPortalIds || []).filter((portal) => portal !== "sosa") : [...new Set([...(profile.subject.disabledPortalIds || []), "sosa"])] } };
                    return { ...profile, subject: { ...profile.subject, featureIds: enabled ? [...new Set([...(profile.subject.featureIds || []), featureId])] : (profile.subject.featureIds || []).filter((item) => item !== featureId) } };
                  });
                  logAccess("Identity feature changed", `${selectedAccessProfile.label} · ${featureId} ${enabled ? "enabled" : "disabled"}`);
                }}
                onModuleFlagChange={(portalId, enabled) => {
                  setModuleFlags((flags) => flags.map((flag) => flag.id === portalId ? { ...flag, enabled } : flag));
                  logAccess("Company module flag changed", `${portalId} ${enabled ? "enabled" : "disabled"}`);
                }}
                onAccessUntilChange={(value) => {
                  const accessUntil = value ? new Date(value).toISOString() : "";
                  updateAccessProfile(selectedAccessProfile.id, (profile) => syncAdditionalAccess({ ...profile, accessUntil }));
                  logAccess("Access expiration changed", `${selectedAccessProfile.label} · ${accessUntil || "ongoing"}`);
                }}
                onAddRecordGrant={(grant: AccessRecordGrantInput) => {
                  if (!isStableAccessId(grant.recordId) || !isStableAccessId(grant.portalId) || !isStableAccessId(grant.recordKind)) return;
                  updateAccessProfile(selectedAccessProfile.id, (profile) => ({ ...profile, subject: { ...profile.subject, directRules: [
                    ...(profile.subject.directRules || []),
                    { id: `record-grant-${crypto.randomUUID()}`, tenantId: PREVIEW_ACCESS_TENANT, effect: "allow", boundary: "records", portalIds: [grant.portalId], capabilities: grant.capabilities, scopes: ["selected-records"], recordKinds: [grant.recordKind], recordIds: [grant.recordId], ...(grant.expiresAt || profile.accessUntil ? { expiresAt: grant.expiresAt || profile.accessUntil } : {}), reason: "Exact confidential-record preview grant" },
                    { id: `record-portal-${crypto.randomUUID()}`, tenantId: PREVIEW_ACCESS_TENANT, effect: "allow", boundary: "portal", portalIds: [grant.portalId], capabilities: ["view"], scopes: ["company"], ...(grant.expiresAt || profile.accessUntil ? { expiresAt: grant.expiresAt || profile.accessUntil } : {}), reason: "Portal visibility for exact record grant" },
                  ] } }));
                  logAccess("Confidential record granted", `${selectedAccessProfile.label} · ${grant.recordKind}:${grant.recordId}`);
                }}
                onAddToolGrant={(toolId, capability, expiresAt) => {
                  if (!isStableAccessId(toolId)) return;
                  updateAccessProfile(selectedAccessProfile.id, (profile) => ({ ...profile, subject: { ...profile.subject, directRules: [...(profile.subject.directRules || []), { id: `tool-grant-${crypto.randomUUID()}`, tenantId: PREVIEW_ACCESS_TENANT, effect: "allow", boundary: "records", portalIds: ["sosa"], capabilities: [capability], scopes: ["selected-records"], recordKinds: ["tool"], recordIds: [toolId], ...(expiresAt || profile.accessUntil ? { expiresAt: expiresAt || profile.accessUntil } : {}), reason: "Exact API/MCP tool allowlist" }] } }));
                  logAccess("Service tool granted", `${selectedAccessProfile.label} · ${toolId}:${capability}`);
                }}
                onRemoveDirectRule={(ruleId) => {
                  updateAccessProfile(selectedAccessProfile.id, (profile) => ({ ...profile, subject: { ...profile.subject, directRules: (profile.subject.directRules || []).filter((rule) => rule.id !== ruleId) } }));
                  logAccess("Direct rule removed", `${selectedAccessProfile.label} · ${ruleId}`);
                }}
              />
              <div className="access-level-grid" aria-label="Task visibility levels">
                <div><b>Owner only</b><p>Only the task owner can see it. This is the default for existing and newly created work.</p></div>
                <div><b>Workspace members</b><p>Visible to authorized members of the task&apos;s GTM, Projects, or Company workspace.</p></div>
                <div><b>Company-wide</b><p>Visible to authenticated Spej users and clearly marked on each task.</p></div>
              </div>
              <div className="access-admin-note"><ShieldCheck size={18}/><div><b>Compatible with the current administration model</b><p>Preserve the current global_admin, super_admin, user, and service_department role IDs and approve a migration crosswalk to the preview roles shown here. Keep access duration, restricted-document, SOSA, Microsoft 365, Teams, file, feature-control, API/MCP, and audit concepts. Add explicit portal, action, team, record, field, and temporary grants. Administrative access does not automatically expose confidential work.</p></div></div>
              <div className="settings-caveat"><CircleAlert size={17}/><p>{PREVIEW_ACCESS_NOTICE} Changes on this screen reset with the demo and must not be treated as company permissions.</p></div>
            </Panel>
          )}
          {section === "industry" && (
            <Panel className="settings-panel">
              <div className="settings-title">
                <Globe2 />
                <div>
                  <p className="eyebrow">Industry</p>
                  <h2>Sites and industry topics</h2>
                  <p>
                    Add any public homepage or feed. RSS, Atom, and RDF are
                    tried first; when none is available, the collector records a
                    recursive sitemap baseline and reports new pages.
                  </p>
                </div>
              </div>
              <div className="settings-field">
                <label>
                  What matters in this industry?
                  <small>
                    A short niche description helps distinguish consequential
                    updates from adjacent noise. It is used locally and by your
                    selected AI provider, when enabled.
                  </small>
                </label>
                <textarea
                  value={draft.industry.description}
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      industry: {
                        ...value.industry,
                        description: event.target.value,
                      },
                    }))
                  }
                  placeholder="e.g. Commercial robotics, warehouse automation, major product launches, research breakthroughs, funding, and regulation"
                />
              </div>
              <div className="settings-field">
                <label>
                  Daily reading target
                  <small>
                    Discovery remains broad, but only this many high-value
                    updates can appear in the current queue.
                  </small>
                </label>
                <select
                  value={draft.industry.dailyLimit}
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      industry: {
                        ...value.industry,
                        dailyLimit: Number(event.target.value),
                      },
                    }))
                  }
                >
                  <option value={20}>20 updates</option>
                  <option value={25}>25 updates</option>
                  <option value={30}>30 updates</option>
                  <option value={40}>40 updates</option>
                  <option value={50}>50 updates</option>
                </select>
              </div>
              <div className="source-editor">
                <div className="source-editor-head">
                  <b>Tracked sources</b>
                  <button type="button" onClick={addSource}>
                    <Plus size={14} /> Add source
                  </button>
                </div>
                {draft.industry.sources.map((source) => (
                  <div className="source-edit-row" key={source.id}>
                    <SettingsInput
                      aria-label="Source name"
                      value={source.name}
                      onChange={(event) =>
                        setDraft((value) => ({
                          ...value,
                          industry: {
                            ...value.industry,
                            sources: value.industry.sources.map((item) =>
                              item.id === source.id
                                ? { ...item, name: event.target.value }
                                : item,
                            ),
                          },
                        }))
                      }
                      placeholder="Source name"
                    />
                    <SettingsInput
                      aria-label="Source URL"
                      value={source.url}
                      onChange={(event) =>
                        setDraft((value) => ({
                          ...value,
                          industry: {
                            ...value.industry,
                            sources: value.industry.sources.map((item) =>
                              item.id === source.id
                                ? { ...item, url: event.target.value }
                                : item,
                            ),
                          },
                        }))
                      }
                      placeholder="https://example.com"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((value) => ({
                          ...value,
                          industry: {
                            ...value.industry,
                            sources: value.industry.sources.filter(
                              (item) => item.id !== source.id,
                            ),
                          },
                        }))
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                {!draft.industry.sources.length && (
                  <div className="editor-empty">No industry sources yet.</div>
                )}
              </div>
              <TagEditor
                label="Industry topics"
                help="These phrases discover wider current news and act as must-track relevance signals. Watched sites still receive priority, but low-value pages stay in discovery history instead of flooding the reading queue."
                values={draft.industry.keywords}
                onChange={(keywords) =>
                  setDraft((value) => ({
                    ...value,
                    industry: { ...value.industry, keywords },
                  }))
                }
                placeholder="e.g. sustainable packaging"
              />
              <TagEditor
                label="Exclude topics"
                help="Filter recurring noise that is not useful for this niche, such as jobs, sports scores, coupon pages, or unrelated uses of a shared term."
                values={draft.industry.excludedTerms}
                onChange={(excludedTerms) =>
                  setDraft((value) => ({
                    ...value,
                    industry: { ...value.industry, excludedTerms },
                  }))
                }
                placeholder="e.g. job listings"
              />
              <div className="settings-caveat">
                <Radio size={17} />
                <p>
                  Blocked homepages do not stop feed or sitemap discovery. A
                  site that exposes no readable feed or sitemap will show an
                  explicit source error instead of a false success.
                </p>
              </div>
            </Panel>
          )}
          {section === "mentions" && (
            <Panel className="settings-panel">
              <div className="settings-title">
                <AtSign />
                <div>
                  <p className="eyebrow">Mentions</p>
                  <h2>Identity, not loose keywords</h2>
                  <p>
                    Each company or person has an isolated evidence profile.
                    A common name must match that person&apos;s Spej role, official
                    profile, handle, or other identity-specific evidence. A
                    match for Sagar can never validate Aby, and generic words
                    such as AI, media, or content never prove identity.
                  </p>
                </div>
              </div>
              <div className="source-editor">
                <div className="source-editor-head">
                  <b>Verified identity profiles</b>
                  <button type="button" onClick={addMentionProfile}><Plus size={14} /> Add identity</button>
                </div>
                <div className="account-editor">
                  {(draft.mentions.profiles ?? []).map((profile) => (
                    <MentionIdentityDetails
                      key={profile.id}
                      initiallyOpen={profile.type === "custom" || ["spej-ai", "sagar-pandya", "aby-abraham"].includes(profile.id)}
                    >
                      <summary className="account-card-head">
                        <div>
                          <Label>{profile.type}</Label>
                          <b>{profile.label}</b>
                          <small>{profile.enabled ? "Monitoring" : "Paused"} · {profile.terms.length} exact {profile.terms.length === 1 ? "alias" : "aliases"}</small>
                        </div>
                        <ChevronDown size={16} aria-hidden="true" />
                      </summary>
                      <div className="settings-field">
                        <label>Display name<small>Used on mention cards and in the review queue.</small></label>
                        <SettingsInput
                          value={profile.label}
                          onChange={(event) => setDraft((value) => ({
                            ...value,
                            mentions: {
                              ...value.mentions,
                              profiles: (value.mentions.profiles ?? []).map((item) => item.id === profile.id ? { ...item, label: event.target.value } : item),
                            },
                          }))}
                        />
                      </div>
                      <TagEditor
                        label="Exact names and handles"
                        help="Only aliases belonging to this identity. Include the full name and unique handles; never add topic words here."
                        values={profile.terms}
                        onChange={(terms) => setDraft((value) => ({
                          ...value,
                          mentions: { ...value.mentions, profiles: (value.mentions.profiles ?? []).map((item) => item.id === profile.id ? { ...item, terms } : item) },
                        }))}
                        placeholder="e.g. Sagar Pandya"
                      />
                      <TagEditor
                        label="Official websites"
                        help="Domains owned by this company or person. These verify identity but are excluded from third-party mention results."
                        values={profile.websites}
                        onChange={(websites) => setDraft((value) => ({
                          ...value,
                          mentions: { ...value.mentions, profiles: (value.mentions.profiles ?? []).map((item) => item.id === profile.id ? { ...item, websites } : item) },
                        }))}
                        placeholder="e.g. spej.ai"
                      />
                      <TagEditor
                        label="Official public profile URLs"
                        help="Exact LinkedIn or other public profile URLs. The official profile itself is not surfaced as a mention."
                        values={profile.officialProfileUrls}
                        onChange={(officialProfileUrls) => setDraft((value) => ({
                          ...value,
                          mentions: { ...value.mentions, profiles: (value.mentions.profiles ?? []).map((item) => item.id === profile.id ? { ...item, officialProfileUrls } : item) },
                        }))}
                        placeholder="https://www.linkedin.com/in/..."
                      />
                      <TagEditor
                        label="Identity-specific evidence"
                        help="Spej roles, products, employers, collaborators, or signature phrases unique to this identity. AI, media, and content are ignored as proof."
                        values={profile.identityAnchors}
                        onChange={(identityAnchors) => setDraft((value) => ({
                          ...value,
                          mentions: { ...value.mentions, profiles: (value.mentions.profiles ?? []).map((item) => item.id === profile.id ? { ...item, identityAnchors } : item) },
                        }))}
                        placeholder="e.g. Director of AI Adoption and Strategic Partnerships"
                      />
                      <TagEditor
                        label="Namesake exclusions for this identity"
                        help="Add another person&apos;s employer, profession, location, sport, or other recurring false-positive context."
                        values={profile.negativeTerms}
                        onChange={(negativeTerms) => setDraft((value) => ({
                          ...value,
                          mentions: { ...value.mentions, profiles: (value.mentions.profiles ?? []).map((item) => item.id === profile.id ? { ...item, negativeTerms } : item) },
                        }))}
                        placeholder="e.g. professional athlete"
                      />
                      <label className="toggle-row">
                        <SettingsInput
                          type="checkbox"
                          checked={profile.enabled}
                          onChange={(event) => setDraft((value) => ({
                            ...value,
                            mentions: { ...value.mentions, profiles: (value.mentions.profiles ?? []).map((item) => item.id === profile.id ? { ...item, enabled: event.target.checked } : item) },
                          }))}
                        />
                        <span><b>Monitor this identity</b><small>Turn this profile off without deleting its evidence.</small></span>
                      </label>
                      <div className="provider-buttons">
                        <button
                          type="button"
                          onClick={() => setDraft((value) => ({
                            ...value,
                            mentions: {
                              ...value.mentions,
                              profiles: (value.mentions.profiles ?? []).filter((item) => item.id !== profile.id),
                            },
                          }))}
                        ><Trash2 size={15} /> Remove {profile.label}</button>
                      </div>
                    </MentionIdentityDetails>
                  ))}
                </div>
              </div>
              <TagEditor
                label="Global exclusions"
                help="Use only for contexts that should reject a result for every monitored identity. Put person-specific namesake clues inside that identity's profile."
                values={draft.mentions.negativeTerms}
                onChange={(negativeTerms) =>
                  setDraft((value) => ({
                    ...value,
                    mentions: { ...value.mentions, negativeTerms },
                  }))
                }
                placeholder="e.g. professional golfer"
              />
              <label className="toggle-row">
                <SettingsInput
                  type="checkbox"
                  checked={draft.mentions.strictMode}
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      mentions: {
                        ...value.mentions,
                        strictMode: event.target.checked,
                      },
                    }))
                  }
                />
                <span>
                  <b>Identity-aware filtering</b>
                  <small>
                    Reject uncorroborated namesakes while retaining contextual
                    matches for review.
                  </small>
                </span>
              </label>
              <label className="toggle-row">
                <SettingsInput
                  type="checkbox"
                  checked={draft.mentions.excludeOwnedSites}
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      mentions: {
                        ...value.mentions,
                        excludeOwnedSites: event.target.checked,
                      },
                    }))
                  }
                />
                <span>
                  <b>Exclude your own websites</b>
                  <small>
                    Official domains strengthen identity verification but do
                    not count as third-party mentions.
                  </small>
                </span>
              </label>
              <div className="settings-caveat">
                <ShieldCheck size={17} />
                <p>
                  Archived results keep their canonical local identity and do
                  not return on later scans. Add precise anchors whenever a
                  brand phrase is also common language.
                </p>
              </div>
            </Panel>
          )}
          {section === "newsletters" && (
            <Panel className="settings-panel">
              <div className="settings-title">
                <Mail />
                <div>
                  <p className="eyebrow">Newsletters</p>
                  <h2>Dedicated Gmail connection</h2>
                  <p>
                    Connect any Google account, including one created only for
                    newsletter subscriptions. Gmail access stays read-only.
                    Newsletter intelligence also needs a cloud or local model
                    configured in AI curation. Issue text goes only to that selected provider.
                  </p>
                </div>
              </div>
              {draft.newsletters.connected ? (
                <div className="connection-card connected">
                  <CheckCircle2 />
                  <div>
                    <b>{draft.newsletters.connectedEmail}</b>
                    <p>Connected with Gmail read-only access.</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch("/api/settings?connection=gmail", {
                        method: "DELETE",
                      });
                      const response = await fetch("/api/settings");
                      const saved = (await response.json()) as PublicSettings;
                      setDraft(settingsDraft(saved));
                      onSaved(saved);
                    }}
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <div className="connection-card">
                  <Mail />
                  <div>
                    <b>No newsletter mailbox connected</b>
                    <p>
                      Create a dedicated Gmail if you want one, then save OAuth
                      credentials and connect it here.
                    </p>
                  </div>
                  <a
                    className="button button-ghost"
                    href="https://accounts.google.com/signup"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Create Gmail <ArrowUpRight size={14} />
                  </a>
                </div>
              )}
              <div className="credential-grid">
                <div className="settings-field">
                  <label>
                    Google OAuth client ID
                    <small>
                      From a Google Cloud “Web application” OAuth client.
                    </small>
                  </label>
                  <SettingsInput
                    aria-label="Google OAuth client ID"
                    autoCapitalize="none"
                    autoComplete="off"
                    name="google-oauth-client-id"
                    spellCheck={false}
                    value={draft.newsletters.googleClientId}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        newsletters: {
                          ...value.newsletters,
                          googleClientId: event.target.value,
                        },
                      }))
                    }
                    placeholder="…apps.googleusercontent.com"
                  />
                </div>
                <div className="settings-field">
                  <label>
                    Google OAuth client secret
                    <small>
                      {draft.newsletters.googleClientSecretSet
                        ? "A secret is already saved. Leave blank to keep it."
                        : "Stored only in the local server data directory."}
                    </small>
                  </label>
                  <SettingsInput
                    aria-label="Google OAuth client secret"
                    autoComplete="new-password"
                    name="google-oauth-client-secret"
                    type="password"
                    value={draft.newsletters.googleClientSecret || ""}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        newsletters: {
                          ...value.newsletters,
                          googleClientSecret: event.target.value,
                        },
                      }))
                    }
                    placeholder={
                      draft.newsletters.googleClientSecretSet
                        ? "Saved ••••••••"
                        : "Client secret"
                    }
                  />
                </div>
              </div>
              <div className="settings-field">
                <label>
                  Gmail search query
                  <small>
                    Choose which messages count as newsletters using Gmail
                    search syntax. The default watches recent Updates and
                    Promotions.
                  </small>
                </label>
                <SettingsInput
                  value={draft.newsletters.gmailQuery}
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      newsletters: {
                        ...value.newsletters,
                        gmailQuery: event.target.value,
                      },
                    }))
                  }
                  placeholder="newer_than:30d (category:updates OR category:promotions)"
                />
              </div>
              <div className="oauth-actions">
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => void connectGmail()}
                  disabled={saving}
                >
                  <KeyRound size={15} />{" "}
                  {saving ? "Saving…" : "Save & choose Gmail account"}
                </button>
                <p>
                  Authorized redirect URI:{" "}
                  <code>
                    {typeof window === "undefined"
                      ? "/api/auth/google/callback"
                      : `${window.location.origin}/api/auth/google/callback`}
                  </code>
                </p>
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Google OAuth credentials <ArrowUpRight size={13} />
                </a>
              </div>
            </Panel>
          )}
          {section === "audience" && (
            <Panel className="settings-panel">
              <div className="settings-title">
                <Users />
                <div>
                  <p className="eyebrow">Audience</p>
                  <h2>Public social profiles</h2>
                  <p>
                    Paste the exact profile or company-page URL for any account.
                    Public checks are keyless; supported official credentials
                    remain optional fallbacks.
                  </p>
                </div>
              </div>
              <div className="provider-buttons">
                <button type="button" onClick={() => addAccount("youtube")}>
                  <Youtube /> YouTube
                </button>
                <button type="button" onClick={() => addAccount("x")}>
                  <X /> X
                </button>
                <button type="button" onClick={() => addAccount("instagram")}>
                  <Instagram /> Instagram
                </button>
                <button type="button" onClick={() => addAccount("facebook")}>
                  <Facebook /> Facebook
                </button>
                <button type="button" onClick={() => addAccount("linkedin")}>
                  <Linkedin /> LinkedIn
                </button>
                <button type="button" onClick={() => addAccount("threads")}>
                  <AtSign /> Threads
                </button>
                <button type="button" onClick={() => addAccount("tiktok")}>
                  <Music2 /> TikTok
                </button>
              </div>
              <div className="account-editor">
                {draft.audience.accounts.map((account) => (
                  <div className="account-card" key={account.id}>
                    <div className="account-card-head">
                      <Label>{account.platform}</Label>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((value) => ({
                            ...value,
                            audience: {
                              accounts: value.audience.accounts.filter(
                                (item) => item.id !== account.id,
                              ),
                            },
                          }))
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="credential-grid">
                      <div className="settings-field">
                        <label>
                          Label
                          <small>
                            How this account appears in the dashboard.
                          </small>
                        </label>
                        <SettingsInput
                          value={account.label}
                          onChange={(event) =>
                            setDraft((value) => ({
                              ...value,
                              audience: {
                                accounts: value.audience.accounts.map((item) =>
                                  item.id === account.id
                                    ? { ...item, label: event.target.value }
                                    : item,
                                ),
                              },
                            }))
                          }
                        />
                      </div>
                      <div className="settings-field">
                        <label>
                          Username or handle
                          <small>
                            Used when a full profile URL is not supplied.
                          </small>
                        </label>
                        <SettingsInput
                          value={account.username}
                          onChange={(event) =>
                            setDraft((value) => ({
                              ...value,
                              audience: {
                                accounts: value.audience.accounts.map((item) =>
                                  item.id === account.id
                                    ? { ...item, username: event.target.value }
                                    : item,
                                ),
                              },
                            }))
                          }
                          placeholder="without the @ symbol"
                        />
                      </div>
                      <div className="settings-field profile-url-field">
                        <label>
                          Public profile URL
                          <small>
                            Must be a profile on the selected platform. Emails
                            and post URLs are rejected.
                          </small>
                        </label>
                        <SettingsInput
                          type="url"
                          fieldKey={`audience-${account.id}-profile-url`}
                          aria-label={`${account.label || account.platform} public profile URL`}
                          value={account.profileUrl || ""}
                          onChange={(event) =>
                            setDraft((value) => ({
                              ...value,
                              audience: {
                                accounts: value.audience.accounts.map((item) =>
                                  item.id === account.id
                                    ? {
                                        ...item,
                                        profileUrl: event.target.value,
                                      }
                                    : item,
                                ),
                              },
                            }))
                          }
                          placeholder={profilePlaceholder(account.platform)}
                        />
                      </div>
                    </div>
                    {["youtube", "x", "instagram", "facebook"].includes(
                      account.platform,
                    ) && (
                      <details className="advanced-credentials">
                        <summary>
                          <KeyRound size={13} /> Optional official API fallback
                        </summary>
                        <p>
                          Only used if the public profile does not expose a
                          readable count.
                        </p>
                        <div className="credential-grid">
                          {(account.platform === "instagram" ||
                            account.platform === "facebook") && (
                            <div className="settings-field">
                              <label>
                                Account or page ID
                                <small>
                                  Only needed for the Meta API fallback.
                                </small>
                              </label>
                              <SettingsInput
                                value={account.accountId}
                                onChange={(event) =>
                                  setDraft((value) => ({
                                    ...value,
                                    audience: {
                                      accounts: value.audience.accounts.map(
                                        (item) =>
                                          item.id === account.id
                                            ? {
                                                ...item,
                                                accountId: event.target.value,
                                              }
                                            : item,
                                      ),
                                    },
                                  }))
                                }
                              />
                            </div>
                          )}
                          <div className="settings-field">
                            <label>
                              {account.platform === "youtube"
                                ? "YouTube Data API key"
                                : account.platform === "x"
                                  ? "X bearer token"
                                  : "Meta access token"}
                              <small>
                                {account.credentialSet
                                  ? "Credential saved. You can remove it below."
                                  : "Optional; stored server-side and excluded from Git."}
                              </small>
                            </label>
                            <SettingsInput
                              type="password"
                              value={account.credential || ""}
                              onChange={(event) =>
                                setDraft((value) => ({
                                  ...value,
                                  audience: {
                                    accounts: value.audience.accounts.map(
                                      (item) =>
                                        item.id === account.id
                                          ? {
                                              ...item,
                                              credential: event.target.value,
                                              clearCredential: false,
                                            }
                                          : item,
                                    ),
                                  },
                                }))
                              }
                              placeholder={
                                account.credentialSet
                                  ? "Saved ••••••••"
                                  : "Optional provider credential"
                              }
                            />
                          </div>
                        </div>
                        {account.credentialSet && (
                          <button
                            className="text-button danger"
                            type="button"
                            onClick={() =>
                              setDraft((value) => ({
                                ...value,
                                audience: {
                                  accounts: value.audience.accounts.map(
                                    (item) =>
                                      item.id === account.id
                                        ? {
                                            ...item,
                                            credential: "",
                                            credentialSet: false,
                                            clearCredential: true,
                                          }
                                        : item,
                                  ),
                                },
                              }))
                            }
                          >
                            <Trash2 size={13} /> Remove saved credential
                          </button>
                        )}
                      </details>
                    )}
                  </div>
                ))}
                {!draft.audience.accounts.length && (
                  <div className="editor-empty">
                    No audience accounts yet. Choose a platform above.
                  </div>
                )}
              </div>
              <div className="settings-caveat">
                <Eye size={17} />
                <p>
                  Public metadata is provider-controlled. Each metric is tied to
                  the canonical account URL, failures preserve only that
                  account&apos;s last verified value, and temporary blocks never
                  become a false zero.
                </p>
              </div>
            </Panel>
          )}
          {section === "ai" && (
            <Panel className="settings-panel"><AiProviderSettings
              value={draft.ai}
              onChange={(ai) => setDraft((value) => ({ ...value, ai }))}
            /></Panel>
          )}
          {section === "integrations" && (
            <Panel className="settings-panel">
              <div className="os-sync-plan">
                <div className="os-sync-plan-head"><div><p className="eyebrow">Production connection</p><h2>Existing Spej OS services</h2><p>Use this interface as a focused shell over the company&apos;s canonical identity, CRM, project, ticket, document, and audit services.</p></div><span><i/>Not connected</span></div>
                <div className="os-sync-rules">
                  <div><b>Preview → production services</b><p>Map approved accounts, contacts, activity, opportunity changes, project status, and tasks to canonical IDs.</p></div>
                  <div><b>Production services → workspaces</b><p>Return permissions, canonical records, delivery status, tickets, documents, ownership, and relevant history to the right view.</p></div>
                  <div><b>Never blindly overwrite</b><p>Match on stable IDs, reject duplicates, preserve source and timestamps, and require review for conflicts or sensitive deal changes.</p></div>
                </div>
                <p className="os-sync-footnote">This screen defines the intended integration contract. The production build should reuse Spej OS APIs, MCP tools, webhooks, identity, and permissions instead of creating a second source of truth.</p>
                <div className="integration-contract-grid" aria-label="Production integration readiness">
                  <article><div><b>Microsoft Teams</b><span>Contract defined</span></div><p>Receive approved chat commands, meeting events, and linked context through Microsoft Graph. No tenant has been authenticated.</p><small>IT supplies Entra app, scopes, webhook validation, and channel policy.</small></article>
                  <article><div><b>Microsoft Outlook</b><span>Contract defined</span></div><p>Map approved email and calendar events to activities, meetings, follow-ups, and source evidence. No mailbox is connected.</p><small>IT supplies delegated or application permissions and retention rules.</small></article>
                  <article><div><b>SharePoint</b><span>Contract defined</span></div><p>Link governed documents to canonical accounts, opportunities, and projects without copying entire libraries into the dashboard.</p><small>IT supplies site allowlists, record mapping, and access enforcement.</small></article>
                  <article><div><b>SOSA</b><span>Tool contract ready</span></div><p>Read authorized records, propose reviewable actions, and commit through canonical services. The existing production agent is not connected here.</p><small>IT maps SOSA tools to authenticated user and record permissions.</small></article>
                  <article><div><b>Knowledge graph &amp; documents</b><span>Retain existing service</span></div><p>Keep Spej OS document processing, vector indexing, transcript metadata, and permission-aware retrieval as the knowledge layer.</p><small>This interface stores record links and approved facts, not uncontrolled copies of private files.</small></article>
                  <article><div><b>API, MCP &amp; webhooks</b><span>Retain and extend</span></div><p>Use existing tenant-scoped APIs, MCP tools, key scopes, rate limits, and signed webhooks to connect this interface and approved external tools.</p><small>Rotate historical test credentials and keep every tool allowlisted.</small></article>
                  <article><div><b>Other data sources</b><span>Retain connector service</span></div><p>Keep existing Google Workspace, file-share, REST, and Azure SQL connection options available through the current Spej OS connector layer.</p><small>Expose coverage and sync health here; do not create a second connector registry.</small></article>
                  <article><div><b>Tickets &amp; quality</b><span>Map to projects</span></div><p>Keep the existing ticket and quality workflow, then show authorized open items inside the related project and My Work views.</p><small>Ticket records remain canonical; the dashboard does not create a second issue system.</small></article>
                  <article><div><b>Audit &amp; job health</b><span>Retain existing service</span></div><p>Continue recording administrative changes and monitoring sync jobs, retries, failures, connector coverage, and remediation.</p><small>SOSA must report source health instead of assuming every knowledge source is complete.</small></article>
                  <article><div><b>Feature, model &amp; usage controls</b><span>Retain control plane</span></div><p>Keep current module flags, entitlements, model selection, presentation generation, branding, AI usage, and cost controls authoritative.</p><small>This shell should show status or a governed deep link, not rebuild those administrative services.</small></article>
                </div>
              </div>
              <div className="settings-title">
                <Cable />
                <div>
                  <p className="eyebrow">Optional · advanced setup</p>
                  <h2>Bring private context into My Work</h2>
                  <p>
                    Use this only if you want My Work to include private messages, meetings, or to-dos from apps such as Slack, Gmail, Granola, or Calendar. Industry, Mentions, Audience, and newsletter collection do not need this page.
                  </p>
                </div>
              </div>
              <div className="integration-explainer">
                <h3>How it works</h3>
                <ol>
                  <li><b>Choose the apps below.</b> These names are labels for incoming summaries, not logins or API keys. Adding a name does not connect the app.</li>
                  <li><b>Save settings, then copy the setup prompt.</b> Paste it into Codex (with the relevant plugins installed), or use your own local script.</li>
                  <li><b>Authorize that automation.</b> It reads only the apps you approve and sends a short summary to this running Control Center. My Work shows when each source last synced.</li>
                </ol>
                <p>No private integrations? Leave this section empty. Your cross-tab daily snapshot still works.</p>
              </div>
              <TagEditor
                label="Apps to receive summaries from"
                help="Add one name at a time, such as Slack or Google Calendar. The copied setup prompt uses these names to match summaries to the right app."
                values={draft.dailyBrief.sourceLabels}
                onChange={(sourceLabels) =>
                  setDraft((value) => ({
                    ...value,
                    dailyBrief: { ...value.dailyBrief, sourceLabels },
                  }))
                }
                placeholder="e.g. Slack"
              />
              <div className="settings-field">
                <label>
                  Keep private context for
                  <small>
                    The maximum recent sync history available locally. My Work
                    and Week apply their own narrower display windows.
                  </small>
                </label>
                <select
                  value={draft.dailyBrief.lookbackDays}
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      dailyBrief: {
                        ...value.dailyBrief,
                        lookbackDays: Number(event.target.value),
                      },
                    }))
                  }
                >
                  <option value={1}>1 day</option>
                  <option value={3}>3 days</option>
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                </select>
              </div>
              <div className="bridge-card">
                <div>
                  <p className="eyebrow">Step 2 · after saving</p>
                  <h3>Set up the reader in Codex</h3>
                  <p>
                    The prompt tells Codex to use only the source labels above,
                    minimize private content, stay read-only, report each
                    source&apos;s health, and post stable items to this computer.
                  </p>
                </div>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => void copyBridgePrompt()}
                >
                  <Copy size={15} /> Copy setup prompt
                </button>
                <code>
                  {typeof window === "undefined"
                    ? "/api/brief"
                    : `${window.location.origin}/api/brief`}
                </code>
                {bridgePromptFallback && (
                  <label className="bridge-prompt-fallback">
                    Complete prompt
                    <textarea
                      readOnly
                      value={bridgePromptFallback}
                      onFocus={(event) => event.currentTarget.select()}
                    />
                  </label>
                )}
              </div>
              <div className="bridge-manual">
                <b>Script or local automation</b>
                <p>
                  Send the same JSON contract with{" "}
                  <code>
                    npm run ingest -- --file=/absolute/path/items.json
                  </code>
                  . Stable item IDs prevent duplicates on later runs; source
                  reports record empty checks and connector failures.
                </p>
              </div>
              <div className="settings-caveat">
                <ShieldCheck size={17} />
                <p>
                  Control Center never reaches into Codex or a private provider
                  by itself. A user-approved local automation reads those
                  sources and sends only the minimized overview. This keeps a
                  GitHub install portable without shipping anyone&apos;s account
                  access.
                </p>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

export function ControlCenter() {
  const [activeTab, setActiveTab] = useState<Tab>("today");
  const [agentCommand, setAgentCommand] = useState("");
  const [focusedRecordId, setFocusedRecordId] = useState<string | number | undefined>();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settings, setSettings] = useState<PublicSettings>(emptySettings);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [partnerships, setPartnerships] = useState<PartnershipItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [marketingMetrics, setMarketingMetrics] = useState<MarketingMetricItem[]>([]);
  const [toast, setToast] = useState("");
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [bootstrapStatus, setBootstrapStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [bootstrapError, setBootstrapError] = useState("");
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const [workspaceSaveError, setWorkspaceSaveError] = useState("");
  const [syntheticDemo, setSyntheticDemo] = useState(false);
  const [viewerId, setViewerId] = useState<TeamProfileId>(PREVIEW_OPERATOR_PROFILE_ID);
  const [viewerReady, setViewerReady] = useState(false);
  const [previewAccessProfiles, setPreviewAccessProfiles] = useState<PreviewAccessProfile[]>(initialPreviewAccessProfiles);
  const [previewModuleFlags, setPreviewModuleFlags] = useState<AccessFeatureOption[]>(() => PREVIEW_ACCESS_PORTALS.filter((portal) => !["my-work", "admin"].includes(portal.id)).map((portal) => ({ id: portal.id, label: portal.label, enabled: true })));
  const [previewAccessAudit, setPreviewAccessAudit] = useState<AccessAuditEvent[]>([]);
  const workspaceSaveQueue = useRef(Promise.resolve());
  const viewer = getTeamViewProfile(viewerId) || TEAM_VIEW_PROFILES[0];
  const currentAccessProfile = previewAccessProfiles.find((profile) => profile.id === viewer.id) || previewAccessProfiles[0]!;
  const currentTenantPolicy = profileTenantPolicy(currentAccessProfile, previewModuleFlags);

  useEffect(() => {
    let cancelled = false;
    let savedProfile: ReturnType<typeof getTeamViewProfile> = undefined;
    try {
      const savedViewer = window.localStorage.getItem(PREVIEW_VIEWER_KEY);
      savedProfile = getTeamViewProfile(savedViewer);
    } catch {
      // The optional view preference must never prevent the workspace from loading.
    }
    window.queueMicrotask(() => {
      if (cancelled) return;
      if (savedProfile) setViewerId(savedProfile.id);
      setViewerReady(true);
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!viewerReady) return;
    try {
      window.localStorage.setItem(PREVIEW_VIEWER_KEY, viewerId);
    } catch {
      // Continue without persisting a presentation-only preference.
    }
  }, [viewerId, viewerReady]);

  useEffect(() => {
    let cancelled = false;
    window.queueMicrotask(() => {
      const requested = new URLSearchParams(window.location.search).get("tab");
      setFocusedRecordId(new URLSearchParams(window.location.search).get("record") || undefined);
      if (isTab(requested)) setActiveTab(requested);
    });
    const load = async () => {
      try {
        const [settingsResponse, workspaceResponse] = await Promise.all([
          fetch("/api/settings", { cache: "no-store" }),
          fetch("/api/workspace", { cache: "no-store" }),
        ]);
        if (!settingsResponse.ok)
          throw new Error(
            "Settings could not be read. Your saved configuration was not changed.",
          );
        if (!workspaceResponse.ok)
          throw new Error(
            "Your operating workspace could not be read. Your saved records were not changed.",
          );
        const [loadedSettings, saved] = await Promise.all([
          settingsResponse.json() as Promise<PublicSettings>,
          workspaceResponse.json() as Promise<WorkspaceStateResponse>,
        ]);
        const recovery = saved.syntheticDemo ? null : readWorkspaceRecovery();
        const legacy: WorkspaceState = saved.legacyBrowserImportAllowed
          ? {
              reminders: readLegacyList<Reminder>("control-center-v2-reminders"),
              tasks: readLegacyList<Task>("control-center-v2-tasks"),
              content: [],
              accounts: [], contacts: [], activities: [], opportunities: [], partnerships: [], projects: [], campaigns: [], marketingMetrics: [],
            }
          : { reminders: [], tasks: [], content: [], accounts: [], contacts: [], activities: [], opportunities: [], partnerships: [], projects: [], campaigns: [], marketingMetrics: [] };
        let nextWorkspace: WorkspaceState = saved.initialized
          ? { reminders: saved.reminders, tasks: saved.tasks, content: saved.content || [], accounts: saved.accounts || [], contacts: saved.contacts || [], activities: saved.activities || [], opportunities: saved.opportunities || [], partnerships: saved.partnerships || [], projects: saved.projects || [], campaigns: saved.campaigns || [], marketingMetrics: saved.marketingMetrics || [] }
          : legacy;
        const canRecover = saved.initialized || saved.legacyBrowserImportAllowed;
        if (recovery && canRecover) nextWorkspace = recovery.workspace;
        if (!saved.initialized || (recovery && canRecover)) {
          const importResponse = await fetch("/api/workspace", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(nextWorkspace),
          });
          if (!importResponse.ok)
            throw new Error(
              "The first-run workspace could not be initialized. No local data was replaced.",
            );
          nextWorkspace = (await importResponse.json()) as WorkspaceState;
        }
        if (cancelled) return;
        setSyntheticDemo(saved.syntheticDemo);
        setSettings(loadedSettings);
        setReminders(nextWorkspace.reminders);
        setTasks(nextWorkspace.tasks);
        setContent(nextWorkspace.content);
        setAccounts(nextWorkspace.accounts);
        setContacts(nextWorkspace.contacts);
        setActivities(nextWorkspace.activities);
        setOpportunities(nextWorkspace.opportunities);
        setPartnerships(nextWorkspace.partnerships);
        setProjects(nextWorkspace.projects);
        setCampaigns(nextWorkspace.campaigns);
        setMarketingMetrics(nextWorkspace.marketingMetrics);
        setWorkspaceReady(true);
        setBootstrapStatus("ready");
      } catch (error) {
        if (cancelled) return;
        setBootstrapError(
          error instanceof Error
            ? error.message
            : "Control Center could not read its local data.",
        );
        setBootstrapStatus("error");
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [bootstrapAttempt]);
  useEffect(() => {
    if (!workspaceReady) return;
    const workspace = { reminders, tasks, content, accounts, contacts, activities, opportunities, partnerships, projects, campaigns, marketingMetrics } satisfies WorkspaceState;
    const recovery: WorkspaceRecovery = {
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
      workspace,
    };
    if (!syntheticDemo) {
      try {
        window.localStorage.setItem(
          "control-center-v2-reminders",
          JSON.stringify(reminders),
        );
        window.localStorage.setItem(
          "control-center-v2-tasks",
          JSON.stringify(tasks),
        );
        window.localStorage.setItem(
          "spej-control-center-content",
          JSON.stringify(content),
        );
        window.localStorage.setItem(
          WORKSPACE_RECOVERY_KEY,
          JSON.stringify(recovery),
        );
      } catch {
        // The immediate SQLite write below remains canonical when browser storage is unavailable.
      }
    }
    const save = async () => {
      const response = await fetch("/api/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workspace),
      });
      if (!response.ok)
        throw new Error(
          "Your operating workspace could not be saved to SQLite. Keep this page open and retry.",
        );
      try {
        if (!syntheticDemo && readWorkspaceRecovery()?.id === recovery.id)
          window.localStorage.removeItem(WORKSPACE_RECOVERY_KEY);
      } catch {
        // A saved SQLite workspace does not depend on clearing the recovery copy.
      }
      setWorkspaceSaveError("");
    };
    workspaceSaveQueue.current = workspaceSaveQueue.current
      .then(save, save)
      .catch((error) => {
        setWorkspaceSaveError(
          error instanceof Error
            ? error.message
            : "Your operating workspace could not be saved.",
        );
      });
  }, [reminders, tasks, content, accounts, contacts, activities, opportunities, partnerships, projects, campaigns, marketingMetrics, workspaceReady, syntheticDemo]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const goTo = (tab: Tab, recordId?: string | number) => {
    setFocusedRecordId(recordId);
    setActiveTab(tab);
    setMobileOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    if (recordId !== undefined) url.searchParams.set("record", String(recordId)); else url.searchParams.delete("record");
    if (tab !== "settings") url.searchParams.delete("section");
    if (url.href !== window.location.href) window.history.pushState({}, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  useEffect(() => {
    const onPopState = () => {
      const requested = new URLSearchParams(window.location.search).get("tab") || "today";
      if (isTab(requested)) { setFocusedRecordId(new URLSearchParams(window.location.search).get("record") || undefined); setActiveTab(requested); setMobileOpen(false); }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const addReminder = (title: string, note: string, url?: string) => {
    let source = "Manual";
    if (url) {
      try {
        source = new URL(url).hostname.replace("www.", "");
      } catch {
        source = "Saved link";
      }
    }
    setReminders((values) => [
      {
        id: crypto.randomUUID(),
        type: url ? "Link" : "Saved",
        title,
        source,
        createdAt: new Date().toISOString(),
        note: note || "Saved for later.",
        accent: "teal",
        url,
      },
      ...values,
    ]);
    setToast("Saved to research");
  };
  const addContentIdea = (title: string, angle: string, sourceUrl?: string) => {
    setContent((values) => [{
      id: crypto.randomUUID(),
      title,
      format: "YouTube",
      stage: "Idea",
      publishDate: "",
      angle,
      pillar: "Unassigned",
      stream: "Spej Authority-building content",
      owner: viewer.displayName,
      ownerProfileId: viewer.id,
      approver: "Unassigned",
      reviewStatus: "Not Requested",
      reviewDue: "",
      sourceUrl,
      createdAt: new Date().toISOString(),
    }, ...values]);
    setToast("Added to the content pipeline");
  };
  const addBriefTask = (item: DailyBriefItem) => {
    const id = `brief:${item.id}`;
    if (tasks.some((task) => task.id === id)) {
      setToast("That brief item is already in tasks");
      return;
    }
    setTasks((values) => [
      {
        id,
        title: item.title,
        description:
          [item.source, item.summary, item.url].filter(Boolean).join(" · ") ||
          "Added from Daily Brief.",
        due: item.dueAt
          ? localDateValue(new Date(item.dueAt))
          : localDateValue(),
        recurrence: "One-time",
        priority: item.kind === "action" ? "High" : "Normal",
        owner: viewer.displayName,
        ownerProfileId: viewer.id,
        visibility: "Private",
        workspaceId: "gtm",
        status: "Not Started",
        effort: "Small",
        category: "General",
        done: false,
        createdAt: new Date().toISOString(),
      },
      ...values,
    ]);
    setToast("Added to tasks");
  };
  const addOperationsTask = (input: {
    title: string;
    description: string;
    due?: string;
    category: TaskCategory;
    relatedType?: Task["relatedType"];
    relatedId?: string;
    recurrence?: string;
    priority?: Task["priority"];
    owner?: string;
    visibility?: TaskVisibility;
    workspaceId?: TaskWorkspaceId;
    status?: Task["status"];
    effort?: Task["effort"];
  }) => {
    const taskOwner = input.owner || viewer.displayName;
    const linkedProject = input.relatedType === "project"
      ? projects.find((project) => project.id === input.relatedId)
      : undefined;
    const resolvedWorkspaceId: TaskWorkspaceId = input.workspaceId || (linkedProject
      ? linkedProject.workArea === "GTM" ? "gtm" : "project-management"
      : input.category === "Project Work" || input.category === "Client Delivery"
        ? "project-management"
        : "gtm");
    setTasks((values) => [{
      id: crypto.randomUUID(), title: input.title, description: input.description,
      due: input.due || localDateValue(), recurrence: input.recurrence || "One-time", priority: input.priority || "Normal",
      owner: taskOwner, ownerProfileId: getTeamViewProfile(taskOwner)?.id, visibility: input.visibility || "Private", workspaceId: resolvedWorkspaceId,
      status: input.status || "Not Started", effort: input.effort || "Small",
      category: input.category, relatedType: input.relatedType, relatedId: input.relatedId,
      done: false, createdAt: new Date().toISOString(),
    }, ...values]);
    setToast(`Added to ${input.category} work`);
  };
  const openSettings = (section?: SettingsSection) => {
    const url = new URL(window.location.href);
    if (section) url.searchParams.set("section", section);
    url.searchParams.set("tab", "settings");
    window.history.replaceState({}, "", url);
    setActiveTab("settings");
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const configuredAreaCount = [
    settings.industry.sources.length + settings.industry.keywords.length,
    activeMentionProfileCount(settings),
    newsletterSetupReady(settings) ? 1 : 0,
    settings.audience.accounts.length,
  ].filter(Boolean).length;
  const current = useMemo(
    () =>
      activeTab === "settings"
        ? "Settings"
        : [...nav, ...hiddenTabs].find((item) => item.id === activeTab)?.label,
    [activeTab],
  );
  const workspaceContext = deliveryWorkspaceTabs.includes(activeTab)
    ? "Projects"
    : activeTab === "relationships"
      ? "Company CRM"
    : gtmWorkspaceTabs.includes(activeTab)
      ? "Sales & marketing"
      : activeTab === "agent"
        ? "Company assistant"
        : activeTab === "settings"
          ? "Settings"
          : "My work";
  const relatedNames = useMemo(() => Object.fromEntries([
    ...accounts.map((item) => [`account:${item.id}`, item.name]),
    ...contacts.map((item) => [`contact:${item.id}`, item.name]),
    ...opportunities.map((item) => [`opportunity:${item.id}`, item.name]),
    ...partnerships.map((item) => [`partnership:${item.id}`, item.name]),
    ...projects.map((item) => [`project:${item.id}`, item.name]),
    ...campaigns.map((item) => [`campaign:${item.id}`, item.name]),
    ...content.map((item) => [`content:${item.id}`, item.title]),
  ]), [accounts, contacts, opportunities, partnerships, projects, campaigns, content]);
  const visibleNav = nav.filter((item) => evaluatePortalAccess({ subject: currentAccessProfile.subject, roles: PREVIEW_ACCESS_ROLES, portalId: tabPortal(item.id), tenantPolicy: currentTenantPolicy }).allowed);
  const activeAccessDecision = activeTab === "settings" ? undefined : evaluatePortalAccess({ subject: currentAccessProfile.subject, roles: PREVIEW_ACCESS_ROLES, portalId: tabPortal(activeTab), tenantPolicy: currentTenantPolicy });
  const canManageAccess = evaluatePortalAccess({ subject: currentAccessProfile.subject, roles: PREVIEW_ACCESS_ROLES, portalId: "admin", capability: "admin", tenantPolicy: currentTenantPolicy }).allowed;

  if (bootstrapStatus === "loading")
    return (
      <div className="app-loading">
        <Activity />
        <span>Opening Control Center</span>
      </div>
    );
  if (bootstrapStatus === "error")
    return (
      <div className="app-recovery">
        <Panel className="recovery-panel">
          <CircleAlert size={30} />
          <p className="eyebrow">Local data protected</p>
          <h1>Control Center could not open safely</h1>
          <p>{bootstrapError}</p>
          <p>
            No settings, tasks, or reminders were overwritten. Retry the read,
            or run <code>npm run doctor</code> in the app folder for a local
            diagnostic.
          </p>
          <button
            className="button button-primary"
            onClick={() => {
              setBootstrapStatus("loading");
              setBootstrapError("");
              setWorkspaceReady(false);
              setBootstrapAttempt((value) => value + 1);
            }}
          >
            <RefreshCw size={15} /> Retry
          </button>
        </Panel>
      </div>
    );
  return (
    <div className="app-shell">
      <header className="topbar">
        <div
          className="brand-lockup"
          onClick={() => goTo("today")}
          role="button"
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); goTo("today"); } }}
          tabIndex={0}
        >
          <Image className="brand-logo" src="/spej-logo.png" alt="Spej" width={480} height={299} priority />
          <span>
            <b>SPEJ OS</b>
            <small>{workspaceContext}</small>
          </span>
        </div>
        <button
          className="mobile-menu"
          onClick={() => setMobileOpen((value) => !value)}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
          aria-controls="main-navigation"
        >
          {mobileOpen ? <X /> : <Menu />}
        </button>
        <nav
          className={classNames("main-nav", mobileOpen && "is-open")}
          aria-label="Main navigation"
          id="main-navigation"
        >
          {visibleNav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={(item.activeTabs || [item.id]).includes(activeTab) ? "active" : ""}
                aria-current={(item.activeTabs || [item.id]).includes(activeTab) ? "page" : undefined}
                onClick={() => goTo(item.id)}
              >
                <Icon size={15} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="top-actions">
          <label className="preview-viewer-select" title="Changes only this demo's layout and sample-data visibility. It does not sign in as or authorize this person. Production uses verified identity and server-side authorization.">
            <span>Demo layout</span>
            <select
              aria-label="Preview demo layout as team member"
              value={viewer.id}
              onChange={(event) => {
                const profile = getTeamViewProfile(event.target.value);
                if (profile) setViewerId(profile.id);
              }}
            >
              {TEAM_VIEW_PROFILES.map((profile) => <option key={profile.id} value={profile.id}>{profile.displayName}</option>)}
            </select>
          </label>
          <button className="status-button" onClick={() => openSettings()} aria-label={`Open settings. ${configuredAreaCount} of 4 data areas configured.`} title="Setup coverage, not live source health">
            <i className={configuredAreaCount === 4 ? "ready" : ""} />
            <span>Setup {configuredAreaCount}/4</span>
          </button>
          <button
            className="icon-button theme-toggle"
            onClick={toggleColorTheme}
            aria-label="Toggle color theme"
            title="Toggle color theme"
          >
            <Sun className="theme-icon-light" size={15} aria-hidden="true" />
            <Moon className="theme-icon-dark" size={15} aria-hidden="true" />
          </button>
          <button
            className={classNames(
              "avatar",
              activeTab === "settings" && "active",
            )}
            onClick={() => openSettings()}
            title="Settings"
          >
            <Settings2 size={15} />
          </button>
        </div>
      </header>
      {syntheticDemo && (
        <div className="synthetic-demo-banner" role="status">
          <ShieldCheck size={15} aria-hidden="true" />
          <span>
            <b>Synthetic executive demo</b> · Fictional organizations, contacts,
            pipeline, projects, and activity. Normal Spej OS data is not loaded.
          </span>
        </div>
      )}
      <main data-record-focus={focusedRecordId !== undefined && recordFocusTabs.includes(activeTab) || undefined}>
        {workspaceSaveError && (
          <div className="workspace-save-error" role="alert">
            <CircleAlert size={16} />
            <span>{workspaceSaveError}</span>
          </div>
        )}
        {activeAccessDecision && !activeAccessDecision.allowed ? (
          <Panel className="recovery-panel"><LockKeyhole size={30}/><p className="eyebrow">Demo layout only</p><h1>This portal is hidden in this preview</h1><p>{activeAccessDecision.explanation} This display choice is not an authentication or authorization decision. Production must enforce access before returning any records.</p><button className="button button-secondary" onClick={() => openSettings(canManageAccess ? "access" : "general")}>Open settings</button></Panel>
        ) : <>
        <WorkspaceSectionNav activeTab={activeTab} goTo={goTo} />
        {activeTab !== "today" && <WorkflowGuide activeTab={activeTab} goTo={(tab) => goTo(tab as Tab)} askSosa={(prompt) => { setAgentCommand(prompt); goTo("agent"); }} />}
        {focusedRecordId !== undefined && recordFocusTabs.includes(activeTab) && <section className="record-focus-notice" aria-label="Linked record view"><div><strong>Linked record view{activeTab === "tasks" || activeTab === "delivery-work" ? " · includes its task family" : ""}</strong><p>Only the linked record is shown below. Summary totals are not narrowed by this link. If it was removed or archived, choose Show all.</p></div><button className="button button-secondary" onClick={() => goTo(activeTab)}>Show all</button></section>}
        {activeTab === "today" && (
          <TodayView
            canViewTab={(route) => evaluatePortalAccess({ subject: currentAccessProfile.subject, roles: PREVIEW_ACCESS_ROLES, portalId: tabPortal(route as Tab), tenantPolicy: currentTenantPolicy }).allowed}
            grantedModuleIds={currentAccessProfile.availableHomeModuleIds || []}
            settings={settings}
            viewer={viewer}
            agentCommand={agentCommand}
            setAgentCommand={setAgentCommand}
            tasks={tasks}
            opportunities={opportunities}
            partnerships={partnerships}
            projects={projects}
            campaigns={campaigns}
            content={content}
            accounts={accounts}
            contacts={contacts}
            activities={activities}
            goTo={goTo}
            openSettings={openSettings}
            addBriefTask={addBriefTask}
            completeTask={(task) => {
              if (tasks.some((item) => !item.done && String(item.parentId) === String(task.id))) return;
              setTasks((items) => completeTaskItems(items, task.id, { expectedDue: task.due }));
            }}
          />
        )}{" "}
        {activeTab === "gtm" && (
          <GtmWorkspaceHome accounts={accounts} contacts={contacts} opportunities={opportunities} partnerships={partnerships} campaigns={campaigns} content={content} tasks={tasks} projects={projects} goTo={goTo} />
        )}{" "}
        {activeTab === "gtm-linkedin" && (
          <RelationshipsView key={`gtm-linkedin:${viewer.id}`} initialFocus="531" defaultOwner={viewer.displayName} accounts={accounts} setAccounts={setAccounts} contacts={contacts} setContacts={setContacts} activities={activities} setActivities={setActivities} campaigns={campaigns} tasks={tasks} opportunities={opportunities} projects={projects} partnerships={partnerships} goTo={goTo} addTask={addOperationsTask} />
        )}{" "}
        {activeTab === "delivery" && (
          <DeliveryWorkspaceHome accounts={accounts} opportunities={opportunities} projects={projects} tasks={tasks} goTo={goTo} />
        )}{" "}
        <div hidden={activeTab !== "agent"}>
          <SpejAgent
            command={agentCommand}
            setCommand={setAgentCommand}
            initialIntakeId={activeTab === "agent" && typeof focusedRecordId === "string" ? focusedRecordId : undefined}
            settings={settings}
            workspace={{ reminders, tasks, content, accounts, contacts, activities, opportunities, partnerships, projects, campaigns, marketingMetrics }}
            onApply={(next) => {
              setReminders(next.reminders);
              setTasks(next.tasks);
              setContent(next.content);
              setAccounts(next.accounts);
              setContacts(next.contacts);
              setActivities(next.activities);
              setOpportunities(next.opportunities);
              setPartnerships(next.partnerships);
              setProjects(next.projects);
              setCampaigns(next.campaigns);
              setMarketingMetrics(next.marketingMetrics);
              setToast("SOSA changes applied");
            }}
            openAiSettings={() => openSettings("ai")}
          />
        </div>
        {activeTab === "relationships" && (
          <RelationshipsView key={`${viewer.id}:${focusedRecordId || "accounts"}`} initialFocus={focusedRecordId} defaultOwner={viewer.displayName} accounts={accounts} setAccounts={setAccounts} contacts={contacts} setContacts={setContacts} activities={activities} setActivities={setActivities} campaigns={campaigns} tasks={tasks} opportunities={opportunities} projects={projects} partnerships={partnerships} goTo={goTo} addTask={addOperationsTask} />
        )}{" "}
        {activeTab === "pipeline" && (
          <PipelineView key={`${viewer.id}:${focusedRecordId || "pipeline"}`} initialFocus={focusedRecordId} defaultOwner={viewer.displayName} opportunities={opportunities} setOpportunities={setOpportunities} accounts={accounts} contacts={contacts} activities={activities} addTask={addOperationsTask} />
        )}{" "}
        {activeTab === "partnerships" && (
          <PartnershipsView key={`${viewer.id}:${focusedRecordId || "partnerships"}`} initialFocus={focusedRecordId} defaultOwner={viewer.displayName} partnerships={partnerships} setPartnerships={setPartnerships} accounts={accounts} addTask={addOperationsTask} />
        )}{" "}
        {activeTab === "projects" && (
          <ProjectsView key={`delivery:${viewer.id}:${focusedRecordId || "projects"}`} workspace="delivery" initialFocus={focusedRecordId} defaultOwner={viewer.displayName} projects={projects} setProjects={setProjects} accounts={accounts} opportunities={opportunities} addTask={addOperationsTask} />
        )}{" "}
        {activeTab === "gtm-initiatives" && (
          <ProjectsView key={`gtm:${viewer.id}:${focusedRecordId || "initiatives"}`} workspace="gtm" initialFocus={focusedRecordId} defaultOwner={viewer.displayName} projects={projects} setProjects={setProjects} accounts={accounts} opportunities={opportunities} addTask={addOperationsTask} />
        )}{" "}
        {activeTab === "intelligence" && (
          <IntelligenceHub goTo={goTo} />
        )}{" "}
        {activeTab === "industry" && (
          <IndustryView
            saveStory={(story) =>
              addReminder(story.title, story.summary, story.url)
            }
            addContentIdea={addContentIdea}
            openSettings={() => openSettings("industry")}
          />
        )}{" "}
        {activeTab === "mentions" && (
          <MentionsView
            saveStory={(story) =>
              addReminder(story.title, story.summary, story.url)
            }
            openSettings={() => openSettings("mentions")}
          />
        )}{" "}
        {activeTab === "reminders" && (
          <RemindersView
            reminders={reminders}
            addReminder={addReminder}
            archiveReminder={(id, archived) =>
              setReminders((values) =>
                values.map((item) =>
                  item.id === id
                    ? {
                        ...item,
                        archivedAt: archived
                          ? new Date().toISOString()
                          : undefined,
                      }
                    : item,
                ),
              )
            }
          />
        )}{" "}
        {activeTab === "audience" && (
          <AudienceView openSettings={() => openSettings("audience")} />
        )}{" "}
        {activeTab === "newsletters" && (
          <NewslettersView
            addReminder={addReminder}
            addContentIdea={addContentIdea}
            openSettings={() => openSettings("newsletters")}
            openAiSettings={() => openSettings("ai")}
          />
        )}{" "}
        {activeTab === "content" && (
          <ContentView key={`${viewer.id}:${focusedRecordId || "content"}`} initialFocus={focusedRecordId} defaultOwner={viewer.displayName} items={content} setItems={setContent} campaigns={campaigns} addTask={addOperationsTask} />
        )}{" "}
        {activeTab === "campaigns" && (
          <CampaignsView key={`${viewer.id}:${focusedRecordId || "campaigns"}`} initialFocus={focusedRecordId} defaultOwner={viewer.displayName} campaigns={campaigns} setCampaigns={setCampaigns} content={content} tasks={tasks} addTask={addOperationsTask} />
        )}{" "}
        {activeTab === "metrics" && (
          <MarketingMetricsView metrics={marketingMetrics} setMetrics={setMarketingMetrics} accounts={accounts} contacts={contacts} activities={activities} setActivities={setActivities} opportunities={opportunities} campaigns={campaigns} content={content} defaultOwner={viewer.displayName} goTo={goTo} />
        )}{" "}
        {activeTab === "tasks" && (
          <TasksView key={`gtm:${viewer.id}:${focusedRecordId || "tasks"}`} workspace="gtm" initialFocus={focusedRecordId} tasks={tasks} setTasks={setTasks} projects={projects} defaultOwner={viewer.displayName} relatedNames={relatedNames} goTo={goTo} openAccessSettings={() => openSettings("access")} viewer={viewer} />
        )}{" "}
        {activeTab === "delivery-work" && (
          <TasksView key={`delivery:${viewer.id}:${focusedRecordId || "tasks"}`} workspace="delivery" initialFocus={focusedRecordId} tasks={tasks} setTasks={setTasks} projects={projects} defaultOwner={viewer.displayName} relatedNames={relatedNames} goTo={goTo} openAccessSettings={() => openSettings("access")} viewer={viewer} />
        )}{" "}
        {activeTab === "settings" && (
          <SettingsView
            key={viewer.id}
            settings={settings}
            viewer={viewer}
            accessProfiles={previewAccessProfiles}
            setAccessProfiles={setPreviewAccessProfiles}
            moduleFlags={previewModuleFlags}
            setModuleFlags={setPreviewModuleFlags}
            accessAudit={previewAccessAudit}
            setAccessAudit={setPreviewAccessAudit}
            canManageAccess={canManageAccess}
            onSaved={(saved) => {
              clearLiveDataCache();
              setSettings(saved);
            }}
          />
        )}
        </>}
      </main>
      <footer>
        <span>Spej OS preview</span>
        <i />
        <span>{current}</span>
        <small>{syntheticDemo ? "Temporary synthetic workspace · resets when stopped" : "Local pilot · production services not connected"}</small>
      </footer>
      {toast && (
        <div className="toast">
          <CheckCircle2 size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}
