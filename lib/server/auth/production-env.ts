export type ProductionEnvironment = {
  runtime: "production";
  database: { configured: true };
  auth: { issuer: string; audience: string; clientId: string };
  audit: { sink: string };
  queue: { configured: true };
  secretsProvider: string;
  dependencies: {
    registryUrl: string;
    canonicalRecords: { serviceId: string };
    knowledge: { serviceId: string };
    ticketsAndQuality: { serviceId: string };
    featureControls: { serviceId: string };
    usageReporting: { serviceId: string };
  };
  microsoft: { enabled: false } | { enabled: true; tenantId: string; clientId: string; credentialMode: "workload_identity" | "client_secret" };
  sosa: { enabled: false } | { enabled: true; serviceUrl: string; audience: string };
  telemetry: { endpoint?: string };
};

const SECRET_KEYS = new Set([
  "DATABASE_URL",
  "SESSION_SECRET",
  "MICROSOFT_CLIENT_SECRET",
  "MICROSOFT_WEBHOOK_CLIENT_STATE",
]);

function required(env: Record<string, string | undefined>, name: string) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required production setting: ${name}.`);
  if (value.includes("\n") || value.includes("\r")) throw new Error(`Invalid production setting: ${name}.`);
  if (/^(change|replace|todo|example)(?:[-_ ].*)?$/i.test(value)) throw new Error(`Placeholder production setting: ${name}.`);
  return value;
}

function enabled(env: Record<string, string | undefined>, name: string) {
  const raw = env[name]?.trim().toLowerCase();
  if (!raw) return false;
  if (raw !== "true" && raw !== "false") throw new Error(`${name} must be true or false.`);
  return raw === "true";
}

function httpsUrl(value: string, name: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }
  if (url.protocol !== "https:") throw new Error(`${name} must use HTTPS in production.`);
  if (url.username || url.password) throw new Error(`${name} must not contain inline credentials.`);
  return url.toString();
}

function assertDatabaseUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use PostgreSQL.");
  }
}

function assertQueueUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("QUEUE_URL must be a valid durable queue URL.");
  }
  if (!["https:", "amqps:", "rediss:", "sb:"].includes(url.protocol)) throw new Error("QUEUE_URL must use an encrypted or managed queue protocol.");
}

/**
 * Fails closed and returns only non-secret configuration. Secret values stay in
 * the deployment secret manager and are intentionally absent from the result.
 */
export function validateProductionEnvironment(env: Record<string, string | undefined>): ProductionEnvironment {
  if (required(env, "SPEJ_RUNTIME") !== "production") throw new Error("SPEJ_RUNTIME must be production.");
  assertDatabaseUrl(required(env, "DATABASE_URL"));
  const issuer = httpsUrl(required(env, "AUTH_ISSUER"), "AUTH_ISSUER");
  const audience = required(env, "AUTH_AUDIENCE");
  const clientId = required(env, "AUTH_CLIENT_ID");
  const sessionSecret = required(env, "SESSION_SECRET");
  if (sessionSecret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters.");
  const auditSink = required(env, "AUDIT_LOG_SINK");
  assertQueueUrl(required(env, "QUEUE_URL"));
  const secretsProvider = required(env, "SECRETS_PROVIDER");
  const registryUrl = httpsUrl(required(env, "SPEJ_SERVICE_REGISTRY_URL"), "SPEJ_SERVICE_REGISTRY_URL");
  const dependencies: ProductionEnvironment["dependencies"] = {
    registryUrl,
    canonicalRecords: { serviceId: required(env, "SPEJ_CANONICAL_SERVICE_ID") },
    knowledge: { serviceId: required(env, "SPEJ_KNOWLEDGE_SERVICE_ID") },
    ticketsAndQuality: { serviceId: required(env, "SPEJ_TICKETS_QUALITY_SERVICE_ID") },
    featureControls: { serviceId: required(env, "SPEJ_FEATURE_CONTROL_SERVICE_ID") },
    usageReporting: { serviceId: required(env, "SPEJ_USAGE_REPORTING_SERVICE_ID") },
  };

  const microsoftEnabled = enabled(env, "MICROSOFT_ENABLED");
  let microsoft: ProductionEnvironment["microsoft"] = { enabled: false };
  if (microsoftEnabled) {
    const tenantId = required(env, "MICROSOFT_TENANT_ID");
    const clientId = required(env, "MICROSOFT_CLIENT_ID");
    const credentialMode = required(env, "MICROSOFT_CREDENTIAL_MODE");
    if (credentialMode !== "workload_identity" && credentialMode !== "client_secret") {
      throw new Error("MICROSOFT_CREDENTIAL_MODE must be workload_identity or client_secret.");
    }
    if (credentialMode === "client_secret") required(env, "MICROSOFT_CLIENT_SECRET");
    const webhookState = required(env, "MICROSOFT_WEBHOOK_CLIENT_STATE");
    if (webhookState.length < 24) throw new Error("MICROSOFT_WEBHOOK_CLIENT_STATE must contain at least 24 characters.");
    microsoft = { enabled: true, tenantId, clientId, credentialMode };
  }

  const sosaEnabled = enabled(env, "SOSA_ENABLED");
  const sosa: ProductionEnvironment["sosa"] = sosaEnabled ? {
    enabled: true,
    serviceUrl: httpsUrl(required(env, "SOSA_SERVICE_URL"), "SOSA_SERVICE_URL"),
    audience: required(env, "SOSA_AUDIENCE"),
  } : { enabled: false };

  const telemetryEndpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  return {
    runtime: "production",
    database: { configured: true },
    auth: { issuer, audience, clientId },
    audit: { sink: auditSink },
    queue: { configured: true },
    secretsProvider,
    dependencies,
    microsoft,
    sosa,
    telemetry: { ...(telemetryEndpoint ? { endpoint: httpsUrl(telemetryEndpoint, "OTEL_EXPORTER_OTLP_ENDPOINT") } : {}) },
  };
}

/** Safe diagnostic projection for startup logs. Values of known secret settings are never returned. */
export function productionEnvironmentDiagnostics(env: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.keys(env)
      .filter((key) => key.startsWith("SPEJ_") || key.startsWith("AUTH_") || key.startsWith("MICROSOFT_") || key.startsWith("SOSA_") || key === "DATABASE_URL" || key === "SESSION_SECRET")
      .sort()
      .map((key) => [key, SECRET_KEYS.has(key) ? (env[key] ? "[configured]" : "[missing]") : env[key] ? "[configured]" : "[missing]"]),
  );
}
