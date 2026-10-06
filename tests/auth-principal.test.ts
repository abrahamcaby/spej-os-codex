import assert from "node:assert/strict";
import test from "node:test";
import {
  assertTenantAccess,
  createLocalPreviewPrincipal,
  hasPermission,
  normalizeAuthenticatedPrincipal,
  principalCanAccessRecord,
  requirePermission,
  resolvePrincipal,
} from "../lib/server/auth/principal";

test("production identity fails closed without a verified principal", () => {
  assert.throws(() => resolvePrincipal({ runtime: "production" }), /Authentication is required/);
  assert.throws(() => resolvePrincipal({ runtime: "production", supplied: createLocalPreviewPrincipal() }), /not allowed in production/);
});

test("local preview identity is explicit, limited, and never has integration permissions", () => {
  assert.throws(() => resolvePrincipal({ runtime: "local-preview" }), /Authentication is required/);
  const principal = resolvePrincipal({ runtime: "local-preview", allowLocalPreview: true });
  assert.equal(principal.tenantId, "local-preview");
  assert.equal(hasPermission(principal, "records.commit"), true);
  assert.equal(hasPermission(principal, "external.send"), false);
});

test("normalized principals enforce identity, dates, and bounded scopes", () => {
  const principal = normalizeAuthenticatedPrincipal({
    subject: "user:123",
    tenantId: "tenant-a",
    authMethod: "oidc",
    permissions: ["records.read", "records.read"],
    roles: ["gtm"],
    recordScope: { kinds: ["account"], ids: ["account-1"] },
    issuedAt: "2026-09-02T10:00:00Z",
    expiresAt: "2026-09-02T12:00:00Z",
  });
  assert.deepEqual(principal.permissions, ["records.read"]);
  assert.equal(principalCanAccessRecord(principal, { kind: "account", id: "account-1" }), true);
  assert.equal(principalCanAccessRecord(principal, { kind: "contact", id: "account-1" }), false);
  assert.equal(principalCanAccessRecord(principal, { kind: "account", id: "account-2" }), false);
  assert.throws(() => resolvePrincipal({ runtime: "production", supplied: principal, now: new Date("2026-09-02T12:00:00Z") }), /expired/);
  assert.throws(() => normalizeAuthenticatedPrincipal({ ...principal, expiresAt: "2026-09-02T09:00:00Z" }), /expiry must be after/);
});

test("tenant and permission checks cannot be overridden by caller data", () => {
  const principal = normalizeAuthenticatedPrincipal({ subject: "service:one", tenantId: "tenant-a", authMethod: "service", permissions: ["records.read"] });
  assert.doesNotThrow(() => requirePermission(principal, "records.read"));
  assert.throws(() => requirePermission(principal, "records.commit"), /Permission denied/);
  assert.throws(() => assertTenantAccess(principal, "tenant-b"), /Cross-tenant/);
});

test("an explicit wildcard permission is accepted without weakening invalid input validation", () => {
  const admin = normalizeAuthenticatedPrincipal({ subject: "admin", tenantId: "tenant-a", authMethod: "oidc", permissions: ["*"] });
  assert.equal(hasPermission(admin, "external.write"), true);
  assert.throws(() => normalizeAuthenticatedPrincipal({ subject: "bad space", tenantId: "tenant-a", authMethod: "oidc", permissions: ["records.read"] }), /subject/);
  assert.throws(() => normalizeAuthenticatedPrincipal({ subject: "user", tenantId: "tenant-a", authMethod: "cookie", permissions: ["records.read"] }), /authentication method/);
  assert.throws(() => normalizeAuthenticatedPrincipal({ subject: "user", tenantId: "tenant-a", authMethod: "oidc", permissions: ["records.admin"] }), /unsupported entry/);
});
