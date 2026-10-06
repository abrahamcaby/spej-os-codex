import {
  cleanConnectorEventEnvelope,
  type ConnectorEventEnvelope,
  type JsonObject,
} from "../integrations/contracts";
import {
  assertTenantAccess,
  hasPermission,
  requirePermission,
  type AuthenticatedPrincipal,
} from "./auth/principal";

export type IntegrationEventInput<TPayload extends JsonObject = JsonObject> = ConnectorEventEnvelope<TPayload> & {
  stream: string;
  /** Adapter-normalized ordering that is monotonic within this stream. */
  sourceSequence?: number;
  cursor?: string;
};

export type IntegrationEventStatus = "queued" | "processing" | "failed" | "completed" | "dead-letter";

export type IntegrationEventRecord<TPayload extends JsonObject = JsonObject> = IntegrationEventInput<TPayload> & {
  id: string;
  status: IntegrationEventStatus;
  attempts: number;
  enqueuedAt: string;
  updatedAt: string;
  nextAttemptAt?: string;
  completedAt?: string;
  lastError?: string;
  claim?: { token: string; workerId: string; expiresAt: string };
};

export type IntegrationCursor = {
  provider: string;
  tenantId: string;
  stream: string;
  value: string;
  sourceSequence?: number;
  advancedAt: string;
};

export type EnqueueResult<TPayload extends JsonObject = JsonObject> =
  | { accepted: true; event: IntegrationEventRecord<TPayload> }
  | { accepted: false; reason: "duplicate" | "stale"; event?: IntegrationEventRecord<TPayload> };

export interface IntegrationEventStore {
  enqueue<TPayload extends JsonObject>(principal: AuthenticatedPrincipal, event: IntegrationEventInput<TPayload>): EnqueueResult<TPayload>;
  claimNext<TPayload extends JsonObject = JsonObject>(principal: AuthenticatedPrincipal, input: { tenantId: string; workerId: string; provider?: string; now?: Date; leaseMs?: number }): IntegrationEventRecord<TPayload> | undefined;
  complete<TPayload extends JsonObject = JsonObject>(principal: AuthenticatedPrincipal, input: { tenantId: string; eventId: string; claimToken: string; now?: Date }): IntegrationEventRecord<TPayload>;
  fail<TPayload extends JsonObject = JsonObject>(principal: AuthenticatedPrincipal, input: { tenantId: string; eventId: string; claimToken: string; error: unknown; now?: Date }): IntegrationEventRecord<TPayload>;
  get<TPayload extends JsonObject = JsonObject>(principal: AuthenticatedPrincipal, tenantId: string, eventId: string): IntegrationEventRecord<TPayload> | undefined;
  getCursor(principal: AuthenticatedPrincipal, input: { tenantId: string; provider: string; stream: string }): IntegrationCursor | undefined;
}

type EventStoreOptions = {
  clock?: () => Date;
  maxAttempts?: number;
  baseRetryMs?: number;
  maxRetryMs?: number;
};

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,499}$/;

function assertId(value: string, label: string) {
  if (typeof value !== "string" || !SAFE_ID.test(value)) throw new Error(`${label} is invalid.`);
}

function instant(value: string, label: string) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new Error(`${label} is invalid.`);
  return new Date(value).toISOString();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function eventKey(event: Pick<IntegrationEventInput, "provider" | "tenantId" | "idempotencyKey">) {
  return `${event.provider}\u0000${event.tenantId}\u0000${event.idempotencyKey}`;
}

function sequenceKey(event: Pick<IntegrationEventInput, "provider" | "tenantId" | "stream">) {
  return `${event.provider}\u0000${event.tenantId}\u0000${event.stream}`;
}

function cursorKey(event: Pick<IntegrationEventInput, "provider" | "tenantId" | "stream">) {
  return `${event.provider}\u0000${event.tenantId}\u0000${event.stream}`;
}

