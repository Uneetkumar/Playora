import type { GameId } from "@playora/game-types";
import { isGameImplemented } from "../play/modes";

export interface CatalogGame {
  id: GameId;
  name: string;
  category: string;
  minPlayers: number;
  maxPlayers: number;
  duration: string;
  description: string;
  /** Keywords the search should match beyond the name. */
  tags: string[];
  /** Phase this game is scheduled for, shown when it isn't playable yet. */
  phase: string;
}

/**
 * The game catalog, in one place.
 *
 * Home, the games page and search all read from here. It was previously
 * duplicated across pages, which is exactly how a search index drifts from the
 * thing it is meant to search.
 *
 * Whether a game can actually be played is never stored here — it is derived
 * from the engine registry via `isGameImplemented`.
 */
export const GAME_CATALOG: readonly CatalogGame[] = [
  {
    id: "chess",
    name: "Chess",
    category: "Strategy",
    minPlayers: 2,
    maxPlayers: 2,
    duration: "10-30 min",
    description:
      "Classic two-player strategy with real-time clocks and full move validation.",
    tags: ["board", "strategy", "classic", "checkmate", "two player"],
    phase: "Available now",
  },
  {
    id: "uno",
    name: "UNO",
    category: "Cards",
    minPlayers: 2,
    maxPlayers: 4,
    duration: "5-15 min",
    description: "Fast colour-and-number matching for two to four players.",
    tags: ["cards", "party", "casual", "family", "matching"],
    phase: "Available now",
  },
  {
    id: "uno-no-mercy",
    name: "UNO No Mercy",
    category: "Cards",
    minPlayers: 2,
    maxPlayers: 6,
    duration: "10-20 min",
    description: "Brutal UNO with stacking penalties, wild roulette and knockouts.",
    tags: ["cards", "party", "hardcore", "stacking"],
    phase: "Available now",
  },
  {
    id: "car-race",
    name: "Car Race",
    category: "Racing",
    minPlayers: 2,
    maxPlayers: 8,
    duration: "3-8 min",
    description: "Top-down arcade racing with drifting and nitro boosts.",
    tags: ["racing", "arcade", "cars", "speed", "action"],
    phase: "Coming in Phase 12",
  },
  {
    id: "bike-race",
    name: "Bike Race",
    category: "Racing",
    minPlayers: 2,
    maxPlayers: 8,
    duration: "3-8 min",
    description: "Balance and stunt motorcycle racing across obstacle tracks.",
    tags: ["racing", "bikes", "stunts", "physics", "action"],
    phase: "Coming in Phase 13",
  },
] as const;

export function isPlayable(game: CatalogGame): boolean {
  return isGameImplemented(game.id);
}

/**
 * Ranked search over the catalog.
 *
 * Playable games win ties, so a search never leads with something you cannot
 * actually start.
 */
export function searchGames(query: string): CatalogGame[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const scored = GAME_CATALOG.map((game) => {
    const name = game.name.toLowerCase();
    let score = 0;

    if (name === q) score = 100;
    else if (name.startsWith(q)) score = 80;
    else if (name.includes(q)) score = 60;
    else if (game.category.toLowerCase().includes(q)) score = 40;
    else if (game.tags.some((t) => t.includes(q))) score = 30;
    else if (game.description.toLowerCase().includes(q)) score = 10;

    return { game, score };
  }).filter((r) => r.score > 0);

  return scored
    .sort((a, b) => b.score - a.score || Number(isPlayable(b.game)) - Number(isPlayable(a.game)))
    .map((r) => r.game);
}
