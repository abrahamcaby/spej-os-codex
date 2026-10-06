export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export const INTEGRATION_CONTRACT_LIMITS = {
  id: 256,
  kind: 80,
  provider: 48,
  sourceUrl: 2_048,
  payloadBytes: 32_768,
  payloadDepth: 6,
  payloadArrayItems: 100,
  payloadObjectKeys: 50,
  payloadString: 8_000,
  payloadNodes: 500,
} as const;

export class IntegrationContractError extends Error {
  readonly code: string;
  readonly path: string;

  constructor(code: string, path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "IntegrationContractError";
    this.code = code;
    this.path = path;
  }
}

export interface ConnectorEventEnvelope<TPayload extends JsonObject = JsonObject> {
  schemaVersion: 1;
  provider: string;
  tenantId: string;
  kind: string;
  externalId: string;
  externalVersion: string;
  occurredAt: string;
  receivedAt: string;
  idempotencyKey: string;
  sourceUrl?: string;
  payload: TPayload;
}

export type NewConnectorEvent<TPayload extends JsonObject = JsonObject> = Omit<
  ConnectorEventEnvelope<TPayload>,
  "schemaVersion" | "idempotencyKey" | "payload"
> & { payload: unknown };

const ENVELOPE_KEYS = new Set([
  "schemaVersion",
  "provider",
  "tenantId",
  "kind",
  "externalId",
  "externalVersion",
  "occurredAt",
  "receivedAt",
  "idempotencyKey",
  "sourceUrl",
  "payload",
]);

const CREDENTIAL_KEYS = new Set([
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "oauthtoken",
  "bearertoken",
  "apikey",
  "clientsecret",
  "appsecret",
  "password",
  "passwd",
  "privatekey",
  "authorization",
  "authorizationheader",
  "auth",
  "authkey",
  "jwt",
  "cookie",
  "cookieheader",
  "setcookie",
  "credential",
  "credentials",
  "secret",
  "sessiontoken",
  "token",
  "clientstate",
]);

function normalizedKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isCredentialKey(key: string): boolean {
  const normalized = normalizedKey(key);
  return CREDENTIAL_KEYS.has(normalized)
    || normalized.endsWith("accesstoken")
    || normalized.endsWith("refreshtoken")
    || normalized.endsWith("bearertoken")
    || normalized.endsWith("token")
    || normalized.endsWith("clientsecret")
    || normalized.endsWith("secret")
    || normalized.endsWith("apikey")
    || normalized.endsWith("privatekey")
    || normalized.startsWith("authorization")
    || normalized.endsWith("password");
}

export function expectObject(value: unknown, path = "value"): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new IntegrationContractError("invalid_type", path, "must be an object");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new IntegrationContractError("invalid_type", path, "must be a plain object");
  }
  return value as Record<string, unknown>;
}

export function assertNoCredentialFields(value: unknown, path = "value", ancestors = new WeakSet<object>()): void {
  if (typeof value !== "object" || value === null) return;
  if (ancestors.has(value)) {
    throw new IntegrationContractError("cyclic_value", path, "must not contain a cyclic reference");
  }

  ancestors.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoCredentialFields(item, `${path}[${index}]`, ancestors));
  } else {
    for (const [key, nested] of Object.entries(value)) {
      if (isCredentialKey(key)) {
        throw new IntegrationContractError("credential_field", `${path}.${key}`, "credential-like fields are not accepted");
      }
      assertNoCredentialFields(nested, `${path}.${key}`, ancestors);
    }
  }
  ancestors.delete(value);
}

export function assertOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>, path = "value"): void {
  assertNoCredentialFields(value, path);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new IntegrationContractError("unknown_field", `${path}.${key}`, "is not an accepted field");
    }
  }
}

export function cleanBoundedString(
  value: unknown,
  path: string,
  options: { min?: number; max: number; pattern?: RegExp } = { max: 1_000 },
): string {
  if (typeof value !== "string") {
    throw new IntegrationContractError("invalid_type", path, "must be a string");
  }
  const cleaned = value.trim();
  const min = options.min ?? 1;
  if (cleaned.length < min || cleaned.length > options.max) {
    throw new IntegrationContractError("invalid_length", path, `must be between ${min} and ${options.max} characters`);
  }
  if (options.pattern && !options.pattern.test(cleaned)) {
    throw new IntegrationContractError("invalid_format", path, "has an invalid format");
  }
  return cleaned;
}

export function cleanOptionalString(
  value: unknown,
  path: string,
  max: number,
): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return cleanBoundedString(value, path, { max });
}

