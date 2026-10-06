import { createHash, randomUUID } from "node:crypto";
import {
  assertTenantAccess,
  principalCanAccessRecord,
  requirePermission,
  type AuthenticatedPrincipal,
} from "./auth/principal";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type CanonicalRecord = {
  tenantId: string;
  id: string;
  kind: string;
  version: number;
  data: JsonObject;
  createdAt: string;
  updatedAt: string;
};

export type CanonicalRecordChange =
  | { operation: "create"; id: string; kind: string; data: JsonObject }
  | { operation: "patch"; id: string; kind: string; expectedVersion: number; data: JsonObject; unset?: readonly string[] };

export type PreparedChangeSet = {
  id: string;
  fingerprint: string;
  tenantId: string;
  principalSubject: string;
  requestId: string;
  changes: readonly CanonicalRecordChange[];
  preparedAt: string;
  expiresAt: string;
  requiresApproval: true;
};

export type ProposalApproval = {
  proposalId: string;
  proposalFingerprint: string;
  tenantId: string;
  approvedBy: string;
  decision: "approved";
  approvedAt: string;
};

export type CommitResult = {
  proposalId: string;
  tenantId: string;
  committedAt: string;
  records: readonly CanonicalRecord[];
};

export type CanonicalAuditEvent = {
  id: string;
  tenantId: string;
  principalSubject: string;
  action: "proposal.prepared" | "proposal.committed";
  requestId: string;
  proposalId: string;
  occurredAt: string;
  recordRefs: readonly { kind: string; id: string; version?: number }[];
};

export type RecordAuthorization = (
  principal: AuthenticatedPrincipal,
  operation: "read" | "propose" | "commit",
  record: { tenantId: string; id: string; kind: string },
) => boolean;

export interface CanonicalRecordGateway {
  get(principal: AuthenticatedPrincipal, ref: { tenantId: string; id: string; kind: string }): CanonicalRecord | undefined;
  list(principal: AuthenticatedPrincipal, query: { tenantId: string; kind?: string; ids?: readonly string[]; limit?: number }): CanonicalRecord[];
  prepare(
    principal: AuthenticatedPrincipal,
    input: { tenantId: string; requestId: string; changes: readonly CanonicalRecordChange[] },
  ): PreparedChangeSet;
  commit(principal: AuthenticatedPrincipal, approval: ProposalApproval): CommitResult;
  listAudit(principal: AuthenticatedPrincipal, tenantId: string): CanonicalAuditEvent[];
}

type GatewayOptions = {
  clock?: () => Date;
  proposalTtlMs?: number;
  maxChanges?: number;
  authorizeRecord?: RecordAuthorization;
};

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;
const FIELD_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,99}$/;
const FORBIDDEN_FIELDS = new Set(["__proto__", "prototype", "constructor"]);

function assertName(value: string, label: string) {
  if (!ID_PATTERN.test(value)) throw new Error(`${label} is invalid.`);
}

function assertIsoDate(value: string, label: string) {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${label} is invalid.`);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function assertJsonValue(value: unknown, path: string, depth = 0): asserts value is JsonValue {
  if (depth > 8) throw new Error(`${path} is nested too deeply.`);
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${path} must contain finite numbers.`);
    return;
  }
  if (typeof value === "string") {
    if (value.length > 50_000) throw new Error(`${path} contains an oversized string.`);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 1_000) throw new Error(`${path} contains too many items.`);
    value.forEach((entry, index) => assertJsonValue(entry, `${path}[${index}]`, depth + 1));
    return;
  }
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`${path} must contain plain JSON values.`);
  }
  const entries = Object.entries(value);
  if (entries.length > 250) throw new Error(`${path} contains too many fields.`);
  for (const [key, entry] of entries) {
    if (!FIELD_PATTERN.test(key) || FORBIDDEN_FIELDS.has(key)) throw new Error(`${path} contains an unsafe field.`);
    assertJsonValue(entry, `${path}.${key}`, depth + 1);
  }
}

function normalizeData(value: JsonObject, label: string) {
  assertJsonValue(value, label);
  if (Array.isArray(value) || value === null) throw new Error(`${label} must be an object.`);
  const copy = clone(value);
  if (JSON.stringify(copy).length > 256_000) throw new Error(`${label} exceeds the record size limit.`);
  return copy;
}

