import { describe, it, expect, afterEach } from "vitest";
import { TestClient, mintToken, readyUp, uuid } from "./helpers.js";

afterEach(async () => {
  TestClient.closeAll();
  await new Promise((resolve) => setTimeout(resolve, 50));
});

let seq = 0;
const nextRoom = (label: string) => `rematch-${label}-${seq++}`;

const HOST = uuid(1);
const GUEST = uuid(2);

/** Two seated humans with a finished game behind them. */
async function finishedMatch(roomId: string) {
  const host = await TestClient.connect(roomId);
  await host.authenticate(await mintToken(HOST, { name: "Host" }));
  await host.waitFor("ROOM_STATE");

  const guest = await TestClient.connect(roomId);
  await guest.authenticate(await mintToken(GUEST, { name: "Guest" }));
  await guest.waitFor("ROOM_STATE");

  await readyUp(guest, host, roomId, GUEST);
  host.send({ type: "START_GAME", roomId });
  const started = await host.waitFor("GAME_STARTED");

  guest.send({
    type: "GAME_ACTION",
    roomId,
    sessionId: started.type === "GAME_STARTED" ? started.sessionId : "",
    actionType: "RESIGN",
    payload: {},
  });
  await host.waitFor("GAME_FINISHED");

  return { host, guest, firstSessionId: started.type === "GAME_STARTED" ? started.sessionId : "" };
}

describe("RoomDurableObject: rematch", () => {
  it("does not restart on one player's vote", async () => {
    const roomId = nextRoom("one-vote");
    const { host } = await finishedMatch(roomId);

    host.send({ type: "REMATCH", roomId, accept: true });
    const state = await host.waitFor("REMATCH_STATE");

    expect(state).toMatchObject({ type: "REMATCH_STATE" });
    if (state.type === "REMATCH_STATE") {
      expect(state.votes).toHaveLength(1);
      expect(state.needed).toHaveLength(2);
    }
  });

  it("starts a fresh session once both players agree", async () => {
    const roomId = nextRoom("both");
    const { host, guest, firstSessionId } = await finishedMatch(roomId);

    host.send({ type: "REMATCH", roomId, accept: true });
    await host.waitFor("REMATCH_STATE");
    guest.send({ type: "REMATCH", roomId, accept: true });

    const restarted = await guest.waitWhere(
      (m) => m.type === "GAME_STARTED" && m.sessionId !== firstSessionId,
    );
    expect(restarted.type).toBe("GAME_STARTED");
  });

  it("lets a player take their vote back", async () => {
    const roomId = nextRoom("withdraw");
    const { host } = await finishedMatch(roomId);

    host.send({ type: "REMATCH", roomId, accept: true });
    await host.waitFor("REMATCH_STATE");
    host.send({ type: "REMATCH", roomId, accept: false });

    const cleared = await host.waitWhere(
      (m) => m.type === "REMATCH_STATE" && m.votes.length === 0,
    );
    expect(cleared.type).toBe("REMATCH_STATE");
  });

  it("refuses a rematch with too few players left, and leaves the room playable", async () => {
    const roomId = nextRoom("short");
    const { host, guest, firstSessionId } = await finishedMatch(roomId);

    guest.send({ type: "LEAVE_ROOM", roomId });
    await host.waitWhere((m) => m.type === "PLAYER_LEFT" && m.playerId === GUEST);

    // The only voter left agrees, but chess needs two.
    host.send({ type: "REMATCH", roomId, accept: true });
    const error = await host.waitWhere((m) => m.type === "ERROR");
    expect(error).toMatchObject({ code: "INVALID_PLAYER_COUNT" });
    expect(host.messagesOfType("GAME_STARTED")).toHaveLength(1);

    // Still between matches, not stuck `in_game` with the old board, and the
    // vote is not left hanging.
    host.send({ type: "RESYNC", roomId });
    const resync = await host.waitFor("RESYNC_STATE");
    expect(resync.room.status).toBe("finished");
    expect(resync.room.currentSessionId).toBe(firstSessionId);
    const votes = host.messagesOfType("REMATCH_STATE").at(-1);
    expect(votes?.type === "REMATCH_STATE" && votes.votes).toEqual([]);

    // So Start says why it cannot deal, rather than "a game is in progress".
    host.send({ type: "START_GAME", roomId });
    const refused = await host.waitWhere((m) => m.type === "ERROR" && m !== error);
    expect(refused).toMatchObject({ code: "INVALID_PLAYER_COUNT" });
  });

  it("rate limits a held-down rematch toggle", async () => {
    const roomId = nextRoom("flood");
    const { host } = await finishedMatch(roomId);

    for (let i = 0; i < 20; i++) {
      host.send({ type: "REMATCH", roomId, accept: i % 2 === 0 });
    }
    const limited = await host.waitWhere((m) => m.type === "ERROR" && m.code === "RATE_LIMITED");
    expect(limited.type).toBe("ERROR");
  });

  it("refuses a rematch while no game has finished", async () => {
    const roomId = nextRoom("too-early");
    const host = await TestClient.connect(roomId);
    await host.authenticate(await mintToken(HOST, { name: "Host" }));
    await host.waitFor("ROOM_STATE");

    host.send({ type: "REMATCH", roomId, accept: true });
    expect((await host.waitFor("ERROR")).code).toBe("INVALID_STATE");
  });

  it("does not wait on a bot's vote", async () => {
    const roomId = nextRoom("bot");
    const host = await TestClient.connect(roomId);
    await host.authenticate(await mintToken(HOST, { name: "Host" }));
    await host.waitFor("ROOM_STATE");

    host.send({ type: "ADD_BOT", roomId, level: 1 });
    await host.waitWhere((m) => m.type === "PLAYER_JOINED" && m.player.isBot === true);
    host.send({ type: "READY", roomId });
    host.send({ type: "START_GAME", roomId });
    const started = await host.waitFor("GAME_STARTED");
    const sessionId = started.type === "GAME_STARTED" ? started.sessionId : "";

    host.send({ type: "GAME_ACTION", roomId, sessionId, actionType: "RESIGN", payload: {} });
    await host.waitFor("GAME_FINISHED");

    // There is nobody to ask, so the human's vote alone is the whole vote.
    host.send({ type: "REMATCH", roomId, accept: true });
    const restarted = await host.waitWhere(
      (m) => m.type === "GAME_STARTED" && m.sessionId !== sessionId,
    );
    expect(restarted.type).toBe("GAME_STARTED");
  });
});
