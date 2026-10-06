import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { CONNECTION_CATALOG } from "../lib/integrations/connection-catalog";
import type { ConnectorHealth } from "../lib/integrations/adapter";
import { normalizeAuthenticatedPrincipal } from "../lib/server/auth/principal";
import type { ConnectionReadAuthorization, ConnectionRuntimeRegistration } from "../lib/server/connection-runtime";

// Next enforces this boundary marker at build time. Stub only that marker in Node.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: "data:text/javascript,export {};", shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "data:text/javascript,export {};") return { format: "commonjs", source: "module.exports = {};", shortCircuit: true };
    return nextLoad(url, context);
  },
});

const now = new Date("2026-09-18T12:00:00Z");
const principal = normalizeAuthenticatedPrincipal({ subject: "user:it", tenantId: "tenant-a", authMethod: "oidc", permissions: ["integrations.read"] });
const input = { principal, tenantId: "tenant-a", connectionId: "outlook-mail" as const, connectorId: "mail-a", correlationId: "request-1" };
const identity = { connectionId: "outlook-mail" as const, tenantId: "tenant-a", provider: "microsoft", connectorId: "mail-a" };

function grant(overrides: Partial<ConnectionReadAuthorization> = {}): ConnectionReadAuthorization {
  return { ...identity, principalSubject: principal.subject, authentication: "ready", consent: "granted", policy: "allow", resourceScopes: ["mailbox:team-a"], validUntil: "2026-09-18T12:10:00Z", ...overrides };
}

function health(overrides: Partial<ConnectorHealth> = {}): ConnectorHealth {
  return { provider: "microsoft", tenantId: "tenant-a", connectorId: "mail-a", status: "healthy", checkedAt: now.toISOString(), ...overrides };
}

function registration(overrides: Partial<ConnectionRuntimeRegistration> = {}): ConnectionRuntimeRegistration {
  return {
    ...identity,
    scope: "company",
    adapterType: "microsoft-graph",
    adapter: { provider: "microsoft", health: async () => health(), readDelta: async () => ({ events: [], pageComplete: true }) },
    authorizeRead: async () => grant(),
    ...overrides,
  };
}

async function registry(registrations: readonly ConnectionRuntimeRegistration[] = []) {
  const { ConnectionRuntimeRegistry } = await import("../lib/server/connection-runtime");
  return new ConnectionRuntimeRegistry({ registrations, clock: () => now });
}

test("catalog entries never imply registered adapters or a live connection", async () => {
  const runtime = await registry();
  for (const connection of CONNECTION_CATALOG) {
    const result = await runtime.getReadiness({ ...input, connectionId: connection.id });
    assert.equal(result.status, "not-connected");
    assert.equal(result.reason, "adapter-missing");
    assert.equal(result.readyForRead, false);
    assert.equal(result.writesEnabled, false);
    assert.deepEqual(result.implementedCapabilities, { health: false, readDelta: false });
  }
});

test("registration validates catalog IDs, provider linkage, methods, and duplicate tenant connections", async () => {
  await assert.rejects(registry([registration({ connectionId: "invented" as never })]), /Unknown connection/);
  await assert.rejects(registry([registration({ provider: "granola" })]), /provider does not match/);
  await assert.rejects(registry([registration({ adapter: { ...registration().adapter, provider: "granola" } })]), /provider does not match/);
  await assert.rejects(registry([registration({ tenantId: "invalid tenant" })]), /tenant/);
  await assert.rejects(registry([registration({ connectorId: "" })]), /Connector/);
  await assert.rejects(registry([registration({ scope: "personal" })]), /owner/);
  await assert.rejects(registry([registration({ adapter: { provider: "microsoft" } as never })]), /health implementation/);
  await assert.rejects(registry([registration(), registration()]), /already has an adapter/);
});

