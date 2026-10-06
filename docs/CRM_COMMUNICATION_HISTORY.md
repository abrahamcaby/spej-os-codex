# CRM communication history

This feature is part of the standalone Spej OS preview. It records interactions; it does **not** send messages, place calls, record meetings, or connect external accounts.

## What is included

- **CRM → People → a person's name or View communication history** opens their profile and newest-first interaction stream.
- **Log interaction** records the channel, activity type, actual date, owner, summary, and Outcome / context. Channels include Email, Call, LinkedIn, Meeting, **Text / SMS**, and **WhatsApp**. Choose **Reply received** for a reply; do not classify an unanswered outbound message as engagement.
- **Outcome / context accepts up to 20,000 characters.** Paste relevant message excerpts or call notes. Longer entries expand with **Read full message / notes**. Separate exchanges should be separate activity records, rather than one repeatedly overwritten note.
- History supports search, channel filters, and loading more entries. The shared CRM Activity view also filters by account and person; account history uses the same timeline.
- **Add follow-up** creates a dated work item linked to the person. It does not schedule or send an email, text, or calendar invitation.
- Editing or archiving an interaction recalculates profile dates. Archiving removes it from active history, rather than deleting its stored record. Reviewed meeting evidence retains its existing source-review restrictions.

## What the dates mean

**Last outreach**, **Last reply**, and **Last conversation** are calculated from that person's active, dated interaction records—not the old manually entered Last contact value or when a message was imported. Outbound messages and attempted calls do not count as replies. Connected calls, held meetings, and completed substantive check-ins count as conversations.

**Next follow-up** is the earliest dated, open work item explicitly linked to the person, their active personal/coordinated nurture action, or their recorded next action. Past-due commitments remain visible as overdue. Completed work, hidden/orphaned subtasks, paused nurture, and campaign-only nurture do not create an inferred personal follow-up.

The original activity date stays separate from the capture timestamp. Choose **Original date unknown** when it cannot be verified: the entry stays in history with no invented date and is excluded from engagement clocks and dated metrics. Older undated entries can be edited without supplying a fabricated date. Unticking this option leaves the date blank for you to enter; it does not default to today. Source-backed records keep their reviewed-evidence restrictions. Unknown or future dates do not make engagement look recent. Dates are day-level; this is not yet a precise within-day message chronology. Older profile contact dates remain visible as historical reference, not verified outreach or replies.

A person's history follows their identity if they change companies. Each earlier interaction keeps its original account; editing from the profile locks the person and historical account to avoid moving old messages to the new company.

## Optional dictation

Expand **Dictate notes (optional)**, read the disclosure, and choose **Start dictation**. Nothing opens the microphone automatically. Browser support varies, and the browser or its speech provider may process audio online. Spej OS does not store audio recordings.

Choose **Stop dictation**, review or edit the confirmed transcript, then **Apply to notes**. Applying appends to the current notes; it does not replace typed text or save the activity. If the combined text would exceed 20,000 characters, it is not applied and the existing notes remain unchanged. Review/discard unapplied dictation before saving. Canceling or leaving the form aborts recognition and ignores late results.

Typing, pasting, and device keyboard dictation remain alternatives when in-app dictation is unavailable or permission is denied. Selecting **Voice transcript** in Captured from is only a provenance label; it does not activate a microphone or grant permissions.

## Demo walkthrough

1. Open **CRM → People**, then a demo person's communication history.
2. Log a LinkedIn **Outreach sent** interaction with an actual date and a brief message excerpt.
3. Log an Email **Reply received** interaction on its actual date, then a Call **Call connected** interaction. Add a **Text / SMS** follow-up as another entry.
4. Show the combined stream and separate outreach/reply/conversation dates. Search the notes, filter to one channel, and expand a longer entry.
5. Add a dated follow-up and open its work item. Return to the person's profile and edit an interaction to demonstrate recalculation.
6. Optionally demonstrate dictation only with the presenter's informed consent. The demo can be completed entirely by typing or pasting.

Use synthetic information during demos. The temporary company-demo workspace is not a permanent CRM or production backup.

## Engineering boundary

Outlook/email, Teams, LinkedIn, texts, and WhatsApp are **not automatically synced**. Channel labels and source references are manual metadata, not proof of an integration. Real connectors still need authenticated permissions, provider-specific access, stable message IDs and deduplication, person/account matching, provenance, sync/error status, and approved retention policies. Browser dictation is separate from Microsoft/Plooms integration.

The existing preview permission filtering and persistence boundaries remain in place. Production authentication, authorization on every read/write, shared storage, and connector hardening are still engineering work. This feature must not be treated as a compliance archive or a production-ready multi-user CRM.

Key implementation files: `lib/communication-history.ts`, `components/person-communication-profile.tsx`, `components/communication-timeline.tsx`, `components/gtm-activity-form.tsx`, `components/activity-dictation.tsx`, and `lib/activity-dictation.ts`.
