/**
 * The arithmetic of turning raw controls into driving input: dead zones,
 * response curves, and steering that ramps instead of snapping.
 *
 * Pure functions, so the feel of the controls can be tested and tuned without
 * a browser.
 */

const clamp = (n: number, lo: number, hi: number): number => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : 0);

/**
 * How fast held keys turn the wheel, in full locks per second. A key that
 * snapped to full lock would be unusable at speed — the car darts — so keys
 * build lock over about a third of a second, and let go faster than that,
 * because a car that will not straighten feels worse than one slow to turn.
 */
export const KEY_STEER_RATE = 3.2;
export const KEY_STEER_RETURN = 4.5;

/** Stick travel ignored around centre: worn sticks rest a few percent off. */
export const STICK_DEAD_ZONE = 0.12;
/** Trigger travel ignored at rest, and the point where it counts as fully in. */
export const TRIGGER_DEAD_ZONE = 0.04;
export const TRIGGER_SATURATION = 0.96;

/**
 * Pointer steering: the band through the middle of the canvas that steers
 * straight, and how far out full lock is reached, both as a fraction of the
 * half-width. A sixth rather than the third the old comment promised: a third
 * spends a third of the canvas on nothing and leaves too little to steer with.
 */
export const POINTER_DEAD_ZONE = 0.12;
export const POINTER_FULL_LOCK = 0.85;
/** How quickly the wheel follows the pointer, per second. */
export const POINTER_FOLLOW = 12;

/**
 * Moves digital steering one frame towards `target`. Building lock uses the
 * press rate; easing off, centring and reversing (until the wheel passes
 * centre) use the faster return rate.
 */
export function approachSteer(
  current: number,
  target: number,
  dt: number,
  pressRate = KEY_STEER_RATE,
  returnRate = KEY_STEER_RETURN,
): number {
  const from = clamp(current, -1, 1);
  const to = clamp(target, -1, 1);
  const step = Math.max(0, Number.isFinite(dt) ? dt : 0);
  if (from === to || step === 0) return from;
  const reversing = from !== 0 && Math.sign(to) !== Math.sign(from);
  const easing = Math.abs(to) < Math.abs(from);
  const rate = reversing || easing ? returnRate : pressRate;
  const delta = rate * step;
  return Math.abs(to - from) <= delta ? to : from + Math.sign(to - from) * delta;
}

/**
 * A stick axis with its dead zone removed and a progressive curve applied:
 * fine corrections near centre, full lock still at the edge.
 */
export function shapeStick(raw: number, deadZone = STICK_DEAD_ZONE): number {
  const x = clamp(raw, -1, 1);
  const m = Math.abs(x);
  if (m <= deadZone) return 0;
  const t = Math.min(1, (m - deadZone) / (1 - deadZone));
  return Math.sign(x) * t * (0.4 + 0.6 * t);
}

/** A trigger's travel as 0..1, with slack at rest and at the stop. */
export function shapeTrigger(raw: number): number {
  const v = clamp(raw, 0, 1);
  return clamp((v - TRIGGER_DEAD_ZONE) / (TRIGGER_SATURATION - TRIGGER_DEAD_ZONE), 0, 1);
}

/** Where a pointer at `clientX` puts the wheel, across a box `width` wide from `left`. */
export function pointerSteerFromX(
  clientX: number,
  left: number,
  width: number,
  deadZone = POINTER_DEAD_ZONE,
  fullLock = POINTER_FULL_LOCK,
): number {
  if (!(width > 0) || !Number.isFinite(clientX)) return 0;
  const centred = ((clientX - left) / width - 0.5) * 2;
  const m = Math.abs(centred);
  if (m <= deadZone) return 0;
  return Math.sign(centred) * Math.min(1, (m - deadZone) / Math.max(1e-6, fullLock - deadZone));
}

/** The value with the largest magnitude: how two steering sources combine. */
export function strongest(...values: number[]): number {
  let best = 0;
  for (const v of values) if (Number.isFinite(v) && Math.abs(v) > Math.abs(best)) best = v;
  return best;
}
