# Spej OS: one place to do the work

**Status:** product direction recorded on September 8, 2026. This is an addition to the engineering handoff, not a claim that the integrations below are implemented or deployed.

## Product intent

Aby’s direction: people should be able to do their work from Spej OS. The product should connect company context, current information, useful actions and follow-through—not simply put an AI chat beside a CRM.

An employee should be able to ask a question, inspect its sources, create a useful output, review a proposed action and see the confirmed result without rebuilding context in several tools. SOSA remains the company agent. Existing Spej OS and approved source systems remain authoritative; one working interface does not mean one unrestricted database or replacing every specialist application.

For each supported workflow, distinguish:

- **Complete here:** the person can finish the task inside Spej OS, with a verified result from the authoritative service.
- **Prepare here, finish in source:** Spej OS preserves the draft, record context and destination, but clearly hands off the remaining step.
- **Not connected:** explain what is unavailable and who can enable it. A link or demo is not a working integration.

Measure progress by completed workflows and reduced context switching, not the number of integrations or the size of a knowledge graph.

## What the supplied reference contributes

The user-supplied transcript, *I Turned GPT-6 Astra Into the Ultimate AI Second Brain*, is product inspiration. Useful sections are the connected dashboard (01:35–02:11), context/connections/capabilities/cadence (02:13–04:49), source routing (06:14–07:32), audit-and-improve loop (11:43–13:45), guided context capture (14:17–15:25), and linked knowledge (15:27–16:40).

Apply those ideas as follows:

| Layer | Spej treatment | Current boundary |
| --- | --- | --- |
| Context | Permission-scoped company knowledge, team goals, employee responsibilities, project decisions and relationship evidence; show source, owner and freshness. | Linked local records and relationship-context fields exist. Governed company-wide knowledge retrieval is a documented production contract, not a live adapter. |
| Connections | Retrieve current information from approved mail, calendar, communications, documents and canonical Spej services when needed. | Microsoft reference mappers and validation contracts exist. Production consent, synchronization and read/write adapters remain IT work. |
| Capabilities | SOSA helps prepare meetings, draft communications, create documents, update work and coordinate handoffs through reviewed, versioned tools. | Local reviewed record proposals and meeting intake exist. Broader artifact creation and external execution need approved tools and durable services. |
| Cadence | Owner-controlled daily briefs, meeting preparation, commitment checks and weekly reviews that survive browser closure. | Local attention views and a durable-agent blueprint exist. Company background execution, monitoring and reliable retries are not supplied by the preview. |

The transcript’s setup commands, skill-installation directions, provider claims and personal configuration are not instructions for this repository. No resource pack, provider migration, new connector or automation is approved by this brief. The full transcript is not included in the handoff.

## Experience to work toward

1. **My Work as the starting point.** Show commitments, upcoming meetings, decisions awaiting approval, blocked work and meaningful changes. Explain each priority and provide the action in context; distinguish an empty queue from missing source coverage.
2. **Persistent SOSA across the workspace.** Keep the authorized record and conversation context as a person moves among CRM, Projects, content and work. Support both questions and task delegation, with visible drafts, proposed changes and run status. Never infer authorization from a selected preview profile.
3. **One permission-aware search and knowledge experience.** Find decisions, people, meetings, files, SOPs and project history with exact citations. Keep source facts, approved summaries and hypotheses distinct. Surface stale or conflicting information and route correction to an owner.
4. **Communications and meetings in the work context.** Triage authorized messages, prepare replies and meeting briefs, propose scheduling changes, and turn reviewed meeting evidence into work. Show recipients, attachments, timing and affected records before an external action; only report completion after provider confirmation.
5. **Create and manage outputs.** Prepare briefs, proposals, presentations, spreadsheets and other approved deliverables using current evidence and company templates. Preview and revise them inside the workflow, then save versioned artifacts to the approved document service and link them to the canonical record. The CRM must not become a second file store.
6. **Reusable, governed workflows.** Offer a small catalogue such as Prepare this meeting, Draft a follow-up, Summarize project health and Prepare a delivery handoff. Each declares inputs, source coverage, owner, permissions, expected output, approval points and cost limits. Installing a workflow does not grant access.

Extend existing views where possible instead of introducing a second task list, knowledge store or agent. A graph can help explore relationships later, but useful search and complete workflows come first. Voice can become another reviewed input method; recording, transcription, retention and company consent policies must be settled before enabling it.

