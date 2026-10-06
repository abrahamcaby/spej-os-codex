import { runGtmAgentTurn } from "@/lib/gtm-agent-contract";
import type { AgentWorkspaceProposal } from "@/lib/types";
import { getDatabase } from "@/lib/server/database";
import { parseAiJson, runConfiguredAi } from "@/lib/server/ai";
import { readSettings } from "@/lib/server/settings";
import { readWorkspaceState } from "@/lib/workspace-store";

export const runtime = "nodejs";

/** Standalone pilot adapter. Spej OS can substitute its existing SOSA transport; the GTM contract stays the same. */
export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.includes("application/json"))
      return Response.json({ error: "Send the agent request as JSON." }, { status: 415 });
    const raw = await request.text();
    if (raw.length > 30_000) return Response.json({ error: "The agent request is too large." }, { status: 413 });
    const body = JSON.parse(raw) as { command?: unknown; history?: unknown };
    const workspace = readWorkspaceState(getDatabase());
    const settings = await readSettings();
    let modelDetails: Pick<AgentWorkspaceProposal, "provider" | "model"> = {};
    const proposal = await runGtmAgentTurn({ workspace, command: body.command, history: body.history }, async ({ prompt }) => {
      const result = await runConfiguredAi(settings, { prompt, maxOutputTokens: 4_000 });
      modelDetails = { provider: result.provider, model: result.model };
      return parseAiJson(result.text);
    });
    return Response.json({ ...proposal, ...modelDetails }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SOSA could not prepare that request.";
    const needsSetup = /AI curation is off|no API key|no matching loaded text model/i.test(message);
    return Response.json(
      { error: needsSetup ? "Connect a model in Settings to use the standalone pilot. Spej OS integration can reuse the existing SOSA instead." : message, needsSetup },
      { status: needsSetup ? 409 : 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
