# Existing Spej OS compatibility

**Direction update — September 17, 2026:** this is now a historical comparison and optional migration reference. The approved direction is a standalone new company OS, not mandatory reuse of current production Spej OS. That direction supersedes the reuse recommendations below; the matrix is not a verified inventory of connected dependencies. Leave existing production untouched. If migration or service reuse is separately approved, retain the compatibility, authorization, canonical ownership, approval/audit, and reconciliation gates here. The new build independently requires the [production architecture](PRODUCTION_ARCHITECTURE.md) and [deployment gates](DEPLOYMENT_RUNBOOK.md).

For the current synthetic walkthrough, run `npm ci`, then `npm run company-demo -- --dev --port=3102`; see [Company OS planning](COMPANY_OS_PLANNING.md). Microsoft Graph and Plooms are not connected. This document does not establish production readiness or a completed upload.

**Purpose:** keep the original Spej OS foundations while adding a simpler, role-based interface for company work and a focused GTM workspace.

**Current state:** this repository is a working demo and integration specification. It does not replace or claim to be connected to the existing production services.

## Historical implementation recommendation (superseded as the default)

Use the existing Spej OS services as the production foundation. Add this repository's navigation, role-based My Work experience, GTM workflows, metrics, content operations, and reviewed SOSA actions as a new interface over the same canonical IDs and permissions.

Do not run two independent CRMs, project databases, task systems, permission systems, or knowledge indexes.

## Compatibility matrix

| Existing Spej OS capability | What this project adds or changes | Company implementation |
| --- | --- | --- |
| SOSA chat, voice, transcripts, prompts, and playbooks | SOSA-first entry point plus reviewed record actions across CRM, GTM, Projects, content, and work | Register the versioned SOSA tool inventory with the existing agent. Keep existing playbook definitions authoritative and preserve the authenticated user, tenant, tool scopes, approval, and audit on every channel. |
| Existing `global_admin`, `super_admin`, `user`, and `service_department` role IDs, including any current Admin/Super Admin UI labels | Role-based home layouts plus separate, narrower capabilities and data scopes | Preserve the existing role IDs and semantics during migration. Create an approved crosswalk from platform/global administration, company administration, standard user, and service delivery into explicit capabilities, modules, teams, records, fields, and time limits. The preview role names are a proposed access design, not a direct runtime replacement. |
| Per-user restricted-document and AI-agent controls | Portal, record, field, action, and temporary-access policy | Enforce all decisions on the server before returning records, counts, search results, files, or model context. Explicit deny overrides allow. |
| Access duration and user lifecycle | Time-bound team, project, GTM, contractor, and confidential-record grants | Use start/expiry timestamps, automatic revocation, access review, and an audit event. Never rely on a browser-selected profile. |
| Organization and team structure | My Work modules for leadership, GTM, projects, content/review, and technical delivery | Use stable Entra/Spej subject, profile, team, and manager IDs. Mixed responsibilities can receive more than one home module. |
| Company module feature controls | Clear top-level My Work, SOSA, CRM, GTM, and Projects navigation | Keep module flags and add cohort/tenant/action kill switches for rollout. Hiding a page is not authorization. |
| AI model selection, presentation generation, and white-label controls | A provider-neutral SOSA/tool boundary and Spej-branded shell | Keep the existing administrative controls authoritative. Map the approved model provider and presentation service behind the SOSA tool contract, preserve company branding settings, and expose status or a governed deep link instead of rebuilding the control plane in this shell. |
| CRM companies, people, stages, notes, and Microsoft activity | One CRM with Accounts, People, and Activity; account details connect opportunities, partners, projects, follow-up plans, and meeting sources | Map to canonical CRM IDs. Preserve legacy status/history. Keep account lifecycle, opportunity stage, project status, partner role, and account/person/opportunity source as separate fields. |
| Project grid, Kanban, Gantt, phases, milestones, time tracking, and client links | Company Projects view, role-based work, GTM-filtered initiatives, and clearer cross-links | Keep existing project records and views. Add shared work, risks, decisions, files, quality, and tickets through canonical references. Discovery/Design/Delivery is one optional playbook, not the universal project model. |
| Tickets, assignments, priorities, due dates, types, and client conversations | Tickets and quality items surfaced in the related project and My Work | Keep the current ticket service authoritative. Map ticket owners, status, links, and visibility; do not duplicate issues as unlinked tasks. |
| Enterprise management scorecards, goals, to-dos, issues, headlines, and meetings | Simpler role and workspace views over shared records | Retain useful records after field-by-field review. Consolidate duplicate tasks, projects, metrics, and meetings instead of maintaining parallel modules. |
| SharePoint, OneDrive, file share, Google Workspace, REST, and Azure SQL source options | Record-linked files and source-health coverage in the work interface | Reuse existing connector service. Use allowlisted resources, stable provider IDs, delta sync, reconciliation, and reference-first file storage. |
| Outlook email, calendar, and contacts to CRM | Approved activity, meeting, contact, and follow-up mapping | Reuse or extend the existing Microsoft connector. Unknown people and uncertain record matches go to review. External sends and calendar changes require separate permission and confirmation. |
| Teams recordings, transcripts, chats, channels, and files | Meeting-to-record intake with proposed decisions, tasks, CRM updates, project updates, tickets, and content ideas | Store the governed transcript reference and attach exact evidence to every derived proposal. Deterministic code validates required fields, ownership, links, dates, permissions, versions, idempotency, and metrics eligibility before commit. |
| Document processing, transcript metadata, vector indexing, and knowledge retrieval | Linked evidence available from accounts, opportunities, projects, tasks, tickets, and SOSA | Keep the existing permission-aware knowledge layer and implement the [knowledge/document contract](KNOWLEDGE_AND_DOCUMENT_INTEGRATION_CONTRACT.md). Store locators, versions, labels, provenance, citations, and approved derived facts; do not copy every private document into CRM records. |
| Tenant-scoped API and MCP access | Versioned record tools for the dashboard, SOSA, Teams, mobile, and approved integrations | Retain scoped keys, tool allowlists, rate limits, rotation, revocation, OAuth where appropriate, and per-call audit. Remove or rotate obsolete test credentials before production. |
| Signed inbound and outbound webhooks | Replay-safe notifications and integration events | Validate tenant, subscription, resource, signature, timestamp, size, and event type; enqueue processing and reconcile with the source. |
| Audit logs | Read, proposal, approval, commit, access-change, connector, and external-action history | Use an append-only company audit service with correlation IDs and safe diffs. Users cannot edit audit events. |
| Scheduled-job inspection, failure history, snapshots, and remediation | Source health and coverage shown alongside derived information | Keep job monitoring and add alerts for sync lag, renewal failures, dead letters, duplicate drift, and missing coverage. SOSA must not claim that the knowledge base is complete when sources are unhealthy. |
| Email-based two-factor administration | Microsoft Entra-backed company sign-in target | Spej IT should select and enforce the approved MFA/session policy. Authentication alone does not replace record-level authorization. |
| Light and dark branding plus mobile app link | Spej-branded responsive dashboard and dark-mode demo | Reuse approved company logos, fonts, colors, and application packaging. Mobile and Teams use the same APIs, permissions, actions, and records as the web interface. |
| AI usage, cost, tenant plan, and entitlements | Deterministic-versus-model boundary and task-level model provenance | Keep administrative usage and entitlement services. Record model, version, prompt/tool policy, latency, outcome, and safe token/cost metadata; enforce tenant quotas and feature access outside model text. |

