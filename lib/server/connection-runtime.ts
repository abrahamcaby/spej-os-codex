import "server-only";

import type { IntegrationAdapter } from "../integrations/adapter";
import { cleanIsoDateTime } from "../integrations/contracts";
import { CONNECTION_CATALOG, type ConnectionId } from "../integrations/connection-catalog";
import { assertTenantAccess, hasPermission, resolvePrincipal, type AuthenticatedPrincipal } from "./auth/principal";

export type ConnectionRuntimeIdentity = {
  connectionId: ConnectionId;
  tenantId: string;
  provider: string;
  connectorId: string;
};

/** A current verdict from the trusted host, never from a Settings plan or request body. */
export type ConnectionReadAuthorization = ConnectionRuntimeIdentity & {
  principalSubject: string;
  authentication: "ready" | "missing" | "expired";
  consent: "granted" | "missing" | "revoked";
  policy: "allow" | "deny";
  resourceScopes: readonly string[];
  validUntil: string;
};

export type ConnectionRuntimeRegistration = ConnectionRuntimeIdentity & {
  scope: "personal" | "company";
  /** Required for personal registrations; an omitted owner never means shared. */
  ownerSubject?: string;
  adapterType: "microsoft-graph" | "mcp" | "custom";
  /** Only these methods are retained. An adapter's write methods are never exposed. */
  adapter: Pick<IntegrationAdapter, "provider" | "readDelta"> & {
    health(input: Parameters<IntegrationAdapter["health"]>[0] & { signal: AbortSignal }): ReturnType<IntegrationAdapter["health"]>;
  };
  /** The host authenticates credentials and verifies current consent and resource policy. */
  authorizeRead?: (input: ConnectionRuntimeIdentity & {
    principal: AuthenticatedPrincipal;
    correlationId: string;
    signal: AbortSignal;
  }) => Promise<ConnectionReadAuthorization>;
};

export type ConnectionReadinessReason =
  | "adapter-missing"
  | "read-not-implemented"
  | "host-authorization-missing"
  | "authorization-unavailable"
  | "authorization-invalid"
  | "identity-mismatch"
  | "owner-mismatch"
  | "authentication-required"
  | "consent-required"
  | "policy-denied"
  | "health-unavailable"
  | "health-invalid"
  | "health-stale"
  | "health-disabled"
  | "health-degraded"
  | "ready";

export type ConnectionReadiness = {
  connectionId: ConnectionId;
  connectorId: string;
  tenantId: string;
  status: "not-connected" | "blocked" | "degraded" | "ready";
  reason: ConnectionReadinessReason;
  readyForRead: boolean;
  /** Readiness is not authorization to send or modify external data. */
  writesEnabled: false;
  implementedCapabilities: { health: boolean; readDelta: boolean };
  adapterType?: ConnectionRuntimeRegistration["adapterType"];
  checkedAt?: string;
};

const ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;
const HEALTH_MAX_AGE_MS = 5 * 60_000;

function assertId(value: unknown, label: string) {
  if (typeof value !== "string" || !ID.test(value)) throw new Error(`${label} is invalid.`);
}

function definitionFor(id: string) {
  const definition = CONNECTION_CATALOG.find((entry) => entry.id === id);
  if (!definition) throw new Error("Unknown connection ID.");
  return definition;
}

function sameIdentity(value: ConnectionRuntimeIdentity, expected: ConnectionRuntimeIdentity) {
  return value.connectionId === expected.connectionId && value.tenantId === expected.tenantId &&
    value.provider === expected.provider && value.connectorId === expected.connectorId;
}

function registrationKey(tenantId: string, connectorId: string) {
  return `${tenantId}\u0000${connectorId}`;
}

function isoTime(value: unknown) {
  try { return Date.parse(cleanIsoDateTime(value, "readiness.timestamp")); } catch { return Number.NaN; }
}

