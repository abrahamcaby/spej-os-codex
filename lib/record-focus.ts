import type { TaskItem } from "./types";

/** Display-only selection; callers always retain their canonical arrays for edits. */
export function focusedRecords<T extends { id: string | number }>(items: T[], id?: string | number): T[] {
  return id === undefined ? items : items.filter((item) => String(item.id) === String(id));
}

/** Keep the whole task family available when navigating to a parent or subtask. */
export function focusedTaskIds(tasks: TaskItem[], id?: string | number): Set<string> | undefined {
  if (id === undefined) return undefined;
  const byId = new Map(tasks.map((task) => [String(task.id), task]));
  let root = byId.get(String(id));
  if (!root) return new Set();
  const visited = new Set<string>();
  while (root.parentId !== undefined && byId.has(String(root.parentId)) && !visited.has(String(root.id))) {
    visited.add(String(root.id));
    root = byId.get(String(root.parentId))!;
  }
  const family = new Set([String(root.id)]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const task of tasks) {
      if (task.parentId !== undefined && family.has(String(task.parentId)) && !family.has(String(task.id))) {
        family.add(String(task.id)); changed = true;
      }
    }
  }
  return family;
}

export function contentMatchesSearch(item: { title: string; angle?: string; owner?: string; pillar?: string }, query: string) {
  const needle = query.trim().toLocaleLowerCase();
  return !needle || [item.title, item.angle, item.owner, item.pillar].filter(Boolean).join(" ").toLocaleLowerCase().includes(needle);
}
