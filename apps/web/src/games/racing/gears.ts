/**
 * A gear number for the dashboard.
 *
 * Entirely cosmetic — the physics has no gearbox, and adding one would make
 * the car slower for no gain in a game with a single throttle key. This exists
 * because a speedometer without a gear reads as a dial rather than a car, and
 * the number climbing as you accelerate is part of what sells the speed.
 */
const GEARS = 6;

export function gearFor(speed: number, maxSpeed: number): number {
  if (speed <= 0.5) return 1;
  const fraction = Math.min(1, speed / Math.max(1, maxSpeed));
  // Squared, so the lower gears pass quickly and top gear covers the long
  // stretch near maximum speed — which is how a real ratio spread feels.
  return Math.min(GEARS, 1 + Math.floor(Math.sqrt(fraction) * GEARS));
}

/** Ticks to a stopwatch reading, e.g. 01:24.376. */
export function formatLapTime(ticks: number | null, tickRate = 60): string {
  if (ticks === null || !Number.isFinite(ticks)) return "--:--.---";
  const totalMs = Math.max(0, Math.round((ticks / tickRate) * 1000));
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

/** A gap between two drivers, in seconds. */
export function formatGapSeconds(metres: number, speed: number): string {
  // Converted at a plausible pace rather than the instantaneous speed, which
  // swings wildly when either driver brakes and makes the number unreadable.
  const reference = Math.max(20, speed);
  const seconds = metres / reference;
  if (Math.abs(seconds) < 0.05) return "0.0s";
  return `${seconds > 0 ? "+" : "−"}${Math.abs(seconds).toFixed(1)}s`;
}
