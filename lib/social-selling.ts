import type { AccountItem, ActivityItem, ContactItem, SocialActionType } from "./types";
import { PERSONAL_CONTENT_PILLARS } from "./content-taxonomy";

export const MAX_FOCUS_ACCOUNTS = 5;
export const MAX_FOCUS_CONTACTS_PER_ACCOUNT = 3;

export const SOCIAL_ACTION_TYPES: SocialActionType[] = [
  "Comment", "Connect", "DM", "Video / audio DM", "Profile review", "Share resource", "Other",
];

export const CONTENT_PILLARS = PERSONAL_CONTENT_PILLARS;

export const DAILY_SOCIAL_HABITS = [
  { title: "Publish or advance one useful LinkedIn post", description: "Create from a whole-person pillar or move a draft closer to publish." },
  { title: "Leave 5 meaningful comments", description: "Add specific, human perspective to posts from prospects or people in your market." },
  { title: "Respond to comments on Spej content", description: "Continue the conversation with everyone who engaged." },
  { title: "Review relevant profile viewers", description: "Look for credible relationship signals; do not scrape or mass-connect." },
  { title: "Follow up on open LinkedIn conversations", description: "Bring new value instead of sending a generic check-in." },
  { title: "Message new people who engaged with Spej content", description: "Send a relevant, low-friction, human-written note when appropriate." },
] as const;

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function socialSellingProgress(accounts: AccountItem[], contacts: ContactItem[], activities: ActivityItem[], now = new Date()) {
  const focusedAccounts = accounts.filter((item) => item.focus531 && !item.archivedAt);
  const focusedAccountIds = new Set(focusedAccounts.map((item) => item.id));
  const focusedContacts = contacts.filter((item) => item.focus531 && !item.archivedAt && focusedAccountIds.has(item.accountId));
  const today = localDate(now);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - 6);
  const startDate = localDate(start);
  const relevant = activities.filter((item) => !item.archivedAt && item.channel === "LinkedIn 5-3-1" && focusedAccountIds.has(item.accountId));
  return {
    focusedAccounts,
    focusedContacts,
    completedContactIdsToday: new Set(relevant.filter((item) => item.occurredAt === today && item.contactId).map((item) => item.contactId)),
    activeDaysThisWeek: new Set(relevant.filter((item) => item.occurredAt >= startDate && item.occurredAt <= today).map((item) => item.occurredAt)).size,
  };
}
