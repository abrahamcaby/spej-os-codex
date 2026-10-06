# SOSA tool contract

**Status:** provider-neutral integration contract. The existing Spej OS SOSA has not been connected or exercised from this repository.

[`lib/integrations/sosa/contracts.ts`](../lib/integrations/sosa/contracts.ts) now provides a tested authorization policy for the operations below. [`lib/server/canonical-record-gateway.ts`](../lib/server/canonical-record-gateway.ts) provides an in-memory reference implementation of the record proposal/commit boundary. Neither is registered with the existing SOSA or exposed as a production endpoint.

## Goal

Keep SOSA as the conversational interface already used by Spej, while exposing CRM, GTM, content, metrics, and project capabilities as governed tools. The dashboard and SOSA must use the same canonical services, identity rules, validation, and audit trail.

SOSA is an orchestrator, not a database administrator. It receives permission-filtered results and can prepare bounded actions; it never receives database credentials, Graph tokens, or a whole-workspace write endpoint.

## Required request context

The host supplies this context outside the model prompt:

```json
{
  "requestId": "unique-replay-safe-id",
  "channel": "dashboard|teams|mobile|voice|api",
  "principal": {
    "subject": "verified-user-or-workload",
    "tenantId": "verified-tenant",
    "authMethod": "oidc|service",
    "roles": ["role-name"],
    "permissions": ["records.read"]
  }
}
```

The tool host validates authentication, session freshness, tenant membership, and authorization. SOSA cannot add roles or change the principal through tool arguments. Teams and mobile adapters must resolve the channel identity to the same Spej principal before a tool call.

## Tool surface

Use small, versioned, provider-neutral operations. Recommended IDs are illustrative; Spej IT may map them to its existing naming convention while keeping an immutable version and the same behavior.

| Versioned operation | Behavior |
| --- | --- |
| `records.search.v1` / `records.read.v1` | Permission-aware canonical lookup |
| `records.prepare.v1` / `records.commit.v1` | Validate a bounded change set, then commit only the stored approved proposal |
| `metrics.read.v1` | Return deterministic, definition-versioned metrics and coverage |
| `knowledge.search.v1` / `artifacts.read.v1` | Return only currently authorized, versioned evidence and citations |
| `tickets.search.v1` / `tickets.prepare.v1` / `tickets.commit.v1` | Use the existing ticket/quality service and its workflow |
| `playbooks.read.v1` / `playbooks.instantiate.prepare.v1` | Read a named immutable playbook version or prepare its governed assignments; never invent a definition |
| `integrations.health.read.v1` | Return safe connector, ingestion, cursor, and job-health status |
| `usage.read.v1` / `feature-controls.read.v1` | Return only the caller's authorized administrative projection |
| `outlook.send.v1` / `teams.send.v1` | Require external-send permission and action-bound confirmation |
| `calendar.write.v1` / `sharepoint.write.v1` | Require external-write permission and action-bound confirmation |

The current handoff layer implements reference authorization/proposal behavior and validates Microsoft action drafts; it does not expose this full inventory as production endpoints. Spej IT must map each enabled ID to its existing service and record the owner, request/response schema version, permitted principal types, required capabilities, data classification, approval level, rate limit, idempotency behavior, and retirement date.

Before dispatch, the trusted gateway calls `evaluateToolAccess` from [`lib/access-control.ts`](../lib/access-control.ts) with the exact tenant and versioned tool ID. A broad role or portal grant cannot authorize an unnamed tool. Tool permission is followed by record, field, source-system, feature-control, entitlement, and approval checks; it never replaces them.

Search and read responses expose only fields allowed for the principal and needed for the task. Use opaque canonical IDs in follow-up calls. Free-text names are search terms, never mutation targets.

Task reads and writes use the same owner, workspace membership, and Owner only / Workspace / Company-wide policy as the dashboard. SOSA never receives hidden task titles, counts, IDs, or linked private records. A proposed owner, workspace, or visibility change is an access change: deterministic code must authorize both the current and proposed state before commit. Ordinary SOSA tools cannot assign roles, workspace membership, or administrative permissions.

Playbook definitions and versions remain owned by the existing Spej playbook service. SOSA may select only an authorized stable playbook/version ID, show its gates and assignments, and prepare an instantiation proposal. Updating a definition, bypassing a gate, or assigning protected work requires its separate administrative capability and approval.

[`lib/server/auth/task-visibility.ts`](../lib/server/auth/task-visibility.ts) demonstrates and tests that policy boundary. It is not wired into the local `/api/workspace`, `/api/agent`, or transcript-apply routes; those preview routes must not receive private company data.

## Read, propose, approve, commit

