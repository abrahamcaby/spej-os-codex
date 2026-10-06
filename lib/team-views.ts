/**
 * Preview-only team profiles for personalizing the local Spej OS home view.
 *
 * Production must map an authenticated Microsoft Entra object ID to one of the
 * stable profile IDs below on the server. Display names are presentation data,
 * not authorization identifiers, and this module must not be used as an access
 * control boundary.
 */

export const TEAM_VIEW_IDENTITY_NOTICE =
  "Preview profiles only. Production maps each authenticated Microsoft Entra identity to a stable Spej profile ID.";

/** Default local-preview persona; the selector can simulate another persona but never creates a security boundary. */
export const PREVIEW_OPERATOR_PROFILE_ID = "aby" as const;

export const TEAM_FOCUS_AREAS = [
  "GTM",
  "Leadership",
  "Project Management",
  "Content",
  "Technical Delivery",
] as const;

export type TeamFocusArea = (typeof TEAM_FOCUS_AREAS)[number];
export type TeamProfileId = "aby" | "sagar" | "alex" | "joseph" | "ken" | "sean" | "blanca";

export type TeamViewRoute =
  | "today"
  | "agent"
  | "relationships"
  | "gtm"
  | "pipeline"
  | "tasks"
  | "metrics"
  | "delivery"
  | "projects"
  | "delivery-work"
  | "content";

export type TeamViewProfile = {
  readonly id: TeamProfileId;
  readonly displayName: string;
  readonly jobTitle?: string;
  readonly focusAreas: readonly TeamFocusArea[];
  readonly defaultRoute: "today";
  readonly defaultRouteLabel: "My work";
  readonly primaryWorkspaceRoute: TeamViewRoute;
  readonly primaryWorkspaceLabel: string;
  readonly profileSource: "preview";
  readonly productionIdentityProvider: "Microsoft Entra ID";
};

export type TeamHomePriority = {
  readonly id:
    | "assigned-work"
    | "gtm-follow-through"
    | "leadership-review"
    | "project-commitments"
    | "content-work"
    | "technical-delivery";
  readonly label: string;
  readonly description: string;
  readonly route: TeamViewRoute;
  readonly focusArea?: TeamFocusArea;
};

/**
 * A role module is a focused, actionable view on My Work. Profiles can receive
 * more than one module, so mixed responsibilities are composed instead of
 * being collapsed into a single "primary" role.
 *
 * Administration is intentionally not a role module. Production grants it as
 * a separate capability with its own audit and access rules.
 */
export type TeamHomeModule = {
  readonly id: "leadership" | "gtm" | "projects" | "content-qa" | "technical";
  readonly label: string;
  readonly description: string;
  readonly route: TeamViewRoute;
  readonly focusArea: TeamFocusArea;
};

export type TeamHomeLink = {
  readonly id:
    | "my-work"
    | "sosa"
    | "crm"
    | "gtm"
    | "scorecard"
    | "project-management"
    | "content-studio"
    | "technical-work";
  readonly label: string;
  readonly route: TeamViewRoute;
};

export type TeamViewerReference =
  | TeamProfileId
  | TeamViewProfile
  | { readonly profileId?: string | null; readonly displayName?: string | null }
  | string
  | null
  | undefined;

const PROFILE_DEFAULTS = {
  jobTitle: "",
  defaultRoute: "today",
  defaultRouteLabel: "My work",
  profileSource: "preview",
  productionIdentityProvider: "Microsoft Entra ID",
} as const;

