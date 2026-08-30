#!/usr/bin/env node
/**
 * Achievements, awarded by the server after a real match.
 *
 * The claim worth testing is that a client cannot award itself anything: the
 * table is publicly readable and not client-writable, and the unlocks appear
 * only because the Worker put them there.
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function createRoom(code, hostId) {
  const g = await fetch(`${BASE}/rest/v1/games?slug=eq.chess&select=id`, { headers: svc() });
  const gameId = (await g.json())[0]?.id;
  const res = await fetch(`${BASE}/rest/v1/rooms`, {
    method: "POST", headers: svc({ Prefer: "return=representation" }),
    body: JSON.stringify({
      code, name: "Achievements check", host_id: hostId, game_id: gameId,
      status: "waiting", is_private: false, max_players: 2, settings: {},
    }),
  });
  if (!res.ok) throw new Error(`room insert failed: ${await res.text()}`);
}

function client(code) {
  const seen = [];
  const ws = new WebSocket(`ws://localhost:8787/rooms/${code}/ws?gameId=chess`);
  ws.addEventListener("message", (e) => seen.push(JSON.parse(e.data)));
  return {
    seen, ws,
    open: new Promise((res) => ws.addEventListener("open", res)),
    send: (m) => ws.send(JSON.stringify(m)),
    waitFor: (pred, label, ms = 20000) =>
      new Promise((res, rej) => {
        const t0 = Date.now();
        const iv = setInterval(() => {
          const hit = seen.find(pred);
          if (hit) { clearInterval(iv); res(hit); }
          else if (Date.now() - t0 > ms) {
            clearInterval(iv);
            rej(new Error(`timeout: ${label}; saw ${[...new Set(seen.map((m) => m.type))].join(",")}`));
          }
        }, 40);
      }),
  };
}

async function unlocksFor(userId, token) {
  const res = await fetch(
    `${BASE}/rest/v1/user_achievements?select=achievement_id,unlocked_at&user_id=eq.${userId}`,
    { headers: { apikey: ANON, Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`read failed ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  console.log("\n\x1b[1mAchievements\x1b[0m\n");
  const [p1, p2] = await Promise.all([guest(), guest()]);
  const code = `AC${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  await createRoom(code, p1.id);

  (await unlocksFor(p1.id, p1.token)).length === 0
    ? ok("a new player has no achievements")
    : bad("unexpected achievements before playing");

  const a = client(code); await a.open;
  a.send({ type: "AUTH", token: p1.token, isGuest: true });
  await a.waitFor((m) => m.type === "CONNECTED", "P1 connected");
  const b = client(code); await b.open;
  b.send({ type: "AUTH", token: p2.token, isGuest: true });
  await b.waitFor((m) => m.type === "CONNECTED", "P2 connected");

  a.send({ type: "READY", roomId: code });
  b.send({ type: "READY", roomId: code });
  a.send({ type: "START_GAME", roomId: code });
  const started = await a.waitFor((m) => m.type === "GAME_STARTED", "started");

  b.send({ type: "GAME_ACTION", roomId: code, sessionId: started.sessionId, actionType: "RESIGN", payload: {} });
  await a.waitFor((m) => m.type === "GAME_FINISHED", "finished");
  ok("played a match that P1 won by resignation");

  // The client is told what it unlocked, on the same message as rating and XP.
  const progression = await a.waitFor((m) => m.type === "MATCH_PROGRESSION", "progression", 25000);
  const mine = progression.players.find((p) => p.userId === p1.id);
  Array.isArray(mine?.unlockedAchievements) && mine.unlockedAchievements.length > 0
    ? ok(`the winner was told about ${mine.unlockedAchievements.length}: ${mine.unlockedAchievements.join(", ")}`)
    : bad(`no achievements on the progression message: ${JSON.stringify(mine)}`);

  let rows = [];
  for (let i = 0; i < 10 && rows.length === 0; i++) {
    await wait(600);
    rows = await unlocksFor(p1.id, p1.token);
  }
  const ids = rows.map((r) => r.achievement_id);

  ids.includes("first-match") ? ok("first-match was awarded") : bad(`missing first-match: ${ids}`);
  ids.includes("first-win") ? ok("first-win was awarded") : bad(`missing first-win: ${ids}`);
  ids.includes("comeback")
    ? ok("the secret resignation achievement was awarded")
    : bad(`missing comeback: ${ids}`);

  const loser = (await unlocksFor(p2.id, p2.token)).map((r) => r.achievement_id);
  loser.includes("first-match") && !loser.includes("first-win")
    ? ok("the loser got first-match but not first-win")
    : bad(`loser's achievements wrong: ${loser}`);

  // The important negative: a signed-in client must not be able to write here.
  const forge = await fetch(`${BASE}/rest/v1/user_achievements`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${p2.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: p2.id, achievement_id: "level-50" }),
  });
  forge.ok
    ? bad("a client was able to award itself an achievement")
    : ok(`a client cannot insert its own achievements (HTTP ${forge.status})`);

  a.ws.close(); b.ws.close();
  await wait(200);
  console.log(failures === 0
    ? "\n\x1b[32mAchievements are awarded server-side.\x1b[0m\n"
    : `\n\x1b[31m${failures} check(s) failed.\x1b[0m\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(`\n\x1b[31mAborted:\x1b[0m ${e.message}\n`); process.exit(1); });
