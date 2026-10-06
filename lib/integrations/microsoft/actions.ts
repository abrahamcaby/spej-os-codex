import {
  IntegrationContractError,
  assertOnlyKeys,
  cleanBoundedString,
  cleanIsoDateTime,
  cleanOptionalString,
  expectObject,
  type JsonObject,
} from "../contracts";

export type MicrosoftMessageRecipient = { emailAddress: string; displayName?: string };

export type MicrosoftOutlookSendDraft = JsonObject & {
  kind: "outlook.send";
  to: MicrosoftMessageRecipient[];
  cc?: MicrosoftMessageRecipient[];
  bcc?: MicrosoftMessageRecipient[];
  subject: string;
  bodyText: string;
  replyToExternalId?: string;
};

export type MicrosoftTeamsSendDraft = JsonObject & {
  kind: "teams.send";
  teamId?: string;
  channelId?: string;
  chatId?: string;
  threadId?: string;
  bodyText: string;
};

export type MicrosoftCalendarWriteDraft = JsonObject & {
  kind: "calendar.write";
  change: "create" | "update" | "cancel";
  eventExternalId?: string;
  expectedExternalVersion?: string;
  subject?: string;
  startsAt?: string;
  endsAt?: string;
  attendees?: MicrosoftMessageRecipient[];
  locationLabel?: string;
  cancellationMessage?: string;
};

export type MicrosoftSharePointWriteDraft = JsonObject & {
  kind: "sharepoint.write";
  change: "update-metadata";
  siteId: string;
  driveId: string;
  itemId: string;
  expectedExternalVersion: string;
  title?: string;
  description?: string;
};

export type MicrosoftExternalActionDraft =
  | MicrosoftOutlookSendDraft
  | MicrosoftTeamsSendDraft
  | MicrosoftCalendarWriteDraft
  | MicrosoftSharePointWriteDraft;

const RECIPIENT_KEYS = new Set(["emailAddress", "displayName"]);

function cleanRecipient(value: unknown, path: string): MicrosoftMessageRecipient {
  const input = expectObject(value, path);
  assertOnlyKeys(input, RECIPIENT_KEYS, path);
  const emailAddress = cleanBoundedString(input.emailAddress, `${path}.emailAddress`, { max: 320 }).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailAddress)) throw new IntegrationContractError("invalid_email", `${path}.emailAddress`, "must be a valid email address");
  const displayName = cleanOptionalString(input.displayName, `${path}.displayName`, 200);
  return { emailAddress, ...(displayName ? { displayName } : {}) };
}

function cleanRecipients(value: unknown, path: string, required = false) {
  if (value === undefined || value === null) {
    if (required) throw new IntegrationContractError("missing_field", path, "is required");
    return undefined;
  }
  if (!Array.isArray(value) || value.length < (required ? 1 : 0) || value.length > 100) {
    throw new IntegrationContractError("invalid_length", path, `must contain ${required ? "between 1 and" : "at most"} 100 recipients`);
  }
  const byAddress = new Map<string, MicrosoftMessageRecipient>();
  value.forEach((entry, index) => {
    const recipient = cleanRecipient(entry, `${path}[${index}]`);
    byAddress.set(recipient.emailAddress, recipient);
  });
  return [...byAddress.values()];
}

function optionalId(value: unknown, path: string) {
  return cleanOptionalString(value, path, 256);
}

const OUTLOOK_KEYS = new Set(["kind", "to", "cc", "bcc", "subject", "bodyText", "replyToExternalId"]);

function cleanOutlook(input: Record<string, unknown>): MicrosoftOutlookSendDraft {
  assertOnlyKeys(input, OUTLOOK_KEYS, "action");
  const to = cleanRecipients(input.to, "action.to", true) as MicrosoftMessageRecipient[];
  const cc = cleanRecipients(input.cc, "action.cc");
  const bcc = cleanRecipients(input.bcc, "action.bcc");
  if (to.length + (cc?.length ?? 0) + (bcc?.length ?? 0) > 100) throw new IntegrationContractError("invalid_length", "action", "must not address more than 100 total recipients");
  const subject = cleanBoundedString(input.subject, "action.subject", { max: 500 });
  const bodyText = cleanBoundedString(input.bodyText, "action.bodyText", { max: 20_000 });
  const replyToExternalId = optionalId(input.replyToExternalId, "action.replyToExternalId");
  return { kind: "outlook.send", to, ...(cc?.length ? { cc } : {}), ...(bcc?.length ? { bcc } : {}), subject, bodyText, ...(replyToExternalId ? { replyToExternalId } : {}) };
}

const TEAMS_KEYS = new Set(["kind", "teamId", "channelId", "chatId", "threadId", "bodyText"]);

function cleanTeams(input: Record<string, unknown>): MicrosoftTeamsSendDraft {
  assertOnlyKeys(input, TEAMS_KEYS, "action");
  const teamId = optionalId(input.teamId, "action.teamId");
  const channelId = optionalId(input.channelId, "action.channelId");
  const chatId = optionalId(input.chatId, "action.chatId");
  if ((!channelId && !chatId) || (channelId && chatId)) throw new IntegrationContractError("invalid_scope", "action", "must identify exactly one channelId or chatId");
  if (teamId && !channelId) throw new IntegrationContractError("invalid_scope", "action.teamId", "is only valid with channelId");
  const threadId = optionalId(input.threadId, "action.threadId");
  const bodyText = cleanBoundedString(input.bodyText, "action.bodyText", { max: 8_000 });
  return { kind: "teams.send", ...(teamId ? { teamId } : {}), ...(channelId ? { channelId } : {}), ...(chatId ? { chatId } : {}), ...(threadId ? { threadId } : {}), bodyText };
}

