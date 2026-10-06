# Agentic CRM recommendations for Spej OS

Reviewed September 21, 2026. **Engineering plan, not implemented features.** This documentation update introduces no runtime changes, source imports, dependencies, credentials, live connectors, automated sends or production deployment.

## Decision and relationship to the existing blueprint

Keep Spej OS as a standalone company operating system. Adapt selected patterns from Comp AI CRM into the existing canonical records and SOSA experience; do not install a second CRM or replace the application stack.

This is the current CRM prioritization addendum to the [Agentic Spej OS blueprint](AGENTIC_SPEJ_OS_BLUEPRINT.md), not a competing architecture. Retain its evidence, approval, identity, job and audit controls. The standalone direction in [GitHub handoff](GITHUB_HANDOFF.md) supersedes older wording requiring reuse of the existing production Spej OS or SOSA services: they are optional integration targets, not mandatory dependencies. The existing production repository remains out of scope.

Keep the experience compact: **CRM → Outreach** for working through accounts, with contextual SOSA and details on demand. Do not add another top-level dashboard, employee-specific product, or hard-coded GTM plan.

## Source and inspection boundary

Reviewed [trycompai/crm](https://github.com/trycompai/crm) on its default release branch at [commit 6d4793dd6d7aeea91aa6a034e00b17d7408a2d08](https://github.com/trycompai/crm/tree/6d4793dd6d7aeea91aa6a034e00b17d7408a2d08), package version 1.15.3. Source inspection only: the upstream application and dependencies were not installed or executed. This is not a complete security audit, performance test or production acceptance result.

Spej baseline: application commit `8e9f27caaff96037f043d5f1b8bef6e53d959ea4`, now included in main through PR #5. No private prospect records, transcripts or outreach source packages are included in this document.

## Already present versus still to build

| Area | Current preview | Remaining work |
| --- | --- | --- |
| Relationship records | Shared account/person/activity IDs, sourced facts, introduction paths, reviewed AI readiness/maturity, personal versus campaign nurture and holds | Production identity, shared durable data and server-enforced record/source access |
| Communication history | Manual multichannel logging; distinct outreach, reply and conversation dates; linked follow-up tasks | Approved provider ingestion, reconciliation and source-access revocation |
| SOSA | Bounded recent chat and reviewed proposal contracts | Persistent account-scoped conversations and retrieval, durable proposal/audit storage |
| Connections and custom AI | Settings planning and tested server extension/readiness boundaries | Registered Microsoft/Plooms/other provider adapters, actual sign-in/sync and operational controls |
| CRM Outreach and background work | Design only | Account-by-account Outreach view and durable bounded agent workers |

See [CRM history](CRM_COMMUNICATION_HISTORY.md), [Connections](CONNECTIONS_AND_INTEGRATIONS.md), [Custom Background AI](CUSTOM_BACKGROUND_AI.md) and [Production architecture](PRODUCTION_ARCHITECTURE.md). Interface contracts and demo persona selection are not live integrations or authentication. A custom background-text adapter does not automatically provide an autonomous tool-calling runtime.

## Worth adopting, with adaptation

| Pattern | Spej application | Priority |
| --- | --- | --- |
| Durable record-scoped conversations | Bind account/person/opportunity and authenticated user outside model text; retrieve the relevant authorized history and preserve reviewed drafts | First agent improvement |
| Evidence and change ledger | Show source, original date, old/new value, authorship, review decision and revision; remember corrections and dismissals | Alongside proposals |
| Mailbox ingestion/threading/deduplication | Feed the existing communication history using provider IDs and canonical record links, initially read-only | After identity/storage |
| Leased, bounded background jobs | Persist reasons, leases, retries, cancellation, idempotency, run/action receipts and visible failures | After durable worker infrastructure |
| Capability-aware planning | Explain missing access or stale coverage; ask only for the missing context; never treat a stored key as a working connection | Across all phases |
| Versioned agent/playbook definitions | A few reusable, approved recipes with explicit tool/resource/action scopes | Later; no generic builder initially |

Keep conversation exports and business context provider-neutral. Upstream continuation/session tokens are runtime-specific; copying their database rows alone will not transfer active agent sessions to Plooms.

## Do not import unchanged

- **The whole stack:** Next/Nest/eve/Prisma/Postgres/Bun/Turborepo would introduce competing runtime and data ownership. No framework switch is needed to build Outreach.
- **Blank-field auto-promotion:** the upstream fact writer can apply a retained fact when verified *or* when the target is blank. Blank does not mean proven. Its fixed evidence weights are not calibrated probabilities. Keep qualification, readiness, commitments, ownership, opt-outs and nurture eligibility reviewed; deduplicate independent evidence before combining signals.
- **Record-access assumptions:** some upstream agent/connection operations have role controls, but core contact and conversation reads do not replace Spej's required user-, record- and source-level authorization.
- **Provider defaults/fallbacks:** preserve approved custom providers and no unapproved fallback. Validate the actual tool-calling, usage and execution contract separately.
- **Automatic outreach or arbitrary tools:** copy is not send; approval of a recipe is not permission for unlimited sends, shell execution or research. Enforce per-run and aggregate monetary limits, not only vendor-call counts.
- **Upstream telemetry defaults and cosmetic enrichment:** do not inherit third-party destinations or enable paid research, tracking, portraits or logos by accident. Prioritize correct records and next actions.

## Microsoft: useful email patterns, not the entire suite

The inspected implementation includes read-only Outlook mail ingestion, token/reconnect handling, original dates, thread links and duplicate/suppression handling. Initial synchronization starts from a forward cursor rather than importing historical mail. Define a bounded, explicitly approved backfill when earlier history is needed.

The Microsoft scopes include mail read access, not Outlook calendar access; its separate Google Calendar implementation is not an Outlook calendar integration. Teams, SharePoint, OneDrive, Granola and Plaud still need provider-specific adapters, consent and source-permission handling.

Before adoption, test tied timestamps/cursors, duplicate messages across mailboxes, edits/deletions, safe continuation URLs, bounded backfill, revoked access and suppression. No source inspection result substitutes for these tests in Spej.

## Phased implementation and acceptance checklist

### 1. Focused CRM Outreach

Choose account → update context → review one next action → review/copy draft and attachment reference → log actual outcome → next account.

- [ ] Reuse existing account/person/task/activity IDs; never create a parallel CRM.
- [ ] Preserve an immutable playbook baseline and versioned working drafts; allow changing plans and different employees.
- [ ] Keep prospects, clients, partners, closed records, programs and unresolved identities distinct.
- [ ] Honor replies, holds, agreed dates, introduction handoffs and promised work before suggesting another chase.
- [ ] Copying a draft does not record a send or advance last-contact dates.
- [ ] Create/update one canonical follow-up task visible in My Work; do not duplicate reminders.
- [ ] Test permission boundaries, ambiguous identity, empty/missing context and edits made by another person.

### 2. Account-scoped SOSA and reviewed evidence

- [ ] Persist conversations and authorized account context beyond navigation/restarts; do not depend on a first slice of workspace records.
- [ ] Make draft adaptation explicit, with source-linked proposed changes and preserved human corrections.
- [ ] Bind exact changes to approval, target version and actor; handle conflicts, rejection and duplicate submission.
- [ ] Preserve existing forbidden-field guards and show incomplete coverage instead of inventing facts.
- [ ] Prove revoked or unrelated account/document access cannot leak into conversation context.

### 3. Approved read-only sources

- [ ] Select an Outlook pilot scope and backfill window; obtain IT/data-owner approval before ingestion.
- [ ] Use the existing connector envelope, canonical IDs and source permissions.
- [ ] Test refresh/reconnect, retries, cursor ties, edits/deletions, duplicate suppression and access loss.
- [ ] Keep manual text/LinkedIn/call logging available; show sync health and last successful coverage honestly.

### 4. Bounded background preparation

- [ ] First implement verified identity, durable shared storage, job/run/action/audit stores and a recoverable worker.
- [ ] Prove leases prevent double work; restarts/retries do not duplicate business actions across runs.
- [ ] Bound time, tokens, external calls, records and monetary spend per run and across the organization.
- [ ] Support cancellation, safe retries, dead letters, visible errors, audit, kill switches and rollback.
- [ ] Start with account/meeting preparation and reviewed reminders, not customer sends.
- [ ] Render a short result and next action; keep diagnostics behind a detail view.

### 5. Reusable approved recipes

- [ ] Pin immutable playbook/agent versions and separately approve tools, resource scope, model/provider policy and destinations.
- [ ] Allow employee preferences without letting prompt edits expand permissions.
- [ ] Reauthorize every run/action; deploying a recipe is not blanket approval for its external effects.

These checkboxes are implementation acceptance criteria, not completed tests. IT must choose identity/storage/worker infrastructure, confirm provider capabilities and budgets, and approve field-review and retention policies. Private source material belongs in reviewed protected imports, not demo fixtures or committed assets.

## Engineering references and reuse hygiene

All upstream links are pinned to the reviewed commit:

- [Evidence policy](https://github.com/trycompai/crm/blob/6d4793dd6d7aeea91aa6a034e00b17d7408a2d08/apps/agent/agent/lib/evidence.ts) and [fact application](https://github.com/trycompai/crm/blob/6d4793dd6d7aeea91aa6a034e00b17d7408a2d08/apps/agent/agent/lib/facts.ts).
- [Work queue/leases](https://github.com/trycompai/crm/blob/6d4793dd6d7aeea91aa6a034e00b17d7408a2d08/apps/agent/agent/lib/tasks.ts), [focus/budgets](https://github.com/trycompai/crm/blob/6d4793dd6d7aeea91aa6a034e00b17d7408a2d08/apps/agent/agent/lib/focus.ts) and [agent/conversation design](https://github.com/trycompai/crm/blob/6d4793dd6d7aeea91aa6a034e00b17d7408a2d08/docs/agent.md).
- [Outlook sync](https://github.com/trycompai/crm/blob/6d4793dd6d7aeea91aa6a034e00b17d7408a2d08/apps/api/src/microsoft/outlook-sync.service.ts), [thread writer](https://github.com/trycompai/crm/blob/6d4793dd6d7aeea91aa6a034e00b17d7408a2d08/apps/api/src/mailbox/thread-writer.service.ts) and [provider scopes](https://github.com/trycompai/crm/blob/6d4793dd6d7aeea91aa6a034e00b17d7408a2d08/packages/auth/src/scopes.ts).
- [Agent access](https://github.com/trycompai/crm/blob/6d4793dd6d7aeea91aa6a034e00b17d7408a2d08/apps/api/src/agent/agent-access.service.ts), [contact router](https://github.com/trycompai/crm/blob/6d4793dd6d7aeea91aa6a034e00b17d7408a2d08/apps/api/src/contacts/contacts.router.ts) and [conversation reads](https://github.com/trycompai/crm/blob/6d4793dd6d7aeea91aa6a034e00b17d7408a2d08/apps/api/src/google/conversation.service.ts).
- [Connection design](https://github.com/trycompai/crm/blob/6d4793dd6d7aeea91aa6a034e00b17d7408a2d08/docs/connections.md), [telemetry](https://github.com/trycompai/crm/blob/6d4793dd6d7aeea91aa6a034e00b17d7408a2d08/docs/telemetry.md) and [MIT license](https://github.com/trycompai/crm/blob/6d4793dd6d7aeea91aa6a034e00b17d7408a2d08/LICENSE).

This document adapts ideas without copying source. If substantial code is later reused, preserve Comp AI's copyright and MIT notice and record pinned files in THIRD_PARTY_NOTICES.md. Review dependency, asset and provider terms separately; this recommendation is not blanket legal or security approval.
