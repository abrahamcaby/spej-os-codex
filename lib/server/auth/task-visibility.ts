import {
  assertTenantAccess,
  hasPermission,
  principalCanAccessRecord,
  type AuthenticatedPrincipal,
} from "./principal";
import type { TaskVisibility, TaskWorkspaceId } from "../../types";

export type CanonicalTaskAccess = {
  tenantId: string;
  id: string;
  ownerProfileId: string;
  workspaceId: TaskWorkspaceId;
  visibility: TaskVisibility;
  parentTaskId?: string;
};

/** Server-created grants from the production authorization service. */
export type TaskAuthorizationContext = {
  workspaceIds: readonly TaskWorkspaceId[];
  managedWorkspaceIds?: readonly TaskWorkspaceId[];
  accessAdministrationWorkspaceIds?: readonly TaskWorkspaceId[];
  /** Exact, time-bound break-glass grants; administration alone never supplies these. */
  privateReadTaskIds?: readonly string[];
  /** Server-verified profiles an access administrator may assign in this operation. */
  assignableProfileIds?: readonly string[];
  /** Current canonical parent access, required when validating a subtask change. */
  parentTask?: CanonicalTaskAccess;
};

function baseRecordAccess(principal: AuthenticatedPrincipal, task: CanonicalTaskAccess, permission: "records.read" | "records.commit") {
  try {
    assertTenantAccess(principal, task.tenantId);
    return hasPermission(principal, permission) && principalCanAccessRecord(principal, { id: task.id, kind: "task" });
  } catch {
    return false;
  }
}

export function principalCanReadTask(
  principal: AuthenticatedPrincipal,
  task: CanonicalTaskAccess,
  context: TaskAuthorizationContext,
) {
  if (!baseRecordAccess(principal, task, "records.read")) return false;
  if (principal.profileId && task.ownerProfileId === principal.profileId) return true;
  if (task.visibility === "Company") return true;
  if (task.visibility === "Workspace") return context.workspaceIds.includes(task.workspaceId);
  return Boolean(context.privateReadTaskIds?.includes(task.id));
}

export function principalCanEditTask(
  principal: AuthenticatedPrincipal,
  task: CanonicalTaskAccess,
  context: TaskAuthorizationContext,
) {
  if (!baseRecordAccess(principal, task, "records.commit")) return false;
  if (principal.profileId && task.ownerProfileId === principal.profileId) return true;
  if (task.visibility !== "Workspace") return false;
  return Boolean(context.managedWorkspaceIds?.includes(task.workspaceId));
}

/** Access-field administration is separate from reading or editing task content. */
export function principalCanChangeTaskAccess(
  principal: AuthenticatedPrincipal,
  current: CanonicalTaskAccess,
  proposed: CanonicalTaskAccess,
  context: TaskAuthorizationContext,
) {
  if (!hasPermission(principal, "access.manage") || !hasPermission(principal, "records.commit")) return false;
  try {
    assertTenantAccess(principal, current.tenantId);
    assertTenantAccess(principal, proposed.tenantId);
  } catch {
    return false;
  }
  if (current.id !== proposed.id || current.parentTaskId !== proposed.parentTaskId) return false;
  if (!principalCanAccessRecord(principal, { id: current.id, kind: "task" })) return false;
  const scopes = context.accessAdministrationWorkspaceIds || [];
  if (!scopes.includes(current.workspaceId) || !scopes.includes(proposed.workspaceId)) return false;
  if ((current.visibility === "Company" || proposed.visibility === "Company") && !scopes.includes("company")) return false;
  if (current.ownerProfileId !== proposed.ownerProfileId && !context.assignableProfileIds?.includes(proposed.ownerProfileId)) return false;
  if (proposed.parentTaskId) {
    const parent = context.parentTask;
    if (!parent || parent.id !== proposed.parentTaskId || parent.tenantId !== proposed.tenantId) return false;
    if (proposed.workspaceId !== parent.workspaceId || proposed.visibility !== parent.visibility) return false;
    if (parent.visibility === "Private" && proposed.ownerProfileId !== parent.ownerProfileId) return false;
  }
  return true;
}
