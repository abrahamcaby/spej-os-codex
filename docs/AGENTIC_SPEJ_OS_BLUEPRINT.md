# Agentic Spej OS blueprint

**Current direction and implementation order:** see the [September 21 CRM recommendations](AGENTIC_CRM_RECOMMENDATIONS.md). Spej OS is now a standalone build; inherited requirements below to reuse the existing production Spej OS or SOSA services are optional integration references, not prerequisites. The evidence, authorization, approval and durability controls still apply. Neither document claims those production services are implemented.

**Status:** implementation blueprint for the private Spej GitHub handoff. This document does not claim that the local preview contains a durable production agent runtime.

The [unified employee workspace vision](UNIFIED_EMPLOYEE_WORKSPACE_VISION.md) supplies the broader product objective: employees should be able to find context, create outputs, review actions and complete work from Spej OS. Use its end-to-end pilot workflows to prioritize the runtime work here; a larger tool catalogue alone is not the outcome.

## Reference reviewed

The review used the `release` branch of [Comp AI's agentic-first CRM](https://github.com/trycompai/crm) at commit [`6d4793d`](https://github.com/trycompai/crm/tree/6d4793dd6d7aeea91aa6a034e00b17d7408a2d08). The useful patterns were translated into Spej's architecture; no source files from that repository are included here.

The strongest reference patterns are:

- [durable, leased work with a reason, due time, priority and budget](https://github.com/trycompai/crm/blob/6d4793dd6d7aeea91aa6a034e00b17d7408a2d08/apps/agent/agent/lib/tasks.ts);
- [typed observations evaluated by deterministic evidence policy](https://github.com/trycompai/crm/blob/6d4793dd6d7aeea91aa6a034e00b17d7408a2d08/apps/agent/agent/lib/evidence.ts), rather than a model supplying its own confidence;
- [one guarded fact-write path that preserves human values and dismissed suggestions](https://github.com/trycompai/crm/blob/6d4793dd6d7aeea91aa6a034e00b17d7408a2d08/apps/agent/agent/lib/facts.ts);
- [explicit capability coverage when optional sources are unavailable](https://github.com/trycompai/crm/blob/6d4793dd6d7aeea91aa6a034e00b17d7408a2d08/apps/agent/agent/lib/capabilities.ts); and
- [separate run, action, event and audit records](https://github.com/trycompai/crm/blob/6d4793dd6d7aeea91aa6a034e00b17d7408a2d08/packages/db/prisma/schema.prisma#L779-L915).

## Spej position

SOSA remains Spej's company agent. The existing Spej OS remains the source of identity, permissions, canonical records, documents, tickets, feature controls and usage policy. This interface should add an agentic operating layer over those services, not create another CRM or another independent agent.

The production design follows six rules:

1. Agent work survives browser closure, restarts and redeployments.
2. The authenticated principal and permitted record scope travel outside model text.
3. The model reports observations; deterministic code evaluates evidence and permissions.
4. A person-owned value is never silently replaced by agent research.
5. Every proposed and completed side effect has an idempotency key, actor, reason and audit trail.
6. Missing sources reduce declared coverage; they never encourage SOSA to guess.

## Adopt, adapt, or avoid

| Reference pattern | Spej decision | Required Spej treatment |
| --- | --- | --- |
| Leased durable agent work | **Adopt the behavior** | Add tenant, initiating/service principal, policy version, classification, canonical target versions, correlation and idempotency fields; keep machine work separate from human tasks. |
| Observation and fact ledger | **Adapt** | Trusted adapters issue evidence receipts. The model may cite a receipt but may not declare its own evidence class, provenance or confidence. Start with review-only fact proposals. |
| Identity matching | **Adapt and strengthen** | Use Entra/Spej subject IDs and provider object IDs. Names and email addresses may suggest a candidate; ambiguity stops the run and routes to a person. |
| Capability inventory and budgets | **Adapt and strengthen** | Base availability on live health, entitlement, caller permission, freshness and rate limits—not only on whether a key exists. Preflight before spending budget. |
| Immutable agent versions and action ledger | **Adopt after the P0 controls** | A human deploys an exact version, but every run and action is still reauthorized. Sensitive external actions keep action-bound approval. |
| Contextual, record-centered agent UX | **Adopt** | Pass the canonical record ID and principal through trusted session context, keep conversations durable, and show evidence plus run/action history. |
| Bun/Eve/Nest/Prisma/Vercel stack, blanket read access, automatic blank-field writes and reference telemetry configuration | **Avoid** | Reuse Spej's existing runtime, SOSA, identity, canonical services, audit, usage controls and deployment platform. |

This table is the architecture decision record for the reviewed reference commit. It approves no production dependency or copied source code.

## Stable identity on preview records

Owned preview records carry both an `ownerProfileId` and an `owner` display label. The stable ID is the authorization and migration key; the label is presentation data. Known preview identities are written with both values, while an unrecognized label must not inherit another person's ID. Production replaces the preview profile ID with the canonical Spej/Entra subject mapping.

The same rule applies to reviewers, approvers, requesters, service principals and human decision-makers: persist a stable ID, snapshot the display label for audit readability, and never authorize from the label.

## 1. Durable SOSA work queue

Add a tenant-scoped `AgentWorkItem` to the production data plane. A work item is a durable instruction to SOSA, not a browser request and not a cron expression.

Minimum fields:

| Group | Required fields |
| --- | --- |
| Identity | `tenantId`, `workItemId`, `kind`, `subjectKind`, `subjectId`, `requestedByPrincipal` |
| Intent | `reason`, `dueAt`, `priority`, `inputArtifactRefs` |
| Limits | `budgetUnits`, `maxAttempts`, `expiresAt`, permitted tool/action set |
| Execution | state, attempt count, lease token, lease expiry, worker/session ID, correlation ID |
| Result | summary, output artifact refs, proposal IDs, error code, next recommended check |
| Safety | idempotency key, policy version, created/started/finished/cancelled timestamps |

Recommended states are `queued`, `leased`, `running`, `awaiting_approval`, `retry_scheduled`, `completed`, `failed`, `dead_letter` and `cancelled`.

The dispatcher only leases due work. The record's `dueAt` says when it should run. This supports one-off follow-ups, project reviews and relationship rechecks without creating a separate scheduled job for every business rule.

Required behavior:

- claim work atomically and use expiring leases;
- prevent two workers from performing the same work;
- make retry limits and backoff explicit;
- reconcile expired leases and expose dead letters;
- store a human-readable reason for every scheduled recheck;
- cancel future work through durable state before signalling a worker; and
- treat cancellation as stopping future actions, not undoing completed side effects.

## 2. Evidence and provenance ledger

Add a tenant-scoped observation ledger for facts SOSA extracts or researches. Do not accept a free-form confidence score from a model.

Suggested Spej observation kinds include:

- `user.assertion`;
- `crm.email.reply` and `crm.email.signature`;
- `calendar.attendance`;
- `meeting.transcript.statement`;
- `sharepoint.document.statement`;
- `canonical.record.value`;
- `public.cited.claim`; and
- `contradiction`.

Each observation must contain a governed artifact reference, immutable artifact version, exact citation or locator, observed time, source system, collection principal and sensitivity label. A model-supplied URL alone is not proof.

Each proposed fact needs `field`, `value`, status, observations, policy result, proposing run, and decision history. Recommended statuses are `proposed`, `applied`, `dismissed` and `superseded`.

Initial Spej policy should be conservative:

- human-authored values outrank researched values;
- a contradiction always requires review;
- a dismissed value is not offered again without materially new evidence;
- accepting one value settles competing proposals for the same field;
- every replacement preserves the prior value and provenance; and
- no agent-researched value automatically changes a production record during the first pilot.

Later, Spej can approve narrow auto-apply policies for low-risk blank fields. That approval belongs in versioned policy, not in the prompt.

## 3. Capability and coverage manifest

SOSA should receive a request-specific capability manifest produced after identity and permission checks. The manifest states which canonical services, record scopes, document sources, Microsoft resources and external research providers are available.

Each capability reports:

- enabled, degraded or unavailable;
- the authenticated scope and allowed operations;
- freshness and last successful check;
- expected cost or budget unit;
- data sensitivity and egress rule; and
- a safe explanation when unavailable.

SOSA must describe coverage gaps in its answer. An unavailable connector is a known limitation, not an instruction to retry or infer missing facts.

The interface should render these states as `Ready`, `Contract defined`, `Not connected` or `Needs attention`, with the last successful check, incomplete coverage and the workflows that use the capability. A configured secret is not proof of a working connection.

## 4. Runs, actions and immutable approval

Keep four separate production records:

1. `AgentRun` — why SOSA ran, who initiated it, the approved agent/tool version, model metadata, cost, result and status.
2. `AgentRunEvent` — ordered execution events and tool outcomes.
3. `AgentAction` — one proposed external or canonical side effect with exact target, request hash, idempotency key and result.
4. `AgentAuditEvent` — append-only security and decision history.

The current Spej prepare → approve → commit contract is the right foundation. IT should make its proposal and approval records durable and expand audit coverage to reads, denials, conflicts, retries, duplicates, failures, cancellations and external effects.

Deployment of a new agent or tool policy is itself a human approval boundary. A deployed version pins its instructions, tools, triggers, record scope, action scope, model policy and sandbox policy. A saved draft has no authority.

## 5. Record-centered SOSA conversations

Allow an authorized person to open a durable SOSA conversation from an account, person, opportunity, project, task, ticket, campaign or content item.

- Bind the subject and authenticated user in the session token, not the chat message.
- Return stable IDs for the subject and adjacent authorized records.
- Keep each person's conversations separate even when the subject is shared.
- Preserve the transcript and tool events in the company audit/agent store.
- Keep the conversation alive while the user navigates between Spej OS views.
- Never use fuzzy name matching to choose a write target.

This turns SOSA into a working partner inside the operating record, instead of a generic chat window beside it.

## 6. Budgets, reasons and operating health

Every autonomous run needs limits for model tokens, vendor calls, elapsed time, records scanned and permitted actions. Exhausting a budget is a normal bounded outcome. SOSA should summarize what it learned, state what remains unknown, and schedule another check only when it can explain why.

Operations should monitor:

- queue depth and age;
- due work not claimed;
- running work and lease expiry;
- attempt and retry counts;
- dead letters and stale work;
- proposal approval age;
- unlinked sessions or actions;
- cost by tenant, workflow and model;
- capability freshness and degraded sources; and
- reconciliation differences between SOSA output and canonical records.

Expose a safe activity view for authorized operators. At minimum it shows queued, running, awaiting review, retry scheduled, failed, dead-lettered, cancelled and completed work; the trigger and human-readable reason; actor/service principal; subject; deployed version; budget consumed; external actions; next attempt; and a user-safe failure. Retry and stop controls must explain that already-completed side effects remain completed. The local preview may summarize its meeting-intake statuses, but it must label that summary as preview activity rather than implying that a durable production run ledger exists.

## Priority Spej workflows

| Workflow | Trigger and authorized inputs | SOSA output | Initial approval rule |
| --- | --- | --- | --- |
| Meeting to operating record | Governed Teams/transcript event; linked account, opportunity or project | Decisions, tasks, risks, CRM changes and citations | Review the complete change set before atomic commit |
| Daily operator | Start-of-day schedule or user request; authorized tasks, projects, pipeline and approvals | Top three commitments, missing next actions and blocked work | Read-only summary; each proposed record change reviewed separately |
| Relationship care | New reply/meeting or reasoned `dueAt` recheck | Updated relationship context and a suggested next action | No automated outreach; human approves record changes and sends |
| Pipeline hygiene | Opportunity change or weekly review | Missing decision, owner, next action, evidence and close-date warnings | Deterministic warnings; reviewed corrections |
| Project health | Milestone, task or ticket change | Risk explanation, dependency gaps and proposed recovery actions | Read-only health; reviewed tasks/decisions |
| Signal to story | Approved Industry, Mention, Newsletter or customer evidence | Content brief with source coverage, audience and angle | Human selects the signal and approves the content record |
| Executive briefing | Scheduled leadership review; authorized company metrics and risks | Concise changes, decisions required and evidence links | Read-only; no hidden cross-scope aggregation |

## What belongs in this handoff versus the IT implementation

### Include in this repository now

- this blueprint and the existing SOSA, canonical-record, Microsoft, knowledge, access and data-ownership contracts;
- the visible distinction between preview model settings and production SOSA service status;
- synthetic executive demo data with realistic agent states, never production content;
- deterministic tests for proposal binding, authorization, version conflict, idempotency and evidence-policy examples; and
- an IT checklist that names every production adapter and acceptance gate.

### Spej IT implements against existing services

- durable tenant-scoped work, run, action, evidence and audit stores;
- verified workforce identity and per-record authorization;
- the existing SOSA bridge and versioned tool registry;
- canonical record and ticket adapters;
- Microsoft event intake, governed artifact references and workers;
- queues, leases, retries, dead letters, telemetry and budgets;
- secret management, retention, deletion and backup; and
- staging reconciliation, feature flags, kill switches and rollback.

## Patterns not to import directly

- Do not adopt a blanket “the agent may read everything” rule. Spej requires principal-, tenant-, record-, field- and document-aware authorization before context reaches SOSA.
- Do not replace Spej's existing SOSA with another runtime or provider control plane.
- Do not copy a single-tenant CRM authorization model into the company platform.
- Do not enable automatic relationship enrichment, profile scraping or external outreach without Spej legal, privacy, security and data-owner approval.
- Do not let a stronger model substitute for evidence, deterministic validation or approval.
- Do not copy the reference repository's code into this project. Reimplement approved patterns through Spej-owned contracts and services.

## Reference and licensing hygiene

The reviewed repository is MIT licensed, copyright 2026 Comp AI. This blueprint reimplements architectural ideas and includes no third-party source, brand assets, screenshots or telemetry configuration. If Spej later copies source code or a substantial portion, preserve the Comp AI copyright and MIT permission text and add a `THIRD_PARTY_NOTICES.md` entry naming the repository, pinned commit, reused files and license. IT and legal should separately review the terms and data behavior of any service or dependency they choose to adopt; the reference repository's dependency choices are not approved by this blueprint.

## Acceptance gate for an agentic pilot

One pilot workflow is ready only when it proves all of the following with synthetic or approved test data:

1. The work item survives web and worker restarts.
2. A second worker cannot claim the same lease.
3. The principal and record scope are verified outside the prompt.
4. Every asserted fact links to an authorized, versioned source.
5. Missing or contradictory evidence remains visibly unresolved.
6. The exact proposed changes are bound to one authenticated approval.
7. Retry does not duplicate records, messages or calendar actions.
8. Cancellation stops all later writes.
9. Audit reconstructs the trigger, evidence, tools, proposal, decision and result.
10. A failed dependency produces degraded health and a safe retry or rollback path.
