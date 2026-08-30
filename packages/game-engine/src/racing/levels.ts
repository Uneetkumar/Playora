import type { GameId } from "@playora/game-types";

/**
 * AI difficulty, 1-7.
 *
 * Structurally the same union as `AiLevel` in `@playora/bot-engine`, declared
 * here rather than imported: bot-engine depends on this package, so importing
 * it back would be a cycle. The two assign to each other freely.
 */
export type RaceAiLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * One stage of a racing career.
 *
 * Difficulty is raised on four separate axes rather than by one number: a
 * longer track, more rivals, better rivals, and a stricter finishing position.
 * Turning only the AI dial makes every level feel like the same race against a
 * faster opponent, which is the point at which a player stops caring.
 */
export interface RaceLevel {
  /** 1-based, and also its position in the ladder. */
  index: number;
  name: string;
  /** Length of one lap, in metres. */
  trackLength: number;
  /** Laps to complete. */
  laps: number;
  opponents: number;
  aiLevel: RaceAiLevel;
  nitroCharges: number;
  /** Finish at or above this place to complete the level and unlock the next. */
  targetPlace: number;
  /** Shown on the card, so the player knows what they are walking into. */
  blurb: string;
}

function ladder(names: Array<[string, string]>): RaceLevel[] {
  // Lap length stays short and the lap count rises. A single long loop is
  // geometrically forced to be gentle — a 5 km circle has a 800 m radius and no
  // corner worth the name — so the difficulty comes from driving a tighter
  // circuit more times.
  const shape: Array<Omit<RaceLevel, "index" | "name" | "blurb">> = [
    { trackLength: 900, laps: 2, opponents: 1, aiLevel: 1, nitroCharges: 3, targetPlace: 1 },
    { trackLength: 1000, laps: 2, opponents: 2, aiLevel: 2, nitroCharges: 3, targetPlace: 2 },
    { trackLength: 1100, laps: 3, opponents: 3, aiLevel: 3, nitroCharges: 2, targetPlace: 2 },
    { trackLength: 1200, laps: 3, opponents: 3, aiLevel: 4, nitroCharges: 2, targetPlace: 2 },
    { trackLength: 1300, laps: 3, opponents: 4, aiLevel: 5, nitroCharges: 2, targetPlace: 2 },
    { trackLength: 1400, laps: 4, opponents: 5, aiLevel: 5, nitroCharges: 2, targetPlace: 1 },
    { trackLength: 1500, laps: 4, opponents: 6, aiLevel: 6, nitroCharges: 1, targetPlace: 1 },
    { trackLength: 1600, laps: 5, opponents: 7, aiLevel: 7, nitroCharges: 1, targetPlace: 1 },
  ];

  return shape.map((step, i) => ({
    ...step,
    index: i + 1,
    name: names[i]?.[0] ?? `Stage ${i + 1}`,
    blurb: names[i]?.[1] ?? "",
  }));
}

export const CAR_LEVELS: RaceLevel[] = ladder([
  ["First Lights", "One rival, a short circuit and plenty of nitro. Just finish in front."],
  ["Downtown Run", "Two rivals. A podium is enough."],
  ["Neon Mile", "Three rivals who have started reading the corners."],
  ["Late Shift", "The field is quicker and the road is longer."],
  ["Crosstown", "Four rivals. Nitro is scarce from here."],
  ["The Gauntlet", "Five rivals, and second place no longer counts."],
  ["Night Circuit", "Six rivals, one nitro charge, and no room for a mistake."],
  ["Grand Final", "The full field at their best. Win it."],
]);

export const BIKE_LEVELS: RaceLevel[] = ladder([
  ["Kickstart", "One rival. Get a feel for how far a corner throws you."],
  ["Backstreets", "Two rivals. The bike carries less speed through a bend than you think."],
  ["Split Lane", "Three rivals. Use the gaps a car could not."],
  ["Redline", "The field is faster and a mistake costs more."],
  ["Chicane", "Four rivals, tighter road, less nitro."],
  ["Full Lean", "Five rivals, and only a win counts."],
  ["Wire to Wire", "Six rivals. One touch of the wall ends it."],
  ["Last Rider", "Everything the ladder has taught you, at once."],
]);

export function levelsFor(gameId: GameId): RaceLevel[] {
  return gameId === "bike-race" ? BIKE_LEVELS : CAR_LEVELS;
}

/**
 * Stars earned for a finishing position.
 *
 * Three for a win, two for the podium, one for meeting the level's own target.
 * Anything worse is not a pass, so the next level stays locked.
 */
export function starsFor(level: RaceLevel, place: number): number {
  if (place <= 1) return 3;
  if (place <= 2) return 2;
  if (place <= level.targetPlace) return 1;
  return 0;
}

export function isPass(level: RaceLevel, place: number): boolean {
  return place > 0 && place <= level.targetPlace;
}

/**
 * Which levels are open, given the best place achieved on each.
 *
 * The first is always open; every other one needs its predecessor passed. Pure
 * and total, so the whole ladder can be checked in a test rather than by
 * clicking through eight races.
 */
export function unlockedLevels(
  levels: readonly RaceLevel[],
  best: Readonly<Record<number, number>>,
): boolean[] {
  return levels.map((_level, i) => {
    if (i === 0) return true;
    const previous = levels[i - 1]!;
    const place = best[previous.index];
    return place !== undefined && isPass(previous, place);
  });
}
