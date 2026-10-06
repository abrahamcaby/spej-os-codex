# Standalone Spej OS working build

**Current code baseline:** PR #5 was merged into `main` at `87f722a` (verified September 21). Use `main` for the latest merged preview; older review-branch and no-merge statements below are historical. A merge is not production deployment or integration approval.

The [September 21 agentic CRM recommendations](docs/AGENTIC_CRM_RECOMMENDATIONS.md) explain what to adapt from Comp AI CRM, what to avoid, and the phased engineering acceptance checklist. This is a planning update: CRM Outreach, persistent account-scoped SOSA and live ingestion/background workers remain to be built.

Background Intelligence also supports **Custom provider · IT-managed**, for Plooms or another approved company service. A tested server-side adapter interface routes custom curation without assuming API compatibility or falling back to a built-in provider. No custom adapter ships connected. See [Custom Background AI](docs/CUSTOM_BACKGROUND_AI.md) for the registration point and IT checklist.

Settings → **Integrations & connections** now organizes personal and company providers, requested capabilities, and a browser-local connection plan with a minimized IT handoff export. It includes Microsoft 365, Granola, and Plaud setup boundaries plus a tested, fail-closed server readiness registry. No live provider adapters are registered and no sign-in or sync is enabled. See [Connections and integrations](docs/CONNECTIONS_AND_INTEGRATIONS.md) for the exact implementation and activation checklist.

The September 18 CRM update adds person-level communication history across email, LinkedIn, calls, meetings, text/SMS, and WhatsApp. Log interactions manually, paste message notes, optionally dictate and review notes, and add dated follow-up work. Outreach, replies, and conversations have separate evidence-based dates. [CRM communication history](docs/CRM_COMMUNICATION_HISTORY.md) explains the workflow and integration boundaries; these channels are not automatically synced.

The September 17 company-OS planning foundation adds generic, editable plans and capacity-aware daily scheduling to My Work. No personal GTM plan or named employee is required by the new planning logic. See [Company OS planning](docs/COMPANY_OS_PLANNING.md) for the walkthrough, architecture, and honest connection boundaries.

This is a standalone review build for the private **SpejAI/spej-os-aby-revamp** repository, not a production deployment. GitHub publication and CI status must be verified from the candidate branch/pull request. Inherited material below describes the earlier prototype; references to integrating into existing Spej OS are historical, not the new-build requirement. The existing production repository remains untouched.

Start this standalone preview with `npm run company-demo -- --dev --port=3102` after installing dependencies. Open `http://127.0.0.1:3102/?tab=today`. My Work puts **What needs attention** first, followed by an optional collapsed **Work schedule**. The dedicated **Calendar** tab shows the same time blocks alongside assigned deadlines in week, month, and agenda views. Working hours and optional goals/routines live under Calendar → Planning settings. Outlook/Teams are explicitly not connected. This launcher uses isolated synthetic records; planning changes stay in this browser. See the linked build notes before packaging or connecting real services.

For the current handoff, start with [GitHub handoff](docs/GITHUB_HANDOFF.md), [Connections and integrations](docs/CONNECTIONS_AND_INTEGRATIONS.md), [Company OS planning](docs/COMPANY_OS_PLANNING.md), [Task work layout](docs/TASK_WORK_LAYOUT.md), and [CRM communication history](docs/CRM_COMMUNICATION_HISTORY.md). Project/GTM work uses responsive task cards with labeled controls, focused-task navigation, and safer secondary actions. The September 18 local regression suite passed 763 tests, lint, the production build, and launcher smoke tests; this does not claim a fresh-install or remote CI result for an uploaded commit.

# Earlier unified operations preview

A local-first product preview for one connected Spej operating system. The interface has focused **CRM**, **GTM**, and **Projects** views over the same accounts, people, opportunities, projects, tasks, activities, and approved SOSA actions. It is based on Matt Wolfe's open-source [Control Center](https://github.com/mreflow/control-center) and incorporates the post-recording upgrades shown in his [August 2026 walkthrough](https://www.youtube.com/watch?v=rKo9iLGjUbs).