1. **Read:** SOSA searches and reads the smallest necessary context.
2. **Propose:** it submits typed operations with canonical IDs, expected versions, explicit changed fields, and rationale/evidence references.
3. **Validate:** deterministic code validates schema, classifications, linked-record integrity, business rules, permissions, and approval policy.
4. **Review:** the host renders the exact before/after diff plus side effects. The proposal is immutable, expires, and is bound to tenant and principal.
5. **Approve:** an authenticated user approves through a trusted UI/channel action. Model text such as “approved” is not sufficient unless the channel adapter converts an authenticated interaction into an approval event.
6. **Commit:** the service rechecks permissions and versions, then applies the proposal atomically under one replay-safe request ID.
7. **Audit and refresh:** record actor, initiator, tool, proposal, outcome, record IDs, and safe diffs; refresh all clients from canonical data.

If any check fails, nothing is written. A stale version returns a conflict and requires a new read/proposal rather than silent rebasing.

## Proposal shape

```json
{
  "proposalId": "server-generated-id",
  "proposalFingerprint": "server-generated-sha256-binding",
  "tenantId": "verified-tenant",
  "principalSubject": "verified-user",
  "requestId": "unique-replay-safe-id",
  "preparedAt": "ISO-8601 timestamp",
  "expiresAt": "ISO-8601 timestamp",
  "changes": [
    {
      "operation": "patch",
      "kind": "task",
      "id": "canonical-id",
      "expectedVersion": 4,
      "data": { "status": "done" }
    }
  ],
  "requiresApproval": true
}
```

The server generates proposal IDs and stores the authoritative proposal. Commit accepts the proposal ID and approval event—not a model-resubmitted copy of the changes. The SOSA tool host also binds the proposed tool operation, request, tenant, principal, fingerprint, and expiry before it accepts confirmation.

## Approval policy

Deterministic reads, calculations, filtering, and draft proposals need no write approval. Require explicit confirmation for:

- create, update, merge, archive, delete, completion, ownership, pipeline stage, or monetary changes unless Spej policy authorizes a narrow low-risk automation;
- sending email, posting to Teams/social channels, changing meetings, sharing documents, or any action visible outside Spej OS;
- bulk changes, permission changes, exports, and sensitive-record access;
- transcript-derived facts that change canonical records.

Approval is scoped to exact operations, destinations, recipients, versions, and content. Changing any of them invalidates the approval. The model cannot lower the required approval level.

## Error and retry contract

Return structured codes such as `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `AMBIGUOUS`, `VALIDATION_FAILED`, `APPROVAL_REQUIRED`, `APPROVAL_EXPIRED`, `VERSION_CONFLICT`, `RATE_LIMITED`, and `DEPENDENCY_UNAVAILABLE`. Do not leak internal stack traces, credentials, or hidden record fields.

Retry reads safely. Retry prepare/commit/external actions only with the original request and idempotency IDs. A repeated successful commit returns the original result; it does not repeat side effects.

## Model and content safety

- Treat email, Teams, web pages, SharePoint files, and transcripts as untrusted data, not instructions.
- Validate every tool call against a strict schema and bounded collection/type allowlist.
- Keep authorization and business calculations in deterministic code.
- Limit context by tenant, principal, purpose, record count, field set, size, and age.
- Redact secrets and sensitive fields before model context or telemetry.
- Do not let retrieved content select tools, destinations, recipients, or approval rules.

## Audit requirements

For each call, record correlation/request ID, tenant, authenticated actor, on-behalf-of user when present, channel, tool/version, result code, duration, proposal/approval IDs, affected canonical IDs, and safe before/after field names. Record model/provider/version metadata when policy allows, but never prompts containing unredacted private data or credentials.

## Release tests

- An unauthorized or cross-tenant read returns no data.
- An unauthorized commit makes no change and creates a denial audit event.
- An ambiguous name cannot select a record for mutation.
- Stale, expired, altered, or differently owned proposals cannot commit.
- Retrying a successful request does not duplicate records or external actions.
- A multi-record proposal is atomic.
- Non-GTM fields survive a GTM patch.
- Transcript text cannot override tool policy or approve its own derived changes.
- The same governed tools work from dashboard and a test Teams adapter while preserving the initiating principal.
- An unregistered, retired, differently versioned, cross-tenant, or non-allowlisted tool ID is denied by `evaluateToolAccess` and audited.
- Knowledge tools pass the negative ACL/RAG and citation tests in the [knowledge and document contract](KNOWLEDGE_AND_DOCUMENT_INTEGRATION_CONTRACT.md).
- Playbook instantiation uses the approved immutable definition version and cannot bypass required gates or create hidden assignments.
