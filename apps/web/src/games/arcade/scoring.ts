import type { GameId } from "@playora/game-types";

/**
 * Shared scoring and difficulty for the arcade games.
 *
 * None of the ten persisted anything. Seven did not track a score at all, and
 * the three that did threw it away when the round ended — so every run started
 * and finished in exactly the same place, with nothing to beat. That, far more
 * than the visuals, is why they do not hold anyone for a second round.
 *
 * The rules live here as pure functions rather than inside each view, so the
 * curve is the same everywhere and can be tested without a renderer.
 */

/** Points a chain of hits is worth, as a multiplier on the base value. */
export function comboMultiplier(combo: number): number {
  if (combo < 2) return 1;
  // Grows fast at first and then flattens: the jump from 2 to 5 should feel
  // like a real reward, while an unbroken run of 60 must not be worth 60x or
  // one lucky streak decides the leaderboard forever.
  return Math.min(6, 1 + Math.log2(combo) * 0.9);
}

/** Score for one hit at a given combo, rounded to a whole number. */
export function pointsFor(base: number, combo: number): number {
  return Math.round(base * comboMultiplier(combo));
}

/**
 * How hard the game should be, `seconds` into a run.
 *
 * Returns a multiplier from 1 upward. Deliberately unbounded but slow: an
 * arcade run has to end, and the way it ends should be the player finally
 * failing to keep up rather than a timer expiring while they are still
 * comfortable.
 */
export function difficultyAt(seconds: number): number {
  return 1 + Math.max(0, seconds) / 45;
}

/**
 * Interval between spawns at a given point in a run, in milliseconds.
 *
 * Floored, because below about 150ms a human cannot react at all and the game
 * stops being a test of skill.
 */
export function spawnIntervalAt(baseMs: number, seconds: number): number {
  return Math.max(150, Math.round(baseMs / difficultyAt(seconds)));
}

/** Where a game's personal best is stored. */
export function bestScoreKey(gameId: GameId | string): string {
  return `playora:arcade:best:${gameId}`;
}

/**
 * Reads a stored personal best.
 *
 * Every access is guarded: `localStorage` throws outright in some contexts —
 * a private window with site data blocked, a thumbnail capture — and a crash
 * while reading a cosmetic number must not take the game down with it.
 */