The local SQLite build is a working demo, not the production system of record. A company deployment should preserve this information architecture and connect it to the existing Spej OS identity, permissions, CRM, project, ticket, document, audit, and integration services instead of creating a second database.

## Handoff status

### September 8 relationship-context update

The [feedback review](docs/RELATIONSHIP_FEEDBACK_REVIEW.md) maps all 12 requested improvements to what was already present, what this update adds, and what IT still needs to connect. New account briefs retain original source, evidence and conflicts; Connections, Nurture and Weekly Review use those same records. Outreach holds require explicit release. Deal readiness no longer treats relationship warmth or import time as buyer engagement. A reviewed won-deal handoff creates a delivery tracker without assuming work has started.

These are additive preview improvements, not a production migration or a new deployed agent model. Live email/voice ingestion, program management, formal change control and outcome/time reporting remain integration work.

The [unified employee workspace vision](docs/UNIFIED_EMPLOYEE_WORKSPACE_VISION.md) records the broader product goal: find context, create outputs, review actions and complete work from Spej OS. It distinguishes this direction from implemented features and defines three end-to-end pilot workflows for IT.

| Area | Included now | Company connection still required |
| --- | --- | --- |
| Product | Working Spej-branded My Work, CRM, GTM, Projects, SOSA pilot, content, metrics, intelligence, access-design, and meeting-intake interfaces | Production hosting, company acceptance, and role-specific rollout |
| Shared records | Linked local account, person, opportunity, project, task, activity, campaign, content, and metric records | Canonical Spej OS record APIs, IDs, field ownership, migration, and reconciliation |
| SOSA | Provider-independent context/action contract, deterministic validation, reviewed proposals, and tested authorization policy | Register the governed tools with the existing SOSA and pass a verified user identity outside the prompt |
| Microsoft 365 | Tested event schemas, Teams/Outlook/calendar/transcript/SharePoint mappers, and exact outbound-action validators | Entra app, least-privilege Graph consent, webhooks, delta sync, resource allowlists, retention, workers, and monitoring |
| Production safety | Reference identity principal, read → prepare → approve → atomic commit boundary, idempotency, event retry/dead-letter semantics, fail-closed environment validation, and architecture/runbook documents | Durable canonical, proposal, event, cursor, audit, queue, secret, backup, and observability services |

The Microsoft, SOSA, identity, and canonical-record modules are tested reference boundaries; they are not live adapters or authenticated application routes. The dashboard intentionally labels them **Not connected** until Spej IT supplies the production services.

## Workspace model

- **My Work:** the selected preview profile's assigned tasks, deadlines, approvals, risks, and scoped updates across company work. Production must derive the viewer from verified identity.
- **SOSA:** one conversational interface that can prepare reviewed changes across the shared records, including changes supported by pasted meeting notes or transcripts.
- **CRM:** the company-wide account, person, opportunity, partnership, activity, client-history, and follow-up record.
- **GTM:** a focused operating view for sales, partnerships, prospecting, marketing, content, metrics, intelligence, and internal GTM execution.
- **Projects:** one portfolio for AI Office, Plooms, client engagements, events, partner enablement, marketing and media, product work, and internal initiatives. Discovery/Design/Delivery is one optional playbook.
- **Shared foundation:** accounts, people, approved commercial handoffs, projects, tasks, activity, and ownership remain linked rather than copied.

In the target company model, role selects a useful starting layout. Server-enforced permissions must independently decide which portals, actions, teams, records, protected fields, files, and SOSA context the person can access. Temporary access must expire automatically; confidential records require an exact grant. The local profile and grant controls demonstrate this design, not authenticated production enforcement.

Fresh installs include a Spej starter preset with 20 official AI lab and publication sources, nine wider discovery topics, and strict identity-aware monitoring for Spej and its current public team. Sagar Pandya and Aby C. Abraham also include verified public profile aliases and Spej-specific corroborators so common-name results are rejected. No social accounts, email accounts, API keys, OAuth secrets, or demo records are included.

