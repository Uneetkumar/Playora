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
  {
    id: "rope-rescue",
    name: "Rope Rescue",
    category: "Physics",
    minPlayers: 1,
    maxPlayers: 4,
    duration: "2-5 min",
    description: "Draw tension physics ropes to guide trapped survivors safely past spinning hazard blades to the rescue zone.",
    tags: ["physics", "puzzle", "rope", "rescue", "strategy", "casual"],
    phase: "Available now",
    rules: [
      "Drag your finger or cursor to weave the rescue zip-line rope between anchor spools.",
      "Avoid spinning saw blades, laser beams, and explosive mines on the cliff face.",
      "Hold the RESCUE button to zip-line passengers down one by one.",
      "Rescue all survivors without losing too many to hazardous obstacles to earn 3 gold stars.",
    ],
  },
  {
    id: "ant-attack",
    name: "Ant Attack",
    category: "Action",
    minPlayers: 1,
    maxPlayers: 4,
    duration: "1-3 min",
    description: "Fast-paced arcade defense! Squash invading ant waves before they steal your picnic cakes.",
    tags: ["action", "arcade", "fast", "defense", "casual", "tap"],
    phase: "Available now",
    rules: [
      "Tap or click marching worker ants, armored beetles, and speedy fire ants to squash them.",
      "Defend the picnic sweets: every ant that reaches the dessert depletes your sugar health.",
      "Collect power-ups: Bug Spray sweeps the board, Sugar Bomb slows down time, and Magnifying Glass blasts a laser beam.",
      "Build high combo streaks for extra score and climb the global leaderboards.",
    ],
  },
  {
    id: "bomb-pass",
    name: "Bomb Pass",
    category: "Party",
    minPlayers: 2,
    maxPlayers: 8,
    duration: "2-4 min",
    description: "High-octane party elimination! Pass the ticking time bomb to rivals before the fuse runs out.",
    tags: ["party", "multiplayer", "bomb", "elimination", "action", "quick"],
    phase: "Available now",
    rules: [
      "One player starts with the sizzling ticking bomb in an enclosed arena.",
      "Dash and collide into opponent players or tap nearby rivals to pass the explosive device.",
      "When the countdown fuse reaches zero: BOOM! The holding player is eliminated.",
      "Survive all elimination rounds to be crowned the ultimate champion.",
    ],
  },
  {
    id: "color-rush",
    name: "Color Rush",
    category: "Casual",
    minPlayers: 1,
    maxPlayers: 6,
    duration: "1-3 min",
    description: "Lightning-fast reflex challenge! Rotate and match falling colored orbs with precision timing.",
    tags: ["casual", "reflex", "colors", "speed", "arcade", "rhythm"],
    phase: "Available now",
    rules: [
      "High-speed multi-colored energy orbs fall toward the central color prism wheel.",
      "Tap or rotate the matching quadrant (Cyan, Crimson, Emerald, Amber) before the orb impacts.",
      "Speed accelerates dynamically as your combo streak grows higher.",
      "Missing a color match ends your run — stay in flow state for record multiplier scores!",
    ],
  },
  {
    id: "falling-floor",
    name: "Falling Floor",
    category: "Action",
    minPlayers: 2,
    maxPlayers: 8,
    duration: "2-4 min",
    description: "Chaotic survival knockout! Run across multi-tiered crumbling hexagonal floors as the ground vanishes.",
    tags: ["action", "survival", "knockout", "multiplayer", "party", "hex"],
    phase: "Available now",
    rules: [
      "Run and jump across multi-layer floating hexagon grids.",
      "Hexagons flash red and vanish 0.6 seconds after you step on them!",
      "When a floor collapses beneath you, fall safely to the lower floor layers.",
      "Out-maneuver AI and rival players to be the last survivor on the final floor!",
    ],
  },
  {
    id: "pin-puzzle",
    name: "Pin Puzzle",
    category: "Puzzle",
    minPlayers: 1,
    maxPlayers: 2,
    duration: "2-5 min",
    description: "Classic physics logic! Pull locking pins in the right sequence to funnel treasure safely away from hazards.",
    tags: ["puzzle", "logic", "pins", "physics", "brain", "casual"],
    phase: "Available now",
    rules: [
      "Analyze the chamber containing gold coins, water, molten lava, and thieves.",
      "Click or slide pins to release liquid flows and physical objects.",
      "Extinguish lava with water to turn it into solid harmless rock.",
      "Funnel sparkling gold into the treasure chest to complete each level with 3 stars!",
    ],
  },
  {
    id: "target-rush",
    name: "Target Rush",
    category: "Action",
    minPlayers: 1,
    maxPlayers: 4,
    duration: "1-2 min",
    description: "Precision shooting range! Pop moving targets, bullseyes, and golden balloons before the 60s buzzer.",
    tags: ["action", "shooting", "aim", "targets", "fast", "precision"],
    phase: "Available now",
    rules: [
      "Click or tap pop-up wooden targets, bullseyes, and flying golden bonus balloons.",
      "Hitting the dead-center bullseye awards 3x critical bonus points.",
      "Avoid shooting red hazard skulls and TNT boxes which deduct score and break combo streaks.",
      "Chain rapid hits together within 60 seconds to set the top sharpshooter score!",
    ],
  },
  {
    id: "hot-potato",
    name: "Hot Potato",
    category: "Party",
    minPlayers: 2,
    maxPlayers: 8,
    duration: "2-4 min",
    description: "The classic sizzling party pass! Toss the scalding spud around the circle before the timer blows.",
    tags: ["party", "casual", "multiplayer", "potato", "family", "fun"],
    phase: "Available now",
    rules: [
      "Players sit in a rapid circle passing a sizzling flaming potato.",
      "Tap the Pass button quickly to pitch the potato to the next player clockwise or counter-clockwise.",
      "Music tempo speeds up unpredictably as the hidden blast timer ticks down.",
      "Do not get caught holding the potato when the buzzer sounds!",
    ],
  },
  {
    id: "bridge-builder",
    name: "Bridge Builder",
    category: "Physics",
    minPlayers: 1,
    maxPlayers: 2,
    duration: "3-6 min",
    description: "Structural engineering sandbox! Construct sturdy bridges from wood, steel, and cables to support heavy cargo.",
    tags: ["physics", "engineering", "building", "puzzle", "sandbox", "strategy"],
    phase: "Available now",
    rules: [
      "Draw structural trusses and bridge deck segments between cliffside anchor joints.",
      "Manage your construction budget using combinations of wood beams, reinforced steel, and suspension cables.",
      "Press the TEST SIMULATION button to drive heavy cargo trucks across.",
      "Monitor real-time strain: green is stable, yellow is heavy load, red snaps under tension!",
    ],
  },
  {
    id: "ice-breaker",
    name: "Ice Breaker",
    category: "Action",
    minPlayers: 2,
    maxPlayers: 8,
    duration: "2-4 min",
    description: "Arctic bumper arena! Ram rivals off the cracking iceberg into freezing ocean waters.",
    tags: ["action", "multiplayer", "survival", "ice", "bumpers", "knockout"],
    phase: "Available now",
    rules: [
      "Pilot your motorized arctic snow-bumper on a floating ice floe.",
      "Ram into opponent vehicles with speed bursts to push them toward the perimeter.",
      "The iceberg constantly cracks and shrinks from ocean waves over time.",
      "Knock all rivals into the freezing sea to claim victory!",
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
