import { prepareMeetingTranscriptProposal } from "@/lib/meeting-transcript-agent";
import { cleanMeetingTranscriptInput } from "@/lib/meeting-transcript-agent";
import { getMeetingIntake, markMeetingAppliedIfCurrent, meetingIntakeSummary } from "@/lib/meeting-intake-store";
import { getDatabase } from "@/lib/server/database";
import { workspaceFingerprintSync } from "@/lib/server/workspace-fingerprint";
import { readWorkspaceState, writeWorkspaceStateRows } from "@/lib/workspace-store";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let transactionOpen = false;
  try {
    const { id } = await params;
    const database = getDatabase();
    const intake = getMeetingIntake(database, id);
    if (!intake) return Response.json({ error: "Meeting intake not found." }, { status: 404 });
    if (intake.status === "applied") return Response.json({ intake: meetingIntakeSummary(intake), workspace: readWorkspaceState(database), idempotent: true }, { headers: { "Cache-Control": "no-store" } });
    if (intake.status === "discarded") return Response.json({ error: "This meeting proposal was discarded." }, { status: 409 });
    if (!intake.modelEnvelope || !intake.proposal?.actions.length) return Response.json({ error: "This meeting does not have an approved change set to apply." }, { status: 409 });
    const workspace = readWorkspaceState(database);
    const currentVersion = workspaceFingerprintSync(workspace);
    if (!intake.baseWorkspaceVersion || currentVersion !== intake.baseWorkspaceVersion) return Response.json({ error: "The workspace changed since this meeting review was prepared. Process the meeting again against the latest records." }, { status: 409 });
    const input = cleanMeetingTranscriptInput({ title: intake.title, meetingDate: intake.meetingDate, sourceKind: intake.sourceKind, bodyText: intake.bodyText, context: intake.context });
    const proposal = await prepareMeetingTranscriptProposal(workspace, intake.modelEnvelope, input, intake.id);
    if (!proposal.nextWorkspace || !proposal.actions.length) return Response.json({ error: "No valid meeting changes are available to apply." }, { status: 409 });
    const now = new Date().toISOString();
    database.exec("BEGIN IMMEDIATE");
    transactionOpen = true;
    try {
      const lockedIntake = getMeetingIntake(database, id);
      if (!lockedIntake) throw new Error("Meeting intake not found.");
      if (lockedIntake.status === "applied") {
        const savedWorkspace = readWorkspaceState(database);
        database.exec("COMMIT");
        transactionOpen = false;
        return Response.json({ intake: meetingIntakeSummary(lockedIntake), workspace: savedWorkspace, idempotent: true }, { headers: { "Cache-Control": "no-store" } });
      }
      if (lockedIntake.status !== "proposed" || lockedIntake.updatedAt !== intake.updatedAt) throw new Error(lockedIntake.status === "discarded" ? "This meeting proposal was discarded." : "This meeting proposal changed. Refresh before applying it.");
      const lockedWorkspace = readWorkspaceState(database);
      if (!lockedIntake.baseWorkspaceVersion || workspaceFingerprintSync(lockedWorkspace) !== lockedIntake.baseWorkspaceVersion) throw new Error("The workspace changed since this meeting review was prepared. Process the meeting again against the latest records.");
      const savedWorkspace = writeWorkspaceStateRows(database, proposal.nextWorkspace, now);
      const savedIntake = markMeetingAppliedIfCurrent(database, intake.id, intake.updatedAt, now);
      if (!savedIntake) throw new Error("The meeting proposal changed before it could be applied.");
      database.exec("COMMIT");
      transactionOpen = false;
      return Response.json({ intake: savedIntake && meetingIntakeSummary(savedIntake), workspace: savedWorkspace }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      database.exec("ROLLBACK");
      transactionOpen = false;
      throw error;
    }
  } catch (error) {
    if (transactionOpen) getDatabase().exec("ROLLBACK");
    const message = error instanceof Error ? error.message : "The meeting changes could not be applied.";
    const conflict = /changed|discarded|workspace changed|approved change set|valid meeting changes/i.test(message);
    return Response.json({ error: message }, { status: conflict ? 409 : 400, headers: { "Cache-Control": "no-store" } });
  }
}