## Spej additions

- **Official Spej visual system:** the dashboard uses Spej navy (`#1A2332`), teal (`#4ECDC4`), off-white (`#F8F9FA`), dark gray (`#2D3748`), the official Spej logo, Plus Jakarta Sans headings, and DM Sans interface copy. Brand assets are stored locally for offline use.
- **Action-first My Work:** one prioritized attention queue joins overdue work, relationship follow-ups, opportunities without a next step, project risks, active campaigns, and content reviews. **My work** contains assigned work and owned follow-ups; **Shared work** shows readable Workspace and Company-wide tasks without treating visibility as assignment.
- **Clear task-access design preview:** open task rows show owner, workspace, business category, visibility, work status, priority, effort, deadline, subtasks, and record links; completed rows retain the core access labels. Lists group by category by default, while **All accessible work** stays inside the preview profile's explicit grants. Missing legacy visibility defaults to Owner only. Production enforcement still requires authenticated record-level services.
- **Human-led 5-3-1 playbook:** choose five focus accounts, three important people per account, and one meaningful next action per person; add actions to Work and log them after doing them manually. The app does not scrape LinkedIn or automate comments and messages.
- **Daily LinkedIn rhythm:** install recurring Work tasks for publishing, thoughtful comments, replies, profile-viewer review, open conversations, and relevant follow-up.
- **Commercial pipeline:** edit opportunities through Explore, Validate, Qualify, Shape & Estimate, Proposal & Decision, Contracting, Closed Won, and Closed Lost, with a separate forecast, value, motion, engagement phase, source, pain point, desired outcome, next Spej action, and next customer decision.
- **Explainable Priority Intelligence:** separate strategic value, win readiness, action urgency, and evidence confidence. The system recommends an attention tier, action window, and cadence without treating a large deal as automatically urgent. Missing facts stay unknown, human overrides require a reason and current review, and SOSA may propose source-backed inputs but cannot write the calculated scores or approve itself.
- **Clear commercial lanes:** AI Office, Plooms, and Client projects, with independent direct/partner/co-sell routes, partner categories, and Discovery/Design/Delivery phase filters. Other legacy partner-motion records remain available for review.
- **GTM Metrics:** Overview, Prospecting, Marketing & Content, and Sources & Data connect recorded effort with outcomes. Log outreach, replies, calls and meetings once in the shared activity log; compare publishing with account-level channel results. Monthly snapshots replace the same source total instead of double-counting. Missing readings stay visibly missing; no inferred funnel conversions.
- **Partnerships:** manage relationship health, mutual value, owners, and next actions on a lifecycle separate from the sales pipeline.
- **Campaign coordination:** plan cross-channel marketing campaigns around an objective, audience, owner, dates, and success measure, then see the related content and open work together.
- **Projects:** organize work by area, project type, delivery playbook, universal project status, health, dates, risks, success measures, source opportunity, linked work, board, and timeline—while keeping commercial stage separate from project execution.
- **Two content workspaces:** keep Personal LinkedIns separate from Spej Authority-building content while using the same Idea, Research, Drafting, Production, Scheduled, and Published workflow. Personal content uses whole-person themes; Spej authority content uses the enterprise-AI categories from the content calendar and idea library. Owners, reviewers, review deadlines, approval states, and campaign links support a simple contributor workflow.
- **Signal to story:** send an Industry or Newsletter story straight into the content pipeline while keeping its source link and summary as the initial angle.
- **AI source desk:** starts with OpenAI, Anthropic, Google DeepMind, Google AI, Meta AI, Microsoft AI, NVIDIA AI, xAI, Mistral, Cohere, Hugging Face, Stability AI, TechCrunch AI, The Verge AI, VentureBeat AI, MIT Technology Review AI, Ars Technica AI, WIRED AI, The Decoder, and Future Tools.
- **Video updates retained:** daily top-five briefs, AI summaries and priority sorting, richer audience charts, newsletter search and source filters, Grok, LM Studio, Ollama, and model selection are all present.