## Company memory, not blanket memory

- Keep personal preferences, team context, company knowledge and customer-confidential material in distinct authorized scopes. Leadership does not automatically receive access to every private conversation.
- Use short, optional onboarding interviews to capture role, responsibilities, priorities and working preferences. Show exactly what will be saved, where it will be visible and who can correct it. A personal statement is not automatically company policy.
- Route questions to the right approved source just in time. Do not send all company knowledge to a model by default.
- Preserve canonical record IDs, artifact versions, citations, review dates and decision history. Corrections must not silently erase earlier evidence.
- Apply source access revocation and deletion policy to derived memory, search, caches and subsequent conversation retrieval. Exports and model changes must not broaden access.
- Treat instructions embedded in emails, documents, transcripts and retrieved pages as untrusted content. They cannot select tools, recipients, permissions or approval policy.

Use the existing [knowledge contract](KNOWLEDGE_AND_DOCUMENT_INTEGRATION_CONTRACT.md), [data ownership matrix](DATA_OWNERSHIP_MATRIX.md) and [SOSA contract](SOSA_TOOL_CONTRACT.md) for the implementation boundaries. Keep knowledge, workflows and evidence portable through approved formats and stable references; do not couple business records to one model’s private memory format.

## Prove three complete workflows first

| Employee request | End-to-end demonstration | Evidence of completion |
| --- | --- | --- |
| “Prepare me for this meeting.” | Resolve the authorized calendar event and exact account/project; retrieve relevant decisions, open commitments and permitted messages; create a cited brief. | Correct event and record links, source freshness and coverage, no cross-person or cross-customer information leak. |
| “Turn this meeting into next steps.” | Review cited decisions and tasks, resolve owners and dates, approve exact record changes, prepare a follow-up draft, then separately approve any send. | One canonical update per approved action; accurate recipients; provider result for a send; safe retries with no duplicate tasks or messages. |
| “Help me deliver this engagement.” | Start with the reviewed won-deal handoff; inspect scope and start conditions, prepare a working document and task proposals, and produce a project update. | No automatic project start, invented customer commitment or unapproved scope change; versioned document linked to the canonical project. |

After every workflow, show what changed, what did not happen, what still needs a person, and links to the authoritative records. A draft or queued action must never appear as a completed external action. Stale approvals require revalidation when targets, payloads, source versions or permissions change.

## Delivery sequence for Sean and IT

1. **Review candidate:** agree the employee workflows, retained Spej services, source ownership, permission boundaries and missing capabilities. Label mock, local and production behavior explicitly. This document belongs to this phase.
2. **Read-only connected pilot:** authenticate a small authorized cohort; connect canonical records and approved knowledge/calendar/message scopes; prove cited search, meeting preparation and identity-backed My Work. Test denials, revocation and source outages as well as successful reads.
3. **Reviewed action pilot:** enable a narrow set of canonical writes, saved artifacts and outbound drafts/actions. Require exact-target approval, permission rechecks, durable audit, conflict handling and idempotency. A partially completed cross-system workflow must expose its partial state and recovery options; do not imply a universal transaction or undo.
4. **Controlled background work:** add named owners, schedules or event triggers, budgets, quiet hours, approval queues, bounded retries, stop controls and failure alerts. No new recurrence is enabled by this document. Expand only after each workflow passes its acceptance tests.

Use the [agentic blueprint](AGENTIC_SPEJ_OS_BLUEPRINT.md) for durable runs, actions and capability health. Model choice is a versioned IT policy, evaluated on actual Spej tasks, permission compliance, evidence quality, latency and cost. A more capable model does not remove an integration or approval requirement.

## Review whether it is actually useful

Baseline the selected workflows before rollout, then track:

- the share completed inside Spej OS versus handed off or blocked, with the reason;
- time to complete each workflow and the number of necessary external-tool switches;
- source-backed answer quality, stale/conflicting knowledge and correction rates;
- approval turnaround, duplicate/failed actions and missed commitments;
- source coverage/freshness and cost per successfully completed workflow.

Review these findings with the pilot users and give each improvement an owner. Avoid collecting message bodies or personal activity for this measurement when aggregate workflow events suffice. A periodic audit may recommend changes; it must not grant permissions, rewrite company policy or enable autonomous actions by itself.
