import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { cleanProjectCollaboration, projectResourceUrl } from "../lib/project-collaboration";
import { cleanProjects } from "../lib/operations";
import { normalizeWorkspace } from "../lib/workspace-normalization";
import { applyAgentWorkspaceActions } from "../lib/agent-workspace";
import { ProjectCollaborationPanel } from "../components/project-collaboration-panel";
import type { WorkspaceState } from "../lib/types";

const note = { id: "n1", author: "Blanca", occurredOn: "2026-01-01", recordedAt: "2026-01-01T12:00:00Z", summary: "Adapter test passed", nextStep: "Review with Sean" };
const resource = { id: "r1", title: "Project guide", url: "https://example.com/guide#section-2", addedBy: "Sean", addedAt: "2026-01-01T12:00:00Z" };
test("project resource links reject unsafe schemes, credentials and signed download parameters", () => {
  for (const url of ["javascript:alert(1)", "http://example.com", "file:///tmp/a", "https://user:secret@example.com", "https://example.com?token=example", "https://example.com?X-Amz-Signature=example", "https://example.com#access_token=example", "https://example.com#id_token=example"]) assert.equal(projectResourceUrl(url), "", url);
  assert.equal(projectResourceUrl(resource.url), resource.url);
});
test("project collaboration bounds history, deduplicates IDs and rejects unsupported dates", () => {
  assert.deepEqual(cleanProjectCollaboration({}), { progressUpdates: undefined, resources: undefined });
  const clean = cleanProjectCollaboration({ progressUpdates: [note, note, { ...note, id: "future", occurredOn: "2999-01-01" }, { ...note, id: "bad", occurredOn: "2026-02-31" }], resources: [resource, resource, { ...resource, id: "bad", url: "javascript:alert(1)" }] });
  assert.equal(clean.progressUpdates?.length, 1); assert.equal(clean.resources?.length, 1);
  assert.equal(clean.progressUpdates?.[0].recordedAt, "2026-01-01T12:00:00.000Z");
  assert.equal(cleanProjectCollaboration({ resources: Array.from({ length: 205 }, (_, i) => ({ ...resource, id: String(i) })) }).resources?.length, 200);
});
test("collaboration fields survive JSON persistence normalization and unrelated edits", () => {
  const projects = cleanProjects([{ id: "p1", name: "Engineering pilot", progressUpdates: [note], resources: [resource] }]);
  const workspace: WorkspaceState = { reminders: [], tasks: [], content: [], accounts: [], contacts: [], activities: [], opportunities: [], partnerships: [], projects, campaigns: [], marketingMetrics: [] };
  const roundTrip = normalizeWorkspace(JSON.parse(JSON.stringify(workspace)));
  const result = applyAgentWorkspaceActions(roundTrip, [{ type: "update", collection: "projects", recordId: "p1", data: { notes: "Unrelated edit" } }]);
  assert.deepEqual(result.workspace.projects[0].progressUpdates, projects[0].progressUpdates);
  assert.deepEqual(result.workspace.projects[0].resources, projects[0].resources);
  assert.equal(cleanProjects([{ name: "Legacy project" }])[0].progressUpdates, undefined);
});
test("project collaboration exposes progress and link forms without claiming file uploads", () => {
  const [project] = cleanProjects([{ id: "p1", name: "Engineering pilot", progressUpdates: [note], resources: [resource] }]);
  const html = renderToStaticMarkup(createElement(ProjectCollaborationPanel, { project, defaultAuthor: "Blanca", onSave: () => {} }));
  for (const expected of ["Progress updates (1)", "Add progress update", "Attach link", "not verified audit identities", "does not upload, copy or grant file access", "noopener noreferrer", "Review with Sean"]) assert.ok(html.includes(expected), expected);
});
