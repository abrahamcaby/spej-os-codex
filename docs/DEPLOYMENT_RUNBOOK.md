# Deployment runbook

**Status:** handoff runbook. The current application is a local preview and integration reference, not a production deployment. Completing the repository checks does not certify the production integrations described here.

> **Production startup is intentionally blocked.** An unset `SPEJ_RUNTIME` (or `local-preview`) runs the non-sensitive local preview. Setting `SPEJ_RUNTIME=production` stops before the local SQLite database or in-process scheduler can start. IT must wire and verify the canonical database, company identity, audit, durable queue/worker, and production health adapters before removing this guard.

## A. Local demonstration

Requirements: Node.js `>=24.19.0`, npm from the lockfile workflow, and a local machine that can bind loopback.

```bash
npm ci
npm run check
npm run smoke
npm run launch
```

Use only non-sensitive demo data. Keep the application on `127.0.0.1`. Do not use production OAuth credentials, exports, email content, transcripts, or local database files in a demo repository or deployment.

## B. Production prerequisites

Spej IT names owners for application, identity/RBAC, canonical records, Microsoft 365, SOSA, data governance, security, and operations. Before deployment, approve:

- the architecture and [data ownership matrix](DATA_OWNERSHIP_MATRIX.md);
- canonical IDs, field ownership, validation rules, version semantics, and retention;
- Entra/company identity mapping and least-privilege role/capability matrix;
- Microsoft resource scopes, consent, connector identity, and subscription ownership;
- proposal/approval policy and SOSA tool registration;
- hosting, database, durable queue, worker, audit, telemetry, backup, and secret-management services;
- RPO, RTO, escalation, on-call, maintenance, and rollback authority.

The production environment template contains names only. Put values in the approved secret/config systems, never in Git.

The included [`.env.production.example`](../.env.production.example) intentionally fails if copied unchanged. Its validator describes the minimum production configuration contract: PostgreSQL, verified OIDC settings, a strong session secret, audit and secret-manager selections, and a durable queue. Optional Microsoft and SOSA settings become mandatory only when their feature flag is enabled. Microsoft supports workload identity or an explicitly approved client-secret mode. Passing this configuration validator does not bypass the production startup block or prove that any adapter is implemented.

## C. Build and release

1. Create a private company repository and correct package/repository ownership metadata as part of the handoff review.
2. Protect the release branch; require review, CI, secret scanning, and dependency scanning.
3. Build from the lockfile on the required Node version:

   ```bash
   npm ci
   npm run check
   npm run smoke
   ```

4. Run the focused production-contract tests when present:

   ```bash
   npx tsx --test tests/integration-*.test.ts tests/microsoft-*.test.ts tests/auth-principal.test.ts tests/sosa-authorization.test.ts tests/canonical-record-gateway.test.ts tests/production-env.test.ts
   ```

   These tests validate reference contracts and in-memory semantics. They do not replace staging tests against company identity, canonical Spej OS, SOSA, Microsoft Graph, or durable infrastructure.

5. Produce one immutable artifact with commit SHA, dependency manifest/SBOM if supported, build logs, and test evidence.
6. Scan the artifact and configuration for secrets. Sign/provenance the artifact when company tooling supports it.
7. Promote the same artifact through development, test, staging, and production; change configuration, not source.

## D. Provision production services

