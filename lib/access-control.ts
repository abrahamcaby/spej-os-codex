/**
 * Tenant-aware reference authorization policy for the Spej OS preview.
 *
 * This module is deliberately storage- and identity-provider-neutral. Production
 * must load roles, memberships, grants, and denies from trusted server-side
 * services after authenticating the caller. Never accept an AccessSubject or
 * AccessRole supplied by a browser as authorization evidence.
 */

export const ACCESS_CONTROL_REFERENCE_NOTICE =
  "Reference policy only. Production must authenticate the caller and enforce access on the server before returning records, counts, search results, files, or SOSA context.";

export type AccessCapability = "view" | "create" | "edit" | "approve" | "export" | "delete" | "admin";

export type AccessDataScope = "own" | "assigned" | "team" | "selected-records" | "company";

export type AccessRuleEffect = "allow" | "deny";

export type AccessRule = {
  /** Stable policy ID used in audit events. */
  readonly id: string;
  readonly tenantId: string;
  readonly effect: AccessRuleEffect;
  /** Stable portal/module IDs. An empty list never matches. */
  readonly portalIds: readonly string[];
  readonly capabilities: readonly AccessCapability[];
  readonly scopes: readonly AccessDataScope[];
  /** Separate navigation visibility from record/action authority. Defaults to both for compatibility. */
  readonly boundary?: "portal" | "records" | "both";
  /** Optional narrowing filters. */
  readonly recordKinds?: readonly string[];
  readonly recordIds?: readonly string[];
  /** Optional field-level narrowing for sensitive values within a record. */
  readonly fieldIds?: readonly string[];
  readonly teamIds?: readonly string[];
  /** ISO timestamps. Invalid timestamps fail closed. */
  readonly startsAt?: string;
  readonly expiresAt?: string;
  /** Short administrative context; never interpreted as policy. */
  readonly reason?: string;
};

export type AccessRole = {
  readonly id: string;
  readonly tenantId: string;
  readonly label: string;
  readonly description?: string;
  readonly rules: readonly AccessRule[];
};

export type AccessSubject = {
  /** Stable identity-provider subject or service-principal ID. */
  readonly principalId: string;
  readonly tenantId: string;
  /** Stable internal profile ID used by owner and assignee fields. */
  readonly profileId?: string;
  readonly roleIds: readonly string[];
  readonly teamIds: readonly string[];
  readonly principalType?: "person" | "service";
  /** Optional per-identity switches retained from existing Spej OS administration. */
  readonly featureIds?: readonly string[];
  readonly disabledPortalIds?: readonly string[];
  /** Direct temporary grants and explicit denies layered over role defaults. */
  readonly directRules?: readonly AccessRule[];
};

export type AccessResource = {
  readonly tenantId: string;
  readonly portalId: string;
  readonly kind: string;
  readonly id?: string;
  readonly ownerProfileId?: string;
  readonly assigneeProfileIds?: readonly string[];
  readonly teamIds?: readonly string[];
  /** Confidential records require an exact record-ID allow. */
  readonly confidential?: boolean;
  /** Connector/document features required in addition to normal record access. */
  readonly requiredFeatureIds?: readonly string[];
};

export type AccessTenantPolicy = {
  readonly tenantId: string;
  /** Existing feature/module flags can disable a portal before role evaluation. */
  readonly disabledPortalIds?: readonly string[];
  /** Identity or API-key revocation is normally enforced upstream; this closes the reference boundary too. */
  readonly revokedPrincipalIds?: readonly string[];
};

export type AccessDecisionCode =
  | "allowed"
  | "default-deny"
  | "explicit-deny"
  | "cross-tenant"
  | "confidential-record"
  | "restricted-field"
  | "portal-disabled"
  | "feature-disabled"
  | "principal-revoked"
  | "invalid-subject";

