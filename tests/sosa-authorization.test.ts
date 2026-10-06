import assert from "node:assert/strict";
import test from "node:test";
import { authorizeSosaToolCall, type SosaProposalBinding, type SosaRequestContext } from "../lib/integrations/sosa/contracts";
import { normalizeAuthenticatedPrincipal } from "../lib/server/auth/principal";

const now = new Date("2026-09-02T12:00:00Z");
const principal = normalizeAuthenticatedPrincipal({
  subject: "user-1",
  tenantId: "tenant-a",
  authMethod: "oidc",
  permissions: ["records.read", "records.propose", "records.commit", "external.send"],
});
const context: SosaRequestContext = { requestId: "request-1", channel: "teams", principal };
const proposal: SosaProposalBinding = {
  proposalId: "proposal-1",
  proposalFingerprint: "fingerprint-1",
  requestId: "request-1",
  tenantId: "tenant-a",
  principalSubject: "user-1",
  operations: ["records.commit", "teams.send"],
  preparedAt: "2026-09-02T11:59:00Z",
  expiresAt: "2026-09-02T12:10:00Z",
};
const confirmation = {
  proposalId: "proposal-1",
  proposalFingerprint: "fingerprint-1",
  tenantId: "tenant-a",
  confirmedBy: "user-1",
  confirmedAt: "2026-09-02T12:00:00Z",
} as const;

test("read and proposal preparation use deterministic principal permissions", () => {
  assert.equal(authorizeSosaToolCall({ context, operation: "records.read", tenantId: "tenant-a", now }).allowed, true);
  assert.equal(authorizeSosaToolCall({ context, operation: "records.prepare", tenantId: "tenant-a", now }).allowed, true);
  assert.equal(authorizeSosaToolCall({ context, operation: "calendar.write", tenantId: "tenant-a", now }).allowed, false);
});

test("canonical commits require an exact, current, human-confirmed proposal", () => {
  const missing = authorizeSosaToolCall({ context, operation: "records.commit", tenantId: "tenant-a", proposal, now });
  assert.equal(missing.allowed, false);
  assert.match(missing.reason, /Human confirmation/);
  const allowed = authorizeSosaToolCall({ context, operation: "records.commit", tenantId: "tenant-a", proposal, confirmation, now });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.requiresHumanConfirmation, true);
  assert.equal(authorizeSosaToolCall({ context, operation: "records.commit", tenantId: "tenant-a", proposal, confirmation: { ...confirmation, proposalFingerprint: "tampered" }, now }).allowed, false);
});

test("external messages require both the external permission and action-bound approval", () => {
  assert.equal(authorizeSosaToolCall({ context, operation: "teams.send", tenantId: "tenant-a", proposal, confirmation, now }).allowed, true);
  assert.equal(authorizeSosaToolCall({ context, operation: "outlook.send", tenantId: "tenant-a", proposal, confirmation, now }).allowed, false);
  const withoutSend = { ...context, principal: { ...principal, permissions: ["records.read"] as const } };
  assert.equal(authorizeSosaToolCall({ context: withoutSend, operation: "teams.send", tenantId: "tenant-a", proposal, confirmation, now }).allowed, false);
});

test("tenant, principal, request, and expiry bindings fail closed", () => {
  assert.equal(authorizeSosaToolCall({ context, operation: "records.read", tenantId: "tenant-b", now }).allowed, false);
  assert.equal(authorizeSosaToolCall({ context, operation: "records.commit", tenantId: "tenant-a", proposal: { ...proposal, principalSubject: "user-2" }, confirmation, now }).allowed, false);
  assert.equal(authorizeSosaToolCall({ context, operation: "records.commit", tenantId: "tenant-a", proposal: { ...proposal, requestId: "other" }, confirmation, now }).allowed, false);
  assert.equal(authorizeSosaToolCall({ context, operation: "records.commit", tenantId: "tenant-a", proposal: { ...proposal, expiresAt: "2026-09-02T11:59:59Z" }, confirmation, now }).allowed, false);
  assert.equal(authorizeSosaToolCall({ context, operation: "records.commit", tenantId: "tenant-a", proposal, confirmation: { ...confirmation, confirmedAt: "2026-09-02T11:58:59Z" }, now }).allowed, false);
});

test("unsupported model-proposed tools are never treated as authorized", () => {
  const decision = authorizeSosaToolCall({ context, operation: "records.delete" as never, tenantId: "tenant-a", now });
  assert.equal(decision.allowed, false);
  assert.match(decision.reason, /not supported/);
  assert.equal(authorizeSosaToolCall({ context, operation: "records.commit", tenantId: "tenant-a", proposal: { proposalId: "broken" } as never, now }).allowed, false);
});
