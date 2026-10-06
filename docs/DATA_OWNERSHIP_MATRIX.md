# Data ownership matrix

**Status:** proposed production ownership. Spej IT must map each target below to the actual Spej OS service before migration. The local preview database is not the company system of record.

## Ownership rule

One canonical service owns each record or field. CRM, GTM, project, dashboard, Teams, mobile, and SOSA are views or clients of those records. Integration tables may map external IDs and track delivery state, but must not become a second business database.

| Data domain | Canonical owner in production | Other systems may store | Write path |
| --- | --- | --- | --- |
| Users, groups, sign-in | Spej identity / approved Entra integration | Stable subject, tenant, display-safe label | Identity administration only |
| Roles, permissions, record scope | Spej authorization service | Evaluated decision and policy version in audit | Authorized policy administration |
| Accounts and organizations | Canonical Spej CRM service | Canonical ID, display-safe projection, external mappings | Record-level CRM command |
| People and decision makers | Canonical Spej CRM service | Canonical ID, allowed contact projection, source reference | Record-level CRM command; reviewed merge/link |
| Opportunities, stages, value, next action | Canonical Spej CRM service | Read projections and metrics | Versioned, permission-checked command |
| Relationship activities and follow-ups | Canonical Spej CRM/activity service | Source reference and derived metrics | Idempotent activity command |
| Projects, workstreams, deliverables | Canonical Spej project service | Read projection and linked CRM IDs | Versioned project command |
| Tasks, subtasks, dependencies, deadlines, owner, workspace, visibility | Canonical Spej work service | Permission-filtered projection and calculated queues | Versioned, access-checked work command |
| Tickets, defects, quality checks, acceptance evidence | Existing Spej OS ticket/quality service | Permission-filtered projection and linked canonical IDs | Existing service workflow; never duplicate as unlinked tasks |
| Project decisions, risks, milestones, and approvals | Canonical Spej project/governance service selected by IT | Read projection, evidence and linked IDs | Versioned project/governance command |
| Time entries and delivery effort | Existing Spej OS time/work service | Authorized project/task summary | Existing time-entry workflow; finance records remain separate |
| Enterprise goals, scorecards, issues, headlines, and meetings | Existing Spej OS enterprise-management service | Permission-filtered projection and canonical links | Existing service workflow after field-by-field parity review |
| Playbook definitions, versions, gates, and assignments | Existing Spej OS playbook service | Stable playbook/version ID and run projection | Versioned playbook command; reviewed instantiation |
| GTM classifications and routing fields | GTM-owned fields on canonical records | Cached filter options | Field-level canonical patch |
| Content ideas, assets, stages, approvals | Canonical Spej content/work service selected by IT | SharePoint asset references, read projections | Versioned content command |
| Campaign definitions and attribution rules | Canonical Spej GTM service | Calculated summaries | Governed GTM command |
| Raw web/social/marketing analytics | Source platform or approved analytics warehouse | Source ID, observation time, normalized fact | Connector/warehouse ingestion |
| Derived GTM metrics | Deterministic metrics service over canonical facts | Time-bounded cache with definition version | Recalculate; never hand-edit derived totals |
| Outlook messages and calendar events | Microsoft 365 | IDs, versions, authorized links, minimized metadata/approved excerpts | Graph connector; separate write approval |
| Teams messages | Microsoft Teams | Message/channel IDs, safe reference, approved excerpt | Teams/Graph connector |
| SharePoint/OneDrive documents | Microsoft 365 | Site/drive/item/version IDs, URL, title, label metadata | Graph reference/fetch; no CRM body copy |
| Artifact links, parsing state, chunks, embeddings, and graph relationships | Existing permission-aware Spej knowledge service | Authorized artifact/version references, citations, processing health | Connector/index workers; derived knowledge is not the source document |
| Meeting transcripts | Approved recording/Microsoft source or governed document store | Transcript ID/version/reference, processing status, retained excerpt if policy permits | Connector plus reviewed derived changes |
| SOSA conversations and agent memory | Existing SOSA service under company retention policy | Conversation/correlation reference in audit | SOSA service only |
| Prepared proposals and approvals | Proposal service | Immutable operations, hashes, expiry, decision metadata | Tool host only |
| Integration events, cursors, retries, dead letters | Integration service | Minimized envelope and processing metadata | Connector workers only |
| Audit events | Append-only audit service | Correlation reference | Services append; users do not edit |
| Tenant feature flags and connector/action kill switches | Existing Spej feature-control service | Evaluated flag/version in cache and audit | Authorized administration only |
| AI usage, latency, outcome, token and cost facts | Existing Spej usage/metering service | Permission-filtered aggregates | Append-only governed AI/tool telemetry |
| Tenant plan, entitlements, quotas, and billing status | Existing Spej entitlement/billing service | Effective entitlement and limit projection | Authorized billing administration; no payment data in this app |
| Secrets and OAuth credentials | Approved secret manager | Secret identifier/version only | Privileged secret-management path |
| Personal UI preferences | Application preference store | User-scoped settings | Authenticated user setting |
| Local demo records and settings | Local preview only | Nothing promoted automatically | Explicit reviewed migration only |

## Field-level ownership

A record can contain fields owned by different domains. The canonical gateway must maintain a mapping manifest with, for every exposed field:

- canonical record type and field name;
- owning service/team;
- allowed readers and writers;
- validation and allowed-value version;
- source/external mapping where applicable;
- retention, sensitivity, and audit classification.

An adapter submits patches only for fields it owns or is authorized to change. It must never serialize a partial GTM view back as a full record because that can erase project, finance, security, or legacy fields.

## Identity and external mappings

Use a tenant-scoped mapping table with a uniqueness constraint over `(tenant, provider, resource scope, external type, external ID)`. Store the canonical ID, external version, first/last seen timestamps, link status, and reviewer when manually linked. Do not use email, display name, company name, or URL as the permanent identity key.

Possible matches are proposals. A merge or relink must show both records, preserve provenance, recheck permissions, and leave an auditable redirect/history rather than silently deleting identity.

## Derived data and caches

Metrics, Today queues, pipeline summaries, reminders, and dashboards are deterministic views over canonical facts. Every materialized value records its definition/version and source cutoff. A cache may be discarded and rebuilt; it is not authoritative.

Model-produced summaries, classifications, and extracted action items record evidence references, model/tool version, creation time, and review state. They cannot replace canonical source material or become confirmed facts without the applicable validation and approval.

Document and knowledge behavior follows the [knowledge and document integration contract](KNOWLEDGE_AND_DOCUMENT_INTEGRATION_CONTRACT.md). An artifact reference, index entry, citation, or model summary never grants access to its source.

## Conflict and deletion rules

- Canonical service versions decide concurrent-write conflicts; connector timestamps do not override them.
- External deletion becomes a tombstone/reconciliation event. Retention and legal policy decide whether Spej data is removed, detached, or retained.
- A connector revocation stops new synchronization but does not silently delete canonical business records.
- A source correction produces a new version with provenance; audit records remain immutable.
- Deleting a view, cache, proposal, or integration event must not delete its canonical source record.

## Migration acceptance

Before any system becomes writable, Spej IT must approve the ownership manifest, external-ID mappings, field transformations, retention rules, duplicate-handling policy, and reconciliation report. Representative parity checks must cover tickets/quality, files, decisions, time tracking, enterprise records, playbook assignments, feature controls, and usage/entitlements—not only CRM and GTM fields. See [Migration and rollback](MIGRATION_AND_ROLLBACK.md).
