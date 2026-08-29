#!/usr/bin/env node
/**
 * Single source of truth for the product version: the root package.json.
 *
 * Propagates that version to every workspace package and regenerates the
 * version modules the apps import, so no version string is ever hand-written.
 *
 *   node scripts/sync-version.mjs           # write
 *   node scripts/sync-version.mjs --check   # verify only, non-zero exit on drift (CI)
 *
 * Runs automatically via the root `prebuild` script, so a build always
 * reports the version that is actually in package.json.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "node:fs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

const drift = [];
const changed = [];

function readJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

/** Write only if content differs; record drift in --check mode. */
function emit(absPath, next) {
  const rel = relative(ROOT, absPath);
  const prev = existsSync(absPath) ? readFileSync(absPath, "utf8") : null;
  if (prev === next) return;
  if (CHECK) {
    drift.push(rel);
    return;
  }
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, next);
  changed.push(rel);
}

const version = readJson(join(ROOT, "package.json")).version;
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error(`✗ Root package.json version is not valid semver: "${version}"`);
  process.exit(1);
}

// 1. Propagate to every workspace package.json
const workspaceManifests = globSync("{apps,packages}/*/package.json", { cwd: ROOT })
  .map((p) => join(ROOT, p));

for (const manifestPath of workspaceManifests) {
  const raw = readFileSync(manifestPath, "utf8");
  const pkg = JSON.parse(raw);
  if (pkg.version === version) continue;
  // Preserve formatting/key order by patching just the version line.
  const patched = raw.replace(
    /("version"\s*:\s*")[^"]*(")/,
    `$1${version}$2`,
  );
  emit(manifestPath, patched);
}

// 2. Regenerate the version modules the apps import
const banner = `// GENERATED FILE - DO NOT EDIT.
// Source of truth: root package.json. Regenerate with \`pnpm version:sync\`.
`;

const targets = [
  "apps/realtime/src/version.ts",
  "apps/web/src/lib/version.ts",
];

for (const target of targets) {
  const appDir = target.split("/").slice(0, 2).join("/");
  if (!existsSync(join(ROOT, appDir))) continue;
  emit(
    join(ROOT, target),
    `${banner}\nexport const APP_VERSION = ${JSON.stringify(version)} as const;\n`,
  );
}

// 3. Report
if (CHECK) {
  if (drift.length) {
    console.error(`✗ Version drift detected (root is ${version}). Out of sync:`);
    for (const f of drift) console.error(`    ${f}`);
    console.error(`\n  Fix with: pnpm version:sync`);
    process.exit(1);
  }
  console.log(`✓ All workspace versions in sync at ${version}`);
} else {
  if (changed.length) {
    console.log(`✓ Synced ${changed.length} file(s) to version ${version}:`);
    for (const f of changed) console.log(`    ${f}`);
  } else {
    console.log(`✓ Already in sync at ${version}`);
  }
}
