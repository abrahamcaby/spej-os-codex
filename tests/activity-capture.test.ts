import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GtmActivityForm } from "../components/gtm-activity-form";
import { appendDictationNotes, createDictationSession, type DictationRecognition, type DictationResultEvent, type DictationSnapshot } from "../lib/activity-dictation";
import { ACTIVITY_MESSAGE_MAX_LENGTH } from "../lib/communication-history";
import type { AccountItem, ActivityItem, ContactItem } from "../lib/types";

class MockRecognition implements DictationRecognition {
  continuous = false;
  interimResults = false;
  lang = "";
  onresult: DictationRecognition["onresult"] = null;
  onerror: DictationRecognition["onerror"] = null;
  onend: DictationRecognition["onend"] = null;
  starts = 0;
  stops = 0;
  aborts = 0;
  startError: Error | undefined;
  start() { this.starts += 1; if (this.startError) throw this.startError; }
  stop() { this.stops += 1; }
  abort() { this.aborts += 1; }
}
const results = (...items: [string, boolean][]): DictationResultEvent => ({ results: items.map(([transcript, isFinal]) => ({ isFinal, 0: { transcript } })) });
function sessionSetup(maxLength = ACTIVITY_MESSAGE_MAX_LENGTH) {
  const recognition = new MockRecognition();
  const updates: DictationSnapshot[] = [];
  let creations = 0;
  const session = createDictationSession({ createRecognition: () => { creations += 1; return recognition; }, maxLength, onChange: (update) => updates.push(update) });
  return { recognition, updates, session, creations: () => creations };
}

test("dictation does not create a recognizer or start a microphone until requested", () => {
  const { recognition, session, creations } = sessionSetup();
  assert.equal(creations(), 0);
  assert.equal(recognition.starts, 0);
  session.start();
  session.start();
  assert.equal(creations(), 1);
  assert.equal(recognition.starts, 1);
  assert.equal(recognition.continuous, true);
  assert.equal(recognition.interimResults, true);
});

test("repeated final events do not duplicate text and revised interim text is separate", () => {
  const { recognition, session } = sessionSetup();
  session.start();
  recognition.onresult?.(results(["Call completed.", true], ["Discussed pilot", false]));
  recognition.onresult?.(results(["Call completed.", true], ["Discussed pricing", false]));
  assert.equal(session.getSnapshot().finalText, "Call completed.");
  assert.equal(session.getSnapshot().interimText, "Discussed pricing");
  recognition.onresult?.(results(["Call completed.", true], ["Discussed pricing.", true]));
  recognition.onresult?.(results(["Call completed.", true], ["Discussed pricing.", true]));
  assert.equal(session.getSnapshot().finalText, "Call completed. Discussed pricing.");
  assert.equal(session.getSnapshot().interimText, "");
});

test("stop permits a final transcript but never restarts recognition", () => {
  const { recognition, session } = sessionSetup();
  session.start();
  session.stop();
  session.stop();
  assert.equal(recognition.stops, 1);
  assert.equal(session.getSnapshot().status, "stopping");
  recognition.onresult?.(results(["Send a recap tomorrow.", true]));
  recognition.onend?.();
  assert.equal(session.getSnapshot().status, "ready");
  assert.equal(session.getSnapshot().finalText, "Send a recap tomorrow.");
  assert.equal(recognition.starts, 1);
});

test("permission denial gives a useful fallback and aborts the recognizer", () => {
  const { recognition, session } = sessionSetup();
  session.start();
  recognition.onerror?.({ error: "not-allowed" });
  assert.equal(session.getSnapshot().status, "error");
  assert.match(session.getSnapshot().error, /denied.*type, paste/);
  assert.equal(recognition.aborts, 1);
  assert.equal(recognition.onresult, null);
  assert.equal(recognition.onend, null);
});

test("synchronous browser denial is caught without throwing or recording", () => {
  const { recognition, session } = sessionSetup();
  recognition.startError = Object.assign(new Error("blocked"), { name: "NotAllowedError" });
  assert.doesNotThrow(() => session.start());
  assert.equal(session.getSnapshot().status, "error");
  assert.match(session.getSnapshot().error, /denied/);
});

test("cancel, save, and unmount disposal ignore even queued late results", () => {
  const { recognition, session, updates } = sessionSetup();
  session.start();
  const queuedResult = recognition.onresult;
  const queuedEnd = recognition.onend;
  const count = updates.length;
  session.dispose();
  session.dispose();
  queuedResult?.(results(["Do not save me", true]));
  queuedEnd?.();
  session.start();
  assert.equal(updates.length, count);
  assert.equal(session.getSnapshot().finalText, "");
  assert.equal(recognition.aborts, 1);
  assert.equal(recognition.starts, 1);
  assert.equal(recognition.onresult, null);
});

test("dictation is bounded and stops at the message limit with an explicit truncation flag", () => {
  const { recognition, session } = sessionSetup(12);
  session.start();
  recognition.onresult?.(results(["1234567890", true], ["too much text", false]));
  assert.equal(session.getSnapshot().finalText, "1234567890");
  assert.equal(session.getSnapshot().interimText, "to");
  assert.equal(session.getSnapshot().truncated, true);
  assert.equal(recognition.stops, 1);
  recognition.onresult?.(results(["1234567890 too much text", true]));
  assert.equal(session.getSnapshot().finalText.length, 12);
  assert.equal(recognition.stops, 1);
});

