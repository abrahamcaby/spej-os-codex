import type { WorkspaceState } from "@/lib/types";
import { getDatabase } from "@/lib/server/database";
import { hasWorkspaceState, readWorkspaceState, writeWorkspaceState } from "@/lib/workspace-store";
import { legacyBrowserImportAllowed } from "@/lib/server/settings";
import { normalizeWorkspace } from "@/lib/workspace-normalization";

export const runtime = "nodejs";

export async function GET() {
  try {
    const database = getDatabase();
    return Response.json({
      ...readWorkspaceState(database),
      initialized: hasWorkspaceState(database),
      legacyBrowserImportAllowed: legacyBrowserImportAllowed(),
      syntheticDemo: process.env.SPEJ_EXECUTIVE_DEMO === "1",
    });
  } catch {
    return Response.json(
      { error: "Tasks and reminders could not be read safely. Restore the local database from a backup before making changes." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as Partial<WorkspaceState>;
    const state = normalizeWorkspace(body);
    return Response.json(writeWorkspaceState(getDatabase(), state));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not save the local workspace." }, { status: 400 });
  }
}
