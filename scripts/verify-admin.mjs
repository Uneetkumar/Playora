#!/usr/bin/env node
/**
 * Staff roles and moderation access.
 *
 * Almost every check here is a negative. A moderation system is only worth
 * having if an ordinary player cannot promote themselves, cannot read other
 * people's reports, and cannot quietly edit the record of what was done to
 * them.
 */
import { readFileSync } from "node:fs";

const env = {};
for (const l of readFileSync("apps/web/.env.local", "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const devVars = {};
for (const l of readFileSync("apps/realtime/.dev.vars", "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) devVars[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = devVars.SUPABASE_SERVICE_ROLE_KEY;

let failures = 0;
const ok = (m) => console.log(`  \x1b[32mPASS\x1b[0m ${m}`);
const bad = (m) => { console.log(`  \x1b[31mFAIL\x1b[0m ${m}`); failures++; };

const asUser = (token, extra = {}) => ({
  apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...extra,
});
const svc = (extra = {}) => ({
  apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", ...extra,
});
const rest = (path, init) => fetch(`${BASE}/rest/v1/${path}`, init);

async function guest() {
  const r = await fetch(`${BASE}/auth/v1/signup`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: "{}",
  });
  const b = await r.json();
  if (!b.access_token) throw new Error(`signup failed: ${JSON.stringify(b)}`);
  return { token: b.access_token, id: b.user.id };
}

async function main() {
  console.log("\n\x1b[1mStaff roles and moderation\x1b[0m\n");
  const [player, victim, mod] = await Promise.all([guest(), guest(), guest()]);

  // --- privilege escalation -------------------------------------------------
  const selfPromote = await rest("user_roles", {
    method: "POST", headers: asUser(player.token),
    body: JSON.stringify({ user_id: player.id, role: "admin" }),
  });
  selfPromote.ok
    ? bad("a player promoted themselves to admin")
    : ok(`a player cannot grant themselves a role (HTTP ${selfPromote.status})`);

  // The reason roles are not a column on profiles: that row is self-writable.
  const viaProfile = await rest(`profiles?id=eq.${player.id}`, {
    method: "PATCH", headers: asUser(player.token),
    body: JSON.stringify({ role: "admin" }),
  });
  viaProfile.ok
    ? bad("a player set a role through their own profile row")
    : ok(`no role can be set through the self-writable profile row (HTTP ${viaProfile.status})`);

  // Grant staff out of band, the only way it can be done.
  const grant = await rest("user_roles", {
    method: "POST", headers: svc({ Prefer: "return=representation" }),
    body: JSON.stringify({ user_id: mod.id, role: "moderator" }),
  });
  grant.ok ? ok("the service role can grant staff") : bad(`grant failed: ${await grant.text()}`);

  // --- reports --------------------------------------------------------------
  const file = await rest("reports", {
    method: "POST", headers: asUser(player.token, { Prefer: "return=representation" }),
    body: JSON.stringify({
      reporter_id: player.id, reported_user_id: victim.id, reason: "abuse", details: "test",
    }),
  });
  file.ok ? ok("a player can file a report") : bad(`filing failed: ${await file.text()}`);
  const report = file.ok ? (await file.json())[0] : null;

  const selfReport = await rest("reports", {
    method: "POST", headers: asUser(player.token),
    body: JSON.stringify({ reporter_id: player.id, reported_user_id: player.id, reason: "abuse" }),
  });
  selfReport.ok
    ? bad("a player reported themselves")
    : ok(`a player cannot report themselves (HTTP ${selfReport.status})`);

  const forged = await rest("reports", {
    method: "POST", headers: asUser(player.token),
    body: JSON.stringify({ reporter_id: victim.id, reported_user_id: player.id, reason: "abuse" }),
  });
  forged.ok
    ? bad("a player filed a report in someone else's name")
    : ok(`a player cannot file a report as someone else (HTTP ${forged.status})`);

  // The reported person must not be able to read the complaint about them.
  const victimReads = await rest("reports?select=id", { headers: asUser(victim.token) });
  const victimRows = victimReads.ok ? await victimReads.json() : [];
  victimRows.length === 0
    ? ok("the reported player cannot read reports about them")
    : bad(`the reported player read ${victimRows.length} report(s)`);

  const modReads = await rest("reports?select=id", { headers: asUser(mod.token) });
  const modRows = modReads.ok ? await modReads.json() : [];
  modRows.length > 0
    ? ok(`staff can read the report queue (${modRows.length} open)`)
    : bad("staff could not read reports");

  // --- moderation actions ---------------------------------------------------
  if (report) {
    const playerResolves = await rest(`reports?id=eq.${report.id}`, {
      method: "PATCH", headers: asUser(player.token, { Prefer: "return=representation" }),
      body: JSON.stringify({ status: "dismissed" }),
    });
    const resolved = playerResolves.ok ? await playerResolves.json() : [];
    resolved.length === 0
      ? ok("a reporter cannot resolve their own report")
      : bad("a reporter resolved their own report");
  }

  const modActs = await rest("moderation_actions", {
    method: "POST", headers: asUser(mod.token, { Prefer: "return=representation" }),
    body: JSON.stringify({
      actor_id: mod.id, target_id: victim.id, action: "mute", reason: "abusive chat",
    }),
  });
  modActs.ok ? ok("staff can record a moderation action") : bad(`action failed: ${await modActs.text()}`);

  const playerActs = await rest("moderation_actions", {
    method: "POST", headers: asUser(player.token),
    body: JSON.stringify({ actor_id: player.id, target_id: victim.id, action: "ban", reason: "nope" }),
  });
  playerActs.ok
    ? bad("a player banned someone")
    : ok(`a player cannot moderate (HTTP ${playerActs.status})`);

  const impersonate = await rest("moderation_actions", {
    method: "POST", headers: asUser(mod.token),
    body: JSON.stringify({ actor_id: player.id, target_id: victim.id, action: "ban", reason: "x" }),
  });
  impersonate.ok
    ? bad("a moderator recorded an action under another name")
    : ok(`an action cannot be recorded under someone else's name (HTTP ${impersonate.status})`);

  // The audit trail is append-only from the client's side.
  const edit = await rest(`moderation_actions?target_id=eq.${victim.id}`, {
    method: "PATCH", headers: asUser(mod.token, { Prefer: "return=representation" }),
    body: JSON.stringify({ reason: "changed my mind" }),
  });
  const edited = edit.ok ? await edit.json() : [];
  edited.length === 0
    ? ok("a moderator cannot edit the audit trail")
    : bad("the audit trail was edited");

  // A sanctioned player is entitled to know what was done to them.
  const victimSees = await rest("moderation_actions?select=action,reason", {
    headers: asUser(victim.token),
  });
  const seen = victimSees.ok ? await victimSees.json() : [];
  seen.length > 0
    ? ok("a sanctioned player can see what was done to them, and why")
    : bad("a sanctioned player cannot see their own record");

  // --- blocks ---------------------------------------------------------------
  const block = await rest("blocks", {
    method: "POST", headers: asUser(player.token),
    body: JSON.stringify({ blocker_id: player.id, blocked_id: victim.id }),
  });
  block.ok ? ok("a player can block someone") : bad(`block failed: ${await block.text()}`);

  const blockedReads = await rest("blocks?select=blocker_id", { headers: asUser(victim.token) });
  const blockedRows = blockedReads.ok ? await blockedReads.json() : [];
  blockedRows.length === 0
    ? ok("a blocked player cannot see who blocked them")
    : bad("a blocked player can see who blocked them");

  console.log(failures === 0
    ? "\n\x1b[32mStaff and moderation rules hold.\x1b[0m\n"
    : `\n\x1b[31m${failures} check(s) failed.\x1b[0m\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(`\n\x1b[31mAborted:\x1b[0m ${e.message}\n`); process.exit(1); });
