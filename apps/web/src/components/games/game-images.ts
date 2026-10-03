/**
 * Cover art paths, as plain data.
 *
 * `game-art.tsx` is a `"use client"` module because it exports React
 * components, which means the server cannot call `artFor()` at all — the build
 * failed on exactly that when the game pages started generating their Open
 * Graph tags. The image *paths* are not client code, so they live here and are
 * imported by both sides.
 */

/** Share/preview image per game, keyed by game id. */
export const GAME_IMAGES: Record<string, string> = {
  chess: "/games/chess-hero.jpg",
  uno: "/games/uno-hero.jpg",
  "uno-no-mercy": "/games/uno-no-mercy-hero.jpg",
  "car-race": "/games/car-race-hero.jpg",
  "bike-race": "/games/bike-race-hero.jpg",
  "rope-rescue": "/games/rope-rescue-thumb.jpg",
  "ant-attack": "/games/ant-attack-thumb.jpg",
  "bomb-pass": "/games/bomb-pass-thumb.jpg",
  "color-rush": "/games/color-rush-thumb.jpg",
  "falling-floor": "/games/falling-floor-thumb.jpg",
  "pin-puzzle": "/games/pin-puzzle-thumb.jpg",
  "target-rush": "/games/target-rush-thumb.jpg",
  "hot-potato": "/games/hot-potato-thumb.jpg",
  "bridge-builder": "/games/bridge-builder-thumb.jpg",
  "ice-breaker": "/games/ice-breaker-thumb.jpg",
  "tic-tac-toe": "/games/tic-tac-toe-thumb.svg",
  "connect-four": "/games/connect-four-thumb.svg",
  ludo: "/games/ludo-thumb.svg",
  "snake-ladder": "/games/snake-ladder-thumb.svg",
  checkers: "/games/checkers-thumb.svg",
  battleship: "/games/battleship-thumb.svg",
  "memory-match": "/games/memory-match-thumb.svg",
  "game-2048": "/games/game-2048-thumb.svg",
  minesweeper: "/games/minesweeper-thumb.svg",
  "word-guess": "/games/word-guess-thumb.svg",
  "flappy-bird": "/games/flappy-bird-thumb.svg",
  "retro-snake": "/games/retro-snake-thumb.svg",
  pong: "/games/pong-thumb.svg",
  "brick-breaker": "/games/brick-breaker-thumb.svg",
  "whack-a-mole": "/games/whack-a-mole-thumb.svg",
  "simon-says": "/games/simon-says-thumb.svg",
};

/** Falls back to the chess hero, which is the site's own cover image. */
export function imageForGame(gameId: string): string {
  return GAME_IMAGES[gameId] ?? GAME_IMAGES.chess!;
}
