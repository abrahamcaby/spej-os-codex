import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSupportedRuntime,
  PRODUCTION_RUNTIME_BLOCK_REASON,
} from "../instrumentation";
import { productionEnvironmentDiagnostics, validateProductionEnvironment } from "../lib/server/auth/production-env";

const valid = () => ({
  SPEJ_RUNTIME: "production",
  DATABASE_URL: "postgresql://db-user:db-password@db.example.com:5432/spej",
  AUTH_ISSUER: "https://login.example.com/tenant/v2.0",
  AUTH_AUDIENCE: "spej-os",
  AUTH_CLIENT_ID: "client-id",
  SESSION_SECRET: "0123456789abcdefghijklmnopqrstuvwxyz",
  AUDIT_LOG_SINK: "central-audit",
  QUEUE_URL: "https://queue.example.com/spej",
  SECRETS_PROVIDER: "managed-vault",
  SPEJ_SERVICE_REGISTRY_URL: "https://services.example.com",
  SPEJ_CANONICAL_SERVICE_ID: "canonical-records-v1",
  SPEJ_KNOWLEDGE_SERVICE_ID: "knowledge-v1",
  SPEJ_TICKETS_QUALITY_SERVICE_ID: "tickets-quality-v1",
  SPEJ_FEATURE_CONTROL_SERVICE_ID: "feature-controls-v1",
  SPEJ_USAGE_REPORTING_SERVICE_ID: "usage-reporting-v1",
  MICROSOFT_ENABLED: "false",
  SOSA_ENABLED: "false",
});

test("production validation returns configuration state without returning secrets", () => {
  const env = valid();
  const result = validateProductionEnvironment(env);
  assert.equal(result.runtime, "production");
  assert.equal(result.microsoft.enabled, false);
  assert.equal(result.dependencies.registryUrl, "https://services.example.com/");
  assert.equal(result.dependencies.canonicalRecords.serviceId, "canonical-records-v1");
  assert.equal(result.dependencies.knowledge.serviceId, "knowledge-v1");
  assert.equal(result.dependencies.ticketsAndQuality.serviceId, "tickets-quality-v1");
  assert.equal(result.dependencies.featureControls.serviceId, "feature-controls-v1");
  assert.equal(result.dependencies.usageReporting.serviceId, "usage-reporting-v1");
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /db-password/);
  assert.doesNotMatch(serialized, /0123456789abcdefghijklmnopqrstuvwxyz/);
});

test("existing Spej OS production dependencies are explicit and fail closed", () => {
  for (const key of [
    "SPEJ_SERVICE_REGISTRY_URL",
    "SPEJ_CANONICAL_SERVICE_ID",
    "SPEJ_KNOWLEDGE_SERVICE_ID",
    "SPEJ_TICKETS_QUALITY_SERVICE_ID",
    "SPEJ_FEATURE_CONTROL_SERVICE_ID",
    "SPEJ_USAGE_REPORTING_SERVICE_ID",
  ] as const) {
    const env = valid();
    delete env[key];
    assert.throws(() => validateProductionEnvironment(env), new RegExp(key));
  }
  assert.throws(() => validateProductionEnvironment({ ...valid(), SPEJ_SERVICE_REGISTRY_URL: "http://services.example.com" }), /HTTPS/);
  assert.throws(() => validateProductionEnvironment({ ...valid(), SPEJ_SERVICE_REGISTRY_URL: "https://user:password@services.example.com" }), /inline credentials/);
  assert.throws(() => validateProductionEnvironment({ ...valid(), SPEJ_KNOWLEDGE_SERVICE_ID: "replace-with-knowledge-service-id" }), /Placeholder/);
  assert.throws(() => validateProductionEnvironment({ ...valid(), SPEJ_TICKETS_QUALITY_SERVICE_ID: "tickets\nquality" }), /Invalid/);
});

test("required production settings fail closed and error messages do not echo values", () => {
  const env = valid();
  delete (env as Partial<typeof env>).DATABASE_URL;
  assert.throws(() => validateProductionEnvironment(env), (error: Error) => error.message.includes("DATABASE_URL") && !error.message.includes("password"));
  assert.throws(() => validateProductionEnvironment({ ...valid(), SPEJ_RUNTIME: "preview" }), /must be production/);
  assert.throws(() => validateProductionEnvironment({ ...valid(), AUTH_ISSUER: "http:\/\/login.example.com" }), /HTTPS/);
  assert.throws(() => validateProductionEnvironment({ ...valid(), DATABASE_URL: "mysql:\/\/db.example.com\/spej" }), /PostgreSQL/);
});

