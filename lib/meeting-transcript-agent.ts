import { readGtmAgentContext, prepareGtmAgentProposal } from "./gtm-agent-contract";
import type { AgentWorkspaceProposal, WorkspaceState } from "./types";
import type { MeetingIntakeContext, MeetingSourceKind } from "./meeting-intake-store";
import { validMetricDate } from "./gtm-metrics";

export type MeetingTranscriptInput = {
  title: string;
  meetingDate: string;
  sourceKind: MeetingSourceKind;
  bodyText: string;
  context: MeetingIntakeContext;
};

function cleanText(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

export function cleanMeetingTranscriptInput(value: unknown): MeetingTranscriptInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Add the meeting title, date, and notes or transcript.");
  const raw = value as Record<string, unknown>;
  const title = cleanText(raw.title, 300);
  const meetingDate = cleanText(raw.meetingDate, 10);
  const bodyText = typeof raw.bodyText === "string" ? raw.bodyText.trim() : "";
  const sourceKind: MeetingSourceKind = raw.sourceKind === "Meeting notes" ? "Meeting notes" : "Pasted transcript";
  const rawContext = raw.context && typeof raw.context === "object" && !Array.isArray(raw.context) ? raw.context as Record<string, unknown> : {};
  const context: MeetingIntakeContext = {
    accountId: cleanText(rawContext.accountId, 100) || undefined,
    opportunityId: cleanText(rawContext.opportunityId, 100) || undefined,
    projectId: cleanText(rawContext.projectId, 100) || undefined,
  };
  if (!title) throw new Error("Add a meeting title.");
  if (!validMetricDate(meetingDate)) throw new Error("Choose a valid meeting date.");
  if (bodyText.length < 40) throw new Error("Add at least a short set of meeting notes before processing.");
  if (bodyText.length > 40_000) throw new Error("This transcript is over the 40,000-character pilot limit. Split it into a smaller meeting intake.");
  return { title, meetingDate, sourceKind, bodyText, context };
}

function verifyContext(workspace: WorkspaceState, input: MeetingTranscriptInput) {
  const account = input.context.accountId ? workspace.accounts.find((item) => !item.archivedAt && item.id === input.context.accountId) : undefined;
  if (input.context.accountId && !account) throw new Error("The selected CRM account is missing or archived.");
  const opportunity = input.context.opportunityId ? workspace.opportunities.find((item) => !item.archivedAt && item.id === input.context.opportunityId) : undefined;
  if (input.context.opportunityId && !opportunity) throw new Error("The selected opportunity is missing or archived.");
  const project = input.context.projectId ? workspace.projects.find((item) => !item.archivedAt && item.id === input.context.projectId) : undefined;
  if (input.context.projectId && !project) throw new Error("The selected project is missing or archived.");
  if (account && opportunity && opportunity.accountId !== account.id) throw new Error("The selected opportunity belongs to a different CRM account.");
  if (account && project && project.accountId && project.accountId !== account.id) throw new Error("The selected project belongs to a different CRM account.");
  if (!account && opportunity && project?.accountId && opportunity.accountId !== project.accountId) throw new Error("The selected opportunity and project belong to different CRM accounts.");
  return { account, opportunity, project };
}

