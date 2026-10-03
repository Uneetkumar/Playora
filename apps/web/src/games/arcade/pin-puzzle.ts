/**
 * Pin Puzzle levels.
 *
 * The game shipped as a single puzzle: pull pin 1 to drop water on the lava,
 * then pin 2 to release the gold. Pin 3 did nothing at all, and the `level`
 * state was never advanced. Once you had solved it — a two-step sequence with
 * one right answer — there was nothing else in the game.
 *
 * The first replacement generated levels as a chain, where each pin required
 * the one before it. That was worse than it looked: a strict chain has exactly
 * one safe pin at any moment, and the requirement was never drawn, so from the
 * third level on the player was guessing between identical-looking pins with
 * instant death for a wrong guess. Drawing the requirement would have solved
 * the puzzle for them; hiding it made it a coin flip. A chain cannot be a good
 * puzzle either way.
 *
 * So the order is not the puzzle any more. Three rules are, and all of the
 * state they act on is on screen:
 *
 *   - WATER cools the lava.
 *   - ROCK also cools it, but only while it is hot — dropped on cool lava it
 *     is wasted.
 *   - GOLD dropped on hot lava melts and the run is over. Dropped on cool
 *     lava it is banked — and opening the vault lets the heat back in, so the
 *     lava goes hot again.
 *
 * That makes a level a counting problem rather than a memory one: you can see
 * how many coolants you hold and how many golds you still have to drop, and
 * the lava's colour tells you the only hidden thing there was. Several orders
 * solve each level, so there is a decision at every pin instead of one blessed
 * sequence.
 */

export type PinContent = "water" | "gold" | "rock";

export interface Pin {
  id: string;
  content: PinContent;
}

export interface PinLevel {
  level: number;
  pins: Pin[];
  /** One order that solves it, for validation and for a hint. */
  solution: string[];
}

/** Everything the chamber knows, derived from the pins pulled so far. */
export interface ChamberState {
  lavaHot: boolean;
  goldBanked: number;
  melted: boolean;
}

const MAX_PINS = 6;
const MAX_GOLD = 3;

/**
 * Builds a level.
 *
 * Difficulty is how tight the budget is, not how obscure the rule: early
 * levels hand out a spare coolant so a wasted rock is survivable, and later
 * ones give exactly enough, so every pull has to count. The rule being
 * reasoned about never changes.
 */
export function buildPinLevel(level: number, rng: () => number): PinLevel {
  const golds = Math.min(MAX_GOLD, 1 + Math.floor((level - 1) / 3));
  // A spare coolant early, exactly enough later: the puzzle tightens rather
  // than turning into something else.
  const spare = level <= 3 ? 1 : 0;
  const coolants = Math.min(MAX_PINS - golds, golds + spare);

  const pins: Pin[] = [];
  let n = 0;
  const add = (content: PinContent) => {
    const id = `pin${++n}`;
    pins.push({ id, content });
    return id;
  };

  // Rocks appear once the player has met water, so the "wasted on cool lava"
  // rule is learned against a rule they already know.
  const rocks = level < 2 ? 0 : Math.min(coolants - 1, Math.round(rng() * (coolants - 1)));
  const coolantIds: string[] = [];
  for (let i = 0; i < coolants; i++) coolantIds.push(add(i < rocks ? "rock" : "water"));
  const goldIds: string[] = [];
  for (let i = 0; i < golds; i++) goldIds.push(add("gold"));

  // Alternate coolant, gold, coolant, gold: every gold gets a cool floor to
  // land on, and the leftovers trail behind harmlessly.
  const solution: string[] = [];
  for (let i = 0; i < golds; i++) {
    solution.push(coolantIds[i]!);
    solution.push(goldIds[i]!);
  }
  for (const id of coolantIds.slice(golds)) solution.push(id);

  // Shuffled for display, so the board is not read left to right.
  const shuffled = [...pins];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }

  return { level, pins: shuffled, solution };
}

/**
 * Replays the pulls to get the chamber's state.
 *
 * Derived rather than tracked: the lava's temperature and the gold count are
 * two views of the same list, and two copies of one fact are two things that
 * can disagree.
 */
export function chamberAfter(level: PinLevel, pulled: string[]): ChamberState {
  const state: ChamberState = { lavaHot: true, goldBanked: 0, melted: false };

  for (const id of pulled) {
    const pin = level.pins.find((p) => p.id === id);
    if (!pin) continue;

    if (pin.content === "water") {
      state.lavaHot = false;
    } else if (pin.content === "rock") {
      // Only useful against hot lava; on a cool floor it is a wasted pull.
      if (state.lavaHot) state.lavaHot = false;
    } else {
      if (state.lavaHot) {
        state.melted = true;
        return state;
      }
      state.goldBanked += 1;
      // The vault opens and the heat comes back, so each gold has to be paid
      // for separately.
      state.lavaHot = true;
    }
  }

  return state;
}

/** Whether pulling `pinId` now keeps the run alive. */
export function canPull(level: PinLevel, pinId: string, pulled: string[]): boolean {
  const pin = level.pins.find((p) => p.id === pinId);
  if (!pin || pulled.includes(pinId)) return false;
  return !chamberAfter(level, [...pulled, pinId]).melted;
}

/** Whether every gold in the chamber has been banked. */
export function isSolved(level: PinLevel, pulled: string[]): boolean {
  const golds = level.pins.filter((p) => p.content === "gold").length;
  return chamberAfter(level, pulled).goldBanked >= golds;
}

/**
 * Whether the chamber can still be finished.
 *
 * Wasting coolants is a real way to lose, but being quietly stranded with no
 * way to know is not — the view uses this to say so instead of leaving the
 * player pulling at a board that cannot be solved.
 */
export function isDeadEnd(level: PinLevel, pulled: string[]): boolean {
  const state = chamberAfter(level, pulled);
  if (state.melted) return true;
  if (isSolved(level, pulled)) return false;

  const left = level.pins.filter((p) => !pulled.includes(p.id));
  const goldLeft = left.filter((p) => p.content === "gold").length;
  const coolantLeft = left.length - goldLeft;
  // Each remaining gold needs its own coolant first, unless the lava is
  // already cool, which covers exactly one of them.
  return coolantLeft < goldLeft - (state.lavaHot ? 0 : 1);
}

/**
 * The next pin that is safe to pull, for a hint.
 *
 * Offered rather than imposed: a stuck player should be able to see one step,
 * not have the chamber emptied for them.
 */
export function nextSafePin(level: PinLevel, pulled: string[]): string | null {
  const remaining = level.pins.filter((p) => !pulled.includes(p.id));
  // Prefer a pull that keeps the chamber solvable, not merely one that
  // survives the next second.
  const safe = remaining.filter((p) => canPull(level, p.id, pulled));
  const sound = safe.find((p) => !isDeadEnd(level, [...pulled, p.id]));
  return (sound ?? safe[0])?.id ?? null;
}
