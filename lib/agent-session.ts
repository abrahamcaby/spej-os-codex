import type { WorkspaceState } from "./types";
import { normalizeWorkspace } from "./workspace-normalization";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, field]) => [key, canonical(field)]));
  return value;
}

/** A snapshot check, not authentication or a replacement for company-wide concurrency control. */
export function workspaceFingerprintPayload(workspace: WorkspaceState) {
  return JSON.stringify(canonical(normalizeWorkspace(workspace)));
}

export async function workspaceFingerprint(workspace: WorkspaceState) {
  const data = new TextEncoder().encode(workspaceFingerprintPayload(workspace));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export type AgentConversationTurn = { role: "user" | "assistant"; text: string; status?: "proposed" | "applied" | "discarded" };
export function cleanAgentHistory(value: unknown): AgentConversationTurn[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-10).flatMap((item) => {
    if (!item || typeof item !== "object" || !["user", "assistant"].includes(item.role) || typeof item.text !== "string") return [];
    return [{ role: item.role, text: item.text.slice(0, 1800), ...(["proposed", "applied", "discarded"].includes(item.status) ? { status: item.status } : {}) } as AgentConversationTurn];
  });
}

export function agentRecordCoverage(workspace: WorkspaceState) {
  const active = Object.fromEntries(Object.entries(workspace).map(([key, rows]) => [key, rows.filter((row) => !("archivedAt" in row) || !row.archivedAt)])) as WorkspaceState;
  return { evidence: Object.fromEntries(Object.entries(active).map(([key, rows]) => [key, rows.slice(0, 300)])), total: Object.values(active).reduce((sum, rows) => sum + rows.length, 0), included: Object.values(active).reduce((sum, rows) => sum + Math.min(rows.length, 300), 0) };
}
