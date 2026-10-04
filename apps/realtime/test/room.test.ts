import { describe, it, expect, afterEach } from "vitest";
import { env, runInDurableObject } from "cloudflare:test";
import { TestClient, mintToken, readyUp, uuid } from "./helpers.js";

// Closing a socket kicks off disconnect handling inside the Durable Object
// (persist, alarm scheduling). Give that a tick to drain, or it races the
// environment teardown and surfaces as an unhandled RPC rejection.
afterEach(async () => {
  TestClient.closeAll();
  await new Promise((resolve) => setTimeout(resolve, 50));
});

let seq = 0;
const nextRoom = (label: string) => `room-${label}-${seq++}`;

const HOST = uuid(1);
const GUEST = uuid(2);

/** Seats two authenticated players and returns both clients. */
async function seatTwo(roomId: string, opts: { ready?: boolean } = {}) {
  const host = await TestClient.connect(roomId);
  await host.authenticate(await mintToken(HOST, { name: "Host" }));
  await host.waitFor("ROOM_STATE");

  const opponent = await TestClient.connect(roomId);
  await opponent.authenticate(await mintToken(GUEST, { name: "Opponent" }));
  await opponent.waitFor("ROOM_STATE");

  // The server will not deal until the guest has readied up.
  if (opts.ready) await readyUp(opponent, host, roomId, GUEST);

  return { host, opponent };
}

async function readStoredRoom(roomId: string) {
  const id = env.ROOM_DO.idFromName(roomId);
  const stub = env.ROOM_DO.get(id);
  return runInDurableObject(stub, async (_instance, state) => {
    return state.storage.get<Record<string, unknown>>("room");
  });
}

describe("RoomDurableObject: room lifecycle", () => {
  it("makes the first player host and seats the second as a player", async () => {
    const roomId = nextRoom("seating");
    const { host, opponent } = await seatTwo(roomId);

    const state = await opponent.waitFor("ROOM_STATE");
    expect(state.room.hostId).toBe(HOST);
    expect(state.room.players[HOST]?.role).toBe("host");
    expect(state.room.players[GUEST]?.role).toBe("player");
    expect(Object.keys(state.room.players)).toHaveLength(2);

    host.close();
    opponent.close();
  });

  it("tells existing players when someone joins", async () => {
    const roomId = nextRoom("joined");
    const { host, opponent } = await seatTwo(roomId);

    // The host also receives its own join broadcast, so match on the arrival.
    const joined = await host.waitWhere(
      (m) => m.type === "PLAYER_JOINED" && m.player.userId === GUEST,
    );
    expect(joined).toMatchObject({ type: "PLAYER_JOINED", player: { displayName: "Opponent" } });

    host.close();
    opponent.close();
  });

  it("refuses START_GAME from a player who is not the host", async () => {
    const roomId = nextRoom("nonhost");
    const { host, opponent } = await seatTwo(roomId);

    opponent.send({ type: "START_GAME", roomId });
    const error = await opponent.waitFor("ERROR");

    expect(error.code).toBe("FORBIDDEN");
    host.close();
    opponent.close();
  });

  it("refuses START_GAME below the engine's minimum player count", async () => {
    const roomId = nextRoom("solo");
    const host = await TestClient.connect(roomId);
    await host.authenticate(await mintToken(HOST));
    await host.waitFor("ROOM_STATE");

    host.send({ type: "START_GAME", roomId });

    expect((await host.waitFor("ERROR")).code).toBe("INVALID_PLAYER_COUNT");
    host.close();
  });

  it("starts the game for the host and broadcasts state to both players", async () => {
    const roomId = nextRoom("start");
    const { host, opponent } = await seatTwo(roomId, { ready: true });

    host.send({ type: "START_GAME", roomId });

    const started = await host.waitFor("GAME_STARTED");
    expect(started.gameId).toBe("chess");
    expect(started.players).toHaveLength(2);
    expect(started.sessionId).toBeTruthy();

    await expect(host.waitFor("GAME_STATE")).resolves.toBeDefined();
    await expect(opponent.waitFor("GAME_STATE")).resolves.toBeDefined();

    host.close();
    opponent.close();
  });

  it("refuses a second START_GAME while a game is running", async () => {
    const roomId = nextRoom("double-start");
    const { host, opponent } = await seatTwo(roomId, { ready: true });

    host.send({ type: "START_GAME", roomId });
    await host.waitFor("GAME_STARTED");
    host.send({ type: "START_GAME", roomId });

    expect((await host.waitFor("ERROR")).code).toBe("INVALID_STATE");
    host.close();
    opponent.close();
  });
});

