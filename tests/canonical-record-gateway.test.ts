import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryCanonicalRecordGateway, type CanonicalRecord } from "../lib/server/canonical-record-gateway";
import { normalizeAuthenticatedPrincipal } from "../lib/server/auth/principal";

const initial: CanonicalRecord[] = [
  { tenantId: "tenant-a", id: "account-1", kind: "account", version: 1, data: { name: "Example", owner: "GTM", untouched: "keep" }, createdAt: "2026-09-01T12:00:00Z", updatedAt: "2026-09-01T12:00:00Z" },
  { tenantId: "tenant-a", id: "task-1", kind: "task", version: 1, data: { title: "Follow up", status: "open" }, createdAt: "2026-09-01T12:00:00Z", updatedAt: "2026-09-01T12:00:00Z" },
];
const principal = normalizeAuthenticatedPrincipal({ subject: "user-1", tenantId: "tenant-a", authMethod: "oidc", permissions: ["records.read", "records.propose", "records.commit", "audit.read"] });
const approval = (proposal: { id: string; fingerprint: string; tenantId: string }, approvedAt = "2026-09-02T12:00:00Z") => ({
  proposalId: proposal.id,
  proposalFingerprint: proposal.fingerprint,
  tenantId: proposal.tenantId,
  approvedBy: "user-1",
  decision: "approved" as const,
  approvedAt,
});

test("prepare is read-only and commit preserves unrelated fields with optimistic versions", () => {
  const gateway = new InMemoryCanonicalRecordGateway(initial, { clock: () => new Date("2026-09-02T12:00:00Z") });
  const proposal = gateway.prepare(principal, { tenantId: "tenant-a", requestId: "request-1", changes: [{ operation: "patch", kind: "account", id: "account-1", expectedVersion: 1, data: { owner: "Sales" } }] });
  assert.equal(gateway.get(principal, { tenantId: "tenant-a", kind: "account", id: "account-1" })?.data.owner, "GTM");
  const result = gateway.commit(principal, approval(proposal));
  assert.equal(result.records[0].version, 2);
  assert.deepEqual(gateway.get(principal, { tenantId: "tenant-a", kind: "account", id: "account-1" })?.data, { name: "Example", owner: "Sales", untouched: "keep" });
});

test("multi-record commit is atomic when any expected version conflicts", () => {
  const gateway = new InMemoryCanonicalRecordGateway(initial, { clock: () => new Date("2026-09-02T12:00:00Z") });
  const batch = gateway.prepare(principal, { tenantId: "tenant-a", requestId: "batch", changes: [
    { operation: "patch", kind: "account", id: "account-1", expectedVersion: 1, data: { owner: "Changed" } },
    { operation: "patch", kind: "task", id: "task-1", expectedVersion: 1, data: { status: "done" } },
  ] });
  const competing = gateway.prepare(principal, { tenantId: "tenant-a", requestId: "competing", changes: [{ operation: "patch", kind: "task", id: "task-1", expectedVersion: 1, data: { status: "blocked" } }] });
  gateway.commit(principal, approval(competing));
  assert.throws(() => gateway.commit(principal, approval(batch)), /no changes were committed/);
  assert.equal(gateway.get(principal, { tenantId: "tenant-a", kind: "account", id: "account-1" })?.data.owner, "GTM");
  assert.equal(gateway.get(principal, { tenantId: "tenant-a", kind: "task", id: "task-1" })?.data.status, "blocked");
});

test("request and commit idempotency never applies a proposal twice", () => {
  const gateway = new InMemoryCanonicalRecordGateway([], { clock: () => new Date("2026-09-02T12:00:00Z") });
  const input = { tenantId: "tenant-a", requestId: "request-create", changes: [{ operation: "create" as const, kind: "contact", id: "contact-1", data: { name: "Example Person" } }] };
  const first = gateway.prepare(principal, input);
  const second = gateway.prepare(principal, input);
  assert.equal(first.id, second.id);
  assert.throws(() => gateway.prepare(principal, { ...input, changes: [{ ...input.changes[0], data: { name: "Different" } }] }), /already used for different/);
  const committed = gateway.commit(principal, approval(first));
  const replay = gateway.commit(principal, approval(first));
  assert.deepEqual(replay, committed);
  assert.equal(gateway.list(principal, { tenantId: "tenant-a" }).length, 1);
});

