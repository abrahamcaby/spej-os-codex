# Spej OS Aby revamp — live demo and IT starting point

This is the independent revamp review build, not the deployed company system. Keep `SpejAI/spej-ai-os` and this repository's main branch unchanged until IT approves integration.

## Run the latest review branch

Check out the branch identified by the handoff pull request, not an older default-branch snapshot. Use Node 24.19 or newer and npm 11.19.0:

```bash
npm ci
npm run check
npm run smoke
npm run demo -- --port=3101
```

Open `http://127.0.0.1:3101/?tab=today` on that computer. Internet is needed for initial dependency installation; the synthetic walkthrough itself does not require a live model. The demo seeds fictional records with dates relative to today. Changes last for that running demo and are removed when it stops. Restarting gives a clean walkthrough. Do not use it for real operational data.

## A practical ten-minute walkthrough

1. **My Work:** show the connected task, deadline and review queue. Open **Customize my view**, select components, reorder them and save a named view. Explain that component availability/access and personal layout are separate decisions—not a new dashboard built for every employee.
2. **AI readiness:** open an account's AI profile. Compare what the customer uses today, maturity, implementation readiness and primary concern with commercial buying readiness. Show source evidence and review status rather than treating an AI guess as fact.
3. **Nurture:** on a person, select Personal, Campaign or Coordinated mix. Show owner, channel, next action/date, pause state and coordination rules. Personal nurturing can mean a call, useful introduction, meeting or thoughtful message; campaign planning does not automatically send anything.
4. **Pipeline:** show qualification before investing in discovery: budget evidence, capacity, effort and the next question. Demonstrate a reviewed delivery handoff rather than treating a won deal as work already started.
5. **Projects:** show the status board and date-bar timeline, then open a project card. Add a dated progress note, next step and HTTPS resource link. The source system still owns file permissions; no file is uploaded. Compare technical acceptance with actual customer adoption and the next outcome review.
6. **Engineering:** select Blanca's demo profile. Show her associate-developer work paired with Sean and the same configurable components, with a different starting focus.
7. **SOSA:** show the proposal/review boundary and current connection status. End with what Sean will connect to the existing system and what should be retained from production.

## Showing actual AI processing

The safe demo starts with **Preview model off**. That is intentional, not a simulation of a connected agent. Its launcher clears provider keys and does not load normal local settings. The existing production SOSA, Outlook, Teams, SharePoint and sending tools are not connected.

If approved for a live AI demonstration, use **SOSA → Configure preview** to select an available provider/model and supply credentials privately through the local settings UI. Use only fictional records and invented notes. Requests may transmit their included context to that provider and incur its charges. Never put credentials into GitHub, a walkthrough recording or a shared screenshot. A configured preview model is not the production SOSA service.

Example request: “Using only this fictional workspace, suggest the next follow-up for the AI Office activation project. Prepare a task for review; do not claim it has been completed.” Review the proposed changes before applying them. Human-reviewed AI assessments, nurture decisions, adoption outcomes, progress history and file references cannot be forged by generic agent proposals. If the provider is unavailable, continue the product walkthrough and clearly say no live AI ran.

## Before a hosted demo or company deployment

GitHub stores the code; pushing it does not deploy the application. This loopback-only SQLite preview is not a ready-made Vercel production app. Sean must choose a protected demo/production environment, connect company authentication and server-side permissions, supply durable authoritative storage and versioned writes, and register the existing SOSA/integration services. Do not bypass the production guard for a public demo.

Preserve existing production Kanban, Grid, Gantt and Documentation capabilities. The preview's simpler board/timeline is not full parity. The [September 9 change notes](SEPTEMBER_9_LOCAL_PREVIEW.md), [IT handoff](GITHUB_HANDOFF.md) and [mobile roadmap](MOBILE_READINESS.md) distinguish implemented behavior from remaining work.