export const TEAM_VIEW_PROFILES = [
  {
    ...PROFILE_DEFAULTS,
    id: "aby",
    displayName: "Aby",
    focusAreas: ["GTM", "Content"],
    primaryWorkspaceRoute: "gtm",
    primaryWorkspaceLabel: "GTM",
  },
  {
    ...PROFILE_DEFAULTS,
    id: "sagar",
    displayName: "Sagar",
    focusAreas: ["GTM", "Leadership"],
    primaryWorkspaceRoute: "gtm",
    primaryWorkspaceLabel: "GTM",
  },
  {
    ...PROFILE_DEFAULTS,
    id: "alex",
    displayName: "Alex",
    focusAreas: ["Leadership", "Project Management"],
    primaryWorkspaceRoute: "delivery",
    primaryWorkspaceLabel: "Project Management",
  },
  {
    ...PROFILE_DEFAULTS,
    id: "joseph",
    displayName: "Joseph",
    focusAreas: ["Project Management"],
    primaryWorkspaceRoute: "delivery",
    primaryWorkspaceLabel: "Project Management",
  },
  {
    ...PROFILE_DEFAULTS,
    id: "ken",
    displayName: "Ken",
    focusAreas: ["Project Management", "Content"],
    primaryWorkspaceRoute: "delivery",
    primaryWorkspaceLabel: "Project Management",
  },
  {
    ...PROFILE_DEFAULTS,
    id: "sean",
    displayName: "Sean",
    focusAreas: ["Technical Delivery", "Project Management"],
    primaryWorkspaceRoute: "delivery",
    primaryWorkspaceLabel: "Project Management",
  },
  {
    ...PROFILE_DEFAULTS,
    id: "blanca",
    displayName: "Blanca",
    jobTitle: "Associate Developer",
    focusAreas: ["Technical Delivery", "Project Management"],
    primaryWorkspaceRoute: "delivery-work",
    primaryWorkspaceLabel: "Engineering projects",
  },
] as const satisfies readonly TeamViewProfile[];

const ASSIGNED_WORK_PRIORITY: TeamHomePriority = {
  id: "assigned-work",
  label: "My assigned work",
  description: "Open tasks and subtasks assigned to this profile, ordered by deadline and priority.",
  route: "today",
};

const PRIORITY_BY_FOCUS: Record<TeamFocusArea, TeamHomePriority> = {
  GTM: {
    id: "gtm-follow-through",
    label: "Sales and marketing work",
    description: "Assigned sales, partnership, marketing, and campaign actions.",
    route: "tasks",
    focusArea: "GTM",
  },
  Leadership: {
    id: "leadership-review",
    label: "Reviews and decisions",
    description: "Assigned approvals, blocked work, deadlines, and cross-team handoffs.",
    route: "today",
    focusArea: "Leadership",
  },
  "Project Management": {
    id: "project-commitments",
    label: "Project work",
    description: "Assigned project tasks, subtasks, milestones, and items waiting on action.",
    route: "delivery-work",
    focusArea: "Project Management",
  },
  Content: {
    id: "content-work",
    label: "Content and reviews",
    description: "Assigned content production, review, and publishing actions.",
    route: "content",
    focusArea: "Content",
  },
  "Technical Delivery": {
    id: "technical-delivery",
    label: "Technical delivery",
    description: "Assigned technical project work and delivery handoffs.",
    route: "delivery-work",
    focusArea: "Technical Delivery",
  },
};

const MODULE_BY_FOCUS: Record<TeamFocusArea, TeamHomeModule> = {
  Leadership: {
    id: "leadership",
    label: "Company overview",
    description: "Decisions, exceptions, pipeline, and project health that need leadership attention.",
    route: "today",
    focusArea: "Leadership",
  },
  GTM: {
    id: "gtm",
    label: "Sales & marketing",
    description: "Opportunities, follow-ups, campaigns, and content that move growth work forward.",
    route: "gtm",
    focusArea: "GTM",
  },
  "Project Management": {
    id: "projects",
    label: "Projects",
    description: "Delivery work, milestones, reviews, and projects that need attention.",
    route: "delivery",
    focusArea: "Project Management",
  },
  Content: {
    id: "content-qa",
    label: "Content & review",
    description: "Content production, requested changes, approvals, and quality checks.",
    route: "content",
    focusArea: "Content",
  },
  "Technical Delivery": {
    id: "technical",
    label: "Technical work",
    description: "Technical commitments, blocked work, reviews, and delivery handoffs. Admin access is separate.",
    route: "delivery-work",
    focusArea: "Technical Delivery",
  },
};

export const TEAM_HOME_MODULES: readonly TeamHomeModule[] = Object.values(MODULE_BY_FOCUS);