See [the short GTM navigation and measurement handoff](docs/GTM_METRICS_HANDOFF.md) for the workflow, exact metric definitions, and what Spej IT still needs to connect before company deployment.

## Company handoff package

Start with these documents:

- [GitHub handoff](docs/GITHUB_HANDOFF.md) — what belongs in the Spej-owned repository and the first IT review.
- [Relationship feedback review](docs/RELATIONSHIP_FEEDBACK_REVIEW.md) — September 8 changes, behavioral safeguards, and remaining integration decisions.
- [Unified employee workspace vision](docs/UNIFIED_EMPLOYEE_WORKSPACE_VISION.md) — the goal of completing work inside Spej OS, connected knowledge and actions, and the first end-to-end pilots.
- [Existing Spej OS compatibility](docs/EXISTING_SPEJ_OS_COMPATIBILITY.md) — what is retained, what improves, and how each current foundation connects.
- [Production architecture](docs/PRODUCTION_ARCHITECTURE.md) — current preview versus target services and boundaries.
- [Deployment runbook](docs/DEPLOYMENT_RUNBOOK.md) — build, staging, release gates, cutover, monitoring, and rollback.
- [Data ownership matrix](docs/DATA_OWNERSHIP_MATRIX.md) — the one-source-of-truth rule for every record domain.
- [Microsoft integration contract](docs/MICROSOFT_INTEGRATION_CONTRACT.md) — Teams, Outlook, calendar, transcript, and SharePoint requirements.
- [SOSA tool contract](docs/SOSA_TOOL_CONTRACT.md) — authenticated read, propose, approve, commit, and audit behavior.
- [Agentic Spej OS blueprint](docs/AGENTIC_SPEJ_OS_BLUEPRINT.md) — the adopt/adapt/avoid decision record and P0/P1 design informed by the reviewed Agentic CRM reference.
- [Access control and task visibility](docs/ACCESS_CONTROL_AND_TASK_VISIBILITY.md) — owner, workspace, company-wide, administrator, and production enforcement rules.
- [Security threat model](docs/SECURITY_THREAT_MODEL.md) and [migration/rollback plan](docs/MIGRATION_AND_ROLLBACK.md).

Copy [`.env.production.example`](.env.production.example) only as a configuration checklist. Real values belong in the approved secret manager and must never be committed.

## Executive demonstration

For a populated, presentation-ready walkthrough, run:

```bash
npm run demo
```

This opens `http://127.0.0.1:3100` with a fresh temporary workspace built from the tracked [synthetic executive fixture](fixtures/executive-demo-workspace.json). Its fictional accounts, contacts, pipeline, projects, work, content, campaigns, and metrics use dates relative to launch day and the preview team profile IDs, so each **Demo layout** selection has meaningful My Work content. A visible banner identifies the records as synthetic.

The command never reads or replaces the normal Control Center database, ignores browser recovery data, and removes its temporary SQLite workspace when stopped. It contains no customer records, connector credentials, OAuth tokens, or AI keys. Use `npm run demo -- --port=3101` if port 3100 is occupied. This fixture is a product walkthrough—not an import, migration seed, or production-data example.

## Existing SOSA integration

CRM uses [one connected account-and-people model](docs/CLIENT_RELATIONSHIPS.md): Accounts, People, and Activity are the primary record views. Each account opens into its source, people, deals, projects, follow-up plan, history, and meeting sources. LinkedIn 5-3-1 is a GTM workflow over those same records, not a duplicate CRM list.

Spej OS already has SOSA. Reuse it: this preview supplies the My Work, CRM, GTM, and Projects interfaces, record definitions, and reviewed-action pattern, not a replacement company agent. The provider-independent contract in `lib/gtm-agent-contract.ts` supports scoped context, calculated metrics, reviewed proposals, and an optional injected chat transport. The standalone route uses that same contract; it is only the pilot adapter. Read [Connect the existing Spej OS SOSA](docs/SOSA_INTEGRATION.md) for the boundary, exact entry points and required company-side identity, record mapping, approvals and commit behavior.