test("only an implemented read adapter, current host authorization and bound healthy result can become ready", async () => {
  const calls: string[] = [];
  const runtime = await registry([registration({
    authorizeRead: async (request) => {
      calls.push("authorize");
      assert.equal(request.principal.subject, "user:it");
      assert.equal(request.tenantId, "tenant-a");
      assert.equal(request.connectionId, "outlook-mail");
      return grant();
    },
    adapter: {
      provider: "microsoft",
      health: async (request) => {
        calls.push("health");
        assert.equal(request.tenantId, "tenant-a");
        assert.equal(request.connectorId, "mail-a");
        assert.equal(request.correlationId, "request-1");
        assert.equal(request.signal.aborted, false);
        return health();
      },
      readDelta: async () => { throw new Error("Readiness must not read data."); },
    },
  })]);
  const result = await runtime.getReadiness(input);
  assert.equal(result.status, "ready");
  assert.equal(result.readyForRead, true);
  assert.equal(result.writesEnabled, false);
  assert.deepEqual(result.implementedCapabilities, { health: true, readDelta: true });
  assert.deepEqual(calls, ["authorize", "health"]);
});

test("principals require valid authentication, integration permissions and the correct tenant before any host call", async () => {
  let calls = 0;
  const runtime = await registry([registration({ authorizeRead: async () => { calls++; return grant(); } })]);
  await assert.rejects(runtime.getReadiness({ ...input, principal: undefined as never }), /Authentication is required/);
  await assert.rejects(runtime.getReadiness({ ...input, principal: { ...principal, authMethod: "local-preview" } }), /not allowed in production/);
  await assert.rejects(runtime.getReadiness({ ...input, principal: { ...principal, permissions: ["records.read"] } }), /integrations.read/);
  await assert.rejects(runtime.getReadiness({ ...input, principal: { ...principal, expiresAt: now.toISOString() } }), /expired/);
  await assert.rejects(runtime.getReadiness({ ...input, tenantId: "tenant-b" }), /Cross-tenant/);
  assert.equal(calls, 0);
  assert.equal((await runtime.getReadiness({ ...input, principal: { ...principal, permissions: ["integrations.manage"] } })).readyForRead, true);
});

test("missing read implementation or trusted authorization never invokes health", async () => {
  let healthCalls = 0;
  const adapter = { ...registration().adapter, health: async () => { healthCalls++; return health(); } };
  const noRead = await registry([registration({ adapter: { ...adapter, readDelta: undefined } })]);
  assert.equal((await noRead.getReadiness(input)).reason, "read-not-implemented");
  const noAuthorization = await registry([registration({ adapter, authorizeRead: undefined })]);
  assert.equal((await noAuthorization.getReadiness(input)).reason, "host-authorization-missing");
  assert.equal(healthCalls, 0);
});

test("missing credentials, consent, policy and current authorization fail closed before health", async () => {
  const cases: [Partial<ConnectionReadAuthorization>, string][] = [
    [{ authentication: "missing" }, "authentication-required"],
    [{ authentication: "expired" }, "authentication-required"],
    [{ consent: "missing" }, "consent-required"],
    [{ consent: "revoked" }, "consent-required"],
    [{ policy: "deny" }, "policy-denied"],
    [{ resourceScopes: [] }, "policy-denied"],
    [{ resourceScopes: new Array<string>(1) }, "policy-denied"],
    [{ resourceScopes: [""] }, "policy-denied"],
    [{ validUntil: now.toISOString() }, "authorization-invalid"],
    [{ validUntil: "not-a-date" }, "authorization-invalid"],
    [{ validUntil: "2026-09-18T12:10:00" }, "authorization-invalid"],
    [{ validUntil: "2027-02-29T12:10:00Z" }, "authorization-invalid"],
  ];
  let healthCalls = 0;
  for (const [override, reason] of cases) {
    const runtime = await registry([registration({
      authorizeRead: async () => grant(override),
      adapter: { ...registration().adapter, health: async () => { healthCalls++; return health(); } },
    })]);
    const result = await runtime.getReadiness(input);
    assert.equal(result.reason, reason);
    assert.equal(result.readyForRead, false);
  }
  assert.equal(healthCalls, 0);
});

test("authorization is fetched on every call so revocation is reflected immediately", async () => {
  let revoked = false;
  const runtime = await registry([registration({ authorizeRead: async () => grant({ consent: revoked ? "revoked" : "granted" }) })]);
  assert.equal((await runtime.getReadiness(input)).readyForRead, true);
  revoked = true;
  assert.equal((await runtime.getReadiness(input)).reason, "consent-required");
});

