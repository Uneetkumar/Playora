#!/usr/bin/env node
/**
 * End-to-end check that a finished match reaches Postgres.
 *
 * Creates a real room row, plays a real match on the live Worker, resigns, then
 * confirms game_sessions and game_results rows exist. Requires a Worker on
 * :8787 and apps/web/.env.local.
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
const WORKER = "ws://localhost:8787";

const ok = (m) => console.log(`  \x1b[32mPASS\x1b[0m ${m}`);
let failures = 0;
const bad = (m) => {
  console.log(`  \x1b[31mFAIL\x1b[0m ${m}`);
  failures++;
};

const svc = (extra = {}) => ({
  apikey: SECRET,
  Authorization: `Bearer ${SECRET}`,
  "Content-Type": "application/json",
  ...extra,
});

async function guest() {
  const r = await fetch(`${BASE}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: "{}",
  });
  const b = await r.json();
  if (!b.access_token) throw new Error(`signup failed: ${JSON.stringify(b)}`);
  return { token: b.access_token, id: b.user.id };
}

function client(code) {
  const seen = [];
  const ws = new WebSocket(`${WORKER}/rooms/${code}/ws?gameId=chess`);
  ws.addEventListener("message", (e) => seen.push(JSON.parse(e.data)));
  const waitFor = (pred, ms = 12000) =>
    new Promise((res, rej) => {
      const t0 = Date.now();
      const iv = setInterval(() => {
        const hit = seen.find(pred);
        if (hit) {
          clearInterval(iv);
          res(hit);
        } else if (Date.now() - t0 > ms) {
          clearInterval(iv);
          rej(new Error(`timeout; saw ${seen.map((m) => m.type).join(",")}`));
        }
      }, 40);
    });
  const open = new Promise((res) => ws.addEventListener("open", res));
  return {
    ws,
    seen,
    waitFor,
    open,
    send: (m) => ws.send(JSON.stringify(m)),
    close: () => ws.close(),
  };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("\n\x1b[1mResult persistence check\x1b[0m\n");

  const [p1, p2] = await Promise.all([guest(), guest()]);
  ok(`two guests: ${p1.id.slice(0, 8)}, ${p2.id.slice(0, 8)}`);

  // Look up the chess game row, then create a room the way the API does.
  const gameRes = await fetch(`${BASE}/rest/v1/games?slug=eq.chess&select=id`, { headers: svc() });
  const gameId = (await gameRes.json())[0]?.id;
  if (!gameId) throw new Error("chess row missing from games catalog");

  const code = `PR${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const roomRes = await fetch(`${BASE}/rest/v1/rooms`, {
    method: "POST",
    headers: svc({ Prefer: "return=representation" }),
    body: JSON.stringify({
      code,
      name: "Persistence check",
      host_id: p1.id,
      game_id: gameId,
      status: "waiting",
      is_private: false,
      max_players: 2,
      settings: {},
    }),
  });
  if (!roomRes.ok) throw new Error(`room insert failed: ${await roomRes.text()}`);
  const roomRow = (await roomRes.json())[0];
  ok(`room ${code} persisted (${roomRow.id.slice(0, 8)})`);

  const a = client(code);
  await a.open;
  a.send({ type: "AUTH", token: p1.token, isGuest: true });
  await a.waitFor((m) => m.type === "CONNECTED");

  const b = client(code);
  await b.open;
  b.send({ type: "AUTH", token: p2.token, isGuest: true });
  await b.waitFor((m) => m.type === "CONNECTED");
  ok("both players connected");

  a.send({ type: "READY", roomId: code });
  b.send({ type: "READY", roomId: code });
  a.send({ type: "START_GAME", roomId: code });
  const started = await a.waitFor((m) => m.type === "GAME_STARTED");
  ok(`match started, session ${started.sessionId.slice(0, 8)}`);

  // Resignation is the quickest deterministic finish.
  a.send({ type: "GAME_ACTION", roomId: code, sessionId: started.sessionId, actionType: "RESIGN", payload: {} });
  const finished = await a.waitFor((m) => m.type === "GAME_FINISHED");
  ok(`match finished, reason "${finished.result.reason}", winner ${String(finished.result.winnerId).slice(0, 8)}`);

  a.close();
  b.close();

  // The write happens after the broadcast, so give it a moment.
  await wait(1500);

  const sess = await (
    await fetch(`${BASE}/rest/v1/game_sessions?id=eq.${started.sessionId}&select=id,status,room_id`, {
      headers: svc(),
    })
  ).json();
  sess[0]?.status === "completed"
    ? ok("game_sessions row written")
    : bad(`game_sessions missing (got ${JSON.stringify(sess)})`);

  const results = await (
    await fetch(
      `${BASE}/rest/v1/game_results?session_id=eq.${started.sessionId}&select=winner_id,duration_seconds,finish_reason,scores`,
      { headers: svc() },
    )
  ).json();
  const row = results[0];
  if (!row) {
    bad("game_results row missing");
  } else {
    ok(`game_results written: reason=${row.finish_reason}, winner=${String(row.winner_id).slice(0, 8)}`);
    row.finish_reason === finished.result.reason
      ? ok("finish reason matches the broadcast")
      : bad(`reason mismatch: ${row.finish_reason} vs ${finished.result.reason}`);
    Array.isArray(row.scores) && row.scores.length === 2
      ? ok("both players recorded in scores")
      : bad(`scores wrong: ${JSON.stringify(row.scores)}`);
  }

  console.log(
    failures === 0
      ? "\n\x1b[32mResults are being persisted.\x1b[0m\n"
      : `\n\x1b[31m${failures} check(s) failed.\x1b[0m\n`,
  );
}

main().then(
  () => process.exit(failures === 0 ? 0 : 1),
  (e) => {
    console.error(`\n\x1b[31mAborted:\x1b[0m ${e.message}\n`);
    process.exit(1);
  },
);