export type AccessDecision = {
  readonly allowed: boolean;
  readonly code: AccessDecisionCode;
  readonly explanation: string;
  readonly matchedAllowRuleIds: readonly string[];
  readonly matchedDenyRuleIds: readonly string[];
  readonly ignoredExpiredRuleIds: readonly string[];
  readonly ignoredFutureRuleIds: readonly string[];
  readonly ignoredInvalidRuleIds: readonly string[];
  readonly unknownRoleIds: readonly string[];
};

type RuleOrigin = {
  readonly rule: AccessRule;
  readonly origin: "role" | "direct";
  readonly roleId?: string;
};

const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;
const CAPABILITIES = new Set<AccessCapability>(["view", "create", "edit", "approve", "export", "delete", "admin"]);
const SCOPES = new Set<AccessDataScope>(["own", "assigned", "team", "selected-records", "company"]);

export function isStableAccessId(value: unknown): value is string {
  return typeof value === "string" && STABLE_ID.test(value);
}

function validIdList(values: unknown, allowEmpty = false): values is readonly string[] | undefined {
  return values === undefined || (Array.isArray(values) && (allowEmpty || values.length > 0) && values.every(isStableAccessId));
}

function isWellFormedRule(rule: AccessRule) {
  if (!rule || typeof rule !== "object") return false;
  if (!isStableAccessId(rule.id) || !isStableAccessId(rule.tenantId)) return false;
  if (rule.effect !== "allow" && rule.effect !== "deny") return false;
  if (rule.boundary !== undefined && rule.boundary !== "portal" && rule.boundary !== "records" && rule.boundary !== "both") return false;
  if (!validIdList(rule.portalIds) || !validIdList(rule.recordKinds, true)) return false;
  if (!validIdList(rule.recordIds, true) || !validIdList(rule.fieldIds, true) || !validIdList(rule.teamIds, true)) return false;
  if (!Array.isArray(rule.capabilities) || !Array.isArray(rule.scopes)) return false;
  if (rule.capabilities.length === 0 || rule.scopes.length === 0) return false;
  if (!rule.capabilities.every((capability) => CAPABILITIES.has(capability))) return false;
  if (!rule.scopes.every((scope) => SCOPES.has(scope))) return false;
  if (rule.startsAt !== undefined && (typeof rule.startsAt !== "string" || !Number.isFinite(Date.parse(rule.startsAt)))) return false;
  if (rule.expiresAt !== undefined && (typeof rule.expiresAt !== "string" || !Number.isFinite(Date.parse(rule.expiresAt)))) return false;
  if (rule.startsAt && rule.expiresAt && Date.parse(rule.startsAt) >= Date.parse(rule.expiresAt)) return false;
  return true;
}

function subjectIsWellFormed(subject: AccessSubject) {
  return Boolean(subject && typeof subject === "object") &&
    isStableAccessId(subject.principalId) &&
    isStableAccessId(subject.tenantId) &&
    (subject.profileId === undefined || isStableAccessId(subject.profileId)) &&
    (subject.principalType === undefined || subject.principalType === "person" || subject.principalType === "service") &&
    validIdList(subject.roleIds, true) &&
    validIdList(subject.teamIds, true) &&
    validIdList(subject.featureIds, true) &&
    validIdList(subject.disabledPortalIds, true) &&
    (subject.directRules === undefined || Array.isArray(subject.directRules));
}

function collectRules(subject: AccessSubject, roles: readonly AccessRole[]) {
  const roleById = new Map(
    roles
      .filter((role) => role.tenantId === subject.tenantId && isStableAccessId(role.id))
      .map((role) => [role.id, role] as const),
  );
  const unknownRoleIds = subject.roleIds.filter((roleId) => !roleById.has(roleId));
  const rules: RuleOrigin[] = [];
  for (const roleId of subject.roleIds) {
    const role = roleById.get(roleId);
    if (!role) continue;
    for (const rule of role.rules) rules.push({ rule, origin: "role", roleId });
  }
  for (const rule of subject.directRules || []) rules.push({ rule, origin: "direct" });
  return { rules, unknownRoleIds };
}

