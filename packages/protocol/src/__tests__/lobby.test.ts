import { describe, it, expect } from "vitest";
import {
  describeStartBlocker,
  mergeRoomOptions,
  parseClientMessage,
  playersNotReady,
  readRoomOptions,
  roomOptionKeysFor,
  startBlocker,
  validateRoomOptions,
} from "../index.js";

describe("lobby messages", () => {
  it("parses SET_READY in both directions", () => {
    for (const ready of [true, false]) {
      const parsed = parseClientMessage({ type: "SET_READY", roomId: "ABC123", ready });
      expect(parsed.success).toBe(true);
      if (parsed.success && parsed.data.type === "SET_READY") {
        expect(parsed.data.ready).toBe(ready);
      }
    }
  });

  it("refuses SET_READY without a ready flag", () => {
    expect(parseClientMessage({ type: "SET_READY", roomId: "ABC123" }).success).toBe(false);
  });

  it("parses KICK_PLAYER and refuses an empty target", () => {
    expect(
      parseClientMessage({ type: "KICK_PLAYER", roomId: "ABC123", playerId: "u-2" }).success,
    ).toBe(true);
    expect(
      parseClientMessage({ type: "KICK_PLAYER", roomId: "ABC123", playerId: "" }).success,
    ).toBe(false);
  });

  it("parses UPDATE_ROOM_SETTINGS within the ranges", () => {
    const parsed = parseClientMessage({
      type: "UPDATE_ROOM_SETTINGS",
      roomId: "ABC123",
      settings: { botLevel: 7, laps: 10, houseRules: { stacking: true } },
    });
    expect(parsed.success).toBe(true);
  });

  it.each([
    [{ botLevel: 0 }],
    [{ botLevel: 8 }],
    [{ botLevel: 2.5 }],
    [{ laps: 0 }],
    [{ laps: 11 }],
    [{ houseRules: { stacking: "yes" } }],
    // Strict: an option nobody defined is a malformed message, not a no-op.
    [{ randomSeed: 42 }],
    [{ houseRules: { dealSelfOneCard: true } }],
  ])("refuses out-of-range or unknown settings %j", (settings) => {
    expect(
      parseClientMessage({ type: "UPDATE_ROOM_SETTINGS", roomId: "ABC123", settings }).success,
    ).toBe(false);
  });
});

describe("room options whitelist", () => {
  it("offers laps only to racing and house rules only to UNO", () => {
    expect(roomOptionKeysFor("car-race")).toContain("laps");
    expect(roomOptionKeysFor("bike-race")).toContain("laps");
    expect(roomOptionKeysFor("chess")).not.toContain("laps");
    expect(roomOptionKeysFor("uno")).toContain("houseRules");
    expect(roomOptionKeysFor("uno-no-mercy")).toContain("houseRules");
    expect(roomOptionKeysFor("car-race")).not.toContain("houseRules");
  });

  it("offers nothing for a game without a server engine", () => {
    expect(roomOptionKeysFor("tic-tac-toe")).toEqual([]);
  });

  it("refuses a key the room's game does not offer, and names it", () => {
    const result = validateRoomOptions("chess", { laps: 3 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejected).toEqual(["laps"]);
  });

  it("accepts the keys the game does offer", () => {
    expect(validateRoomOptions("car-race", { laps: 5, botLevel: 2 }).ok).toBe(true);
  });

  it("merges house rules rule by rule", () => {
    const merged = mergeRoomOptions(
      { botLevel: 3, houseRules: { stacking: true } },
      { houseRules: { jumpIn: true } },
    );
    expect(merged).toEqual({ botLevel: 3, houseRules: { stacking: true, jumpIn: true } });
  });

  it("reads stored options leniently, dropping what is invalid or foreign", () => {
    const stored = { botLevel: 5, laps: 99, houseRules: { stacking: true }, randomSeed: 1 };
    expect(readRoomOptions("uno", stored)).toEqual({ botLevel: 5, houseRules: { stacking: true } });
    expect(readRoomOptions("car-race", stored)).toEqual({ botLevel: 5 });
    expect(readRoomOptions("chess", null)).toEqual({});
  });
});

describe("ready check", () => {
  const host = { userId: "host", isReady: false };
  const guest = { userId: "guest", isReady: false };
  const bot = { userId: "bot-1", isReady: false, isBot: true };

  it("never waits on the host or a bot", () => {
    expect(playersNotReady([host, bot], "host")).toEqual([]);
  });

  it("waits on every other human who has not readied", () => {
    expect(playersNotReady([host, guest, { userId: "g2", isReady: true }], "host")).toEqual([
      "guest",
    ]);
  });

  it("reports a missing player before an unready one", () => {
    expect(startBlocker({ seats: [host], hostId: "host", minPlayers: 2 })).toEqual({
      kind: "players",
      missing: 1,
    });
  });

  it("blocks on readiness once the seats are filled", () => {
    expect(startBlocker({ seats: [host, guest], hostId: "host", minPlayers: 2 })).toEqual({
      kind: "ready",
      waitingOn: ["guest"],
    });
  });

  it("clears once everyone is ready", () => {
    expect(
      startBlocker({ seats: [host, { ...guest, isReady: true }, bot], hostId: "host", minPlayers: 2 }),
    ).toBeNull();
  });

  it("explains itself in a sentence", () => {
    expect(describeStartBlocker({ kind: "ready", waitingOn: ["a", "b"] })).toBe(
      "Waiting for 2 players to ready up",
    );
    expect(describeStartBlocker({ kind: "players", missing: 1 })).toBe(
      "Waiting for 1 more player to join",
    );
  });
});
