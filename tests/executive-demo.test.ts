import assert from "node:assert/strict";
import { readFile, rm, stat, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  loadDemoFixture,
  materializeDemoFixture,
  seedDemoDatabase,
  seedDemoSettings,
  WORKSPACE_COLLECTIONS,
} from "../scripts/demo-data.mjs";
import { normalizeWorkspace } from "../lib/workspace-normalization";

const fixturePath = path.resolve("fixtures/executive-demo-workspace.json");

test("executive demo fixture is explicit, sanitized, current, and useful for every preview persona", async () => {
  const raw = await readFile(fixturePath, "utf8");
  const template = JSON.parse(raw);
  const today = new Date(2026, 8, 4, 8, 30);
  const workspace = materializeDemoFixture(template, today);

  assert.equal(template._meta.synthetic, true);
  assert.equal(template._meta.containsCustomerData, false);
  assert.doesNotMatch(
    raw,
    /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret)/i,
  );
  assert.ok(workspace.tasks.length >= 6);
  assert.deepEqual(
    [...new Set(workspace.tasks.map((task) => task.ownerProfileId))].sort(),
    ["aby", "alex", "blanca", "joseph", "ken", "sagar", "sean"],
  );
  assert.equal(workspace.tasks.find((task) => task.id === "demo-task-ai-followup")?.due, "2026-09-04");
  assert.equal(workspace.projects.find((project) => project.id === "demo-project-platform")?.dueDate, "2026-09-06");
  assert.ok(workspace.marketingMetrics.every((metric) => metric.period === "2026-09"));
  assert.doesNotMatch(JSON.stringify(workspace), /\{\{(?:today|now|month)/i);
  assert.ok(workspace.contacts.every((contact) => contact.email === ""));
  assert.deepEqual(
    workspace.content.map((item) => item.approverProfileId),
    ["ken", "aby", "ken", "ken"],
  );
});

test("workspace normalization preserves stable owner profile IDs for demo records", async () => {
  const workspace = await loadDemoFixture(
    fixturePath,
    new Date(2026, 8, 4, 8, 30),
  );
  const normalized = normalizeWorkspace(workspace);

  for (const collection of [
    "accounts",
    "activities",
    "opportunities",
    "partnerships",
    "projects",
    "campaigns",
    "content",
    "tasks",
  ] as const) {
    assert.deepEqual(
      normalized[collection].map((record) => record.ownerProfileId),
      workspace[collection].map((record) => record.ownerProfileId),
      collection,
    );
  }
  assert.deepEqual(
    normalized.content.map((record) => record.approverProfileId),
    workspace.content.map((record) => record.approverProfileId),
  );
});

test("executive demo seeding writes only its isolated private SQLite workspace", { skip: process.platform === "win32" }, async () => {
  const dataDirectory = await mkdtemp(
    path.join(os.tmpdir(), "spej-executive-demo-test-"),
  );
  try {
    const now = new Date("2026-09-04T16:00:00.000Z");
    const workspace = await loadDemoFixture(fixturePath, now);
    const databasePath = await seedDemoDatabase(dataDirectory, workspace, now);
    const settingsPath = await seedDemoSettings(dataDirectory);
    assert.equal((await stat(dataDirectory)).mode & 0o777, 0o700);
    assert.equal((await stat(databasePath)).mode & 0o777, 0o600);
    assert.equal((await stat(settingsPath)).mode & 0o777, 0o600);
    const settings = JSON.parse(await readFile(settingsPath, "utf8"));
    assert.equal(settings.ai.provider, "none");
    assert.deepEqual(settings.industry.sources, []);
    assert.deepEqual(settings.mentions.profiles, []);
    assert.deepEqual(settings.dailyBrief.sections, {
      industry: 0,
      mentions: 0,
      newsletters: 0,
    });

    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      assert.equal(
        database.prepare("PRAGMA user_version").get()?.user_version,
        7,
      );
      const rows = database
        .prepare("SELECT state_key, payload_json FROM workspace_state")
        .all() as unknown as Array<{ state_key: string; payload_json: string }>;
      assert.deepEqual(
        rows.map((row) => row.state_key).sort(),
        [...WORKSPACE_COLLECTIONS].sort(),
      );
      const tasks = JSON.parse(
        rows.find((row) => row.state_key === "tasks")?.payload_json || "[]",
      );
      assert.equal(tasks.length, workspace.tasks.length);
      assert.equal(tasks[0].ownerProfileId, "aby");
    } finally {
      database.close();
    }
  } finally {
    await rm(dataDirectory, { recursive: true, force: true });
  }
});
