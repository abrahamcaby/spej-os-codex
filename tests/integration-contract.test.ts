import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanConnectorEventEnvelope,
  cleanIsoDateTime,
  createConnectorEventEnvelope,
  integrationIdempotencyKey,
} from "../lib/integrations/contracts";

const eventInput = () => ({
  provider: "microsoft",
  tenantId: "tenant-a",
  kind: "microsoft.teams.message",
  externalId: "message/123",
  externalVersion: "etag-7",
  occurredAt: "2026-09-01T09:00:00-04:00",
  receivedAt: "2026-09-01T13:00:01Z",
  sourceUrl: "https://teams.microsoft.com/l/message/123",
  payload: { recordType: "teams_message", excerpt: "A bounded source excerpt." },
});

test("integration identity is deterministic, source scoped, and independent of payload text", () => {
  const first = createConnectorEventEnvelope(eventInput());
  const second = createConnectorEventEnvelope({
    ...eventInput(),
    receivedAt: "2026-09-01T13:05:00Z",
    payload: { recordType: "teams_message", excerpt: "A corrected delivery of the same source version." },
  });
  assert.equal(first.idempotencyKey, second.idempotencyKey);
  assert.equal(first.occurredAt, "2026-09-01T13:00:00.000Z");
  assert.notEqual(first.idempotencyKey, createConnectorEventEnvelope({ ...eventInput(), externalVersion: "etag-8" }).idempotencyKey);
  assert.notEqual(first.idempotencyKey, createConnectorEventEnvelope({ ...eventInput(), tenantId: "tenant-b" }).idempotencyKey);
  assert.equal(first.idempotencyKey, integrationIdempotencyKey(first));
});

test("cleaning an envelope rejects a forged idempotency key and unknown top-level fields", () => {
  const event = createConnectorEventEnvelope(eventInput());
  assert.deepEqual(cleanConnectorEventEnvelope(event), event);
  assert.throws(() => cleanConnectorEventEnvelope({ ...event, idempotencyKey: "forged" }), /does not match the event identity/i);
  assert.throws(() => cleanConnectorEventEnvelope({ ...event, extra: "not allowed" }), /not an accepted field/i);
  assert.throws(() => cleanConnectorEventEnvelope({ ...event, schemaVersion: 2 }), /must equal 1/i);
});

test("credential-like fields are rejected recursively instead of being persisted", () => {
  assert.throws(() => createConnectorEventEnvelope({
    ...eventInput(),
    payload: { safe: { nested: [{ clientSecret: "must-not-cross-the-boundary" }] } },
  }), /credential-like fields/i);
  assert.throws(() => createConnectorEventEnvelope({
    ...eventInput(),
    payload: { authorizationHeader: "Bearer redacted" },
  }), /credential-like fields/i);
});

test("event metadata accepts only real timezone-aware ISO dates and safe http(s) URLs", () => {
  assert.equal(cleanIsoDateTime("2024-02-29T23:59:59.123456Z", "date"), "2024-02-29T23:59:59.123Z");
  assert.throws(() => cleanIsoDateTime("2026-02-29T12:00:00Z", "date"), /real ISO 8601/i);
  assert.throws(() => cleanIsoDateTime("2026-09-01T12:00:00", "date"), /with a timezone/i);
  assert.throws(() => createConnectorEventEnvelope({ ...eventInput(), sourceUrl: "ftp://example.com/item" }), /http\(s\)/i);
  assert.throws(() => createConnectorEventEnvelope({ ...eventInput(), sourceUrl: "https://user:password@example.com/item" }), /without embedded credentials/i);
  assert.throws(() => createConnectorEventEnvelope({ ...eventInput(), sourceUrl: "https://example.com/item?access_token=unsafe" }), /credential-like query/i);
});

test("event fields and minimized JSON payloads are bounded", () => {
  assert.throws(() => createConnectorEventEnvelope({ ...eventInput(), tenantId: "x".repeat(257) }), /between 1 and 256/i);
  assert.throws(() => createConnectorEventEnvelope({ ...eventInput(), provider: "Microsoft Graph" }), /invalid format/i);
  assert.throws(() => createConnectorEventEnvelope({ ...eventInput(), payload: { excerpt: "x".repeat(8_001) } }), /must not exceed 8000/i);
  assert.throws(() => createConnectorEventEnvelope({ ...eventInput(), payload: { invalid: undefined } }), /JSON-compatible/i);
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  assert.throws(() => createConnectorEventEnvelope({ ...eventInput(), payload: cyclic }), /cyclic/i);
  assert.throws(() => createConnectorEventEnvelope({ ...eventInput(), payload: { createdAt: new Date() } }), /plain JSON objects/i);
});
