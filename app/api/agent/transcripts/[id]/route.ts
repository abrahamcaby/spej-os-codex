import { getMeetingIntake, markMeetingDiscarded, meetingIntakeSummary } from "@/lib/meeting-intake-store";
import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const intake = getMeetingIntake(getDatabase(), id);
  if (!intake) return Response.json({ error: "Meeting intake not found." }, { status: 404 });
  return Response.json({ intake: { ...meetingIntakeSummary(intake), bodyText: intake.bodyText, context: intake.context } }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json() as { action?: unknown };
    if (body.action !== "discard") return Response.json({ error: "Only discard is supported for a processed intake." }, { status: 400 });
    const { id } = await params;
    const database = getDatabase();
    const existing = getMeetingIntake(database, id);
    if (!existing) return Response.json({ error: "Meeting intake not found." }, { status: 404 });
    if (existing.status === "applied") return Response.json({ error: "Applied meeting changes cannot be discarded." }, { status: 409 });
    const saved = markMeetingDiscarded(database, id);
    return Response.json({ intake: saved && meetingIntakeSummary(saved) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The meeting intake could not be discarded." }, { status: 400 });
  }
}