1. **Identity:** configure trusted issuer/audience, callback origins, session policy, group/role mapping, and service identities. Production must fail closed if identity configuration is absent.
2. **Canonical gateway:** connect record-level search/read/prepare/commit and append-only audit to existing Spej OS services. Disable the local whole-workspace mutation path in production.
3. **State:** provision durable proposal, approval, integration-event, cursor, idempotency, dead-letter, and audit stores with tenant-scoped keys and backups.
4. **Queue/workers:** run connector and transcript work outside web request lifetimes. Configure bounded retries, concurrency, rate limits, and kill switches.
5. **Microsoft:** use a non-production tenant first; configure only approved resources and scopes; store credentials in the secret manager; establish webhook HTTPS endpoint, validation, renewal, delta, and health monitoring.
6. **SOSA:** register versioned governed tools with the existing agent. Keep model and conversation ownership in the existing service. Supply identity outside prompts and deny direct database/Graph access.
7. **Web:** deploy the stateless UI/API behind company authentication, TLS, WAF/gateway controls, request/body limits, and restricted origins.
8. **Observability:** emit correlation IDs across gateway, SOSA, canonical commits, connectors, queues, and audit. Configure alerts before enabling writes.
9. **Runtime guard:** only after the preceding adapters and staging gates are implemented, replace the intentional `SPEJ_RUNTIME=production` startup block with checks that verify those live dependencies. The production health endpoint must report each dependency separately and must not return ready while a required dependency is unavailable.

If using serverless hosting such as Vercel for a demonstration or web tier, do not use local SQLite/files or the in-process scheduler as production state. Durable queues, workers, secrets, canonical data, audit, and scheduled subscription renewal must live in approved external services.

## E. Staging verification

Use synthetic or approved test data and two tenants/security scopes where possible.

- Sign-in, expiry, logout, disabled-user, wrong-audience, and missing-principal requests fail correctly.
- Role, record, field, and cross-tenant negative tests return no protected data and make no write.
- Dashboard and SOSA read the same canonical version.
- A proposal shows exact changes; altered, stale, expired, or differently owned approval fails.
- One approved multi-record commit is atomic, audited, and idempotent on retry.
- Non-GTM fields and existing project/ticket workflows remain unchanged.
- Webhook spoof/replay/out-of-order tests, delta cursor failure, retry, dead letter, and replay behave as contracted.
- SharePoint remains reference-first; unknown people are not auto-linked.
- Outlook/Teams/calendar writes fail without exact permission and confirmed destination/content.
- Connector revocation, subscription expiry, model outage, canonical-service outage, and queue backlog produce visible degraded health without data corruption.
- Backup restoration and point-in-time/reconciliation procedures meet the approved RPO/RTO.

Record evidence, owner, timestamp, artifact SHA, and result for every gate.

## F. Release gates

Production writes remain disabled until all are true:

- CI, focused contract tests, build, and smoke checks pass on the release artifact.
- No unresolved critical/high security or data-loss finding exists.
- Identity/RBAC and tenant isolation have independent approval.
- Canonical ownership/mapping and migration reconciliation are signed off.
- Microsoft consent is least privilege and limited to approved resources.
- SOSA cannot commit without governed tools and applicable approval.
- Audit, monitoring, alerts, backup restore, kill switches, and rollback are tested.
- Staging acceptance is signed by application, data, security, and business owners.

## G. Cutover and monitoring

Follow the staged process in [Migration and rollback](MIGRATION_AND_ROLLBACK.md). Start read-only, then enable writes for a small pilot cohort and domain. Monitor authorization denials, errors, p95 latency, version conflicts, duplicate suppression, queue age, cursor lag, dead letters, approval latency, connector renewal/consent, and reconciliation differences.

Do not expand the cohort while a gate is failing. Keep the previous workflow available until the rollback window closes and reconciliation is clean.

## H. Immediate rollback

If there is unauthorized access, cross-tenant leakage, data corruption, uncontrolled external sends, unexplained duplicate writes, or unrecoverable connector drift:

1. disable production mutation and external-action feature flags;
2. pause connector consumers while preserving queued events and cursors;
3. revoke affected credentials/subscriptions when compromise is suspected;
4. route users to the previous read/write workflow;
5. preserve logs/audit and identify the last known-good canonical version;
6. restore or compensate only through the approved data-owner procedure;
7. reconcile before re-enabling any write.

Never resolve an incident by deleting queues, dead letters, audit records, or the previous source system.
