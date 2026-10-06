import {
  IntegrationContractError,
  assertOnlyKeys,
  cleanBoundedString,
  cleanIsoDateTime,
  cleanOptionalHttpUrl,
  cleanOptionalString,
  expectObject,
} from "../contracts";

export type MicrosoftActorRole = "author" | "sender" | "recipient" | "organizer" | "attendee" | "speaker" | "modifier" | "participant";

export interface MicrosoftActorInput {
  externalId: string;
  displayName?: string;
  emailAddress?: string;
  role?: MicrosoftActorRole;
}

export interface MicrosoftExternalActorReference {
  provider: "microsoft";
  tenantId: string;
  externalId: string;
  resolutionStatus: "unresolved";
  role: MicrosoftActorRole;
  displayName?: string;
  emailAddress?: string;
}

export interface MicrosoftSourceInput {
  tenantId: string;
  externalId: string;
  externalVersion: string;
  occurredAt: string;
  receivedAt: string;
  sourceUrl?: string;
}

export interface MicrosoftTeamsMessageInput extends MicrosoftSourceInput {
  teamId?: string;
  channelId?: string;
  chatId?: string;
  threadId?: string;
  subject?: string;
  excerpt?: string;
  author?: MicrosoftActorInput;
  participants?: MicrosoftActorInput[];
}

export interface MicrosoftOutlookMessageInput extends MicrosoftSourceInput {
  conversationId?: string;
  internetMessageId?: string;
  subject?: string;
  excerpt?: string;
  sender?: MicrosoftActorInput;
  recipients?: MicrosoftActorInput[];
  direction: "inbound" | "outbound";
  importance?: "low" | "normal" | "high";
  hasAttachments?: boolean;
}

export interface MicrosoftCalendarEventInput extends MicrosoftSourceInput {
  subject?: string;
  startsAt: string;
  endsAt: string;
  isAllDay?: boolean;
  organizer?: MicrosoftActorInput;
  attendees?: MicrosoftActorInput[];
  locationLabel?: string;
  onlineMeetingUrl?: string;
}

export interface MicrosoftMeetingTranscriptInput extends MicrosoftSourceInput {
  meetingId: string;
  title?: string;
  meetingStartedAt?: string;
  meetingEndedAt?: string;
  language?: string;
  transcriptText: string;
  speakers?: MicrosoftActorInput[];
}

export interface MicrosoftSharePointReferenceInput extends MicrosoftSourceInput {
  siteId: string;
  driveId: string;
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
  sensitivityLabel?: string;
  lastModifiedBy?: MicrosoftActorInput;
}

const SOURCE_KEYS = ["tenantId", "externalId", "externalVersion", "occurredAt", "receivedAt", "sourceUrl"] as const;
const ACTOR_KEYS = new Set(["externalId", "displayName", "emailAddress", "role"]);
const ACTOR_ROLES = new Set<MicrosoftActorRole>(["author", "sender", "recipient", "organizer", "attendee", "speaker", "modifier", "participant"]);

function cleanEnum<T extends string>(value: unknown, path: string, accepted: ReadonlySet<T>): T {
  const cleaned = cleanBoundedString(value, path, { max: 40 });
  if (!accepted.has(cleaned as T)) {
    throw new IntegrationContractError("invalid_choice", path, `must be one of: ${[...accepted].join(", ")}`);
  }
  return cleaned as T;
}

function cleanOptionalBoolean(value: unknown, path: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "boolean") {
    throw new IntegrationContractError("invalid_type", path, "must be a boolean");
  }
  return value;
}

function cleanSource(input: Record<string, unknown>, path: string): MicrosoftSourceInput {
  return {
    tenantId: cleanBoundedString(input.tenantId, `${path}.tenantId`, { max: 256 }),
    externalId: cleanBoundedString(input.externalId, `${path}.externalId`, { max: 256 }),
    externalVersion: cleanBoundedString(input.externalVersion, `${path}.externalVersion`, { max: 256 }),
    occurredAt: cleanIsoDateTime(input.occurredAt, `${path}.occurredAt`),
    receivedAt: cleanIsoDateTime(input.receivedAt, `${path}.receivedAt`),
    sourceUrl: cleanOptionalHttpUrl(input.sourceUrl, `${path}.sourceUrl`),
  };
}

