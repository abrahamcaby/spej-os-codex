import type { DatabaseSync } from "node:sqlite";
import type { WorkspaceState } from "./types";
import { preserveRecurringCompletionHistory } from "./tasks";
import { cleanProjects } from "./operations";
import { preserveEmploymentHistory, preserveOriginalSource } from "./relationship-context";

const emptyWorkspace: WorkspaceState = {
  reminders: [], tasks: [], content: [], accounts: [], contacts: [], activities: [],
  opportunities: [], partnerships: [], projects: [], campaigns: [], marketingMetrics: [],
};

export function initializeWorkspaceStore(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS workspace_state (
      state_key TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return database;
}

export function readWorkspaceState(database: DatabaseSync): WorkspaceState {
  const rows = database.prepare("SELECT state_key, payload_json FROM workspace_state WHERE state_key IN ('reminders', 'tasks', 'content', 'accounts', 'contacts', 'activities', 'opportunities', 'partnerships', 'projects', 'campaigns', 'marketingMetrics')").all() as unknown as Array<{ state_key: keyof WorkspaceState; payload_json: string }>;
  const canonicalRows = rows.filter((row) => row.state_key === "reminders" || row.state_key === "tasks");
  if (canonicalRows.length === 1) {
    throw new Error("The saved workspace is incomplete. Restore it from a backup before making changes.");
  }
  const state = structuredClone(emptyWorkspace);
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.payload_json);
      if (!Array.isArray(parsed)) throw new Error("Workspace rows must contain lists.");
      state[row.state_key] = parsed;
    } catch (error) {
      throw new Error(
        `The saved ${row.state_key} data is corrupt. Restore it from a backup before making changes.`,
        { cause: error },
      );
    }
  }
  state.projects = cleanProjects(state.projects);
  return state;
}

export function hasWorkspaceState(database: DatabaseSync) {
  const row = database.prepare("SELECT COUNT(*) AS count FROM workspace_state WHERE state_key IN ('reminders', 'tasks')").get() as unknown as { count: number };
  return Number(row.count) > 0;
}

/** Writes rows inside the caller's transaction. Use writeWorkspaceState for ordinary saves. */
export function writeWorkspaceStateRows(database: DatabaseSync, state: WorkspaceState, now = new Date().toISOString()) {
  const statement = database.prepare(`
    INSERT INTO workspace_state (state_key, payload_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT (state_key) DO UPDATE SET
      payload_json = excluded.payload_json,
      updated_at = excluded.updated_at
  `);
  const existing = readWorkspaceState(database);
  const persisted = {
      reminders: state.reminders,
      tasks: preserveRecurringCompletionHistory(existing.tasks, state.tasks),
      content: state.content,
      accounts: state.accounts.map((item) => preserveOriginalSource(existing.accounts.find((previous) => previous.id === item.id), item)),
      contacts: state.contacts.map((item) => preserveEmploymentHistory(existing.contacts.find((previous) => previous.id === item.id), item, "")),
      activities: state.activities.map((item) => {
        const previous = existing.activities.find((value) => value.id === item.id);
        return { ...item, capturedAt: previous?.capturedAt || previous?.createdAt || item.capturedAt || now };
      }),
      opportunities: state.opportunities,
      partnerships: state.partnerships,
      projects: state.projects,
      campaigns: state.campaigns,
      marketingMetrics: state.marketingMetrics,
  };
  statement.run("reminders", JSON.stringify(persisted.reminders), now);
  statement.run("tasks", JSON.stringify(persisted.tasks), now);
  statement.run("content", JSON.stringify(persisted.content), now);
  statement.run("accounts", JSON.stringify(persisted.accounts), now);
  statement.run("contacts", JSON.stringify(persisted.contacts), now);
  statement.run("activities", JSON.stringify(persisted.activities), now);
  statement.run("opportunities", JSON.stringify(persisted.opportunities), now);
  statement.run("partnerships", JSON.stringify(persisted.partnerships), now);
  statement.run("projects", JSON.stringify(persisted.projects), now);
  statement.run("campaigns", JSON.stringify(persisted.campaigns), now);
  statement.run("marketingMetrics", JSON.stringify(persisted.marketingMetrics), now);
  return persisted;
}

export function writeWorkspaceState(database: DatabaseSync, state: WorkspaceState, now = new Date().toISOString()) {
  database.exec("BEGIN IMMEDIATE");
  try {
    const persisted = writeWorkspaceStateRows(database, state, now);
    database.exec("COMMIT");
    return persisted;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