function temporalState(rule: AccessRule, nowMs: number) {
  if (!isWellFormedRule(rule) || rule.tenantId === "") return "invalid" as const;
  if (rule.startsAt && Date.parse(rule.startsAt) > nowMs) return "future" as const;
  if (rule.expiresAt && Date.parse(rule.expiresAt) <= nowMs) return "expired" as const;
  return "active" as const;
}

function ruleTargetsPortal(rule: AccessRule, portalId: string, capability: AccessCapability) {
  return rule.portalIds.includes(portalId) && rule.capabilities.includes(capability);
}

function ruleTargetFiltersMatch(rule: AccessRule, resource: AccessResource, fieldId?: string) {
  if (rule.recordKinds && !rule.recordKinds.includes(resource.kind)) return false;
  if (rule.recordIds && (!resource.id || !rule.recordIds.includes(resource.id))) return false;
  if (rule.fieldIds && (!fieldId || !rule.fieldIds.includes(fieldId))) return false;
  if (rule.teamIds) {
    const resourceTeams = new Set(resource.teamIds || []);
    if (!rule.teamIds.some((teamId) => resourceTeams.has(teamId))) return false;
  }
  return true;
}

function boundaryDecision(input: {
  subject: AccessSubject;
  tenantPolicy?: AccessTenantPolicy;
  tenantId: string;
  portalId: string;
  requiredFeatureIds?: readonly string[];
}) {
  if (input.subject.tenantId !== input.tenantId) {
    return emptyDecision("cross-tenant", "Access is denied across organization boundaries.");
  }
  if (input.tenantPolicy && input.tenantPolicy.tenantId !== input.tenantId) {
    return emptyDecision("cross-tenant", "The organization access policy does not match this resource.");
  }
  if (input.tenantPolicy?.revokedPrincipalIds?.includes(input.subject.principalId)) {
    return emptyDecision("principal-revoked", "This identity or service credential has been revoked.");
  }
  if (input.tenantPolicy?.disabledPortalIds?.includes(input.portalId)) {
    return emptyDecision("portal-disabled", "This module is disabled for the organization.");
  }
  if (input.subject.disabledPortalIds?.includes(input.portalId)) {
    return emptyDecision("portal-disabled", "This module is disabled for this identity.");
  }
  const enabledFeatures = new Set(input.subject.featureIds || []);
  const missingFeature = input.requiredFeatureIds?.find((featureId) => !enabledFeatures.has(featureId));
  if (missingFeature) {
    return emptyDecision("feature-disabled", "A required connector or data-access feature is disabled for this identity.");
  }
  return undefined;
}

function ruleScopeMatches(rule: AccessRule, subject: AccessSubject, resource: AccessResource) {
  for (const scope of rule.scopes) {
    if (scope === "company") return true;
    if (scope === "selected-records" && resource.id && rule.recordIds?.includes(resource.id)) return true;
    if (!subject.profileId) continue;
    if (scope === "own" && resource.ownerProfileId === subject.profileId) return true;
    if (scope === "assigned" && resource.assigneeProfileIds?.includes(subject.profileId)) return true;
    if (scope === "team") {
      const subjectTeams = new Set(subject.teamIds);
      if (resource.teamIds?.some((teamId) => subjectTeams.has(teamId))) return true;
    }
  }
  return false;
}

function emptyDecision(
  code: AccessDecisionCode,
  explanation: string,
  details: Partial<Omit<AccessDecision, "allowed" | "code" | "explanation">> = {},
): AccessDecision {
  return {
    allowed: code === "allowed",
    code,
    explanation,
    matchedAllowRuleIds: details.matchedAllowRuleIds || [],
    matchedDenyRuleIds: details.matchedDenyRuleIds || [],
    ignoredExpiredRuleIds: details.ignoredExpiredRuleIds || [],
    ignoredFutureRuleIds: details.ignoredFutureRuleIds || [],
    ignoredInvalidRuleIds: details.ignoredInvalidRuleIds || [],
    unknownRoleIds: details.unknownRoleIds || [],
  };
}

