import { describe, it, expect, afterEach } from "vitest";
import { TestClient, mintToken, uuid } from "./helpers.js";

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

  host.send({ type: "READY", roomId });
  guest.send({ type: "READY", roomId });
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
