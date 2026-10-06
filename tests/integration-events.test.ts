import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryIntegrationEventStore, type IntegrationEventInput } from "../lib/server/integration-event-store";
import { createConnectorEventEnvelope } from "../lib/integrations/contracts";
import { normalizeAuthenticatedPrincipal } from "../lib/server/auth/principal";

const worker = normalizeAuthenticatedPrincipal({ subject: "service:microsoft", tenantId: "tenant-a", authMethod: "service", permissions: ["integrations.read", "integrations.manage"] });
const event = (overrides: { externalVersion?: string; sourceSequence?: number; cursor?: string; receivedAt?: string; payload?: { subject: string } } = {}): IntegrationEventInput => {
  const envelope = createConnectorEventEnvelope({
    provider: "microsoft",
    tenantId: "tenant-a",
    kind: "microsoft.outlook.message",
    externalId: "message-1",
    externalVersion: overrides.externalVersion ?? "v1",
    occurredAt: "2026-09-02T11:55:00Z",
    receivedAt: overrides.receivedAt ?? "2026-09-02T12:00:00Z",
    payload: overrides.payload ?? { subject: "Example" },
  });
  return { ...envelope, stream: "outlook-messages", sourceSequence: overrides.sourceSequence ?? 1, cursor: overrides.cursor ?? "cursor-1" };
};

test("intake deduplicates exact events and rejects explicitly stale source sequences", () => {
  const store = new InMemoryIntegrationEventStore({ clock: () => new Date("2026-09-02T12:00:00Z") });
  const accepted = store.enqueue(worker, event());
  assert.equal(accepted.accepted, true);
  const duplicate = store.enqueue(worker, event());
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.reason, "duplicate");
  const stale = store.enqueue(worker, event({ externalVersion: "v0", sourceSequence: 0 }));
  assert.equal(stale.accepted, false);
  assert.equal(stale.reason, "stale");
});

test("cursor advances only after successful processing", () => {
  const store = new InMemoryIntegrationEventStore({ clock: () => new Date("2026-09-02T12:00:00Z") });
  store.enqueue(worker, event());
  assert.equal(store.getCursor(worker, { tenantId: "tenant-a", provider: "microsoft", stream: "outlook-messages" }), undefined);
  const claimed = store.claimNext(worker, { tenantId: "tenant-a", workerId: "worker-1", now: new Date("2026-09-02T12:00:00Z") });
  assert.ok(claimed?.claim);
  assert.equal(store.getCursor(worker, { tenantId: "tenant-a", provider: "microsoft", stream: "outlook-messages" }), undefined);
  store.complete(worker, { tenantId: "tenant-a", eventId: claimed.id, claimToken: claimed.claim.token, now: new Date("2026-09-02T12:00:01Z") });
  assert.equal(store.getCursor(worker, { tenantId: "tenant-a", provider: "microsoft", stream: "outlook-messages" })?.value, "cursor-1");
});

test("newer completed sequences prevent cursor regression from late workers", () => {
  const store = new InMemoryIntegrationEventStore({ clock: () => new Date("2026-09-02T12:00:00Z") });
  store.enqueue(worker, event());
  store.enqueue(worker, event({ externalVersion: "v2", sourceSequence: 2, cursor: "cursor-2", receivedAt: "2026-09-02T12:00:01Z" }));
  const first = store.claimNext(worker, { tenantId: "tenant-a", workerId: "worker-1", now: new Date("2026-09-02T12:00:02Z") });
  const second = store.claimNext(worker, { tenantId: "tenant-a", workerId: "worker-2", now: new Date("2026-09-02T12:00:02Z") });
  assert.ok(first?.claim && second?.claim);
  store.complete(worker, { tenantId: "tenant-a", eventId: second.id, claimToken: second.claim.token, now: new Date("2026-09-02T12:00:03Z") });
  assert.equal(store.getCursor(worker, { tenantId: "tenant-a", provider: "microsoft", stream: "outlook-messages" }), undefined);
  store.complete(worker, { tenantId: "tenant-a", eventId: first.id, claimToken: first.claim.token, now: new Date("2026-09-02T12:00:04Z") });
  assert.deepEqual(store.getCursor(worker, { tenantId: "tenant-a", provider: "microsoft", stream: "outlook-messages" }), {
    provider: "microsoft", tenantId: "tenant-a", stream: "outlook-messages", value: "cursor-2", sourceSequence: 2, advancedAt: "2026-09-02T12:00:04.000Z",
  });
});

