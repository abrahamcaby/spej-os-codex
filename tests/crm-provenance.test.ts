import assert from "node:assert/strict";
import test from "node:test";
import { createGtmAgentRequest } from "../lib/gtm-agent-contract";
import { cleanAccounts } from "../lib/operations";
import type { WorkspaceState } from "../lib/types";

const empty = (): WorkspaceState => ({ reminders: [], tasks: [], content: [], accounts: [], contacts: [], activities: [], opportunities: [], partnerships: [], projects: [], campaigns: [], marketingMetrics: [] });

test("account provenance is normalized without inventing missing legacy origin", () => {
  const [account, legacy, invalid] = cleanAccounts([
    {
      id: "account-1", name: "Example", acquisitionMotion: "Referral", source: "Professional introduction",
      sourceDate: "2026-08-21", originatingContactId: " contact-1 ", referrerContactId: "contact-2",
      sourceArtifactId: " meeting-42 ",
    },
    { id: "legacy", name: "Legacy account" },
    { id: "invalid", name: "Invalid provenance", acquisitionMotion: "Word of mouth", sourceDate: "2026-02-30", originatingContactId: 42 },
  ]);

  assert.deepEqual({
    acquisitionMotion: account.acquisitionMotion, source: account.source, sourceDate: account.sourceDate,
    originatingContactId: account.originatingContactId, referrerContactId: account.referrerContactId,
    sourceArtifactId: account.sourceArtifactId,
  }, {
    acquisitionMotion: "Referral", source: "Professional introduction", sourceDate: "2026-08-21",
    originatingContactId: "contact-1", referrerContactId: "contact-2", sourceArtifactId: "meeting-42",
  });
  assert.equal(legacy.acquisitionMotion, "Unclassified");
  assert.equal(legacy.source, "Unknown / Needs Review");
  assert.equal(invalid.acquisitionMotion, "Unclassified");
  assert.equal(invalid.sourceDate, undefined);
  assert.equal(invalid.originatingContactId, undefined);
});

test("SOSA keeps account, person and opportunity provenance separate", async () => {
  const request = await createGtmAgentRequest({ workspace: empty(), command: "Add the relationship", now: new Date(2026, 8, 3, 12) });
  assert.equal(request.contractVersion, "1.4");
  assert.match(request.prompt, /account origin is how the organization first entered the CRM/);
  assert.match(request.prompt, /person source is how Spej first connected with that individual/);
  assert.match(request.prompt, /opportunity source is what opened that specific buying motion/);
  assert.match(request.prompt, /Never copy one to the others without explicit evidence/);
  assert.match(request.prompt, /Never supply sourceArtifactId; a trusted adapter attaches/);
});
