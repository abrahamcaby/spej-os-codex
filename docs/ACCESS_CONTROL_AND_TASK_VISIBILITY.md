# Access control and task visibility

**Status:** product and integration contract. The local preview demonstrates the intended screens with non-sensitive demo data. It does not authenticate users or enforce company security.

## What each task carries

- **Owner:** the person responsible for completing it. Production uses a stable Spej profile ID; the display name is not an authorization key.
- **Workspace:** GTM, Project Management, or Company. A linked project's work area remains authoritative.
- **Category:** the business type, such as Sales, Content, Operations, or Project Work. Category never grants access.
- **Who can see it:** Owner only, Workspace members, or Company-wide. Missing legacy values default to Owner only.

Subtasks inherit the parent task's workspace and visibility. Shared subtasks may have a different owner and deadline; Owner-only subtasks retain the parent owner so the task group cannot split into mutually hidden work.

## Intended user experience

In the local demo, Today defaults to work assigned to the previewed profile. In production, it defaults to the signed-in person's assigned work. **Shared work** shows only Workspace or Company-wide tasks the profile may read; visibility alone does not make a task an assignment. It never means every task in the company.

Task lists are grouped by category by default and can be grouped by owner or left ungrouped. Every open row shows workspace, category, owner, visibility, status, priority, and deadline; completed rows retain the core access and ownership labels.

## Administration

An access administrator assigns:

- a starting role and team or department membership;
- portal/module access;
- data scope: own, assigned, team, selected records, or company;
- capabilities: view, create, edit, approve, export, delete, or administer;
- exact record and protected-field access;
- any temporary access expiration;
- any explicit denial.

Leadership and access administration do not automatically expose private task details. Any emergency private-record access must be a separate, time-bound, audited permission.

The existing Spej OS identity concepts remain valid. Tenant Super Admin, company Admin, User, and Service Department identities map to configurable roles; none is implemented as an undocumented bypass. Per-user restricted-document, AI-agent, Microsoft 365, Teams, and file toggles remain additional controls. Existing module feature flags are evaluated before role access.

## Reference policy included in this repository

[`lib/access-control.ts`](../lib/access-control.ts) is a deny-by-default reference evaluator. It separates a person's role from their effective permissions and supports:

- tenant boundaries and revoked human or service identities;
- role rules plus direct grants or denials;
- separate portal visibility and record/action authority;
- portal, capability, data-scope, record, team, and field restrictions;
- exact-record access for confidential records;
- temporary grants with start and expiration times;
- denial precedence;
- plain-language decisions with matching policy IDs for audit records;
- invalid, expired, future, and unknown-role policy evidence for troubleshooting;
- filtering records before search, counts, RAG, or SOSA receives context.

[`components/access-management-panel.tsx`](../components/access-management-panel.tsx) is a controlled reference interface for role checkboxes, effective portal access, existing per-user feature toggles, exact grants, denials, and expiration. It does not persist security decisions. A production host must save changes through an authenticated access-management service and then reload effective access from the server.

### Integration API

The production server loads an `AccessSubject`, its tenant-owned `AccessRole` definitions, and an `AccessTenantPolicy` from trusted storage. Use:

- `evaluatePortalAccess` before returning a module or allowing a module action;
- `evaluateRecordAccess` before returning or changing one record;
- `evaluateFieldAccess` for protected values after record access succeeds;
- `evaluateToolAccess` for exact tenant-scoped SOSA, MCP, and API tool allowlists;
- `filterAuthorizedRecords` as reference behavior for SOSA, search, retrieval, totals, and summaries;
- `explainEffectivePortalAccess` for the administration screen.

These helpers are policy reference code, not authentication, persistence, a database row-security implementation, or a replacement for existing Spej OS administration.

The Settings screen is an interactive design preview. Its safe sample roles use assigned/team scope for regular GTM, project, and Service Department users. Portal switches affect navigation only; separate controls demonstrate added data scopes and actions. It also demonstrates a service principal, tool allowlists, confidential-record grants, identity expiration/revocation, per-user feature switches, company module flags, and an access-change audit preview. These browser-only settings reset with the demo and are not production permissions.

### How existing integrations fit

- **Microsoft 365, Teams, SharePoint, and files:** source-system access and Spej access are intersected. Spej never broadens a Microsoft restriction. Documents, transcripts, and messages carry tenant, record, team, and confidentiality metadata.
- **SOSA, search, and RAG:** authorize canonical records before creating snippets, totals, citations, embeddings for a response, or model context. SOSA uses the signed-in person's effective access for every tool call and reauthorizes before a write.
- **MCP and API keys:** represent each key as a tenant-scoped service principal. Tool allowlists can be exact `tool` record grants; revocation closes the principal through tenant policy. Rate limits, signature checks, and credential rotation remain gateway controls.
- **Feature flags:** pass disabled modules through the tenant policy before evaluating a role.
- **Playbooks, signals, jobs, and webhooks:** run as named service principals with the minimum required rules. Scheduled-job health, HMAC verification, and rate limits stay in their existing operational services.
- **Audit:** log access changes, temporary-grant expiry, explicit denials, confidential-record access, SOSA tool decisions, exports, and administrative actions using the matching rule IDs returned by the evaluator.

## Administration experience

An administrator should be able to select a person or service account, check one or more starting roles, turn portals on or off, add an exact project/account/file grant, choose capabilities, and set an expiration. The screen must also show the final effective access so overlapping roles and denials are understandable.

Recommended safeguards:

1. Deny by default for new identities.
2. A denial always wins over a role or direct grant.
3. Confidential records require an exact active record grant; even access administrators cannot read them automatically.
4. Protected fields require a separate field grant.
5. Temporary grants expire server-side without relying on a browser session.
   Identity-level expiration must also end role access, direct grants, and connected features together.
6. Removing a user or revoking an API key invalidates sessions and queued agent work.
7. Display names are never authorization keys.

## Production enforcement

Spej IT must enforce access before records, titles, counts, search results, Today calculations, or SOSA context leave the server:

1. Map the verified Microsoft Entra subject to a stable Spej profile.
2. Load server-controlled permissions and workspace memberships.
3. Authorize every read and mutation against the current record.
4. Reauthorize proposed owner, workspace, or visibility changes before commit.
5. Filter SOSA context with the same policy; model text cannot grant access.
6. Audit grants, denials, policy changes, approvals, and commits.
7. Apply tenant and coarse access filters in the database, then evaluate record and field policy before serialization.
8. Recheck the source system's current access for linked Microsoft files and transcripts.

The current whole-workspace API, local SOSA action path, local access-management callbacks, and SQLite store do not enforce this contract. They must be replaced by authenticated, record-level production services before private company data is used. The policy helpers in this repository are tested reference code for that integration, not a live authorization layer.
