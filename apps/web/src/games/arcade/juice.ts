/**
 * Impact feedback for the arcade games.
 *
 * From the game-feel literature: responsiveness and readability are "game
 * feel"; exaggeration and feedback are "juice". Juice changes nothing about
 * the rules and everything about how a hit reads. The three techniques that
 * carry most of it are screen shake for force, hit-stop for weight, and
 * squash-and-stretch for life.
 *
 * The important caveat from that same literature, and the reason this is
 * parameterised rather than blanket: juice has to echo the core gameplay.
 * Shaking the screen for a routine tap trains a player to ignore the shake,
 * so magnitude here is a function of how big the event actually was.
 */

/** How hard the screen moves for an event, in pixels. */
export const SHAKE = {
  /** A routine hit. Barely perceptible, and deliberately so. */
  tap: 2,
  /** Something worth noticing: a bonus, a chain milestone. */
  solid: 5,
  /** A mistake or a heavy impact. */
  heavy: 10,
  /** Game over. */
  fatal: 16,
} as const;

export type ShakeStrength = keyof typeof SHAKE;

/**
 * Shake offset at a point in a decay.
 *
 * Decays quadratically rather than linearly: a linear fade reads as the camera
 * being dragged back to centre, where a quadratic one reads as energy
 * dissipating.
 */
export function shakeOffset(
  strength: number,
  elapsedMs: number,
  durationMs: number,
  seed: number,
): { x: number; y: number } {
  if (elapsedMs >= durationMs || durationMs <= 0) return { x: 0, y: 0 };

  const remaining = 1 - elapsedMs / durationMs;
  const magnitude = strength * remaining * remaining;

  // Deterministic in the seed and time, so a re-render mid-shake does not
  // teleport the screen somewhere new.
  const a = Math.sin(seed * 12.9898 + elapsedMs * 0.05) * 43758.5453;
  const b = Math.sin(seed * 78.233 + elapsedMs * 0.037) * 43758.5453;
  return {
    x: (a - Math.floor(a) - 0.5) * 2 * magnitude,
    y: (b - Math.floor(b) - 0.5) * 2 * magnitude,
  };
}

/**
 * How long the game freezes on an impact, in milliseconds.
 *
 * Three to five frames is the range the technique lives in — long enough for
 * the eye to register the hit, short enough that it reads as weight rather
 * than as the game stuttering. Above about 120ms it stops feeling like impact
 * and starts feeling like a dropped frame, so it is capped.
 */
export function hitStopMs(strength: ShakeStrength): number {
  const frames = { tap: 0, solid: 3, heavy: 5, fatal: 7 }[strength];
  return Math.min(120, Math.round((frames / 60) * 1000));
}

/**
 * Squash-and-stretch scale for something that has just been hit.
 *
 * Volume is roughly conserved — squashing on one axis stretches the other —
 * which is what makes it read as a physical object rather than a sprite being
 * resized.
 */
export function squash(progress: number, amount = 0.35): { x: number; y: number } {
  if (progress >= 1 || progress < 0) return { x: 1, y: 1 };
  // A single bounce: compress, overshoot, settle.
  const wave = Math.sin(progress * Math.PI) * (1 - progress);
  const squashY = 1 - wave * amount;
  return { x: 1 / squashY, y: squashY };
}

/**
 * The wave a run has reached, for display.
 *
 * The difficulty ramp already exists but is invisible, and an escalation the
 * player cannot see does not read as escalation — it reads as the game
 * becoming unfair. Naming the wave turns the same curve into something they
 * can feel themselves surviving.
 */
export function waveAt(elapsedSeconds: number, secondsPerWave = 20): number {
  return 1 + Math.floor(Math.max(0, elapsedSeconds) / secondsPerWave);
}

/** Seconds until the next wave, for a progress readout. */
export function secondsToNextWave(elapsedSeconds: number, secondsPerWave = 20): number {
  const into = Math.max(0, elapsedSeconds) % secondsPerWave;
  return Math.max(0, secondsPerWave - into);
}