const CALENDAR_KEYS = new Set(["kind", "change", "eventExternalId", "expectedExternalVersion", "subject", "startsAt", "endsAt", "attendees", "locationLabel", "cancellationMessage"]);

function cleanCalendar(input: Record<string, unknown>): MicrosoftCalendarWriteDraft {
  assertOnlyKeys(input, CALENDAR_KEYS, "action");
  const change = cleanBoundedString(input.change, "action.change", { max: 20 });
  if (change !== "create" && change !== "update" && change !== "cancel") throw new IntegrationContractError("invalid_choice", "action.change", "must be create, update, or cancel");
  const eventExternalId = optionalId(input.eventExternalId, "action.eventExternalId");
  const expectedExternalVersion = optionalId(input.expectedExternalVersion, "action.expectedExternalVersion");
  if (change !== "create" && (!eventExternalId || !expectedExternalVersion)) throw new IntegrationContractError("missing_field", "action", "updates and cancellations require eventExternalId and expectedExternalVersion");
  if (change === "create" && (eventExternalId || expectedExternalVersion)) throw new IntegrationContractError("invalid_field", "action", "a new event must not claim an existing external ID or version");
  const subject = cleanOptionalString(input.subject, "action.subject", 500);
  const startsAt = input.startsAt === undefined ? undefined : cleanIsoDateTime(input.startsAt, "action.startsAt");
  const endsAt = input.endsAt === undefined ? undefined : cleanIsoDateTime(input.endsAt, "action.endsAt");
  const attendees = cleanRecipients(input.attendees, "action.attendees");
  const locationLabel = cleanOptionalString(input.locationLabel, "action.locationLabel", 500);
  const cancellationMessage = cleanOptionalString(input.cancellationMessage, "action.cancellationMessage", 2_000);
  if (change !== "cancel") {
    if (!subject || !startsAt || !endsAt) throw new IntegrationContractError("missing_field", "action", "event creates and updates require subject, startsAt, and endsAt");
    if (Date.parse(endsAt) <= Date.parse(startsAt)) throw new IntegrationContractError("invalid_range", "action.endsAt", "must be after startsAt");
    if (cancellationMessage) throw new IntegrationContractError("invalid_field", "action.cancellationMessage", "is only valid for a cancellation");
  } else if (subject || startsAt || endsAt || attendees || locationLabel) {
    throw new IntegrationContractError("invalid_field", "action", "a cancellation may contain only target identity and a cancellation message");
  }
  return {
    kind: "calendar.write",
    change,
    ...(eventExternalId ? { eventExternalId } : {}),
    ...(expectedExternalVersion ? { expectedExternalVersion } : {}),
    ...(subject ? { subject } : {}),
    ...(startsAt ? { startsAt } : {}),
    ...(endsAt ? { endsAt } : {}),
    ...(attendees?.length ? { attendees } : {}),
    ...(locationLabel ? { locationLabel } : {}),
    ...(cancellationMessage ? { cancellationMessage } : {}),
  };
}

const SHAREPOINT_KEYS = new Set(["kind", "change", "siteId", "driveId", "itemId", "expectedExternalVersion", "title", "description"]);

function cleanSharePoint(input: Record<string, unknown>): MicrosoftSharePointWriteDraft {
  assertOnlyKeys(input, SHAREPOINT_KEYS, "action");
  if (input.change !== "update-metadata") throw new IntegrationContractError("invalid_choice", "action.change", "must be update-metadata");
  const siteId = cleanBoundedString(input.siteId, "action.siteId", { max: 256 });
  const driveId = cleanBoundedString(input.driveId, "action.driveId", { max: 256 });
  const itemId = cleanBoundedString(input.itemId, "action.itemId", { max: 256 });
  const expectedExternalVersion = cleanBoundedString(input.expectedExternalVersion, "action.expectedExternalVersion", { max: 256 });
  const title = cleanOptionalString(input.title, "action.title", 500);
  const description = cleanOptionalString(input.description, "action.description", 2_000);
  if (!title && !description) throw new IntegrationContractError("missing_field", "action", "must include title or description");
  return { kind: "sharepoint.write", change: "update-metadata", siteId, driveId, itemId, expectedExternalVersion, ...(title ? { title } : {}), ...(description ? { description } : {}) };
}

/** Validates an action draft only. It does not authorize, approve, or execute it. */
export function cleanMicrosoftExternalActionDraft(value: unknown): MicrosoftExternalActionDraft {
  const input = expectObject(value, "action");
  const kind = cleanBoundedString(input.kind, "action.kind", { max: 40 });
  if (kind === "outlook.send") return cleanOutlook(input);
  if (kind === "teams.send") return cleanTeams(input);
  if (kind === "calendar.write") return cleanCalendar(input);
  if (kind === "sharepoint.write") return cleanSharePoint(input);
  throw new IntegrationContractError("unsupported_action", "action.kind", "is not a supported Microsoft action");
}
