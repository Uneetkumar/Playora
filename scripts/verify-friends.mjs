#!/usr/bin/env node
/**
 * Friendship access rules.
 *
 * `friendships` had RLS on and no policies, so everything was silently denied.
 * These checks are mostly negatives: the rules are only worth anything if the
 * sender cannot accept their own request and a stranger cannot read the row.
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

async function guest() {
  const r = await fetch(`${BASE}/auth/v1/signup`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: "{}",
  });
  const b = await r.json();
  if (!b.access_token) throw new Error(`signup failed: ${JSON.stringify(b)}`);
  return { token: b.access_token, id: b.user.id };
}

/** Real accounts, since guests are refused by the add-friend flow by design. */
async function promote(userId, username) {
  const res = await fetch(`${BASE}/rest/v1/profiles?id=eq.${userId}`, {
    method: "PATCH", headers: svc({ Prefer: "return=minimal" }),
    body: JSON.stringify({ username, display_name: username, is_guest: false }),
  });
  if (!res.ok) throw new Error(`profile update failed: ${await res.text()}`);
}

const rest = (path, init) => fetch(`${BASE}/rest/v1/${path}`, init);

async function main() {
  console.log("\n\x1b[1mFriendships\x1b[0m\n");
  const suffix = Math.random().toString(36).slice(2, 7);
  const [alice, bob, carol] = await Promise.all([guest(), guest(), guest()]);
  await Promise.all([
    promote(alice.id, `alice_${suffix}`),
    promote(bob.id, `bob_${suffix}`),
    promote(carol.id, `carol_${suffix}`),
  ]);
  ok("three real accounts created");

  // Alice asks Bob.
  const send = await rest("friendships", {
    method: "POST", headers: asUser(alice.token, { Prefer: "return=representation" }),
    body: JSON.stringify({ user_id: alice.id, friend_id: bob.id, status: "pending" }),
  });
  send.ok ? ok("a player can send a friend request") : bad(`send failed: ${await send.text()}`);
  const row = send.ok ? (await send.json())[0] : null;

  // Inserting as somebody else must be refused.
  const forged = await rest("friendships", {
    method: "POST", headers: asUser(carol.token),
    body: JSON.stringify({ user_id: alice.id, friend_id: carol.id, status: "pending" }),
  });
  forged.ok
    ? bad("a player could send a request in someone else's name")
    : ok(`cannot send a request as another player (HTTP ${forged.status})`);

  // Inserting a pre-accepted friendship must be refused.
  const preAccepted = await rest("friendships", {
    method: "POST", headers: asUser(alice.token),
    body: JSON.stringify({ user_id: alice.id, friend_id: carol.id, status: "accepted" }),
  });
  preAccepted.ok
    ? bad("a player could add themselves to another player's friends list")
    : ok(`cannot insert an already-accepted friendship (HTTP ${preAccepted.status})`);

  if (row) {
    // The sender must not be able to accept their own request.
    const selfAccept = await rest(`friendships?id=eq.${row.id}`, {
      method: "PATCH", headers: asUser(alice.token, { Prefer: "return=representation" }),
      body: JSON.stringify({ status: "accepted" }),
    });
    const selfAcceptRows = selfAccept.ok ? await selfAccept.json() : [];
    selfAcceptRows.length === 0
      ? ok("the sender cannot accept their own request")
      : bad("the sender accepted their own request");

    // A stranger must not see the row at all.
    const strangerRead = await rest(`friendships?id=eq.${row.id}&select=id`, {
      headers: asUser(carol.token),
    });
    const strangerRows = strangerRead.ok ? await strangerRead.json() : [];
    strangerRows.length === 0
      ? ok("an unrelated player cannot read the friendship")
      : bad("a stranger could read someone else's friendship");

    // Both sides can see it.
    for (const [name, who] of [["sender", alice], ["recipient", bob]]) {
      const res = await rest(`friendships?id=eq.${row.id}&select=id,status`, {
        headers: asUser(who.token),
      });
      const rows = res.ok ? await res.json() : [];
      rows.length === 1
        ? ok(`the ${name} can see the request`)
        : bad(`the ${name} could not see the request`);
    }

    // The recipient accepts.
    const accept = await rest(`friendships?id=eq.${row.id}`, {
      method: "PATCH", headers: asUser(bob.token, { Prefer: "return=representation" }),
      body: JSON.stringify({ status: "accepted" }),
    });
    const accepted = accept.ok ? await accept.json() : [];
    accepted[0]?.status === "accepted"
      ? ok("the recipient can accept")
      : bad(`accept failed: ${JSON.stringify(accepted)}`);

    // And either side can walk away.
    const del = await rest(`friendships?id=eq.${row.id}`, {
      method: "DELETE", headers: asUser(alice.token, { Prefer: "return=representation" }),
    });
    const deleted = del.ok ? await del.json() : [];
    deleted.length === 1
      ? ok("either side can remove the friendship")
      : bad(`delete failed: ${JSON.stringify(deleted)}`);
  }

  console.log(failures === 0
    ? "\n\x1b[32mFriendship rules hold.\x1b[0m\n"
    : `\n\x1b[31m${failures} check(s) failed.\x1b[0m\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(`\n\x1b[31mAborted:\x1b[0m ${e.message}\n`); process.exit(1); });
