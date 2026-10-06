import "server-only";

import type { CustomBackgroundAiAdapter } from "./custom-background-ai";

/**
 * Trusted IT-owned registration point. Return an explicitly imported, reviewed
 * adapter here after its real provider contract and deployment are approved.
 * Never select module paths, endpoints, or credentials from browser settings.
 */
export function getCustomBackgroundAiAdapter(): CustomBackgroundAiAdapter | undefined {
  return undefined;
}
