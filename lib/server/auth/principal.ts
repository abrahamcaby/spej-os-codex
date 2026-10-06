export type AuthenticationMethod = "oidc" | "service" | "local-preview";

export type SpejPermission =
  | "records.read"
  | "records.propose"
  | "records.commit"
  | "audit.read"
  | "integrations.read"
  | "integrations.manage"
  | "access.manage"
  | "external.send"
  | "external.write"
  | "*";

export type RecordAccessScope = {
  /** An omitted list means all record kinds allowed by the caller's permission. */
  kinds?: readonly string[];
  /** An omitted list means all record IDs allowed by the caller's permission. */
  ids?: readonly string[];
};

/**
 * An identity that has already been authenticated by trusted server middleware.
 * This module validates the normalized result; it deliberately does not decode or
 * verify an identity-provider token.
 */
export type AuthenticatedPrincipal = {
  subject: string;
  tenantId: string;
  /** Stable Spej person/profile mapping created by trusted server middleware. */
  profileId?: string;
  displayName?: string;
  authMethod: AuthenticationMethod;
  permissions: readonly SpejPermission[];
  roles?: readonly string[];
  recordScope?: RecordAccessScope;
  issuedAt?: string;
  expiresAt?: string;
};

export type RuntimeMode = "local-preview" | "production";

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;
const SCOPE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;
const PERMISSIONS = new Set<SpejPermission>([
  "records.read",
  "records.propose",
  "records.commit",
  "audit.read",
  "integrations.read",
  "integrations.manage",
  "access.manage",
  "external.send",
  "external.write",
  "*",
]);

function assertIdentifier(value: unknown, label: string) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    throw new Error(`${label} is missing or invalid.`);
  }
  return value;
}

function cleanStringList(value: unknown, label: string, pattern = SCOPE_PATTERN) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new Error(`${label} must contain between 1 and 100 entries.`);
  }
  const cleaned = value.map((entry) => {
    if (typeof entry !== "string" || !pattern.test(entry)) throw new Error(`${label} contains an invalid entry.`);
    return entry;
  });
  return [...new Set(cleaned)];
}

function cleanOptionalDate(value: unknown, label: string) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new Error(`${label} is invalid.`);
  return new Date(value).toISOString();
}

export function normalizeAuthenticatedPrincipal(input: unknown): AuthenticatedPrincipal {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("An authenticated principal is required.");
  const candidate = input as Record<string, unknown>;
  const authMethod = candidate.authMethod;
  if (authMethod !== "oidc" && authMethod !== "service" && authMethod !== "local-preview") {
    throw new Error("The authentication method is invalid.");
  }
  const permissions = cleanStringList(candidate.permissions, "Principal permissions", /^(\*|[A-Za-z][A-Za-z0-9._:/-]{0,199})$/) as SpejPermission[];
  if (permissions.some((permission) => !PERMISSIONS.has(permission))) throw new Error("Principal permissions contain an unsupported entry.");
  const roles = candidate.roles === undefined ? undefined : cleanStringList(candidate.roles, "Principal roles");
  let recordScope: RecordAccessScope | undefined;
  if (candidate.recordScope !== undefined) {
    if (!candidate.recordScope || typeof candidate.recordScope !== "object" || Array.isArray(candidate.recordScope)) {
      throw new Error("The record scope is invalid.");
    }
    const rawScope = candidate.recordScope as Record<string, unknown>;
    const kinds = rawScope.kinds === undefined ? undefined : cleanStringList(rawScope.kinds, "Record kinds");
    const ids = rawScope.ids === undefined ? undefined : cleanStringList(rawScope.ids, "Record IDs", ID_PATTERN);
    recordScope = { ...(kinds ? { kinds } : {}), ...(ids ? { ids } : {}) };
  }
  const issuedAt = cleanOptionalDate(candidate.issuedAt, "Principal issued-at time");
  const expiresAt = cleanOptionalDate(candidate.expiresAt, "Principal expiry time");
  if (issuedAt && expiresAt && Date.parse(issuedAt) >= Date.parse(expiresAt)) {
    throw new Error("The principal expiry must be after its issued-at time.");
  }
  return {
    subject: assertIdentifier(candidate.subject, "Principal subject"),
    tenantId: assertIdentifier(candidate.tenantId, "Principal tenant"),
    ...(candidate.profileId !== undefined ? { profileId: assertIdentifier(candidate.profileId, "Principal profile") } : {}),
    ...(typeof candidate.displayName === "string" && candidate.displayName.trim()
      ? { displayName: candidate.displayName.trim().slice(0, 200) }
      : {}),
    authMethod,
    permissions,
    ...(roles ? { roles } : {}),
    ...(recordScope ? { recordScope } : {}),
    ...(issuedAt ? { issuedAt } : {}),
    ...(expiresAt ? { expiresAt } : {}),
  };
}

export function createLocalPreviewPrincipal(): AuthenticatedPrincipal {
  return Object.freeze({
    subject: "local-preview-user",
    tenantId: "local-preview",
    displayName: "Local preview",
    authMethod: "local-preview",
    permissions: Object.freeze(["records.read", "records.propose", "records.commit"] as SpejPermission[]),
    roles: Object.freeze(["local-preview"]),
  });
}

export function resolvePrincipal(input: {
  runtime: RuntimeMode;
  supplied?: unknown;
  allowLocalPreview?: boolean;
  now?: Date;
}): AuthenticatedPrincipal {
  if (input.supplied === undefined || input.supplied === null) {
    if (input.runtime === "local-preview" && input.allowLocalPreview === true) return createLocalPreviewPrincipal();
    throw new Error("Authentication is required.");
  }
  const principal = normalizeAuthenticatedPrincipal(input.supplied);
  if (input.runtime === "production" && principal.authMethod === "local-preview") {
    throw new Error("Local preview identity is not allowed in production.");
  }
  const now = (input.now ?? new Date()).getTime();
  if (principal.issuedAt && Date.parse(principal.issuedAt) > now + 60_000) throw new Error("The principal is not active yet.");
  if (principal.expiresAt && Date.parse(principal.expiresAt) <= now) throw new Error("The principal has expired.");
  return principal;
}

export function hasPermission(principal: AuthenticatedPrincipal, permission: SpejPermission) {
  return principal.permissions.includes("*") || principal.permissions.includes(permission);
}

export function requirePermission(principal: AuthenticatedPrincipal, permission: SpejPermission) {
  if (!hasPermission(principal, permission)) throw new Error(`Permission denied: ${permission}.`);
}

export function assertTenantAccess(principal: AuthenticatedPrincipal, tenantId: string) {
  if (principal.tenantId !== tenantId) throw new Error("Cross-tenant access is not allowed.");
}

export function principalCanAccessRecord(principal: AuthenticatedPrincipal, record: { id: string; kind: string }) {
  const scope = principal.recordScope;
  if (scope?.kinds && !scope.kinds.includes(record.kind)) return false;
  if (scope?.ids && !scope.ids.includes(record.id)) return false;
  return true;
}
