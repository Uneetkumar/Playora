/**
 * Target Rush simulation.
 *
 * Extracted from the view so it can be tested against a controlled clock. The
 * Browser pane this project is developed in is permanently `document.hidden`
 * and fires zero `requestAnimationFrame` callbacks, so an rAF-driven game
 * cannot be verified by looking at it — the simulation has to be verifiable on
 * its own, or it is not verified at all.
 *
 * Nothing here touches React, the DOM, or a timer. Given the same seed and the
 * same steps it produces the same run.
 */

export type TargetKind = "bullseye" | "gold" | "tnt";

export interface Target {
  id: number;
  x: number;
  y: number;
  size: number;
  type: TargetKind;
  /** Seconds left before it despawns. */
  life: number;
}

export interface RushState {
  timeLeft: number;
  targets: Target[];
  sinceSpawn: number;
  nextId: number;
  /** Bullseyes that timed out — the caller turns these into missed chains. */
  expiredThisStep: number;
  over: boolean;
}

export const ROUND_SECONDS = 45;
export const MAX_TARGETS = 6;
/**
 * How long a target stays.
 *
 * Targets used to persist until clicked, so the board settled into six
 * standing targets and the "rush" became a stationary click test — you could
 * leave the tab and come back to the same six. A lifetime is what makes the
 * spawn rate mean anything.
 */
export const TARGET_LIFETIME = 2.6;

export function createRushState(): RushState {
  return {
    timeLeft: ROUND_SECONDS,
    targets: [],
    sinceSpawn: 0,
    nextId: 1,
    expiredThisStep: 0,
    over: false,
  };
}

export interface StepOptions {
  /** Milliseconds between spawns, from the shared run's difficulty ramp. */
  spawnIntervalMs: number;
  /** Injectable for tests; `Math.random` in the game. */
  rng: () => number;
}

/** Advances one fixed step. Mutates `s`. */
export function stepRush(s: RushState, dt: number, opts: StepOptions): void {
  if (s.over) return;

  s.expiredThisStep = 0;
  s.timeLeft = Math.max(0, s.timeLeft - dt);
  if (s.timeLeft <= 0) {
    s.over = true;
    return;
  }

  for (const t of s.targets) t.life -= dt;
  // A bullseye that times out breaks the chain; letting TNT time out is
  // correct play and costs nothing.
  s.expiredThisStep = s.targets.filter((t) => t.life <= 0 && t.type !== "tnt").length;
  s.targets = s.targets.filter((t) => t.life > 0);

  s.sinceSpawn += dt * 1000;
  if (s.sinceSpawn >= opts.spawnIntervalMs && s.targets.length < MAX_TARGETS) {
    s.sinceSpawn = 0;
    s.targets = [...s.targets, spawn(s, opts.rng)];
  }
}

function spawn(s: RushState, rng: () => number): Target {
  const isGold = rng() < 0.2;
  const isTnt = !isGold && rng() < 0.15;
  return {
    id: s.nextId++,
    x: rng() * 75 + 12,
    y: rng() * 65 + 15,
    size: isGold ? 36 : isTnt ? 42 : 48,
    type: isGold ? "gold" : isTnt ? "tnt" : "bullseye",
    life: TARGET_LIFETIME,
  };
}

/** Removes a target that was hit. Returns whether it was there to remove. */
export function removeTarget(s: RushState, id: number): boolean {
  const before = s.targets.length;
  s.targets = s.targets.filter((t) => t.id !== id);
  return s.targets.length < before;
}