function authorizationProblem(authorization: ConnectionReadAuthorization, identity: ConnectionRuntimeIdentity, principal: AuthenticatedPrincipal, now: number): ConnectionReadinessReason | undefined {
  if (!authorization || typeof authorization !== "object") return "authorization-invalid";
  if (!sameIdentity(authorization, identity) || authorization.principalSubject !== principal.subject) return "identity-mismatch";
  const validUntil = isoTime(authorization.validUntil);
  if (!Number.isFinite(now) || !Number.isFinite(validUntil) || validUntil <= now || (principal.expiresAt && Date.parse(principal.expiresAt) <= now)) return "authorization-invalid";
  if (authorization.authentication !== "ready") return "authentication-required";
  if (authorization.consent !== "granted") return "consent-required";
  if (authorization.policy !== "allow" || !Array.isArray(authorization.resourceScopes) ||
    authorization.resourceScopes.length < 1 || authorization.resourceScopes.length > 100 ||
    Array.from(authorization.resourceScopes).some((scope) => typeof scope !== "string" || !ID.test(scope))) return "policy-denied";
}

async function boundedCheck<T>(work: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(() => work(controller.signal)),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("The readiness check timed out."));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Server-side reference boundary for IT adapter implementations. This is not an
 * OAuth client, MCP transport, token verifier, event ingester, or action executor.
 * The host must supply authenticated principals and fresh authorization verdicts.
 * Nothing is registered by default; catalog entries and local plans confer no access.
 * Each callback has a bounded wait (five seconds by default). Host implementations
 * must honor the abort signal and apply transport timeouts to stop upstream work.
 */
export class ConnectionRuntimeRegistry {
  private readonly registrations = new Map<string, ConnectionRuntimeRegistration>();
  private readonly clock: () => Date;
  private readonly checkTimeoutMs: number;

  constructor(options: { registrations?: readonly ConnectionRuntimeRegistration[]; clock?: () => Date; checkTimeoutMs?: number } = {}) {
    this.clock = options.clock ?? (() => new Date());
    this.checkTimeoutMs = options.checkTimeoutMs ?? 5_000;
    if (!Number.isSafeInteger(this.checkTimeoutMs) || this.checkTimeoutMs < 1 || this.checkTimeoutMs > 30_000) throw new Error("The readiness timeout is invalid.");
    for (const registration of options.registrations ?? []) {
      const definition = definitionFor(registration.connectionId);
      assertId(registration.tenantId, "Connection tenant");
      assertId(registration.connectorId, "Connector ID");
      if (!definition.scopes.includes(registration.scope)) throw new Error("The connection scope is invalid.");
      if (registration.scope === "personal") assertId(registration.ownerSubject, "Personal connection owner");
      if (registration.provider !== definition.provider || registration.adapter?.provider !== definition.provider) {
        throw new Error("The adapter provider does not match the connection catalog.");
      }
      if (!["microsoft-graph", "mcp", "custom"].includes(registration.adapterType)) throw new Error("The adapter type is invalid.");
      if (typeof registration.adapter.health !== "function") throw new Error("An adapter health implementation is required.");
      if (registration.adapter.readDelta !== undefined && typeof registration.adapter.readDelta !== "function") throw new Error("The read implementation is invalid.");
      if (registration.authorizeRead !== undefined && typeof registration.authorizeRead !== "function") throw new Error("The host authorization implementation is invalid.");
      const key = registrationKey(registration.tenantId, registration.connectorId);
      if (this.registrations.has(key)) throw new Error("This tenant connector already has an adapter.");
      // Snapshot host registration metadata and methods; do not retain caller-owned
      // configuration objects or any executeApprovedAction method.
      this.registrations.set(key, {
        connectionId: registration.connectionId,
        tenantId: registration.tenantId,
        provider: registration.provider,
        connectorId: registration.connectorId,
        scope: registration.scope,
        ...(registration.scope === "personal" ? { ownerSubject: registration.ownerSubject } : {}),
        adapterType: registration.adapterType,
        adapter: {
          provider: registration.provider,
          health: registration.adapter.health.bind(registration.adapter),
          ...(registration.adapter.readDelta ? { readDelta: registration.adapter.readDelta.bind(registration.adapter) } : {}),
        },
        ...(registration.authorizeRead ? { authorizeRead: registration.authorizeRead } : {}),
      });
    }
  }

