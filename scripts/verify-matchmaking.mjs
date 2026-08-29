#!/usr/bin/env node
/**
 * Quick Match end-to-end check.
 *
 * Queues two real guest sessions and verifies they are paired into the same
 * persisted room. Requires a Worker on :8787 and apps/web/.env.local.
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

function queueClient(label) {
  const seen = [];
  const ws = new WebSocket("ws://localhost:8787/matchmaking/chess");
  ws.addEventListener("message", (e) => seen.push(JSON.parse(e.data)));
  return {
    label,
    seen,
    open: new Promise((res) => ws.addEventListener("open", res)),
    send: (m) => ws.send(JSON.stringify(m)),
    close: () => ws.close(),
    waitFor: (type, ms = 20000) =>
      new Promise((res, rej) => {
        const t0 = Date.now();
        const iv = setInterval(() => {
          const hit = seen.find((m) => m.type === type);
          if (hit) { clearInterval(iv); res(hit); }
          else if (Date.now() - t0 > ms) {
            clearInterval(iv);
            rej(new Error(`${label} timed out for ${type}; saw ${seen.map((m) => m.type).join(",")}`));
          }
        }, 50);
      }),
  };
}

async function main() {
  console.log("\n\x1b[1mQuick Match check\x1b[0m\n");

  const [g1, g2] = await Promise.all([guest(), guest()]);
  ok(`two guests: ${g1.id.slice(0, 8)}, ${g2.id.slice(0, 8)}`);

  const a = queueClient("P1");
  const b = queueClient("P2");
  await Promise.all([a.open, b.open]);

  a.send({ type: "QUEUE_JOIN", token: g1.token, gameId: "chess", mode: "casual" });
  await a.waitFor("QUEUED");
  ok("first player queued");

  // A lone player must not be matched with themselves.
  const soloMatch = a.seen.find((m) => m.type === "MATCH_FOUND");
  soloMatch ? bad("matched with nobody present") : ok("no match while alone in the queue");

  b.send({ type: "QUEUE_JOIN", token: g2.token, gameId: "chess", mode: "casual" });
  await b.waitFor("QUEUED");
  ok("second player queued");

  const [m1, m2] = await Promise.all([a.waitFor("MATCH_FOUND"), b.waitFor("MATCH_FOUND")]);
  ok(`both players matched into room ${m1.roomCode}`);

  m1.roomCode === m2.roomCode
    ? ok("both received the same room code")
    : bad(`different rooms: ${m1.roomCode} vs ${m2.roomCode}`);

  m1.opponents[0]?.userId === g2.id && m2.opponents[0]?.userId === g1.id
    ? ok("each player sees the other as opponent")
    : bad("opponent lists are wrong");

  // The room must exist in Postgres, or the match could never be recorded.
  const rooms = await (
    await fetch(`${BASE}/rest/v1/rooms?code=eq.${m1.roomCode}&select=id,is_private,status,max_players`, {
      headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` },
    })
  ).json();
  const room = rooms[0];
  room ? ok("matched room is persisted in Postgres") : bad("matched room not found in Postgres");
  room?.is_private === true
    ? ok("matched room is private (not publicly listed)")
    : bad("matched room was listed publicly");

  a.close();
  b.close();

  console.log(
    failures === 0
      ? "\n\x1b[32mQuick Match works.\x1b[0m\n"
      : `\n\x1b[31m${failures} check(s) failed.\x1b[0m\n`,
  );
}

main().then(
  () => process.exit(failures === 0 ? 0 : 1),
  (e) => { console.error(`\n\x1b[31mAborted:\x1b[0m ${e.message}\n`); process.exit(1); },
);
