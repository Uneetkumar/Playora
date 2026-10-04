import { describe, it, expect, afterEach } from "vitest";
import { SELF } from "cloudflare:test";
import type { ServerMessage } from "@playora/protocol";
import { TestClient, mintToken, readyUp, uuid } from "./helpers.js";
import { createRoom } from "../src/durable-objects/room-state.js";
import { engineConfigFor, resetReadiness } from "../src/handlers/lobby-handler.js";

// Closing a socket kicks off disconnect handling inside the Durable Object
// (persist, alarm scheduling). Give that a tick to drain, or it races the
// environment teardown and surfaces as an unhandled RPC rejection.
afterEach(async () => {
  TestClient.closeAll();
  await new Promise((resolve) => setTimeout(resolve, 50));
});

let seq = 0;
const nextRoom = (label: string) => `lobby-${label}-${seq++}`;

const HOST = uuid(1);
const GUEST = uuid(2);
const THIRD = uuid(3);

async function join(roomId: string, userId: string, name: string, query = "") {
  const client = await TestClient.connect(roomId, query);
  await client.authenticate(await mintToken(userId, { name }));
  await client.waitFor("ROOM_STATE");
  return client;
}

async function seatTwo(roomId: string, query = "") {
  const host = await join(roomId, HOST, "Host", query);
  const guest = await join(roomId, GUEST, "Guest", query);
  return { host, guest };
}

const isError = (code: string) => (m: ServerMessage) => m.type === "ERROR" && m.code === code;

/** The latest ROOM_STATE a client holds that satisfies `predicate`. */
async function roomStateWhere(
  client: TestClient,
  predicate: (room: Extract<ServerMessage, { type: "ROOM_STATE" }>["room"]) => boolean,
) {
  const msg = await client.waitWhere((m) => m.type === "ROOM_STATE" && predicate(m.room));
  if (msg.type !== "ROOM_STATE") throw new Error("unreachable");
  return msg.room;
}

async function waitUntil(check: () => boolean, timeoutMs = 2000): Promise<void> {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeoutMs) throw new Error("Timed out waiting for condition");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

describe("ready check", () => {
  it("refuses START_GAME until every seated human has readied up", async () => {
    const roomId = nextRoom("gate");
    const { host, guest } = await seatTwo(roomId);

    host.send({ type: "START_GAME", roomId });
    const refused = await host.waitWhere(isError("PLAYERS_NOT_READY"));
    expect(refused).toMatchObject({ details: { waitingOn: [GUEST] } });
    expect(host.messagesOfType("GAME_STARTED")).toHaveLength(0);

    await readyUp(guest, host, roomId, GUEST);
    host.send({ type: "START_GAME", roomId });
    await expect(host.waitFor("GAME_STARTED")).resolves.toBeDefined();
  });

  it("does not wait on the host, who readies by pressing Start", async () => {
    const roomId = nextRoom("host");
    const { host, guest } = await seatTwo(roomId);

    // Only the guest readies; the host never sends SET_READY.
    await readyUp(guest, host, roomId, GUEST);
    host.send({ type: "START_GAME", roomId });
    await expect(host.waitFor("GAME_STARTED")).resolves.toBeDefined();
  });

  it("counts a bot as ready", async () => {
    const roomId = nextRoom("bot");
    const host = await join(roomId, HOST, "Host");

    host.send({ type: "ADD_BOT", roomId, level: 1 });
    await host.waitWhere((m) => m.type === "PLAYER_JOINED" && m.player.isBot === true);
    host.send({ type: "START_GAME", roomId });

    await expect(host.waitFor("GAME_STARTED")).resolves.toBeDefined();
  });

  it("carries each player's ready flag in ROOM_STATE, and SET_READY false withdraws it", async () => {
    const roomId = nextRoom("flag");
    const { host, guest } = await seatTwo(roomId);

    await readyUp(guest, host, roomId, GUEST);
    guest.send({ type: "RESYNC", roomId });
    const resync = await guest.waitFor("RESYNC_STATE");
    expect(resync.room.players[GUEST]?.isReady).toBe(true);

    guest.send({ type: "SET_READY", roomId, ready: false });
    await host.waitWhere(
      (m) => m.type === "PLAYER_READY" && m.playerId === GUEST && m.isReady === false,
    );
    host.send({ type: "START_GAME", roomId });
    await expect(host.waitWhere(isError("PLAYERS_NOT_READY"))).resolves.toBeDefined();
  });

  it("still honours the legacy READY message", async () => {
    const roomId = nextRoom("legacy");
    const { host, guest } = await seatTwo(roomId);

    guest.send({ type: "READY", roomId });
    await host.waitWhere((m) => m.type === "PLAYER_READY" && m.playerId === GUEST && m.isReady);
  });

  it("refuses a ready toggle from a spectator", async () => {
    const roomId = nextRoom("spectator");
    const { host } = await seatTwo(roomId);
    const watcher = await join(roomId, THIRD, "Watcher", "?spectator=true");

    watcher.send({ type: "SET_READY", roomId, ready: true });
    await expect(watcher.waitWhere(isError("FORBIDDEN"))).resolves.toBeDefined();
    void host;
  });

  it("resets readiness when the match ends", async () => {
    const roomId = nextRoom("reset");
    const { host, guest } = await seatTwo(roomId);
    await readyUp(guest, host, roomId, GUEST);

    host.send({ type: "START_GAME", roomId });
    const started = await host.waitFor("GAME_STARTED");

    // Mid-match, readiness is not something anyone can change.
    guest.send({ type: "SET_READY", roomId, ready: true });
    await expect(guest.waitWhere(isError("INVALID_STATE"))).resolves.toBeDefined();

    guest.send({
      type: "GAME_ACTION",
      roomId,
      sessionId: started.sessionId,
      actionType: "RESIGN",
      payload: {},
    });
    await host.waitFor("GAME_FINISHED");

    const room = await roomStateWhere(host, (r) => r.status === "finished");
    expect(room.players[GUEST]?.isReady).toBe(false);
  });

  it("rate limits a held-down ready toggle", async () => {
    const roomId = nextRoom("flood");
    const { guest } = await seatTwo(roomId);

    for (let i = 0; i < 20; i++) {
      guest.send({ type: "SET_READY", roomId, ready: i % 2 === 0 });
    }
    await expect(guest.waitWhere(isError("RATE_LIMITED"))).resolves.toBeDefined();
  });
});