test("failures back off, retry, and dead-letter at the configured bound", () => {
  const store = new InMemoryIntegrationEventStore({ clock: () => new Date("2026-09-02T12:00:00Z"), maxAttempts: 2, baseRetryMs: 1_000 });
  const queued = store.enqueue(worker, event());
  assert.equal(queued.accepted, true);
  const first = store.claimNext(worker, { tenantId: "tenant-a", workerId: "worker-1", now: new Date("2026-09-02T12:00:00Z") });
  assert.ok(first?.claim);
  const failed = store.fail(worker, { tenantId: "tenant-a", eventId: first.id, claimToken: first.claim.token, error: new Error("temporary\nproblem"), now: new Date("2026-09-02T12:00:00Z") });
  assert.equal(failed.status, "failed");
  assert.equal(failed.lastError, "temporary problem");
  assert.equal(store.claimNext(worker, { tenantId: "tenant-a", workerId: "worker-1", now: new Date("2026-09-02T12:00:00.999Z") }), undefined);
  const retried = store.claimNext(worker, { tenantId: "tenant-a", workerId: "worker-1", now: new Date("2026-09-02T12:00:01Z") });
  assert.ok(retried?.claim);
  const dead = store.fail(worker, { tenantId: "tenant-a", eventId: retried.id, claimToken: retried.claim.token, error: "permanent", now: new Date("2026-09-02T12:00:01Z") });
  assert.equal(dead.status, "dead-letter");
  assert.equal(dead.nextAttemptAt, undefined);
  assert.equal(store.claimNext(worker, { tenantId: "tenant-a", workerId: "worker-1", now: new Date("2026-09-03T12:00:00Z") }), undefined);
});

test("claim tokens, tenant identity, and integration permissions are enforced", () => {
  const store = new InMemoryIntegrationEventStore({ clock: () => new Date("2026-09-02T12:00:00Z") });
  const accepted = store.enqueue(worker, event());
  assert.equal(accepted.accepted, true);
  const claimed = store.claimNext(worker, { tenantId: "tenant-a", workerId: "worker-1" });
  assert.ok(claimed?.claim);
  assert.throws(() => store.complete(worker, { tenantId: "tenant-a", eventId: claimed.id, claimToken: "wrong" }), /claim is not valid/);
  const crossTenant = normalizeAuthenticatedPrincipal({ subject: "service:microsoft", tenantId: "tenant-b", authMethod: "service", permissions: ["integrations.manage"] });
  assert.throws(() => store.claimNext(crossTenant, { tenantId: "tenant-a", workerId: "worker-2" }), /Cross-tenant/);
  const reader = normalizeAuthenticatedPrincipal({ subject: "reader", tenantId: "tenant-a", authMethod: "service", permissions: ["integrations.read"] });
  assert.equal(store.get(reader, "tenant-a", claimed.id)?.id, claimed.id);
  assert.throws(() => store.claimNext(reader, { tenantId: "tenant-a", workerId: "reader" }), /integrations.manage/);
  assert.throws(() => store.enqueue(reader, event({ externalVersion: "v2", sourceSequence: 2 })), /integrations.manage/);
});

test("the durable boundary revalidates the envelope and redacts credential-like errors", () => {
  const store = new InMemoryIntegrationEventStore({ clock: () => new Date("2026-09-02T12:00:00Z") });
  const invalid = { ...event(), payload: { accessToken: "do-not-store" } } as unknown as IntegrationEventInput;
  assert.throws(() => store.enqueue(worker, invalid), /credential-like fields/);
  store.enqueue(worker, event());
  const claimed = store.claimNext(worker, { tenantId: "tenant-a", workerId: "worker-1" });
  assert.ok(claimed?.claim);
  const failed = store.fail(worker, { tenantId: "tenant-a", eventId: claimed.id, claimToken: claimed.claim.token, error: "Bearer abc123 password=unsafe" });
  assert.equal(failed.lastError, "Bearer [redacted] password=[redacted]");
});
