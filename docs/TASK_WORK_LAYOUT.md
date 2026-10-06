# Task work layout cleanup

September 17, 2026 — local preview only; no GitHub update or production deployment.

## What changed

Project work and GTM work share one `WorkTaskRow` presentation. Task details, labeled controls, and secondary actions have distinct areas instead of relying on the legacy table's conflicting column definitions.

- Owner, status, priority, and due remain visible at every supported width. Four control columns become two below 900px and one at very narrow widths.
- Task titles and descriptions wrap; fields use shrinkable grid columns. No forced 850/1020px task-row minimums remain on the new surface.
- Owner and status are no longer repeated as decorative metadata chips. Editing, adding subtasks, and opening linked records remain available; deletion is inside a closed More actions disclosure and retains confirmation.
- Focused task links show Task details and a Show all work action, not unrelated workspace totals or redundant guidance banners. Missing focused records have a relevant empty state.
- The edit form uses a responsive grid and scrolls below navigation when opened. Legacy Today deadlines are converted to a real local date in the editor.
- The synthetic-data banner scrolls normally rather than sharing the section navigation's sticky offset.

## Safeguards retained and tightened

- Existing preview visibility/edit rules remain in effect; these are not production authentication.
- Completion is disabled when any known child task is open, without disclosing hidden child titles/counts.
- Private work cannot be set to Unassigned through the inline owner control. Current edit permission is rechecked before form submission and in the state updater.
- Read-only views have disabled mutation controls and no delete menu. Secondary actions use native, keyboard-accessible controls.

## Verification

The full automated regression suite passes: **660 tests**, including 10 new server-render tests for row controls, safe defaults, read-only behavior, hidden-child completion, accessible labels, long/escaped titles, and the secondary delete menu. ESLint, TypeScript, and the production build pass.

The layout was reviewed against the supplied screenshot and source-level responsive rules. Live browser/visual acceptance remains uncompleted because the browser security policy check is unavailable. This is not a claim of verified pixel-perfect rendering at every size. The local preview remains at `http://127.0.0.1:3102/?tab=delivery-work&record=demo-task-scorecard`.
