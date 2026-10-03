import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { GameId } from "@playora/game-types";
import { GAME_CATALOG, isGameId, searchGames } from "../catalog";
import { FEATURED_GAME_IDS, GAME_GENRES, GAME_META, gameAccentStyle, isGameGenre } from "../meta";
import { GAME_IMAGES, imageForGame } from "../../../components/games/game-images";

/**
 * Every `GameId`, as a value.
 *
 * Written as a `Record<GameId, true>` so adding an id to the union fails the
 * type check on this file until it is listed here — and the tests below then
 * fail until the catalog and the metadata have it too.
 */
const ALL_GAME_IDS = Object.keys({
  chess: true,
  uno: true,
  "uno-no-mercy": true,
  "car-race": true,
  "bike-race": true,
  "rope-rescue": true,
  "ant-attack": true,
  "bomb-pass": true,
  "color-rush": true,
  "falling-floor": true,
  "pin-puzzle": true,
  "target-rush": true,
  "hot-potato": true,
  "bridge-builder": true,
  "ice-breaker": true,
  "tic-tac-toe": true,
  "connect-four": true,
  ludo: true,
  "snake-ladder": true,
  checkers: true,
  battleship: true,
  "memory-match": true,
  "game-2048": true,
  minesweeper: true,
  "word-guess": true,
  "flappy-bird": true,
  "retro-snake": true,
  pong: true,
  "brick-breaker": true,
  "whack-a-mole": true,
  "simon-says": true,
} satisfies Record<GameId, true>) as GameId[];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PUBLIC_DIR = path.resolve(__dirname, "../../../../public");

describe("game metadata covers the whole catalog", () => {
  it("has all 31 game ids, each exactly once, in both the catalog and the metadata", () => {
    expect(ALL_GAME_IDS).toHaveLength(31);
    const catalogIds = GAME_CATALOG.map((g) => g.id);
    expect(new Set(catalogIds).size).toBe(catalogIds.length);
    expect([...catalogIds].sort()).toEqual([...ALL_GAME_IDS].sort());
    expect(Object.keys(GAME_META).sort()).toEqual([...ALL_GAME_IDS].sort());
  });

  it("recognises catalog ids and nothing else as game ids", () => {
    for (const id of ALL_GAME_IDS) expect(isGameId(id), id).toBe(true);
    for (const bad of ["", "Chess", "solitaire", "__proto__", 7, null, undefined]) {
      expect(isGameId(bad), String(bad)).toBe(false);
    }
  });
});

describe("game metadata values", () => {
  it("gives every game a six-digit hex accent", () => {
    for (const id of ALL_GAME_IDS) {
      expect(GAME_META[id].accent, id).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("exposes the accent as the --game-accent variable", () => {
    expect(gameAccentStyle("chess")).toEqual({ "--game-accent": GAME_META.chess.accent });
  });

  it("puts every game in one of the browse genres, and leaves no genre empty", () => {
    for (const id of ALL_GAME_IDS) {
      expect(isGameGenre(GAME_META[id].genre), `${id}: ${GAME_META[id].genre}`).toBe(true);
    }
    for (const genre of GAME_GENRES) {
      const count = ALL_GAME_IDS.filter((id) => GAME_META[id].genre === genre).length;
      expect(count, genre).toBeGreaterThan(0);
    }
    expect(isGameGenre("Physics")).toBe(false);
  });

  it("dates every game with real ISO dates, never updated before it was released", () => {
    for (const id of ALL_GAME_IDS) {
      const { releasedAt, updatedAt } = GAME_META[id];
      expect(releasedAt, id).toMatch(ISO_DATE);
      expect(updatedAt, id).toMatch(ISO_DATE);
      expect(Number.isNaN(Date.parse(releasedAt)), id).toBe(false);
      expect(Number.isNaN(Date.parse(updatedAt)), id).toBe(false);
      expect(updatedAt >= releasedAt, `${id} updated ${updatedAt} before release ${releasedAt}`).toBe(true);
    }
  });

  it("features exactly the hero games, in hero order", () => {
    expect(FEATURED_GAME_IDS).toEqual([
      "car-race",
      "bike-race",
      "uno",
      "uno-no-mercy",
      "chess",
      "bridge-builder",
    ]);
    const featured = ALL_GAME_IDS.filter((id) => GAME_META[id].featured);
    expect([...featured].sort()).toEqual([...FEATURED_GAME_IDS].sort());
  });

  it("gives every game a short hero tagline", () => {
    for (const id of ALL_GAME_IDS) {
      const line = GAME_META[id].heroTagline;
      expect(line.trim().length, id).toBeGreaterThan(0);
      expect(line.length, `${id}: "${line}"`).toBeLessThanOrEqual(60);
    }
  });

  it("points every cover at a file that exists", () => {
    for (const id of ALL_GAME_IDS) {
      const { landscape, portrait, square } = GAME_META[id].covers;
      for (const cover of [landscape, portrait, square]) {
        if (cover === undefined) continue;
        expect(cover.startsWith("/games/"), `${id}: ${cover}`).toBe(true);
        expect(fs.existsSync(path.join(PUBLIC_DIR, cover)), `${id}: ${cover}`).toBe(true);
      }
    }
  });

  it("uses the landscape cover as the share image, so the two cannot drift", () => {
    for (const id of ALL_GAME_IDS) {
      expect(GAME_IMAGES[id], id).toBe(GAME_META[id].covers.landscape);
      expect(imageForGame(id), id).toBe(GAME_META[id].covers.landscape);
    }
    expect(imageForGame("not-a-game")).toBe(GAME_META.chess.covers.landscape);
  });
});

describe("search knows about genres", () => {
  it("finds a game by its genre when nothing else about it matches", () => {
    // Ice Breaker's category is Action and no tag says "party"; only its genre does.
    expect(GAME_META["ice-breaker"].genre).toBe("Party");
    expect(searchGames("party").map((g) => g.id)).toContain("ice-breaker");
  });
});