  async getReadiness(input: {
    /** Already authenticated by server middleware. Normalization is not token verification. */
    principal: AuthenticatedPrincipal;
    tenantId: string;
    connectionId: ConnectionId;
    connectorId: string;
    correlationId: string;
  }): Promise<ConnectionReadiness> {
    const now = this.clock();
    if (!Number.isFinite(now.getTime())) throw new Error("The runtime clock is invalid.");
    const principal = resolvePrincipal({ runtime: "production", supplied: input.principal, now });
    assertTenantAccess(principal, input.tenantId);
    if (!hasPermission(principal, "integrations.read") && !hasPermission(principal, "integrations.manage")) {
      throw new Error("Permission denied: integrations.read.");
    }
    assertId(input.correlationId, "Correlation ID");
    assertId(input.connectorId, "Connector ID");
    definitionFor(input.connectionId);
    const registration = this.registrations.get(registrationKey(input.tenantId, input.connectorId));
    const base: ConnectionReadiness = {
      connectionId: input.connectionId,
      connectorId: input.connectorId,
      tenantId: input.tenantId,
      status: "not-connected",
      reason: "adapter-missing",
      readyForRead: false,
      writesEnabled: false,
      implementedCapabilities: { health: !!registration, readDelta: !!registration?.adapter.readDelta },
      ...(registration ? { adapterType: registration.adapterType } : {}),
    };
    const blocked = (reason: ConnectionReadinessReason): ConnectionReadiness => ({ ...base, status: "blocked", reason });
    if (!registration) return base;
    if (registration.connectionId !== input.connectionId) return blocked("identity-mismatch");
    if (registration.scope === "personal" && registration.ownerSubject !== principal.subject) return blocked("owner-mismatch");
    if (!registration.adapter.readDelta) return blocked("read-not-implemented");
    if (!registration.authorizeRead) return blocked("host-authorization-missing");
    const identity: ConnectionRuntimeIdentity = {
      connectionId: registration.connectionId,
      tenantId: registration.tenantId,
      provider: registration.provider,
      connectorId: registration.connectorId,
    };
    let authorization: ConnectionReadAuthorization;
    try {
      const authorizeRead = registration.authorizeRead;
      authorization = await boundedCheck((signal) => authorizeRead({ ...identity, principal, correlationId: input.correlationId, signal }), this.checkTimeoutMs);
    } catch {
      return blocked("authorization-unavailable");
    }
    const authorizationIssue = authorizationProblem(authorization, identity, principal, this.clock().getTime());
    if (authorizationIssue) return blocked(authorizationIssue);
    try {
      const health = await boundedCheck((signal) => registration.adapter.health({ tenantId: identity.tenantId, connectorId: identity.connectorId, correlationId: input.correlationId, signal }), this.checkTimeoutMs);
      if (!health || typeof health !== "object") return blocked("health-invalid");
      if (health.provider !== identity.provider || health.tenantId !== identity.tenantId || health.connectorId !== identity.connectorId) return blocked("identity-mismatch");
      const checkedAt = isoTime(health.checkedAt);
      if (!Number.isFinite(checkedAt)) return blocked("health-invalid");
      const completedAt = this.clock().getTime();
      if (!Number.isFinite(completedAt) || checkedAt > completedAt || completedAt - checkedAt > HEALTH_MAX_AGE_MS) return blocked("health-stale");
      // A shared host verdict may be revoked or expire while health is being checked.
      const completedAuthorizationIssue = authorizationProblem(authorization, identity, principal, completedAt);
      if (completedAuthorizationIssue) return blocked(completedAuthorizationIssue);
      const inspected = { ...base, checkedAt: new Date(checkedAt).toISOString() };
      if (health.status === "disabled") return { ...inspected, reason: "health-disabled" };
      if (health.status === "degraded" || health.status === "unavailable") return { ...inspected, status: "degraded", reason: health.status === "degraded" ? "health-degraded" : "health-unavailable" };
      if (health.status !== "healthy") return blocked("health-invalid");
      return { ...inspected, status: "ready", reason: "ready", readyForRead: true };
    } catch {
      // Adapter messages and errors may contain credentials or upstream response bodies.
      return blocked("health-unavailable");
    }
  }
}