export async function createMeetingTranscriptRequest(workspace: WorkspaceState, input: MeetingTranscriptInput, sourceArtifactId: string, now = new Date()) {
  verifyContext(workspace, input);
  const context = await readGtmAgentContext(workspace, now);
  const prompt = `You are SOSA processing a saved meeting source for Spej OS. Turn only explicit, supported facts into one reviewable proposal. Nothing is saved until a person approves it.

Return exactly one JSON object with the same action envelope used by Spej OS:
{"reply":"concise summary","needsClarification":false,"actions":[{"type":"create|update|complete","collection":"accounts|contacts|activities|opportunities|partnerships|projects|tasks|content|campaigns|marketingMetrics|reminders","recordId":"existing ID for update/complete","label":"short label","reason":"source-grounded reason","data":{}}]}

Rules:
- Use only facts in the saved meeting source and canonical workspace evidence. Do not invent attendees, companies, ownership, dates, deadlines, values, commitments, stages, decisions, or completed work.
- Separate what was discussed from what was actually agreed. A suggestion is not a commitment; a possible date is not a deadline.
- If account, person, owner, linkage, intent, or a consequential field is ambiguous, set needsClarification true, ask one direct question, and return no actions.
- Propose at most 12 actions. If more work exists, prepare the highest-confidence batch and say another batch remains.
- Create at most one activities record for this meeting. Use channel "Meeting", metricType "Meeting held", the actual meeting date, a factual summary, and a concise outcome. Use purpose only when supported.
- Use canonical record IDs for every update. A new contact, opportunity, activity, partnership, or client-delivery project needs an existing accountId or an account created earlier in the same action batch.
- Create or update tasks, projects, opportunities, content ideas, and campaigns only when the source supports them. Do not send messages, schedule meetings, publish content, or operate external tools.
- A meeting may propose opportunity priority inputs only when explicitly supported: value/valueConfidence, annualRevenuePotential, revenueModel, timeToRevenue, seriousness, primaryContactId, decisionAccess, stakeholderCoverage, strategicFit, expansionPotential, and priorityEvidence. Do not infer these from tone or company reputation. Do not calculate or supply scores, tiers, action windows, confidence, human review status, overrides, review dates, or evidence source IDs.
- Project fields are workArea, projectType, playbook, phase (DDD only), opportunityId, commercialStatus, operationalStatus, health, owner, startDate, endDate, nextMilestone, dueDate, successMeasure, risk, and notes. DDD is one optional playbook, not the entire project system.
- A task may use category "Project Work" and relatedType "project". Keep existing legacy Client Delivery tasks unchanged.
- Do not include sourceArtifactId or sourceLabel yourself; the server adds provenance deterministically.

Saved meeting metadata:
${JSON.stringify({ sourceArtifactId, title: input.title, meetingDate: input.meetingDate, sourceKind: input.sourceKind, selectedContext: input.context })}

Deterministic workspace context:
${JSON.stringify({ currentDate: context.currentDate, baseWorkspaceVersion: context.baseWorkspaceVersion, clientSummary: context.clientSummary, relationshipCheckIns: context.relationshipCheckIns, metricSummaries: context.metricSummaries, prioritySummary: context.prioritySummary, priorityRecommendations: context.priorityRecommendations })}

Canonical workspace evidence (${context.included} of ${context.total} active records; maximum 300 per collection):
${JSON.stringify(context.evidence)}

Saved notes or transcript:
${input.bodyText}`;
  return { input, sourceArtifactId, context, prompt };
}

function canonicalCollection(value: unknown) {
  const name = String(value || "").trim().toLowerCase();
  return name === "activity" ? "activities" : name;
}

