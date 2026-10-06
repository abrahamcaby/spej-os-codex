# Spej GitHub handoff

**Status:** private-repository handoff candidate. It contains a working local preview and tested production contracts. It is not a live Microsoft 365, company identity, canonical Spej OS, or existing-SOSA deployment.

**Review destination:** [SpejAI/spej-os-aby-revamp](https://github.com/SpejAI/spej-os-aby-revamp), the independent **Spej OS Aby revamp** repository. Keep the existing `SpejAI/spej-ai-os` production repository untouched. Future updates must begin from the destination's current history, preserve other contributors' work, and use a review branch/pull request where appropriate; never force-push or replace the production repository.

The [September 8 feedback review](RELATIONSHIP_FEEDBACK_REVIEW.md) covers the additive relationship-context update, known production deferrals, and validation scenarios. A local test result does not establish that a commit has been uploaded; record the verified GitHub commit and CI results separately after publication.

The [unified employee workspace vision](UNIFIED_EMPLOYEE_WORKSPACE_VISION.md) adds Aby's product direction: people should be able to find context and complete work from Spej OS. It translates the supplied second-brain reference into proposed workflows, permission boundaries and phased acceptance gates; it does not claim new live integrations.

## Executive and IT handoff index

For the current demo, start with [Demo quickstart](DEMO_QUICKSTART.md), [September 9 improvements](SEPTEMBER_9_LOCAL_PREVIEW.md) and [Mobile readiness](MOBILE_READINESS.md). They cover configurable components, AI discovery, personal/campaign nurture, Blanca, adoption reviews, project progress history and resource links. Preserve the original destination README and `SPEJ_OS_ABY_REVAMP_HANDOFF.md` when publishing.

| Stage | Current decision | Evidence or next action |
| --- | --- | --- |
| Local executive demonstration | Ready after the checks below pass; synthetic data only | Run `npm run demo` and present the product, operating model, and known production boundary |
| Spej-owned private GitHub repository | Use the existing independent revamp repository; this candidate still needs the content, clean-install, review, and ownership gates below | Verify default-branch protection and security controls with IT, and capture CI results for this candidate commit |
| Company production integration | Not supplied by this repository | Spej IT must implement and approve identity, canonical data, SOSA, Microsoft, durable state, audit, observability, recovery, staging, and rollback |

The private repository is the collaboration handoff, not a production approval. Keep that distinction in the repository description, executive demonstration, and first pull request.

## Run the executive handoff

After checking out the candidate commit, run `npm run demo`. The command starts on loopback port 3100 with a new temporary data directory, materializes current-day-relative dates, and opens a populated role-based walkthrough. The gold banner and footer state that every operating record is synthetic. Selecting another **Demo layout** profile demonstrates how the same connected workspace becomes a focused My Work view for leadership, GTM, content, project management, and technical delivery.

The launcher does not read, copy, or overwrite the normal local database. It does not load browser workspace recovery and removes its temporary SQLite workspace when the process stops. The tracked fixture contains no customer records, email addresses, credentials, tokens, or external-system payloads. Do not replace it with an export of real Spej OS data, and do not treat it as a migration seed.

## Immediate private-repository gate

Complete this once on the exact commit proposed for handoff:

1. Review `git status --short` and explicitly include every required new source/test/documentation file. Do not use a blanket add while generated or local files are present.
2. Confirm the repository uses npm only. Commit `package-lock.json`; do not commit pnpm, Yarn, or Bun lock/workspace files.
3. Run the tracked-file safety check before installing dependencies:

   ```bash
   node scripts/repository-check.mjs
   ```

4. From a fresh checkout or clean worktree, run:

   ```bash
   npm ci
   npm run check
   npm run smoke
   ```

5. Record the commit SHA, Node/npm versions, check results, reviewer, and date in the handoff pull request.
6. Verify the repository is owned by the Spej organization, is private or approved internal, has a named technical owner, and has default-branch protection, required review, secret scanning/push protection, and dependency update alerts.
7. Open the app from the candidate commit and verify the visible version/boundary language still identifies it as a preview—not as the production Spej OS.
8. Track every incomplete production requirement as owned IT work; do not remove the production startup guard to make a deployment appear successful.

### Toolchain follow-up

ESLint `9.39.5` is pinned because the React lint plugin currently brought in by `eslint-config-next@16.3.4` crashes under ESLint 10. ESLint 9 is now end-of-life, so this is a visible maintenance item rather than a permanent exception. Spej IT should retest and upgrade as soon as the Next.js lint dependency chain supports ESLint 10 cleanly; do not suppress peer-dependency warnings or remove linting to make that upgrade appear green. See the [ESLint version-support policy](https://eslint.org/version-support/).

## Repository ownership and visibility

Retain the existing destination under Spej's GitHub organization. Verify Spej administrators, branch protection, required reviews, security scanning, and a named technical owner with IT; these are acceptance requirements, not claims that those settings are already enabled. Organization ownership is separate from visibility: because this code is intended to connect to internal systems, use a **private or approved internal repository** unless Spej completes a separate public-release review.

## What to put in the repository

Include the application source, `package-lock.json`, `.env.example`, `.env.production.example`, the synthetic `fixtures/executive-demo-workspace.json`, tests, GitHub workflows, README, and `docs/`.

Do not include local databases, `.env.local`, credentials, OAuth tokens, meeting transcripts, exports, backups, private screenshots, or real customer/employee data. The existing ignore rules exclude local state and `.env*` values while explicitly allowing the two placeholder environment templates.

The package metadata no longer points to the original public Control Center repository. Some development checkouts still retain that public source as `upstream`; never publish Spej work there. In a new, independently prepared checkout with no existing `origin`, use the approved review destination:

```bash
git remote add origin https://github.com/SpejAI/spej-os-aby-revamp.git
```

## First review

1. Review the interface and terminology with GTM, delivery, leadership, and the current Spej OS owner.
2. Run `npm ci`, `npm run check`, and `npm run smoke` on Node 24.19 or newer.
3. Approve the [data ownership matrix](DATA_OWNERSHIP_MATRIX.md) and map each record/field to the actual Spej OS source of truth.
4. Complete a field-and-workflow parity map for existing project views, tickets/quality, files, decisions, time tracking, enterprise records, and playbooks. Decide whether each appears here as a projection, link, or retained Spej OS screen before removing anything.
5. Approve the [knowledge and document contract](KNOWLEDGE_AND_DOCUMENT_INTEGRATION_CONTRACT.md), including negative ACL/RAG tests, sensitivity labels, versioned citations, deletion, re-indexing, and source health.
6. Choose the production web, PostgreSQL/canonical API, queue/worker, audit, secret, monitoring, backup, recovery, and existing-service registry. Resolve every required service ID in `.env.production.example` and define its health check.
7. Approve the [task visibility and access model](ACCESS_CONTROL_AND_TASK_VISIBILITY.md), map Entra identities/groups to explicit roles and workspace membership, and review legacy tasks that default to Owner only.
8. Make production Home identity-backed: derive its viewer from the verified Entra/Spej principal, never a browser-selected profile. Keep role permissions separate from optional home-layout preferences.
9. Confirm Today as a deterministic projection over canonical tasks and record-linked next actions, then choose the canonical task system before any bidirectional task synchronization.
10. Register the versioned [SOSA tools](SOSA_TOOL_CONTRACT.md) with the existing agent and preserve the authenticated initiating user outside model text.
11. Approve the [Agentic Spej OS blueprint](AGENTIC_SPEJ_OS_BLUEPRINT.md), especially the separate tenant-scoped machine-work queue, trusted evidence receipts, capability health, budgets, immutable automation versions, and patterns explicitly rejected from the reference architecture.
12. Implement the [Microsoft contract](MICROSOFT_INTEGRATION_CONTRACT.md) against a non-production tenant before enabling any company resource.
13. Prove one transcript flow end to end: governed artifact reference, permission-filtered evidence, extraction, review, record-specific provenance, atomic commit, retry, and audit. Production must not promote the local plaintext transcript store.
14. Map existing tenant entitlements, feature controls, AI usage/cost reporting, and connector kill switches; test them before enabling a pilot cohort.
15. Follow the [deployment runbook](DEPLOYMENT_RUNBOOK.md) and [migration/rollback plan](MIGRATION_AND_ROLLBACK.md); begin read-only and enable writes by small domain/cohort only after reconciliation.
16. Review the [existing Spej OS compatibility matrix](EXISTING_SPEJ_OS_COMPATIBILITY.md) and assign an owner for every retained service before removing or replacing any current screen.

## Integration boundary already supplied

- Provider-neutral, minimized integration events and adapter interfaces.
- Microsoft Teams, Outlook, calendar, transcript, and SharePoint reference mappers.
- Exact outbound-action draft validation; no send or write executor.
- Verified-principal and production-environment validation references.
- Permission-aware read → prepare → approve → atomic commit semantics with version checks, proposal binding, idempotency, and audit evidence.
- SOSA authorization policy separate from model output.
- Event deduplication, leases, bounded retry, dead-letter, redaction, and safe cursor-advance semantics.
- Deterministic, explainable opportunity priority scoring from reviewed CRM facts.
- One verified principal and one set of canonical record IDs across Home, Teams, Outlook, SharePoint/OneDrive, and SOSA.
- Reference-based linking of Microsoft files and transcripts to accounts, opportunities, projects, and tasks while Microsoft remains the content source of truth.
- A permission-aware knowledge/document contract with immutable artifact versions, citations, source health, deletion/re-index rules, and negative ACL/RAG acceptance tests. No knowledge adapter is implemented here.
- A fail-closed production configuration manifest for the existing canonical-record, knowledge, ticket/quality, feature-control, and usage-reporting services. Declaring a service ID does not prove that its adapter or health check exists.

The gateway and event stores in this repository are in-memory reference implementations and are not connected to the current UI routes. IT must replace them with durable adapters and then disable the local whole-workspace mutation path in production.

## Definition of ready for company use

Company deployment is ready only after identity-backed Home; identity/RBAC; canonical record and task ownership; tenant isolation; parity for tickets, quality, files, decisions, time, enterprise records, and playbooks; Microsoft consent and resource limits; permission-aware knowledge retrieval; an audited transcript flow; versioned SOSA tools; durable storage/queues/audit; dependency health; feature controls; usage/entitlement reporting; backup/restore; migration reconciliation; staging; rollback; and security release gates have passed. A successful local build or valid environment file alone is not production approval.
