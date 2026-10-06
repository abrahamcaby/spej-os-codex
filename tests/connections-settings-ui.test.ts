import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConnectionsSettings, createConnectionPlanStore } from "../components/connections-settings";
import { CONNECTION_CATALOG } from "../lib/integrations/connection-catalog";
import { buildConnectionHandoff } from "../lib/integrations/connection-plan";

const selection = { providerId: "outlook-mail", scope: "personal" as const, capabilityIds: ["mail.read"] };

function memoryStorage() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

test("settings server render makes planning boundaries and actual connection state explicit", () => {
  const html = renderToStaticMarkup(createElement(ConnectionsSettings, { profileId: "aby", profileName: "Aby" }));
  for (const text of ["Integrations &amp; Connections", "My connections", "Company connections", "connection planner", "does not grant access, connect an account, or sync data", "Last sync: Never", "Connection plan", "not sent to IT", "Not submitted or approved", "Start with read-only access", "Setup steps for your IT team", "Where data would appear"]) assert.ok(html.includes(text), text);
  assert.match(html, /aria-pressed="true">My connections/);
  assert.match(html, /aria-pressed="false">Company connections/);
  assert.equal((html.match(/>Not connected</g) || []).length, CONNECTION_CATALOG.filter((item) => item.scopes.includes("personal")).length);
  assert.doesNotMatch(html, /<button[^>]*>\s*(Connect|Reconnect|Sync now|Approve|Send to IT)\s*<\/button>/);
});

test("personal catalog excludes company-only cards and leaves all access choices unchecked", () => {
  const html = renderToStaticMarkup(createElement(ConnectionsSettings, { profileId: "aby", profileName: "Aby" }));
  for (const name of ["Outlook Mail", "Outlook Calendar", "Microsoft Teams", "OneDrive", "Granola", "Plaud"]) assert.ok(html.includes(name), name);
  assert.doesNotMatch(html, /<h3[^>]*>SharePoint<\/h3>/);
  assert.doesNotMatch(html, /checked=""/);
  assert.doesNotMatch(html, /type="(?:password|url|email|text)"/);
  assert.doesNotMatch(html, /<textarea/);
  assert.doesNotMatch(html, /<details[^>]* open/);
  assert.match(html, /Include write capabilities in this plan/);
  assert.doesNotMatch(html, /Send reviewed email<\/strong>/);
});

test("browser storage is not read during store creation or server rendering", () => {
  let reads = 0;
  const store = createConnectionPlanStore("aby", () => { reads += 1; throw new Error("not available on server"); });
  assert.equal(store.getSnapshot().loaded, false);
  assert.deepEqual(store.getServerSnapshot().plan.selections, []);
  renderToStaticMarkup(createElement(ConnectionsSettings, { profileId: "aby", profileName: "<script>unsafe</script>" }));
  assert.equal(reads, 0);
  const markup = renderToStaticMarkup(createElement(ConnectionsSettings, { profileId: "sagar", profileName: "<script>unsafe</script>" }));
  assert.match(markup, /&lt;script&gt;unsafe&lt;\/script&gt;/);
  assert.doesNotMatch(markup, /<script>unsafe/);
});

test("plans survive a browser reload while staying isolated by profile and scope", () => {
  const storage = memoryStorage();
  const aby = createConnectionPlanStore("aby", () => storage);
  const sagar = createConnectionPlanStore("sagar", () => storage);
  const unsubscribeAby = aby.subscribe(() => {});
  const unsubscribeSagar = sagar.subscribe(() => {});
  assert.notEqual(aby.key, sagar.key);
  assert.match(aby.key, /:v1:aby$/);
  assert.equal(aby.saveSelection(selection), true);
  aby.saveSelection({ ...selection, scope: "company", capabilityIds: ["mail.read", "mail.send"] });
  assert.deepEqual(sagar.getSnapshot().plan.selections, []);
  const reopened = createConnectionPlanStore("aby", () => storage);
  const unsubscribeReopened = reopened.subscribe(() => {});
  assert.equal(reopened.getSnapshot().plan.selections.length, 2);
  reopened.removeSelection("outlook-mail", "personal");
  assert.deepEqual(reopened.getSnapshot().plan.selections, [{ ...selection, scope: "company", capabilityIds: ["mail.read", "mail.send"] }]);
  const exported = JSON.parse(buildConnectionHandoff(reopened.getSnapshot().plan));
  assert.equal(exported.planningOnly, true);
  assert.equal(exported.productionAuthority, false);
  unsubscribeAby(); unsubscribeSagar(); unsubscribeReopened();
});

