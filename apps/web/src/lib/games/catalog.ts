import type { GameId } from "@playora/game-types";
import { isGameImplemented } from "../play/modes";
import { GAME_META } from "./meta";

export interface CatalogGame {
  id: GameId;
  name: string;
  /**
   * The original free-text category, kept for the pages and SEO tags that
   * still read it. Browsing groups by `GAME_META[id].genre` instead.
   */
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
      "On a phone or tablet, use the on-screen controls: hold the green pedal at the bottom right to accelerate (the one beside it brakes), and the arrows at the bottom left to steer.",
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
      "Same controls as Car Race: W to accelerate, A and D to steer, S to brake, N for nitro; on a phone or tablet, the same on-screen pedals and arrows.",
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
    description: "Structural engineering puzzles across 8 levels. Build from road, wood, steel and cable, then watch real truss physics decide if it holds.",
    tags: ["physics", "engineering", "building", "puzzle", "sandbox", "strategy"],
    phase: "Available now",
    rules: [
      "Drag from an orange anchor or a joint to build. Tap a joint, then tap, tap, tap to lay a chain of beams.",
      "Only Road can be driven on. Wood is cheap but buckles when long, steel is strong both ways, cables only pull.",
      "Press Test to send the vehicle across. Members glow green to red with stress and snap past 100%.",
      "Earn stars for crossing, staying under the target budget, and keeping peak stress low. Stars unlock the next level.",
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
  {
    id: "tic-tac-toe",
    name: "Tic-Tac-Toe",
    category: "Board",
    minPlayers: 2,
    maxPlayers: 2,
    duration: "1-3 min",
    description: "The timeless 3x3 strategy duel with neon aesthetics and smart AI.",
    tags: ["board", "classic", "quick", "strategy", "two player", "puzzle"],
    phase: "Available now",
    rules: [
      "Players alternate placing X and O marks in empty squares on a 3x3 grid.",
      "The first player to align three matching marks horizontally, vertically, or diagonally wins.",
      "If all nine squares are filled without three in a row, the match ends in a draw.",
      "Play against adaptive AI difficulty levels or challenge a friend in Pass & Play.",
    ],
  },
  {
    id: "connect-four",
    name: "Connect Four",
    category: "Board",
    minPlayers: 2,
    maxPlayers: 2,
    duration: "3-8 min",
    description: "Drop colorful discs into the vertical grid and connect four in a row to win!",
    tags: ["board", "strategy", "gravity", "connect", "family", "two player"],
    phase: "Available now",
    rules: [
      "Players take turns dropping colored discs into one of the 7 columns.",
      "Discs fall straight down under gravity, occupying the lowest available row.",
      "First player to connect 4 of their discs horizontally, vertically, or diagonally wins.",
      "Block your opponent's lines while constructing multiple simultaneous threats.",
    ],
  },
  {
    id: "ludo",
    name: "Ludo",
    category: "Board",
    minPlayers: 2,
    maxPlayers: 4,
    duration: "10-25 min",
    description: "Roll the dice, race tokens from yard to home, and knock opponents back to base!",
    tags: ["board", "dice", "family", "party", "classic", "multiplayer"],
    phase: "Available now",
    rules: [
      "Each player commands 4 tokens of their color (Red, Green, Yellow, Blue).",
      "Roll a 6 to bring a token out of your starting yard onto the track and earn an extra roll.",
      "Move tokens clockwise around the circuit according to your dice roll.",
      "Landing on an opponent's token captures it, sending it back to their yard.",
      "Squares marked with stars are safe zones where tokens cannot be captured.",
      "Navigate all 4 tokens into your home triangle in the center to win!",
    ],
  },
  {
    id: "snake-ladder",
    name: "Snakes & Ladders",
    category: "Board",
    minPlayers: 2,
    maxPlayers: 4,
    duration: "5-15 min",
    description: "Roll the dice, scale glorious ladders to surge ahead, and dodge treacherous snakes!",
    tags: ["board", "dice", "snakes", "ladders", "family", "casual"],
    phase: "Available now",
    rules: [
      "Players race from square 1 to square 100 on the numbered board.",
      "Roll the 3D dice on your turn and advance your pawn forward.",
      "Landing at the bottom of a ladder instantly ascends you to its top rung.",
      "Landing on a snake's head slides you all the way down to its tail.",
      "Rolling a 6 grants a bonus turn. First player to reach square 100 wins!",
    ],
  },
  {
    id: "checkers",
    name: "Checkers",
    category: "Board",
    minPlayers: 2,
    maxPlayers: 2,
    duration: "5-15 min",
    description: "Classic diagonal draughts with mandatory captures, multi-jumps, and king promotions.",
    tags: ["board", "draughts", "strategy", "classic", "two player"],
    phase: "Available now",
    rules: [
      "Pieces move diagonally forward one square at a time onto dark squares.",
      "Capture opposing pieces by jumping over them into an empty square beyond.",
      "Multi-jump captures can chain across several pieces in a single turn.",
      "Reaching the opponent's back rank crowns your piece into a King, enabling backward moves.",
      "Win by capturing all opponent pieces or blocking them from making legal moves.",
    ],
  },
  {
    id: "battleship",
    name: "Battleship",
    category: "Board",
    minPlayers: 2,
    maxPlayers: 2,
    duration: "5-15 min",
    description: "Command naval fleets on radar grids. Target grid coordinates and sink enemy vessels!",
    tags: ["board", "naval", "strategy", "war", "radar", "two player"],
    phase: "Available now",
    rules: [
      "Deploy 5 naval ships of varying lengths across your 10x10 oceanic grid.",
      "Call out radar coordinates on the enemy grid to fire torpedoes.",
      "Direct hits ignite fiery detonations; misses trigger ocean water splashes.",
      "Successfully striking all segments of a vessel sinks it.",
      "Sink the entire enemy armada before yours is destroyed to claim naval dominance.",
    ],
  },
  {
    id: "memory-match",
    name: "Memory Match",
    category: "Puzzle",
    minPlayers: 1,
    maxPlayers: 2,
    duration: "2-5 min",
    description: "Flip cards, memorize hidden symbols, and pair identical cards with speed and combos!",
    tags: ["puzzle", "memory", "cards", "casual", "family", "brain"],
    phase: "Available now",
    rules: [
      "A grid of face-down cards conceals matching pairs of high-tech game emblems.",
      "Flip two cards per turn. If they match, they stay revealed and score points.",
      "Consecutive matches build your combo multiplier for massive score bonuses.",
      "If cards don't match, memorize their positions as they flip back over.",
      "Clear the entire board in the fewest moves or shortest time!",
    ],
  },
  {
    id: "game-2048",
    name: "2048",
    category: "Puzzle",
    minPlayers: 1,
    maxPlayers: 1,
    duration: "3-10 min",
    description: "Slide and merge matching numbered tiles to build the legendary 2048 block!",
    tags: ["puzzle", "numbers", "sliding", "casual", "brain", "math"],
    phase: "Available now",
    rules: [
      "Use arrow keys, WASD, or swipe gestures to slide all tiles across the 4x4 board.",
      "When two tiles with identical numbers collide, they merge into one with double value.",
      "A fresh 2 or 4 tile spawns in a random vacant space after each slide.",
      "Merge up to the golden 2048 tile to achieve victory, then keep going for high scores!",
      "The game ends when the board fills and no valid moves remain.",
    ],
  },
  {
    id: "minesweeper",
    name: "Minesweeper",
    category: "Puzzle",
    minPlayers: 1,
    maxPlayers: 1,
    duration: "2-8 min",
    description: "Classic grid deduction! Uncover safe tiles using numbered clues and flag concealed mines.",
    tags: ["puzzle", "logic", "classic", "mines", "deduction", "retro"],
    phase: "Available now",
    rules: [
      "Click tiles to reveal what lies beneath. Your very first click is guaranteed safe!",
      "Numbered tiles declare exactly how many mines border that cell in the 8 adjacent directions.",
      "Right-click or toggle Flag mode to mark cells suspected of containing mines.",
      "Revealing a blank cell triggers a cascading flood-fill to open safe terrain.",
      "Clear all non-mine cells on the field without detonating a single explosive to win!",
    ],
  },
  {
    id: "word-guess",
    name: "Word Guess",
    category: "Puzzle",
    minPlayers: 1,
    maxPlayers: 1,
    duration: "2-5 min",
    description: "Guess the hidden 5-letter word in six attempts with dynamic color feedback!",
    tags: ["puzzle", "word", "letters", "brain", "vocabulary", "daily"],
    phase: "Available now",
    rules: [
      "You have six attempts to guess the secret five-letter target word.",
      "Each guess must be a valid English word submitted via keyboard or onscreen keys.",
      "Green tiles signify the letter is correct and in the exact position.",
      "Yellow tiles show the letter exists in the word but belongs in another spot.",
      "Gray tiles confirm the letter does not appear anywhere in the secret word.",
    ],
  },
  {
    id: "flappy-bird",
    name: "Cyber Bird",
    category: "Action",
    minPlayers: 1,
    maxPlayers: 1,
    duration: "1-3 min",
    description: "Tap or press Space to flap wings, navigate tight neon pipe gates, and beat high scores!",
    tags: ["action", "arcade", "flappy", "reflex", "endless", "retro"],
    phase: "Available now",
    rules: [
      "Press Space, click, or tap the screen to give your cyber bird an upward wing flap.",
      "Gravity pulls you downward continuously toward the bottom boundary.",
      "Thread your way through narrow gaps between scrolling neon pipe columns.",
      "Each successfully passed pipe gate earns 1 point.",
      "Colliding with any pipe or the arena floor immediately ends your run.",
    ],
  },
  {
    id: "retro-snake",
    name: "Retro Snake",
    category: "Arcade",
    minPlayers: 1,
    maxPlayers: 1,
    duration: "2-6 min",
    description: "Guide the neon cyber serpent, gobble glowing energy pellets, and grow without crashing!",
    tags: ["arcade", "retro", "classic", "snake", "reflex", "neon"],
    phase: "Available now",
    rules: [
      "Guide the snake using Arrow keys, WASD, or onscreen touch controls.",
      "Eat pulsing energy pellets to increase your score and extend your body length.",
      "Your movement speed escalates as you consume more pellets.",
      "Colliding with the perimeter walls or your own tail instantly crashes your serpent.",
      "Plan sharp turning maneuvers to maximize your length across the grid.",
    ],
  },
  {
    id: "pong",
    name: "Cyber Pong",
    category: "Arcade",
    minPlayers: 1,
    maxPlayers: 2,
    duration: "2-5 min",
    description: "High-octane paddle rallies with angular deflections, trail sparks, and neon lasers!",
    tags: ["arcade", "sports", "classic", "pong", "two player", "reflex"],
    phase: "Available now",
    rules: [
      "Control your vertical paddle to deflect the cyber sphere back across the arena.",
      "Striking the ball near the edges of your paddle applies dynamic spin deflection.",
      "Ball velocity accelerates with each consecutive paddle rebound.",
      "Score a point whenever the opponent misses and the ball passes their baseline.",
      "First player to score 7 points wins the championship match!",
    ],
  },
  {
    id: "brick-breaker",
    name: "Brick Breaker",
    category: "Arcade",
    minPlayers: 1,
    maxPlayers: 1,
    duration: "2-6 min",
    description: "Demolish matrices of vibrant digital bricks, catch falling power-ups, and keep the ball live!",
    tags: ["arcade", "breakout", "action", "physics", "retro", "powerups"],
    phase: "Available now",
    rules: [
      "Slide your paddle horizontally to bounce the ball up into the brick fortress.",
      "Bricks shatter on impact, awarding points and occasionally releasing power-ups.",
      "Collect laser cannons, paddle width expansions, and multi-ball power capsules.",
      "Keep the ball off the bottom gutter. Clear all breakable bricks to complete the stage!",
    ],
  },
  {
    id: "whack-a-mole",
    name: "Cyber Whack",
    category: "Action",
    minPlayers: 1,
    maxPlayers: 1,
    duration: "1-2 min",
    description: "Rapid-fire arcade reflex! Smash popping cyber-moles, nail golden targets, and avoid TNT!",
    tags: ["action", "arcade", "reflex", "tapping", "speed", "casual"],
    phase: "Available now",
    rules: [
      "Cyber-moles surface rapidly from a 3x3 matrix of glowing underground portals.",
      "Tap or click emerging moles before they retreat to score points and build combos.",
      "Gold cyber-moles reward triple points; TNT bomb drones destroy your combo streak!",
      "Reaction windows compress as the frenzy escalates over the 60-second timer.",
      "Achieve lightning-fast reaction streaks to top the leaderboard!",
    ],
  },
  {
    id: "simon-says",
    name: "Simon Sequence",
    category: "Puzzle",
    minPlayers: 1,
    maxPlayers: 1,
    duration: "2-5 min",
    description: "Watch the hypnotic light pattern, listen to synthesized tones, and repeat the sequence!",
    tags: ["puzzle", "memory", "audio", "sequence", "simon", "brain"],
    phase: "Available now",
    rules: [
      "Four illuminated color pads (Green, Red, Blue, Yellow) produce unique audio tones.",
      "Simon plays an initial sequence of flashes and synthesizer notes.",
      "Repeat the exact sequence by pressing the corresponding colored quadrants.",
      "Each successful round adds one additional step to the sequence.",
      "A single mistake terminates your run. How deep into the sequence can you reach?",
    ],
  },
] as const;

export function isPlayable(game: CatalogGame): boolean {
  return isGameImplemented(game.id);
}

const BY_ID: ReadonlyMap<GameId, CatalogGame> = new Map(GAME_CATALOG.map((g) => [g.id, g]));

export function getCatalogGame(id: GameId): CatalogGame | undefined {
  return BY_ID.get(id);
}

/** Narrows a route param or query value to a game the catalog knows. */
export function isGameId(value: unknown): value is GameId {
  return typeof value === "string" && BY_ID.has(value as GameId);
}

/**
 * Ranked search over the catalog.
 *
 * Playable games win ties, so a search never leads with something you cannot
 * actually start. The browse genre counts as much as the older category, so
 * searching "party" finds everything the Party chip shows.
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
    else if (
      game.category.toLowerCase().includes(q) ||
      GAME_META[game.id].genre.toLowerCase().includes(q)
    )
      score = 40;
    else if (game.tags.some((t) => t.includes(q))) score = 30;
    else if (game.description.toLowerCase().includes(q)) score = 10;

    return { game, score };
  }).filter((r) => r.score > 0);

  return scored
    .sort((a, b) => b.score - a.score || Number(isPlayable(b.game)) - Number(isPlayable(a.game)))
    .map((r) => r.game);
}
