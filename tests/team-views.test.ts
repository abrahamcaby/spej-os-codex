import assert from "node:assert/strict";
import test from "node:test";
import {
  getRoleHomeLinks,
  getRoleHomeModules,
  getRoleHomePriorities,
  getTeamViewProfile,
  ownerMatchesViewer,
  recordOwnerMatchesViewer,
  PREVIEW_OPERATOR_PROFILE_ID,
  TEAM_FOCUS_AREAS,
  TEAM_VIEW_IDENTITY_NOTICE,
  TEAM_VIEW_PROFILES,
} from "../lib/team-views";

test("preview team profiles have stable unique ids and explicit production identity guidance", () => {
  assert.deepEqual(
    TEAM_VIEW_PROFILES.map(({ id, displayName }) => [id, displayName]),
    [
      ["aby", "Aby"],
      ["sagar", "Sagar"],
      ["alex", "Alex"],
      ["joseph", "Joseph"],
      ["ken", "Ken"],
      ["sean", "Sean"],
      ["blanca", "Blanca"],
    ],
  );
  assert.equal(new Set(TEAM_VIEW_PROFILES.map((profile) => profile.id)).size, 7);
  assert.ok(TEAM_VIEW_PROFILES.every((profile) => profile.profileSource === "preview"));
  assert.ok(
    TEAM_VIEW_PROFILES.every(
      (profile) => profile.productionIdentityProvider === "Microsoft Entra ID",
    ),
  );
  assert.match(TEAM_VIEW_IDENTITY_NOTICE, /Preview profiles only/i);
  assert.match(TEAM_VIEW_IDENTITY_NOTICE, /Microsoft Entra identity/i);
  assert.equal(getTeamViewProfile(PREVIEW_OPERATOR_PROFILE_ID)?.displayName, "Aby");
});

test("focus assignments stay within the requested broad team categories", () => {
  assert.deepEqual(TEAM_FOCUS_AREAS, [
    "GTM",
    "Leadership",
    "Project Management",
    "Content",
    "Technical Delivery",
  ]);
  assert.deepEqual(getTeamViewProfile("aby")?.focusAreas, ["GTM", "Content"]);
  assert.deepEqual(getTeamViewProfile("sagar")?.focusAreas, ["GTM", "Leadership"]);
  assert.deepEqual(getTeamViewProfile("alex")?.focusAreas, ["Leadership", "Project Management"]);
  assert.deepEqual(getTeamViewProfile("joseph")?.focusAreas, ["Project Management"]);
  assert.deepEqual(getTeamViewProfile("ken")?.focusAreas, ["Project Management", "Content"]);
  assert.deepEqual(getTeamViewProfile("sean")?.focusAreas, ["Technical Delivery", "Project Management"]);
});

test("every preview profile defaults to a clean personal work home and an appropriate primary workspace", () => {
  assert.ok(
    TEAM_VIEW_PROFILES.every(
      (profile) => profile.defaultRoute === "today" && profile.defaultRouteLabel === "My work",
    ),
  );
  assert.equal(getTeamViewProfile("aby")?.primaryWorkspaceRoute, "gtm");
  assert.equal(getTeamViewProfile("sagar")?.primaryWorkspaceLabel, "GTM");
  assert.equal(getTeamViewProfile("alex")?.primaryWorkspaceRoute, "delivery");
  assert.equal(getTeamViewProfile("joseph")?.primaryWorkspaceLabel, "Project Management");
  assert.equal(getTeamViewProfile("ken")?.primaryWorkspaceRoute, "delivery");
  assert.equal(getTeamViewProfile("sean")?.primaryWorkspaceLabel, "Project Management");
});

test("preview profile lookup tolerates display-name casing and surrounding whitespace", () => {
  assert.equal(getTeamViewProfile("  ABY ")?.id, "aby");
  assert.equal(getTeamViewProfile(" Sagar ")?.id, "sagar");
  assert.equal(getTeamViewProfile({ profileId: "ALEX" })?.displayName, "Alex");
  assert.equal(getTeamViewProfile({ displayName: "  joseph  " })?.id, "joseph");
  assert.equal(getTeamViewProfile("unknown"), undefined);
  assert.equal(getTeamViewProfile(undefined), undefined);
});

test("owner matching is exact after safe normalization and supports stable profile ids", () => {
  assert.equal(ownerMatchesViewer(" Aby ", "aby"), true);
  assert.equal(ownerMatchesViewer("ABY", getTeamViewProfile("aby")), true);
  assert.equal(ownerMatchesViewer("sagar", { profileId: "sagar" }), true);
  assert.equal(ownerMatchesViewer("Joseph", { displayName: " joseph " }), true);
  assert.equal(ownerMatchesViewer("Ken", "sean"), false);
  assert.equal(ownerMatchesViewer("Aby Abraham", "aby"), false);
  assert.equal(ownerMatchesViewer("Aby, Sagar", "aby"), false);
});

