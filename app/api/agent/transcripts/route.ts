import { cleanMeetingTranscriptInput, createMeetingTranscriptRequest, prepareMeetingTranscriptProposal } from "@/lib/meeting-transcript-agent";
import { claimMeetingProcessing, createMeetingIntake, getMeetingIntake, listMeetingIntakes, markMeetingFailedIfProcessing, meetingIntakeSummary, saveMeetingProposalIfProcessing } from "@/lib/meeting-intake-store";
import { workspaceFingerprint } from "@/lib/agent-session";
import { getDatabase } from "@/lib/server/database";
import { parseAiJson, runConfiguredAi } from "@/lib/server/ai";
import { readSettings } from "@/lib/server/settings";
import { readWorkspaceState } from "@/lib/workspace-store";

export const runtime = "nodejs";

export async function GET() {
  const records = listMeetingIntakes(getDatabase(), 10).map(meetingIntakeSummary);
  return Response.json({ records }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let intakeId = "";
  let processingRevision = "";
  try {
    if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "Send the meeting intake as JSON." }, { status: 415 });
    const raw = await request.text();
    if (raw.length > 55_000) return Response.json({ error: "The meeting intake is over the pilot size limit." }, { status: 413 });
    const input = cleanMeetingTranscriptInput(JSON.parse(raw));
    const database = getDatabase();
    const created = createMeetingIntake(database, input);
    intakeId = created.record.id;
    const sameContext = ["accountId", "opportunityId", "projectId"].every((key) => created.record.context[key as keyof typeof created.record.context] === input.context[key as keyof typeof input.context]);
    if (created.duplicate && ["applied", "discarded"].includes(created.record.status)) {
      return Response.json({ duplicate: true, intake: meetingIntakeSummary(created.record) }, { headers: { "Cache-Control": "no-store" } });
    }
    if (created.duplicate && sameContext && created.record.proposal && created.record.modelEnvelope) {
      if (created.record.status === "needs_clarification") return Response.json({ duplicate: true, intake: meetingIntakeSummary(created.record), proposal: created.record.proposal }, { headers: { "Cache-Control": "no-store" } });
      const workspace = readWorkspaceState(database);
      if (created.record.baseWorkspaceVersion && await workspaceFingerprint(workspace) === created.record.baseWorkspaceVersion) {
        const savedInput = cleanMeetingTranscriptInput({ title: created.record.title, meetingDate: created.record.meetingDate, sourceKind: created.record.sourceKind, bodyText: created.record.bodyText, context: created.record.context });
        const proposal = await prepareMeetingTranscriptProposal(workspace, created.record.modelEnvelope, savedInput, created.record.id);
        return Response.json({ duplicate: true, intake: meetingIntakeSummary(created.record), proposal }, { headers: { "Cache-Control": "no-store" } });
      }
    }
    const claimed = claimMeetingProcessing(database, created.record.id, input.context, created.duplicate && (!sameContext || ["proposed", "needs_clarification"].includes(created.record.status)));
    if (!claimed) {
      const current = getMeetingIntake(database, created.record.id);
      if (current?.status === "processing") return Response.json({ processing: true, intake: meetingIntakeSummary(current) }, { status: 202, headers: { "Cache-Control": "no-store", "Retry-After": "2" } });
      return Response.json({ error: "This meeting intake changed while it was being prepared. Refresh and try again.", intake: current && meetingIntakeSummary(current) }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }
    processingRevision = claimed.updatedAt;
    const savedInput = cleanMeetingTranscriptInput({
      title: claimed.title,
      meetingDate: claimed.meetingDate,
      sourceKind: claimed.sourceKind,
      bodyText: claimed.bodyText,
      context: claimed.context,
    });
    const workspace = readWorkspaceState(database);
    const agentRequest = await createMeetingTranscriptRequest(workspace, savedInput, claimed.id);
    const settings = await readSettings();
    const result = await runConfiguredAi(settings, { prompt: agentRequest.prompt, maxOutputTokens: 5_000 });
    const modelEnvelope = parseAiJson(result.text);
    const proposal = await prepareMeetingTranscriptProposal(workspace, modelEnvelope, savedInput, claimed.id);
    const saved = saveMeetingProposalIfProcessing(database, claimed.id, processingRevision, {
      status: proposal.needsClarification ? "needs_clarification" : "proposed",
      replyText: proposal.reply,
      modelEnvelope,
      proposal,
      baseWorkspaceVersion: proposal.baseWorkspaceVersion || agentRequest.context.baseWorkspaceVersion,
      provider: result.provider,
      model: result.model,
    });
    if (!saved) return Response.json({ error: "A newer action replaced this processing result. Refresh the meeting before continuing." }, { status: 409, headers: { "Cache-Control": "no-store" } });
    return Response.json({ duplicate: created.duplicate, intake: meetingIntakeSummary(saved), proposal }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SOSA could not process that meeting.";
    const needsSetup = /AI curation is off|no API key|no matching loaded text model/i.test(message);
    if (intakeId && processingRevision) markMeetingFailedIfProcessing(getDatabase(), intakeId, processingRevision, message, needsSetup);
    return Response.json({ error: needsSetup ? "The meeting was saved locally. Connect a model in Settings to process it." : message, needsSetup, intakeId: intakeId || undefined }, { status: needsSetup ? 409 : 400, headers: { "Cache-Control": "no-store" } });
  }
}
