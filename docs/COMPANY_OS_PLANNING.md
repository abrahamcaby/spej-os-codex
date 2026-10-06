# Company OS planning foundation

Status: local reviewable build, September 17, 2026. Not production-ready or connected to Microsoft/Plooms. This is a separate working copy; the prior demo and original source tree are unchanged.

**Direction update — September 17, 2026:** this is the standalone-new-build handoff, not a required attachment to existing production Spej OS. It supersedes inherited mandatory existing-service wiring prose, while preserving those contracts as optional references and retaining all security/production guards. Local verification does not establish publication or GitHub CI success; record those against the actual review commit.

## Product direction

Plans are editable data, not application code. The planner contains no employee names, GTM targets, publishing quotas, or compulsory schedule. Any authenticated employee should eventually use the same components and capabilities; current identity switching remains explicitly preview-only.

The dashboard keeps one work list, with optional scheduling rather than a second operating-rhythm dashboard:

- **My Work → What needs attention:** the primary action list stays first.
- **Work schedule:** a collapsed section immediately below attention. Suggest and review time blocks for existing tasks. Capacity calculations, unscheduled work, and duration estimates are secondary disclosures, not a permanent KPI row.
- **Calendar:** a dedicated navigation tab with week, month, and weekly agenda views. It shows the same local time blocks plus assigned, route-visible task deadlines, project milestones/target finishes, content review/publishing dates, campaign dates, and CRM/partner follow-up dates. Date-only items are not booked time. Record links open their canonical source; undated records remain in their work views.
- **Calendar → Planning settings:** working hours and optional goals/recurring work. No goal or recurring plan is required to schedule assigned tasks. Goals retain draft/active/archive lifecycle and prior content revisions; availability retains neutral editable defaults.

Tasks remain canonical. Accepting suggestions creates local time blocks linked to task/routine IDs; it never creates a second task. Removing a block does not delete the task. Plan changes affect future suggestions; accepted blocks are not silently rescheduled or removed. Parent routines, records, and completed history remain separate from the calendar representation.

## Try it

For a clean checkout, install dependencies with `npm ci`, then run `npm run company-demo -- --dev --port=3102`. Open `http://127.0.0.1:3102/?tab=today`. For a production-style local run, run `npm run build` first, then `npm run company-demo -- --port=3102`. The launcher uses a temporary synthetic company database and clears inherited AI-provider credentials. It does not load the existing company's local database. Stop the launcher to remove its temporary database; browser-saved plans persist independently.

The [Project work layout notes](TASK_WORK_LAYOUT.md) cover the latest task-row controls and responsive review. Use the [GitHub handoff](GITHUB_HANDOFF.md) for packaging and candidate-commit acceptance gates.

This local working copy currently shares installed dependencies with the earlier source tree through a `node_modules` symlink. Do not package that symlink; use the lockfile and `npm ci` when moving the source to another machine.

1. Open My Work. The action list appears first, with Work schedule closed underneath.
2. Expand Work schedule, reserve existing commitments, and choose Suggest my day. You do not need to create a goal.
3. Review the proposal, adjust task durations if necessary, and accept the local time blocks.
4. Open Calendar. Accepted blocks appear alongside deadlines; use Week, Month, Agenda, date navigation, and layer filters.
5. Open a deadline's source record to manage the real task, project, content item, or follow-up. A deadline does not reserve time.
6. Use Calendar → Planning settings → Working hours to change your working window and reserve.
7. Optionally add a goal under Goals & recurring work, add routines, and activate it. Changing a goal retains history and leaves accepted blocks unchanged.
8. Suggest again for the same day: accepted work is not scheduled twice.
9. Switch preview people: their browser-saved planning workspaces are separate. This is UX isolation, NOT secure multi-user authorization.

Discuss with SOSA passes the visible planning snapshot to the preview's assistant interface. It does not configure a model, grant a tool permission, send a message externally, or write an Outlook event. The schedule generator itself is deterministic and does not pretend to be a live AI model.

## Files and contracts

- `lib/operating-plans.ts`: versioned personal planning schema, validation, revision history, lifecycle transitions.
- `lib/work-planner.ts`: pure whole-block capacity allocation, overlap union, strict local time/date validation, reserve and duplicate handling.
- `lib/planning-candidates.ts`: generic task and active-routine adapter; editable effort placeholders, due dates, and child-task handling.
- `lib/planning-updates.ts`: non-lossy write validation, storage limits, and safe task-completion eligibility.
- `lib/company-calendar.ts`: date-only week/month arithmetic and separate local-block/deadline projections.
- `lib/calendar-deadlines.ts`: personal ownership and route-filtered projections from existing canonical records.
- `components/company-calendar.tsx`: responsive week/month/agenda views, selected-day details, source links, and explicit disconnected Microsoft status.
- `components/work-planning.tsx`: local persistence, conflict checks, plan editor, schedule review, task links, and SOSA handoff.
- `components/control-center.tsx`: My Work integration; only viewable owned tasks enter the planner.

