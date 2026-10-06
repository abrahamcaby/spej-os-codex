# Security threat model

**Status:** design-time threat model, not a penetration test, compliance report, or production security approval. The current application is a single-user loopback preview and must not be exposed publicly as-is.

## Protected assets

- Company identity, roles, sessions, and authorization policy.
- CRM, GTM, project, content, activity, and metric records.
- Email, Teams, calendar, document, and transcript data.
- OAuth credentials, model keys, service identities, webhook secrets, and signing keys.
- SOSA proposals, approvals, tool results, and conversation references.
- Audit, connector cursor, retry, dead-letter, backup, and telemetry data.

## Trust boundaries

1. Browser/mobile/Teams client to authenticated company gateway.
2. Gateway and SOSA to canonical services.
3. Company services to model provider/private model runtime.
4. Microsoft Graph/webhooks to integration receiver and workers.
5. Services to databases, queues, secret manager, logs, and backups.
6. External content (email, documents, transcripts, web/social sources) to deterministic parsers and models.

Every boundary authenticates both sides, authorizes the operation, validates bounded schemas, and propagates a correlation ID. Internal network location alone is not trust.

## Primary threats and required controls

| Threat | Required controls |
| --- | --- |
| Missing or forged identity | Production fails closed without a validated principal; signed tokens checked for issuer, audience, tenant, expiry, nonce/session policy |
| Cross-tenant or overbroad access | Tenant on every key/query; object- and field-level authorization; negative isolation tests; no client-supplied tenant override |
| UI-only task filtering or hidden-count leakage | Filter records server-side before search, counts, pagination, summaries, Today, or SOSA context; treat browser view selectors only as preferences |
| Privilege escalation through owner/workspace/visibility changes | Authorize the current record and proposed access fields; require exact approval and audit; parent tasks bound subtask visibility |
| Confused deputy through SOSA/worker | Preserve initiating principal; narrow workload permissions; reauthorize at commit; never derive authority from prompt/message text |
| Prompt injection in mail, Teams, files, transcripts, or web content | Treat content as data; strict tool schemas; fixed tool policy; no content-selected recipients, scopes, or approval changes |
| Hallucinated or ambiguous record identity | Mutations require canonical IDs and expected versions; names only search; ambiguous matches require clarification/review |
| Unauthorized or unintended writes | Read/propose/approve/commit boundary; immutable principal-bound approvals; atomic transactions; external actions show destination/content |
| Stale approval or lost update | Proposal expiry and hash; optimistic concurrency; recheck authorization/version immediately before commit |
| Replay and duplicate side effects | Unique request/idempotency keys; durable result ledger; provider-version dedupe; at-least-once-safe consumers |
| Spoofed webhook | HTTPS, tenant/subscription/resource validation, secret `clientState` or supported proof, size/type limits, authorized Graph re-fetch |
| OAuth or secret theft | Managed secret store, encryption, workload identity where possible, rotation/revocation, no browser/model/log exposure |
| Excessive data sent to a model | Permission-filtered retrieval, data minimization, bounded excerpts, redaction, approved model/data-region policy, retention limits |
| Sensitive SharePoint/mail duplication | Reference-first storage, on-demand authorized fetch, label/DLP enforcement, no full bodies in CRM or queues |
| SSRF or unsafe URLs | Allowlisted providers/schemes, DNS/IP validation where URLs are fetched, redirect revalidation, egress controls |
| Queue poisoning or denial of service | Authenticated intake, payload/rate limits, bounded retries, circuit breakers, per-tenant quotas, dead-letter isolation |
| Information leakage in errors/logs/backups | Structured redaction, safe error codes, least-access logging, encrypted backups, restore-access audit |
| Dependency/build compromise | Lockfile installs, protected branches, code review, secret/dependency scanning, signed/provenanced artifacts where supported |
| Privileged misuse | Separation of duties, high-impact approval, immutable audit, access review, connector kill switches |

## Authorization invariants

- A browser request, tool call, queue message, or external event without a valid tenant and principal cannot read or mutate canonical records.
- The service authorizes both the record and each changed field.
- Read permission never implies write, send, share, delete, merge, export, or administrative permission.
- Access administration does not imply private-record read. Any break-glass read is separate, time-bound, justified, and audited.
- An approval applies only to the stored proposal's actor, tenant, operations, versions, destinations, and unexpired hash.
- A service principal cannot widen the initiating user's permissions unless it is executing a separately approved system automation.
- Denied, conflicted, duplicate, and failed attempts produce safe audit outcomes and no partial write.

## Data protection

- TLS for all service traffic and encryption at rest for databases, queues, objects, logs, and backups.
- Central secret manager; short-lived tokens and rotation; separate development, test, and production tenants/credentials.
- Data classification and retention for each field, excerpt, transcript, proposal, audit record, and dead letter.
- Redaction before model calls and logs. Never persist passwords, access/refresh tokens, cookies, authorization headers, or client secrets in integration envelopes.
- Production data must not be copied into local developer databases or test fixtures.

## Monitoring and response

Alert on repeated authorization failures, cross-tenant denials, webhook verification failures, queue age, retry/dead-letter growth, delta cursor lag, connector consent/renewal failures, unusual exports or bulk changes, approval bypass attempts, and secret-use anomalies. Dashboards must support correlation from user/channel request through proposal, commit, external event, and canonical record IDs without exposing content.

Maintain documented owners and runbooks for disabling a connector, revoking credentials, pausing SOSA writes, isolating a tenant, replaying safe events, restoring data, and notifying affected teams. Preserve relevant audit evidence under company policy.

## Security release gate

Before production exposure, require:

- architecture, data ownership, retention, and least-privilege Graph scope approval;
- threat-model review by Spej IT/security and remediation of high-severity findings;
- automated authorization, tenant-isolation, proposal-binding, replay, concurrency, and redaction tests;
- dependency/secret scanning and review of Internet-facing routes;
- tested backup restore, connector revocation, kill switch, dead-letter replay, and incident escalation;
- a non-production end-to-end test using representative Microsoft labels and access restrictions.

Repeat the review after material identity, model, connector, permission, data-retention, or hosting changes.
