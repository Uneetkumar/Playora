import { describe, expect, it } from "vitest";
import { AI_LEVELS, RECOMMENDED_AI_LEVEL } from "@playora/bot-engine";
import type { GameId } from "@playora/game-types";
import { GAME_CATALOG } from "../../../../lib/games/catalog";
import { getPlayModes } from "../../../../lib/play/modes";
import { TRACK_PRESETS } from "../../../../games/racing/TrackSelect";
import {
  defaultMode,
  isRacingGame,
  modeCopy,
  playHref,
  usesBotLevel,
  usesTrackTheme,
} from "../play-options";

/*
 * The URLs the detail page produced before the redesign, read off the live
 * page for each game and mode at the default settings (level 3, the first
 * circuit). The redesign only re-presents these buttons; every one of them
 * has to land where it always did.
 */
const BEFORE: Record<string, Partial<Record<string, string>>> = {
  chess: {
    "offline-ai": "/play?game=chess&mode=vs-ai&level=3",
    "offline-local": "/play?game=chess&mode=pass-and-play",
    "online-friends": "/rooms?game=chess",
    "online-random": "/play?game=chess&quick=1",
    lan: "/lan?game=chess&role=host",
  },
  uno: {
    "offline-ai": "/play?game=uno&mode=vs-ai&level=3",
    "offline-local": "/play?game=uno&mode=pass-and-play",
    "online-friends": "/rooms?game=uno",
    "online-random": "/play?game=uno&quick=1",
    lan: "/lan?game=uno&role=host",
  },
  "car-race": {
    "offline-ai": "/play?game=car-race&mode=vs-ai&level=3&theme=cityNight",
    "offline-career": "/play?game=car-race&mode=career&theme=cityNight",
    "offline-local": "/play?game=car-race&mode=pass-and-play&theme=cityNight",
    "online-friends": "/rooms?game=car-race",
    "online-random": "/play?game=car-race&quick=1&theme=cityNight",
    lan: "/lan?game=car-race&role=host",
  },
  "bridge-builder": {
    solo: "/play?game=bridge-builder&mode=solo",
  },
  "tic-tac-toe": {
    "offline-ai": "/play?game=tic-tac-toe&mode=vs-ai&level=3",
    "offline-local": "/play?game=tic-tac-toe&mode=pass-and-play",
  },
};

const FIRST_THEME = TRACK_PRESETS[0]!.themeKey;

describe("playHref", () => {
  for (const [slug, routes] of Object.entries(BEFORE)) {
    it(`${slug}: every mode goes where it did before`, () => {
      const id = slug as GameId;
      const modes = getPlayModes(id);
      // The same set of modes as before, so no button appeared or vanished.
      expect(modes.map((m) => m.id).sort()).toEqual(Object.keys(routes).sort());
      for (const mode of modes) {
        const href = playHref(mode.id, id, {
          aiLevel: RECOMMENDED_AI_LEVEL,
          trackTheme: isRacingGame(id) ? FIRST_THEME : undefined,
        });
        expect(href, mode.id).toBe(routes[mode.id]);
      }
    });
  }

  it("carries the chosen bot level", () => {
    for (const level of AI_LEVELS) {
      expect(playHref("offline-ai", "chess", { aiLevel: level })).toBe(`/play?game=chess&mode=vs-ai&level=${level}`);
    }
  });

  it("carries the chosen circuit on racing's /play routes, and only there", () => {
    const setup = { aiLevel: 5 as const, trackTheme: "sunsetHighway" };
    expect(playHref("offline-ai", "bike-race", setup)).toBe(
      "/play?game=bike-race&mode=vs-ai&level=5&theme=sunsetHighway",
    );
    expect(playHref("online-random", "car-race", setup)).toBe("/play?game=car-race&quick=1&theme=sunsetHighway");
    expect(playHref("online-friends", "car-race", setup)).toBe("/rooms?game=car-race");
    expect(playHref("lan", "car-race", setup)).toBe("/lan?game=car-race&role=host");
    // A non-racing game never grows a theme, even if one is handed in.
    expect(playHref("offline-ai", "chess", setup)).toBe("/play?game=chess&mode=vs-ai&level=5");
  });
});

describe("defaultMode", () => {
  it("is the first mode that works, which is what the old Play Now started", () => {
    expect(defaultMode(getPlayModes("chess"))?.id).toBe("offline-ai");
    expect(defaultMode(getPlayModes("car-race"))?.id).toBe("offline-ai");
    expect(defaultMode(getPlayModes("bridge-builder"))?.id).toBe("solo");
  });

  it("falls back to the only mode when nothing is ready", () => {
    const modes = [{ ...getPlayModes("chess")[0]!, status: "coming-soon" as const }];
    expect(defaultMode(modes)).toBe(modes[0]);
    expect(defaultMode([])).toBeUndefined();
  });
});

describe("modeCopy", () => {
  it("names every mode of every game, with the button saying what it does", () => {
    for (const game of GAME_CATALOG) {
      for (const mode of getPlayModes(game.id)) {
        const copy = modeCopy(mode.id, game.id);
        expect(copy.option.length, `${game.id} ${mode.id}`).toBeGreaterThan(0);
        expect(copy.option.length, `${game.id} ${mode.id} fits a half-width toggle`).toBeLessThanOrEqual(12);
        expect(copy.action.length).toBeGreaterThan(0);
        expect(copy.hint).toMatch(/\.$/);
      }
    }
  });

  it("calls racing's offline mode a time trial", () => {
    expect(modeCopy("offline-local", "car-race").option).toBe("Time trial");
    expect(modeCopy("offline-local", "chess").option).toBe("Pass & Play");
  });

  it("labels Play by mode", () => {
    expect(modeCopy("online-random", "uno").action).toBe("Find match");
    expect(modeCopy("offline-ai", "uno").action).toBe("Play vs bot");
    expect(modeCopy("online-friends", "uno").action).toBe("Create room");
  });
});

describe("presets", () => {
  it("offers the bot level only against a bot", () => {
    expect(usesBotLevel("offline-ai")).toBe(true);
    for (const id of ["solo", "offline-career", "offline-local", "online-friends", "online-random", "lan"] as const) {
      expect(usesBotLevel(id)).toBe(false);
    }
  });

  it("offers the circuit only for races drawn on this device", () => {
    expect(usesTrackTheme("car-race", "offline-ai")).toBe(true);
    expect(usesTrackTheme("bike-race", "offline-career")).toBe(true);
    expect(usesTrackTheme("car-race", "offline-local")).toBe(true);
    expect(usesTrackTheme("car-race", "online-random")).toBe(false);
    expect(usesTrackTheme("car-race", "online-friends")).toBe(false);
    expect(usesTrackTheme("chess", "offline-ai")).toBe(false);
  });
});