describe("KICK_PLAYER", () => {
  it("is refused for anyone but the host", async () => {
    const roomId = nextRoom("kick-nonhost");
    const { guest } = await seatTwo(roomId);

    guest.send({ type: "KICK_PLAYER", roomId, playerId: HOST });
    await expect(guest.waitWhere(isError("FORBIDDEN"))).resolves.toBeDefined();
  });

  it("removes the player, tells them why, and closes their socket", async () => {
    const roomId = nextRoom("kick");
    const { host, guest } = await seatTwo(roomId);

    host.send({ type: "KICK_PLAYER", roomId, playerId: GUEST });

    const left = await host.waitWhere((m) => m.type === "PLAYER_LEFT" && m.playerId === GUEST);
    expect(left).toMatchObject({ reason: "kicked" });
    await expect(guest.waitWhere(isError("KICKED"))).resolves.toBeDefined();
    await waitUntil(() => guest.closed);
    // A normal closure, so a client does not treat it as a drop to retry.
    expect(guest.closeCode).toBe(1000);

    const room = await roomStateWhere(host, (r) => r.players[GUEST] === undefined);
    expect(Object.keys(room.players)).toEqual([HOST]);
  });

  it("keeps a removed player out of the room", async () => {
    const roomId = nextRoom("kick-rejoin");
    const { host } = await seatTwo(roomId);

    host.send({ type: "KICK_PLAYER", roomId, playerId: GUEST });
    await host.waitWhere((m) => m.type === "PLAYER_LEFT" && m.playerId === GUEST);

    const again = await TestClient.connect(roomId);
    again.send({ type: "AUTH", token: await mintToken(GUEST, { name: "Guest" }), isGuest: false });
    await expect(again.waitWhere(isError("KICKED"))).resolves.toBeDefined();
    expect(again.messagesOfType("CONNECTED")).toHaveLength(0);
  });

  it("will not remove a seated player mid-match", async () => {
    const roomId = nextRoom("kick-midgame");
    const { host, guest } = await seatTwo(roomId);
    await readyUp(guest, host, roomId, GUEST);
    host.send({ type: "START_GAME", roomId });
    await host.waitFor("GAME_STARTED");

    host.send({ type: "KICK_PLAYER", roomId, playerId: GUEST });
    await expect(host.waitWhere(isError("INVALID_STATE"))).resolves.toBeDefined();
  });

  it("removes a spectator even mid-match", async () => {
    const roomId = nextRoom("kick-spectator");
    const { host, guest } = await seatTwo(roomId);
    await readyUp(guest, host, roomId, GUEST);
    host.send({ type: "START_GAME", roomId });
    await host.waitFor("GAME_STARTED");

    const watcher = await join(roomId, THIRD, "Watcher");
    host.send({ type: "KICK_PLAYER", roomId, playerId: THIRD });

    await expect(watcher.waitWhere(isError("KICKED"))).resolves.toBeDefined();
    const room = await roomStateWhere(host, (r) => r.spectators[THIRD] === undefined && r.status === "in_game");
    expect(room.players[GUEST]).toBeDefined();
  });

  it("removes a bot without barring anyone", async () => {
    const roomId = nextRoom("kick-bot");
    const host = await join(roomId, HOST, "Host");
    host.send({ type: "ADD_BOT", roomId, level: 2 });
    const joined = await host.waitWhere((m) => m.type === "PLAYER_JOINED" && m.player.isBot === true);
    const botId = joined.type === "PLAYER_JOINED" ? joined.player.userId : "";

    host.send({ type: "KICK_PLAYER", roomId, playerId: botId });
    await expect(
      host.waitWhere((m) => m.type === "PLAYER_LEFT" && m.playerId === botId),
    ).resolves.toBeDefined();
  });
});