## Compatibility acceptance gates for a separately approved migration

Before replacing any existing screen or enabling writes:

- map project grid/Kanban/Gantt, milestones, decisions, files, tickets, quality, time, enterprise records, and playbook assignments field by field; mark each as a projection, deep link, or retained screen;
- prove the same tenant, principal, canonical IDs, permissions, history, and non-GTM fields resolve in both interfaces;
- pass the knowledge contract's negative ACL/RAG, versioned-citation, deletion, re-index, and health tests;
- prove one transcript flow from source artifact through reviewed, record-specific evidence, atomic commit, retry, and audit without promoting a plaintext local copy;
- resolve and health-check the canonical-record, knowledge, ticket/quality, feature-control, and usage-reporting services declared by production configuration;
- verify feature flags, connector/action kill switches, tenant entitlements, and AI usage/cost reporting for the pilot and rollback cohorts.

## What is intentionally improved

- My Work is the default employee view: assigned tasks, deadlines, approvals, risks, and relevant updates across every authorized workspace.
- CRM is the single company record. GTM and Projects are focused views, not separate data stores.
- GTM groups sales, partners, marketing, content, work, performance, and intelligence in terms a small team can use.
- Role-based layouts are separate from authorization. A person's home can change without granting access to hidden records.
- Tasks, projects, opportunities, content, files, transcripts, tickets, and activities use explicit links instead of duplicated notes.
- SOSA reads only authorized context, prepares structured proposals, explains changes, and commits through deterministic tools after the required review.
- Connector health and data coverage are visible so users can distinguish current information from stale, partial, or unavailable information.

## Migration rule if separately approved

Run the new interface read-only against a non-production copy first. Compare representative users, records, counts, stages, permissions, links, and source health with the current Spej OS. Enable narrowly scoped writes only after the result matches, then roll out by role and function behind feature flags.

The current Spej OS remains available during the staged rollout and rollback window.