test("owner matching does not silently assign blank, malformed, or unknown values", () => {
  assert.equal(ownerMatchesViewer(undefined, "aby"), false);
  assert.equal(ownerMatchesViewer(null, "aby"), false);
  assert.equal(ownerMatchesViewer("", "aby"), false);
  assert.equal(ownerMatchesViewer("Unassigned", "aby"), false);
  assert.equal(ownerMatchesViewer({ name: "Aby" }, "aby"), false);
  assert.equal(ownerMatchesViewer("Aby", "unknown"), false);
  assert.equal(ownerMatchesViewer("Aby", null), false);
});

test("stable owner profile ids are authoritative while legacy records can still use a display name", () => {
  assert.equal(recordOwnerMatchesViewer({ owner: "Old display name", ownerProfileId: "aby" }, "aby"), true);
  assert.equal(recordOwnerMatchesViewer({ owner: "Aby", ownerProfileId: "sagar" }, "aby"), false);
  assert.equal(recordOwnerMatchesViewer({ owner: "Aby" }, "aby"), true);
  assert.equal(recordOwnerMatchesViewer({ owner: "Aby", ownerProfileId: "" }, "aby"), false);
  assert.equal(recordOwnerMatchesViewer({ ownerProfileId: "missing" }, "aby"), false);
});

test("home priorities always start with assigned work and then follow profile focus order", () => {
  assert.deepEqual(
    getRoleHomePriorities("aby").map(({ id, route }) => [id, route]),
    [
      ["assigned-work", "today"],
      ["gtm-follow-through", "tasks"],
      ["content-work", "content"],
    ],
  );
  assert.deepEqual(
    getRoleHomePriorities("alex").map(({ id }) => id),
    ["assigned-work", "leadership-review", "project-commitments"],
  );
  assert.deepEqual(
    getRoleHomePriorities("sean").map(({ id }) => id),
    ["assigned-work", "technical-delivery", "project-commitments"],
  );
  assert.deepEqual(getRoleHomePriorities("unknown"), []);
});

test("role home links preserve shared access while adding only relevant workspaces", () => {
  assert.deepEqual(
    getRoleHomeLinks("joseph").map(({ label, route }) => [label, route]),
    [
      ["My work", "today"],
      ["Ask SOSA", "agent"],
      ["CRM", "relationships"],
      ["Projects", "delivery"],
    ],
  );
  assert.deepEqual(
    getRoleHomeLinks("sagar").map(({ id }) => id),
    ["my-work", "sosa", "crm", "gtm", "scorecard"],
  );
  assert.deepEqual(
    getRoleHomeLinks("ken").map(({ id }) => id),
    ["my-work", "sosa", "crm", "project-management", "content-studio"],
  );
  assert.deepEqual(getRoleHomeLinks({ profileId: "missing" }), []);
});

test("hybrid profiles compose up to two actionable role modules without implying admin access", () => {
  assert.deepEqual(
    getRoleHomeModules("sagar").map(({ id, label }) => [id, label]),
    [["gtm", "Sales & marketing"], ["leadership", "Company overview"]],
  );
  assert.deepEqual(
    getRoleHomeModules("alex").map(({ id }) => id),
    ["leadership", "projects"],
  );
  assert.deepEqual(
    getRoleHomeModules("ken").map(({ id }) => id),
    ["projects", "content-qa"],
  );
  assert.deepEqual(
    getRoleHomeModules("sean").map(({ id }) => id),
    ["technical", "projects"],
  );
  assert.deepEqual(getRoleHomeModules("joseph").map(({ id }) => id), ["projects"]);
  assert.ok(TEAM_VIEW_PROFILES.every((profile) => getRoleHomeModules(profile).length <= 2));
  assert.ok(getRoleHomeModules("sean").every((module) => !/admin/i.test(module.label)));
  assert.deepEqual(getRoleHomeModules("unknown"), []);
});

test("returned priorities and links are safe copies rather than shared mutable arrays", () => {
  const priorities = getRoleHomePriorities("aby");
  const links = getRoleHomeLinks("aby");
  const modules = getRoleHomeModules("aby");
  (priorities[0] as { label: string }).label = "Changed";
  (links[0] as { label: string }).label = "Changed";
  (modules[0] as { label: string }).label = "Changed";
  assert.equal(getRoleHomePriorities("aby")[0].label, "My assigned work");
  assert.equal(getRoleHomeLinks("aby")[0].label, "My work");
  assert.equal(getRoleHomeModules("aby")[0].label, "Sales & marketing");
});
