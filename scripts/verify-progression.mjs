#!/usr/bin/env node
/**
 * End-to-end progression check.
 *
 * Plays a real match to a finish and confirms rating, rating history, XP and
 * streaks are applied. Requires a Worker on :8787 and apps/web/.env.local.
 */
import { readFileSync } from "node:fs";

const env = {};
for (const l of readFileSync("apps/web/.env.local", "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SECRET = env.SUPABASE_SERVICE_ROLE_KEY;

let failures = 0;
const ok = (m) => console.log(`  \x1b[32mPASS\x1b[0m ${m}`);
const bad = (m) => { console.log(`  \x1b[31mFAIL\x1b[0m ${m}`); failures++; };
const svc = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function guest() {
  const r = await fetch(`${BASE}/auth/v1/signup`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: "{}",
  });
  const b = await r.json();
  if (!b.access_token) throw new Error(`signup failed: ${JSON.stringify(b)}`);
  return { token: b.access_token, id: b.user.id };
}

function client(code) {
  const seen = [];
  const ws = new WebSocket(`ws://localhost:8787/rooms/${code}/ws?gameId=chess`);
  ws.addEventListener("message", (e) => seen.push(JSON.parse(e.data)));
  return {
    open: new Promise((res) => ws.addEventListener("open", res)),
    send: (m) => ws.send(JSON.stringify(m)),
    close: () => ws.close(),
    waitFor: (type, ms = 15000) => new Promise((res, rej) => {
      const t0 = Date.now();
      const iv = setInterval(() => {
        const hit = seen.find((m) => m.type === type);
        if (hit) { clearInterval(iv); res(hit); }
        else if (Date.now() - t0 > ms) {
          clearInterval(iv);
          rej(new Error(`timeout for ${type}; saw ${seen.map((m) => m.type).join(",")}`));
        }
      }, 40);
    }),
  };
}

const get = async (path) => (await fetch(`${BASE}/rest/v1/${path}`, { headers: svc })).json();

async function main() {
  console.log("\n\x1b[1mProgression check\x1b[0m\n");

  const [p1, p2] = await Promise.all([guest(), guest()]);
  ok(`two guests: ${p1.id.slice(0, 8)}, ${p2.id.slice(0, 8)}`);

  const gameId = (await get("games?slug=eq.chess&select=id"))[0]?.id;
  const code = `PG${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const roomRes = await fetch(`${BASE}/rest/v1/rooms`, {
    method: "POST",
    headers: { ...svc, Prefer: "return=representation" },
    body: JSON.stringify({
      code, name: "Progression check", host_id: p1.id, game_id: gameId,
      status: "waiting", is_private: false, max_players: 2, settings: {},
    }),
  });
  if (!roomRes.ok) throw new Error(`room insert failed: ${await roomRes.text()}`);
  ok(`room ${code} created`);

  const a = client(code); await a.open;
  a.send({ type: "AUTH", token: p1.token, isGuest: true });
  await a.waitFor("CONNECTED");
  const b = client(code); await b.open;
  b.send({ type: "AUTH", token: p2.token, isGuest: true });
  await b.waitFor("CONNECTED");

  a.send({ type: "READY", roomId: code });
  b.send({ type: "READY", roomId: code });
  a.send({ type: "START_GAME", roomId: code });
  const started = await a.waitFor("GAME_STARTED");

  // p1 resigns -> p1 loses, p2 wins.
  a.send({ type: "GAME_ACTION", roomId: code, sessionId: started.sessionId, actionType: "RESIGN", payload: {} });
  const finished = await a.waitFor("GAME_FINISHED");
  const winnerId = finished.result.winnerId;
  ok(`match finished, winner ${String(winnerId).slice(0, 8)}`);
  a.close(); b.close();

  await wait(2500); // progression runs after the broadcast

  const ratings = await get(`game_ratings?game_id=eq.${gameId}&user_id=in.(${p1.id},${p2.id})&select=user_id,rating,games_played,wins,losses`);
  ratings.length === 2 ? ok("both players have a per-game rating row") : bad(`expected 2 rating rows, got ${ratings.length}`);

  const winner = ratings.find((r) => r.user_id === winnerId);
  const loser = ratings.find((r) => r.user_id !== winnerId);

  if (!winner || !loser) { bad("could not identify winner/loser rows"); }
  else {
    winner.rating > 1200 ? ok(`winner gained rating: 1200 -> ${winner.rating}`) : bad(`winner did not gain (${winner.rating})`);
    loser.rating < 1200 ? ok(`loser lost rating: 1200 -> ${loser.rating}`) : bad(`loser did not lose (${loser.rating})`);
    const sum = (winner.rating - 1200) + (loser.rating - 1200);
    Math.abs(sum) <= 1 ? ok(`rating change is zero-sum (net ${sum})`) : bad(`not zero-sum: net ${sum}`);
    winner.wins === 1 && loser.losses === 1 ? ok("win/loss counters updated") : bad("counters wrong");
  }

  const history = await get(`rating_history?session_id=eq.${started.sessionId}&select=user_id,delta,outcome`);
  history.length === 2 ? ok("rating history recorded for both players") : bad(`expected 2 history rows, got ${history.length}`);

  const profiles = await get(`profiles?id=in.(${p1.id},${p2.id})&select=id,xp,level,total_games_played,current_streak`);
  profiles.every((p) => p.xp > 0) ? ok(`XP awarded to both (loser too, XP is not skill)`) : bad("XP not awarded to both");
  profiles.every((p) => p.total_games_played === 1) ? ok("games played incremented") : bad("games played wrong");

  const w = profiles.find((p) => p.id === winnerId);
  const l = profiles.find((p) => p.id !== winnerId);
  w?.current_streak === 1 && l?.current_streak === 0
    ? ok("streak set for winner, reset for loser")
    : bad(`streaks wrong: winner ${w?.current_streak}, loser ${l?.current_streak}`);

  console.log(failures === 0
    ? "\n\x1b[32mProgression works.\x1b[0m\n"
    : `\n\x1b[31m${failures} check(s) failed.\x1b[0m\n`);
}

main().then(
  () => process.exit(failures === 0 ? 0 : 1),
  (e) => { console.error(`\n\x1b[31mAborted:\x1b[0m ${e.message}\n`); process.exit(1); },
);
