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
  /**
   * How the game is actually played, in the order a new player needs it.
   *
   * Written against the rules the engine enforces, not against the boxed
   * rulebook — where Playora differs from the printed game, this is what is
   * true here.
   */
  rules: string[];
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
    rules: [
      "White moves first, then players alternate.",
      "Each piece moves its own way: rooks in straight lines, bishops diagonally, the queen either, knights in an L over other pieces, the king one square at a time.",
      "You may never leave your own king in check. Moves that would are rejected by the server, not just hidden by the board.",
      "Checkmate wins. Stalemate, insufficient material, threefold repetition and the fifty-move rule are draws.",
      "Castling, en passant and promotion all work; promotion asks which piece unless you have turned on auto-queen in settings.",
    ],
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
    rules: [
      "Everyone is dealt seven cards. Play a card matching the colour or the number on the pile.",
      "Wilds can be played at any time and let you name the next colour.",
      "Skip misses the next player, Reverse turns the direction around, Draw Two makes the next player take two and lose their turn.",
      "If you cannot play, draw one card. You may play that card immediately or pass.",
      "Say UNO as you play your second-to-last card. First player out of cards wins the hand.",
    ],
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
    rules: [
      "The same core as UNO, played from a 168-card deck, and far more violent.",
      "Draw penalties stack: a Draw Two onto a Draw Two, a Draw Four onto that. Whoever cannot add a draw card takes the whole pile.",
      "Bigger draws exist — Draw Six and Draw Ten — alongside Wild Reverse Draw Four and Colour Roulette.",
      "A 0 passes every hand around the table. A 7 is a swap. Discard All sheds every card you hold of the active colour.",
      "Skip Everyone returns the turn straight back to you.",
      "Reach 25 cards in hand and you are out of the game. Last player standing wins if nobody goes out first.",
    ],
  },
  {
    id: "car-race",
    name: "Car Race",
    category: "Racing",
    minPlayers: 1,
    maxPlayers: 8,
    duration: "2-4 min",
    description: "3D neon-city racing with nitro boosts, coins and AI rivals.",
    tags: ["racing", "arcade", "cars", "speed", "action", "3d", "nitro"],
    phase: "Available now",
    rules: [
      "Hold W or the mouse button to accelerate, S to brake.",
      "Steer with A and D, or by moving the mouse across the track.",
      "Corners throw you towards the outside, harder the faster you are going. Lift off for the tight ones.",
      "Leaving the tarmac costs you speed, and hitting a cone or barrier costs you far more.",
      "Collect coins along the way — they decide the score when places are level.",
      "Nitro gives a short burst above your top speed. You get two, so spend them on the straights.",
    ],
  },
  {
    id: "bike-race",
    name: "Bike Race",
    category: "Racing",
    minPlayers: 1,
    maxPlayers: 8,
    duration: "2-4 min",
    description: "The same neon circuits on two wheels: quicker, twitchier, less forgiving.",
    tags: ["racing", "bikes", "stunts", "physics", "action", "3d"],
    phase: "Available now",
    rules: [
      "Same controls as Car Race: W to accelerate, A and D to steer, S to brake, N for nitro.",
      "A bike out-accelerates a car and changes direction faster.",
      "It is also thrown further by a corner and takes much longer to recover from a hit.",
      "Half the width of a car, so gaps a car has to avoid are open to you.",
      "Touching the wall costs far more than it does in a car — there is no bodywork to scrape.",
    ],
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
