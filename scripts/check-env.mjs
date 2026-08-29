#!/usr/bin/env node
/**
 * Environment doctor.
 *
 *   node scripts/check-env.mjs          # report what is set and what is missing
 *   node scripts/check-env.mjs --init   # create the env files from templates
 *
 * Reports per-variable status with the exact dashboard location for anything
 * missing, so you never have to guess which key goes where.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INIT = process.argv.includes("--init");

const WEB_ENV = join(ROOT, "apps/web/.env.local");
const WORKER_ENV = join(ROOT, "apps/realtime/.dev.vars");

const g = (s) => `\x1b[32m${s}\x1b[0m`;
const r = (s) => `\x1b[31m${s}\x1b[0m`;
const y = (s) => `\x1b[33m${s}\x1b[0m`;
const d = (s) => `\x1b[2m${s}\x1b[0m`;
const b = (s) => `\x1b[1m${s}\x1b[0m`;

const SPEC = [
  {
    file: WEB_ENV,
    key: "NEXT_PUBLIC_SUPABASE_URL",
    where: "Supabase → Project Settings → API → Project URL",
    looks: "https://xxxxxxxx.supabase.co",
    check: (v) => /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(v),
  },
  {
    file: WEB_ENV,
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    where: "Supabase → Project Settings → API → anon / public",
    looks: "eyJhbGci… or sb_publishable_…",
    check: (v) => v.startsWith("eyJ") || v.startsWith("sb_publishable_"),
  },
  {
    file: WEB_ENV,
    key: "NEXT_PUBLIC_SUPABASE_PROJECT_REF",
    where: "Supabase → Project Settings → General → Reference ID",
    looks: "xxxxxxxx (just the subdomain)",
    check: (v) => /^[a-z0-9]{16,}$/.test(v),
  },
  {
    file: WEB_ENV,
    key: "SUPABASE_SERVICE_ROLE_KEY",
    where: "Supabase → Project Settings → API → service_role / secret",
    looks: "eyJhbGci… or sb_secret_…",
    secret: true,
    check: (v) => v.startsWith("eyJ") || v.startsWith("sb_secret_"),
  },
  {
    file: WORKER_ENV,
    key: "SUPABASE_URL",
    where: "same value as NEXT_PUBLIC_SUPABASE_URL",
    looks: "https://xxxxxxxx.supabase.co",
    check: (v) => /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(v),
  },
  {
    file: WORKER_ENV,
    key: "SUPABASE_SERVICE_ROLE_KEY",
    where: "same value as the web one",
    looks: "eyJhbGci… or sb_secret_…",
    secret: true,
    check: (v) => v.startsWith("eyJ") || v.startsWith("sb_secret_"),
  },
];

const WEB_TEMPLATE = `# Filled in by you. Never committed. See docs/ENVIRONMENT_SETUP.md
NEXT_PUBLIC_APP_URL=http://localhost:8000
NEXT_PUBLIC_REALTIME_WS_URL=ws://localhost:8787

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_PROJECT_REF=
SUPABASE_SERVICE_ROLE_KEY=
`;

const WORKER_TEMPLATE = `# Local-only Worker secrets. Never committed.
# Production uses: pnpm wrangler secret put <NAME>
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
`;

function parseEnvFile(path) {
  if (!existsSync(path)) return null;
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

if (INIT) {
  for (const [path, tpl, label] of [
    [WEB_ENV, WEB_TEMPLATE, "apps/web/.env.local"],
    [WORKER_ENV, WORKER_TEMPLATE, "apps/realtime/.dev.vars"],
  ]) {
    if (existsSync(path)) {
      console.log(`${y("skip")}  ${label} already exists`);
    } else {
      writeFileSync(path, tpl);
      console.log(`${g("created")}  ${label}`);
    }
  }
  console.log(`\nNow paste your values in, then run ${b("pnpm env:check")}\n`);
  process.exit(0);
}

const files = new Map();
let missing = 0;
let present = 0;

console.log(`\n${b("Playora environment check")}\n`);

let currentFile = null;
for (const item of SPEC) {
  if (item.file !== currentFile) {
    currentFile = item.file;
    const rel = item.file.replace(ROOT + "/", "");
    if (!files.has(item.file)) files.set(item.file, parseEnvFile(item.file));
    const exists = files.get(item.file) !== null;
    console.log(`${b(rel)} ${exists ? g("found") : r("MISSING FILE")}`);
  }

  const values = files.get(item.file);
  const value = values?.[item.key] ?? "";
  const label = `  ${item.key}`.padEnd(38);

  if (!value) {
    missing++;
    console.log(`${label}${r("not set")}`);
    console.log(`${d(`      get it: ${item.where}`)}`);
    console.log(`${d(`      format: ${item.looks}`)}`);
  } else if (!item.check(value)) {
    missing++;
    console.log(`${label}${y("looks wrong")}`);
    console.log(`${d(`      expected format: ${item.looks}`)}`);
    console.log(`${d(`      get it: ${item.where}`)}`);
  } else {
    present++;
    const shown = item.secret ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
    console.log(`${label}${g("ok")}  ${d(shown)}`);
  }
}

console.log(`\n${present} ok, ${missing} to go.`);

if (missing > 0) {
  console.log(`\nNo files yet?  ${b("pnpm env:init")}`);
  console.log(`Full walkthrough: ${b("docs/ENVIRONMENT_SETUP.md")}`);
  console.log(`\n${y("Note:")} offline and AI games work without any of this.\n`);
  process.exit(1);
}

console.log(`\n${g("All set.")} Also confirm in the Supabase dashboard:`);
console.log(`  - Authentication → Providers → ${b("Anonymous sign-ins")} enabled`);
console.log(`  - Authentication → Providers → ${b("Google")} enabled with your client id/secret`);
console.log(`  - Authentication → URL Configuration → redirect ${b("http://localhost:8000/auth/callback")}\n`);