function relevantActiveRules(input: {
  subject: AccessSubject;
  roles: readonly AccessRole[];
  portalId: string;
  capability: AccessCapability;
  now?: Date;
}) {
  const collected = collectRules(input.subject, input.roles);
  const active: RuleOrigin[] = [];
  const ignoredExpiredRuleIds: string[] = [];
  const ignoredFutureRuleIds: string[] = [];
  const ignoredInvalidRuleIds: string[] = [];
  const nowMs = (input.now || new Date()).getTime();
  for (const origin of collected.rules) {
    const state = temporalState(origin.rule, nowMs);
    if (state === "invalid") {
      if (isStableAccessId(origin.rule.id)) ignoredInvalidRuleIds.push(origin.rule.id);
      continue;
    }
    if (!ruleTargetsPortal(origin.rule, input.portalId, input.capability)) continue;
    if (state === "active" && origin.rule.tenantId === input.subject.tenantId) active.push(origin);
    if (state === "expired") ignoredExpiredRuleIds.push(origin.rule.id);
    if (state === "future") ignoredFutureRuleIds.push(origin.rule.id);
  }
  return {
    active,
    ignoredExpiredRuleIds: [...new Set(ignoredExpiredRuleIds)],
    ignoredFutureRuleIds: [...new Set(ignoredFutureRuleIds)],
    ignoredInvalidRuleIds: [...new Set(ignoredInvalidRuleIds)],
    unknownRoleIds: [...new Set(collected.unknownRoleIds)],
  };
}

/**
 * Evaluate whether a portal may be opened. Record-specific grants and denies do
 * not hide or expose an entire portal; record reads require evaluateRecordAccess.
 */
export function evaluatePortalAccess(input: {
  subject: AccessSubject;
  roles: readonly AccessRole[];
  portalId: string;
  capability?: AccessCapability;
  now?: Date;
  tenantPolicy?: AccessTenantPolicy;
}): AccessDecision {
  const capability = input.capability || "view";
  if (!subjectIsWellFormed(input.subject) || !isStableAccessId(input.portalId)) {
    return emptyDecision("invalid-subject", "Access is denied because the identity or portal reference is invalid.");
  }
  const boundary = boundaryDecision({
    subject: input.subject,
    tenantPolicy: input.tenantPolicy,
    tenantId: input.subject.tenantId,
    portalId: input.portalId,
  });
  if (boundary) return boundary;
  const relevant = relevantActiveRules({ ...input, capability });
  const portalRules = relevant.active
    .map(({ rule }) => rule)
    .filter((rule) => rule.boundary !== "records")
    .filter((rule) => !rule.recordIds && !rule.recordKinds && !rule.fieldIds && !rule.teamIds);
  const denyIds = portalRules.filter((rule) => rule.effect === "deny").map((rule) => rule.id);
  const allowIds = portalRules.filter((rule) => rule.effect === "allow").map((rule) => rule.id);
  const details = {
    matchedAllowRuleIds: allowIds,
    matchedDenyRuleIds: denyIds,
    ignoredExpiredRuleIds: relevant.ignoredExpiredRuleIds,
    ignoredFutureRuleIds: relevant.ignoredFutureRuleIds,
    ignoredInvalidRuleIds: relevant.ignoredInvalidRuleIds,
    unknownRoleIds: relevant.unknownRoleIds,
  };
  if (denyIds.length) return emptyDecision("explicit-deny", "An explicit portal denial overrides all grants.", details);
  if (allowIds.length) return emptyDecision("allowed", "An active role or direct grant allows this portal capability.", details);
  return emptyDecision("default-deny", "No active portal grant allows this capability.", details);
}

