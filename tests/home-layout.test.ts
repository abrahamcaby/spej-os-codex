import assert from "node:assert/strict";
import test from "node:test";
import { homeLayoutKey, moveHomeModule, normalizeHomeLayout, resolveHomeModules, type HomeLayout } from "../lib/home-layout";
import { getRoleHomeModules, getTeamViewProfile, TEAM_HOME_MODULES } from "../lib/team-views";
import { getPreviewAccessPolicy } from "../lib/task-access-preview";
const defaults: HomeLayout = { version: 1, selectedModuleIds: ["gtm", "content-qa"], scope: "mine" };
test("layout normalization preserves deliberate empty views and removes unknown or duplicate components", () => {
  assert.deepEqual(normalizeHomeLayout(null, defaults), defaults);
  assert.deepEqual(normalizeHomeLayout({ version: 1, selectedModuleIds: [] }, defaults).selectedModuleIds, []);
  assert.deepEqual(normalizeHomeLayout({ version: 1, selectedModuleIds: ["gtm", "gtm", "made-up"], scope: "company-admin" }, defaults), { version: 1, selectedModuleIds: ["gtm"], scope: "mine" });
});
test("components intersect current admin availability and portals without changing grants", () => {
  const layout: HomeLayout = { ...defaults, selectedModuleIds: TEAM_HOME_MODULES.map((item) => item.id) };
  const grants = [...layout.selectedModuleIds];
  assert.equal(resolveHomeModules(layout, grants, () => true).length, 5);
  assert.deepEqual(resolveHomeModules(layout, ["projects"], () => true).map((item) => item.id), ["projects"]);
  assert.equal(resolveHomeModules(layout, grants, () => false).length, 0);
  assert.deepEqual(grants, layout.selectedModuleIds);
});
test("views reorder deterministically and stay isolated by profile", () => {
  assert.deepEqual(moveHomeModule(defaults, "gtm", 1).selectedModuleIds, ["content-qa", "gtm"]);
  assert.deepEqual(moveHomeModule(defaults, "gtm", -1), defaults);
  assert.notEqual(homeLayoutKey("aby"), homeLayoutKey("blanca"));
});
test("Blanca has engineering and project templates with member-level preview access", () => {
  assert.equal(getTeamViewProfile("blanca")?.jobTitle, "Associate Developer");
  assert.deepEqual(getRoleHomeModules("blanca").map((item) => item.id), ["technical", "projects"]);
  assert.equal(getPreviewAccessPolicy("blanca")?.role, "Member");
});