describe("RoomDurableObject: durability", () => {
  // Guards the F2 regression: state used to live only in instance fields, so a
  // routine eviction destroyed the room and any match in progress.
  it("persists room and game state to Durable Object storage", async () => {
    const roomId = nextRoom("persist");
    const { host, opponent } = await seatTwo(roomId, { ready: true });

    host.send({ type: "START_GAME", roomId });
    await host.waitFor("GAME_STARTED");

    const stored = await readStoredRoom(roomId);

    expect(stored).toBeDefined();
    expect(stored?.["status"]).toBe("in_game");
    expect(stored?.["hostUserId"]).toBe(HOST);
    expect(stored?.["currentGameState"]).toBeTruthy();
    expect(Object.keys(stored?.["players"] as object)).toHaveLength(2);

    host.close();
    opponent.close();
  });

  it("serves the persisted room to a later connection", async () => {
    const roomId = nextRoom("rejoin");
    const { host, opponent } = await seatTwo(roomId, { ready: true });
    host.send({ type: "START_GAME", roomId });
    await host.waitFor("GAME_STARTED");

    // A fresh socket reads the room back out of durable state.
    const observer = await TestClient.connect(roomId);
    await observer.authenticate(await mintToken(uuid(3), { name: "Observer" }));
    const state = await observer.waitFor("ROOM_STATE");

    expect(state.room.status).toBe("in_game");
    expect(state.room.hostId).toBe(HOST);

    host.close();
    opponent.close();
    observer.close();
  });

  it("restores game state on RESYNC", async () => {
    const roomId = nextRoom("resync");
    const { host, opponent } = await seatTwo(roomId, { ready: true });
    host.send({ type: "START_GAME", roomId });
    await host.waitFor("GAME_STARTED");

    host.send({ type: "RESYNC", roomId });
    const resync = await host.waitFor("RESYNC_STATE");

    expect(resync.room.status).toBe("in_game");
    expect(resync.gameState).toBeTruthy();
    expect(resync.sequenceNumber).toBeGreaterThanOrEqual(1);

    host.close();
    opponent.close();
  });
});

describe("RoomDurableObject: abuse controls", () => {
  it("rate limits chat flooding", async () => {
    const roomId = nextRoom("chatflood");
    const host = await TestClient.connect(roomId);
    await host.authenticate(await mintToken(HOST));
    await host.waitFor("ROOM_STATE");

    for (let i = 0; i < 15; i++) {
      host.send({ type: "CHAT_SEND", roomId, message: `spam ${i}` });
    }

    const error = await host.waitFor("ERROR");
    expect(error.code).toBe("RATE_LIMITED");
    // The burst allowance is honoured before throttling kicks in.
    expect(host.messagesOfType("CHAT_MESSAGE").length).toBeLessThan(15);
    host.close();
  });

  it("rejects malformed messages without dropping the connection", async () => {
    const roomId = nextRoom("malformed");
    const host = await TestClient.connect(roomId);
    await host.authenticate(await mintToken(HOST));

    host.ws.send("this is not json");
    expect((await host.waitFor("ERROR")).code).toBe("BAD_REQUEST");

    // Still usable afterwards.
    host.send({ type: "RESYNC", roomId });
    await expect(host.waitFor("RESYNC_STATE")).resolves.toBeDefined();
    host.close();
  });

  it("does not let a spectator act in the game", async () => {
    const roomId = nextRoom("spectator");
    const { host, opponent } = await seatTwo(roomId, { ready: true });
    host.send({ type: "START_GAME", roomId });
    await host.waitFor("GAME_STARTED");

    const spectator = await TestClient.connect(roomId, "?spectator=true");
    await spectator.authenticate(await mintToken(uuid(4), { name: "Watcher" }));
    await spectator.waitFor("ROOM_STATE");

    spectator.send({
      type: "GAME_ACTION",
      roomId,
      sessionId: "irrelevant",
      actionType: "MOVE",
      payload: { from: "e2", to: "e4" },
    });

    expect((await spectator.waitFor("ERROR")).code).toBe("FORBIDDEN");
    host.close();
    opponent.close();
    spectator.close();
  });
});