test("write failure retains a downloadable in-memory plan and shows a persistence warning", () => {
  const store = createConnectionPlanStore("aby", () => ({ getItem: () => null, setItem: () => { throw new Error("quota"); } }));
  const unsubscribe = store.subscribe(() => {});
  assert.equal(store.saveSelection(selection), true);
  assert.deepEqual(store.getSnapshot().plan.selections, [selection]);
  assert.match(store.getSnapshot().notice, /Browser storage is unavailable/);
  assert.match(store.getSnapshot().notice, /Download your plan/);
  assert.match(buildConnectionHandoff(store.getSnapshot().plan), /mail.read/);
  unsubscribe();
});

test("invalid capability changes return failure without changing the active or persisted plan", () => {
  const storage = memoryStorage();
  const store = createConnectionPlanStore("aby", () => storage);
  const unsubscribe = store.subscribe(() => {});
  assert.equal(store.saveSelection(selection), true);
  const previousPlan = store.getSnapshot().plan;
  const previousSaved = storage.getItem(store.key);
  assert.equal(store.saveSelection({ ...selection, capabilityIds: ["stale-private-value"] }), false);
  assert.equal(store.getSnapshot().plan, previousPlan);
  assert.equal(storage.getItem(store.key), previousSaved);
  assert.match(store.getSnapshot().notice, /selection could not be saved/);
  assert.match(store.getSnapshot().notice, /previous plan is unchanged/);
  assert.doesNotMatch(store.getSnapshot().notice, /stale-private-value/);
  assert.equal(store.saveSelection({ ...selection, capabilityIds: ["mail.read", "mail.send"] }), true);
  assert.equal(store.getSnapshot().notice, "");
  unsubscribe();
});

test("an unreadable future or other-profile plan is preserved until explicit recoverable reset", () => {
  for (const saved of [
    { schemaVersion: 2, profileId: "aby", selections: [selection], privateContent: "DO NOT DISPLAY" },
    { schemaVersion: 1, profileId: "sagar", selections: [selection], privateContent: "DO NOT DISPLAY" },
    { schemaVersion: 1, profileId: "aby", selections: [{ ...selection, capabilityIds: ["unknown.scope"] }] },
  ]) {
    const storage = memoryStorage();
    const store = createConnectionPlanStore("aby", () => storage);
    const original = JSON.stringify(saved);
    storage.setItem(store.key, original);
    const unsubscribe = store.subscribe(() => {});
    assert.equal(store.getSnapshot().blocked, true);
    assert.deepEqual(store.getSnapshot().plan.selections, []);
    assert.equal(store.saveSelection(selection), false);
    assert.equal(storage.getItem(store.key), original);
    assert.doesNotMatch(store.getSnapshot().notice, /DO NOT DISPLAY|unknown.scope|sagar/);
    store.reset();
    assert.equal(store.getSnapshot().blocked, false);
    assert.deepEqual(store.getSnapshot().plan.selections, []);
    const backup = [...storage.values.entries()].find(([key]) => key.startsWith(`${store.key}:recovery:`));
    assert.equal(backup?.[1], original);
    assert.equal(store.saveSelection(selection), true);
    unsubscribe();
  }
});

test("failed recovery does not remove or replace the original plan", () => {
  const storage = memoryStorage();
  const store = createConnectionPlanStore("aby", () => ({ getItem: storage.getItem, setItem: () => { throw new Error("quota"); } }));
  const original = "not valid json";
  storage.setItem(store.key, original);
  const unsubscribe = store.subscribe(() => {});
  store.reset();
  assert.equal(store.getSnapshot().blocked, true);
  assert.equal(storage.getItem(store.key), original);
  assert.match(store.getSnapshot().notice, /Nothing was removed/);
  unsubscribe();
});

test("unknown saved fields cannot enter the active plan or handoff", () => {
  const storage = memoryStorage();
  const store = createConnectionPlanStore("aby", () => storage);
  storage.setItem(store.key, JSON.stringify({ schemaVersion: 1, profileId: "aby", token: "SECRET", selections: [{ ...selection, notes: "PRIVATE MESSAGE", approved: true, mcpUrl: "https://untrusted.invalid" }] }));
  const unsubscribe = store.subscribe(() => {});
  assert.deepEqual(store.getSnapshot().plan, { schemaVersion: 1, profileId: "aby", selections: [selection] });
  assert.doesNotMatch(buildConnectionHandoff(store.getSnapshot().plan), /SECRET|PRIVATE MESSAGE|untrusted/);
  unsubscribe();
});
