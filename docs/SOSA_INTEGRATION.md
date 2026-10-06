# SOSA integration contract and historical adapter notes

**Direction update — September 17, 2026:** Spej OS is now a standalone new build. The existing-SOSA approach below is retained as an optional historical adapter recipe, not a mandatory dependency or authorization to modify production. Engineering can select a new governed SOSA runtime or explicitly reuse an existing service. In either case, retain permission-filtered context, trusted identity, exact proposals, human approvals where required, atomic/versioned commits, and audit. Microsoft Graph and Plooms are not connected; Plooms' execution and/or usage contract must be confirmed before wiring it.

For the current synthetic demo, run `npm ci`, then `npm run company-demo -- --dev --port=3102`. See [Company OS planning](COMPANY_OS_PLANNING.md). Launching this demo does not configure a live model. The production startup guard and all release gates remain in force.

## Historical existing-SOSA integration option

**Keep the SOSA that Spej already built. Add GTM capabilities to it.** This project supplies the intentional GTM interface, business definitions and validation rules—not a replacement agent, model, memory system, or company-wide workflow.

- Existing SOSA keeps its conversation, model, identity and other tools.
- GTM supplies accounts, people, activities, opportunities, partnerships, campaigns, content, tasks, initiatives, saved research and metric definitions.
- The dashboard and SOSA should read and update the same Spej OS records through approved services.
- The current model-connected chat is a standalone pilot client. It can be replaced or connected to the existing agent.
- Teams and mobile should reuse these same capabilities and permissions, not create separate copies of the CRM.
- Account/person linkage, separate source provenance, client status, relationship history, and opt-in follow-up plans use this same contract. See [CRM accounts, people and relationship follow-ups](CLIENT_RELATIONSHIPS.md) for lifecycle, reminder, source, and activity-purpose rules.

## What is ready in this repository

The versioned, model-independent contract is in `lib/gtm-agent-contract.ts`. It does not call a model, access SQLite, read secrets or save records on its own.

| Function | Purpose |
| --- | --- |
| `readGtmAgentContext` | Prepare bounded active-record context and calculated metric totals from the records supplied by the host. |
| `prepareGtmAgentProposal` | Validate structured actions from SOSA and return exact changes for review. Does not save. |
| `createGtmAgentRequest` | Package the command, recent conversation and context; includes a prompt for the standalone pilot. |
| `runGtmAgentTurn` | Optional adapter for routing the pilot conversation through an injected agent connection. |

An existing tool-based SOSA can use the first two functions directly and keep its own prompts and orchestration. A non-TypeScript host can wrap the same contract in an authenticated internal service. No such service or SOSA-specific connection has been configured here.

Current actions are `create`, `update`, and task-only `complete`, with at most 12 per proposal. The response shape is `{ reply, needsClarification, actions }`; each action supplies `type`, `collection`, `data`, and an exact `recordId` for an existing record. Field types and allowed values are in `lib/types.ts` and the validators. Ambiguous names, unsupported values, broken links and unsafe completion are rejected.

## Historical connection recipe if existing-SOSA reuse is selected

1. **Identity and records:** use Spej OS sign-in and authorize records and fields before supplying context to SOSA. Map canonical IDs and GTM-owned fields; do not pass whole Spej OS objects through GTM normalizers, which can discard unrelated fields.
2. **Agent tools:** register GTM read/metrics and prepare-change capabilities with the existing SOSA. Keep the existing agent’s memory and unrelated tools. The pilot’s first-300-record limit is not company-wide search; add permission-aware retrieval for larger datasets.
3. **Approval and saving:** retain the prepared proposal on the server and show the review in the dashboard or chat. Bind approval to the authenticated user and an immutable proposal ID. Recheck permissions and versions at commit, use replay-safe request IDs, commit atomically, and record an audit event.
4. **Shared interface:** after saving, refresh GTM from the canonical record service. Route the GTM chat to the existing SOSA, and drive its connection indicator from that service—not the pilot model settings.
5. **Other channels:** attach Teams or mobile to the same host-controlled tools. Identity must come from the authenticated channel, not a person’s name in a message.

The company commit adapter must preserve the exact approved record identities and all effects, including recurring-task history. Do not rerun a create proposal as a fresh request: that can allocate new IDs or duplicate work. Use field-level canonical operations and preserve non-GTM fields.

**Do not expose the current whole-workspace save endpoint as a company agent tool.** `nextWorkspace` is a local preview, not an authorized write instruction. The current fingerprint detects local staleness; it does not provide company authorization, atomic concurrency control or retry protection. Reuse Spej OS services for those responsibilities.

## Scope and acceptance

The current GTM contract covers the saved operating records above. Live intelligence collection, Outlook, social publishing and other external tools are separate capabilities; use the existing SOSA connectors where available and add only missing ones. An embedded page or a model endpoint alone does not establish shared identity or data synchronization.

Before release, test: one conversation updates a contact, opportunity and linked task; content production updates appear in the dashboard; denied access fails safely; stale approvals are rejected; retrying a message does not duplicate records; and non-GTM workflows remain unchanged.

The private GitHub handoff should include the app source, this contract, tests and these notes—not local databases, tokens or exports. Compatibility and integration effort cannot be confirmed until the team maps its existing SOSA tool/API interface, authentication and record services. No overhaul of the existing agent is assumed.

Historical handoff evidence: the automated tests, lint, production build and isolated launcher smoke check passed at the earlier handoff checkpoint. See [Company OS planning](COMPANY_OS_PLANNING.md) for the latest recorded local check counts; record fresh candidate-commit and GitHub CI evidence separately. Integration-contract tests exercise an injected test agent and direct tool-style proposals without model credentials or database access. The actual Spej OS SOSA service has not been connected or tested.
