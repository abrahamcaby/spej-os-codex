# Microsoft integration contract

**Status:** target contract for Spej IT. No Microsoft Graph, Outlook, Teams, SharePoint, calendar, or transcript connection is configured by this repository.

The repository does include pure, tested schemas and mappers in [`lib/integrations/microsoft/`](../lib/integrations/microsoft). They validate and minimize Teams, Outlook, calendar, transcript, and SharePoint reference inputs. They also validate exact Outlook/Teams/calendar/SharePoint action drafts. They do not authenticate to Microsoft, register webhooks, poll Graph, send messages, change calendars/documents, or persist production data.

## Purpose and boundary

Microsoft 365 remains the source of truth for messages, meetings, calendars, and files. Spej OS stores canonical business records plus external references, selected metadata, approved derived facts, and synchronization state. It does not copy an entire mailbox, Team, or SharePoint library into the CRM.

The dashboard, Teams, Outlook, SharePoint/OneDrive, and SOSA must resolve the same verified Spej principal and canonical record IDs. A client-selected **view-as** profile is acceptable for the local demo only; production Home and Today views derive their viewer from validated Entra/Spej identity. Layout preferences are user settings, not authorization claims.

Use two identities for different purposes:

- **Interactive identity:** a signed-in employee authorizes dashboard and SOSA actions. The server derives the Spej principal from validated Entra claims.
- **Connector identity:** an approved workload identity reads configured resources and renews subscriptions. It cannot inherit permissions from text supplied to SOSA.

Never send Graph access or refresh tokens to the browser, model, webhook payload, logs, or canonical records.

## Normalized event contract

Every Graph object or notification is mapped to the provider-neutral integration envelope before processing:

| Field | Rule |
| --- | --- |
| `provider` | `microsoft` |
| `tenantId` | Validated tenant identifier; never inferred from message content |
| `externalId` | Stable Graph resource/object ID within the resource scope |
| `externalVersion` | Graph change key, ETag, sequence, or other stable revision when available |
| `kind` | Allowlisted event kind such as mail, calendar, Teams message, SharePoint reference, or meeting transcript |
| `occurredAt` / `receivedAt` | Valid ISO timestamps; provider time and intake time remain distinct |
| `idempotencyKey` | Deterministic provider + tenant + resource + object + version key |
| `sourceUrl` | Safe HTTP(S) reference; opaque Graph locators stay in allowlisted metadata |
| `payload` | Bounded, schema-validated, minimized metadata; no credentials |

Unknown people remain external participant references until an authorized deterministic match or reviewed CRM-link proposal resolves them. A display name or email similarity must not silently create, merge, or reassign a contact.

## Workload-specific mappings

### Outlook mail

Ingest only configured folders/mailboxes and fields needed for the approved use case: message ID, thread/conversation ID, sender/recipient references, sent/received time, subject, safe source link, and a bounded excerpt when permitted. Prefer storing a reference and derived activity over a full body.

Sending mail, creating a draft, moving a message, or changing categories is an external write. It requires a separately granted capability and user confirmation of recipients and final content. Read access never implies send access.

The included action validator covers a bounded plain-text send draft with exact `to`/`cc`/`bcc`, subject, body, and optional reply target. It does not send anything.

### Calendar and meetings

Read configured calendars for meeting ID, title, time, organizer/attendee references, join/source link, and change version. Create, reschedule, cancel, invite, or alter attendance only through an approved write tool. Recheck the event version immediately before commit.

### Teams

Limit reads to explicitly configured teams/channels/chats and the minimum history needed for the workflow. A bot message, command, or audio transcript enters SOSA with the authenticated Teams principal and correlation ID. Names or @mentions in the body do not determine identity or permissions.

Posting, editing, or deleting a Teams message is a separate external action. Show the destination and final text before a confirmed send unless company policy has explicitly approved a narrow automation.

### SharePoint and OneDrive

Store reference metadata by default: tenant/site/drive/item IDs, version, title, content type, sensitivity label when available, and authorized source URL. Do not persist full file bodies in CRM records. Fetch content on demand through the user's or workload's permitted Graph scope, apply DLP/label policy, bound the excerpt supplied to an agent, and treat document text as untrusted input.

