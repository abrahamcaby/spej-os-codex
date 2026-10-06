import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAuthenticatedPrincipal } from "../lib/server/auth/principal";
import { principalCanChangeTaskAccess, principalCanEditTask, principalCanReadTask, type CanonicalTaskAccess } from "../lib/server/auth/task-visibility";

const privateTask: CanonicalTaskAccess = {
  tenantId: "spej",
  id: "task-private",
  ownerProfileId: "profile-owner",
  workspaceId: "gtm",
  visibility: "Private",
};

const owner = normalizeAuthenticatedPrincipal({
  subject: "entra-owner",
  profileId: "profile-owner",
  tenantId: "spej",
  authMethod: "oidc",
  permissions: ["records.read", "records.commit"],
});

const teammate = normalizeAuthenticatedPrincipal({
  subject: "entra-team",
  profileId: "profile-team",
  tenantId: "spej",
  authMethod: "oidc",
  permissions: ["records.read", "records.commit"],
});

test("production task policy separates owner, workspace, and company reads", () => {
  assert.equal(principalCanReadTask(owner, privateTask, { workspaceIds: ["gtm"] }), true);
  assert.equal(principalCanReadTask(teammate, privateTask, { workspaceIds: ["gtm"] }), false);
  assert.equal(principalCanReadTask(teammate, { ...privateTask, visibility: "Workspace" }, { workspaceIds: ["gtm"] }), true);
  assert.equal(principalCanReadTask(teammate, { ...privateTask, visibility: "Workspace" }, { workspaceIds: ["project-management"] }), false);
  assert.equal(principalCanReadTask(teammate, { ...privateTask, visibility: "Company" }, { workspaceIds: [] }), true);
});

test("production ownership fails closed without a stable Spej profile mapping", () => {
  const unmapped = normalizeAuthenticatedPrincipal({
    subject: privateTask.ownerProfileId,
    tenantId: "spej",
    authMethod: "oidc",
    permissions: ["records.read", "records.commit"],
  });
  assert.equal(principalCanReadTask(unmapped, privateTask, { workspaceIds: ["gtm"] }), false);
  assert.equal(principalCanEditTask(unmapped, privateTask, { workspaceIds: ["gtm"], managedWorkspaceIds: ["gtm"] }), false);
});

test("access administration does not automatically disclose private task content", () => {
  const accessAdmin = normalizeAuthenticatedPrincipal({
    subject: "entra-admin",
    profileId: "profile-admin",
    tenantId: "spej",
    authMethod: "oidc",
    permissions: ["records.read", "records.commit", "access.manage"],
  });
  const context = { workspaceIds: ["gtm"] as const, accessAdministrationWorkspaceIds: ["gtm", "company"] as const };
  assert.equal(principalCanReadTask(accessAdmin, privateTask, context), false);
  assert.equal(principalCanChangeTaskAccess(accessAdmin, privateTask, { ...privateTask, workspaceId: "company" }, context), true);
});

test("private break-glass access is exact and edit rights remain separate", () => {
  assert.equal(principalCanReadTask(teammate, privateTask, { workspaceIds: [], privateReadTaskIds: [privateTask.id] }), true);
  assert.equal(principalCanEditTask(teammate, privateTask, { workspaceIds: [], privateReadTaskIds: [privateTask.id], managedWorkspaceIds: ["gtm"] }), false);
  assert.equal(principalCanEditTask(teammate, { ...privateTask, visibility: "Workspace" }, { workspaceIds: ["gtm"], managedWorkspaceIds: ["gtm"] }), true);
  assert.equal(principalCanEditTask(teammate, { ...privateTask, visibility: "Company" }, { workspaceIds: ["gtm"], managedWorkspaceIds: ["gtm"] }), false);
});

test("tenant and record scope are enforced before task policy", () => {
  const wrongTenant = normalizeAuthenticatedPrincipal({ subject: "other", tenantId: "other", authMethod: "oidc", permissions: ["records.read"] });
  const wrongKind = normalizeAuthenticatedPrincipal({ subject: "limited", tenantId: "spej", authMethod: "oidc", permissions: ["records.read"], recordScope: { kinds: ["account"] } });
  assert.equal(principalCanReadTask(wrongTenant, { ...privateTask, visibility: "Company" }, { workspaceIds: [] }), false);
  assert.equal(principalCanReadTask(wrongKind, { ...privateTask, visibility: "Company" }, { workspaceIds: [] }), false);
});