test("applying a transcript appends to the current typed notes, not a stale starting copy", () => {
  const notes = "Typed while dictation was running.\nNew detail.";
  const result = appendDictationNotes(notes, "  They asked for a pilot.  ", ACTIVITY_MESSAGE_MAX_LENGTH);
  assert.equal(result.applied, true);
  assert.equal(result.value, `${notes}\n\nThey asked for a pilot.`);
  assert.equal(appendDictationNotes("", "A clean note", 12).value, "A clean note");
});

test("overflow and empty dictation preserve all existing notes without partial insertion", () => {
  const notes = "x".repeat(ACTIVITY_MESSAGE_MAX_LENGTH - 1);
  const overflow = appendDictationNotes(notes, "This does not fit", ACTIVITY_MESSAGE_MAX_LENGTH);
  assert.equal(overflow.applied, false);
  assert.equal(overflow.value, notes);
  assert.match(overflow.error, /existing notes have not changed/);
  assert.equal(appendDictationNotes(notes, "  ", ACTIVITY_MESSAGE_MAX_LENGTH).value, notes);
  assert.equal(appendDictationNotes("", "x".repeat(ACTIVITY_MESSAGE_MAX_LENGTH), ACTIVITY_MESSAGE_MAX_LENGTH).applied, true);
});

const account = (id: string): AccountItem => ({ id, name: id, type: "Prospect", status: "Active", owner: "Aby", website: "", notes: "", createdAt: "2026-09-01T10:00:00Z" });
const person = { id: "person", name: "Demo Person", accountId: "new-account" } as ContactItem;
const activity: ActivityItem = { id: "activity", accountId: "old-account", contactId: person.id, channel: "Email", metricType: "Reply received", owner: "Aby", summary: "Their reply", outcome: "Original message", occurredAt: "2026-09-17", createdAt: "2026-09-17T12:00:00Z" };
function renderForm(patch: Partial<Parameters<typeof GtmActivityForm>[0]> = {}) {
  return renderToStaticMarkup(createElement(GtmActivityForm, { accounts: [account("old-account"), account("new-account")], contacts: [person], onSave: () => {}, onCancel: () => {}, ...patch }));
}

test("capture form keeps default pasted context, new messaging channels, and a 20,000-character limit", () => {
  const html = renderForm({ defaults: { outcome: "Message supplied by the person profile", contactId: person.id, accountId: "new-account" } });
  assert.match(html, /Message supplied by the person profile/);
  assert.match(html, /Text \/ SMS/);
  assert.match(html, /WhatsApp/);
  assert.match(html, /Outcome \/ context<textarea[^>]*maxLength="20000"/);
  assert.match(html, /Dictate notes \(optional\)/);
  assert.match(html, /dictation is unavailable in this browser/);
  assert.match(html, /browser or its speech provider may process audio online/);
});

test("person-profile editing locks historical account/person instead of moving old messages", () => {
  const html = renderForm({ initial: activity, lockPerson: true });
  assert.match(html, /Account<select disabled=""/);
  assert.match(html, /Person<select disabled=""/);
  assert.match(html, /<option value="old-account" selected="">old-account<\/option>/);
  assert.match(html, /<option value="person" selected="">Demo Person<\/option>/);
  assert.match(html, /does not move it to a person’s new company/);
});

test("source-backed activities retain the reviewed-evidence locks", () => {
  const html = renderForm({ initial: { ...activity, sourceArtifactId: "reviewed-meeting" } });
  for (const label of ["Captured from", "Channel", "Account", "Person"]) assert.match(html, new RegExp(`${label}<select disabled=""`));
  assert.match(html, /through the meeting intake review/);
});

test("archived or unavailable historical links remain visible instead of silently showing a new account", () => {
  const archived = renderForm({ initial: activity, lockPerson: true, accounts: [{ ...account("old-account"), archivedAt: "2026-09-18" }] });
  assert.match(archived, /<option value="old-account" selected="">old-account<\/option>/);
  const unavailable = renderForm({ initial: activity, lockPerson: true, accounts: [], contacts: [] });
  assert.match(unavailable, /<option value="old-account" selected="">Linked account \(unavailable\)<\/option>/);
  assert.match(unavailable, /<option value="person" selected="">Linked person \(unavailable\)<\/option>/);
});

test("explicit unknown dates render blank and editable notes do not demand an invented date", () => {
  const html = renderForm({ initial: { ...activity, occurredAt: "2026-09-17", sourceDateKnown: false } });
  const date = html.match(/<input type="date"[^>]*>/)?.[0] || "";
  assert.match(date, /disabled=""/);
  assert.match(date, /value=""/);
  assert.doesNotMatch(date, /required/);
  assert.match(html, /type="checkbox" checked=""/);
  assert.match(html, /does not update engagement dates or dated metrics/);
  assert.match(html, /Original message/);
});

test("legacy undated edits start with Original date unknown while known dates remain required", () => {
  const undated = renderForm({ initial: { ...activity, occurredAt: "", sourceDateKnown: undefined } });
  assert.match(undated, /type="checkbox" checked=""/);
  const known = renderForm({ initial: activity });
  const date = known.match(/<input type="date"[^>]*>/)?.[0] || "";
  assert.match(date, /required=""/);
  assert.match(date, /value="2026-09-17"/);
  assert.doesNotMatch(date, /disabled/);
  assert.doesNotMatch(known, /type="checkbox" checked=""/);
});

test("unknown source-backed dates stay locked to meeting evidence and source reference matches storage bounds", () => {
  const html = renderForm({ initial: { ...activity, sourceArtifactId: "reviewed-meeting", occurredAt: "", sourceDateKnown: false } });
  assert.match(html, /type="checkbox" disabled="" checked=""/);
  assert.match(html, /Source reference<input disabled="" maxLength="200"/);
});