export function readBestScore(gameId: GameId | string): number {
  try {
    const raw = window.localStorage.getItem(bestScoreKey(gameId));
    const value = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

/**
 * Stores a personal best, if it beats what is there.
 *
 * Returns whether it was a new best, which is what the result screen shows.
 * Re-reads before writing rather than trusting a value held in memory: the
 * same game open in a second tab would otherwise overwrite the higher score
 * with whatever this tab happened to finish on.
 */
export function commitBestScore(gameId: GameId | string, score: number): boolean {
  if (!Number.isFinite(score) || score <= 0) return false;
  try {
    const current = readBestScore(gameId);
    if (score <= current) return false;
    window.localStorage.setItem(bestScoreKey(gameId), String(Math.round(score)));
    return true;
  } catch {
    // Nothing stored is a worse outcome than nothing shown, but neither is
    // worth an exception mid-run.
    return false;
  }
}

/** Groups a score for display: 12400 -> "12,400". */
export function formatScore(score: number): string {
  return Math.round(score).toLocaleString("en-US");
}

/**
 * What a Hot Potato pass is worth, for how long it was held.
 *
 * The game had no decision in it: when the potato reached you, you tapped
 * "toss", and there was never a reason to do anything else. Tapping instantly
 * was strictly optimal, so the only input was a reflex test with no choice
 * attached.
 *
 * Paying for hold time turns every pass into a gamble the player actually
 * makes. The fuse is hidden and random, so holding longer is worth more and
 * might end the run — which is the risk-against-reward shape the retention
 * research says these games are missing.
 *
 * Growth is faster than linear so the last second is worth chasing, and capped
 * so a single lucky long hold cannot outweigh a whole careful run.
 */
export function holdBonus(heldSeconds: number): number {
  const held = Math.max(0, heldSeconds);
  return Math.min(HOLD_BONUS_CAP, Math.round(HOLD_BASE + held * held * HOLD_GROWTH));
}

/** Points for tossing the moment it arrives. */
export const HOLD_BASE = 10;
/** How sharply the reward grows with the square of hold time. */
export const HOLD_GROWTH = 14;
/** The most a single pass can ever be worth. */
export const HOLD_BONUS_CAP = 260;

/**
 * How long the fuse burns, in seconds, at a given wave.
 *
 * Shortens as a run goes on, with a floor: below about a second and a half a
 * player cannot make a decision at all, and the gamble becomes a coin flip.
 */
export function fuseSecondsFor(wave: number, roll: number): number {
  const span = Math.max(2.2, 7 - wave * 0.6);
  const floor = Math.max(1.5, span * 0.45);
  return floor + roll * (span - floor);
}


/**
 * What holding the bomb is worth, for a hold of a given length.
 *
 * Deliberately shaped differently from `holdBonus`, because the two games ask
 * different questions. Hot Potato hides the fuse, so its reward curve
 * accelerates and the player is gambling blind. Bomb Pass shows the fuse — the
 * decision there is reading a visible clock and judging when to bail, so the
 * reward is close to linear and the tension comes from watching the number
 * count down rather than from not knowing.
 */
export function bombHoldValue(heldSeconds: number): number {
  return Math.min(BOMB_HOLD_CAP, Math.round(Math.max(0, heldSeconds) * BOMB_PER_SECOND));
}

/** Points per second of holding the bomb. */
export const BOMB_PER_SECOND = 45;
/** The most a single hold can bank. */
export const BOMB_HOLD_CAP = 400;

/**
 * Chance a survivor is lost to the saw, given how close the rope runs to it.
 *
 * Rope Rescue shipped with a slider that moved a rope, a saw blade drawn on
 * the screen, and a hazard roll of `Math.random() < 0.15` that ignored both.
 * The comment above it even said "collision check based on anchor position".
 * The player had a control that did nothing and a threat that was decoration:
 * pressing start and waiting was the entire game.
 *
 * Distance is in the SVG's own units, and the curve is deliberately steep —
 * threading close to the blade should feel dangerous rather than mildly
 * unwise, and being clear of it should feel safe rather than merely luckier.
 */
export function sawRisk(ropeY: number, sawY: number): number {
  const distance = Math.abs(ropeY - sawY);
  if (distance >= SAW_SAFE_DISTANCE) return SAW_MIN_RISK;
  const closeness = 1 - distance / SAW_SAFE_DISTANCE;
  return Math.min(SAW_MAX_RISK, SAW_MIN_RISK + closeness * closeness * SAW_MAX_RISK);
}

/** Beyond this many units from the blade, the rope is clear. */
export const SAW_SAFE_DISTANCE = 90;
/** Even a clear rope has a little risk, so a run is never on rails. */
export const SAW_MIN_RISK = 0.02;
/** Risk of running the rope straight through the blade. */
export const SAW_MAX_RISK = 0.75;

/** Where the saw is at a given moment, patrolling between two heights. */
export function sawPositionAt(seconds: number, wave: number, low = 70, high = 250): number {
  // Speeds up with the waves, so holding a safe line gets progressively harder.
  const speed = 0.5 + wave * 0.12;
  const mid = (low + high) / 2;
  const swing = (high - low) / 2;
  return mid + Math.sin(seconds * speed) * swing;
}

/**
 * The truss height a bridge needs to carry a given load.
 *
 * Bridge Builder shipped with one slider and one hard-coded threshold: below 30
 * the bridge snapped, above it the bridge held. The scoring rewarded using
 * less material, so the optimal play was exactly 30 — and once a player worked
 * that out, the game was solved permanently. One number, no variation, nothing
 * left to decide on the second attempt.
 *
 * Varying the load turns it into a judgement each round: read the weight,
 * estimate the truss it needs, and decide how close to the edge to build.
 */
export function trussNeededFor(loadTonnes: number): number {
  return Math.round(TRUSS_BASE + loadTonnes * TRUSS_PER_TONNE);
}

/** Truss height needed even for an empty truck. */
export const TRUSS_BASE = 8;
/** Extra height needed per tonne. */
export const TRUSS_PER_TONNE = 2.4;

/**
 * What a bridge that held is worth.
 *
 * Scales with how little material was used *above what the load required*, so
 * the reward is for judging the margin rather than for being handed a light
 * truck. A bridge built far heavier than needed is safe and scores little.
 */
export function bridgeScore(truss: number, needed: number): number {
  if (truss < needed) return 0;
  const margin = truss - needed;
  return Math.max(60, Math.round(420 - margin * 9));
}
