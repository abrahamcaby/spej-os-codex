import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { AgentWorkspaceProposal } from "./types";

export type MeetingIntakeStatus = "ready" | "processing" | "proposed" | "needs_clarification" | "applied" | "discarded" | "failed";
export type MeetingSourceKind = "Pasted transcript" | "Meeting notes";

export type MeetingIntakeContext = {
  accountId?: string;
  opportunityId?: string;
  projectId?: string;
};

export type MeetingIntakeRecord = {
  id: string;
  dedupeKey: string;
  bodyHash: string;
  title: string;
  meetingDate: string;
  sourceKind: MeetingSourceKind;
  sourceLabel: "Manual meeting intake";
  bodyText: string;
  context: MeetingIntakeContext;
  status: MeetingIntakeStatus;
  replyText: string;
  modelEnvelope?: unknown;
  proposal?: AgentWorkspaceProposal;
  baseWorkspaceVersion?: string;
  provider?: string;
  model?: string;
  errorText?: string;
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
  appliedAt?: string;
};

type MeetingRow = {
  id: string; dedupe_key: string; body_hash: string; title: string; meeting_date: string;
  source_kind: string; source_label: string; body_text: string; context_json: string;
  status: string; reply_text: string; model_envelope_json: string | null; proposal_json: string | null;
  base_workspace_version: string | null; provider: string | null; model: string | null;
  error_text: string | null; created_at: string; updated_at: string; processed_at: string | null; applied_at: string | null;
};

function parseJson(value: string | null, fallback: unknown) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function fromRow(row: MeetingRow): MeetingIntakeRecord {
  return {
    id: row.id, dedupeKey: row.dedupe_key, bodyHash: row.body_hash, title: row.title,
    meetingDate: row.meeting_date, sourceKind: row.source_kind as MeetingSourceKind,
    sourceLabel: "Manual meeting intake", bodyText: row.body_text,
    context: parseJson(row.context_json, {}) as MeetingIntakeContext,
    status: row.status as MeetingIntakeStatus, replyText: row.reply_text,
    modelEnvelope: parseJson(row.model_envelope_json, undefined),
    proposal: parseJson(row.proposal_json, undefined) as AgentWorkspaceProposal | undefined,
    baseWorkspaceVersion: row.base_workspace_version || undefined,
    provider: row.provider || undefined, model: row.model || undefined,
    errorText: row.error_text || undefined, createdAt: row.created_at, updatedAt: row.updated_at,
    processedAt: row.processed_at || undefined, appliedAt: row.applied_at || undefined,
  };
}