describe("UPDATE_ROOM_SETTINGS", () => {
  it("is refused for anyone but the host", async () => {
    const roomId = nextRoom("settings-nonhost");
    const { guest } = await seatTwo(roomId);

    guest.send({ type: "UPDATE_ROOM_SETTINGS", roomId, settings: { botLevel: 5 } });
    await expect(guest.waitWhere(isError("FORBIDDEN"))).resolves.toBeDefined();
  });

  it("refuses an option the room's game does not have", async () => {
    const roomId = nextRoom("settings-chess-laps");
    const host = await join(roomId, HOST, "Host");

    host.send({ type: "UPDATE_ROOM_SETTINGS", roomId, settings: { laps: 3 } });
    const error = await host.waitWhere(isError("INVALID_SETTINGS"));
    expect(error).toMatchObject({ details: { rejected: ["laps"] } });
  });

  it("refuses a value outside its range before it reaches the room", async () => {
    const roomId = nextRoom("settings-range");
    const host = await join(roomId, HOST, "Host");

    host.send({ type: "UPDATE_ROOM_SETTINGS", roomId, settings: { botLevel: 9 } });
    await expect(host.waitWhere(isError("BAD_REQUEST"))).resolves.toBeDefined();
  });

  it("stores race laps and broadcasts the room", async () => {
    const roomId = nextRoom("settings-laps");
    const { host, guest } = await seatTwo(roomId, "?gameId=car-race");

    host.send({ type: "UPDATE_ROOM_SETTINGS", roomId, settings: { laps: 7 } });
    const room = await roomStateWhere(guest, (r) => r.settings.customRules["laps"] === 7);
    expect(room.gameId).toBe("car-race");
  });

  it("stores UNO house rules rule by rule", async () => {
    const roomId = nextRoom("settings-uno");
    const host = await join(roomId, HOST, "Host", "?gameId=uno");

    host.send({ type: "UPDATE_ROOM_SETTINGS", roomId, settings: { houseRules: { stacking: true } } });
    await roomStateWhere(host, (r) => r.settings.customRules["houseRules"] !== undefined);
    host.send({ type: "UPDATE_ROOM_SETTINGS", roomId, settings: { houseRules: { jumpIn: true } } });

    const room = await roomStateWhere(host, (r) => {
      const rules = r.settings.customRules["houseRules"] as Record<string, boolean> | undefined;
      return rules?.["jumpIn"] === true;
    });
    expect(room.settings.customRules["houseRules"]).toEqual({ stacking: true, jumpIn: true });
  });

  it("re-levels the bots already seated", async () => {
    const roomId = nextRoom("settings-relevel");
    const host = await join(roomId, HOST, "Host");
    host.send({ type: "ADD_BOT", roomId, level: 2 });
    const joined = await host.waitWhere((m) => m.type === "PLAYER_JOINED" && m.player.isBot === true);
    const botId = joined.type === "PLAYER_JOINED" ? joined.player.userId : "";

    host.send({ type: "UPDATE_ROOM_SETTINGS", roomId, settings: { botLevel: 6 } });
    const room = await roomStateWhere(host, (r) => r.players[botId]?.botLevel === 6);
    expect(room.players[botId]?.displayName).toBe("AI level 6");
  });

  it("asks the guests to ready up again when the settings change", async () => {
    const roomId = nextRoom("settings-unready");
    const { host, guest } = await seatTwo(roomId, "?gameId=car-race");
    await readyUp(guest, host, roomId, GUEST);

    host.send({ type: "UPDATE_ROOM_SETTINGS", roomId, settings: { laps: 9 } });
    const room = await roomStateWhere(guest, (r) => r.settings.customRules["laps"] === 9);
    expect(room.players[GUEST]?.isReady).toBe(false);

    // And the old agreement no longer starts the match.
    host.send({ type: "START_GAME", roomId });
    await expect(host.waitWhere(isError("PLAYERS_NOT_READY"))).resolves.toBeDefined();
  });

  it("keeps the guests ready when a settings message changes nothing", async () => {
    const roomId = nextRoom("settings-same");
    const { host, guest } = await seatTwo(roomId, "?gameId=car-race");
    host.send({ type: "UPDATE_ROOM_SETTINGS", roomId, settings: { laps: 4 } });
    await roomStateWhere(host, (r) => r.settings.customRules["laps"] === 4);
    await readyUp(guest, host, roomId, GUEST);

    const before = host.messagesOfType("ROOM_STATE").length;
    host.send({ type: "UPDATE_ROOM_SETTINGS", roomId, settings: { laps: 4 } });
    await waitUntil(() => host.messagesOfType("ROOM_STATE").length > before);
    const latest = host.messagesOfType("ROOM_STATE").at(-1);
    expect(latest?.type === "ROOM_STATE" && latest.room.players[GUEST]?.isReady).toBe(true);
  });

  it("will not start on readiness given before START_GAME's own settings", async () => {
    const roomId = nextRoom("settings-start-change");
    const { host, guest } = await seatTwo(roomId, "?gameId=car-race");
    await readyUp(guest, host, roomId, GUEST);

    host.send({ type: "START_GAME", roomId, customRules: { laps: 8 } });
    await expect(host.waitWhere(isError("PLAYERS_NOT_READY"))).resolves.toBeDefined();
    expect(host.messagesOfType("GAME_STARTED")).toHaveLength(0);
    // The change itself still lands, so the guest sees what they are agreeing to.
    await roomStateWhere(guest, (r) => r.settings.customRules["laps"] === 8);
  });

  it("refuses settings the client tries to slip into START_GAME", async () => {
    const roomId = nextRoom("settings-start");
    const { host, guest } = await seatTwo(roomId);
    await readyUp(guest, host, roomId, GUEST);

    host.send({ type: "START_GAME", roomId, customRules: { randomSeed: "rigged-deck" } });
    await expect(host.waitWhere(isError("INVALID_SETTINGS"))).resolves.toBeDefined();
    expect(host.messagesOfType("GAME_STARTED")).toHaveLength(0);
  });
});