test("approval integrity, principal binding, expiry, and tenant boundaries are enforced", () => {
  let clock = new Date("2026-09-02T12:00:00Z");
  const gateway = new InMemoryCanonicalRecordGateway(initial, { clock: () => clock, proposalTtlMs: 1_000 });
  const proposal = gateway.prepare(principal, { tenantId: "tenant-a", requestId: "secure", changes: [{ operation: "patch", kind: "account", id: "account-1", expectedVersion: 1, data: { owner: "Sales" } }] });
  assert.throws(() => gateway.commit(principal, { ...approval(proposal), proposalFingerprint: "tampered" }), /does not match/);
  const other = normalizeAuthenticatedPrincipal({ subject: "user-2", tenantId: "tenant-a", authMethod: "oidc", permissions: ["records.commit"] });
  assert.throws(() => gateway.commit(other, { ...approval(proposal), approvedBy: "user-2" }), /not bound/);
  const crossTenant = normalizeAuthenticatedPrincipal({ subject: "user-1", tenantId: "tenant-b", authMethod: "oidc", permissions: ["records.commit"] });
  assert.throws(() => gateway.commit(crossTenant, { ...approval(proposal), tenantId: "tenant-b" }), /Cross-tenant/);
  clock = new Date("2026-09-02T12:00:02Z");
  assert.throws(() => gateway.commit(principal, approval(proposal, "2026-09-02T12:00:00Z")), /expired/);
});

test("record scope and injected authorization are checked on both proposal and commit", () => {
  const scoped = normalizeAuthenticatedPrincipal({ subject: "user-1", tenantId: "tenant-a", authMethod: "oidc", permissions: ["records.read", "records.propose", "records.commit"], recordScope: { kinds: ["account"] } });
  const gateway = new InMemoryCanonicalRecordGateway(initial, {
    clock: () => new Date("2026-09-02T12:00:00Z"),
    authorizeRecord: (actor, operation, record) => operation === "read" ? record.kind === "account" : actor.recordScope?.kinds?.includes(record.kind) === true,
  });
  assert.equal(gateway.list(scoped, { tenantId: "tenant-a" }).length, 1);
  assert.throws(() => gateway.prepare(scoped, { tenantId: "tenant-a", requestId: "denied", changes: [{ operation: "patch", kind: "task", id: "task-1", expectedVersion: 1, data: { status: "done" } }] }), /not allowed/);
  assert.equal(gateway.get(scoped, { tenantId: "tenant-a", kind: "account", id: "account-1" })?.version, 1);
});

test("successful proposals and commits create tenant-scoped audit evidence", () => {
  const gateway = new InMemoryCanonicalRecordGateway(initial, { clock: () => new Date("2026-09-02T12:00:00Z") });
  const proposal = gateway.prepare(principal, { tenantId: "tenant-a", requestId: "audited", changes: [{ operation: "patch", kind: "account", id: "account-1", expectedVersion: 1, data: { owner: "Sales" } }] });
  gateway.commit(principal, approval(proposal));
  assert.deepEqual(gateway.listAudit(principal, "tenant-a").map((event) => event.action), ["proposal.prepared", "proposal.committed"]);
  const noAudit = normalizeAuthenticatedPrincipal({ subject: "reader", tenantId: "tenant-a", authMethod: "oidc", permissions: ["records.read"] });
  assert.throws(() => gateway.listAudit(noAudit, "tenant-a"), /audit.read/);
});

test("unsafe or oversized canonical data fails before a proposal is stored", () => {
  const gateway = new InMemoryCanonicalRecordGateway();
  assert.throws(() => gateway.prepare(principal, { tenantId: "tenant-a", requestId: "unsafe", changes: [{ operation: "create", kind: "account", id: "new", data: { nested: { constructor: "bad" } } }] }), /unsafe field/);
  assert.throws(() => gateway.prepare(principal, { tenantId: "tenant-a", requestId: "large", changes: [{ operation: "create", kind: "account", id: "new", data: { notes: "x".repeat(50_001) } }] }), /oversized string/);
});
