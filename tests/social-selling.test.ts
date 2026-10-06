import assert from "node:assert/strict";
import test from "node:test";
import type { AccountItem, ActivityItem, ContactItem } from "../lib/types";
import { DAILY_SOCIAL_HABITS, localDate, socialSellingProgress } from "../lib/social-selling";

const account = (id: string, focus531 = false): AccountItem => ({ id, name: id, type: "Prospect", status: "Active", owner: "Aby", website: "", notes: "", focus531, createdAt: "2026-08-01T00:00:00Z" });
const contact = (id: string, accountId: string, focus531 = false): ContactItem => ({ id, accountId, name: id, title: "", email: "", linkedinUrl: "", buyingRole: "Decision Maker", focus531, nextActionType: "Comment", nextAction: "", nextActionDue: "", relationshipStrength: "New", source: "LinkedIn 5-3-1", lastContact: "", notes: "", createdAt: "2026-08-01T00:00:00Z" });
const activity = (id: string, accountId: string, contactId: string, occurredAt: string): ActivityItem => ({ id, accountId, contactId, channel: "LinkedIn 5-3-1", actionType: "Comment", summary: "Thoughtful comment", outcome: "", occurredAt, createdAt: `${occurredAt}T12:00:00Z` });

test("socialSellingProgress only counts selected accounts and people", () => {
  const result = socialSellingProgress([account("focus", true), account("other")], [contact("selected", "focus", true), contact("not-selected", "focus"), contact("wrong-account", "other", true)], [activity("a", "focus", "selected", "2026-08-27"), activity("b", "other", "wrong-account", "2026-08-27")], new Date(2026, 7, 27, 12));
  assert.deepEqual(result.focusedAccounts.map((item) => item.id), ["focus"]);
  assert.deepEqual(result.focusedContacts.map((item) => item.id), ["selected"]);
  assert.deepEqual([...result.completedContactIdsToday], ["selected"]);
});

test("socialSellingProgress reports unique active days in the trailing week", () => {
  const result = socialSellingProgress([account("focus", true)], [contact("person", "focus", true)], [activity("a", "focus", "person", "2026-08-27"), activity("b", "focus", "person", "2026-08-27"), activity("c", "focus", "person", "2026-08-24"), activity("old", "focus", "person", "2026-08-19")], new Date(2026, 7, 27, 12));
  assert.equal(result.activeDaysThisWeek, 2);
});

test("daily rhythm has six distinct human-led habits", () => {
  assert.equal(DAILY_SOCIAL_HABITS.length, 6);
  assert.equal(new Set(DAILY_SOCIAL_HABITS.map((item) => item.title)).size, 6);
  assert.equal(localDate(new Date(2026, 7, 7, 12)), "2026-08-07");
});