Each authorized artifact reference can link the Microsoft item to one or more canonical accounts, opportunities, projects, or tasks. The relationship is stored in Spej OS using canonical IDs; Microsoft remains the content source of truth. This lets an employee open the relevant file or transcript from the business record without creating an independent document copy.

The included write validator is deliberately limited to version-checked metadata updates. File upload, sharing, and deletion require separate future contracts and security review.

### Meeting transcripts

Store provider meeting/transcript IDs, version, timing, participant references, source link, processing status, and approved retention metadata. A transcript can produce proposed notes, follow-ups, decisions, tasks, account updates, or opportunity changes. Those derived changes are not facts until deterministic validation and the required approval complete.

## Task ownership and bidirectional sync

Today is a deterministic projection across canonical assigned tasks, deadlines, and record-linked next actions; it is not a separate Microsoft task store. Before implementing two-way task updates with Outlook, Teams, Planner, To Do, or another system, Spej IT must choose the canonical task system and define ownership, ID mapping, version/conflict handling, completion semantics, and deletion behavior. Until then, keep Microsoft task inputs read-only or convert them into reviewed proposals.

## Webhook receiver

The receiver must:

1. serve HTTPS and perform Microsoft's validation-token handshake exactly, returning only the required token;
2. verify the configured tenant, subscription, resource, and `clientState` (or stronger supported proof) before accepting a notification;
3. reject unexpected content types, oversized bodies, unknown event kinds, expired subscriptions, and cross-tenant resource IDs;
4. enqueue a minimized notification durably before returning success;
5. avoid trusting notification resource data as the complete object—retrieve the authorized version from Graph when required;
6. log a correlation ID and validation result without tokens or message content.

Subscriptions have finite lifetimes. A monitored renewal job must renew before expiry and handle lifecycle notifications. Renewal failure is an operational alert, not a silent loss of synchronization.

## Delta synchronization, ordering, and retries

- Maintain a cursor per tenant, connector, resource type, and resource scope.
- Process deliveries at least once and make consumers idempotent.
- Duplicate versions are no-ops with an audit outcome.
- Older versions cannot overwrite a newer canonical mapping.
- Advance a cursor only after every accepted item in that page has completed or been durably isolated for approved replay handling.
- On an invalid/expired delta token, start a scoped reconciliation from a recorded checkpoint; do not clear unrelated state.
- Retry throttling, timeouts, `429`, and transient `5xx` responses with bounded exponential backoff and server-provided retry guidance.
- Send exhausted or non-retryable failures to a dead-letter queue containing identifiers, error class, attempt count, and safe metadata—not message bodies or secrets.
- Provide replay tooling that retains the original idempotency key.

## Permissions

Begin with no Graph permission. Add only the delegated or application permission required for one approved workflow and resource set. Prefer resource-specific controls such as selected SharePoint sites and configured mailboxes/teams. Separate read, send, write, subscription, and transcript capabilities. Tenant administrators must verify exact Graph permissions and consent requirements against current Microsoft documentation and Spej policy before deployment.

High-impact permissions, broad `*.Read.All`/`*.ReadWrite.All` grants, and application-level mailbox or Teams access require documented security review. Do not request broad scopes simply to simplify development.

## Required acceptance tests

- Spoofed tenant, resource, subscription, or `clientState` is rejected.
- Replayed and out-of-order notifications do not duplicate or regress records.
- A failed page does not advance its delta cursor.
- Throttling retries and dead-letter replay preserve idempotency.
- Unknown participants remain unlinked until authorized review.
- SharePoint ingestion stores references and allowed metadata, not file bodies.
- Mail, calendar, and Teams writes fail without the exact capability and confirmation.
- Revoked consent, expired subscriptions, and invalid delta tokens create visible health incidents.
- Cross-tenant reads and writes fail even when an external ID happens to match.
- The same verified principal and canonical record ID resolve consistently from Home, Teams, Outlook, SharePoint/OneDrive, and SOSA.
- Client-selected identity or layout settings cannot expand the Home/Today data set.
- Artifact references open the authorized Microsoft source and retain their canonical account/opportunity/project/task relationships.

Production enablement is complete only after these tests run against a non-production Microsoft tenant with representative labels, retention rules, and conditional-access policy.