## Install and open

Requirements: [Node.js 24.19 or newer](https://nodejs.org/en/download), npm, and a modern desktop browser.

From this folder, run `npm run launch`.

`npm run launch` is the golden path. It installs the locked dependencies when needed, builds the app when source files change, starts one loopback-only server, waits for a health check, and opens `http://127.0.0.1:3000` in the default browser. Keep that terminal window open; press `Ctrl+C` to stop.

Prefer a ZIP? Download **Code → Download ZIP** on GitHub, extract it, open a terminal in the extracted folder, and run `npm run launch`. Git is only required for the clone/update workflow.

Useful commands:

```bash
npm run doctor                 # verify runtime, settings, build, and SQLite health
npm run backup                 # make a consistent private backup
npm run demo                   # open the isolated synthetic executive walkthrough
npm run launch -- --no-open    # start without opening a browser
npm run launch -- --port=3001  # use another local port
```

## First-run setup

My Work shows the four optional intelligence-source states and links directly to the right Settings section.

1. **Industry:** add any public homepage, RSS/Atom feed, and optional topic phrases.
2. **Mentions:** add exact names, brands, handles, official domains, distinguishing identity anchors, and known false-positive contexts.
3. **Audience:** add exact public profile URLs or handles for the platforms you use.
4. **AI curation (optional):** choose OpenAI, Anthropic, Gemini, or Grok and save that provider's key, or connect a running local model in LM Studio or Ollama. The model selector starts at **Default**; available alternatives load from the selected provider.
5. **Newsletters (optional):** connect any Gmail account with a read-only OAuth client, choose the Gmail search query, and configure AI curation to extract and rank news.
6. **Daily brief:** choose how many Industry, Mention, and Newsletter stories appear in My Work. Each section can show 1–10 stories or be turned off.

Collectors run shortly after startup, every 15 minutes while the app remains open, and when **Refresh** is pressed. Industry, Mentions, and Newsletters open from their last saved collector snapshot, so moving between tabs does not repeat public web or Gmail collection.

## My Work and the daily brief

The daily brief is a quick snapshot of the saved reading queues, not a separate collection job. Public Industry stories and Newsletter coverage are normalized by canonical source URL and bounded event-title similarity, then shown once as an evolving intelligence topic with its web/inbox channels and source coverage. Verified Spej and team Mentions remain a separate action queue. Choose **Customize** in My Work or **Settings → Daily brief** to change the per-source inputs. Archived and expired stories are excluded; opening My Work does not make additional AI, web, or Gmail calls. Each card links back to the deeper source tabs and shows when the underlying collectors last checked.

Private actions, meetings, and messages are a separate optional section below the snapshot. They require the connector bridge described below; the three-tab snapshot does not.

## Industry collection

Each configured URL is treated independently and can belong to any niche.

1. The collector checks an explicit feed, page feed metadata, and common RSS/Atom paths.
2. If no feed is readable, it merges sitemap locations from `robots.txt` and common sitemap paths, including recursive sitemap indexes.
3. A first sitemap scan records a quiet baseline. Later scans report newly discovered pages.

A blocked homepage does not stop feed or sitemap discovery. Raw discoveries are stored separately from the reading queue. Canonical URL/title deduplication, watched-source priority, recency, configured topics and exclusions, material-change signals, event similarity, and source diversity select at most the configured daily target (30 by default). This keeps hundreds of broad discoveries available to the collector without presenting hundreds of cards as equally important.

Active Industry cards are limited to items published or newly discovered in the last 24 hours; older surfaced items remain under **History**. **Archived** contains only items a user explicitly archived. Undated feed entries establish a baseline instead of being presented as fresh news. Topic phrases add broader Google News discovery, while watched-site updates remain prioritized independently. A selected AI provider can rerank the bounded candidate set; failures automatically fall back to the local importance model.

## Mentions

Mention discovery searches Google News and Bing News across the previous seven days. When a user enables a cloud AI provider with search support, a cached two-hour broad-web pass also searches articles, podcasts, videos, directories, forums, GitHub, Reddit, and supported public social pages. Multi-word names and brands are searched as complete phrases, never as loose individual words.

For predictable laptop-friendly collection, a watchlist can contain up to 12 names, handles, and official websites combined, plus up to 24 identity anchors and 24 negative contexts. Every configured identity is processed; provider failures are reported as partial coverage rather than silently dropping entries.

Strict mode requires identity evidence:

- unique handles and official domains can qualify directly;
- common names and broad brand phrases need direct-page identity, niche, or anchor context;
- roles, products, locations, collaborators, and niche topics can serve as anchors;
- weak namesakes and broad word overlap are rejected as noise;
- search snippets and AI output never count as proof; the app fetches the direct canonical URL and requires literal page-local identity evidence;
- configured negative terms hard-reject recurring namesakes and unrelated brand contexts;
- official domains establish identity but can be excluded from the third-party Mention queue;
- literal but ambiguous matches stay review-only when strict mode is off; strict mode requires a second identity signal or multiple configured identity anchors.

Canonical story identities are stored locally. Once a result is archived, later scans do not resurface the same story through a search-provider wrapper or tracking URL.

Industry and Mention archive actions update the local library and saved collector snapshot together. The card moves immediately without waiting for a new source scan. Mention cards can also be sent directly to Saved research.

After identity verification, the selected cloud or local model can explain what a page says about the tracked identity and assign an attention-priority score. Summaries use only the verified page evidence and cannot admit an otherwise unverified mention. Results are cached and saved with the queue. Sort by **Priority**, **Newest**, or **Oldest**; without AI, deterministic importance ranking still works.

Public search is useful discovery, not complete web coverage. Pages that block signed-out verification are rejected instead of being presented as certain mentions. Facebook posts are intentionally excluded from broad research because the app cannot reliably verify exact public-post text without an official connection.

## Audience tracking

Supported public profiles: YouTube, X, Instagram, Facebook, LinkedIn, Threads, and TikTok.

Public pages are checked first and do not require platform API keys. Optional official credentials remain collapsed under advanced settings for providers that support a fallback. Successful metrics must match the configured account identity; a count from an unrelated page is rejected.

Public collection is provider-controlled and best effort. A platform can change or block signed-out metadata without notice. A failed check is shown as unavailable or limited, never as a false zero; a prior verified value is clearly labeled as last known. Combined totals are sums across platforms, not deduplicated people.

Follower and subscriber growth is measured against the newest comparable sample from 24–36 hours earlier. The app keeps one historical anchor per 12-hour bucket, so hourly/manual refreshes update the live total without becoming a misleading baseline. Until a true yesterday sample exists, the UI says **Baseline**. Post, video, and thread counts are shown only as separate content metadata; they are never used as audience growth.

The Audience page includes platform-colored account cards, a platform mix, and interactive 7-day/30-day charts. Switch between total audience and change over the selected range, inspect individual readings, or open the exact-values table. Charts use only verified saved readings: a new account starts with a point, not invented historical growth, and long gaps or last-known counts are labeled.

## Optional AI curation

No AI key is required for installation or for Industry, news Mention discovery, sitemap, RSS, Audience, Task, Reminder, or the daily snapshot features. **Newsletter intelligence requires a configured AI model**, either a cloud provider with a key or a running local model.

Under **Settings → AI curation**, choose **OpenAI**, **Anthropic**, **Gemini**, **Grok (xAI)**, **LM Studio**, or **Ollama**. Keep **Default** selected for an automatic model choice or choose a model returned by that provider. Cloud lists use the selected provider's key. Local lists show only currently loaded, supported text-generation models, not every model available to download. **Reload models** updates the list without saving changes or starting a collector.

The selected provider is used for bounded background jobs:

- semantic reranking of already-discovered Industry candidates, with a deterministic local fallback and the same daily cap;
- cached broad-web Mention discovery with supported cloud providers, followed by independent direct-page verification inside Control Center;
- summaries and priority ranking for already-verified Mention pages;
- newsletter story extraction, priority ranking, and cross-newsletter deduplication, using only the separately connected mailbox's matching issues.

Keys can instead be supplied as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, or `XAI_API_KEY` in `.env.local`. Environment keys are still inert until the matching provider is selected in Settings. Cloud calls can incur usage charges. Saved keys remain in the local server-side settings file, never return through the Settings API, and are not sent to any unselected provider.

### Local models

Start the local server in LM Studio or Ollama and load a text model there first. Choose that provider in Control Center, use the default loopback endpoint or enter its local port, then select **Reload models**. Control Center does not install, download, or load models. An optional token is supported if your local server requires one; most local setups do not need a key. Ollama cloud models are not listed, and `OLLAMA_API_KEY` is deliberately not used as a local credential.

Only numeric loopback endpoints (`127.0.0.1` or `::1`) are accepted, with `localhost` normalized to loopback. Requests do not follow redirects. Local models handle curation, summaries, and newsletters; public Mention discovery continues through the regular news collectors without AI web-search tools.

The dashboard sends local-model requests only to that loopback server. For processing entirely on this computer, also disable remote forwarding such as [LM Studio's LM Link](https://lmstudio.ai/docs/developer/core/lm-link) in the model runtime. Control Center cannot inspect or control how another application routes requests internally. A local model must be capable of following the JSON extraction instructions; model failures are reported without fabricating stories.

Keep the model loaded while the dashboard runs and choose a context window large enough for newsletter and page evidence. The model menu shows the runtime's actual loaded capacity. Control Center conservatively checks the input and output allowance before sending a prompt, never enlarges the allocation automatically, and refuses unknown or insufficient capacity with setup guidance. Older local servers may need an update to expose this information. Ollama requests disable truncation and context shifting; incomplete model output is not accepted as a finished result.

## Work

Every operating module can create a linked task in Work. Completing a repeating task records a dated, immutable occurrence in Completed and advances the active series to its next due date. One-time tasks remain in Completed until you delete them.

## Newsletter Gmail

The newsletter mailbox can be completely separate from any Gmail account used elsewhere.

The Newsletters page is an intelligence queue rather than an inbox mirror. On a refresh, Control Center reads previously unseen matching Gmail issues and asks the selected AI provider to extract substantive news—not every hyperlink. Navigation, polls, ads, stock tickers, author profiles, and housekeeping are excluded. Safe public tracking redirects, canonical URLs, headline matching, and AI event consolidation group repeat coverage into one story. Each topic shows how many issues and newsletters covered it, links to the original sources, and a Gmail evidence link. Persistent topic aliases keep archive state stable when later newsletters repeat a story.

The active reading queue covers the latest 36 hours; **Earlier** keeps older extracted topics available, and **Archive** contains only stories you manually archived. The first backfill is processed in bounded batches with a visible queued count. Saved results open immediately between background passes. Without a configured AI model, processing pauses and the page explains what to configure instead of falling back to an inbox or link dump.

Sort each queue by **Priority**, **Newest**, or **Oldest**, search the extracted stories, and select one or more newsletters to see their coverage. Multi-newsletter stories remain one card, with all source evidence intact. Only 30 matching cards render initially; **Show 30 more** reveals the next batch. Ranking is stored with the stories, so changing filters or reopening the tab does not spend additional AI tokens. Previously extracted stories receive priority scores in bounded background batches without rereading their Gmail bodies.

1. Create or select a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the Gmail API and configure the OAuth consent screen.
3. Create a **Web application** OAuth client.
4. Copy the exact redirect URI shown under **Settings → Newsletters** into the OAuth client.
5. Paste the client ID and secret, customize the Gmail search query if desired, and choose **Save & choose Gmail account**.

The requested scope is Gmail read-only. The app never sends, labels, deletes, marks as read, or archives Gmail messages. Dashboard archive state is local only. Newsletter text is sent only to the selected AI provider for extraction; email addresses and subscriber-specific link URLs are masked first. Raw bodies are not stored locally; SQLite keeps issue metadata, a body hash, extracted story metadata, and deduplicated topic state.

Google classifies `gmail.readonly` as a restricted scope. A personal OAuth project left in External/Testing mode can require periodic reauthorization; production distribution of shared OAuth credentials requires Google verification. This project intentionally uses bring-your-own OAuth credentials rather than shipping a universal secret.

## Local data and privacy

The server binds to `127.0.0.1` and rejects API requests with foreign Host or Origin headers. Do not expose it through a network proxy without adding authentication.

Fresh installs store durable data outside the application folder:

| Platform | Default data directory                            |
| -------- | ------------------------------------------------- |
| macOS    | `~/Library/Application Support/Spej Control Center`    |
| Windows  | `%LOCALAPPDATA%\Spej Control Center`                   |
| Linux    | `${XDG_DATA_HOME:-~/.local/share}/spej-control-center` |

An optional absolute `CONTROL_CENTER_DATA_DIR` can be set in `.env.local` when you want the private data stored somewhere else.

Stored files include:

- `settings.json`: configuration, OAuth tokens, and any saved AI/provider keys, owner-readable on POSIX systems;
- `control-center.sqlite`: relationships, activities, opportunities, partnerships, campaigns, projects, content, tasks, reminders, raw Industry discoveries, saved collector snapshots, extracted newsletter metadata, and archive state;
- snapshot JSON files: sitemap and audience baselines.

Secrets never return through the Settings API. They remain local, but they are not encrypted at rest. Protect the operating-system account and any backups.

## Backup and recovery

```bash
npm run backup
```

This creates a consistent SQLite backup plus settings and snapshot files under `~/Documents/Spej Control Center Backups/<timestamp>`. It is a private full backup and may contain OAuth tokens or AI provider keys.

To choose another destination:

```bash
npm run backup -- --to=/absolute/path/to/backup-folder
```

If startup safely stops on a local-data error, run `npm run doctor`. The app fails closed: it will not render editable empty defaults or overwrite settings, tasks, or reminders after a failed initial read.

## Updates

For a Git clone:

```bash
git pull --ff-only
npm run launch
```

The setup path compares the installed dependency tree to the committed lockfile and performs a clean install when it changes. User data is outside a fresh checkout, so replacing a ZIP with a newer version does not replace that data directory.

## Development and verification

```bash
npm run setup
npm run dev
npm run check
npm run smoke
```

`npm run check` runs lint, the regression suite, and a production build. `npm run smoke` exercises the same one-command launcher with an isolated temporary data directory and verifies the health endpoint, rendered home page, generic first-run state, and localhost request boundary. GitHub Actions runs the documented setup, full check, and launcher smoke path on Linux, macOS, and Windows.

## Private connector bridge

The standalone dashboard does not automatically inherit private Codex connectors. Instead, **Settings → Integrations** provides a portable local bridge for Gmail, Slack, Granola, Google Calendar, Apple Messages, Computer History, or any other user-approved source.

This is an optional advanced integration, not a login screen. The app names are labels for incoming summaries; adding a label does not connect or authorize the app. Industry, Mentions, Newsletters, Audience, and the daily snapshot work independently of this bridge.

Choose the apps, save, and choose **Copy setup prompt**. The generated prompt tells Codex to use the installed connectors read-only, minimize private content, report per-source success or failure, and send stable action/meeting/message items to the loopback-only Daily Brief endpoint. Successful empty checks are recorded, completed items are reconciled away, and failed sources keep their last successful set while showing the failure. My Work provides Today/Week views and can turn any item into a task. Scripts can use `npm run ingest` with the same JSON contract.

The bridge makes connector-backed overviews portable without shipping anyone's account access. A connector automation still needs to be created by each user because those permissions belong to that user's Codex/provider accounts. See [docs/CONNECTOR_BRIDGE.md](docs/CONNECTOR_BRIDGE.md).

See [CHANGELOG.md](CHANGELOG.md), [CONTRIBUTING.md](CONTRIBUTING.md), and [SECURITY.md](SECURITY.md) for release and project details.
