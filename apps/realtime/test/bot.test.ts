import { describe, it, expect, afterEach } from "vitest";
import { TestClient, mintToken, uuid } from "./helpers.js";

// Closing a socket kicks off disconnect handling inside the Durable Object
// (persist, alarm scheduling). Give that a tick to drain, or it races the
// environment teardown and surfaces as an unhandled RPC rejection.
afterEach(async () => {
  TestClient.closeAll();
  await new Promise((resolve) => setTimeout(resolve, 50));
});

let seq = 0;
const nextRoom = (label: string) => `bot-${label}-${seq++}`;

const HOST = uuid(1);
const OTHER = uuid(2);

async function seatHost(roomId: string) {
  const host = await TestClient.connect(roomId);
  await host.authenticate(await mintToken(HOST, { name: "Host" }));
  await host.waitFor("ROOM_STATE");
  return host;
}

describe("RoomDurableObject: server-side AI", () => {
  it("seats a bot that is clearly labelled as one", async () => {
    const roomId = nextRoom("add");
    const host = await seatHost(roomId);

    host.send({ type: "ADD_BOT", roomId, level: 2 });
    const joined = await host.waitWhere(
      (m) => m.type === "PLAYER_JOINED" && m.player.isBot === true,
    );

    expect(joined).toMatchObject({
      type: "PLAYER_JOINED",
      player: { isBot: true, botLevel: 2, isReady: true, role: "player" },
    });
    // Spec section 8: a bot must never be presented as a human.
    if (joined.type === "PLAYER_JOINED") {
      expect(joined.player.displayName).toContain("AI");
      expect(joined.player.isGuest).toBe(false);
    }
  });

  it("refuses to seat a bot for anyone but the host", async () => {
    const roomId = nextRoom("nonhost");
    const host = await seatHost(roomId);

    const other = await TestClient.connect(roomId);
    await other.authenticate(await mintToken(OTHER, { name: "Other" }));
    await other.waitFor("ROOM_STATE");

    other.send({ type: "ADD_BOT", roomId, level: 3 });

    expect((await other.waitFor("ERROR")).code).toBe("FORBIDDEN");
    void host;
  });

  it("plays the bot's turn automatically once the game starts", async () => {
    const roomId = nextRoom("plays");
    const host = await seatHost(roomId);

    host.send({ type: "ADD_BOT", roomId, level: 1 });
    await host.waitWhere((m) => m.type === "PLAYER_JOINED" && m.player.isBot === true);

    host.send({ type: "START_GAME", roomId });
    await host.waitFor("GAME_STARTED");

    // Whoever moves first, the turn must come back to the human: either the bot
    // moved immediately, or the human is on move from the opening position.
    const state = await host.waitWhere(
      (m) => m.type === "GAME_STATE" && (m.state as { isMyTurn?: boolean })?.isMyTurn === true,
      8000,
    );
    expect(state.type).toBe("GAME_STATE");
  });

  it("lets the host remove a bot before the game starts", async () => {
    const roomId = nextRoom("remove");
    const host = await seatHost(roomId);

    host.send({ type: "ADD_BOT", roomId, level: 3 });
    const joined = await host.waitWhere(
      (m) => m.type === "PLAYER_JOINED" && m.player.isBot === true,
    );
    const botId = joined.type === "PLAYER_JOINED" ? joined.player.userId : "";

    host.send({ type: "REMOVE_BOT", roomId, botId });
    const left = await host.waitFor("PLAYER_LEFT");
    expect(left.playerId).toBe(botId);
  });

  it("refuses to add a bot once the game is running", async () => {
    const roomId = nextRoom("midgame");
    const host = await seatHost(roomId);

    host.send({ type: "ADD_BOT", roomId, level: 1 });
    await host.waitWhere((m) => m.type === "PLAYER_JOINED" && m.player.isBot === true);
    host.send({ type: "START_GAME", roomId });
    await host.waitFor("GAME_STARTED");

    host.send({ type: "ADD_BOT", roomId, level: 1 });
    const error = await host.waitWhere(
      (m) => m.type === "ERROR" && m.code === "INVALID_STATE",
      8000,
    );
    expect(error.type).toBe("ERROR");
  });
});
