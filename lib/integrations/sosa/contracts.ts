import {
  assertTenantAccess,
  hasPermission,
  type AuthenticatedPrincipal,
  type SpejPermission,
} from "../../server/auth/principal";

export type SosaChannel = "dashboard" | "teams" | "mobile" | "voice" | "api";

export type SosaToolOperation =
  | "records.read"
  | "records.search"
  | "records.prepare"
  | "records.commit"
  | "outlook.send"
  | "teams.send"
  | "calendar.write"
  | "sharepoint.write";

export type SosaRequestContext = {
  requestId: string;
  channel: SosaChannel;
  principal: AuthenticatedPrincipal;
};

/** Exact action set produced during the propose phase. It contains no credentials. */
export type SosaProposalBinding = {
  proposalId: string;
  proposalFingerprint: string;
  requestId: string;
  tenantId: string;
  principalSubject: string;
  operations: readonly SosaToolOperation[];
  preparedAt: string;
  expiresAt: string;
};

/** User approval is bound to one immutable proposal and one authenticated identity. */
export type SosaHumanConfirmation = {
  proposalId: string;
  proposalFingerprint: string;
  tenantId: string;
  confirmedBy: string;
  confirmedAt: string;
};

export type SosaAuthorizationDecision = {
  allowed: boolean;
  operation: SosaToolOperation;
  permission: SpejPermission;
  requiresHumanConfirmation: boolean;
  reason: string;
};

const POLICY: Record<SosaToolOperation, { permission: SpejPermission; confirmation: boolean }> = {
  "records.read": { permission: "records.read", confirmation: false },
  "records.search": { permission: "records.read", confirmation: false },
  "records.prepare": { permission: "records.propose", confirmation: false },
  "records.commit": { permission: "records.commit", confirmation: true },
  "outlook.send": { permission: "external.send", confirmation: true },
  "teams.send": { permission: "external.send", confirmation: true },
  "calendar.write": { permission: "external.write", confirmation: true },
  "sharepoint.write": { permission: "external.write", confirmation: true },
};

function denied(operation: SosaToolOperation, permission: SpejPermission, confirmation: boolean, reason: string): SosaAuthorizationDecision {
  return { allowed: false, operation, permission, requiresHumanConfirmation: confirmation, reason };
}

function validInstant(value: string) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validBindingText(value: unknown) {
  return typeof value === "string" && value.length >= 1 && value.length <= 500;
}

/**
 * Authorization is deterministic and independent of model output. The caller is
 * still responsible for authenticating the principal and executing the approved
 * action through the relevant gateway/adapter.
 */
export function authorizeSosaToolCall(input: {
  context: SosaRequestContext;
  operation: SosaToolOperation;
  tenantId: string;
  proposal?: SosaProposalBinding;
  confirmation?: SosaHumanConfirmation;
  now?: Date;
}): SosaAuthorizationDecision {
  const policy = POLICY[input.operation];
  if (!policy) return denied(input.operation, "records.read", true, "This SOSA operation is not supported.");
  try {
    assertTenantAccess(input.context.principal, input.tenantId);
    if (!hasPermission(input.context.principal, policy.permission)) {
      return denied(input.operation, policy.permission, policy.confirmation, `The authenticated principal lacks ${policy.permission}.`);
    }
  } catch {
    return denied(input.operation, policy.permission, policy.confirmation, "The authenticated principal or tenant binding is invalid.");
  }
  if (!policy.confirmation) {
    return { allowed: true, operation: input.operation, permission: policy.permission, requiresHumanConfirmation: false, reason: "Authorized by the authenticated principal's scoped permission." };
  }

  const proposal = input.proposal;
  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) return denied(input.operation, policy.permission, true, "A prepared proposal is required.");
  if (
    !validBindingText(proposal.proposalId) ||
    !validBindingText(proposal.proposalFingerprint) ||
    !validBindingText(proposal.requestId) ||
    proposal.tenantId !== input.tenantId ||
    proposal.principalSubject !== input.context.principal.subject ||
    proposal.requestId !== input.context.requestId ||
    !Array.isArray(proposal.operations)
  ) {
    return denied(input.operation, policy.permission, true, "The proposal is not bound to this request, tenant, and principal.");
  }
  if (!proposal.operations.includes(input.operation)) {
    return denied(input.operation, policy.permission, true, "The proposed action does not include this operation.");
  }
  const now = (input.now ?? new Date()).getTime();
  if (!validInstant(proposal.preparedAt) || !validInstant(proposal.expiresAt) || Date.parse(proposal.preparedAt) >= Date.parse(proposal.expiresAt) || Date.parse(proposal.expiresAt) <= now) {
    return denied(input.operation, policy.permission, true, "The proposal has expired or has an invalid expiry.");
  }
  const confirmation = input.confirmation;
  if (!confirmation || typeof confirmation !== "object" || Array.isArray(confirmation)) return denied(input.operation, policy.permission, true, "Human confirmation is required.");
  if (
    confirmation.proposalId !== proposal.proposalId ||
    confirmation.proposalFingerprint !== proposal.proposalFingerprint ||
    confirmation.tenantId !== proposal.tenantId ||
    confirmation.confirmedBy !== input.context.principal.subject ||
    !validInstant(confirmation.confirmedAt) ||
    Date.parse(confirmation.confirmedAt) < Date.parse(proposal.preparedAt) ||
    Date.parse(confirmation.confirmedAt) > now + 60_000
  ) {
    return denied(input.operation, policy.permission, true, "The confirmation does not match the prepared proposal and authenticated principal.");
  }
  return { allowed: true, operation: input.operation, permission: policy.permission, requiresHumanConfirmation: true, reason: "The scoped operation matches a current, human-confirmed proposal." };
}

export function assertAuthorizedSosaToolCall(input: Parameters<typeof authorizeSosaToolCall>[0]) {
  const decision = authorizeSosaToolCall(input);
  if (!decision.allowed) throw new Error(decision.reason);
  return decision;
}
