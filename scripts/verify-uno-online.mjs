#!/usr/bin/env node
/**
 * Online UNO through a real room.
 *
 * Only local pass-and-play had been exercised. This drives two real guest
 * sessions through the Worker: deal, hidden hands, a legal play, an illegal
 * play, and a draw. Requires a Worker on :8787 and apps/web/.env.local.
 */
import { readFileSync } from "node:fs";

const env = {};
for (const l of readFileSync("apps/web/.env.local", "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let failures = 0;
const ok = (m) => console.log(`  \x1b[32mPASS\x1b[0m ${m}`);
const bad = (m) => { console.log(`  \x1b[31mFAIL\x1b[0m ${m}`); failures++; };

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
  const ws = new WebSocket(`ws://localhost:8787/rooms/${code}/ws?gameId=uno`);
  ws.addEventListener("message", (e) => seen.push(JSON.parse(e.data)));
  return {
    seen, ws,
    open: new Promise((res) => ws.addEventListener("open", res)),
    send: (m) => ws.send(JSON.stringify(m)),
    latest: (t) => [...seen].reverse().find((m) => m.type === t),
    waitFor: (pred, label, ms = 12000) =>
      new Promise((res, rej) => {
        const t0 = Date.now();
        const iv = setInterval(() => {
          const hit = seen.find(pred);
          if (hit) { clearInterval(iv); res(hit); }
          else if (Date.now() - t0 > ms) {
            clearInterval(iv);
            rej(new Error(`timeout: ${label}; saw ${seen.map((m) => m.type).join(",")}`));
          }
        }, 40);
      }),
  };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("\n\x1b[1mOnline UNO check\x1b[0m\n");
  const code = `UO${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const [p1, p2] = await Promise.all([guest(), guest()]);
  ok(`two guests: ${p1.id.slice(0, 8)}, ${p2.id.slice(0, 8)}`);

  const a = client(code); await a.open;
  a.send({ type: "AUTH", token: p1.token, isGuest: true });
  await a.waitFor((m) => m.type === "CONNECTED", "P1 connected");
  const b = client(code); await b.open;
  b.send({ type: "AUTH", token: p2.token, isGuest: true });
  await b.waitFor((m) => m.type === "CONNECTED", "P2 connected");
  ok("both authenticated into an UNO room");

  a.send({ type: "READY", roomId: code });
  b.send({ type: "READY", roomId: code });
  a.send({ type: "START_GAME", roomId: code });
  const started = await a.waitFor((m) => m.type === "GAME_STARTED", "GAME_STARTED");
  started.gameId === "uno" ? ok("room started as UNO, not chess") : bad(`wrong game: ${started.gameId}`);

  await a.waitFor((m) => m.type === "GAME_STATE", "P1 state");
  await b.waitFor((m) => m.type === "GAME_STATE", "P2 state");

  const viewA = a.latest("GAME_STATE").state;
  const viewB = b.latest("GAME_STATE").state;

  viewA.myHand?.length === 7 && viewB.myHand?.length === 7
    ? ok("both dealt 7 cards")
    : bad(`hands wrong: ${viewA.myHand?.length}/${viewB.myHand?.length}`);

  viewA.drawPileCount === 108 - 15
    ? ok(`draw pile is ${viewA.drawPileCount} (108 - 14 dealt - 1 discard)`)
    : bad(`draw pile ${viewA.drawPileCount}, expected 93`);

  // The critical one: an opponent's cards must never reach the other client.
  // Card ids are short ("c1", "c15"), so a substring scan gives false hits.
  // Walk the payload and compare whole string values instead.
  const collectStrings = (node, into = new Set()) => {
    if (typeof node === "string") into.add(node);
    else if (Array.isArray(node)) node.forEach((n) => collectStrings(n, into));
    else if (node && typeof node === "object") {
      Object.values(node).forEach((n) => collectStrings(n, into));
    }
    return into;
  };
  const aIds = new Set(viewA.myHand.map((c) => c.id));
  const stringsInB = collectStrings(viewB);
  const leaked = [...aIds].filter((id) => stringsInB.has(id));
  leaked.length === 0
    ? ok("none of P1's card ids appear anywhere in P2's payload")
    : bad(`opponent card ids leaked across clients: ${leaked.join(", ")}`);

  viewA.opponents?.[0]?.cardCount === 7
    ? ok("opponent exposed as a count only")
    : bad(`opponent view wrong: ${JSON.stringify(viewA.opponents)}`);

  // Whoever holds the turn plays a legal card.
  const mover = viewA.isMyTurn ? a : b;
  const moverView = viewA.isMyTurn ? viewA : viewB;
  const playable = moverView.playableCardIds ?? [];

  if (playable.length === 0) {
    // A legal position with nothing playable: drawing is the correct move.
    mover.send({ type: "GAME_ACTION", roomId: code, sessionId: started.sessionId, actionType: "DRAW_CARD", payload: {} });
    await mover.waitFor(
      (m) => m.type === "GAME_STATE" && m.state?.myHand?.length === 8,
      "draw applied",
    );
    ok("draw handled when no card is playable");
  } else {
    const card = moverView.myHand.find((c) => c.id === playable[0]);
    const payload = { cardId: card.id, ...(card.color === null ? { chosenColor: "red" } : {}) };
    mover.send({ type: "GAME_ACTION", roomId: code, sessionId: started.sessionId, actionType: "PLAY_CARD", payload });
    await mover.waitFor(
      (m) => m.type === "GAME_STATE" && m.state?.myHand?.length === 6,
      "card played",
    );
    ok(`played ${card.color ?? "wild"} ${card.value} through the server`);

    const other = mover === a ? b : a;
    await other.waitFor(
      (m) => m.type === "GAME_STATE" && m.state?.opponents?.[0]?.cardCount === 6,
      "opponent saw the count drop",
    );
    ok("opponent's client saw the card count drop");
  }

  // An illegal action must be refused by the server, not the UI.
  const idle = viewA.isMyTurn ? b : a;
  idle.send({
    type: "GAME_ACTION", roomId: code, sessionId: started.sessionId,
    actionType: "PLAY_CARD", payload: { cardId: "does-not-exist" },
  });
  const err = await idle.waitFor((m) => m.type === "ERROR", "illegal play rejected");
  err ? ok(`illegal play rejected server-side (${err.code})`) : bad("illegal play accepted");

  a.ws.close(); b.ws.close();
  await wait(300);

  console.log(failures === 0
    ? "\n\x1b[32mOnline UNO works.\x1b[0m\n"
    : `\n\x1b[31m${failures} check(s) failed.\x1b[0m\n`);
}

main().then(
  () => process.exit(failures === 0 ? 0 : 1),
  (e) => { console.error(`\n\x1b[31mAborted:\x1b[0m ${e.message}\n`); process.exit(1); },
);
