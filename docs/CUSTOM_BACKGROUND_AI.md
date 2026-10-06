# Custom Background Intelligence providers

Background Intelligence is not limited to the named commercial model providers. The **Custom provider · IT-managed** selection supports an IT-owned server adapter, which can represent Plooms or another approved company service. It is separate from SOSA's existing routing, integration connection plans, and model vendors' direct API-key settings.

In Settings → AI curation, choose Custom provider under Company provider. Until IT installs the adapter, the model field is disabled and the screen says IT setup is required; saving only remembers the selection. After installation and a page reload, the screen lists the adapter's approved models. Save the selected model or use its approved default. Credentials and destinations are not editable in this form.

## What ships

- A server-only adapter contract and a bounded execution wrapper in `lib/server/custom-background-ai.ts`.
- An explicit registration point in `lib/server/custom-background-ai-host.ts`. It returns `undefined` by default: **no custom service is connected or called**.
- An approved, static model list and default model, owned by the adapter rather than browser-entered model names.
- Checks for invalid configuration, unsupported model selections, empty or excessive prompts, output budgets, substituted models, incomplete responses, empty answers, and excessive output.
- A 45-second deadline, with an abort signal passed to the adapter. Server composition may choose a shorter deadline or at most 120 seconds.
- Sanitized error messages. Provider exceptions and raw response bodies are not returned to the browser.
- A non-secret cache partition derived from adapter identity, revision, default model, and approved model metadata. Change the revision when routing, deployment, policy, or credentials change; no credential material belongs in the metadata.

An **installed** adapter means its descriptor passed validation. It does not prove successful authentication, connectivity, available quota, permission to share data, or production approval. Inference must succeed before an answer is accepted. The wrapper does not silently retry against another provider.

## Adapter contract

IT supplies one explicitly imported `CustomBackgroundAiAdapter` from the trusted host module:

- `id`: stable non-secret company-provider identifier.
- `revision`: non-secret revision changed whenever its routing or approved policy changes.
- `label`: short public display name, for example `Plooms` after that adapter actually exists.
- `models`: approved `{ id, label }` entries; the list cannot be empty.
- `defaultModel`: one of the approved IDs.
- `generate({ model, prompt, maxOutputTokens, signal })`: maps the approved provider contract to `{ model, text, finishReason: "complete" }` only after a genuinely complete answer. Length-limited, interrupted, tool-pending, failed, or otherwise partial responses must not be marked complete.

The callback receives no arbitrary endpoint, credential, browser-defined tool, or unchecked model. It must honor the abort signal in its actual HTTP/SDK transport. A timed-out callback's late answer is discarded, but JavaScript cannot guarantee cancellation of remote processing if the provider or transport ignores cancellation. The wrapper does not implement request retries or suppress provider billing.

The real Plooms API contract has not been supplied or verified. This build does **not** guess an endpoint, authentication format, API compatibility, model name, or data-retention policy. An adapter implementation is still required; merely selecting Custom in Settings does not activate Plooms.

## IT implementation checklist

1. Verify the actual provider's request/response contract, supported models, complete-response semantics, authentication, timeout/cancellation behavior, and error shapes.
2. Import the reviewed adapter in the server-only host module. Keep endpoints fixed or deployment-allowlisted; do not add a browser-editable URL, dynamic module path, or generic proxy. Store credentials only in the approved server secret store, never public environment variables, plan exports, model labels, or logs.
3. Establish production identity and authorization before transmitting company content. Current local preview guards are not production user/tenant authorization. Enforce tenant and user permissions, purpose limitations, approved source ACLs, data classification, and minimization at the authorized calling boundary. The adapter contract itself does not receive a production principal and is not an authorization system.
4. Enforce quotas, cost budgets, rate limits, concurrency limits, operational deadlines, and safe logging in the adapter/service. The wrapper bounds each request, not aggregate usage. Confirm provider retention, residency, training use, and any contractual privacy requirements.
5. Preserve source provenance and treat source content as untrusted data, not permission to invoke tools or change policy. This text-generation adapter cannot send messages, write business records, or run an autonomous external action.
6. Test expired credentials, forbidden tenants/users, exhausted quota, disconnected service, partial output, model substitution, cancellation, and restart/redeploy behavior. Run the complete application's checks after wiring the real adapter.

## Boundaries intentionally kept simple

Custom Background Intelligence currently summarizes and ranks already collected material. **Live web research is rejected before invoking the adapter**, even if the underlying service could do it. Built-in public-source collectors are separate; they are not advertised as the custom provider's web search. A future research/tool contract needs explicit capabilities, source attribution, authorization, and its own tests.

This is a provider-neutral extension point, not an MCP connection, scheduled sync service, production identity layer, or a promise that Plooms is already integrated. No new dependencies or live provider accounts are required to inspect or test the shipped boundary.