test("enabling optional Microsoft and SOSA adapters activates their release gates", () => {
  assert.throws(() => validateProductionEnvironment({ ...valid(), MICROSOFT_ENABLED: "true" }), /MICROSOFT_TENANT_ID/);
  const microsoft = validateProductionEnvironment({
    ...valid(),
    MICROSOFT_ENABLED: "true",
    MICROSOFT_TENANT_ID: "tenant-id",
    MICROSOFT_CLIENT_ID: "graph-client",
    MICROSOFT_CREDENTIAL_MODE: "client_secret",
    MICROSOFT_CLIENT_SECRET: "graph-secret",
    MICROSOFT_WEBHOOK_CLIENT_STATE: "0123456789abcdefghijklmn",
  });
  assert.equal(microsoft.microsoft.enabled, true);
  assert.doesNotMatch(JSON.stringify(microsoft), /graph-secret/);
  const workloadIdentity = validateProductionEnvironment({
    ...valid(),
    MICROSOFT_ENABLED: "true",
    MICROSOFT_TENANT_ID: "tenant-id",
    MICROSOFT_CLIENT_ID: "graph-client",
    MICROSOFT_CREDENTIAL_MODE: "workload_identity",
    MICROSOFT_WEBHOOK_CLIENT_STATE: "0123456789abcdefghijklmn",
  });
  assert.equal(workloadIdentity.microsoft.enabled, true);
  if (workloadIdentity.microsoft.enabled) assert.equal(workloadIdentity.microsoft.credentialMode, "workload_identity");
  assert.throws(() => validateProductionEnvironment({ ...valid(), SOSA_ENABLED: "true", SOSA_SERVICE_URL: "http:\/\/sosa.example.com", SOSA_AUDIENCE: "sosa" }), /HTTPS/);
  const sosa = validateProductionEnvironment({ ...valid(), SOSA_ENABLED: "true", SOSA_SERVICE_URL: "https:\/\/sosa.example.com", SOSA_AUDIENCE: "sosa" });
  assert.equal(sosa.sosa.enabled, true);
});

test("environment diagnostics reveal only configured state", () => {
  const env = valid();
  const diagnostics = productionEnvironmentDiagnostics(env);
  assert.equal(diagnostics.DATABASE_URL, "[configured]");
  assert.equal(diagnostics.SESSION_SECRET, "[configured]");
  assert.equal(diagnostics.SPEJ_SERVICE_REGISTRY_URL, "[configured]");
  assert.equal(diagnostics.SPEJ_USAGE_REPORTING_SERVICE_ID, "[configured]");
  const serialized = JSON.stringify(diagnostics);
  assert.doesNotMatch(serialized, /db-password|0123456789abcdefghijklmnopqrstuvwxyz|client-id|services\.example|usage-reporting-v1/);
});

test("durable queue and obvious placeholder values cannot pass a production gate", () => {
  assert.throws(() => validateProductionEnvironment({ ...valid(), QUEUE_URL: "" }), /QUEUE_URL/);
  assert.throws(() => validateProductionEnvironment({ ...valid(), QUEUE_URL: "redis:\/\/queue.example.com" }), /encrypted or managed/);
  assert.throws(() => validateProductionEnvironment({ ...valid(), AUTH_CLIENT_ID: "replace-with-client-id" }), /Placeholder/);
  assert.doesNotThrow(() => assertSupportedRuntime(undefined));
  assert.doesNotThrow(() => assertSupportedRuntime("local-preview"));
  assert.doesNotThrow(() => assertSupportedRuntime("preview"));
  assert.throws(
    () => assertSupportedRuntime("production"),
    (error: Error) =>
      error.message === PRODUCTION_RUNTIME_BLOCK_REASON &&
      /canonical database/.test(error.message) &&
      /company identity/.test(error.message) &&
      /audit/.test(error.message) &&
      /durable queue\/worker/.test(error.message) &&
      /production health/.test(error.message),
  );
  assert.throws(() => assertSupportedRuntime("staging"), /Unsupported SPEJ_RUNTIME/);
});