export function cleanMicrosoftActorInput(
  value: unknown,
  path: string,
  fallbackRole: MicrosoftActorRole,
): MicrosoftActorInput {
  const input = expectObject(value, path);
  assertOnlyKeys(input, ACTOR_KEYS, path);
  const externalId = cleanBoundedString(input.externalId, `${path}.externalId`, { max: 256 });
  const displayName = cleanOptionalString(input.displayName, `${path}.displayName`, 200);
  const emailAddress = cleanOptionalString(input.emailAddress, `${path}.emailAddress`, 320);
  if (emailAddress && (!emailAddress.includes("@") || /\s/.test(emailAddress))) {
    throw new IntegrationContractError("invalid_email", `${path}.emailAddress`, "must be a valid email address");
  }
  const role = input.role === undefined ? fallbackRole : cleanEnum(input.role, `${path}.role`, ACTOR_ROLES);
  return {
    externalId,
    ...(displayName ? { displayName } : {}),
    ...(emailAddress ? { emailAddress: emailAddress.toLowerCase() } : {}),
    role,
  };
}

function cleanActors(value: unknown, path: string, fallbackRole: MicrosoftActorRole): MicrosoftActorInput[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw new IntegrationContractError("invalid_type", path, "must be an array");
  }
  if (value.length > 100) {
    throw new IntegrationContractError("invalid_length", path, "must not contain more than 100 people");
  }
  return value.map((actor, index) => cleanMicrosoftActorInput(actor, `${path}[${index}]`, fallbackRole));
}

export function toMicrosoftExternalActorReference(
  actor: MicrosoftActorInput,
  tenantId: string,
  forcedRole?: MicrosoftActorRole,
): MicrosoftExternalActorReference {
  return {
    provider: "microsoft",
    tenantId,
    externalId: actor.externalId,
    resolutionStatus: "unresolved",
    role: forcedRole ?? actor.role ?? "participant",
    ...(actor.displayName ? { displayName: actor.displayName } : {}),
    ...(actor.emailAddress ? { emailAddress: actor.emailAddress } : {}),
  };
}

const TEAMS_KEYS = new Set([...SOURCE_KEYS, "teamId", "channelId", "chatId", "threadId", "subject", "excerpt", "author", "participants"]);

export function cleanMicrosoftTeamsMessageInput(value: unknown): MicrosoftTeamsMessageInput {
  const input = expectObject(value, "teamsMessage");
  assertOnlyKeys(input, TEAMS_KEYS, "teamsMessage");
  const source = cleanSource(input, "teamsMessage");
  const teamId = cleanOptionalString(input.teamId, "teamsMessage.teamId", 256);
  const channelId = cleanOptionalString(input.channelId, "teamsMessage.channelId", 256);
  const chatId = cleanOptionalString(input.chatId, "teamsMessage.chatId", 256);
  if ((!channelId && !chatId) || (channelId && chatId)) {
    throw new IntegrationContractError("invalid_scope", "teamsMessage", "must identify exactly one channelId or chatId");
  }
  if (teamId && !channelId) {
    throw new IntegrationContractError("invalid_scope", "teamsMessage.teamId", "is only valid with channelId");
  }
  const threadId = cleanOptionalString(input.threadId, "teamsMessage.threadId", 256);
  const subject = cleanOptionalString(input.subject, "teamsMessage.subject", 500);
  const excerpt = cleanOptionalString(input.excerpt, "teamsMessage.excerpt", 12_000);
  const author = input.author === undefined ? undefined : cleanMicrosoftActorInput(input.author, "teamsMessage.author", "author");
  const participants = cleanActors(input.participants, "teamsMessage.participants", "participant");
  return {
    ...source,
    ...(teamId ? { teamId } : {}),
    ...(channelId ? { channelId } : {}),
    ...(chatId ? { chatId } : {}),
    ...(threadId ? { threadId } : {}),
    ...(subject ? { subject } : {}),
    ...(excerpt ? { excerpt } : {}),
    ...(author ? { author } : {}),
    ...(participants ? { participants } : {}),
  };
}

