import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function runGit(arguments_) {
  const result = spawnSync("git", arguments_, {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  if (result.status !== 0) {
    fail(`Could not inspect the Git repository: ${result.stderr.trim()}`);
    return "";
  }
  return result.stdout;
}

const trackedFiles = runGit(["ls-files", "-z"])
  .split("\0")
  .filter(Boolean);
const tracked = new Set(trackedFiles);

const allowedEnvironmentTemplates = new Set([
  ".env.example",
  ".env.production.example",
]);
const forbiddenRoots = [
  ".control-center/",
  ".next/",
  ".next-preview/",
  ".playwright-cli/",
  ".spej-control-center/",
  "node_modules/",
  "output/",
];
const forbiddenPackageManagerFiles = [
  "bun.lock",
  "bun.lockb",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "yarn.lock",
];

for (const file of trackedFiles) {
  if (
    file.startsWith(".env") &&
    !allowedEnvironmentTemplates.has(file)
  ) {
    fail(`Tracked environment file is not an approved template: ${file}`);
  }
  if (forbiddenRoots.some((root) => file.startsWith(root))) {
    fail(`Generated or local-only path is tracked: ${file}`);
  }
  if (/\.(?:db|sqlite|sqlite3)(?:-wal|-shm)?$|\.(?:log|p12|pem|pfx|key)$/i.test(file) || /(?:^|\/)(?:id_rsa|id_ed25519|credentials\.json)$/i.test(file)) {
    fail(`Potential local state, log, or credential file is tracked: ${file}`);
  }
}

for (const file of forbiddenPackageManagerFiles) {
  if (tracked.has(file)) {
    fail(`npm is canonical, but an alternate package-manager file is tracked: ${file}`);
  }
}

if (!tracked.has("package-lock.json")) {
  fail("The canonical npm package-lock.json is not tracked.");
}

let packageMetadata;
let packageLock;
try {
  packageMetadata = JSON.parse(readFileSync("package.json", "utf8"));
  packageLock = JSON.parse(readFileSync("package-lock.json", "utf8"));
} catch (error) {
  fail(`Package metadata could not be read: ${error.message}`);
}

if (packageMetadata) {
  if (packageMetadata.private !== true) {
    fail('package.json must retain "private": true to prevent accidental registry publishing.');
  }
  if (!/^npm@\d+(?:\.\d+){2}$/.test(packageMetadata.packageManager || "")) {
    fail("package.json must pin the canonical npm version in packageManager.");
  }
  if (!packageMetadata.engines?.node) {
    fail("package.json must declare the supported Node.js version.");
  }
  if (packageMetadata.license === "MIT") {
    warnings.push(
      "package.json retains the inherited MIT license; repository visibility does not change that metadata.",
    );
  }
}

if (packageMetadata && packageLock) {
  const root = packageLock.packages?.[""];
  if (!root) {
    fail("package-lock.json is missing its root package entry.");
  } else {
    for (const field of ["name", "version"]) {
      if (root[field] !== packageMetadata[field]) {
        fail(`package-lock.json ${field} does not match package.json.`);
      }
    }
    for (const field of ["dependencies", "devDependencies"]) {
      if (
        JSON.stringify(root[field] || {}) !==
        JSON.stringify(packageMetadata[field] || {})
      ) {
        fail(`package-lock.json ${field} does not match package.json.`);
      }
    }
  }
}

if (!existsSync(".github/workflows/check.yml")) {
  fail("The required GitHub quality-gate workflow is missing.");
}

for (const warning of warnings) console.warn(`NOTE: ${warning}`);

if (failures.length > 0) {
  for (const failure of failures) console.error(`ERROR: ${failure}`);
  process.exit(1);
}

console.log(
  `Repository handoff check passed (${trackedFiles.length} tracked files inspected).`,
);
