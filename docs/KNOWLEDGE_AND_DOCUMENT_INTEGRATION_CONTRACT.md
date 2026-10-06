# Knowledge and document integration contract

**Status:** production integration contract. This repository does not implement or replace the existing Spej OS document-processing, vector, or knowledge services.

## Boundary

Microsoft 365 or another approved source remains authoritative for document content. Spej OS keeps a permission-aware artifact reference and derived knowledge; CRM, GTM, Projects, My Work, and SOSA show authorized projections over the same IDs. Do not copy whole libraries, transcripts, or private file bodies into CRM records or this application's production database.

Each artifact reference must include:

- tenant, provider, resource scope, stable external object ID, and canonical `artifactId`;
- immutable `artifactVersionId`, external version, checksum when permitted, and observed time;
- authorized source URL or locator, media type, display-safe title, and source owner;
- sensitivity/retention labels, ACL policy version, and allowed record links;
- ingestion state (`queued`, `processing`, `ready`, `failed`, `stale`, `deleted`), last successful processing time, and a safe error code.

Links use canonical account, opportunity, project, task, ticket, meeting, or content IDs. A new source version creates a new artifact version; it does not silently rewrite earlier evidence or citations.

## Authorization and retrieval

Source access and Spej access are intersected. Before returning an existence signal, title, count, snippet, chunk, citation, embedding-derived result, summary, or model context:

1. authenticate the initiating person or service principal and tenant;
2. run `evaluateToolAccess` for the exact versioned knowledge tool;
3. authorize the linked canonical records and protected fields;
4. recheck current source-system access and sensitivity policy;
5. retrieve only the smallest authorized evidence needed.

Post-filtering model context is not sufficient. Unauthorized content must not enter prompts, embeddings used across permission boundaries, caches, logs, totals, or answer citations. Revocation must take effect at query time even if an older index entry remains physically present.

Every returned evidence item includes `artifactId`, `artifactVersionId`, a fragment locator such as page/section/time range, source and observation timestamps, current ingestion status, and a safe open-source link. SOSA must distinguish source text, approved derived facts, and model inference, and must disclose stale or incomplete coverage.

## Ingestion, deletion, and re-indexing

- Connectors normalize stable IDs and versions, deduplicate retries, and advance cursors only after durable processing.
- Parsing, malware checks, classification, chunking, embeddings, and graph updates run in durable workers with bounded retries and dead-letter handling.
- A changed document produces a new immutable version and re-index job. Results cite the version actually used.
- Source deletion or access revocation creates a tombstone, removes the item from retrieval immediately, and queues policy-approved purge or retention handling. Audit evidence remains immutable and content-minimized.
- Re-indexing is tenant/resource/version scoped, idempotent, observable, and reversible. It must not broaden permissions or restore deleted content.

## Meeting transcripts and derived records

A production meeting intake stores the governed transcript artifact reference, not an uncontrolled local body copy. Each extraction run records the transcript version, model/tool version, processing status, and correlation ID. Every proposed decision, task, follow-up, CRM change, project change, ticket, or content idea carries the exact evidence reference or time range. Deterministic validation checks identity, record links, owners, dates, permissions, versions, idempotency, and approval policy before any commit.

## Health and operating evidence

The existing job-health service remains authoritative. Surface permission-sync lag, ingestion lag, failed/dead-letter jobs, stale indexes, subscription expiry, re-index progress, and coverage cutoff without exposing document content. Production readiness must fail when a required knowledge dependency is unavailable; a degraded source must never be presented as complete coverage.

## Acceptance tests

- Cross-tenant or unauthorized searches reveal no title, count, snippet, citation, embedding result, or existence signal.
- Revoked source or Spej access disappears before the next retrieval and cannot be recovered from cache or SOSA history.
- Restricted fields and confidential records require their exact active grants; broad portal access is insufficient.
- Search, RAG, citations, and open-source links resolve to the same authorized artifact version and fragment.
- Deleted, superseded, quarantined, or stale versions behave according to approved retention and freshness rules.
- Sensitivity labels, record links, and ACL policy versions survive ingestion, re-indexing, and reconciliation.
- Retrieved prompt-injection text cannot choose tools, recipients, destinations, approval rules, or permissions.
- Transcript-derived changes remain reviewable, source-linked, atomic, idempotent, and auditable.
- Knowledge outage, lag, dead letters, and incomplete coverage appear in dependency health and block unsupported completeness claims.
