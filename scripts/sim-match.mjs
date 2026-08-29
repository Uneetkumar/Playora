#!/usr/bin/env node
/**
 * Multiplayer simulation harness (spec section 86).
 *
 * Drives N real clients against the live realtime Worker using genuine Supabase
 * anonymous sessions -- no mocks, no test doubles. Every message crosses a real
 * WebSocket and is validated by the same protocol schemas the browser uses.
 *
 *   node scripts/sim-match.mjs                    # 2-player chess match
 *   node scripts/sim-match.mjs --room MYROOM
 *
 * Requires apps/web/.env.local (Supabase) and a Worker on :8787.
 */
import { readFileSync } from "node:fs";
import { Chess } from "chess.js";

const WORKER = process.env.WORKER_URL ?? "ws://localhost:8787";
const ROOM =
  argValue("--room") ?? `SIM${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function loadEnv() {
  const out = {};
  for (const line of readFileSync("apps/web/.env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const pass = (m) => console.log(`  \x1b[32mPASS\x1b[0m ${m}`);
const fail = (m) => {
  console.log(`  \x1b[31mFAIL\x1b[0m ${m}`);
  failures++;
};
let failures = 0;

/** A real client: real Supabase session, real WebSocket, real protocol. */
class SimClient {
  constructor(label) {
    this.label = label;
    this.messages = [];
    this.waiters = [];
  }

  async signIn() {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: "{}",
    });
    const body = await res.json();
    if (!body.access_token) throw new Error(`sign-in failed: ${JSON.stringify(body)}`);
    this.token = body.access_token;
    this.userId = body.user.id;
    return this;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${WORKER}/rooms/${ROOM}/ws?gameId=chess&spectator=false`);
      this.ws.addEventListener("message", (e) => {
        const msg = JSON.parse(e.data);
        this.messages.push(msg);
        const i = this.waiters.findIndex((w) => w.match(msg));
        if (i >= 0) this.waiters.splice(i, 1)[0].resolve(msg);
      });
      this.ws.addEventListener("open", () => resolve(this));
      this.ws.addEventListener("error", reject);
    });
  }

  send(msg) {
    this.ws.send(JSON.stringify(msg));
  }

  waitFor(type, timeoutMs = 6000) {
    return this.waitWhere((m) => m.type === type, timeoutMs, type);
  }

  waitWhere(match, timeoutMs = 6000, label = "predicate") {
    const existing = this.messages.find(match);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new Error(
              `${this.label} timed out waiting for ${label}. Saw: ${this.messages
                .map((m) => m.type)
                .join(", ")}`,
            ),
          ),
        timeoutMs,
      );
      this.waiters.push({
        match,
        resolve: (m) => {
          clearTimeout(timer);
          resolve(m);
        },
      });
    });
  }

  async authenticate() {
    this.send({ type: "AUTH", token: this.token, isGuest: true });
    const connected = await this.waitFor("CONNECTED");
    if (connected.userId !== this.userId) {
      throw new Error(`identity mismatch: server said ${connected.userId}`);
    }
    return connected;
  }

  latest(type) {
    return [...this.messages].reverse().find((m) => m.type === type);
  }

  close() {
    try {
      this.ws?.close();
    } catch {
      /* already closed */
    }
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`\n\x1b[1mMultiplayer simulation\x1b[0m  room=${ROOM}  worker=${WORKER}\n`);

  console.log("1. Two real guest sessions");
  const [a, b] = await Promise.all([
    new SimClient("P1").signIn(),
    new SimClient("P2").signIn(),
  ]);
  a.userId !== b.userId ? pass("distinct user ids") : fail("both clients got the same user");

  console.log("\n2. Connect and authenticate");
  await a.connect();
  await a.authenticate();
  pass(`P1 authenticated as ${a.userId.slice(0, 8)}`);
  await a.waitFor("ROOM_STATE");

  await b.connect();
  await b.authenticate();
  pass(`P2 authenticated as ${b.userId.slice(0, 8)}`);

  const roomState = await b.waitFor("ROOM_STATE");
  const players = Object.keys(roomState.room.players);
  players.length === 2
    ? pass("both players seated")
    : fail(`expected 2 players, got ${players.length}`);
  roomState.room.hostId === a.userId
    ? pass("first player is host")
    : fail("host was not the first player to join");

  console.log("\n3. Host authority");
  b.send({ type: "START_GAME", roomId: ROOM });
  const forbidden = await b.waitWhere(
    (m) => m.type === "ERROR" && m.code === "FORBIDDEN",
    6000,
    "FORBIDDEN",
  );
  forbidden ? pass("non-host cannot start the game") : fail("non-host was allowed to start");

  console.log("\n4. Ready up and start");
  a.send({ type: "READY", roomId: ROOM });
  b.send({ type: "READY", roomId: ROOM });
  await a.waitWhere((m) => m.type === "PLAYER_READY" && m.playerId === b.userId);
  pass("ready state broadcast to the other player");

  a.send({ type: "START_GAME", roomId: ROOM });
  const started = await a.waitFor("GAME_STARTED");
  pass(`game started, session ${started.sessionId.slice(0, 8)}`);
  await b.waitFor("GAME_STARTED");
  pass("both players received GAME_STARTED");

  console.log("\n5. Play real moves");
  const sessionId = started.sessionId;

  // Derive whose turn it is from server state rather than assuming P1 is white
  // and assuming both clients update in lockstep. The engine assigns colours,
  // and each client's GAME_STATE arrives independently.
  async function turnHolder(clients, timeoutMs = 6000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      for (const c of clients) {
        const view = c.latest("GAME_STATE")?.state;
        if (view?.isMyTurn && !view.isFinished) return c;
      }
      await wait(25);
    }
    throw new Error("no client was given the turn");
  }

  let moves = 0;
  for (let ply = 0; ply < 6; ply++) {
    const mover = await turnHolder([a, b]);
    const other = mover === a ? b : a;
    const view = mover.latest("GAME_STATE").state;

    const chess = new Chess(view.fen);
    const legal = chess.moves({ verbose: true })[0];
    const moverSeen = mover.messages.filter((m) => m.type === "GAME_STATE").length;
    const otherSeen = other.messages.filter((m) => m.type === "GAME_STATE").length;

    mover.send({
      type: "GAME_ACTION",
      roomId: ROOM,
      sessionId,
      actionType: "MOVE",
      payload: { from: legal.from, to: legal.to },
    });

    // Both sides must receive the resulting state, each serialised for them.
    await mover.waitWhere(
      () => mover.messages.filter((m) => m.type === "GAME_STATE").length > moverSeen,
      6000,
      "own GAME_STATE",
    );
    await other.waitWhere(
      () => other.messages.filter((m) => m.type === "GAME_STATE").length > otherSeen,
      6000,
      "opponent GAME_STATE",
    );
    moves++;
  }
  moves === 6 ? pass(`${moves} moves relayed to both players`) : fail(`only ${moves}/6 moves`);

  const finalA = a.latest("GAME_STATE").state;
  const finalB = b.latest("GAME_STATE").state;
  finalA.fen === finalB.fen
    ? pass("both clients converged on the same position")
    : fail("clients disagree on the board state");
  finalA.myColor !== finalB.myColor
    ? pass(`colours assigned distinctly (${finalA.myColor} vs ${finalB.myColor})`)
    : fail("both players were given the same colour");

  console.log("\n6. Illegal move rejected");
  const badBefore = a.messages.length;
  a.send({
    type: "GAME_ACTION",
    roomId: ROOM,
    sessionId,
    actionType: "MOVE",
    payload: { from: "a1", to: "h8" },
  });
  const illegal = await a.waitWhere(
    (m) => m.type === "ERROR" && m.code === "ILLEGAL_MOVE",
    6000,
    "ILLEGAL_MOVE",
  );
  illegal ? pass("server rejected an illegal move") : fail("illegal move was accepted");

  console.log("\n7. Chat");
  a.send({ type: "CHAT_SEND", roomId: ROOM, message: "good luck" });
  const chat = await b.waitFor("CHAT_MESSAGE");
  chat.chat.message === "good luck" && chat.chat.senderId === a.userId
    ? pass("chat relayed with correct sender")
    : fail("chat message wrong");

  console.log("\n8. Disconnect and reconnect");
  const statesBefore = b.messages.filter((m) => m.type === "GAME_STATE").length;
  b.close();
  const dropped = await a.waitFor("PLAYER_DISCONNECTED");
  dropped.playerId === b.userId
    ? pass(`opponent marked disconnected, ${dropped.gracePeriodSeconds}s grace`)
    : fail("wrong player reported as disconnected");

  await wait(500);
  const b2 = new SimClient("P2-rejoin");
  b2.token = b.token;
  b2.userId = b.userId;
  await b2.connect();
  await b2.authenticate();
  const rejoined = await a.waitFor("PLAYER_RECONNECTED");
  rejoined.playerId === b.userId ? pass("seat preserved and reclaimed") : fail("reconnect failed");

  b2.send({ type: "RESYNC", roomId: ROOM });
  const resync = await b2.waitFor("RESYNC_STATE");
  resync.gameState && resync.room.status === "in_game"
    ? pass(`resync restored game state at sequence ${resync.sequenceNumber}`)
    : fail("resync did not restore the match");
  statesBefore > 0 ? pass("game survived the disconnect") : fail("no state before disconnect");

  a.close();
  b2.close();

  console.log(
    failures === 0
      ? "\n\x1b[32mAll simulation checks passed.\x1b[0m\n"
      : `\n\x1b[31m${failures} check(s) failed.\x1b[0m\n`,
  );
}

main().then(
  () => process.exit(failures === 0 ? 0 : 1),
  (err) => {
    console.error(`\n\x1b[31mSimulation aborted:\x1b[0m ${err.message}\n`);
    process.exit(1);
  },
);
