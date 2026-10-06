# Migration and rollback

**Status:** staged plan for Spej IT. No automatic migration from the local preview or current Spej OS is performed by this repository.

## Principles

- Keep one canonical owner for each field and record.
- Migrate with immutable exports, deterministic transforms, stable IDs, and reconciliation.
- Prefer shadow reads and narrow pilots over a big-bang replacement.
- Never promote local demo data automatically.
- Preserve the existing Spej OS workflow until each production domain is accepted and the rollback window closes.
- Meeting transcripts and model output create proposals, not unreviewed canonical facts.

## Phase 0: inventory and decisions

1. Inventory current Spej OS CRM, project, ticket, notes/update, content, identity, SOSA, Microsoft, and analytics stores and APIs.
2. Confirm which screens/workflows are used, which data is authoritative, and which fields are intentionally local or obsolete.
3. Approve the [data ownership matrix](DATA_OWNERSHIP_MATRIX.md), record/field mapping, retention, duplicate, deletion, and merge policies.
4. Define measurable acceptance thresholds, RPO/RTO, rollback window, data owners, and sign-off authority.
5. Back up source systems and prove a representative restore before any production write.

Output: versioned inventory, mapping manifest, risk register, acceptance plan, and restore evidence.

## Phase 1: extract and dry-run transform

- Export from each source using a repeatable snapshot ID/cutoff and checksum. Keep the export read-only and access-controlled.
- Transform into canonical commands, not direct database inserts. Preserve source ID, canonical ID, tenant, version/provenance, timestamps, and transformation version.
- Normalize classifications only through an approved mapping table. Put unknown/invalid values in a review queue; do not guess.
- Detect duplicates using stable source IDs first. Name/email/domain similarity produces a candidate report, not an automatic merge.
- Validate referential integrity for account-person-opportunity-project-task/content links.
- Generate counts and hashes by tenant, type, status, owner, and time range plus a field-level exception report.

The dry run writes only to an isolated staging target. Re-running the same snapshot must produce the same IDs and no duplicate records.

## Phase 2: canonical adapter and shadow reads

Connect the new dashboard and SOSA tools to permission-aware canonical read APIs while the existing UI remains the write path. Compare:

- record counts and sampled fields;
- pipeline stages/value/next actions;
- project/task/subtask status and dependencies;
- relationship activities and follow-up dates;
- content stages/approvals and campaign links;
- deterministic metrics and Today queues;
- authorization results for representative roles.

Investigate differences; do not hide them with UI-only calculations. Production writes remain disabled.

## Phase 3: narrow write pilot

Enable record-level writes behind tenant, cohort, domain, and action feature flags. Begin with low-risk GTM fields and a small named group. Every write uses canonical IDs, expected versions, idempotency IDs, atomic commits, and audit.

SOSA remains read/propose until dashboard-side proposal approval/commit passes end-to-end. External sends, calendar changes, merges, deletes, bulk operations, and permission changes remain disabled.

Run continuous reconciliation between audit/commands and canonical records. A mismatch pauses expansion.

## Phase 4: domain rollout

Promote one domain at a time—for example CRM/GTM, content/work, then project/delivery—only after its owner accepts:

- required workflows and fields;
- authorization and negative tests;
- conflict/idempotency behavior;
- metrics and reconciliation;
- support, monitoring, backup, and rollback evidence.

Other Spej OS motions remain unchanged. The GTM view may combine CRM, content, work, and metrics, but it still writes through their canonical owners.

## Phase 5: Microsoft and transcript intake

Start with one non-production resource and read-only scopes. Establish webhook validation, subscription renewal, delta cursor, idempotency, retry/dead-letter, and reconciliation before adding resources.

In production, enable a small configured mailbox/team/calendar/site cohort. Store references and minimized metadata. Unknown people and transcript-derived actions go to review. Add outbound mail/Teams/calendar actions only after separate permission, confirmation, audit, and kill-switch testing.

## Phase 6: expand SOSA channels

Register governed tools with the existing SOSA, then test dashboard, Teams, and mobile adapters against the same principal and canonical services. Expand from read to propose, then approved commit. Never give the model a whole-workspace write, database credential, Graph token, or authority derived from message text.

## Cutover criteria

A domain can become primary only when:

- source and target counts/hashes reconcile within the approved, explained tolerance;
- every exception has an owner and disposition;
- identity, tenant, role, record, and field permission tests pass;
- retrying imports, proposals, commits, and connector events is idempotent;
- version conflicts do not overwrite newer data;
- audit can trace a sample from source through transformation/tool call to canonical result;
- backup restore and rollback rehearsal pass within approved objectives;
- business, data, application, security, and operations owners sign off.

## Rollback triggers

Immediately stop expansion and consider rollback for cross-tenant access, permission bypass, material data loss/corruption, uncontrolled external sends, persistent reconciliation drift, unbounded duplicate creation, audit gaps, inability to restore, or error/latency/backlog beyond approved thresholds.

## Rollback procedure

1. Disable affected write and external-action feature flags; keep safe read-only access if authorized.
2. Pause consumers without deleting queue, cursor, dead-letter, proposal, or audit state.
3. Record cutoff time, last accepted request/event IDs, artifact/config versions, and canonical versions.
4. Route users back to the previous write workflow.
5. Revoke compromised credentials or subscriptions; otherwise preserve them for controlled diagnosis.
6. Reconcile writes since the last known-good point. Use canonical-service restore or reviewed compensating commands—never ad hoc table edits.
7. Replay only verified safe events with original idempotency keys after the defect is fixed.
8. Re-run acceptance and reconciliation before a staged re-enable.

Do not drop source systems, mappings, immutable exports, or audit evidence during the rollback window. Decommissioning requires a separate retention-approved change after stable operation and final sign-off.

## Migration evidence package

Retain the approved mapping manifest, source snapshot IDs/checksums, transform version, release artifact SHA, CI/security results, reconciliation reports, exception decisions, sign-offs, backup/restore evidence, feature-flag history, cutover timeline, and rollback rehearsal outcome. Exclude secrets and unnecessary message/document content.
