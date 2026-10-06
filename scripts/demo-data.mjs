import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export const WORKSPACE_COLLECTIONS = [
  "reminders",
  "tasks",
  "content",
  "accounts",
  "contacts",
  "activities",
  "opportunities",
  "partnerships",
  "projects",
  "campaigns",
  "marketingMetrics",
];

const PREVIEW_PROFILES = new Map([
  ["aby", "Aby"],
  ["sagar", "Sagar"],
  ["alex", "Alex"],
  ["joseph", "Joseph"],
  ["ken", "Ken"],
  ["sean", "Sean"],
  ["blanca", "Blanca"],
]);

function atLocalNoon(now, dayOffset = 0) {
  const value = new Date(now);
  value.setHours(12, 0, 0, 0);
  value.setDate(value.getDate() + dayOffset);
  return value;
}

function localDate(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function relativeValue(token, now) {
  const match = /^\{\{(today|now|month)([+-]\d+)?\}\}$/.exec(token);
  if (!match) return token;
  const [, kind, rawOffset] = match;
  const offset = Number(rawOffset || 0);
  if (kind === "today") return localDate(atLocalNoon(now, offset));
  if (kind === "now") return atLocalNoon(now, offset).toISOString();
  const value = atLocalNoon(now);
  value.setDate(1);
  value.setMonth(value.getMonth() + offset);
  return localDate(value).slice(0, 7);
}

function resolveRelativeValues(value, now) {
  if (typeof value === "string") return relativeValue(value, now);
  if (Array.isArray(value))
    return value.map((item) => resolveRelativeValues(item, now));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      resolveRelativeValues(item, now),
    ]),
  );
}

function assertOwnedRecords(workspace) {
  for (const collection of [
    "accounts",
    "activities",
    "opportunities",
    "partnerships",
    "projects",
    "campaigns",
    "content",
    "tasks",
  ]) {
    for (const record of workspace[collection]) {
      if (!record.ownerProfileId) continue;
      const expectedName = PREVIEW_PROFILES.get(record.ownerProfileId);
      if (!expectedName)
        throw new Error(
          `${collection}.${record.id} has an unknown preview owner profile ID.`,
        );
      if (record.owner !== expectedName)
        throw new Error(
          `${collection}.${record.id} must pair ownerProfileId ${record.ownerProfileId} with the ${expectedName} display label.`,
        );
    }
  }
  for (const record of workspace.content) {
    if (!record.approverProfileId) continue;
    const expectedName = PREVIEW_PROFILES.get(record.approverProfileId);
    if (!expectedName)
      throw new Error(
        `content.${record.id} has an unknown preview approver profile ID.`,
      );
    if (record.approver !== expectedName)
      throw new Error(
        `content.${record.id} must pair approverProfileId ${record.approverProfileId} with the ${expectedName} display label.`,
      );
  }
}

export function materializeDemoFixture(template, now = new Date()) {
  if (
    !template ||
    typeof template !== "object" ||
    template._meta?.synthetic !== true ||
    template._meta?.containsCustomerData !== false
  )
    throw new Error(
      "The executive demo fixture must explicitly declare synthetic data and no customer data.",
    );
  if (!template.workspace || typeof template.workspace !== "object")
    throw new Error("The executive demo fixture is missing its workspace.");
  for (const collection of WORKSPACE_COLLECTIONS) {
    if (!Array.isArray(template.workspace[collection]))
      throw new Error(`The executive demo fixture is missing ${collection}.`);
  }
  const workspace = resolveRelativeValues(template.workspace, now);
  const unresolved = JSON.stringify(workspace).match(/\{\{(?:today|now|month)/i);
  if (unresolved)
    throw new Error("The executive demo fixture contains an invalid relative date token.");
  assertOwnedRecords(workspace);
  return workspace;
}

export async function loadDemoFixture(
  fixturePath,
  now = new Date(),
) {
  const template = JSON.parse(await readFile(fixturePath, "utf8"));
  return materializeDemoFixture(template, now);
}

export async function seedDemoDatabase(dataDirectory, workspace, now = new Date()) {
  await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
  await chmod(dataDirectory, 0o700).catch(() => undefined);
  const databasePath = path.join(dataDirectory, "control-center.sqlite");
  const database = new DatabaseSync(databasePath);
  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS workspace_state (
        state_key TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    const insert = database.prepare(`
      INSERT INTO workspace_state (state_key, payload_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT (state_key) DO UPDATE SET
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `);
    database.exec("BEGIN IMMEDIATE");
    try {
      for (const collection of WORKSPACE_COLLECTIONS)
        insert.run(collection, JSON.stringify(workspace[collection]), now.toISOString());
      database.exec("PRAGMA user_version = 7; COMMIT;");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  } finally {
    database.close();
  }
  await chmod(databasePath, 0o600).catch(() => undefined);
  return databasePath;
}

export async function seedDemoSettings(dataDirectory) {
  await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
  const settingsPath = path.join(dataDirectory, "settings.json");
  const settings = {
    general: { workspaceName: "Spej OS · Synthetic executive demo" },
    industry: {
      sources: [],
      keywords: [],
      description: "Live intelligence sources are disabled in the synthetic executive demo.",
      excludedTerms: [],
      dailyLimit: 5,
    },
    mentions: {
      profiles: [],
      terms: [],
      websites: [],
      identityAnchors: [],
      negativeTerms: [],
      strictMode: true,
      excludeOwnedSites: true,
    },
    newsletters: {
      googleClientId: "",
      googleClientSecret: "",
      connectedEmail: "",
      refreshToken: "",
      accessToken: "",
      accessTokenExpiresAt: 0,
      gmailQuery: "",
    },
    audience: { accounts: [] },
    ai: {
      provider: "none",
      model: "",
      apiKeys: {
        openai: "",
        anthropic: "",
        gemini: "",
        xai: "",
        lmstudio: "",
        ollama: "",
      },
      localBaseUrls: {},
    },
    dailyBrief: {
      sourceLabels: [],
      lookbackDays: 7,
      sections: { industry: 0, mentions: 0, newsletters: 0 },
    },
  };
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, {
    mode: 0o600,
  });
  await chmod(settingsPath, 0o600).catch(() => undefined);
  return settingsPath;
}
