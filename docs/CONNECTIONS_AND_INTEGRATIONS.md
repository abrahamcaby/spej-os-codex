# Settings → Integrations & connections

## What this release actually does

The standalone Spej OS preview now has one place to plan personal and company connections. The initial catalog covers Outlook mail, Outlook calendar, Teams, SharePoint, OneDrive, Granola, and Plaud. It does not authenticate those accounts or synchronize their data.

Employees can select desired read/write capabilities, save a profile-scoped connection plan in this browser, and copy or download a minimized JSON handoff. A company-scope selection is a request for IT review, not an administrator approval. The preview's person selector changes the local planning view; it is not authentication. Browser-local plans are not a company database, access-control boundary, or support-ticket submission.

The plan contains allowlisted provider IDs, scope, and requested capability IDs. It does not accept passwords, API keys, private messages, arbitrary MCP endpoints, or customer files. Exported plans are explicitly planning-only and confer no production authority. IT must never treat an imported plan, its profile ID, or a browser-selected capability as permission to execute anything.

The older Daily Brief bridge is preserved under **Advanced · Local summary bridge**. It accepts minimized summaries from separately authorized local tooling; adding source labels still does not connect a provider. Its settings and save action are independent of the new connection plan. Connecting a provider in ChatGPT or Codex does not give the standalone Spej OS app that access.

## Code entry points

- `components/connections-settings.tsx`: personal/company views, capability planning, local persistence, and handoff export.
- `lib/integrations/connection-catalog.ts`: provider catalog, functional capabilities, intended destinations, implementation boundaries, and setup steps.
- `lib/integrations/connection-plan.ts`: strict plan normalization, profile separation, and minimized export. This is not an approval store.
- `lib/server/connection-runtime.ts`: injectable, read-only runtime readiness registry for a trusted server host. There are no registered live adapters or authenticated application routes in this release. It reports readiness only after the identity, authorization, adapter capability, and health checks succeed; it never enables writes.
- `lib/integrations/adapter.ts`: provider-neutral health, incremental-read, and approved-external-action interface.
- `lib/integrations/microsoft/`: tested event mappings and action-draft validation. No Graph client or executor.
- `lib/server/integration-event-store.ts`: tested in-memory reference for deduplication, retries, claims, and cursors. Replace with durable storage before production.

The UI intentionally shows **Not connected**, not a guessed health result. The runtime readiness registry is a separately tested server building block, not connected to this settings screen. A future authenticated status endpoint must return only status data the requesting employee is permitted to see. Personal connection details must not become visible just because someone can open company settings.

### Registering a future server adapter

`ConnectionRuntimeRegistry` accepts trusted host registrations, not browser plans. Each registration is keyed by `tenantId` and the actual `connectorId` instance; the catalog `connectionId` identifies the service, not a unique employee account. Multiple employees can therefore have separate Outlook connections. Personal registrations require an `ownerSubject`, and the host's authorization verdict must match the requesting principal, tenant, provider and connector instance. Company registrations still require a current, user-bound authorization verdict; company scope does not mean every employee can access it.

`getReadiness({ principal, tenantId, connectionId, connectorId, correlationId })` checks authenticated identity, requested scope, available read implementation, current consent/policy, expiry and fresh provider health. The trusted host must verify tokens before supplying the principal; this registry does not verify token signatures. Host authorization and health callbacks each have a bounded wait (five seconds by default) and receive an abort signal. Implementations must honor that signal and apply transport timeouts. The registry exposes no ingestion or write-execution method. `checkedAt` is a health-check timestamp, never a last-successful-sync timestamp.

## IT implementation sequence

