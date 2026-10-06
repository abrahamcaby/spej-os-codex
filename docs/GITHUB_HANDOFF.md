# Spej GitHub handoff

**Publication baseline — verified September 21, 2026:** PR #5 is merged into `main` at `87f722a7f18546d953d472a37de19acca38d0900`, including the custom-provider application commit `8e9f27c`. Use main for the merged preview. Historical instructions to keep that PR unmerged no longer describe its status; production activation remains separate engineering work.

**Status:** private-repository handoff candidate. It contains a working local preview and tested production contracts. It is not a live Microsoft 365, company identity, canonical Spej OS, or existing-SOSA deployment.

**Direction update — September 17, 2026:** build Spej OS as a standalone company operating system, not as a mandatory replacement interface over the existing production system. This supersedes inherited requirements to reuse existing Spej OS services or its SOSA runtime. Keep those contracts as optional integration/migration references; leave the current production system untouched. The new build still requires verified identity, canonical record ownership, durable storage, authorization, approval/audit, and all production release gates. Microsoft Graph and Plooms are not connected.

**Review destination:** [SpejAI/spej-os-aby-revamp](https://github.com/SpejAI/spej-os-aby-revamp), the independent **Spej OS Aby revamp** repository. Keep the existing `SpejAI/spej-ai-os` production repository untouched. Future updates must begin from the destination's current history, preserve other contributors' work, and use a review branch/pull request where appropriate; never force-push or replace the production repository.

The [September 8 feedback review](RELATIONSHIP_FEEDBACK_REVIEW.md) covers the additive relationship-context update, known production deferrals, and validation scenarios. A local test result does not establish that a commit has been uploaded; record the verified GitHub commit and CI results separately after publication.

The [unified employee workspace vision](UNIFIED_EMPLOYEE_WORKSPACE_VISION.md) adds Aby's product direction: people should be able to find context and complete work from Spej OS. It translates the supplied second-brain reference into proposed workflows, permission boundaries and phased acceptance gates; it does not claim new live integrations.

## Executive and IT handoff index

The [Agentic CRM recommendations](AGENTIC_CRM_RECOMMENDATIONS.md) are the September 21 prioritization addendum to the existing agentic blueprint. They distinguish current preview behavior from proposed Outreach, account-scoped SOSA, read-only ingestion and bounded background work, with explicit acceptance criteria. Adding or merging these recommendations does not implement or activate those features.

The [Custom Background AI handoff](CUSTOM_BACKGROUND_AI.md) adds an IT-owned extension point for Plooms or another approved provider. Settings can select Custom, but the default host has no adapter; no live custom inference, credentials, or web research is enabled. IT supplies the verified provider contract, approved models, authorization and usage controls. This is separate from SOSA.

The [Connections and integrations handoff](CONNECTIONS_AND_INTEGRATIONS.md) covers the latest Settings update: personal/company connection planning, Microsoft 365/Granola/Plaud capability requests, profile-local persistence, an export for IT review, and the tested server readiness boundary. No live sign-in, Graph/MCP client, registered adapter or background sync is supplied. Follow its implementation sequence and activation gates before connecting company data.

For the current demo, start with [Company OS planning and demo instructions](COMPANY_OS_PLANNING.md) and [Project work layout](TASK_WORK_LAYOUT.md). [Demo quickstart](DEMO_QUICKSTART.md), [September 9 improvements](SEPTEMBER_9_LOCAL_PREVIEW.md), and [Mobile readiness](MOBILE_READINESS.md) remain useful earlier feature references; their older launch instructions are not the current front door. Preserve the destination's history and other contributors' work, including its original handoff material, when publishing.

| Stage | Current decision | Evidence or next action |
| --- | --- | --- |
| Local executive demonstration | Ready after the checks below pass; synthetic data only | Run `npm ci`, then `npm run company-demo -- --dev --port=3102`; present the product and known production boundary |
| Spej-owned private GitHub repository | Use the existing independent revamp repository; this candidate still needs the content, clean-install, review, and ownership gates below | Verify default-branch protection and security controls with IT, and capture CI results for this candidate commit |
| Standalone company production deployment | Not supplied by this repository | Spej IT must select, implement, and approve identity, canonical data, SOSA/provider integration, Microsoft, durable state, audit, observability, recovery, staging, and rollback |

The private repository is the collaboration handoff, not a production approval. Keep that distinction in the repository description, executive demonstration, and first pull request.

## Run the executive handoff

After checking out the candidate commit, run:

```bash
npm ci
npm run company-demo -- --dev --port=3102
```

Open `http://127.0.0.1:3102/?tab=today`. This starts a loopback-only walkthrough with a temporary synthetic company database. Selecting another demo profile demonstrates focused views over the same workspace; it is not company sign-in or authorization. My Work keeps actionable work first, optional Work schedule collapsed below it, and the detailed Calendar separate. See [Company OS planning](COMPANY_OS_PLANNING.md) for the full walkthrough and known limitations.

The launcher does not read, copy, or overwrite the normal local database. It does not load browser workspace recovery and removes its temporary SQLite workspace when the process stops; browser-saved planning preferences and blocks persist separately. The tracked fixture contains no real customer records, credentials, tokens, or external-system payloads. Do not replace it with an export of real Spej OS data, and do not treat it as a migration seed.

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
3. Approve the [data ownership matrix](DATA_OWNERSHIP_MATRIX.md) and designate the new build's canonical owner for each record/field. Any reuse of an existing service is an explicit engineering decision, not an assumed dependency.
4. Define acceptance coverage for project views, tickets/quality, files, decisions, time tracking, enterprise records, and playbooks. If a later migration or replacement is separately approved, complete field-and-workflow parity and reconciliation before touching any existing system.
5. Approve the [knowledge and document contract](KNOWLEDGE_AND_DOCUMENT_INTEGRATION_CONTRACT.md), including negative ACL/RAG tests, sensitivity labels, versioned citations, deletion, re-indexing, and source health.
6. Choose the production web, PostgreSQL/canonical API, queue/worker, audit, secret, monitoring, backup, recovery, and service registry. Reconcile inherited service IDs in `.env.production.example` and its validator with the approved standalone architecture; implement and health-check every required dependency without bypassing the startup guard.
7. Approve the [task visibility and access model](ACCESS_CONTROL_AND_TASK_VISIBILITY.md), map Entra identities/groups to explicit roles and workspace membership, and review legacy tasks that default to Owner only.
8. Make production Home identity-backed: derive its viewer from the verified Entra/Spej principal, never a browser-selected profile. Keep role permissions separate from optional home-layout preferences.
9. Confirm Today as a deterministic projection over canonical tasks and record-linked next actions, then choose the canonical task system before any bidirectional task synchronization.
10. Register the versioned [SOSA tools](SOSA_TOOL_CONTRACT.md) with the runtime selected for the new build and preserve the authenticated initiating user outside model text. Confirm the Plooms execution and/or usage contract before implementing that adapter.
11. Approve the [Agentic Spej OS blueprint](AGENTIC_SPEJ_OS_BLUEPRINT.md), especially the separate tenant-scoped machine-work queue, trusted evidence receipts, capability health, budgets, immutable automation versions, and patterns explicitly rejected from the reference architecture.
12. Implement the [Microsoft contract](MICROSOFT_INTEGRATION_CONTRACT.md) against a non-production tenant before enabling any company resource.
13. Prove one transcript flow end to end: governed artifact reference, permission-filtered evidence, extraction, review, record-specific provenance, atomic commit, retry, and audit. Production must not promote the local plaintext transcript store.
14. Implement approved tenant entitlements, feature controls, AI usage/cost reporting, and connector kill switches; test them before enabling a pilot cohort.
15. Follow the [deployment runbook](DEPLOYMENT_RUNBOOK.md); begin with synthetic staging data and enable writes by small domain/cohort only after the release gates pass. Apply the [migration/rollback plan](MIGRATION_AND_ROLLBACK.md) only to a separately approved migration; rollback and recovery are required for the new build regardless.
16. Treat the [existing Spej OS compatibility matrix](EXISTING_SPEJ_OS_COMPATIBILITY.md) as a historical comparison and optional migration reference, not a mandate to attach this build to production. No current screen or service is authorized for removal by this handoff.

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
- An inherited fail-closed production configuration manifest for canonical-record, knowledge, ticket/quality, feature-control, and usage-reporting services. IT must reconcile its service selections with the standalone architecture. Declaring a service ID does not prove that its adapter or health check exists.

The gateway and event stores in this repository are in-memory reference implementations and are not connected to the current UI routes. IT must replace them with durable adapters and then disable the local whole-workspace mutation path in production.

## Definition of ready for company use

Company deployment is ready only after identity-backed Home; identity/RBAC; canonical record and task ownership; tenant isolation; acceptance coverage for tickets, quality, files, decisions, time, enterprise records, and playbooks; Microsoft consent and resource limits for enabled connectors; permission-aware knowledge retrieval; an audited transcript flow; versioned SOSA tools; durable storage/queues/audit; dependency health; feature controls; usage/entitlement reporting; backup/restore; staging; rollback; and security release gates have passed. Any separately approved migration also requires parity and reconciliation. A successful local build or valid environment file alone is not production approval, proof of upload, or a GitHub CI result.
