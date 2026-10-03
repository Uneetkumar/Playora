import type { CSSProperties } from "react";
import type { GameId } from "@playora/game-types";

/**
 * Presentation metadata per game: the data a card, rail, hero or detail page
 * needs that the rules-facing catalog does not carry.
 *
 * Kept beside `GAME_CATALOG` rather than inside it so the catalog stays the
 * description of the game and this stays the description of how the platform
 * shows it. It is a `Record<GameId, …>` so a new game id fails the type check
 * until it has an entry, and the tests hold it to the catalog as well.
 *
 * Plain data with no React and no browser APIs: the server reads it for Open
 * Graph tags and the client reads it for cards, from the same module.
 */

/**
 * The browse genres, in the order chips and rails show them.
 *
 * Deliberately a small closed set. The catalog's free-text `category` grew to
 * eleven values (Physics, Casual, Action…) that each held one or two games,
 * which is too thin for a rail and too fine for a chip. `category` stays for
 * the code that already reads it.
 */
export const GAME_GENRES = [
  "Racing",
  "Cards",
  "Board",
  "Strategy",
  "Party",
  "Arcade",
  "Puzzle",
  "Classic",
] as const;

export type GameGenre = (typeof GAME_GENRES)[number];

export function isGameGenre(value: unknown): value is GameGenre {
  return typeof value === "string" && (GAME_GENRES as readonly string[]).includes(value);
}

/**
 * Cover art, by shape.
 *
 * Every game has a landscape cover today; the portrait (2:3) and square (1:1)
 * crops are not drawn yet, so a component asking for one must fall back to
 * `landscape` rather than assume it.
 */
export interface GameCovers {
  landscape: string;
  portrait?: string;
  square?: string;
}

export interface GameMeta {
  /**
   * The game's identity colour, as `#RRGGBB`. Components set it as the
   * `--game-accent` CSS variable (see `gameAccentStyle`) rather than reading
   * the hex directly, so one rule styles every game.
   */
  accent: string;
  genre: GameGenre;
  /** ISO date (YYYY-MM-DD) the game's view first shipped. Drives NEW. */
  releasedAt: string;
  /** ISO date (YYYY-MM-DD) of the last change to the game itself. Drives UPDATED. */
  updatedAt: string;
  /** In the hero rotation. Derived from `FEATURED_GAME_IDS`, which also sets the order. */
  featured: boolean;
  /** One short line for the hero and the detail header. Never more than a sentence. */
  heroTagline: string;
  covers: GameCovers;
}

/**
 * The hero rotation, in the order it plays.
 *
 * A list rather than a flag on each entry because the order is the editorial
 * decision; `GameMeta.featured` is derived from membership here so the two
 * cannot disagree.
 */
export const FEATURED_GAME_IDS: readonly GameId[] = [
  "car-race",
  "bike-race",
  "uno",
  "uno-no-mercy",
  "chess",
  "bridge-builder",
];

/*
 * Dates come from git, not from memory:
 *
 *   releasedAt  git log --diff-filter=A --format=%ad --date=short -- <view file>
 *   updatedAt   git log -1 --format=%ad --date=short -- <view file> <its engine/folder>
 *
 * The UNO views share one component, so No Mercy is dated by its engine
 * (UnoNoMercyEngine.ts) and the racing pair by theirs. Arcade and board games
 * share a folder, so they are dated by their own view and engine files only:
 * dating them by the folder would mark all of them UPDATED whenever any one
 * changes.
 *
 * Accents are the leading colour of the gradient each game's card already
 * used, so a game keeps the colour people recognise it by.
 */