const ISO_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/;

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function cleanIsoDateTime(value: unknown, path: string): string {
  const input = cleanBoundedString(value, path, { max: 40 });
  const match = ISO_DATE_TIME.exec(input);
  if (!match) {
    throw new IntegrationContractError("invalid_datetime", path, "must be an ISO 8601 date-time with a timezone");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[8] === "Z" ? 0 : Number(match[10]);
  const offsetMinute = match[8] === "Z" ? 0 : Number(match[11]);
  const validCalendarTime = month >= 1
    && month <= 12
    && day >= 1
    && day <= daysInMonth(year, month)
    && hour <= 23
    && minute <= 59
    && second <= 59
    && offsetHour <= 14
    && offsetMinute <= 59
    && (offsetHour < 14 || offsetMinute === 0);
  const timestamp = Date.parse(input);
  if (!validCalendarTime || !Number.isFinite(timestamp)) {
    throw new IntegrationContractError("invalid_datetime", path, "must be a real ISO 8601 date-time");
  }
  return new Date(timestamp).toISOString();
}

export function cleanHttpUrl(value: unknown, path: string): string {
  const input = cleanBoundedString(value, path, { max: INTEGRATION_CONTRACT_LIMITS.sourceUrl });
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new IntegrationContractError("invalid_url", path, "must be a valid absolute URL");
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) {
    throw new IntegrationContractError("invalid_url", path, "must be an http(s) URL without embedded credentials");
  }
  for (const key of url.searchParams.keys()) {
    if (isCredentialKey(key)) {
      throw new IntegrationContractError("invalid_url", path, "must not contain credential-like query parameters");
    }
  }
  return url.toString();
}

export function cleanOptionalHttpUrl(value: unknown, path: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return cleanHttpUrl(value, path);
}