describe("room state sync", () => {
  it("shows a spectator as a spectator to everyone already in the room", async () => {
    const roomId = nextRoom("sync-spectator");
    const { host } = await seatTwo(roomId);
    await join(roomId, THIRD, "Watcher", "?spectator=true");

    const room = await roomStateWhere(host, (r) => r.spectators[THIRD] !== undefined);
    expect(room.players[THIRD]).toBeUndefined();
  });

  it("tells the room who the new host is when the host leaves", async () => {
    const roomId = nextRoom("sync-host");
    const { host, guest } = await seatTwo(roomId);

    host.send({ type: "LEAVE_ROOM", roomId });
    const room = await roomStateWhere(guest, (r) => r.hostId === GUEST);
    expect(room.players[GUEST]?.role).toBe("host");
  });
});

describe("room status", () => {
  it("reports live seat counts to another origin", async () => {
    const roomId = nextRoom("status");
    await seatTwo(roomId);
    await join(roomId, THIRD, "Watcher", "?spectator=true");

    const res = await SELF.fetch(`https://playora.test/rooms/${roomId}/status`, {
      headers: { Origin: "https://playora.example" },
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ exists: true, status: "waiting", playerCount: 2, spectatorCount: 1, maxPlayers: 2 });
  });
});

describe("lobby helpers", () => {
  const base = () =>
    createRoom({
      roomId: "r",
      roomCode: "R",
      gameId: "car-race",
      maxPlayers: 8,
      isPrivate: false,
      now: 0,
    });

  it("passes laps to a racing engine and nothing else it was not asked for", () => {
    const room = base();
    room.settings.customRules = { laps: 4, botLevel: 6, randomSeed: "nope" };
    expect(engineConfigFor(room)).toEqual({ laps: 4 });
  });

  it("does not pass laps to a game that has none", () => {
    const room = { ...base(), gameId: "chess" as const };
    room.settings = { ...room.settings, customRules: { laps: 4 } };
    expect(engineConfigFor(room)).toEqual({});
  });

  it("clears human ready flags and leaves bots ready", () => {
    const room = base();
    const seat = { avatarUrl: null, seatIndex: 0, status: "connected" as const, joinedAt: 0, lastPingAt: 0, isGuest: false };
    room.players = {
      h: { ...seat, id: "h", userId: "h", username: "h", displayName: "h", role: "host", isReady: true, isBot: false },
      b: { ...seat, id: "b", userId: "b", username: "b", displayName: "b", role: "player", isReady: true, isBot: true },
    };
    resetReadiness(room);
    expect(room.players["h"]?.isReady).toBe(false);
    expect(room.players["b"]?.isReady).toBe(true);
  });
});