export function initializeMeetingIntakeStore(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS meeting_intake (
      id TEXT PRIMARY KEY,
      dedupe_key TEXT NOT NULL UNIQUE,
      body_hash TEXT NOT NULL,
      title TEXT NOT NULL,
      meeting_date TEXT NOT NULL,
      source_kind TEXT NOT NULL,
      source_label TEXT NOT NULL,
      body_text TEXT NOT NULL,
      context_json TEXT NOT NULL,
      status TEXT NOT NULL,
      reply_text TEXT NOT NULL DEFAULT '',
      model_envelope_json TEXT,
      proposal_json TEXT,
      base_workspace_version TEXT,
      provider TEXT,
      model TEXT,
      error_text TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      processed_at TEXT,
      applied_at TEXT
    );
    CREATE INDEX IF NOT EXISTS meeting_intake_updated_idx ON meeting_intake(updated_at DESC);
  `);
  return database;
}

export function normalizeMeetingBody(value: string) {
  return value.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n").map((line) => line.trimEnd()).join("\n").trim();
}

export function meetingBodyHash(bodyText: string) {
  return createHash("sha256").update(normalizeMeetingBody(bodyText)).digest("hex");
}

export function meetingDedupeKey(title: string, meetingDate: string, bodyText: string) {
  return createHash("sha256").update(`manual\n${meetingDate}\n${title.trim().toLowerCase().replace(/\s+/g, " ")}\n${normalizeMeetingBody(bodyText)}`).digest("hex");
}

export function findMeetingIntakeByDedupe(database: DatabaseSync, dedupeKey: string) {
  const row = database.prepare("SELECT * FROM meeting_intake WHERE dedupe_key = ?").get(dedupeKey) as unknown as MeetingRow | undefined;
  return row ? fromRow(row) : undefined;
}

export function getMeetingIntake(database: DatabaseSync, id: string) {
  const row = database.prepare("SELECT * FROM meeting_intake WHERE id = ?").get(id) as unknown as MeetingRow | undefined;
  return row ? fromRow(row) : undefined;
}

export function listMeetingIntakes(database: DatabaseSync, limit = 10) {
  const safeLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
  return (database.prepare("SELECT * FROM meeting_intake ORDER BY updated_at DESC LIMIT ?").all(safeLimit) as unknown as MeetingRow[]).map(fromRow);
}

export function createMeetingIntake(database: DatabaseSync, input: { title: string; meetingDate: string; sourceKind: MeetingSourceKind; bodyText: string; context?: MeetingIntakeContext }, now = new Date().toISOString()) {
  const bodyText = normalizeMeetingBody(input.bodyText);
  const dedupeKey = meetingDedupeKey(input.title, input.meetingDate, bodyText);
  const record: MeetingIntakeRecord = { id: randomUUID(), dedupeKey, bodyHash: meetingBodyHash(bodyText), title: input.title.trim(), meetingDate: input.meetingDate, sourceKind: input.sourceKind, sourceLabel: "Manual meeting intake", bodyText, context: input.context || {}, status: "ready", replyText: "", createdAt: now, updatedAt: now };
  const inserted = database.prepare(`INSERT INTO meeting_intake (id,dedupe_key,body_hash,title,meeting_date,source_kind,source_label,body_text,context_json,status,reply_text,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(dedupe_key) DO NOTHING`).run(record.id, record.dedupeKey, record.bodyHash, record.title, record.meetingDate, record.sourceKind, record.sourceLabel, record.bodyText, JSON.stringify(record.context), record.status, record.replyText, record.createdAt, record.updatedAt);
  if (Number(inserted.changes) === 0) {
    const existing = findMeetingIntakeByDedupe(database, dedupeKey);
    if (!existing) throw new Error("The existing meeting intake could not be read after deduplication.");
    return { record: existing, duplicate: true } as const;
  }
  return { record, duplicate: false } as const;
}

export function claimMeetingProcessing(database: DatabaseSync, id: string, context: MeetingIntakeContext, allowReviewed = false, now = new Date().toISOString(), staleBefore = new Date(Date.parse(now) - 10 * 60_000).toISOString()) {
  const row = database.prepare(`UPDATE meeting_intake SET status='processing', context_json=?, reply_text='', model_envelope_json=NULL, proposal_json=NULL, base_workspace_version=NULL, provider=NULL, model=NULL, error_text=NULL, updated_at=? WHERE id=? AND (status IN ('ready','failed') OR (?=1 AND status IN ('proposed','needs_clarification')) OR (status='processing' AND updated_at < ?)) RETURNING *`).get(JSON.stringify(context), now, id, allowReviewed ? 1 : 0, staleBefore) as unknown as MeetingRow | undefined;
  return row ? fromRow(row) : undefined;
}

export function saveMeetingProposalIfProcessing(database: DatabaseSync, id: string, expectedUpdatedAt: string, input: { status: "proposed" | "needs_clarification"; replyText: string; modelEnvelope: unknown; proposal: AgentWorkspaceProposal; baseWorkspaceVersion: string; provider?: string; model?: string }, now = new Date().toISOString()) {
  const { nextWorkspace: _nextWorkspace, ...storedProposal } = input.proposal;
  void _nextWorkspace;
  const row = database.prepare(`UPDATE meeting_intake SET status=?, reply_text=?, model_envelope_json=?, proposal_json=?, base_workspace_version=?, provider=?, model=?, error_text=NULL, processed_at=?, updated_at=? WHERE id=? AND status='processing' AND updated_at=? RETURNING *`).get(input.status, input.replyText, JSON.stringify(input.modelEnvelope), JSON.stringify(storedProposal), input.baseWorkspaceVersion, input.provider || null, input.model || null, now, now, id, expectedUpdatedAt) as unknown as MeetingRow | undefined;
  return row ? fromRow(row) : undefined;
}

export function markMeetingFailedIfProcessing(database: DatabaseSync, id: string, expectedUpdatedAt: string, errorText: string, keepReady = false, now = new Date().toISOString()) {
  const row = database.prepare("UPDATE meeting_intake SET status=?, error_text=?, updated_at=? WHERE id=? AND status='processing' AND updated_at=? RETURNING *").get(keepReady ? "ready" : "failed", errorText.slice(0, 2_000), now, id, expectedUpdatedAt) as unknown as MeetingRow | undefined;
  return row ? fromRow(row) : undefined;
}

export function markMeetingDiscarded(database: DatabaseSync, id: string, now = new Date().toISOString()) {
  database.prepare("UPDATE meeting_intake SET status='discarded', updated_at=? WHERE id=? AND status IN ('ready','processing','proposed','needs_clarification','failed')").run(now, id);
  return getMeetingIntake(database, id);
}

export function markMeetingAppliedIfCurrent(database: DatabaseSync, id: string, expectedUpdatedAt: string, now = new Date().toISOString()) {
  const row = database.prepare("UPDATE meeting_intake SET status='applied', applied_at=?, updated_at=?, error_text=NULL WHERE id=? AND status='proposed' AND updated_at=? RETURNING *").get(now, now, id, expectedUpdatedAt) as unknown as MeetingRow | undefined;
  return row ? fromRow(row) : undefined;
}

export function markMeetingApplied(database: DatabaseSync, id: string, now = new Date().toISOString()) {
  const current = getMeetingIntake(database, id);
  if (!current || current.status === "applied") return current;
  return markMeetingAppliedIfCurrent(database, id, current.updatedAt, now);
}

export function meetingIntakeSummary(record: MeetingIntakeRecord) {
  const { bodyText: _bodyText, modelEnvelope: _modelEnvelope, proposal: _proposal, ...summary } = record;
  void _bodyText; void _modelEnvelope; void _proposal;
  return summary;
}
