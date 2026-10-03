import { describe, it, expect } from "vitest";
import type { GameId } from "@playora/game-types";
import {
  getPlayModes,
  readyModes,
  isMultiplayer,
  isSoloGame,
  capabilitiesFor,
  isInstantlyPlayable,
  modeChipsFor,
} from "../modes";
import { GAME_CATALOG } from "../../games/catalog";

const NETWORKED: GameId[] = ["chess", "uno", "uno-no-mercy", "car-race", "bike-race"];
const SOLO_TITLES: GameId[] = [
  "rope-rescue",
  "ant-attack",
  "bomb-pass",
  "color-rush",
  "falling-floor",
  "pin-puzzle",
  "target-rush",
  "hot-potato",
  "bridge-builder",
  "ice-breaker",
];

/**
 * The rule these tests exist to hold: a mode is offered only when something can
 * service it.
 *
 * Before this, every implemented game advertised Quick Match, private rooms,
 * LAN and an AI opponent — including ten arcade titles with no server engine
 * and no bot. Choosing Quick Match for Ant Attack queued a player for a match
 * no server knows how to run.
 */
describe("play modes follow what a game can actually do", () => {
  it("offers solo games exactly one way in", () => {
    for (const id of SOLO_TITLES) {
      const modes = getPlayModes(id);
      expect(modes, id).toHaveLength(1);
      expect(modes[0]!.id, id).toBe("solo");
      expect(modes[0]!.status, id).toBe("ready");
    }
  });

  it("never offers a solo game an online mode", () => {
    for (const id of SOLO_TITLES) {
      const ids = getPlayModes(id).map((m) => m.id);
      expect(ids, id).not.toContain("online-random");
      expect(ids, id).not.toContain("online-friends");
      expect(ids, id).not.toContain("lan");
    }
  });

  it("never offers a solo game an AI opponent it does not have", () => {
    for (const id of SOLO_TITLES) {
      expect(getPlayModes(id).map((m) => m.id), id).not.toContain("offline-ai");
    }
  });

  it("offers every networked game the three online modes", () => {
    for (const id of NETWORKED) {
      const ids = getPlayModes(id).map((m) => m.id);
      expect(ids, id).toContain("online-friends");
      expect(ids, id).toContain("online-random");
      expect(ids, id).toContain("lan");
    }
  });

  it("only offers Pass & Play where sharing one device makes sense", () => {
    // Two people can share a chessboard. They cannot share a steering wheel.
    expect(getPlayModes("chess").map((m) => m.id)).toContain("offline-local");
    expect(capabilitiesFor("car-race")!.passAndPlay).toBe(false);

    const local = getPlayModes("car-race").find((m) => m.id === "offline-local");
    expect(local?.label).toBe("Time trial");
  });

  it("offers Career only to the racing games", () => {
    expect(getPlayModes("car-race").map((m) => m.id)).toContain("offline-career");
    expect(getPlayModes("bike-race").map((m) => m.id)).toContain("offline-career");
    expect(getPlayModes("chess").map((m) => m.id)).not.toContain("offline-career");
  });

  it("agrees with isMultiplayer and isSoloGame", () => {
    for (const id of NETWORKED) {
      expect(isMultiplayer(id), id).toBe(true);
      expect(isSoloGame(id), id).toBe(false);
    }
    for (const id of SOLO_TITLES) {
      expect(isMultiplayer(id), id).toBe(false);
      expect(isSoloGame(id), id).toBe(true);
    }
  });

  it("advertises no mode it then refuses", () => {
    for (const id of [...NETWORKED, ...SOLO_TITLES]) {
      for (const mode of getPlayModes(id)) {
        expect(mode.status, `${id}/${mode.id}`).toBe("ready");
      }
    }
  });

  it("keeps every game playable without an account", () => {
    for (const id of [...NETWORKED, ...SOLO_TITLES]) {
      expect(isInstantlyPlayable(id), id).toBe(true);
    }
  });

  it("falls back to a single coming-soon entry for an unknown game", () => {
    const modes = getPlayModes("not-a-game" as GameId);
    expect(modes).toHaveLength(1);
    expect(modes[0]!.status).toBe("coming-soon");
    expect(readyModes("not-a-game" as GameId)).toHaveLength(0);
  });
});

/**
 * The chips on a card are a summary of the mode list on the detail page, so
 * they must never promise a mode the list does not offer, or hide one it does.
 */
describe("mode chips summarise the mode list", () => {
  it("shows each chip exactly when the matching mode is offered", () => {
    for (const { id } of GAME_CATALOG) {
      const chips = modeChipsFor(id).map((c) => c.id);
      const modes = getPlayModes(id).map((m) => m.id);
      expect(chips.includes("online"), id).toBe(modes.includes("online-random"));
      expect(chips.includes("ai"), id).toBe(modes.includes("offline-ai"));
      expect(chips.includes("career"), id).toBe(modes.includes("offline-career"));
      expect(chips.includes("solo"), id).toBe(modes.includes("solo"));
      if (chips.includes("local")) expect(modes, id).toContain("offline-local");
    }
  });

  it("does not call racing's time trial a local multiplayer mode", () => {
    expect(getPlayModes("car-race").map((m) => m.id)).toContain("offline-local");
    expect(modeChipsFor("car-race").map((c) => c.id)).not.toContain("local");
  });

  it("gives every catalog game at least one chip, and an unknown game none", () => {
    for (const { id } of GAME_CATALOG) expect(modeChipsFor(id).length, id).toBeGreaterThan(0);
    expect(modeChipsFor("not-a-game" as GameId)).toEqual([]);
  });
});