test("authorization identity mismatches cannot authorize another principal, tenant, provider, connection or connector", async () => {
  for (const override of [{ principalSubject: "user:other" }, { tenantId: "tenant-b" }, { provider: "granola" }, { connectionId: "outlook-calendar" as const }, { connectorId: "mail-b" }]) {
    const runtime = await registry([registration({ authorizeRead: async () => grant(override) })]);
    assert.equal((await runtime.getReadiness(input)).reason, "identity-mismatch");
  }
});

test("multiple personal instances of one catalog connection remain isolated by owner and connector", async () => {
  const registrations = ["user:it", "user:other"].map((ownerSubject, index) => registration({
    connectorId: `personal-mail-${index}`,
    scope: "personal",
    ownerSubject,
    authorizeRead: async (request) => grant({ connectorId: request.connectorId, principalSubject: request.principal.subject }),
    adapter: { ...registration().adapter, health: async (request) => health({ connectorId: request.connectorId }) },
  }));
  const runtime = await registry(registrations);
  assert.equal((await runtime.getReadiness({ ...input, connectorId: "personal-mail-0" })).readyForRead, true);
  assert.equal((await runtime.getReadiness({ ...input, connectorId: "personal-mail-1" })).reason, "owner-mismatch");
  assert.equal((await runtime.getReadiness({ ...input, connectorId: "personal-mail-1", principal: { ...principal, subject: "user:other" } })).readyForRead, true);
  assert.equal((await runtime.getReadiness({ ...input, connectorId: "personal-mail-0", principal: { ...principal, subject: "user:other" } })).reason, "owner-mismatch");
  assert.equal((await runtime.getReadiness({ ...input, connectorId: "personal-mail-0", connectionId: "outlook-calendar" })).reason, "identity-mismatch");
});

test("hung authorization and health checks have bounded waits and receive cancellation", async () => {
  const { ConnectionRuntimeRegistry } = await import("../lib/server/connection-runtime");
  for (const stage of ["authorize", "health"] as const) {
    let signal: AbortSignal | undefined;
    let healthCalls = 0;
    const runtime = new ConnectionRuntimeRegistry({
      clock: () => now,
      checkTimeoutMs: 10,
      registrations: [registration({
        authorizeRead: async (request) => {
          if (stage !== "authorize") return grant();
          signal = request.signal;
          return new Promise<ConnectionReadAuthorization>(() => undefined);
        },
        adapter: { ...registration().adapter, health: async (request) => {
          healthCalls++;
          signal = request.signal;
          return new Promise<ConnectorHealth>(() => undefined);
        } },
      })],
    });
    const result = await runtime.getReadiness(input);
    assert.equal(result.reason, stage === "authorize" ? "authorization-unavailable" : "health-unavailable");
    assert.equal(result.readyForRead, false);
    assert.equal(signal?.aborted, true);
    assert.equal(healthCalls, stage === "authorize" ? 0 : 1);
  }
});

test("health identity, status and timestamp are validated rather than trusting an adapter's healthy claim", async () => {
  const cases: [Partial<ConnectorHealth>, string][] = [
    [{ tenantId: "tenant-b" }, "identity-mismatch"],
    [{ provider: "granola" }, "identity-mismatch"],
    [{ connectorId: "mail-b" }, "identity-mismatch"],
    [{ checkedAt: "not-a-date" }, "health-invalid"],
    [{ checkedAt: "2026-09-18T12:00:00" }, "health-invalid"],
    [{ checkedAt: "2026-09-18T11:54:59Z" }, "health-stale"],
    [{ checkedAt: "2026-09-18T12:00:01Z" }, "health-stale"],
    [{ status: "made-up" as never }, "health-invalid"],
    [{ status: "disabled" }, "health-disabled"],
    [{ status: "degraded" }, "health-degraded"],
    [{ status: "unavailable" }, "health-unavailable"],
  ];
  for (const [override, reason] of cases) {
    const runtime = await registry([registration({ adapter: { ...registration().adapter, health: async () => health(override) } })]);
    const result = await runtime.getReadiness(input);
    assert.equal(result.reason, reason);
    assert.equal(result.readyForRead, false);
    assert.equal(result.writesEnabled, false);
  }
});

