import assert from "node:assert/strict";
import test from "node:test";
import { CONNECTION_CATALOG } from "../lib/integrations/connection-catalog";

test("the connection catalog covers the seven bounded providers with unique functional capabilities", () => {
  assert.deepEqual(CONNECTION_CATALOG.map((entry) => entry.id), [
    "outlook-mail", "outlook-calendar", "teams", "sharepoint", "onedrive", "granola", "plaud",
  ]);
  assert.deepEqual(CONNECTION_CATALOG.map((entry) => entry.provider), [
    "microsoft", "microsoft", "microsoft", "microsoft", "microsoft", "granola", "plaud",
  ]);
  const capabilityIds = CONNECTION_CATALOG.flatMap((entry) => entry.capabilities.map((capability) => capability.id));
  assert.equal(new Set(capabilityIds).size, capabilityIds.length);
  for (const entry of CONNECTION_CATALOG) {
    assert.ok(entry.scopes.length > 0);
    assert.equal(new Set(entry.scopes).size, entry.scopes.length);
    assert.ok(entry.scopes.every((scope) => scope === "personal" || scope === "company"));
    assert.ok(entry.capabilities.length > 0);
    assert.ok(entry.capabilities.every((capability) => capability.access === "read" || capability.access === "write"));
    assert.ok(entry.setupSteps.length >= 3);
    assert.ok(entry.surfaces.length > 0);
  }
});

test("document knowledge requests remain bounded future work with source access checks", () => {
  for (const id of ["sharepoint", "onedrive"]) {
    const entry = CONNECTION_CATALOG.find((provider) => provider.id === id)!;
    const excerpts = entry.capabilities.find((capability) => capability.id === `${id}.excerpts.read`)!;
    assert.equal(excerpts.label, "Read permitted document excerpts");
    assert.equal(excerpts.access, "read");
    assert.match(excerpts.description, /bounded excerpts.*source access and sensitivity checks/i);
    assert.match(excerpts.description, /ingestion is not implemented/i);
    assert.ok(entry.surfaces.includes("SOSA"));
    assert.ok(entry.setupSteps.some((step) => /retention limits.*source citations/i.test(step)));
  }
});

test("catalog readiness does not imply a live adapter and distinguishes the OneDrive contract", () => {
  const entry = (id: string) => CONNECTION_CATALOG.find((provider) => provider.id === id)!;
  for (const id of ["outlook-mail", "outlook-calendar", "teams", "sharepoint"]) {
    assert.match(entry(id).foundation, /pure/i);
    assert.match(entry(id).foundation, /no live adapter|live adapter.*not implemented/i);
  }
  assert.match(entry("onedrive").foundation, /contract-only/i);
  assert.match(entry("onedrive").foundation, /no OneDrive-specific mapper/i);
  for (const id of ["granola", "plaud"]) {
    assert.match(entry(id).foundation, /adapter.*not implemented/i);
  }
  assert.deepEqual(entry("sharepoint").scopes, ["company"]);
  assert.ok(entry("granola").capabilities.every((capability) => capability.access === "read"));
  assert.ok(entry("plaud").capabilities.every((capability) => capability.access === "read"));
});

test("catalog documentation uses the reviewed official pages and does not prescribe OAuth permission scopes", () => {
  const officialUrls = new Set([
    "https://learn.microsoft.com/en-us/graph/overview",
    "https://docs.granola.ai/help-center/sharing/integrations/mcp",
    "https://docs.plaud.ai/plaud-mcp-cli/mcp",
  ]);
  for (const entry of CONNECTION_CATALOG) {
    assert.ok(officialUrls.has(entry.docsUrl));
    assert.doesNotMatch(JSON.stringify(entry), /Mail\.Read|Mail\.Send|Calendars\.ReadWrite|Sites\.Read\.All|Files\.ReadWrite\.All/);
  }
});