test("access changes require commit permission, record scope, and both administrative workspaces", () => {
  const proposed = { ...privateTask, workspaceId: "project-management" as const };
  const withoutCommit = normalizeAuthenticatedPrincipal({ subject: "admin", profileId: "admin", tenantId: "spej", authMethod: "oidc", permissions: ["access.manage"] });
  const scopedElsewhere = normalizeAuthenticatedPrincipal({ subject: "admin", profileId: "admin", tenantId: "spej", authMethod: "oidc", permissions: ["records.commit", "access.manage"], recordScope: { ids: ["another-task"] } });
  const admin = normalizeAuthenticatedPrincipal({ subject: "admin", profileId: "admin", tenantId: "spej", authMethod: "oidc", permissions: ["records.commit", "access.manage"] });
  assert.equal(principalCanChangeTaskAccess(withoutCommit, privateTask, proposed, { workspaceIds: [], accessAdministrationWorkspaceIds: ["gtm", "project-management"] }), false);
  assert.equal(principalCanChangeTaskAccess(scopedElsewhere, privateTask, proposed, { workspaceIds: [], accessAdministrationWorkspaceIds: ["gtm", "project-management"] }), false);
  assert.equal(principalCanChangeTaskAccess(admin, privateTask, proposed, { workspaceIds: [], accessAdministrationWorkspaceIds: ["gtm"] }), false);
  assert.equal(principalCanChangeTaskAccess(admin, privateTask, { ...proposed, tenantId: "other" }, { workspaceIds: [], accessAdministrationWorkspaceIds: ["gtm", "project-management"] }), false);
});

test("owner and company visibility changes require explicit administrative scope", () => {
  const admin = normalizeAuthenticatedPrincipal({ subject: "admin", profileId: "admin", tenantId: "spej", authMethod: "oidc", permissions: ["records.commit", "access.manage"] });
  const reassigned = { ...privateTask, ownerProfileId: "profile-new" };
  assert.equal(principalCanChangeTaskAccess(admin, privateTask, reassigned, { workspaceIds: [], accessAdministrationWorkspaceIds: ["gtm"] }), false);
  assert.equal(principalCanChangeTaskAccess(admin, privateTask, reassigned, { workspaceIds: [], accessAdministrationWorkspaceIds: ["gtm"], assignableProfileIds: ["profile-new"] }), true);
  assert.equal(principalCanChangeTaskAccess(admin, privateTask, { ...privateTask, visibility: "Company" }, { workspaceIds: [], accessAdministrationWorkspaceIds: ["gtm"] }), false);
  assert.equal(principalCanChangeTaskAccess(admin, privateTask, { ...privateTask, visibility: "Company" }, { workspaceIds: [], accessAdministrationWorkspaceIds: ["gtm", "company"] }), true);
});

test("subtask access cannot be broadened or detached through an access change", () => {
  const admin = normalizeAuthenticatedPrincipal({ subject: "admin", profileId: "admin", tenantId: "spej", authMethod: "oidc", permissions: ["records.commit", "access.manage"] });
  const parent = { ...privateTask, id: "parent" };
  const child = { ...privateTask, id: "child", parentTaskId: "parent" };
  const context = { workspaceIds: [] as const, accessAdministrationWorkspaceIds: ["gtm", "project-management", "company"] as const, parentTask: parent };
  assert.equal(principalCanChangeTaskAccess(admin, child, { ...child, visibility: "Workspace" }, context), false);
  assert.equal(principalCanChangeTaskAccess(admin, child, { ...child, workspaceId: "project-management" }, context), false);
  assert.equal(principalCanChangeTaskAccess(admin, child, { ...child, parentTaskId: undefined }, context), false);
  assert.equal(principalCanChangeTaskAccess(admin, child, child, context), true);
});