const OUTLOOK_KEYS = new Set([...SOURCE_KEYS, "conversationId", "internetMessageId", "subject", "excerpt", "sender", "recipients", "direction", "importance", "hasAttachments"]);
const DIRECTIONS = new Set<MicrosoftOutlookMessageInput["direction"]>(["inbound", "outbound"]);
const IMPORTANCE = new Set<NonNullable<MicrosoftOutlookMessageInput["importance"]>>(["low", "normal", "high"]);

export function cleanMicrosoftOutlookMessageInput(value: unknown): MicrosoftOutlookMessageInput {
  const input = expectObject(value, "outlookMessage");
  assertOnlyKeys(input, OUTLOOK_KEYS, "outlookMessage");
  const source = cleanSource(input, "outlookMessage");
  const conversationId = cleanOptionalString(input.conversationId, "outlookMessage.conversationId", 256);
  const internetMessageId = cleanOptionalString(input.internetMessageId, "outlookMessage.internetMessageId", 512);
  const subject = cleanOptionalString(input.subject, "outlookMessage.subject", 500);
  const excerpt = cleanOptionalString(input.excerpt, "outlookMessage.excerpt", 12_000);
  const sender = input.sender === undefined ? undefined : cleanMicrosoftActorInput(input.sender, "outlookMessage.sender", "sender");
  const recipients = cleanActors(input.recipients, "outlookMessage.recipients", "recipient");
  const direction = cleanEnum(input.direction, "outlookMessage.direction", DIRECTIONS);
  const importance = input.importance === undefined ? undefined : cleanEnum(input.importance, "outlookMessage.importance", IMPORTANCE);
  const hasAttachments = cleanOptionalBoolean(input.hasAttachments, "outlookMessage.hasAttachments");
  return {
    ...source,
    ...(conversationId ? { conversationId } : {}),
    ...(internetMessageId ? { internetMessageId } : {}),
    ...(subject ? { subject } : {}),
    ...(excerpt ? { excerpt } : {}),
    ...(sender ? { sender } : {}),
    ...(recipients ? { recipients } : {}),
    direction,
    ...(importance ? { importance } : {}),
    ...(hasAttachments === undefined ? {} : { hasAttachments }),
  };
}

const CALENDAR_KEYS = new Set([...SOURCE_KEYS, "subject", "startsAt", "endsAt", "isAllDay", "organizer", "attendees", "locationLabel", "onlineMeetingUrl"]);

export function cleanMicrosoftCalendarEventInput(value: unknown): MicrosoftCalendarEventInput {
  const input = expectObject(value, "calendarEvent");
  assertOnlyKeys(input, CALENDAR_KEYS, "calendarEvent");
  const source = cleanSource(input, "calendarEvent");
  const startsAt = cleanIsoDateTime(input.startsAt, "calendarEvent.startsAt");
  const endsAt = cleanIsoDateTime(input.endsAt, "calendarEvent.endsAt");
  if (Date.parse(endsAt) <= Date.parse(startsAt)) {
    throw new IntegrationContractError("invalid_range", "calendarEvent.endsAt", "must be after startsAt");
  }
  const subject = cleanOptionalString(input.subject, "calendarEvent.subject", 500);
  const isAllDay = cleanOptionalBoolean(input.isAllDay, "calendarEvent.isAllDay");
  const organizer = input.organizer === undefined ? undefined : cleanMicrosoftActorInput(input.organizer, "calendarEvent.organizer", "organizer");
  const attendees = cleanActors(input.attendees, "calendarEvent.attendees", "attendee");
  const locationLabel = cleanOptionalString(input.locationLabel, "calendarEvent.locationLabel", 500);
  const onlineMeetingUrl = cleanOptionalHttpUrl(input.onlineMeetingUrl, "calendarEvent.onlineMeetingUrl");
  return {
    ...source,
    ...(subject ? { subject } : {}),
    startsAt,
    endsAt,
    ...(isAllDay === undefined ? {} : { isAllDay }),
    ...(organizer ? { organizer } : {}),
    ...(attendees ? { attendees } : {}),
    ...(locationLabel ? { locationLabel } : {}),
    ...(onlineMeetingUrl ? { onlineMeetingUrl } : {}),
  };
}

