# CRM accounts, people and relationship follow-ups

## What changed

CRM has three primary views over one record system:

- **Accounts** are organizations. An account may be a prospect, client, partner, network organization, or another company type. Opening an account shows its source, linked people, open deals, project history, follow-up plan, activity, and meeting sources.
- **People** are individual contacts. A person normally links to a primary account. A temporary unlinked option remains for genuinely independent people or incomplete intake; those records are visible in **Needs account linking**.
- **Activity** records meetings, calls, messages, referrals, events, and completed LinkedIn actions. It is history, not another lead or deal list.

Current clients, past clients, open deals, prospecting, partners/network, follow-ups due, and records needing attention are account filters rather than separate databases. LinkedIn Focus is a GTM 5-3-1 workflow over the same accounts, people, tasks, and activity; it is not a CRM record type.

Source is intentionally recorded at three levels. **Account origin** explains how the organization entered CRM. **Person source** explains how that individual connection began. **Opportunity source** explains what generated a specific buying conversation. They may be different and must not overwrite one another.

- Client status is explicit: Unclassified, Not a client, Current client or Past client. Old “Client” records are flagged for classification, not guessed from their Active/Inactive setting.
- Partner role is independent. Existing partner types and partnership history remain visible alongside an optional additional partner marker.
- Account history brings together people, buying conversations, project handoffs, completed work, notes and recent activities. Contact lifecycle, relationship strength and original source remain unchanged.
- An optional initial person can be created with a new account. The person is linked to that account while keeping a distinct person-source value. Existing accounts may also record the originating person and referrer.
- Completing one project never automatically changes client status. New Past-client classifications are rejected while known contracted project handoffs remain open. A current client may have other services in Spej OS even with no local project.

## Relationship care

Plans are opt-in: one-time, or every 30/60/90 calendar days. Set an owner, optional person, reason and first date or confirmed last contact. One-time plans require a date. An explicit next date takes precedence until a meaningful conversation happens on or after it.

The dashboard calculates reminders instead of creating duplicate recurring tasks. My Work includes overdue check-ins and the next seven days. “Check-in completed,” or a held meeting/connected call explicitly marked as client or partner care, advances the rhythm. An unanswered message, booking log, cancellation, no-show or profile view does not. Completed one-time check-ins are labeled completed. A seven-day deferral changes the next review date; it does not record contact.

“No proactive outreach” pauses routine prompts only. Explicit promises and task deadlines remain. An explicitly confirmed meeting within seven days can cover a check-in due on/before that meeting; a selected relevant open task can also cover the routine reminder. Unrelated tasks and undated booking logs do not suppress it. No messages are sent, and this does not configure background notifications or calendar sync.

## Metrics and SOSA

Activity purpose distinguishes **Business development**, **Client relationship** and **Partner relationship**. Client/partner care remains in history and has separate activity totals; it does not inflate prospecting. An existing client's new buying conversation may still be business development. Legacy unclassified purposes retain their historical counting behavior, with a visible disclosure and edit path; they are not relabeled as confirmed prospecting.

Existing SOSA can use the same validated proposal functions to create or update linked accounts and people, preserve the separate source levels, set client status, maintain a follow-up plan, and log confirmed activity. It may not fabricate an account for an unknown organization or invent trusted source evidence. Context includes deterministic client counts and the first 100 routine follow-ups due within seven days. No model is needed to calculate dates, filter views, enforce links, or count metrics. See [SOSA integration](SOSA_INTEGRATION.md).

## Spej OS handoff

Map these optional GTM fields onto canonical Spej OS account IDs. Map contacts, opportunities, project handoffs and known ongoing engagements before applying lifecycle rules. Keep Spej OS's authoritative customer/service state and permissions; do not infer all services ended from a local project snapshot. Planned meeting dates and covering task IDs need a canonical source and cancellation/completion reconciliation when calendar/task integrations are added.

The pilot stores the new fields through its existing workspace persistence. No database schema migration or automatic reclassification of the user's records is performed. Existing plan inconsistencies remain reviewable and do not block unrelated SOSA edits; a proposal cannot introduce a new contradiction behind an old one.

## Verification

Locally verified at handoff with the full automated test suite, lint, a production build and an isolated startup smoke test. Tests include rendered client views, reminder logic, persistence and the SOSA proposal contract. Live Spej OS, SOSA, Teams and calendar connections still require integration and testing with the tech team.