1. **Establish identity and storage.** Implement verified company sign-in, tenant and employee identity, authenticated per-record authorization, durable connection/approval state, secret storage, audit, and background jobs. Existing Spej services are optional implementation choices, not mandatory dependencies of the new build.
2. **Approve specific providers and capabilities.** Maintain the company provider/tool allowlist server-side. Separate personal consent from company administration and read permission from write permission. Restrict individual mailboxes, calendars, sites, drives, Teams resources, meeting workspaces, and permitted MCP tools. Do not select broad scopes solely for convenience.
3. **Wire one read-only Microsoft workflow.** Register the approved Entra application, implement sign-in/token refresh and Graph reads, and validate tenant/resource identity on every request. Start with the Outlook calendar or a selected SharePoint library. Verify original timestamps, source versions, duplicates, revocation, and failed synchronization before enabling another resource.
4. **Add provider-specific adapters.** Implement and register adapters against the catalog IDs. Keep credentials server-side. The health/readiness adapter must represent the particular resource scope, not just whether an API key exists. OneDrive needs its own personal/shared-drive mapping; the existing SharePoint reference mapper is not complete OneDrive support.
5. **Implement persistent synchronization where needed.** Verify webhook signatures/validation tokens, renew subscriptions, persist cursors and idempotency keys, retry bounded failures, surface incomplete coverage, and reconcile edits/deletions. Choose the authoritative task/calendar/document system and conflict rules before any two-way synchronization.
6. **Link context to business records.** Match people and records using stable, authorized IDs. Ambiguous matches go to review. Preserve source URLs, original dates, versions, and source permissions. Propose CRM notes, tasks, decisions and project changes for review; do not silently merge contacts or distribute private meeting notes company-wide.
7. **Enable external writes separately.** Add provider-specific executors only after send/write permission, exact action-bound human confirmation, version checks, idempotency and audit are enforced. Sending mail, posting Teams messages, changing meetings and modifying file access are separate capabilities. The new runtime readiness registry does not execute these actions.

## Microsoft, MCP and continuous sync are different layers

Microsoft Graph is the service API for the Microsoft 365 resources in this catalog. See the existing [Microsoft integration contract](MICROSOFT_INTEGRATION_CONTRACT.md) for the event boundaries and acceptance tests. SharePoint/OneDrive should remain authoritative for file contents. Store authorized references and necessary derived facts instead of copying entire libraries into CRM records.

An MCP connection lets an approved agent discover/call permitted tools. It is not automatically a background synchronization service, a bidirectional connector, or an approval system. Spej OS still needs an MCP client/transport, provider authentication, server-controlled tool allowlists, timeouts, safe output handling, and tenant/user-bound execution. Retrieved documents and tool results are untrusted content, never new permissions or executable instructions.

Vendor documentation checked September 18, 2026:

- [Microsoft Graph](https://learn.microsoft.com/en-us/graph/overview) covers Outlook, calendar, Teams, SharePoint and OneDrive.
- [Granola MCP](https://docs.granola.ai/help-center/sharing/integrations/mcp) supports authorized meeting-note retrieval. Access is scoped to the connected user/workspace and provider plan/policy. Its [API and webhooks](https://docs.granola.ai/help-center/sharing/integrations/granola-api) provide a separate option for approved background ingestion. Verify current plan and access requirements during implementation.
- [Plaud MCP](https://docs.plaud.ai/plaud-mcp-cli/mcp) exposes recording, transcript and note retrieval through an authenticated MCP client. This release does not install the client, authorize an account, download recordings, or claim continuous Plaud synchronization.

For recordings captured by multiple tools, provider IDs prevent same-provider duplicates but do not alone identify cross-provider copies of one meeting. Use a verified shared meeting identifier or a reviewed match; do not silently merge merely because titles or participants resemble each other.

## Acceptance gates before activation

- An unsigned, expired, cross-tenant, locally fabricated or wrong-user identity cannot discover private connection details or call tools.
- A connection plan cannot grant consent, register an adapter, change company policy, or report a successful sync.
- Missing adapters, absent/revoked consent, denied scopes, stale health and identity-mismatched responses fail closed with safe, actionable status. Provider errors do not leak tokens, messages, file names or raw response bodies.
- Every result respects both source permissions and Spej record permissions before it reaches the browser or SOSA. Revocation removes access even when cached summaries or older search indexes exist.
- No cursor advances over an unprocessed page; retries cannot duplicate CRM events; older events cannot overwrite newer versions; deletion/conflict behavior is defined and tested.
- Last successful sync comes from a durable completed ingestion run, not the time of a settings edit, health probe, login or AI response. Readiness alone does not prove complete data coverage.
- A reviewed external write is executed at most once with the exact approved content, recipient/resource, tenant and acting user, and produces an audit record.
- Mobile and desktop reconnect/error flows are tested with non-production accounts. No real tenant, provider account, permissions or credentials were configured by this release.

## Demo walkthrough

Open Settings → Integrations & connections. Compare My connections and Company connections, expand a provider, and select the capabilities needed. Add it to the connection plan and export the handoff for IT. All providers must remain Not connected. Reload to check the local plan; switch demo profiles to verify plans stay separate. Remove a selection when it is no longer needed. No provider is contacted or permission granted during this walkthrough.