/** Evaluate one record. A denial always wins, including over direct grants. */
export function evaluateRecordAccess(input: {
  subject: AccessSubject;
  roles: readonly AccessRole[];
  resource: AccessResource;
  capability?: AccessCapability;
  now?: Date;
  tenantPolicy?: AccessTenantPolicy;
}): AccessDecision {
  const capability = input.capability || "view";
  if (!subjectIsWellFormed(input.subject)) {
    return emptyDecision("invalid-subject", "Access is denied because the authenticated identity mapping is invalid.");
  }
  const boundary = boundaryDecision({
    subject: input.subject,
    tenantPolicy: input.tenantPolicy,
    tenantId: input.resource.tenantId,
    portalId: input.resource.portalId,
    requiredFeatureIds: input.resource.requiredFeatureIds,
  });
  if (boundary) return boundary;
  const portal = evaluatePortalAccess({
    subject: input.subject,
    roles: input.roles,
    portalId: input.resource.portalId,
    capability: "view",
    now: input.now,
    tenantPolicy: input.tenantPolicy,
  });
  if (!portal.allowed) return portal;
  const relevant = relevantActiveRules({
    subject: input.subject,
    roles: input.roles,
    portalId: input.resource.portalId,
    capability,
    now: input.now,
  });
  const matches = relevant.active
    .map(({ rule }) => rule)
    .filter((rule) => rule.boundary !== "portal")
    .filter((rule) => ruleTargetFiltersMatch(rule, input.resource))
    .filter((rule) => ruleScopeMatches(rule, input.subject, input.resource));
  const denyIds = matches.filter((rule) => rule.effect === "deny").map((rule) => rule.id);
  let allows = matches.filter((rule) => rule.effect === "allow");
  if (input.resource.confidential) {
    allows = allows.filter((rule) => Boolean(input.resource.id && rule.recordIds?.includes(input.resource.id)));
  }
  const allowIds = allows.map((rule) => rule.id);
  const details = {
    matchedAllowRuleIds: allowIds,
    matchedDenyRuleIds: denyIds,
    ignoredExpiredRuleIds: relevant.ignoredExpiredRuleIds,
    ignoredFutureRuleIds: relevant.ignoredFutureRuleIds,
    ignoredInvalidRuleIds: relevant.ignoredInvalidRuleIds,
    unknownRoleIds: relevant.unknownRoleIds,
  };
  if (denyIds.length) return emptyDecision("explicit-deny", "An explicit record denial overrides all grants.", details);
  if (input.resource.confidential && allowIds.length === 0) {
    return emptyDecision("confidential-record", "This confidential record requires an active exact-record grant.", details);
  }
  if (allowIds.length) return emptyDecision("allowed", "An active rule allows this record capability.", details);
  return emptyDecision("default-deny", "No active rule allows this record capability.", details);
}

/**
 * Evaluate a field after record access. Mark financially sensitive, personal,
 * credential, or similarly protected fields as restricted so they require a
 * field-ID-specific allow in addition to record access.
 */
export function evaluateFieldAccess(input: {
  subject: AccessSubject;
  roles: readonly AccessRole[];
  resource: AccessResource;
  fieldId: string;
  restricted?: boolean;
  capability?: AccessCapability;
  now?: Date;
  tenantPolicy?: AccessTenantPolicy;
}): AccessDecision {
  if (!isStableAccessId(input.fieldId)) {
    return emptyDecision("invalid-subject", "Access is denied because the field reference is invalid.");
  }
  const base = evaluateRecordAccess(input);
  if (!base.allowed) return base;
  const capability = input.capability || "view";
  const relevant = relevantActiveRules({
    subject: input.subject,
    roles: input.roles,
    portalId: input.resource.portalId,
    capability,
    now: input.now,
  });
  const matches = relevant.active
    .map(({ rule }) => rule)
    .filter((rule) => rule.boundary !== "portal")
    .filter((rule) => ruleTargetFiltersMatch(rule, input.resource, input.fieldId))
    .filter((rule) => ruleScopeMatches(rule, input.subject, input.resource));
  const denyIds = matches.filter((rule) => rule.effect === "deny").map((rule) => rule.id);
  const exactFieldAllowIds = matches
    .filter((rule) => rule.effect === "allow" && rule.fieldIds?.includes(input.fieldId))
    .map((rule) => rule.id);
  const inheritedAllowIds = matches
    .filter((rule) => rule.effect === "allow" && !rule.fieldIds)
    .map((rule) => rule.id);
  const details = {
    matchedAllowRuleIds: [...new Set([...base.matchedAllowRuleIds, ...exactFieldAllowIds, ...inheritedAllowIds])],
    matchedDenyRuleIds: denyIds,
    ignoredExpiredRuleIds: relevant.ignoredExpiredRuleIds,
    ignoredFutureRuleIds: relevant.ignoredFutureRuleIds,
    ignoredInvalidRuleIds: relevant.ignoredInvalidRuleIds,
    unknownRoleIds: relevant.unknownRoleIds,
  };
  if (denyIds.length) return emptyDecision("explicit-deny", "An explicit field denial overrides all grants.", details);
  if (input.restricted && exactFieldAllowIds.length === 0) {
    return emptyDecision("restricted-field", "This protected field requires an active field-specific grant.", details);
  }
  return emptyDecision("allowed", input.restricted
    ? "An active field-specific grant allows this protected value."
    : "Record access includes this field.", details);
}