export function compactExcerpt(value: string, max: number): string {
  const compacted = value.replace(/\s+/g, " ").trim();
  if (compacted.length <= max) return compacted;
  return `${compacted.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

interface PayloadState {
  nodes: number;
  ancestors: WeakSet<object>;
}

function cleanJsonValue(value: unknown, path: string, depth: number, state: PayloadState): JsonValue {
  state.nodes += 1;
  if (state.nodes > INTEGRATION_CONTRACT_LIMITS.payloadNodes) {
    throw new IntegrationContractError("payload_too_large", path, "contains too many values");
  }
  if (depth > INTEGRATION_CONTRACT_LIMITS.payloadDepth) {
    throw new IntegrationContractError("payload_too_deep", path, "is nested too deeply");
  }
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new IntegrationContractError("invalid_number", path, "must be a finite number");
    }
    return value;
  }
  if (typeof value === "string") {
    if (value.length > INTEGRATION_CONTRACT_LIMITS.payloadString) {
      throw new IntegrationContractError("payload_string_too_long", path, `must not exceed ${INTEGRATION_CONTRACT_LIMITS.payloadString} characters`);
    }
    return value;
  }
  if (typeof value !== "object" || value === undefined) {
    throw new IntegrationContractError("invalid_json", path, "must contain JSON-compatible values only");
  }
  if (state.ancestors.has(value)) {
    throw new IntegrationContractError("cyclic_value", path, "must not contain a cyclic reference");
  }

  state.ancestors.add(value);
  if (Array.isArray(value)) {
    if (value.length > INTEGRATION_CONTRACT_LIMITS.payloadArrayItems) {
      throw new IntegrationContractError("payload_array_too_long", path, `must not exceed ${INTEGRATION_CONTRACT_LIMITS.payloadArrayItems} items`);
    }
    const result = value.map((item, index) => cleanJsonValue(item, `${path}[${index}]`, depth + 1, state));
    state.ancestors.delete(value);
    return result;
  }

  const record = value as Record<string, unknown>;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new IntegrationContractError("invalid_json", path, "must contain plain JSON objects only");
  }
  const entries = Object.entries(record);
  if (entries.length > INTEGRATION_CONTRACT_LIMITS.payloadObjectKeys) {
    throw new IntegrationContractError("payload_object_too_large", path, `must not exceed ${INTEGRATION_CONTRACT_LIMITS.payloadObjectKeys} fields`);
  }
  const result: JsonObject = {};
  for (const [key, nested] of entries) {
    if (!key || key.length > 80 || key === "__proto__" || key === "prototype" || key === "constructor") {
      throw new IntegrationContractError("invalid_key", `${path}.${key}`, "field names must be between 1 and 80 characters");
    }
    if (isCredentialKey(key)) {
      throw new IntegrationContractError("credential_field", `${path}.${key}`, "credential-like fields are not accepted");
    }
    result[key] = cleanJsonValue(nested, `${path}.${key}`, depth + 1, state);
  }
  state.ancestors.delete(value);
  return result;
}

export function cleanMinimizedPayload(value: unknown, path = "payload"): JsonObject {
  assertNoCredentialFields(value, path);
  const input = expectObject(value, path);
  const cleaned = cleanJsonValue(input, path, 0, { nodes: 0, ancestors: new WeakSet() });
  const payload = cleaned as JsonObject;
  const bytes = new TextEncoder().encode(JSON.stringify(payload)).byteLength;
  if (bytes > INTEGRATION_CONTRACT_LIMITS.payloadBytes) {
    throw new IntegrationContractError("payload_too_large", path, `must not exceed ${INTEGRATION_CONTRACT_LIMITS.payloadBytes} bytes`);
  }
  return payload;
}

function cleanProvider(value: unknown): string {
  return cleanBoundedString(value, "provider", {
    max: INTEGRATION_CONTRACT_LIMITS.provider,
    pattern: /^[a-z][a-z0-9-]*$/,
  });
}

function cleanKind(value: unknown): string {
  return cleanBoundedString(value, "kind", {
    max: INTEGRATION_CONTRACT_LIMITS.kind,
    pattern: /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/,
  });
}

function cleanIdentifier(value: unknown, path: string): string {
  return cleanBoundedString(value, path, { max: INTEGRATION_CONTRACT_LIMITS.id });
}

export function integrationIdempotencyKey(identity: {
  provider: string;
  tenantId: string;
  kind: string;
  externalId: string;
  externalVersion: string;
}): string {
  const segments = [
    cleanProvider(identity.provider),
    cleanIdentifier(identity.tenantId, "tenantId"),
    cleanKind(identity.kind),
    cleanIdentifier(identity.externalId, "externalId"),
    cleanIdentifier(identity.externalVersion, "externalVersion"),
  ];
  return `integration:v1:${segments.map((segment) => encodeURIComponent(segment)).join("|")}`;
}

export function createConnectorEventEnvelope<TPayload extends JsonObject = JsonObject>(
  input: NewConnectorEvent<TPayload>,
): ConnectorEventEnvelope<TPayload> {
  const provider = cleanProvider(input.provider);
  const tenantId = cleanIdentifier(input.tenantId, "tenantId");
  const kind = cleanKind(input.kind);
  const externalId = cleanIdentifier(input.externalId, "externalId");
  const externalVersion = cleanIdentifier(input.externalVersion, "externalVersion");
  const occurredAt = cleanIsoDateTime(input.occurredAt, "occurredAt");
  const receivedAt = cleanIsoDateTime(input.receivedAt, "receivedAt");
  const sourceUrl = cleanOptionalHttpUrl(input.sourceUrl, "sourceUrl");
  const payload = cleanMinimizedPayload(input.payload) as TPayload;
  const idempotencyKey = integrationIdempotencyKey({ provider, tenantId, kind, externalId, externalVersion });
  return {
    schemaVersion: 1,
    provider,
    tenantId,
    kind,
    externalId,
    externalVersion,
    occurredAt,
    receivedAt,
    idempotencyKey,
    ...(sourceUrl ? { sourceUrl } : {}),
    payload,
  };
}

export function cleanConnectorEventEnvelope(value: unknown): ConnectorEventEnvelope {
  const input = expectObject(value, "event");
  assertOnlyKeys(input, ENVELOPE_KEYS, "event");
  if (input.schemaVersion !== 1) {
    throw new IntegrationContractError("unsupported_version", "event.schemaVersion", "must equal 1");
  }
  const cleaned = createConnectorEventEnvelope({
    provider: input.provider as string,
    tenantId: input.tenantId as string,
    kind: input.kind as string,
    externalId: input.externalId as string,
    externalVersion: input.externalVersion as string,
    occurredAt: input.occurredAt as string,
    receivedAt: input.receivedAt as string,
    sourceUrl: input.sourceUrl as string | undefined,
    payload: input.payload,
  });
  const suppliedKey = cleanBoundedString(input.idempotencyKey, "event.idempotencyKey", { max: 1_500 });
  if (suppliedKey !== cleaned.idempotencyKey) {
    throw new IntegrationContractError("invalid_idempotency_key", "event.idempotencyKey", "does not match the event identity");
  }
  return cleaned;
}
