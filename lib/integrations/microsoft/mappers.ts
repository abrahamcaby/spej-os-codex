import {
  type ConnectorEventEnvelope,
  compactExcerpt,
  createConnectorEventEnvelope,
} from "../contracts";
import {
  cleanMicrosoftCalendarEventInput,
  cleanMicrosoftMeetingTranscriptInput,
  cleanMicrosoftOutlookMessageInput,
  cleanMicrosoftSharePointReferenceInput,
  cleanMicrosoftTeamsMessageInput,
  toMicrosoftExternalActorReference,
} from "./contracts";

export const MICROSOFT_EVENT_KINDS = {
  teamsMessage: "microsoft.teams.message",
  outlookMessage: "microsoft.outlook.message",
  calendarEvent: "microsoft.calendar.event",
  meetingTranscript: "microsoft.meeting.transcript",
  sharePointReference: "microsoft.sharepoint.item-reference",
} as const;

export function mapMicrosoftTeamsMessage(value: unknown): ConnectorEventEnvelope {
  const input = cleanMicrosoftTeamsMessageInput(value);
  const people = input.participants?.map((actor) => toMicrosoftExternalActorReference(actor, input.tenantId, "participant"));
  return createConnectorEventEnvelope({
    provider: "microsoft",
    tenantId: input.tenantId,
    kind: MICROSOFT_EVENT_KINDS.teamsMessage,
    externalId: input.externalId,
    externalVersion: input.externalVersion,
    occurredAt: input.occurredAt,
    receivedAt: input.receivedAt,
    sourceUrl: input.sourceUrl,
    payload: {
      recordType: "teams_message",
      scope: {
        ...(input.teamId ? { teamId: input.teamId } : {}),
        ...(input.channelId ? { channelId: input.channelId } : {}),
        ...(input.chatId ? { chatId: input.chatId } : {}),
        ...(input.threadId ? { threadId: input.threadId } : {}),
      },
      ...(input.subject ? { subject: input.subject } : {}),
      ...(input.excerpt ? { excerpt: compactExcerpt(input.excerpt, 1_500) } : {}),
      ...(input.author ? { author: toMicrosoftExternalActorReference(input.author, input.tenantId, "author") } : {}),
      ...(people?.length ? { participants: people } : {}),
    },
  });
}

export function mapMicrosoftOutlookMessage(value: unknown): ConnectorEventEnvelope {
  const input = cleanMicrosoftOutlookMessageInput(value);
  const recipients = input.recipients?.map((actor) => toMicrosoftExternalActorReference(actor, input.tenantId, "recipient"));
  return createConnectorEventEnvelope({
    provider: "microsoft",
    tenantId: input.tenantId,
    kind: MICROSOFT_EVENT_KINDS.outlookMessage,
    externalId: input.externalId,
    externalVersion: input.externalVersion,
    occurredAt: input.occurredAt,
    receivedAt: input.receivedAt,
    sourceUrl: input.sourceUrl,
    payload: {
      recordType: "outlook_message",
      direction: input.direction,
      ...(input.conversationId ? { conversationId: input.conversationId } : {}),
      ...(input.internetMessageId ? { internetMessageId: input.internetMessageId } : {}),
      ...(input.subject ? { subject: input.subject } : {}),
      ...(input.excerpt ? { excerpt: compactExcerpt(input.excerpt, 1_500) } : {}),
      ...(input.sender ? { sender: toMicrosoftExternalActorReference(input.sender, input.tenantId, "sender") } : {}),
      ...(recipients?.length ? { recipients } : {}),
      ...(input.importance ? { importance: input.importance } : {}),
      ...(input.hasAttachments === undefined ? {} : { hasAttachments: input.hasAttachments }),
    },
  });
}

export function mapMicrosoftCalendarEvent(value: unknown): ConnectorEventEnvelope {
  const input = cleanMicrosoftCalendarEventInput(value);
  const attendees = input.attendees?.map((actor) => toMicrosoftExternalActorReference(actor, input.tenantId, "attendee"));
  return createConnectorEventEnvelope({
    provider: "microsoft",
    tenantId: input.tenantId,
    kind: MICROSOFT_EVENT_KINDS.calendarEvent,
    externalId: input.externalId,
    externalVersion: input.externalVersion,
    occurredAt: input.occurredAt,
    receivedAt: input.receivedAt,
    sourceUrl: input.sourceUrl,
    payload: {
      recordType: "calendar_event",
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      ...(input.subject ? { subject: input.subject } : {}),
      ...(input.isAllDay === undefined ? {} : { isAllDay: input.isAllDay }),
      ...(input.organizer ? { organizer: toMicrosoftExternalActorReference(input.organizer, input.tenantId, "organizer") } : {}),
      ...(attendees?.length ? { attendees } : {}),
      ...(input.locationLabel ? { locationLabel: input.locationLabel } : {}),
      ...(input.onlineMeetingUrl ? { onlineMeetingUrl: input.onlineMeetingUrl } : {}),
    },
  });
}

export function mapMicrosoftMeetingTranscript(value: unknown): ConnectorEventEnvelope {
  const input = cleanMicrosoftMeetingTranscriptInput(value);
  const speakers = input.speakers?.map((actor) => toMicrosoftExternalActorReference(actor, input.tenantId, "speaker"));
  return createConnectorEventEnvelope({
    provider: "microsoft",
    tenantId: input.tenantId,
    kind: MICROSOFT_EVENT_KINDS.meetingTranscript,
    externalId: input.externalId,
    externalVersion: input.externalVersion,
    occurredAt: input.occurredAt,
    receivedAt: input.receivedAt,
    sourceUrl: input.sourceUrl,
    payload: {
      recordType: "meeting_transcript",
      meetingId: input.meetingId,
      ...(input.title ? { title: input.title } : {}),
      ...(input.meetingStartedAt ? { meetingStartedAt: input.meetingStartedAt } : {}),
      ...(input.meetingEndedAt ? { meetingEndedAt: input.meetingEndedAt } : {}),
      ...(input.language ? { language: input.language } : {}),
      transcriptExcerpt: compactExcerpt(input.transcriptText, 4_000),
      ...(speakers?.length ? { speakers } : {}),
    },
  });
}

export function mapMicrosoftSharePointReference(value: unknown): ConnectorEventEnvelope {
  const input = cleanMicrosoftSharePointReferenceInput(value);
  return createConnectorEventEnvelope({
    provider: "microsoft",
    tenantId: input.tenantId,
    kind: MICROSOFT_EVENT_KINDS.sharePointReference,
    externalId: input.externalId,
    externalVersion: input.externalVersion,
    occurredAt: input.occurredAt,
    receivedAt: input.receivedAt,
    sourceUrl: input.sourceUrl,
    payload: {
      recordType: "sharepoint_item_reference",
      referenceOnly: true,
      siteId: input.siteId,
      driveId: input.driveId,
      itemId: input.externalId,
      fileName: input.fileName,
      ...(input.mimeType ? { mimeType: input.mimeType } : {}),
      ...(input.sizeBytes === undefined ? {} : { sizeBytes: input.sizeBytes }),
      ...(input.sensitivityLabel ? { sensitivityLabel: input.sensitivityLabel } : {}),
      ...(input.lastModifiedBy ? { lastModifiedBy: toMicrosoftExternalActorReference(input.lastModifiedBy, input.tenantId, "modifier") } : {}),
    },
  });
}
