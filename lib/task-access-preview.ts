import { getTeamViewProfile, ownerMatchesViewer, type TeamProfileId, type TeamViewerReference } from "./team-views";
import { taskVisibility, taskWorkspaceId } from "./tasks";
import type { ProjectItem, TaskItem, TaskWorkspaceId } from "./types";

export const PREVIEW_ACCESS_NOTICE =
  "Demo visualization only — not authentication or authorization. Production must enforce identity and permissions on the server before returning records, counts, or SOSA context.";

export type PreviewAccessRole = "Member" | "Workspace manager" | "Leadership viewer";

export type PreviewAccessPolicy = {
  readonly profileId: TeamProfileId;
  readonly role: PreviewAccessRole;
  readonly workspaceIds: readonly TaskWorkspaceId[];
};

/**
 * Explicit demo grants used only to show the intended experience. They are not
 * derived from job titles or focus-area labels and are never a production ACL.
 */
export const PREVIEW_ACCESS_POLICIES = [
  { profileId: "aby", role: "Workspace manager", workspaceIds: ["gtm", "company"] },
  { profileId: "sagar", role: "Workspace manager", workspaceIds: ["gtm", "company"] },
  { profileId: "alex", role: "Leadership viewer", workspaceIds: ["project-management", "company"] },
  { profileId: "joseph", role: "Workspace manager", workspaceIds: ["project-management", "company"] },
  { profileId: "ken", role: "Member", workspaceIds: ["gtm", "project-management", "company"] },
  { profileId: "sean", role: "Member", workspaceIds: ["project-management", "company"] },
  { profileId: "blanca", role: "Member", workspaceIds: ["project-management", "company"] },
] as const satisfies readonly PreviewAccessPolicy[];

export function getPreviewAccessPolicy(viewer: TeamViewerReference): PreviewAccessPolicy | undefined {
  const profile = getTeamViewProfile(viewer);
  return profile
    ? PREVIEW_ACCESS_POLICIES.find((policy) => policy.profileId === profile.id)
    : undefined;
}

function ownerProfileId(task: Pick<TaskItem, "owner" | "ownerProfileId">) {
  if (task.ownerProfileId !== undefined) return getTeamViewProfile(task.ownerProfileId)?.id;
  return getTeamViewProfile(task.owner)?.id;
}

export function previewOwnsTask(task: Pick<TaskItem, "owner" | "ownerProfileId">, viewer: TeamViewerReference) {
  const profile = getTeamViewProfile(viewer);
  if (!profile) return false;
  const stableOwnerId = ownerProfileId(task);
  return stableOwnerId === profile.id || (task.ownerProfileId === undefined && ownerMatchesViewer(task.owner, profile));
}

export function previewCanViewTask(task: TaskItem, viewer: TeamViewerReference, projects: ProjectItem[]) {
  const profile = getTeamViewProfile(viewer);
  const policy = getPreviewAccessPolicy(viewer);
  if (!profile || !policy) return false;
  if (previewOwnsTask(task, profile)) return true;
  const visibility = taskVisibility(task);
  if (visibility === "Private") return false;
  if (visibility === "Company") return true;
  return policy.workspaceIds.includes(taskWorkspaceId(task, projects));
}

export function previewCanEditTask(task: TaskItem, viewer: TeamViewerReference, projects: ProjectItem[]) {
  const profile = getTeamViewProfile(viewer);
  const policy = getPreviewAccessPolicy(viewer);
  if (!profile || !policy || !previewCanViewTask(task, profile, projects)) return false;
  if (previewOwnsTask(task, profile)) return true;
  return policy.role === "Workspace manager" &&
    taskVisibility(task) === "Workspace" &&
    policy.workspaceIds.includes(taskWorkspaceId(task, projects));
}

export function previewWorkspaceLabels(policy: PreviewAccessPolicy) {
  return policy.workspaceIds.map((workspace) =>
    workspace === "gtm" ? "GTM" : workspace === "project-management" ? "Project Management" : "Company",
  );
}
