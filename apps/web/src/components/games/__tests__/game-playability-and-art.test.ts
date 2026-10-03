import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { GameId } from "@playora/game-types";
import { GAME_CATALOG, isPlayable } from "../../../lib/games/catalog";
import { artFor } from "../game-art";
import { GAME_IMAGES } from "../game-images";
import { getPlayModes, isSoloGame, capabilitiesFor } from "../../../lib/play/modes";

const ADDED_16_GAMES: GameId[] = [
  "tic-tac-toe",
  "connect-four",
  "ludo",
  "snake-ladder",
  "checkers",
  "battleship",
  "pong",
  "memory-match",
  "game-2048",
  "minesweeper",
  "word-guess",
  "simon-says",
  "retro-snake",
  "flappy-bird",
  "brick-breaker",
  "whack-a-mole",
];

const BOARD_8_GAMES: GameId[] = [
  "tic-tac-toe",
  "connect-four",
  "ludo",
  "snake-ladder",
  "checkers",
  "battleship",
  "pong",
  "memory-match",
];

const ARCADE_8_NEW_GAMES: GameId[] = [
  "game-2048",
  "minesweeper",
  "word-guess",
  "simon-says",
  "retro-snake",
  "flappy-bird",
  "brick-breaker",
  "whack-a-mole",
];

describe("Game Art & Playability Self-Audit for All 16 Added Games", () => {
  it("all 16 added games exist in the catalog and are marked playable", () => {
    for (const gameId of ADDED_16_GAMES) {
      const game = GAME_CATALOG.find((g) => g.id === gameId);
      expect(game, `${gameId} must exist in GAME_CATALOG`).toBeDefined();
      expect(isPlayable(game!), `${gameId} must be playable`).toBe(true);
    }
  });

  it("all 16 added games have vector Art components and valid image assets on disk", () => {
    const publicDir = path.resolve(__dirname, "../../../../public");
    for (const gameId of ADDED_16_GAMES) {
      const art = artFor(gameId);
      expect(art, `art for ${gameId}`).toBeDefined();
      expect(typeof art.Art, `${gameId} Art component`).toBe("function");
      expect(art.background, `${gameId} background`).toBeTruthy();
      if (art.imageUrl) {
        const filePath = path.join(publicDir, art.imageUrl);
        expect(fs.existsSync(filePath), `file exists for ${gameId} at ${filePath}`).toBe(true);
      }
    }
  });

  it("all original 15 games have existing JPG assets on disk", () => {
    const publicGamesDir = path.resolve(__dirname, "../../../../public");
    const originalGames = GAME_CATALOG.filter((g) => !ADDED_16_GAMES.includes(g.id as GameId));

    for (const game of originalGames) {
      const art = artFor(game.id);
      if (art.imageUrl) {
        const filePath = path.join(publicGamesDir, art.imageUrl);
        expect(fs.existsSync(filePath), `file exists for ${game.id} at ${filePath}`).toBe(true);
      }
    }
  });

  it("every game in GAME_IMAGES points to an existing file on disk", () => {
    const publicDir = path.resolve(__dirname, "../../../../public");
    for (const game of GAME_CATALOG) {
      const imgPath = GAME_IMAGES[game.id];
      expect(imgPath, `GAME_IMAGES entry for ${game.id}`).toBeDefined();
      const resolved = path.join(publicDir, imgPath!);
      expect(fs.existsSync(resolved), `resolved image for ${game.id} at ${resolved}`).toBe(true);
    }
  });

  it("all 8 new arcade games are classified as solo games and have ready solo modes", () => {
    for (const gameId of ARCADE_8_NEW_GAMES) {
      expect(isSoloGame(gameId), `${gameId} isSoloGame`).toBe(true);
      const modes = getPlayModes(gameId);
      expect(modes.length, `${gameId} mode count`).toBe(1);
      expect(modes[0]!.id, `${gameId} mode id`).toBe("solo");
      expect(modes[0]!.status, `${gameId} mode status`).toBe("ready");
    }
  });

  it("all 8 board games have valid multiplayer/AI modes", () => {
    for (const gameId of BOARD_8_GAMES) {
      const caps = capabilitiesFor(gameId);
      expect(caps, `${gameId} capabilities`).toBeDefined();
      const modes = getPlayModes(gameId);
      expect(modes.length, `${gameId} modes count`).toBeGreaterThanOrEqual(1);
      const ready = modes.filter((m) => m.status === "ready");
      expect(ready.length, `${gameId} ready modes`).toBeGreaterThanOrEqual(1);
    }
  });

  it("battleship has passAndPlay set to false and offers vs-ai ready mode", () => {
    const caps = capabilitiesFor("battleship");
    expect(caps?.passAndPlay, "battleship passAndPlay must be false").toBe(false);
    expect(caps?.ai, "battleship ai must be true").toBe(true);
    const modes = getPlayModes("battleship");
    expect(modes.some((m) => m.id === "offline-ai" && m.status === "ready")).toBe(true);
    expect(modes.some((m) => m.id === "offline-local")).toBe(false);
  });

  it("all 8 board games have both AI and pass-and-play modes where supported", () => {
    const dualModeGames: GameId[] = [
      "tic-tac-toe",
      "connect-four",
      "ludo",
      "snake-ladder",
      "checkers",
      "pong",
      "memory-match",
    ];
    for (const gameId of dualModeGames) {
      const modes = getPlayModes(gameId);
      const modeIds = modes.map((m) => m.id);
      expect(modeIds, `${gameId} must offer offline-ai`).toContain("offline-ai");
      expect(modeIds, `${gameId} must offer offline-local`).toContain("offline-local");
    }
  });
});
