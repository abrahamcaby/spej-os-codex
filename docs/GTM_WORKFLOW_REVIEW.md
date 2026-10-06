# Spej GTM workflow review

## The product logic

One workspace, several useful views—not competing CRMs or project systems. The interface intentionally supports Aby and Sagar’s sales-and-marketing motion while leaving company-wide delivery, tickets and other teams’ workflows in Spej OS.

| Area | Owns |
| --- | --- |
| My Work | Cross-workspace attention for the signed-in person: due work, follow-ups, decisions and reviews. |
| SOSA | Conversational proposals to the same records, with review before saving. |
| CRM | Company-wide accounts, people, clients, relationship activity, and follow-ups; linked sales and partner views use the same records. |
| Marketing & Content | Campaigns and individual media pieces; separate Personal LinkedIns and Spej authority categories. |
| GTM Work | Tasks and subtasks with owners, deadlines and priorities; broader initiatives and client handoff context. |
| GTM Metrics | Effort, response, outcomes, channel totals and public audience source readings. |
| Intelligence | News, newsletters, relevant mentions and saved evidence that inform the work. |

An opportunity is a possible sale, not every contact. A campaign coordinates an audience and objective. A content item is one media asset. A task is a commitment. An initiative coordinates broader milestones. Link these records rather than recreating the same work in each area.

## Fixes in this review

- Removed the unrelated product from application classifications and documentation without deleting saved business records.
- Distinguished acquisition origin, channel detail, offering, sales route and partner category. New origins remain Unclassified until supplied.
- Added account/person editing and source filters; existing IDs and history stay intact.
- Added content editing, personal LinkedIn format defaults, actual publication-date checks and linked production tasks.
- Added task editing and rescheduling without losing content links or subtask relationships.
- Added acquisition scorecards; kept recorded inputs, outcomes and monthly platform totals distinct.
- Moved own-channel audience readings under Metrics, rather than implying they monitor followed people’s posts.
- Added contextual SOSA entry points and an in-app usage/demo guide. Improved 5-3-1 and personal-content navigation.
- Kept LinkedIn Focus inside GTM as a 5-3-1 action queue over the shared CRM accounts and people, rather than presenting it as a separate CRM database.
- Added conversation context and safeguards against stale proposals, ambiguous identities, invalid values, broken links, hidden field clears and task-completion bypasses.

## Five-minute demo

1. Start in My Work: show the role-relevant attention queue.
2. Capture a person and their origin in CRM; add a real interaction and follow-up.
3. Create a specific opportunity: AI Office, Plooms or Client projects. Show next Spej action and customer decision.
4. Open Content studio: idea → production → review → publication; link a task assigned to Ken.
5. Open Metrics: show the work inputs, observed responses, and business outcomes. Use Sources & Data to explain missing coverage.
6. Ask SOSA to prepare the equivalent changes. Review the exact fields before approval; a connected model is required.

## Most valuable next work—not claimed as complete

1. **Capture activity automatically:** approved Outlook/Teams and inbound-form connections, with stable event IDs and duplicate protection. Do not duplicate CRM entries from retries.
2. **Connect the existing SOSA:** give Spej OS’s agent the GTM capabilities through the [shared integration contract](SOSA_INTEGRATION.md), reusing company permissions and audit services. Its existing conversation, model and other tools stay in place; Teams and mobile can use those same capabilities.
3. **Improve intelligence targeting:** a true followed-person/source watchlist and saved research retrieval for SOSA. CRM LinkedIn links are not automatic post monitoring.
4. **Strengthen measurement history:** stage-change history, campaign-to-lead attribution and agreed goals. Monthly counts alone do not establish conversion rates or which post caused a deal.
5. **Company deployment:** Spej sign-in/roles, record-level APIs, canonical Spej OS IDs, multi-user conflict handling, secret management and tested backups. The current local whole-workspace save must not simply be exposed to the network.

Provide the source, tests and these notes through a private GitHub repository, excluding local databases, exports and credentials. Preserve the intentional GTM interface while replacing its local persistence boundary with Spej OS services. See GTM_METRICS_HANDOFF.md for integration and verification details.