function attachMeetingContext(workspace: WorkspaceState, response: unknown, input: MeetingTranscriptInput) {
  if (!response || typeof response !== "object" || Array.isArray(response)) return response;
  const envelope = structuredClone(response) as { actions?: unknown };
  if (!Array.isArray(envelope.actions)) return envelope;
  const selected = verifyContext(workspace, input);
  const selectedAccountId = input.context.accountId || selected.opportunity?.accountId || selected.project?.accountId || "";
  let meetingActivityCount = 0;
  envelope.actions = envelope.actions.map((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return candidate;
    const action = candidate as Record<string, unknown>;
    const data = action.data && typeof action.data === "object" && !Array.isArray(action.data) ? action.data as Record<string, unknown> : {};
    const type = String(action.type || "").trim().toLowerCase();
    const collection = canonicalCollection(action.collection);
    const recordId = String(action.recordId || "");
    const linkedCollections = ["contacts", "activities", "opportunities", "partnerships", "projects"];

    if (selectedAccountId && linkedCollections.includes(collection)) {
      if (type === "create" && data.accountId && String(data.accountId) !== selectedAccountId) throw new Error("SOSA proposed a record outside the selected CRM account. Reprocess or change the meeting context.");
      if (type === "update") {
        const current = (workspace[collection as keyof WorkspaceState] as Array<{ id: string | number; accountId?: string }> | undefined)?.find((item) => String(item.id) === recordId);
        if (current?.accountId && current.accountId !== selectedAccountId) throw new Error("SOSA proposed an update outside the selected CRM account. Reprocess or change the meeting context.");
      }
    }
    if (input.context.opportunityId && collection === "opportunities" && type === "update" && recordId !== input.context.opportunityId) throw new Error("SOSA proposed a different opportunity than the one selected for this meeting.");
    if (input.context.projectId && collection === "projects" && type === "update" && recordId !== input.context.projectId) throw new Error("SOSA proposed a different project than the one selected for this meeting.");

    if (type !== "create" || collection !== "activities") {
      const contextualData = { ...data };
      if (type === "create" && selectedAccountId && linkedCollections.includes(collection) && !contextualData.accountId) contextualData.accountId = selectedAccountId;
      if (collection === "projects" && input.context.opportunityId) {
        if (contextualData.opportunityId && String(contextualData.opportunityId) !== input.context.opportunityId) throw new Error("SOSA proposed a project link outside the selected opportunity.");
        if (type === "create" && !contextualData.opportunityId) contextualData.opportunityId = input.context.opportunityId;
      }
      return { ...action, data: contextualData };
    }

    meetingActivityCount += 1;
    if (selectedAccountId && data.accountId && String(data.accountId) !== selectedAccountId) throw new Error("SOSA proposed meeting activity outside the selected CRM account.");
    if (input.context.opportunityId && data.opportunityId && String(data.opportunityId) !== input.context.opportunityId) throw new Error("SOSA proposed meeting activity for a different opportunity.");
    if (input.context.projectId && data.projectId && String(data.projectId) !== input.context.projectId) throw new Error("SOSA proposed meeting activity for a different project.");
    return { ...action, collection: "activities", data: { ...data, channel: "Meeting", metricType: "Meeting held", occurredAt: input.meetingDate, ...(selectedAccountId ? { accountId: selectedAccountId } : {}), ...(input.context.opportunityId ? { opportunityId: input.context.opportunityId } : {}), ...(input.context.projectId ? { projectId: input.context.projectId } : {}) } };
  });
  if (meetingActivityCount > 1) throw new Error("SOSA proposed more than one activity for the same meeting. Reprocess the source as a smaller, clearer batch.");
  return envelope;
}

export async function prepareMeetingTranscriptProposal(workspace: WorkspaceState, response: unknown, input: MeetingTranscriptInput, sourceArtifactId: string): Promise<AgentWorkspaceProposal> {
  if (typeof sourceArtifactId !== "string" || !sourceArtifactId.trim() || sourceArtifactId !== sourceArtifactId.trim() || sourceArtifactId.length > 100) throw new Error("The saved meeting needs a valid source ID before preparing its proposal.");
  const proposal = await prepareGtmAgentProposal(workspace, attachMeetingContext(workspace, response, input));
  const activityAction = proposal.actions.find((action) => action.type === "create" && action.collection === "activities");
  if (!activityAction || !proposal.nextWorkspace) return proposal;
  if (workspace.activities.some((item) => !item.archivedAt && item.sourceArtifactId === sourceArtifactId)) throw new Error("This source meeting already has a recorded activity. Reprocess the existing intake instead of creating a duplicate.");
  const activity = proposal.nextWorkspace.activities.find((item) => item.id === activityAction.recordId);
  if (!activity) throw new Error("The proposed meeting activity could not be linked to its saved source.");
  // The route obtains this ID from the saved intake. No provenance object or
  // trust flag is accepted from the model or passed through the generic parser.
  const provenance = { sourceArtifactId, sourceLabel: "Manual meeting intake" } as const;
  activityAction.data = { ...activityAction.data, ...provenance };
  Object.assign(activity, provenance);
  return proposal;
}