const CORE_HOME_LINKS: readonly TeamHomeLink[] = [
  { id: "my-work", label: "My work", route: "today" },
  { id: "sosa", label: "Ask SOSA", route: "agent" },
  { id: "crm", label: "CRM", route: "relationships" },
];

const LINK_BY_FOCUS: Record<TeamFocusArea, TeamHomeLink> = {
  GTM: { id: "gtm", label: "Sales & marketing", route: "gtm" },
  Leadership: { id: "scorecard", label: "Performance", route: "metrics" },
  "Project Management": {
    id: "project-management",
    label: "Projects",
    route: "delivery",
  },
  Content: { id: "content-studio", label: "Content", route: "content" },
  "Technical Delivery": {
    id: "technical-work",
    label: "Technical work",
    route: "delivery-work",
  },
};

function normalizeIdentityLabel(value: unknown) {
  return typeof value === "string"
    ? value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US")
    : "";
}

function viewerLookupValue(viewer: TeamViewerReference) {
  if (typeof viewer === "string") return viewer;
  if (!viewer || typeof viewer !== "object") return "";
  if ("id" in viewer) return viewer.id;
  return viewer.profileId || viewer.displayName || "";
}

/** Resolve a preview profile for presentation only; never use this for authorization. */
export function getTeamViewProfile(viewer: TeamViewerReference) {
  const lookup = normalizeIdentityLabel(viewerLookupValue(viewer));
  if (!lookup) return undefined;
  return TEAM_VIEW_PROFILES.find(
    (profile) =>
      normalizeIdentityLabel(profile.id) === lookup ||
      normalizeIdentityLabel(profile.displayName) === lookup,
  );
}

/**
 * Match a task-style owner value to the selected preview profile.
 * Missing owners remain unassigned instead of silently defaulting to one person.
 * This is a view filter, not an authorization check.
 */
export function ownerMatchesViewer(owner: unknown, viewer: TeamViewerReference) {
  const profile = getTeamViewProfile(viewer);
  const ownerLabel = normalizeIdentityLabel(owner);
  if (!profile || !ownerLabel || ownerLabel === "unassigned") return false;
  return (
    ownerLabel === normalizeIdentityLabel(profile.id) ||
    ownerLabel === normalizeIdentityLabel(profile.displayName)
  );
}

/**
 * Match an owned record to a preview profile. A stable ownerProfileId is
 * authoritative when present; the owner label is only a migration fallback.
 */
export function recordOwnerMatchesViewer(
  record: { readonly owner?: unknown; readonly ownerProfileId?: unknown },
  viewer: TeamViewerReference,
) {
  const profile = getTeamViewProfile(viewer);
  if (!profile) return false;
  if (record.ownerProfileId !== undefined) {
    return normalizeIdentityLabel(record.ownerProfileId) === normalizeIdentityLabel(profile.id);
  }
  return ownerMatchesViewer(record.owner, profile);
}

export function getRoleHomePriorities(viewer: TeamViewerReference): TeamHomePriority[] {
  const profile = getTeamViewProfile(viewer);
  if (!profile) return [];
  return [ASSIGNED_WORK_PRIORITY, ...profile.focusAreas.map((focus) => PRIORITY_BY_FOCUS[focus])]
    .map((priority) => ({ ...priority }));
}

/** Return at most two composable role modules for the common My Work page. */
export function getRoleHomeModules(viewer: TeamViewerReference): TeamHomeModule[] {
  const profile = getTeamViewProfile(viewer);
  if (!profile) return [];
  return profile.focusAreas.slice(0, 2).map((focus) => ({ ...MODULE_BY_FOCUS[focus] }));
}

export function getRoleHomeLinks(viewer: TeamViewerReference): TeamHomeLink[] {
  const profile = getTeamViewProfile(viewer);
  if (!profile) return [];
  const links = [...CORE_HOME_LINKS, ...profile.focusAreas.map((focus) => LINK_BY_FOCUS[focus])];
  const seenRoutes = new Set<TeamViewRoute>();
  return links.flatMap((link) => {
    if (seenRoutes.has(link.route)) return [];
    seenRoutes.add(link.route);
    return [{ ...link }];
  });
}