function requireIntegrationRead(principal: AuthenticatedPrincipal) {
  if (!hasPermission(principal, "integrations.read") && !hasPermission(principal, "integrations.manage")) {
    throw new Error("Permission denied: integrations.read.");
  }
}

export class InMemoryIntegrationEventStore implements IntegrationEventStore {
  private readonly events = new Map<string, IntegrationEventRecord>();
  private readonly eventIdByKey = new Map<string, string>();
  private readonly highestSequence = new Map<string, number>();
  private readonly cursors = new Map<string, IntegrationCursor & { receivedAt: string }>();
  private readonly clock: () => Date;
  private readonly maxAttempts: number;
  private readonly baseRetryMs: number;
  private readonly maxRetryMs: number;
  private eventCounter = 0;
  private claimCounter = 0;

  constructor(options: EventStoreOptions = {}) {
    this.clock = options.clock ?? (() => new Date());
    this.maxAttempts = options.maxAttempts ?? 5;
    this.baseRetryMs = options.baseRetryMs ?? 1_000;
    this.maxRetryMs = options.maxRetryMs ?? 15 * 60_000;
    if (!Number.isSafeInteger(this.maxAttempts) || this.maxAttempts < 1 || this.maxAttempts > 25) throw new Error("The maximum attempt count is invalid.");
    if (!Number.isSafeInteger(this.baseRetryMs) || this.baseRetryMs < 0 || !Number.isSafeInteger(this.maxRetryMs) || this.maxRetryMs < this.baseRetryMs) throw new Error("The retry timing is invalid.");
  }

  enqueue<TPayload extends JsonObject>(principal: AuthenticatedPrincipal, input: IntegrationEventInput<TPayload>): EnqueueResult<TPayload> {
    requirePermission(principal, "integrations.manage");
    const { stream, sourceSequence, cursor, ...untrustedEnvelope } = input;
    const envelope = cleanConnectorEventEnvelope(untrustedEnvelope) as ConnectorEventEnvelope<TPayload>;
    assertTenantAccess(principal, envelope.tenantId);
    assertId(envelope.provider, "Integration provider");
    assertId(envelope.tenantId, "Integration tenant");
    assertId(stream, "Integration stream");
    assertId(envelope.externalId, "External record ID");
    assertId(envelope.externalVersion, "External record version");
    if (sourceSequence !== undefined && (!Number.isSafeInteger(sourceSequence) || sourceSequence < 0)) throw new Error("The source sequence is invalid.");
    const occurredAt = instant(envelope.occurredAt, "Event occurrence time");
    const receivedAt = instant(envelope.receivedAt, "Event receipt time");
    if (cursor !== undefined && (typeof cursor !== "string" || cursor.length < 1 || cursor.length > 4_000)) throw new Error("The integration cursor is invalid.");
    const normalized: IntegrationEventInput<TPayload> = { ...envelope, stream, ...(sourceSequence !== undefined ? { sourceSequence } : {}), ...(cursor ? { cursor } : {}) };
    const key = eventKey(normalized);
    const duplicateId = this.eventIdByKey.get(key);
    if (duplicateId) return { accepted: false, reason: "duplicate", event: clone(this.events.get(duplicateId) as IntegrationEventRecord<TPayload>) };
    if (sourceSequence !== undefined) {
      const previous = this.highestSequence.get(sequenceKey(normalized));
      if (previous !== undefined && sourceSequence <= previous) return { accepted: false, reason: "stale" };
    }
    const now = this.clock().toISOString();
    const record: IntegrationEventRecord<TPayload> = {
      ...clone(normalized),
      occurredAt,
      receivedAt,
      id: `integration-event-${++this.eventCounter}`,
      status: "queued",
      attempts: 0,
      enqueuedAt: now,
      updatedAt: now,
    };
    this.events.set(record.id, clone(record));
    this.eventIdByKey.set(key, record.id);
    if (sourceSequence !== undefined) this.highestSequence.set(sequenceKey(normalized), sourceSequence);
    return { accepted: true, event: clone(record) };
  }