Planner allocation orders candidates by explicit priority, then due date, then stable input order. It does not infer business strategy from a job title. It does not split tasks, move accepted time, optimize across a whole week, execute an ongoing background cadence, or automatically change company policy. Review effort estimates: each task starts at an explicitly adjustable 25-minute placeholder, not measured effort. Aggregate parent tasks with open child tasks are excluded to avoid double-counting. Recurring tasks are opened in their task view for completion so an old block cannot advance the next occurrence.

Duplicate protection is within the selected day. A task may intentionally have planning blocks on multiple days; these are links, not separate task records or tracked remaining effort. Global allocation and occurrence-aware recurrence remain future work.

Suggestions use the full selected work window, not a rolling “from now” window. Reserve elapsed time manually when planning the remainder of today; the UI discloses this limitation.

## Data and safety boundaries

- Version1 state is browser-local under an owner-specific `spej-os-next:planning:v1:` key. No server backup or cross-device synchronization is implied. Working hours includes a JSON backup download.
- Invalid JSON or an unsupported schema stops editing rather than replacing the saved value. Before writes, the stored value is checked for another-window changes; conflicting changes require refresh. This is not a transactional multi-user database.
- Content history retains the latest100 prior revisions. Read normalization bounds plans, routines, days, blocks and estimates. Do not use this preview as a regulated audit archive or a long-term calendar store.
- Demo profiles, including the existing named team examples, are not identity/authentication. Production needs authenticated ownership and permission checks on every read/write; browser storage keys must not be treated as a security boundary.
- Time blocks use local dates and HH:mm, with no live timezone/DST/calendar recurrence synchronization. Outlook/Teams remain disconnected and are clearly labeled.
- Microsoft setup details are an explanation, not a fake connect action. No OAuth grant, calendar discovery, polling, webhook, sync cursor, conflict resolver, or invitation sender is added. Production must implement company sign-in, approved personal/shared calendar selection, source provenance, freshness/error status, and approved outbound changes. A CRM meeting date is explicitly time-unconfirmed, not a fabricated Outlook meeting.
- No external sends, publish actions, calendar invites, background jobs, or GitHub updates are added by this slice.

## Standalone engineering path

This new-build direction supersedes inherited documentation that assumes attaching the prototype to existing production Spej OS services. Those historical documents remain reference material, not evidence of configured infrastructure.

Next integrations require: authenticated company identities and dynamic employee directory; a production database and transactional planning API; governed knowledge/provenance; actual Microsoft calendar/mail/meeting connectors; confirmed Plooms execution and/or usage contract; durable jobs and approval-bound actions. Personal preferences must remain separate from company-wide policies and access rules.

Promote a plan to team/company scope only after implementing explicit owner/editor/reader permissions and review rights. This first slice deliberately supports personal plans over authorized shared task records, not fake company-wide publishing.

## Verification

Recorded local verification, September 17, 2026 (not GitHub CI or production acceptance):

- Latest recorded full automated regression suite: **660 passed, 0 failed**, including Calendar/date/source filtering, the cross-assignee parent-task safeguard, and task-row coverage.
- Full ESLint check: passed.
- Next.js production build with webpack: passed, including TypeScript and all 18 generated pages. Webpack was used because this local working copy shares dependencies via a symlink.
- Demo entry point: loopback port3102 using the command above; a checked-in handoff does not guarantee that a local process is still running.
- Visual/browser walkthrough: **not recorded as complete for this publishing candidate**. Earlier browser verification was blocked; restored browser access alone is not acceptance evidence. Do not read automated checks as visual or end-to-end user acceptance.

Tests cover generic ownership, invalid data, content versions, plan status, accepted history, time windows, weekdays, overlap union, fragmented availability, reserve, blocked work, duplicates, replay, unchanged inputs, limits that fail without discarding records, safe task completion, and long task labels. The React review also tightened profile switching: the pending SOSA command is cleared and its conversation surface remounted when selecting a different preview person.

The remaining manual walkthrough should include collapsed home scheduling, accepting blocks then opening Calendar, week/month/agenda navigation, deadline links, plan editing, reload, profile switching, light/dark modes, and narrow-screen use. The React review also corrected nested calendar CSS specificity and dark-theme contrast; these code checks do not substitute for visual acceptance. Production remains gated independently of local build success.
