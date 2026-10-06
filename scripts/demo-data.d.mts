import type { WorkspaceState } from "../lib/types";

export const WORKSPACE_COLLECTIONS: readonly (keyof WorkspaceState)[];

export function materializeDemoFixture(
  template: unknown,
  now?: Date,
): WorkspaceState;

export function loadDemoFixture(
  fixturePath: string,
  now?: Date,
): Promise<WorkspaceState>;

export function seedDemoDatabase(
  dataDirectory: string,
  workspace: WorkspaceState,
  now?: Date,
): Promise<string>;

export function seedDemoSettings(dataDirectory: string): Promise<string>;
