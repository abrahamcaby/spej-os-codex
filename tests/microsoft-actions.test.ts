import assert from "node:assert/strict";
import test from "node:test";
import { cleanMicrosoftExternalActionDraft } from "../lib/integrations/microsoft";

test("Outlook actions expose exact recipients and final text for later approval", () => {
  const draft = cleanMicrosoftExternalActionDraft({
    kind: "outlook.send",
    to: [{ emailAddress: "PERSON@EXAMPLE.COM", displayName: "Example Person" }],
    subject: "Next step",
    bodyText: "Here is the agreed next step.",
  });
  assert.equal(draft.kind, "outlook.send");
  if (draft.kind !== "outlook.send") return;
  assert.equal(draft.to[0].emailAddress, "person@example.com");
  assert.equal(draft.subject, "Next step");
});

test("Teams action destinations are explicit and mutually exclusive", () => {
  assert.throws(() => cleanMicrosoftExternalActionDraft({ kind: "teams.send", bodyText: "Update" }), /exactly one/);
  assert.throws(() => cleanMicrosoftExternalActionDraft({ kind: "teams.send", channelId: "channel-1", chatId: "chat-1", bodyText: "Update" }), /exactly one/);
  const draft = cleanMicrosoftExternalActionDraft({ kind: "teams.send", teamId: "team-1", channelId: "channel-1", bodyText: "Update" });
  assert.equal(draft.kind, "teams.send");
});

test("calendar updates require target versions while creates require complete timing", () => {
  assert.throws(() => cleanMicrosoftExternalActionDraft({ kind: "calendar.write", change: "update", subject: "Review", startsAt: "2026-09-03T10:00:00Z", endsAt: "2026-09-03T10:30:00Z" }), /eventExternalId and expectedExternalVersion/);
  assert.throws(() => cleanMicrosoftExternalActionDraft({ kind: "calendar.write", change: "create", subject: "Review", startsAt: "2026-09-03T10:30:00Z", endsAt: "2026-09-03T10:00:00Z" }), /must be after/);
  const cancel = cleanMicrosoftExternalActionDraft({ kind: "calendar.write", change: "cancel", eventExternalId: "event-1", expectedExternalVersion: "etag-2", cancellationMessage: "This meeting is cancelled." });
  assert.equal(cancel.kind, "calendar.write");
});

test("SharePoint writes are reference-and-version metadata updates, not file uploads", () => {
  const draft = cleanMicrosoftExternalActionDraft({ kind: "sharepoint.write", change: "update-metadata", siteId: "site-1", driveId: "drive-1", itemId: "item-1", expectedExternalVersion: "etag-1", title: "Updated title" });
  assert.equal(draft.kind, "sharepoint.write");
  assert.throws(() => cleanMicrosoftExternalActionDraft({ kind: "sharepoint.write", change: "upload", siteId: "site-1", driveId: "drive-1", itemId: "item-1", expectedExternalVersion: "etag-1", content: "file body" }), /credential-like|not an accepted field|must be update-metadata/);
});

test("credential fields and oversized external content fail before approval", () => {
  assert.throws(() => cleanMicrosoftExternalActionDraft({ kind: "outlook.send", to: [{ emailAddress: "person@example.com", accessToken: "unsafe" }], subject: "Hello", bodyText: "Body" }), /credential-like/);
  assert.throws(() => cleanMicrosoftExternalActionDraft({ kind: "teams.send", chatId: "chat-1", bodyText: "x".repeat(8_001) }), /between 1 and 8000/);
});
