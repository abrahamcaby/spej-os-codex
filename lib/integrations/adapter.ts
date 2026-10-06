import type { ConnectorEventEnvelope, JsonObject } from "./contracts";

export type ConnectorHealth = {
  provider: string;
  tenantId: string;
  connectorId: string;
  status: "disabled" | "healthy" | "degraded" | "unavailable";
  checkedAt: string;
  safeMessage?: string;
};

export type ConnectorDeltaPage = {
  events: readonly ConnectorEventEnvelope[];
  nextCursor?: string;
  pageComplete: boolean;
};

/** Identity and approval have already been verified by the tool host at this boundary. */
export type ApprovedExternalAction<TDraft extends JsonObject = JsonObject> = {
  tenantId: string;
  principalSubject: string;
  requestId: string;
  proposalId: string;
  proposalFingerprint: string;
  idempotencyKey: string;
  confirmedAt: string;
  draft: TDraft;
};

export type ExternalActionResult = {
  provider: string;
  tenantId: string;
  requestId: string;
  idempotencyKey: string;
  status: "completed" | "rejected" | "unknown";
  externalId?: string;
  externalVersion?: string;
  safeMessage?: string;
};

/**
 * Production adapters implement this interface outside the model. Implementations
 * retrieve credentials from the server-side secret/workload-identity boundary.
 */
export interface IntegrationAdapter<TDraft extends JsonObject = JsonObject> {
  readonly provider: string;
  health(input: { tenantId: string; connectorId: string; correlationId: string }): Promise<ConnectorHealth>;
  readDelta?(input: { tenantId: string; connectorId: string; resourceScope: string; cursor?: string; correlationId: string }): Promise<ConnectorDeltaPage>;
  executeApprovedAction?(action: ApprovedExternalAction<TDraft>): Promise<ExternalActionResult>;
}
