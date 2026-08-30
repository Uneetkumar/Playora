#!/usr/bin/env node
/**
 * Online racing.
 *
 * The claim under test is server authority in a real-time game: the server owns
 * the clock, a client can only express intent, and a client that asks to
 * advance time or claims a position is refused. Requires a Worker on :8787.
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

function client(code, gameId) {
  const seen = [];
  const ws = new WebSocket(`ws://localhost:8787/rooms/${code}/ws?gameId=${gameId}`);
  ws.addEventListener("message", (e) => seen.push(JSON.parse(e.data)));
  return {
    seen, ws,
    open: new Promise((res) => ws.addEventListener("open", res)),
    send: (m) => ws.send(JSON.stringify(m)),
    latest: (t) => [...seen].reverse().find((m) => m.type === t),
    count: (t) => seen.filter((m) => m.type === t).length,
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

async function runVariant(gameId) {
  console.log(`\n\x1b[1m${gameId} online\x1b[0m`);
  const code = `RC${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const me = await guest();

  const c = client(code, gameId);
  await c.open;
  c.send({ type: "AUTH", token: me.token, isGuest: true });
  await c.waitFor((m) => m.type === "CONNECTED", "connected");

  c.send({ type: "ADD_BOT", roomId: code, level: 5 });
  await c.waitFor(
    (m) => m.type === "ROOM_STATE" && Object.values(m.room?.players ?? {}).some((p) => p.isBot),
    "bot joined",
  );
  ok("an AI driver joined the grid");

  c.send({ type: "READY", roomId: code });
  c.send({ type: "START_GAME", roomId: code });
  const started = await c.waitFor((m) => m.type === "GAME_STARTED", "GAME_STARTED");
  started.gameId === gameId ? ok(`started as ${gameId}`) : bad(`wrong game: ${started.gameId}`);

  const first = await c.waitFor((m) => m.type === "GAME_STATE", "first snapshot");
  const bytes = JSON.stringify(first).length;
  first.state?.trackSeed !== undefined && first.state?.trackLength > 0
    ? ok(`the track arrived as a seed (${first.state.trackLength}m), snapshot is ${bytes} bytes`)
    : bad(`no track seed in the snapshot: ${JSON.stringify(Object.keys(first.state ?? {}))}`);
  first.state?.track === undefined
    ? ok("no track geometry is sent over the wire")
    : bad("the whole track is being sent in every snapshot");
  bytes < 3000
    ? ok(`a snapshot is ${bytes} bytes`)
    : bad(`a snapshot is ${bytes} bytes, which is too much to send five times a second`);

  // A client must not be able to advance the clock.
  c.send({
    type: "GAME_ACTION", roomId: code, sessionId: started.sessionId,
    actionType: "TICK", payload: { ticks: 100000 },
  });
  const refused = await c.waitFor((m) => m.type === "ERROR", "TICK refused", 8000);
  refused ? ok(`a client cannot advance the race clock (${refused.code})`) : bad("TICK was accepted");

  // The server's own clock must be running regardless.
  const before = c.count("GAME_STATE");
  await wait(2500);
  const after = c.count("GAME_STATE");
  const rate = (after - before) / 2.5;
  rate > 4
    ? ok(`the server is broadcasting at about ${rate.toFixed(0)} snapshots a second`)
    : bad(`only ${rate.toFixed(1)} snapshots a second; is the loop running?`);

  // The countdown must have advanced on its own, with no input at all.
  const nowState = c.latest("GAME_STATE").state;
  nowState.tick > 0
    ? ok(`the race advanced to tick ${nowState.tick} without any client input`)
    : bad("the race did not advance");

  // Drive, and check the server moves the car.
  const startedAt = c.latest("GAME_STATE").state.me?.distance ?? 0;
  for (let i = 0; i < 60; i++) {
    c.send({
      type: "GAME_ACTION", roomId: code, sessionId: started.sessionId,
      actionType: "SET_INPUT", payload: { throttle: true, steer: 0, seq: i },
    });
    await wait(50);
  }
  const movedTo = c.latest("GAME_STATE").state.me?.distance ?? 0;
  movedTo > startedAt + 20
    ? ok(`throttle moved the car ${Math.round(movedTo - startedAt)}m down the road`)
    : bad(`the car barely moved: ${startedAt} -> ${movedTo}`);

  // A client cannot teleport: the fields simply do not exist on the action.
  c.send({
    type: "GAME_ACTION", roomId: code, sessionId: started.sessionId,
    actionType: "SET_INPUT",
    payload: { distance: 999999, speed: 999, lateral: 0, throttle: true, seq: 999 },
  });
  await wait(400);
  const afterCheat = c.latest("GAME_STATE").state.me?.distance ?? 0;
  afterCheat < movedTo + 200
    ? ok("a client claiming a position is ignored")
    : bad(`a client teleported to ${afterCheat}`);

  // The AI must be driving too.
  const bot = c.latest("GAME_STATE").state.vehicles.find((v) => v.playerId.startsWith("bot-"));
  bot && bot.distance > 10
    ? ok(`the AI driver is racing (${Math.round(bot.distance)}m)`)
    : bad(`the AI has not moved: ${JSON.stringify(bot)}`);

  c.ws.close();
  await wait(300);
}

async function main() {
  await runVariant("car-race");
  await runVariant("bike-race");
  console.log(failures === 0
    ? "\n\x1b[32mOnline racing is server-authoritative.\x1b[0m\n"
    : `\n\x1b[31m${failures} check(s) failed.\x1b[0m\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(`\n\x1b[31mAborted:\x1b[0m ${e.message}\n`); process.exit(1); });
