import assert from "node:assert/strict";
import test from "node:test";
import { previewCanEditTask, previewCanViewTask } from "../lib/task-access-preview";
import { cleanTaskItems, normalizeTaskHierarchy, taskVisibility, taskWorkspaceId, taskWorkspaceLabel } from "../lib/tasks";
import type { ProjectItem, TaskItem } from "../lib/types";

function task(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    id: "task-1",
    title: "Private leadership follow-up",
    description: "",
    due: "2026-09-03",
    recurrence: "One-time",
    priority: "Normal",
    owner: "Sagar",
    ownerProfileId: "sagar",
    visibility: "Private",
    workspaceId: "gtm",
    done: false,
    ...overrides,
  };
}

test("private work is visible only to its owner in the access preview", () => {
  const item = task();
  assert.equal(previewCanViewTask(item, "sagar", []), true);
  assert.equal(previewCanViewTask(item, "aby", []), false);
  assert.equal(previewCanViewTask(item, "alex", []), false);
  assert.equal(previewCanViewTask(item, "unknown", []), false);
});

test("a stable owner profile overrides a conflicting display name", () => {
  const item = task({ ownerProfileId: "sagar", owner: "Aby" });
  assert.equal(previewCanViewTask(item, "sagar", []), true);
  assert.equal(previewCanEditTask(item, "sagar", []), true);
  assert.equal(previewCanViewTask(item, "aby", []), false);
  assert.equal(previewCanEditTask(item, "aby", []), false);
});

test("workspace and company visibility use explicit preview grants", () => {
  const workspaceTask = task({ visibility: "Workspace" });
  assert.equal(previewCanViewTask(workspaceTask, "aby", []), true);
  assert.equal(previewCanViewTask(workspaceTask, "joseph", []), false);
  const companyTask = task({ visibility: "Company" });
  for (const profile of ["aby", "sagar", "alex", "joseph", "ken", "sean"]) {
    assert.equal(previewCanViewTask(companyTask, profile, []), true, profile);
  }
});

test("visibility is separate from edit rights", () => {
  const shared = task({ visibility: "Workspace" });
  assert.equal(previewCanEditTask(shared, "sagar", []), true);
  assert.equal(previewCanEditTask(shared, "aby", []), true);
  assert.equal(previewCanEditTask(shared, "ken", []), false);
  assert.equal(previewCanEditTask(task({ visibility: "Company" }), "aby", []), false);
});

test("legacy and unsupported visibility fail closed while workspaces remain deterministic", () => {
  const [legacy] = cleanTaskItems([{ title: "Legacy", category: "Sales" }]);
  assert.equal(legacy.visibility, "Private");
  assert.equal(legacy.workspaceId, "gtm");
  assert.equal(taskVisibility({ visibility: "Public" as TaskItem["visibility"] }), "Private");
  assert.equal(taskWorkspaceLabel(task({ workspaceId: "project-management" }), []), "Project Management");
});

test("a linked project is authoritative for task workspace", () => {
  const projects = [{ id: "project-1", name: "GTM launch", workArea: "GTM" }] as ProjectItem[];
  const linked = task({ relatedType: "project", relatedId: "project-1", workspaceId: "project-management" });
  assert.equal(taskWorkspaceId(linked, projects), "gtm");
  assert.equal(taskWorkspaceLabel(linked, projects), "GTM");
});

test("subtasks cannot broaden their parent's workspace or visibility", () => {
  const parent = task({ id: "parent", owner: "Aby", ownerProfileId: "aby", visibility: "Private", workspaceId: "gtm" });
  const child = task({ id: "child", parentId: "parent", owner: "Ken", ownerProfileId: "ken", visibility: "Company", workspaceId: "project-management" });
  const normalized = normalizeTaskHierarchy([parent, child]);
  const savedChild = normalized.find((item) => item.id === "child")!;
  assert.equal(savedChild.visibility, "Private");
  assert.equal(savedChild.workspaceId, "gtm");
  assert.equal(savedChild.ownerProfileId, "aby");
  assert.equal(previewCanViewTask(savedChild, "aby", []), true);
  assert.equal(previewCanViewTask(savedChild, "ken", []), false);
});

test("shared subtasks may be delegated without broadening the parent boundary", () => {
  const parent = task({ id: "parent", owner: "Aby", ownerProfileId: "aby", visibility: "Workspace", workspaceId: "gtm" });
  const child = task({ id: "child", parentId: "parent", owner: "Ken", ownerProfileId: "ken", visibility: "Company", workspaceId: "project-management" });
  const normalized = normalizeTaskHierarchy([parent, child]);
  const savedChild = normalized.find((item) => item.id === "child")!;
  assert.equal(savedChild.visibility, "Workspace");
  assert.equal(savedChild.workspaceId, "gtm");
  assert.equal(savedChild.ownerProfileId, "ken");
});
