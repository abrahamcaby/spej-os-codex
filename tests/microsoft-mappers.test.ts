import assert from "node:assert/strict";
import test from "node:test";
import {
  mapMicrosoftCalendarEvent,
  mapMicrosoftMeetingTranscript,
  mapMicrosoftOutlookMessage,
  mapMicrosoftSharePointReference,
  mapMicrosoftTeamsMessage,
} from "../lib/integrations/microsoft";

const source = () => ({
  tenantId: "spej-tenant",
  externalId: "graph-item-1",
  externalVersion: "etag-1",
  occurredAt: "2026-09-01T14:00:00Z",
  receivedAt: "2026-09-01T14:00:05Z",
  sourceUrl: "https://www.microsoft.com/item/1",
});

test("Teams mapper keeps unmatched people as external references and creates no CRM records", () => {
  const event = mapMicrosoftTeamsMessage({
    ...source(),
    teamId: "team-a",
    channelId: "channel-a",
    excerpt: "Customer asked for a follow-up.",
    author: { externalId: "aad-user-a", displayName: "External Person", emailAddress: "PERSON@EXAMPLE.COM" },
    participants: [{ externalId: "aad-user-b", displayName: "Another Person" }],
  });
  const author = event.payload.author as Record<string, unknown>;
  assert.equal(event.kind, "microsoft.teams.message");
  assert.equal(author.provider, "microsoft");
  assert.equal(author.tenantId, "spej-tenant");
  assert.equal(author.resolutionStatus, "unresolved");
  assert.equal(author.emailAddress, "person@example.com");
  assert.equal("contactId" in author, false);
  assert.equal("accountId" in author, false);
  assert.equal("crmRecord" in event.payload, false);
});

test("Outlook mapper stores a short preview rather than a message body", () => {
  const event = mapMicrosoftOutlookMessage({
    ...source(),
    direction: "inbound",
    subject: "Implementation question",
    excerpt: `Start ${"detail ".repeat(400)} End`,
    sender: { externalId: "aad-user-a", displayName: "Sender" },
    recipients: [{ externalId: "aad-user-b", displayName: "Recipient" }],
    hasAttachments: true,
  });
  const excerpt = event.payload.excerpt as string;
  assert.equal(event.kind, "microsoft.outlook.message");
  assert.equal(excerpt.length, 1_500);
  assert.ok(excerpt.endsWith("…"));
  assert.equal("body" in event.payload, false);
  assert.equal("attachments" in event.payload, false);
  assert.equal(event.payload.hasAttachments, true);
});

test("calendar mapper preserves timing and unresolved attendance without creating work", () => {
  const event = mapMicrosoftCalendarEvent({
    ...source(),
    subject: "Discovery call",
    startsAt: "2026-09-03T10:00:00-04:00",
    endsAt: "2026-09-03T10:30:00-04:00",
    organizer: { externalId: "aad-organizer", displayName: "Organizer" },
    attendees: [{ externalId: "aad-attendee", displayName: "Attendee" }],
    onlineMeetingUrl: "https://teams.microsoft.com/meet/abc",
  });
  assert.equal(event.payload.startsAt, "2026-09-03T14:00:00.000Z");
  assert.equal(event.payload.endsAt, "2026-09-03T14:30:00.000Z");
  const attendee = (event.payload.attendees as unknown[])[0] as Record<string, unknown>;
  assert.equal(attendee.resolutionStatus, "unresolved");
  assert.equal("task" in event.payload, false);
});

test("transcript mapper minimizes full text to an evidence excerpt", () => {
  const transcriptText = `The facilitator opened the meeting. ${"Detailed conversation. ".repeat(300)}The meeting ended.`;
  const event = mapMicrosoftMeetingTranscript({
    ...source(),
    externalId: "transcript-a",
    meetingId: "meeting-a",
    title: "Account review",
    transcriptText,
    speakers: [{ externalId: "speaker-a", displayName: "Speaker A" }],
  });
  const excerpt = event.payload.transcriptExcerpt as string;
  assert.equal(event.kind, "microsoft.meeting.transcript");
  assert.equal(excerpt.length, 4_000);
  assert.ok(excerpt.endsWith("…"));
  assert.equal("transcriptText" in event.payload, false);
  assert.equal(JSON.stringify(event).includes(transcriptText), false);
});

test("SharePoint mapper emits metadata and a URL, never document content or a download token", () => {
  const event = mapMicrosoftSharePointReference({
    ...source(),
    externalId: "item-a",
    siteId: "site-a",
    driveId: "drive-a",
    fileName: "GTM plan.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sizeBytes: 42_000,
    sensitivityLabel: "Internal",
    lastModifiedBy: { externalId: "aad-user-a", displayName: "Editor" },
  });
  assert.equal(event.kind, "microsoft.sharepoint.item-reference");
  assert.equal(event.payload.referenceOnly, true);
  assert.equal(event.payload.itemId, "item-a");
  assert.equal(event.sourceUrl, "https://www.microsoft.com/item/1");
  assert.equal("content" in event.payload, false);
  assert.equal("downloadUrl" in event.payload, false);
});

test("all Microsoft mappers derive stable identities from tenant, kind, source ID, and version", () => {
  const first = mapMicrosoftTeamsMessage({ ...source(), chatId: "chat-a", excerpt: "First delivery" });
  const replay = mapMicrosoftTeamsMessage({ ...source(), chatId: "chat-a", excerpt: "Replay with a corrected preview", receivedAt: "2026-09-01T14:05:00Z" });
  const update = mapMicrosoftTeamsMessage({ ...source(), chatId: "chat-a", excerpt: "Edited", externalVersion: "etag-2" });
  assert.equal(first.idempotencyKey, replay.idempotencyKey);
  assert.notEqual(first.idempotencyKey, update.idempotencyKey);
});
