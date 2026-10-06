## What changed

## User-visible failure mode addressed

## Data, permissions, and integration impact

- [ ] No canonical record, identity, permission, SOSA, or connector contract changed
- [ ] Any contract change is documented and has an identified Spej IT/data owner

## Verification

- [ ] `node scripts/repository-check.mjs`
- [ ] Clean install completed with `npm ci`
- [ ] `npm run check`
- [ ] `npm run smoke`
- [ ] No local data, credentials, customer/employee content, transcripts, or generated review artifacts added
- [ ] The change still identifies this build as a non-production preview where applicable

## Handoff notes

- Deployment or migration consideration:
- Required executive, data-owner, security, or IT reviewer:
- Rollback or disablement path:
