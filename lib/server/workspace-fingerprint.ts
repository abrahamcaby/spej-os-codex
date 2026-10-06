import "server-only";

import { createHash } from "node:crypto";
import { workspaceFingerprintPayload } from "@/lib/agent-session";
import type { WorkspaceState } from "@/lib/types";

export function workspaceFingerprintSync(workspace: WorkspaceState) {
  return createHash("sha256").update(workspaceFingerprintPayload(workspace), "utf8").digest("hex");
}
