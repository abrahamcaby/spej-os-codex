import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanMicrosoftCalendarEventInput,
  cleanMicrosoftMeetingTranscriptInput,
  cleanMicrosoftOutlookMessageInput,
  cleanMicrosoftSharePointReferenceInput,
  cleanMicrosoftTeamsMessageInput,
} from "../lib/integrations/microsoft";

const source = () => ({
  tenantId: "spej-tenant",
  externalId: "graph-item-1",
  externalVersion: "etag-1",
  occurredAt: "2026-09-01T14:00:00Z",
  receivedAt: "2026-09-01T14:00:05Z",
  sourceUrl: "https://www.microsoft.com/item/1",
});

test("Teams inputs require one bounded conversation scope", () => {
  assert.throws(() => cleanMicrosoftTeamsMessageInput(source()), /exactly one channelId or chatId/i);
  assert.throws(() => cleanMicrosoftTeamsMessageInput({ ...source(), channelId: "channel-a", chatId: "chat-a" }), /exactly one/i);
  assert.throws(() => cleanMicrosoftTeamsMessageInput({ ...source(), teamId: "team-a", chatId: "chat-a" }), /only valid with channelId/i);
  const cleaned = cleanMicrosoftTeamsMessageInput({ ...source(), teamId: "team-a", channelId: "channel-a", excerpt: "  Update posted.  " });
  assert.equal(cleaned.excerpt, "Update posted.");
});

test("Microsoft inputs reject credential material even when nested in a person", () => {
  assert.throws(() => cleanMicrosoftTeamsMessageInput({
    ...source(),
    chatId: "chat-a",
    author: { externalId: "user-a", accessToken: "not-accepted" },
  }), /credential-like fields/i);
  assert.throws(() => cleanMicrosoftOutlookMessageInput({
    ...source(),
    direction: "inbound",
    bearerToken: "not-accepted",
  }), /credential-like fields/i);
});

test("calendar and transcript contracts validate temporal ranges and source bounds", () => {
  assert.throws(() => cleanMicrosoftCalendarEventInput({
    ...source(),
    startsAt: "2026-09-01T15:00:00Z",
    endsAt: "2026-09-01T14:59:00Z",
  }), /must be after startsAt/i);
  assert.throws(() => cleanMicrosoftMeetingTranscriptInput({
    ...source(),
    meetingId: "meeting-a",
    transcriptText: "x".repeat(200_001),
  }), /between 1 and 200000/i);
});

test("SharePoint accepts only a dereferenceable file reference, never file content", () => {
  assert.throws(() => cleanMicrosoftSharePointReferenceInput({
    ...source(),
    siteId: "site-a",
    driveId: "drive-a",
    fileName: "plan.docx",
    content: "The entire file should not cross this boundary.",
  }), /not an accepted field/i);
  const withoutUrl = source();
  Reflect.deleteProperty(withoutUrl, "sourceUrl");
  assert.throws(() => cleanMicrosoftSharePointReferenceInput({
    ...withoutUrl,
    siteId: "site-a",
    driveId: "drive-a",
    fileName: "plan.docx",
  }), /sourceUrl.*required/i);
});
