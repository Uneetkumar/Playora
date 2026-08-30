#!/usr/bin/env node
/**
 * The rematch handshake.
 *
 * A rematch is a mutual decision, so the thing worth proving is the negative:
 * one player's vote must NOT start a new game. Requires a Worker on :8787.
 */
import { readFileSync } from "node:fs";

const env = {};
for (const l of readFileSync("apps/web/.env.local", "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

let failures = 0;
const ok = (m) => console.log(`  \x1b[32mPASS\x1b[0m ${m}`);
const bad = (m) => { console.log(`  \x1b[31mFAIL\x1b[0m ${m}`); failures++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function guest() {
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: "{}",
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
    latest: (t) => [...seen].reverse().find((m) => m.type === t),
    count: (t) => seen.filter((m) => m.type === t).length,
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

async function main() {
  console.log("\n\x1b[1mRematch handshake\x1b[0m\n");
  const code = `RM${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const [p1, p2] = await Promise.all([guest(), guest()]);

  const a = client(code); await a.open;
  a.send({ type: "AUTH", token: p1.token, isGuest: true });
  await a.waitFor((m) => m.type === "CONNECTED", "P1 connected");
  const b = client(code); await b.open;
  b.send({ type: "AUTH", token: p2.token, isGuest: true });
  await b.waitFor((m) => m.type === "CONNECTED", "P2 connected");

  a.send({ type: "READY", roomId: code });
  b.send({ type: "READY", roomId: code });
  a.send({ type: "START_GAME", roomId: code });
  const first = await a.waitFor((m) => m.type === "GAME_STARTED", "first game");
  ok(`first game started (${first.sessionId.slice(0, 8)})`);

  // End it immediately; how it ends does not matter to a rematch.
  b.send({ type: "GAME_ACTION", roomId: code, sessionId: first.sessionId, actionType: "RESIGN", payload: {} });
  await a.waitFor((m) => m.type === "GAME_FINISHED", "game finished");
  ok("game finished by resignation");

  // One vote must not be enough.
  a.send({ type: "REMATCH", roomId: code, accept: true });
  const vote = await a.waitFor((m) => m.type === "REMATCH_STATE", "rematch state");
  vote.votes.length === 1 && vote.needed.length === 2
    ? ok(`one vote recorded, ${vote.needed.length} needed`)
    : bad(`vote state wrong: ${JSON.stringify(vote)}`);

  await wait(1200);
  a.count("GAME_STARTED") === 1
    ? ok("a single vote did not start a new game")
    : bad("a new game started on one player's vote alone");

  // Withdrawing works.
  a.send({ type: "REMATCH", roomId: code, accept: false });
  await a.waitFor((m) => m.type === "REMATCH_STATE" && m.votes.length === 0, "vote withdrawn");
  ok("a vote can be withdrawn");

  // Both agree: a new session starts, without anyone returning to a lobby.
  a.send({ type: "REMATCH", roomId: code, accept: true });
  b.send({ type: "REMATCH", roomId: code, accept: true });
  const second = await b.waitFor(
    (m) => m.type === "GAME_STARTED" && m.sessionId !== first.sessionId,
    "second game",
  );
  ok(`both agreed, new game started (${second.sessionId.slice(0, 8)})`);
  second.sessionId !== first.sessionId
    ? ok("the rematch is a distinct session, not a replay of the old one")
    : bad("rematch reused the finished session id");

  await b.waitFor((m) => m.type === "GAME_STATE" && m.sessionId === second.sessionId, "fresh board");
  const fresh = [...b.seen].reverse().find((m) => m.type === "GAME_STATE").state;
  (fresh.fen ?? "").startsWith("rnbqkbnr/pppppppp")
    ? ok("the board was dealt fresh")
    : bad(`board not reset: ${fresh.fen}`);

  a.ws.close(); b.ws.close();
  await wait(200);
  console.log(failures === 0
    ? "\n\x1b[32mRematch works.\x1b[0m\n"
    : `\n\x1b[31m${failures} check(s) failed.\x1b[0m\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(`\n\x1b[31mAborted:\x1b[0m ${e.message}\n`); process.exit(1); });