  private requeueExpiredLeases(now: Date, tenantId: string) {
    for (const [id, event] of this.events) {
      if (event.tenantId !== tenantId || event.status !== "processing" || !event.claim) continue;
      if (Date.parse(event.claim.expiresAt) > now.getTime()) continue;
      const expired: IntegrationEventRecord = {
        ...event,
        status: event.attempts >= this.maxAttempts ? "dead-letter" : "failed",
        updatedAt: now.toISOString(),
        lastError: "Processing lease expired.",
        ...(event.attempts >= this.maxAttempts ? {} : { nextAttemptAt: now.toISOString() }),
      };
      delete expired.claim;
      this.events.set(id, expired);
    }
  }

  claimNext<TPayload extends JsonObject = JsonObject>(principal: AuthenticatedPrincipal, input: { tenantId: string; workerId: string; provider?: string; now?: Date; leaseMs?: number }) {
    requirePermission(principal, "integrations.manage");
    assertTenantAccess(principal, input.tenantId);
    assertId(input.workerId, "Worker ID");
    if (input.provider !== undefined) assertId(input.provider, "Integration provider");
    const now = input.now ?? this.clock();
    const leaseMs = input.leaseMs ?? 30_000;
    if (!Number.isSafeInteger(leaseMs) || leaseMs < 1_000 || leaseMs > 10 * 60_000) throw new Error("The processing lease is invalid.");
    this.requeueExpiredLeases(now, input.tenantId);
    const eligible = [...this.events.values()]
      .filter((event) => event.tenantId === input.tenantId && (!input.provider || event.provider === input.provider))
      .filter((event) => event.status === "queued" || (event.status === "failed" && (!event.nextAttemptAt || Date.parse(event.nextAttemptAt) <= now.getTime())))
      .sort((left, right) => left.enqueuedAt.localeCompare(right.enqueuedAt) || left.id.localeCompare(right.id))[0];
    if (!eligible) return undefined;
    const claimed: IntegrationEventRecord = {
      ...eligible,
      status: "processing",
      attempts: eligible.attempts + 1,
      updatedAt: now.toISOString(),
      claim: {
        token: `claim-${++this.claimCounter}`,
        workerId: input.workerId,
        expiresAt: new Date(now.getTime() + leaseMs).toISOString(),
      },
    };
    delete claimed.nextAttemptAt;
    this.events.set(claimed.id, claimed);
    return clone(claimed) as IntegrationEventRecord<TPayload>;
  }

  private claimedEvent(principal: AuthenticatedPrincipal, tenantId: string, eventId: string, claimToken: string, now: Date) {
    requirePermission(principal, "integrations.manage");
    assertTenantAccess(principal, tenantId);
    const event = this.events.get(eventId);
    if (!event || event.tenantId !== tenantId) throw new Error("The integration event does not exist.");
    if (event.status !== "processing" || !event.claim || event.claim.token !== claimToken) throw new Error("The integration event claim is not valid.");
    if (Date.parse(event.claim.expiresAt) <= now.getTime()) throw new Error("The integration event claim has expired.");
    return event;
  }

