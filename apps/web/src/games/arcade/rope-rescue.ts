/**
 * Rope Rescue simulation.
 *
 * Replaces two `setInterval`s: a 50 ms saw tick reading wall-clock `Date.now()`
 * and a 380 ms zip tick. The original comment defended `setInterval` over
 * `requestAnimationFrame` on the grounds that rAF stops in a background tab
 * while the interval does not, so an rAF saw would freeze while the game kept
 * scoring against a blade the player could no longer see. That reasoning was
 * right about the danger and wrong about the fix — the answer is one clock for
 * both, which is what the runtime provides.
 *
 * `level` was cosmetic: a NEXT LEVEL button incremented it, `restart()` never
 * reset it, and nothing read it. Saw speed came from elapsed time only. Here
 * the level sets the batch size and feeds the saw, so advancing is an actual
 * escalation.
 */

import { sawRisk, sawPositionAt } from "./scoring";

export interface RopeState {
  level: number;
  /** Survivors still waiting to cross. */
  waiting: number;
  rescued: number;
  lost: number;
  zipping: boolean;
  /** Where the player has set the rope. */
  anchorY: number;
  /** Blade position, derived from `sawTime`. */
  sawY: number;
  sawTime: number;
  sinceZip: number;
  over: boolean;
  /** Set when a batch is cleared and the next level is available. */
  cleared: boolean;
  events: { rescued: boolean; lost: boolean; cleared: boolean; died: boolean };
}

export const START_ANCHOR = 180;
/** Seconds between survivors crossing. */
const ZIP_INTERVAL = 0.38;

/** How many survivors a level sends across. Grows, then holds. */
export function batchSizeFor(level: number): number {
  return Math.min(18, 8 + level * 2);
}

/** A batch counts as cleared if at least this fraction made it. */
export const CLEAR_FRACTION = 0.5;

export function createRopeState(level = 1): RopeState {
  return {
    level,
    waiting: batchSizeFor(level),
    rescued: 0,
    lost: 0,
    zipping: false,
    anchorY: START_ANCHOR,
    sawY: sawPositionAt(0, level),
    sawTime: 0,
    sinceZip: 0,
    over: false,
    cleared: false,
    events: { rescued: false, lost: false, cleared: false, died: false },
  };
}

export interface RopeStepOptions {
  /** Combined with the level so both time and progress raise the difficulty. */
  wave: number;
  rng: () => number;
}

/** Advances one fixed step. Mutates `s`. */
export function stepRope(s: RopeState, dt: number, opts: RopeStepOptions): void {
  s.events = { rescued: false, lost: false, cleared: false, died: false };
  if (s.over || s.cleared) return;

  // The blade runs on the same clock as everything else, so the risk is always
  // computed against the position the player is actually looking at.
  s.sawTime += dt;
  s.sawY = sawPositionAt(s.sawTime, Math.max(opts.wave, s.level));

  if (!s.zipping || s.waiting <= 0) return;

  s.sinceZip += dt;
  if (s.sinceZip < ZIP_INTERVAL) return;
  s.sinceZip -= ZIP_INTERVAL;

  // Risk comes from how close the rope runs to the blade right now.
  if (opts.rng() < sawRisk(s.anchorY, s.sawY)) {
    s.lost += 1;
    s.events.lost = true;
  } else {
    s.rescued += 1;
    s.events.rescued = true;
  }
  s.waiting -= 1;

  if (s.waiting <= 0) {
    s.zipping = false;
    const total = batchSizeFor(s.level);
    if (s.rescued / total >= CLEAR_FRACTION) {
      s.cleared = true;
      s.events.cleared = true;
    } else {
      // Losing more than half is what ends a run — the batch simply running
      // out never was a failure, which is why the old version ended every game
      // the same way regardless of how well it went.
      s.over = true;
      s.events.died = true;
    }
  }
}

/** Stars for the batch just finished. */
export function starsFor(s: RopeState): number {
  const pct = s.rescued / batchSizeFor(s.level);
  if (pct >= 0.8) return 3;
  if (pct >= 0.5) return 2;
  return pct > 0 ? 1 : 0;
}

/** Moves the rope. The only control the game has. */
export function setAnchor(s: RopeState, y: number): void {
  if (s.over) return;
  s.anchorY = Math.max(70, Math.min(250, y));
}

export function startZip(s: RopeState): void {
  if (s.over || s.cleared || s.waiting <= 0) return;
  s.zipping = true;
}

/** Builds the next level, carrying nothing but the level number. */
export function nextLevel(s: RopeState): RopeState {
  return createRopeState(s.level + 1);
}