const ENTRIES: Record<GameId, Omit<GameMeta, "featured">> = {
  chess: {
    accent: "#7C3AED",
    genre: "Strategy",
    releasedAt: "2026-08-29",
    updatedAt: "2026-09-01",
    heroTagline: "Every move checked. Every second counts.",
    covers: { landscape: "/games/chess-hero.jpg" },
  },
  uno: {
    accent: "#EF4444",
    genre: "Cards",
    releasedAt: "2026-08-29",
    updatedAt: "2026-10-03",
    heroTagline: "Match the colour. Call UNO. Go out first.",
    covers: { landscape: "/games/uno-hero.jpg" },
  },
  "uno-no-mercy": {
    accent: "#F97316",
    genre: "Cards",
    releasedAt: "2026-08-30",
    updatedAt: "2026-10-03",
    heroTagline: "Stack the draws. Survive the pile.",
    covers: { landscape: "/games/uno-no-mercy-hero.jpg" },
  },
  "car-race": {
    accent: "#06B6D4",
    genre: "Racing",
    releasedAt: "2026-08-30",
    updatedAt: "2026-10-03",
    heroTagline: "Neon circuits. Two nitros. Spend them well.",
    covers: { landscape: "/games/car-race-hero.jpg" },
  },
  "bike-race": {
    accent: "#10B981",
    genre: "Racing",
    releasedAt: "2026-08-30",
    updatedAt: "2026-10-03",
    heroTagline: "Half the width. Twice the nerve.",
    covers: { landscape: "/games/bike-race-hero.jpg" },
  },
  "rope-rescue": {
    accent: "#8B5CF6",
    genre: "Puzzle",
    releasedAt: "2026-09-01",
    updatedAt: "2026-10-03",
    heroTagline: "Draw the line between them and the blades.",
    covers: { landscape: "/games/rope-rescue-thumb.jpg" },
  },
  "ant-attack": {
    accent: "#EF4444",
    genre: "Arcade",
    releasedAt: "2026-09-01",
    updatedAt: "2026-10-03",
    heroTagline: "Squash the swarm before it reaches the cake.",
    covers: { landscape: "/games/ant-attack-thumb.jpg" },
  },
  "bomb-pass": {
    accent: "#F97316",
    genre: "Party",
    releasedAt: "2026-09-01",
    updatedAt: "2026-10-03",
    heroTagline: "Pass it on before it goes off.",
    covers: { landscape: "/games/bomb-pass-thumb.jpg" },
  },
  "color-rush": {
    accent: "#EC4899",
    genre: "Arcade",
    releasedAt: "2026-09-01",
    updatedAt: "2026-10-03",
    heroTagline: "Match the colour before it lands.",
    covers: { landscape: "/games/color-rush-thumb.jpg" },
  },
  "falling-floor": {
    accent: "#F59E0B",
    genre: "Party",
    releasedAt: "2026-09-01",
    updatedAt: "2026-10-03",
    heroTagline: "The floor is leaving. Keep moving.",
    covers: { landscape: "/games/falling-floor-thumb.jpg" },
  },
  "pin-puzzle": {
    accent: "#3B82F6",
    genre: "Puzzle",
    releasedAt: "2026-09-01",
    updatedAt: "2026-10-03",
    heroTagline: "Pull the right pin. Save the gold.",
    covers: { landscape: "/games/pin-puzzle-thumb.jpg" },
  },
  "target-rush": {
    accent: "#14B8A6",
    genre: "Arcade",
    releasedAt: "2026-09-01",
    updatedAt: "2026-10-03",
    heroTagline: "Sixty seconds. Bullseyes count triple.",
    covers: { landscape: "/games/target-rush-thumb.jpg" },
  },
  "hot-potato": {
    accent: "#EA580C",
    genre: "Party",
    releasedAt: "2026-09-01",
    updatedAt: "2026-10-03",
    heroTagline: "Don't be holding it when it blows.",
    covers: { landscape: "/games/hot-potato-thumb.jpg" },
  },
  "bridge-builder": {
    accent: "#6366F1",
    genre: "Puzzle",
    releasedAt: "2026-09-01",
    updatedAt: "2026-10-03",
    heroTagline: "Design the bridge. Let physics judge it.",
    covers: { landscape: "/games/bridge-builder-thumb.jpg" },
  },
  "ice-breaker": {
    accent: "#06B6D4",
    genre: "Party",
    releasedAt: "2026-09-01",
    updatedAt: "2026-10-03",
    heroTagline: "Last one on the ice wins.",
    covers: { landscape: "/games/ice-breaker-thumb.jpg" },
  },
  "tic-tac-toe": {
    accent: "#3B82F6",
    genre: "Classic",
    releasedAt: "2026-10-03",
    updatedAt: "2026-10-03",
    heroTagline: "Nine squares. Three in a row.",
    covers: { landscape: "/games/tic-tac-toe-thumb.svg" },
  },
  "connect-four": {
    accent: "#EAB308",
    genre: "Board",
    releasedAt: "2026-10-03",
    updatedAt: "2026-10-03",
    heroTagline: "Drop, block, connect four.",
    covers: { landscape: "/games/connect-four-thumb.svg" },
  },
  ludo: {
    accent: "#10B981",
    genre: "Board",
    releasedAt: "2026-10-03",
    updatedAt: "2026-10-03",
    heroTagline: "Roll a six. Send them home.",
    covers: { landscape: "/games/ludo-thumb.svg" },
  },
  "snake-ladder": {
    accent: "#8B5CF6",
    genre: "Board",
    releasedAt: "2026-10-03",
    updatedAt: "2026-10-03",
    heroTagline: "Climb the ladders. Dodge the snakes.",
    covers: { landscape: "/games/snake-ladder-thumb.svg" },
  },
  checkers: {
    accent: "#EF4444",
    genre: "Strategy",
    releasedAt: "2026-10-03",
    updatedAt: "2026-10-03",
    heroTagline: "Jump, chain, crown your king.",
    covers: { landscape: "/games/checkers-thumb.svg" },
  },
  battleship: {
    accent: "#0284C7",
    genre: "Strategy",
    releasedAt: "2026-10-03",
    updatedAt: "2026-10-03",
    heroTagline: "Call the shot. Sink the fleet.",
    covers: { landscape: "/games/battleship-thumb.svg" },
  },
  "memory-match": {
    accent: "#EC4899",
    genre: "Cards",
    releasedAt: "2026-10-03",
    updatedAt: "2026-10-03",
    heroTagline: "Remember where it was. Find its twin.",
    covers: { landscape: "/games/memory-match-thumb.svg" },
  },
  "game-2048": {
    accent: "#F59E0B",
    genre: "Puzzle",
    releasedAt: "2026-10-03",
    updatedAt: "2026-10-03",
    heroTagline: "Slide, merge, reach 2048.",
    covers: { landscape: "/games/game-2048-thumb.svg" },
  },
  minesweeper: {
    accent: "#64748B",
    genre: "Classic",
    releasedAt: "2026-10-03",
    updatedAt: "2026-10-03",
    heroTagline: "Read the numbers. Flag the mines.",
    covers: { landscape: "/games/minesweeper-thumb.svg" },
  },
  "word-guess": {
    accent: "#10B981",
    genre: "Puzzle",
    releasedAt: "2026-10-03",
    updatedAt: "2026-10-03",
    heroTagline: "Five letters. Six tries.",
    covers: { landscape: "/games/word-guess-thumb.svg" },
  },
  "flappy-bird": {
    accent: "#FBBF24",
    genre: "Arcade",
    releasedAt: "2026-10-03",
    updatedAt: "2026-10-03",
    heroTagline: "Tap to fly. Thread the gap.",
    covers: { landscape: "/games/flappy-bird-thumb.svg" },
  },
  "retro-snake": {
    accent: "#22C55E",
    genre: "Classic",
    releasedAt: "2026-10-03",
    updatedAt: "2026-10-03",
    heroTagline: "Eat, grow, never bite your tail.",
    covers: { landscape: "/games/retro-snake-thumb.svg" },
  },
  pong: {
    accent: "#06B6D4",
    genre: "Classic",
    releasedAt: "2026-10-03",
    updatedAt: "2026-10-03",
    heroTagline: "First to seven. Mind the spin.",
    covers: { landscape: "/games/pong-thumb.svg" },
  },
  "brick-breaker": {
    accent: "#F43F5E",
    genre: "Classic",
    releasedAt: "2026-10-03",
    updatedAt: "2026-10-03",
    heroTagline: "Break every brick. Keep the ball alive.",
    covers: { landscape: "/games/brick-breaker-thumb.svg" },
  },
  "whack-a-mole": {
    accent: "#A855F7",
    genre: "Arcade",
    releasedAt: "2026-10-03",
    updatedAt: "2026-10-03",
    heroTagline: "Hit the gold. Miss the TNT.",
    covers: { landscape: "/games/whack-a-mole-thumb.svg" },
  },
  "simon-says": {
    accent: "#3B82F6",
    genre: "Puzzle",
    releasedAt: "2026-10-03",
    updatedAt: "2026-10-03",
    heroTagline: "Watch. Listen. Repeat. One step longer.",
    covers: { landscape: "/games/simon-says-thumb.svg" },
  },
};

const FEATURED = new Set<GameId>(FEATURED_GAME_IDS);

export const GAME_META: Readonly<Record<GameId, GameMeta>> = Object.fromEntries(
  (Object.entries(ENTRIES) as [GameId, Omit<GameMeta, "featured">][]).map(([id, meta]) => [
    id,
    { ...meta, featured: FEATURED.has(id) },
  ]),
) as Record<GameId, GameMeta>;

export function gameMeta(id: GameId): GameMeta {
  return GAME_META[id];
}

/**
 * The accent as the CSS variable every component reads it through:
 * `style={gameAccentStyle(id)}`, then `var(--game-accent)` in classes.
 *
 * The cast is only because React's style type has no slot for custom
 * properties.
 */
export function gameAccentStyle(id: GameId): CSSProperties {
  return { "--game-accent": GAME_META[id].accent } as CSSProperties;
}
