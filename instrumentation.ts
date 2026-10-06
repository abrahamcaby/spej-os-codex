export const PRODUCTION_RUNTIME_BLOCK_REASON =
  "Spej OS production startup is blocked: the canonical database, company identity, audit, durable queue/worker, and production health adapters are not wired. Use an unset SPEJ_RUNTIME or local-preview only for a non-sensitive local preview.";

export function assertSupportedRuntime(runtime?: string) {
  const normalized = runtime?.trim().toLowerCase();
  if (!normalized || normalized === "local-preview" || normalized === "preview")
    return;
  if (normalized === "production")
    throw new Error(PRODUCTION_RUNTIME_BLOCK_REASON);
  throw new Error(
    "Unsupported SPEJ_RUNTIME. Use local-preview for a non-sensitive local preview; production remains blocked until the required adapters are wired.",
  );
}

export async function register() {
  assertSupportedRuntime(process.env.SPEJ_RUNTIME);
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startLocalCollectorScheduler } = await import("./lib/server/scheduler");
  startLocalCollectorScheduler();
}
