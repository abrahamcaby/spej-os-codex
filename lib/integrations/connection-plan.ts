import { CONNECTION_CATALOG } from "./connection-catalog";

export type ConnectionScope = "personal" | "company";

/** A user's planning choice, never provider consent or authority to run an action. */
export type ConnectionSelection = {
  providerId: string;
  scope: ConnectionScope;
  capabilityIds: string[];
};

export type ConnectionPlan = {
  schemaVersion: 1;
  profileId: string;
  selections: ConnectionSelection[];
};

const SCOPES: readonly ConnectionScope[] = ["personal", "company"];
const MAX_SELECTION_INPUTS = 64;
const MAX_CAPABILITY_INPUTS = 32;

function requireProfileId(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(value)) {
    throw new Error("Connection plan profile must be a bounded profile identifier.");
  }
}

function requireRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error(message);
  return value as Record<string, unknown>;
}

export function emptyConnectionPlan(profileId: string): ConnectionPlan {
  requireProfileId(profileId);
  return { schemaVersion: 1, profileId, selections: [] };
}

/**
 * Only known IDs cross this boundary. Unknown fields (including credentials,
 * approval claims, free text, and URLs) are never copied. Invalid plans throw;
 * callers may offer recovery, but must not treat future schemas as version 1.
 */
export function cleanConnectionPlan(value: unknown, profileId: string): ConnectionPlan {
  requireProfileId(profileId);
  const input = requireRecord(value, "Connection plan must be an object.");
  if (input.schemaVersion !== 1) {
    throw new Error("Unsupported connection plan schema. Only version 1 can be opened; no selections were applied.");
  }
  if (input.profileId !== profileId) {
    throw new Error("Connection plan belongs to a different profile; no selections were applied.");
  }
  if (!Array.isArray(input.selections) || input.selections.length > MAX_SELECTION_INPUTS) {
    throw new Error("Connection plan must contain at most 64 selection entries.");
  }

  const selected = new Map<string, Set<string>>();
  for (const value of input.selections) {
    const selection = requireRecord(value, "Each connection selection must be an object.");
    const provider = CONNECTION_CATALOG.find((entry) => entry.id === selection.providerId);
    if (!provider) throw new Error("Connection plan contains an unknown provider.");
    const scope = selection.scope;
    if ((scope !== "personal" && scope !== "company") || !provider.scopes.includes(scope)) {
      throw new Error("Connection plan contains an unsupported connection scope.");
    }
    if (!Array.isArray(selection.capabilityIds) || selection.capabilityIds.length > MAX_CAPABILITY_INPUTS) {
      throw new Error("Each connection selection must contain at most 32 capability identifiers.");
    }
    const key = `${provider.id}:${scope}`;
    const capabilities = selected.get(key) ?? new Set<string>();
    for (const capabilityId of selection.capabilityIds) {
      if (typeof capabilityId !== "string" || !provider.capabilities.some((capability) => capability.id === capabilityId)) {
        throw new Error("Connection plan contains an unknown capability for its provider.");
      }
      capabilities.add(capabilityId);
    }
    selected.set(key, capabilities);
  }

  const selections: ConnectionSelection[] = [];
  // Catalog order makes exports stable regardless of click order or duplicates.
  for (const provider of CONNECTION_CATALOG) {
    for (const scope of SCOPES) {
      const selectedCapabilities = selected.get(`${provider.id}:${scope}`);
      if (!selectedCapabilities) continue;
      selections.push({
        providerId: provider.id,
        scope,
        capabilityIds: provider.capabilities.filter((capability) => selectedCapabilities.has(capability.id)).map((capability) => capability.id),
      });
    }
  }
  return { schemaVersion: 1, profileId, selections };
}

/** A reviewable IT handoff. Exporting it performs no network or authorization action. */
export function buildConnectionHandoff(plan: ConnectionPlan): string {
  const cleaned = cleanConnectionPlan(plan, plan.profileId);
  return JSON.stringify({
    ...cleaned,
    planningOnly: true,
    productionAuthority: false,
    purpose: "Connection capability requests for IT review. No connection, consent, or action approval is created by this plan.",
    scopeMeaning: "Personal and company describe intended use. Both remain local planning choices for this profile, not data access grants.",
    requests: cleaned.selections.map((selection) => {
      const provider = CONNECTION_CATALOG.find((entry) => entry.id === selection.providerId)!;
      return {
        providerId: provider.id,
        providerName: provider.name,
        scope: selection.scope,
        transport: provider.transport,
        implementationStatus: provider.foundation,
        capabilities: provider.capabilities.filter((capability) => selection.capabilityIds.includes(capability.id)).map((capability) => ({
          id: capability.id,
          label: capability.label,
          requestedAccess: capability.access,
          productionAuthority: false,
        })),
        preparation: provider.setupSteps,
        documentation: provider.docsUrl,
      };
    }),
    beforeAnyLiveConnection: [
      "IT must determine exact provider permissions and resource boundaries; functional capability requests are not OAuth scopes.",
      "Identity, secure credential handling, consent, adapter implementation, and audit controls must be completed separately.",
      "Write requests remain planning choices and require separate authorization and review for each external action.",
    ],
  }, null, 2);
}
