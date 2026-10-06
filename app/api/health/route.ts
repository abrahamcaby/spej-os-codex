import { getDatabase } from "@/lib/server/database";
import packageMetadata from "@/package.json";

export const runtime = "nodejs";

const service = "control-center";
const version = packageMetadata.version;

export async function GET() {
  if (process.env.SPEJ_RUNTIME?.trim().toLowerCase() === "production") {
    return Response.json(
      {
        service,
        status: "blocked",
        version,
        scope: "production",
        productionReady: false,
        reason:
          "Canonical database, company identity, audit, durable queue/worker, and production health adapters are not wired.",
      },
      { status: 503 },
    );
  }
  try {
    getDatabase().prepare("SELECT 1").get();
    return Response.json({
      service,
      status: "ready",
      version,
      scope: "local-preview",
      productionReady: false,
    });
  } catch {
    return Response.json(
      {
        service,
        status: "unhealthy",
        version,
        scope: "local-preview",
        productionReady: false,
      },
      { status: 503 },
    );
  }
}