const TRANSCRIPT_KEYS = new Set([...SOURCE_KEYS, "meetingId", "title", "meetingStartedAt", "meetingEndedAt", "language", "transcriptText", "speakers"]);

export function cleanMicrosoftMeetingTranscriptInput(value: unknown): MicrosoftMeetingTranscriptInput {
  const input = expectObject(value, "meetingTranscript");
  assertOnlyKeys(input, TRANSCRIPT_KEYS, "meetingTranscript");
  const source = cleanSource(input, "meetingTranscript");
  const meetingId = cleanBoundedString(input.meetingId, "meetingTranscript.meetingId", { max: 256 });
  const title = cleanOptionalString(input.title, "meetingTranscript.title", 500);
  const meetingStartedAt = input.meetingStartedAt === undefined ? undefined : cleanIsoDateTime(input.meetingStartedAt, "meetingTranscript.meetingStartedAt");
  const meetingEndedAt = input.meetingEndedAt === undefined ? undefined : cleanIsoDateTime(input.meetingEndedAt, "meetingTranscript.meetingEndedAt");
  if (meetingStartedAt && meetingEndedAt && Date.parse(meetingEndedAt) <= Date.parse(meetingStartedAt)) {
    throw new IntegrationContractError("invalid_range", "meetingTranscript.meetingEndedAt", "must be after meetingStartedAt");
  }
  const language = cleanOptionalString(input.language, "meetingTranscript.language", 40);
  const transcriptText = cleanBoundedString(input.transcriptText, "meetingTranscript.transcriptText", { max: 200_000 });
  const speakers = cleanActors(input.speakers, "meetingTranscript.speakers", "speaker");
  return {
    ...source,
    meetingId,
    ...(title ? { title } : {}),
    ...(meetingStartedAt ? { meetingStartedAt } : {}),
    ...(meetingEndedAt ? { meetingEndedAt } : {}),
    ...(language ? { language } : {}),
    transcriptText,
    ...(speakers ? { speakers } : {}),
  };
}

const SHAREPOINT_KEYS = new Set([...SOURCE_KEYS, "siteId", "driveId", "fileName", "mimeType", "sizeBytes", "sensitivityLabel", "lastModifiedBy"]);

export function cleanMicrosoftSharePointReferenceInput(value: unknown): MicrosoftSharePointReferenceInput {
  const input = expectObject(value, "sharePointReference");
  assertOnlyKeys(input, SHAREPOINT_KEYS, "sharePointReference");
  const source = cleanSource(input, "sharePointReference");
  if (!source.sourceUrl) {
    throw new IntegrationContractError("missing_source_url", "sharePointReference.sourceUrl", "is required for a reference-only SharePoint event");
  }
  const siteId = cleanBoundedString(input.siteId, "sharePointReference.siteId", { max: 256 });
  const driveId = cleanBoundedString(input.driveId, "sharePointReference.driveId", { max: 256 });
  const fileName = cleanBoundedString(input.fileName, "sharePointReference.fileName", { max: 500 });
  const mimeType = cleanOptionalString(input.mimeType, "sharePointReference.mimeType", 200);
  let sizeBytes: number | undefined;
  if (input.sizeBytes !== undefined && input.sizeBytes !== null) {
    if (!Number.isSafeInteger(input.sizeBytes) || (input.sizeBytes as number) < 0) {
      throw new IntegrationContractError("invalid_number", "sharePointReference.sizeBytes", "must be a non-negative safe integer");
    }
    sizeBytes = input.sizeBytes as number;
  }
  const sensitivityLabel = cleanOptionalString(input.sensitivityLabel, "sharePointReference.sensitivityLabel", 128);
  const lastModifiedBy = input.lastModifiedBy === undefined ? undefined : cleanMicrosoftActorInput(input.lastModifiedBy, "sharePointReference.lastModifiedBy", "modifier");
  return {
    ...source,
    siteId,
    driveId,
    fileName,
    ...(mimeType ? { mimeType } : {}),
    ...(sizeBytes === undefined ? {} : { sizeBytes }),
    ...(sensitivityLabel ? { sensitivityLabel } : {}),
    ...(lastModifiedBy ? { lastModifiedBy } : {}),
  };
}