/**
 * Evaluate a tenant-scoped SOSA/MCP/API tool allowlist entry. Tools are treated
 * as confidential records so a broad portal role cannot authorize an unnamed
 * tool. The service gateway still owns authentication, rate limits, and replay
 * protection.
 */
export function evaluateToolAccess(input: {
  subject: AccessSubject;
  roles: readonly AccessRole[];
  tenantId: string;
  toolId: string;
  portalId?: string;
  capability?: AccessCapability;
  now?: Date;
  tenantPolicy?: AccessTenantPolicy;
}): AccessDecision {
  return evaluateRecordAccess({
    subject: input.subject,
    roles: input.roles,
    resource: {
      tenantId: input.tenantId,
      portalId: input.portalId || "sosa",
      kind: "tool",
      id: input.toolId,
      confidential: true,
    },
    capability: input.capability,
    now: input.now,
    tenantPolicy: input.tenantPolicy,
  });
}

/**
 * Server-side boundary for search, RAG, SOSA context, counts, and summaries.
 * Filter complete records before deriving snippets, embeddings, totals, or model
 * context so unauthorized metadata cannot leak through aggregation.
 */
export function filterAuthorizedRecords<T extends AccessResource>(input: {
  subject: AccessSubject;
  roles: readonly AccessRole[];
  records: readonly T[];
  capability?: AccessCapability;
  now?: Date;
  tenantPolicy?: AccessTenantPolicy;
}): T[] {
  return input.records.filter((resource) => evaluateRecordAccess({
    subject: input.subject,
    roles: input.roles,
    resource,
    capability: input.capability,
    now: input.now,
    tenantPolicy: input.tenantPolicy,
  }).allowed);
}

export type EffectivePortalAccess = {
  readonly portalId: string;
  readonly capabilities: readonly AccessCapability[];
  readonly explanations: Readonly<Partial<Record<AccessCapability, AccessDecision>>>;
};

/** Explain effective portal access without exposing record contents. */
export function explainEffectivePortalAccess(input: {
  subject: AccessSubject;
  roles: readonly AccessRole[];
  portalIds: readonly string[];
  now?: Date;
  tenantPolicy?: AccessTenantPolicy;
}): EffectivePortalAccess[] {
  const capabilities: readonly AccessCapability[] = ["view", "create", "edit", "approve", "export", "delete", "admin"];
  return input.portalIds.map((portalId) => {
    const explanations: Partial<Record<AccessCapability, AccessDecision>> = {};
    const allowed: AccessCapability[] = [];
    for (const capability of capabilities) {
      const decision = evaluatePortalAccess({ ...input, portalId, capability });
      explanations[capability] = decision;
      if (decision.allowed) allowed.push(capability);
    }
    return { portalId, capabilities: allowed, explanations };
  });
}