  private advanceCursor(event: IntegrationEventRecord, advancedAt: string) {
    if (!event.cursor) return;
    const key = cursorKey(event);
    const prior = this.cursors.get(key);
    const sameStream = [...this.events.values()].filter((candidate) => cursorKey(candidate) === key);
    const candidates = sameStream
      .filter((candidate) => candidate.status === "completed" && candidate.cursor)
      .filter((candidate) => event.sourceSequence !== undefined ? candidate.sourceSequence !== undefined : candidate.sourceSequence === undefined)
      .sort((left, right) => {
        if (left.sourceSequence !== undefined && right.sourceSequence !== undefined) return right.sourceSequence - left.sourceSequence;
        return right.receivedAt.localeCompare(left.receivedAt);
      });
    for (const candidate of candidates) {
      if (candidate.sourceSequence !== undefined) {
        if (prior?.sourceSequence !== undefined && candidate.sourceSequence <= prior.sourceSequence) continue;
        const blocked = sameStream.some((pending) => pending.sourceSequence !== undefined && pending.sourceSequence <= candidate.sourceSequence! && pending.status !== "completed");
        if (blocked) continue;
      } else {
        if (prior?.sourceSequence !== undefined || (prior && Date.parse(candidate.receivedAt) < Date.parse(prior.receivedAt))) continue;
        const blocked = sameStream.some((pending) => pending.sourceSequence === undefined && Date.parse(pending.receivedAt) <= Date.parse(candidate.receivedAt) && pending.status !== "completed");
        if (blocked) continue;
      }
      this.cursors.set(key, {
        provider: candidate.provider,
        tenantId: candidate.tenantId,
        stream: candidate.stream,
        value: candidate.cursor as string,
        ...(candidate.sourceSequence !== undefined ? { sourceSequence: candidate.sourceSequence } : {}),
        advancedAt,
        receivedAt: candidate.receivedAt,
      });
      return;
    }
  }

  complete<TPayload extends JsonObject = JsonObject>(principal: AuthenticatedPrincipal, input: { tenantId: string; eventId: string; claimToken: string; now?: Date }) {
    const nowDate = input.now ?? this.clock();
    const event = this.claimedEvent(principal, input.tenantId, input.eventId, input.claimToken, nowDate);
    const now = nowDate.toISOString();
    const completed: IntegrationEventRecord = { ...event, status: "completed", completedAt: now, updatedAt: now };
    delete completed.claim;
    delete completed.lastError;
    this.events.set(event.id, completed);
    this.advanceCursor(completed, now);
    return clone(completed) as IntegrationEventRecord<TPayload>;
  }

  fail<TPayload extends JsonObject = JsonObject>(principal: AuthenticatedPrincipal, input: { tenantId: string; eventId: string; claimToken: string; error: unknown; now?: Date }) {
    const now = input.now ?? this.clock();
    const event = this.claimedEvent(principal, input.tenantId, input.eventId, input.claimToken, now);
    const deadLetter = event.attempts >= this.maxAttempts;
    const message = input.error instanceof Error ? input.error.message : typeof input.error === "string" ? input.error : "Integration processing failed.";
    const safeMessage = message
      .replace(/[\r\n]+/g, " ")
      .replace(/\b(Bearer)\s+[^\s,;]+/gi, "$1 [redacted]")
      .replace(/\b(token|secret|password|authorization)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
      .slice(0, 500);
    const failed: IntegrationEventRecord = {
      ...event,
      status: deadLetter ? "dead-letter" : "failed",
      updatedAt: now.toISOString(),
      lastError: safeMessage,
      ...(deadLetter ? {} : { nextAttemptAt: new Date(now.getTime() + Math.min(this.maxRetryMs, this.baseRetryMs * 2 ** Math.max(0, event.attempts - 1))).toISOString() }),
    };
    delete failed.claim;
    this.events.set(event.id, failed);
    return clone(failed) as IntegrationEventRecord<TPayload>;
  }

  get<TPayload extends JsonObject = JsonObject>(principal: AuthenticatedPrincipal, tenantId: string, eventId: string) {
    requireIntegrationRead(principal);
    assertTenantAccess(principal, tenantId);
    const event = this.events.get(eventId);
    return event?.tenantId === tenantId ? (clone(event) as IntegrationEventRecord<TPayload>) : undefined;
  }

  getCursor(principal: AuthenticatedPrincipal, input: { tenantId: string; provider: string; stream: string }) {
    requireIntegrationRead(principal);
    assertTenantAccess(principal, input.tenantId);
    const cursor = this.cursors.get(cursorKey(input));
    if (!cursor) return undefined;
    return clone({
      provider: cursor.provider,
      tenantId: cursor.tenantId,
      stream: cursor.stream,
      value: cursor.value,
      ...(cursor.sourceSequence !== undefined ? { sourceSequence: cursor.sourceSequence } : {}),
      advancedAt: cursor.advancedAt,
    });
  }
}