function normalizeChange(change: CanonicalRecordChange): CanonicalRecordChange {
  if (!change || typeof change !== "object") throw new Error("A record change is invalid.");
  assertName(change.id, "Record ID");
  assertName(change.kind, "Record kind");
  const data = normalizeData(change.data, "Record data");
  if (change.operation === "create") return { operation: "create", id: change.id, kind: change.kind, data };
  if (change.operation !== "patch") throw new Error("Record changes may only create or patch records.");
  if (!Number.isSafeInteger(change.expectedVersion) || change.expectedVersion < 1) throw new Error("A patch requires a positive expected version.");
  const unset = change.unset === undefined ? undefined : [...new Set(change.unset)];
  if (unset?.some((field) => typeof field !== "string" || !FIELD_PATTERN.test(field) || FORBIDDEN_FIELDS.has(field))) {
    throw new Error("A patch contains an invalid field removal.");
  }
  if (unset?.some((field) => Object.hasOwn(data, field))) throw new Error("A patch cannot set and remove the same field.");
  return { operation: "patch", id: change.id, kind: change.kind, expectedVersion: change.expectedVersion, data, ...(unset?.length ? { unset } : {}) };
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(input: unknown) {
  return `sha256:${createHash("sha256").update(canonicalize(input)).digest("hex")}`;
}

function recordKey(tenantId: string, kind: string, id: string) {
  return `${tenantId}\u0000${kind}\u0000${id}`;
}

function requestKey(principal: AuthenticatedPrincipal, requestId: string) {
  return `${principal.tenantId}\u0000${principal.subject}\u0000${requestId}`;
}

export class InMemoryCanonicalRecordGateway implements CanonicalRecordGateway {
  private readonly records = new Map<string, CanonicalRecord>();
  private readonly proposals = new Map<string, PreparedChangeSet>();
  private readonly proposalByRequest = new Map<string, { proposalId: string; fingerprint: string }>();
  private readonly committed = new Map<string, CommitResult>();
  private readonly audit: CanonicalAuditEvent[] = [];
  private proposalCounter = 0;
  private auditCounter = 0;
  private readonly clock: () => Date;
  private readonly ttl: number;
  private readonly maxChanges: number;
  private readonly authorize: RecordAuthorization;

  constructor(initial: readonly CanonicalRecord[] = [], options: GatewayOptions = {}) {
    this.clock = options.clock ?? (() => new Date());
    this.ttl = options.proposalTtlMs ?? 15 * 60_000;
    this.maxChanges = options.maxChanges ?? 50;
    this.authorize = options.authorizeRecord ?? ((principal, _operation, record) => principalCanAccessRecord(principal, record));
    for (const raw of initial) {
      assertName(raw.tenantId, "Record tenant");
      assertName(raw.id, "Record ID");
      assertName(raw.kind, "Record kind");
      if (!Number.isSafeInteger(raw.version) || raw.version < 1) throw new Error("Record version is invalid.");
      assertIsoDate(raw.createdAt, "Record creation time");
      assertIsoDate(raw.updatedAt, "Record update time");
      const record = { ...clone(raw), data: normalizeData(raw.data, "Record data") };
      const key = recordKey(record.tenantId, record.kind, record.id);
      if (this.records.has(key)) throw new Error("Initial records contain a duplicate canonical key.");
      this.records.set(key, record);
    }
  }

  private allowed(principal: AuthenticatedPrincipal, operation: "read" | "propose" | "commit", ref: { tenantId: string; id: string; kind: string }) {
    assertTenantAccess(principal, ref.tenantId);
    if (!this.authorize(principal, operation, ref)) throw new Error("Record access is not allowed.");
  }

  get(principal: AuthenticatedPrincipal, ref: { tenantId: string; id: string; kind: string }) {
    requirePermission(principal, "records.read");
    this.allowed(principal, "read", ref);
    const record = this.records.get(recordKey(ref.tenantId, ref.kind, ref.id));
    return record ? clone(record) : undefined;
  }

  list(principal: AuthenticatedPrincipal, query: { tenantId: string; kind?: string; ids?: readonly string[]; limit?: number }) {
    requirePermission(principal, "records.read");
    assertTenantAccess(principal, query.tenantId);
    if (query.kind !== undefined) assertName(query.kind, "Record kind");
    if (query.ids && query.ids.length > 500) throw new Error("The record query contains too many IDs.");
    const ids = query.ids ? new Set(query.ids) : undefined;
    const limit = query.limit ?? 100;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new Error("The record query limit is invalid.");
    const result: CanonicalRecord[] = [];
    for (const record of this.records.values()) {
      if (record.tenantId !== query.tenantId || (query.kind && record.kind !== query.kind) || (ids && !ids.has(record.id))) continue;
      if (!this.authorize(principal, "read", record)) continue;
      result.push(clone(record));
      if (result.length === limit) break;
    }
    return result;
  }

  prepare(principal: AuthenticatedPrincipal, input: { tenantId: string; requestId: string; changes: readonly CanonicalRecordChange[] }) {
    requirePermission(principal, "records.propose");
    assertTenantAccess(principal, input.tenantId);
    assertName(input.requestId, "Request ID");
    if (!Array.isArray(input.changes) || input.changes.length < 1 || input.changes.length > this.maxChanges) {
      throw new Error(`A proposal must contain between 1 and ${this.maxChanges} changes.`);
    }
    const changes = input.changes.map(normalizeChange);
    const refs = new Set<string>();
    for (const change of changes) {
      const key = recordKey(input.tenantId, change.kind, change.id);
      if (refs.has(key)) throw new Error("A proposal may change a canonical record only once.");
      refs.add(key);
      this.allowed(principal, "propose", { tenantId: input.tenantId, id: change.id, kind: change.kind });
      const current = this.records.get(key);
      if (change.operation === "create" && current) throw new Error("The canonical record already exists.");
      if (change.operation === "patch" && !current) throw new Error("The canonical record does not exist.");
      if (change.operation === "patch" && current?.version !== change.expectedVersion) throw new Error("The canonical record version has changed.");
    }
    const proposalFingerprint = fingerprint({ tenantId: input.tenantId, principalSubject: principal.subject, changes });
    const existing = this.proposalByRequest.get(requestKey(principal, input.requestId));
    if (existing) {
      if (existing.fingerprint !== proposalFingerprint) throw new Error("The request ID was already used for different changes.");
      const proposal = this.proposals.get(existing.proposalId);
      if (!proposal) throw new Error("The prior proposal is no longer available.");
      return clone(proposal);
    }
    const preparedAt = this.clock().toISOString();
    const proposal: PreparedChangeSet = {
      id: `proposal-${++this.proposalCounter}-${randomUUID()}`,
      fingerprint: proposalFingerprint,
      tenantId: input.tenantId,
      principalSubject: principal.subject,
      requestId: input.requestId,
      changes,
      preparedAt,
      expiresAt: new Date(Date.parse(preparedAt) + this.ttl).toISOString(),
      requiresApproval: true,
    };
    this.proposals.set(proposal.id, clone(proposal));
    this.proposalByRequest.set(requestKey(principal, input.requestId), { proposalId: proposal.id, fingerprint: proposalFingerprint });
    this.audit.push({
      id: `audit-${++this.auditCounter}-${randomUUID()}`,
      tenantId: input.tenantId,
      principalSubject: principal.subject,
      action: "proposal.prepared",
      requestId: input.requestId,
      proposalId: proposal.id,
      occurredAt: preparedAt,
      recordRefs: changes.map((change) => ({ kind: change.kind, id: change.id, ...(change.operation === "patch" ? { version: change.expectedVersion } : {}) })),
    });
    return clone(proposal);
  }

  commit(principal: AuthenticatedPrincipal, approval: ProposalApproval) {
    requirePermission(principal, "records.commit");
    const proposal = this.proposals.get(approval.proposalId);
    if (!proposal) throw new Error("The proposal does not exist.");
    assertTenantAccess(principal, proposal.tenantId);
    if (proposal.principalSubject !== principal.subject || approval.approvedBy !== principal.subject) {
      throw new Error("The approval is not bound to this principal.");
    }
    if (approval.tenantId !== proposal.tenantId) throw new Error("The approval tenant does not match the proposal.");
    if (approval.decision !== "approved" || approval.proposalFingerprint !== proposal.fingerprint) {
      throw new Error("The approval does not match the prepared proposal.");
    }
    assertIsoDate(approval.approvedAt, "Approval time");
    const prior = this.committed.get(proposal.id);
    if (prior) return clone(prior);
    const committedAt = this.clock().toISOString();
    if (Date.parse(proposal.expiresAt) <= Date.parse(committedAt)) throw new Error("The proposal has expired.");
    if (Date.parse(approval.approvedAt) < Date.parse(proposal.preparedAt) || Date.parse(approval.approvedAt) > Date.parse(committedAt) + 60_000) {
      throw new Error("The approval time is outside the proposal window.");
    }

    // Validate the complete set against current state before mutating anything.
    const staged = new Map<string, CanonicalRecord>();
    for (const change of proposal.changes) {
      this.allowed(principal, "commit", { tenantId: proposal.tenantId, id: change.id, kind: change.kind });
      const key = recordKey(proposal.tenantId, change.kind, change.id);
      const current = this.records.get(key);
      if (change.operation === "create") {
        if (current) throw new Error("The canonical record already exists; no changes were committed.");
        staged.set(key, {
          tenantId: proposal.tenantId,
          id: change.id,
          kind: change.kind,
          version: 1,
          data: clone(change.data),
          createdAt: committedAt,
          updatedAt: committedAt,
        });
        continue;
      }
      if (!current || current.version !== change.expectedVersion) {
        throw new Error("The canonical record version has changed; no changes were committed.");
      }
      const data = { ...clone(current.data), ...clone(change.data) };
      for (const field of change.unset ?? []) delete data[field];
      staged.set(key, { ...clone(current), version: current.version + 1, data, updatedAt: committedAt });
    }
    for (const [key, record] of staged) this.records.set(key, record);
    const result: CommitResult = {
      proposalId: proposal.id,
      tenantId: proposal.tenantId,
      committedAt,
      records: [...staged.values()].map(clone),
    };
    this.committed.set(proposal.id, clone(result));
    this.audit.push({
      id: `audit-${++this.auditCounter}-${randomUUID()}`,
      tenantId: proposal.tenantId,
      principalSubject: principal.subject,
      action: "proposal.committed",
      requestId: proposal.requestId,
      proposalId: proposal.id,
      occurredAt: committedAt,
      recordRefs: result.records.map((record) => ({ kind: record.kind, id: record.id, version: record.version })),
    });
    return clone(result);
  }

  listAudit(principal: AuthenticatedPrincipal, tenantId: string) {
    requirePermission(principal, "audit.read");
    assertTenantAccess(principal, tenantId);
    return this.audit.filter((event) => event.tenantId === tenantId).map(clone);
  }
}
