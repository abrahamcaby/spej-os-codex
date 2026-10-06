# Spej GTM: navigation and measurement handoff

## Quick overview

This adds a sales-and-marketing workspace to the foundations of Spej OS—not a replacement for the company system. Its layout intentionally follows how Aby and Sagar work: relationships, a clear next action, content, and measurable results. Preserve that workflow when connecting it to Spej OS; other teams can keep their existing screens and processes.

- **Three offerings:** AI Office, Plooms, and Client projects.
- **Inputs next to results:** outreach and publishing alongside replies, audience, leads, meetings, and opportunities.
- **One shared record:** activities logged in CRM or Metrics use the same data. SOSA proposes changes to those same records for review.
- **Reuse the existing SOSA:** connect Spej OS’s agent to the model-independent GTM capabilities. The standalone pilot chat is replaceable; this is not a request to rebuild the company agent. See [the SOSA integration note](SOSA_INTEGRATION.md).
- **Current status:** functional local pilot. Spej OS sync, company sign-in, Teams, and platform analytics connections still require implementation.

## Where work belongs

| Section | Purpose |
| --- | --- |
| My Work | What needs attention for the signed-in person across authorized workspaces. |
| SOSA | Ask questions and review proposed record updates. Not another database. |
| CRM | Company-wide accounts, people, clients, relationship activity, and follow-ups; sales pipeline and partner views use the same records. |
| Marketing & Content | Personal LinkedIns, Spej authority content, and coordinated campaigns. |
| GTM Work | Tasks, subtasks, deadlines and priorities; GTM initiatives and client-project handoff context. |
| GTM Metrics | Scorecard: Overview, Prospecting, Marketing & Content, Sources & Data; public Audience source tracker. |
| Intelligence | Industry news, newsletters, identity-matched mentions, and saved research. |

**Keep classifications separate.** Offering = what we sell. Sales route = Direct, Partner-sourced, or Co-sell. Partner category = Affiliate/referrer, MSP, IT services provider, etc. Acquisition motion = Inbound, Outbound, Network, Referral, Event, Partner, or Unclassified. Source = the specific channel or introduction; never infer missing historical origins. An MSP can bring either an AI Office or a Plooms opportunity. Client projects use Discovery, Design, and Delivery phases; these do not replace commercial sales stages. Legacy MSP/Partner classifications remain available for review; they are not a fourth offering.

Plooms is Spej’s private, open-weight AI platform/harness. Its public site describes chat, creation tools, connectors and a temporal knowledge graph. Product positioning checked against [plooms.ai](https://plooms.ai) on August 31, 2026; this is not an independent verification of its security or capabilities.

## How measurement works

| Measure | Rule |
| --- | --- |
| Outreach | One completed outgoing message, follow-up, outbound call or connection request = one attempt. Unique people uses linked contact IDs. |
| Calls | Log attempted **or** connected, not both. A connected outbound call also counts as one attempt. |
| Meetings | Booked, held, cancelled and no-show are separate dated events. A calendar booking is not evidence that a meeting happened. |
| People and leads | New contacts are not automatically leads. Lead totals require the date relevant interest was first recorded. |
| Publishing | Published content with an actual publish date. One record = one item; create separate items for separate published assets. |
| Channel results | Monthly totals per platform account/report: posts, views, engagement, audience, gross new followers/subscribers, leads and attributed bookings. |
| Pipeline and wins | New opportunities by creation date; wins by recorded close date. Current open pipeline is labeled separately from historical monthly events. |

Calculations run in code, not an LLM. Re-saving the same month + metric + source replaces its previous total. Missing readings say **Not recorded**, not zero. Rates remain source-specific. Published-content totals are not added to platform-reported publishing totals. We do not infer conversion rates or causation from unrelated monthly counts. Archived CRM/activity records are excluded; archive is not a historical closure action.

The Sources & Data view exposes missing dates, unclassified activities and unlinked outreach. Older records are preserved without inventing history. CRM lifecycle and deal values reflect their current saved state; the pilot does not reconstruct historical stage changes or prospect cohorts.

## Integration notes for Spej IT

Provide a **private GitHub repository** containing source, lockfile, tests and this guide—not the local database, exports, OAuth tokens or provider keys. Start with `npm run launch`; validate with `npm run check` and `npm run smoke`. Existing query-string routes remain compatible. The app currently uses Next.js and local SQLite with a whole-workspace save endpoint; it is not yet a multi-user service.

Reuse the existing Spej OS identity, permissions and canonical CRM IDs. Keep the GTM interface while replacing the local persistence boundary with approved Spej OS record APIs. Decide field ownership and conflict handling before enabling two-way sync. Use stable provider event IDs, replay-safe updates, and an audit trail so Outlook/Teams or analytics retries cannot double-count.

New optional fields are backward-compatible: contact `lifecycleStage` / `leadDate`; contact and opportunity `acquisitionMotion`; activity `metricType` / `owner` / `campaignId`; opportunity `salesRoute` / `partnerAccountId` plus the `Plooms` motion; partnership `partnerCategory`. Monthly metrics use `period`, `metricKey`, `source`, `value`, `updatedAt`. Definitions live in `lib/gtm-metrics.ts`, `lib/marketing-metrics.ts` and `lib/gtm-navigation.ts`.

**Before company deployment:** connect authenticated, permission-checked record operations; multi-user storage/conflict protection; secrets management; backups; and audited integration workers. Reuse Spej OS’s existing services where available. The current localhost boundary must not simply be removed. Prefer connecting the existing SOSA, keeping its model and tools; a cloud-model URL is not an agent integration, and the pilot’s local-model setting accepts loopback endpoints only. SOSA-in-Teams and mobile should use the same governed operations and user permissions. These are planned connections to GTM, not features this handoff claims are already live.

## Verification — September 2, 2026

On the required Node 24.19 runtime, lint, the full automated test suite, strict TypeScript, the production build, and the isolated launcher smoke test passed at handoff. Browser checks covered the five primary workspaces, account/client/person views, opportunity Priority Intelligence, project portfolio, two content workspaces, GTM metrics, Microsoft/SOSA integration disclosure, reviewed meeting intake, and mobile layout at 390px. Test records stayed in an isolated temporary workspace. The new identity, canonical-record, SOSA-authorization, Microsoft-mapping/action, integration-event, and production-environment modules are contract-tested references; no live company identity, Microsoft tenant, production SOSA, or canonical Spej OS connection was exercised. This is a local-pilot verification, not company security certification or deployment approval.

## SOSA boundary and safety

The standalone pilot receives bounded recent conversation context, the first 300 active records per collection, and deterministic totals for the latest three calendar months. Proposals show actual normalized field changes, including cleared values, and are rejected if the local workspace has changed. Ambiguous names, invalid classifications, missing links, unauthorized archive changes, and unsafe task completion are checked in code. This snapshot guard is not multi-user concurrency control. Conversation survives tab navigation but resets on reload. Live news, inbox, social publishing and Teams are not tools connected to this pilot; this is not a claim about capabilities already present in Spej OS’s existing SOSA.
