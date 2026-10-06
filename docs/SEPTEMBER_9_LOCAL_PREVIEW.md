# September 9: customer development and configurable workspace preview

Status: September 9 independent demo/review build. The handoff pull request is the authority for the published commit and CI status; this document does not approve production deployment. Preserve the existing destination README and handoff notes and publish to a separate review branch. Never push to the public upstream remote or change the production Spej OS repository. Start with [Demo quickstart](DEMO_QUICKSTART.md).

## Try the changes

- My Work → Customize my view: choose shared components, order them, switch between personal and available demo-workspace scope, and save named views. Preferences are browser-local and isolated by preview profile.
- Settings → Access → Available My Work components: administrator-controlled component availability is independent of user layout. Portal restrictions still apply. Demo admin grants reset on reload; this is not server-side authorization.
- CRM → Accounts or Open account → AI profile: current usage, maturity, implementation readiness, primary concern, further discovery questions, source/date and review status. Buying readiness remains separate in Pipeline.
- CRM → People → Set nurture approach: Personal, Campaign, or Coordinated mix; separate Active/Paused/Ended state, owner, channel, next action/date/trigger and coordination rules. CRM → Nurture shows both person-level and account-level plans. Due person-plan reviews appear in attention without sending or resuming outreach.
- Pipeline → Before investing in discovery: budget evidence, delivery capacity, proposed discovery effort and the next qualification question.
- Projects → client-delivery card → Adoption and customer outcomes: technical acceptance separate from adoption, baseline/target/observed result, evidence, owner, blocker and next review. Completed technical projects can still have outstanding adoption reviews.
- Demo profile selector: Blanca, Associate Developer, is available with engineering/project-work templates and a fictional engineering task paired with Sean. No production account was created.
- Projects → project card → Progress updates / Project files and links: append dated notes, decisions, blockers and next steps; attach an HTTPS sharing-page link. No file bytes or access grants are copied. Names are demo labels, not authenticated audit identities. Known credential and signed-download URL parameters are rejected.
- [Mobile readiness](MOBILE_READINESS.md) explains the reusable foundation and remaining secure hosting, touch-layout, PWA and optional native-shell work. No native app was built.

## Data and safety

Optional nested fields are `accounts.aiProfile`, `contacts.nurture`, `opportunities.discoveryEconomics`, `projects.adoptionOutcome`, `projects.progressUpdates` and `projects.resources`. Existing JSON-array persistence and normalization retain them; older records need no mandatory backfill. Progress/resources are separate from canonical external `linkedRecords`. Generic SOSA changes cannot write these reviewed fields or project `linkedRecords`. Unsupported human-reviewed/accepted/on-target claims are downgraded by normalization. Campaign eligibility is bound to the recorded employer and email and must be reviewed after either changes.

Campaigns remain plans, not a sending engine. No recipients are enrolled and no email, LinkedIn action, call, file upload, customer record import, or production mutation is performed by these additions. Pause/reply handling for an actual sending provider is future integration work. Explicit existing commitments remain visible.

Company authentication, record-level permissions, grants persistence, shared view storage, production audit identity, connected SOSA credentials and live external tools still require IT integration. The localhost/production-readiness guard remains in place; do not expose this preview as an authenticated company deployment by simply hosting it on Vercel.

## Parallel local demos

The normal command remains `npm run demo`. For an additional demo without changing a running default `.next` build, set `SPEJ_PREVIEW_BUILD=1`, run `npm run build`, then `npm run demo -- --port=3101` with the same environment variable. This uses `.next-preview`. Each demo has isolated synthetic data, removed when that demo process stops. No changes are synchronized between demo instances.

## Preserve existing production project management

Read-only review of the deployed Spej OS interface on September 9 confirmed project formats named Kanban, Grid and Gantt, plus project Documentation with notebooks and pages. The local preview's project status board and date-bar timeline are not equivalent to all of those features. Preserve the deployed capabilities during integration; do not replace them with the simpler preview. File-upload behavior, detailed progress-history behavior and Gantt dependency editing were not verified in that read-only review. No production project, notebook, pin or permission was changed.

## Verification

The earlier September 9 preview passed 563 tests, lint, TypeScript, optimized build and isolated launcher smoke. The expanded progress/resource suite now contains 567 tests. Record the final fresh-checkout validation and GitHub CI result in the publication pull request. Automated checks do not constitute production approval or a complete browser-interaction test of every control.
