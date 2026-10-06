import assert from "node:assert/strict";
import test from "node:test";
import {
  buildConnectionHandoff,
  cleanConnectionPlan,
  emptyConnectionPlan,
  type ConnectionPlan,
} from "../lib/integrations/connection-plan";

const plan = (): ConnectionPlan => ({
  schemaVersion: 1,
  profileId: "aby",
  selections: [
    { providerId: "outlook-mail", scope: "personal", capabilityIds: ["mail.read", "mail.send"] },
    { providerId: "granola", scope: "company", capabilityIds: ["granola.notes.read"] },
  ],
});

test("new connection plans have no selections and remain isolated by profile", () => {
  assert.deepEqual(emptyConnectionPlan("aby"), { schemaVersion: 1, profileId: "aby", selections: [] });
  assert.deepEqual(emptyConnectionPlan("sagar"), { schemaVersion: 1, profileId: "sagar", selections: [] });
  assert.throws(() => cleanConnectionPlan(plan(), "sagar"), /different profile/i);
  assert.throws(() => emptyConnectionPlan("https://example.com/token"), /profile identifier/i);
  assert.throws(() => emptyConnectionPlan("free text profile"), /profile identifier/i);
  assert.throws(() => emptyConnectionPlan("x".repeat(101)), /profile identifier/i);
});

test("connection plan validation fails closed on malformed and future schemas", () => {
  for (const malformed of [null, undefined, [], "plan", new Date()]) {
    assert.throws(() => cleanConnectionPlan(malformed, "aby"), /must be an object/i);
  }
  for (const schemaVersion of [undefined, 0, 2, "1"]) {
    assert.throws(() => cleanConnectionPlan({ ...plan(), schemaVersion }, "aby"), /unsupported.*schema/i);
  }
  assert.throws(() => cleanConnectionPlan({ ...plan(), selections: null }, "aby"), /selection entries/i);
  assert.throws(() => cleanConnectionPlan({ ...plan(), selections: [null] }, "aby"), /selection must be an object/i);
  assert.throws(() => cleanConnectionPlan({ ...plan(), selections: Array(65).fill(plan().selections[0]) }, "aby"), /at most 64/i);
});

test("unknown providers, capabilities, and unsupported scopes never enter a plan", () => {
  const selection = plan().selections[0];
  const cases = [
    { ...selection, providerId: "unknown-provider" },
    { ...selection, providerId: "__proto__" },
    { ...selection, scope: "admin" },
    { providerId: "sharepoint", scope: "personal", capabilityIds: ["sharepoint.references.read"] },
    { ...selection, capabilityIds: ["calendar.write"] },
    { ...selection, capabilityIds: ["mail.read", "unknown-capability"] },
    { ...selection, capabilityIds: [42] },
    { ...selection, capabilityIds: "mail.read" },
    { ...selection, capabilityIds: Array(33).fill("mail.read") },
  ];
  for (const invalid of cases) {
    assert.throws(() => cleanConnectionPlan({ ...plan(), selections: [invalid] }, "aby"), /unknown|unsupported|capability identifiers/i);
  }
});

test("duplicate providers and capabilities are merged only within the same intended scope", () => {
  const cleaned = cleanConnectionPlan({
    ...plan(),
    selections: [
      { providerId: "granola", scope: "company", capabilityIds: ["granola.notes.read"] },
      { providerId: "outlook-mail", scope: "company", capabilityIds: ["mail.send", "mail.send"] },
      { providerId: "outlook-mail", scope: "personal", capabilityIds: ["mail.send"] },
      { providerId: "outlook-mail", scope: "personal", capabilityIds: ["mail.read", "mail.read"] },
    ],
  }, "aby");
  assert.deepEqual(cleaned.selections, [
    { providerId: "outlook-mail", scope: "personal", capabilityIds: ["mail.read", "mail.send"] },
    { providerId: "outlook-mail", scope: "company", capabilityIds: ["mail.send"] },
    { providerId: "granola", scope: "company", capabilityIds: ["granola.notes.read"] },
  ]);
});

test("cleaning and exporting only copy whitelisted fields and never propagate credentials or approval claims", () => {
  const secret = "SECRET-MUST-NOT-LEAVE-INPUT";
  const contaminated = {
    ...plan(),
    accessToken: secret,
    profileName: secret,
    endpoint: `https://example.com/${secret}`,
    approvals: { adminConsent: true, nested: { clientSecret: secret } },
    productionAuthority: true,
    selections: plan().selections.map((selection) => ({
      ...selection,
      authorization: secret,
      note: secret,
      approved: true,
      connected: true,
      approvedAt: "2026-09-01T00:00:00Z",
    })),
  };
  const cleaned = cleanConnectionPlan(contaminated, "aby");
  assert.deepEqual(cleaned, plan());
  const exported = buildConnectionHandoff(contaminated);
  assert.ok(!exported.includes(secret));
  assert.ok(!exported.includes("approvedAt"));
  assert.ok(!exported.includes('"connected": true'));
  assert.ok(!exported.includes('"approved": true'));
  assert.equal(JSON.parse(exported).productionAuthority, false);
  assert.throws(() => cleanConnectionPlan({ ...plan(), selections: [{ ...plan().selections[0], capabilityIds: [secret] }] }, "aby"), (error) => {
    assert.ok(error instanceof Error);
    assert.ok(!error.message.includes(secret));
    return true;
  });
});

test("write requests stay requests in an IT handoff with no production authority", () => {
  const handoff = JSON.parse(buildConnectionHandoff(plan()));
  assert.equal(handoff.planningOnly, true);
  assert.equal(handoff.productionAuthority, false);
  assert.match(handoff.purpose, /no connection, consent, or action approval/i);
  const request = handoff.requests[0];
  const write = request.capabilities.find((capability: { id: string }) => capability.id === "mail.send");
  assert.deepEqual(write, { id: "mail.send", label: "Send reviewed email", requestedAccess: "write", productionAuthority: false });
  assert.ok(handoff.beforeAnyLiveConnection.some((line: string) => /separate authorization and review/i.test(line)));
});

test("plans and IT handoffs round-trip deterministically without mutating their inputs", () => {
  const source = plan();
  const before = JSON.stringify(source);
  const cleaned = cleanConnectionPlan(JSON.parse(before), "aby");
  assert.deepEqual(cleaned, source);
  const firstExport = buildConnectionHandoff(cleaned);
  assert.deepEqual(cleanConnectionPlan(JSON.parse(firstExport), "aby"), source);
  assert.equal(buildConnectionHandoff(cleanConnectionPlan(JSON.parse(firstExport), "aby")), firstExport);
  assert.equal(JSON.stringify(source), before);
  cleaned.selections[0].capabilityIds.push("calendar.write");
  assert.equal(JSON.stringify(source), before);
});
