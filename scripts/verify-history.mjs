#!/usr/bin/env node
/**
 * Match history, end to end.
 *
 * Plays a real match, then asks PostgREST for it exactly the way the browser
 * does — the containment filter on `scores` is the part worth proving, since
 * a wrong filter returns an empty list rather than an error.
 */
import { readFileSync } from "node:fs";

const env = {};
for (const l of readFileSync("apps/web/.env.local", "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Results are only written for rooms that exist in Postgres, so the room row
// has to be created first — exactly as POST /api/rooms does for a real player.
const devVars = {};
for (const l of readFileSync("apps/realtime/.dev.vars", "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) devVars[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const SERVICE = devVars.SUPABASE_SERVICE_ROLE_KEY;
const svc = (extra = {}) => ({
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  "Content-Type": "application/json",
  ...extra,
});

async function createRoom(code, hostId) {
  const gameRes = await fetch(`${BASE}/rest/v1/games?slug=eq.chess&select=id`, { headers: svc() });
  const gameId = (await gameRes.json())[0]?.id;
  if (!gameId) throw new Error("chess row missing from games catalog");

  const res = await fetch(`${BASE}/rest/v1/rooms`, {
    method: "POST",
    headers: svc({ Prefer: "return=representation" }),
    body: JSON.stringify({
      code,
      name: "History check",
      host_id: hostId,
      game_id: gameId,
      status: "waiting",
      is_private: false,
      max_players: 2,
      settings: {},
    }),
  });
  if (!res.ok) throw new Error(`room insert failed: ${await res.text()}`);
}

let failures = 0;
const ok = (m) => console.log(`  \x1b[32mPASS\x1b[0m ${m}`);
const bad = (m) => { console.log(`  \x1b[31mFAIL\x1b[0m ${m}`); failures++; };
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
    seen, ws,
    open: new Promise((res) => ws.addEventListener("open", res)),
    send: (m) => ws.send(JSON.stringify(m)),
    waitFor: (pred, label, ms = 15000) =>
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

/** The exact request the browser hook makes. */
async function history(token, userId, gameSlug = null) {
  const contains = encodeURIComponent(JSON.stringify([{ userId }]));
  const select = "session_id,room_id,winner_id,duration_seconds,finish_reason,created_at,scores,games!inner(slug,name)";
  let url =
    `${BASE}/rest/v1/game_results?select=${select}&scores=cs.${contains}` +
    `&order=created_at.desc&limit=21`;
  if (gameSlug) url += `&games.slug=eq.${gameSlug}`;

  const res = await fetch(url, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`history query ${res.status}: ${body}`);
  return JSON.parse(body);
}

async function main() {
  console.log("\n\x1b[1mMatch history\x1b[0m\n");
  const [p1, p2] = await Promise.all([guest(), guest()]);
  const code = `HS${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  await createRoom(code, p1.id);
  const before = await history(p1.token, p1.id);
  before.length === 0 ? ok("a new player has an empty history") : bad(`unexpected rows: ${before.length}`);

  const a = client(code); await a.open;
  a.send({ type: "AUTH", token: p1.token, isGuest: true });
  await a.waitFor((m) => m.type === "CONNECTED", "P1 connected");
  const b = client(code); await b.open;
  b.send({ type: "AUTH", token: p2.token, isGuest: true });
  await b.waitFor((m) => m.type === "CONNECTED", "P2 connected");

  a.send({ type: "READY", roomId: code });
  b.send({ type: "READY", roomId: code });
  a.send({ type: "START_GAME", roomId: code });
  const started = await a.waitFor((m) => m.type === "GAME_STARTED", "game started");

  b.send({ type: "GAME_ACTION", roomId: code, sessionId: started.sessionId, actionType: "RESIGN", payload: {} });
  await a.waitFor((m) => m.type === "GAME_FINISHED", "game finished");
  ok("played and finished a rated match");

  // The write is deliberately off the broadcast path, so give it a moment.
  let rows = [];
  for (let i = 0; i < 12 && rows.length === 0; i++) {
    await wait(700);
    rows = await history(p1.token, p1.id);
  }

  rows.length === 1
    ? ok("the containment filter returned exactly this player's match")
    : bad(`expected 1 row, got ${rows.length}`);

  if (rows[0]) {
    rows[0].session_id === started.sessionId
      ? ok("it is the session that was just played")
      : bad(`session mismatch: ${rows[0].session_id} vs ${started.sessionId}`);
    rows[0].games?.slug === "chess"
      ? ok(`the game joined through: ${rows[0].games.name}`)
      : bad(`game join failed: ${JSON.stringify(rows[0].games)}`);
    rows[0].winner_id === p1.id
      ? ok("the winner is recorded correctly")
      : bad(`winner ${rows[0].winner_id}, expected ${p1.id}`);
    Array.isArray(rows[0].scores) && rows[0].scores.length === 2
      ? ok("both participants are on the result")
      : bad(`scores wrong: ${JSON.stringify(rows[0].scores)}`);
  }

  // The loser's history must show the same match.
  const theirs = await history(p2.token, p2.id);
  theirs.length === 1 && theirs[0].session_id === started.sessionId
    ? ok("the same match appears in the opponent's history")
    : bad(`opponent history wrong: ${theirs.length} rows`);

  // Filtering by a game they did not play must return nothing, not everything.
  const filtered = await history(p1.token, p1.id, "uno");
  filtered.length === 0
    ? ok("filtering by another game returns nothing")
    : bad(`game filter leaked ${filtered.length} rows`);

  const stillChess = await history(p1.token, p1.id, "chess");
  stillChess.length === 1
    ? ok("filtering by the right game still returns it")
    : bad(`chess filter returned ${stillChess.length}`);

  // Rating movement for the detail page.
  const ratingRes = await fetch(
    `${BASE}/rest/v1/rating_history?select=session_id,delta,rating_after&user_id=eq.${p1.id}&session_id=eq.${started.sessionId}`,
    { headers: { apikey: ANON, Authorization: `Bearer ${p1.token}` } },
  );
  const rating = await ratingRes.json();
  rating.length === 1 && rating[0].delta > 0
    ? ok(`rating history recorded (+${rating[0].delta} → ${rating[0].rating_after})`)
    : bad(`rating history wrong: ${JSON.stringify(rating)}`);

  a.ws.close(); b.ws.close();
  await wait(200);
  console.log(failures === 0
    ? "\n\x1b[32mMatch history works.\x1b[0m\n"
    : `\n\x1b[31m${failures} check(s) failed.\x1b[0m\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(`\n\x1b[31mAborted:\x1b[0m ${e.message}\n`); process.exit(1); });