test("no upstream error, health message or credential-like extension leaks in readiness output", async () => {
  const secret = "Bearer should-never-be-returned";
  const failingAuthorization = await registry([registration({ authorizeRead: async () => { throw new Error(secret); } })]);
  const failingHealth = await registry([registration({ adapter: { ...registration().adapter, health: async () => { throw new Error(secret); } } })]);
  const verboseHealth = await registry([registration({ adapter: { ...registration().adapter, health: async () => ({ ...health(), safeMessage: secret, accessToken: secret }) } })]);
  for (const runtime of [failingAuthorization, failingHealth, verboseHealth]) {
    assert.equal(JSON.stringify(await runtime.getReadiness(input)).includes(secret), false);
  }
  assert.equal((await failingAuthorization.getReadiness(input)).reason, "authorization-unavailable");
  assert.equal((await failingHealth.getReadiness(input)).reason, "health-unavailable");
});

test("an authorization or principal expiring during health cannot become ready", async () => {
  const { ConnectionRuntimeRegistry } = await import("../lib/server/connection-runtime");
  for (const principalExpires of [false, true]) {
    let clock = now;
    const runtime = new ConnectionRuntimeRegistry({
      clock: () => clock,
      registrations: [registration({
        authorizeRead: async () => grant({ validUntil: principalExpires ? "2026-09-18T12:10:00Z" : "2026-09-18T12:00:01Z" }),
        adapter: { ...registration().adapter, health: async () => {
          clock = new Date("2026-09-18T12:00:02Z");
          return health({ checkedAt: clock.toISOString() });
        } },
      })],
    });
    assert.equal((await runtime.getReadiness({ ...input, principal: principalExpires ? { ...principal, expiresAt: "2026-09-18T12:00:01Z" } : principal })).reason, "authorization-invalid");
  }
});

test("a shared host verdict changed during health must still satisfy every authorization check", async () => {
  const cases: [Partial<ConnectionReadAuthorization>, string][] = [
    [{ consent: "revoked" }, "consent-required"],
    [{ authentication: "expired" }, "authentication-required"],
    [{ policy: "deny" }, "policy-denied"],
    [{ resourceScopes: [] }, "policy-denied"],
    [{ principalSubject: "user:other" }, "identity-mismatch"],
    [{ connectorId: "mail-b" }, "identity-mismatch"],
  ];
  for (const [update, reason] of cases) {
    const sharedGrant = grant();
    const runtime = await registry([registration({
      authorizeRead: async () => sharedGrant,
      adapter: { ...registration().adapter, health: async () => {
        Object.assign(sharedGrant, update);
        return health();
      } },
    })]);
    assert.equal((await runtime.getReadiness(input)).reason, reason);
  }
});

test("authorization expiring before the host verdict returns cannot trigger a health request", async () => {
  const { ConnectionRuntimeRegistry } = await import("../lib/server/connection-runtime");
  let clock = now;
  let healthCalls = 0;
  const runtime = new ConnectionRuntimeRegistry({
    clock: () => clock,
    registrations: [registration({
      authorizeRead: async () => {
        clock = new Date("2026-09-18T12:00:02Z");
        return grant({ validUntil: "2026-09-18T12:00:01Z" });
      },
      adapter: { ...registration().adapter, health: async () => { healthCalls++; return health(); } },
    })],
  });
  assert.equal((await runtime.getReadiness(input)).reason, "authorization-invalid");
  assert.equal(healthCalls, 0);
});

test("the registry snapshots registration metadata and exposes no external write or ingestion method", async () => {
  const supplied = registration();
  const runtime = await registry([supplied]);
  supplied.connectorId = "changed-after-registration";
  supplied.adapter.readDelta = undefined;
  const result = await runtime.getReadiness(input);
  assert.equal(result.readyForRead, true);
  assert.equal(result.implementedCapabilities.readDelta, true);
  assert.equal("executeApprovedAction" in runtime, false);
  assert.equal("readDelta" in runtime, false);
  assert.equal("enqueue" in runtime, false);
});
