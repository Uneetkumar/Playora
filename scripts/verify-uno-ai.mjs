#!/usr/bin/env node
/**
 * Online UNO against a server-side bot.
 *
 * The bot handler is written against the registry rather than against chess, so
 * registering UnoBot should be enough to make this work — "should be" is why
 * this script exists. Requires a Worker on :8787 and apps/web/.env.local.
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
        }, 50);
      }),
  };
}

async function runVariant(gameId) {
  console.log(`\n\x1b[1m${gameId} vs AI\x1b[0m`);
  const code = `AI${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const me = await guest();

  const c = client(code, gameId);
  await c.open;
  c.send({ type: "AUTH", token: me.token, isGuest: true });
  await c.waitFor((m) => m.type === "CONNECTED", "connected");

  c.send({ type: "ADD_BOT", roomId: code, level: 5 });
  const withBot = await c.waitFor(
    (m) => m.type === "ROOM_STATE" && Object.values(m.room?.players ?? {}).some((p) => p.isBot),
    "bot joined",
  );
  const bot = Object.values(withBot.room.players).find((p) => p.isBot);
  ok(`bot added to the room (${bot.displayName})`);

  c.send({ type: "READY", roomId: code });
  c.send({ type: "START_GAME", roomId: code });
  const started = await c.waitFor((m) => m.type === "GAME_STARTED", "GAME_STARTED");
  started.gameId === gameId ? ok(`started as ${gameId}`) : bad(`wrong game: ${started.gameId}`);

  await c.waitFor((m) => m.type === "GAME_STATE", "first state");
  let view = c.latest("GAME_STATE").state;
  view.myHand?.length === (gameId === "uno-no-mercy" ? 7 : 7)
    ? ok(`dealt ${view.myHand.length} cards`)
    : bad(`hand size ${view.myHand?.length}`);

  // Play until someone wins or we run out of patience. The point is that the
  // bot takes its turns without a human nudging it.
  let myMoves = 0;
  const deadline = Date.now() + 90_000;
  while (!view.isFinished && Date.now() < deadline && myMoves < 120) {
    if (!view.isMyTurn) {
      const before = c.seen.length;
      try {
        await c.waitFor((m, i) => i >= before && m.type === "GAME_STATE" && (m.state.isMyTurn || m.state.isFinished), "bot to move", 15000);
      } catch (e) {
        bad(`bot stopped taking turns: ${e.message}`);
        break;
      }
      view = c.latest("GAME_STATE").state;
      continue;
    }

    const playable = view.playableCardIds ?? [];
    if (view.pendingDraw > 0 || (playable.length === 0 && !view.hasDrawn)) {
      c.send({ type: "GAME_ACTION", roomId: code, sessionId: started.sessionId, actionType: "DRAW_CARD", payload: {} });
    } else if (playable.length === 0) {
      c.send({ type: "GAME_ACTION", roomId: code, sessionId: started.sessionId, actionType: "PASS", payload: {} });
    } else {
      const card = view.myHand.find((x) => x.id === playable[0]);
      c.send({
        type: "GAME_ACTION", roomId: code, sessionId: started.sessionId, actionType: "PLAY_CARD",
        payload: { cardId: card.id, ...(card.color === null ? { chosenColor: "red" } : {}), ...(view.myHand.length === 2 ? { declareUno: true } : {}) },
      });
    }
    myMoves += 1;
    const before = c.seen.length;
    await c.waitFor((m, i) => i >= before && m.type === "GAME_STATE", "state after my move", 15000);
    view = c.latest("GAME_STATE").state;
    const err = c.latest("ERROR");
    if (err && err.code !== "ILLEGAL_MOVE") { bad(`server error: ${err.message}`); break; }
  }

  view.isFinished
    ? ok(`game finished after ${myMoves} of my moves; winner ${view.winnerId === null ? "none" : view.winnerId ? "decided" : "?"}`)
    : bad(`game did not finish within the budget (my moves: ${myMoves})`);

  // The bot must never have revealed its hand.
  const anyHandLeak = c.seen.some(
    (m) => m.type === "GAME_STATE" && JSON.stringify(m.state).includes('"hands"'),
  );
  anyHandLeak ? bad("raw hands were broadcast to a client") : ok("no raw hand data ever sent to the client");

  c.ws.close();
}

async function main() {
  await runVariant("uno");
  await runVariant("uno-no-mercy");
  await new Promise((r) => setTimeout(r, 300));
  console.log(failures === 0
    ? "\n\x1b[32mUNO bots play online.\x1b[0m\n"
    : `\n\x1b[31m${failures} check(s) failed.\x1b[0m\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(`\n\x1b[31mAborted:\x1b[0m ${e.message}\n`); process.exit(1); });
