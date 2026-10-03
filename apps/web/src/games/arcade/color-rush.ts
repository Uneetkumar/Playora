/**
 * Colour Rush simulation.
 *
 * Two `setInterval`s used to run this: a spawner at a hardcoded 1100 ms and a
 * fall tick at 40 ms moving each orb 2.5 units. Both numbers were constant, so
 * despite the HUD showing a wave, **the game never actually got harder** — the
 * ramp was advertised and not implemented. Orbs fell at 62.5 units/second in
 * minute five exactly as in second five.
 *
 * Here the spawn interval comes from the shared run's difficulty and the fall
 * speed climbs with the wave, both with floors so it stays playable. Pure: no
 * React, no DOM, no clock.
 */

export type ColorKey = "cyan" | "red" | "green" | "yellow";

export const COLOR_KEYS: ColorKey[] = ["cyan", "red", "green", "yellow"];

export interface Orb {
  id: number;
  color: ColorKey;
  /** Percent of the arena fallen, 0 at the top. */
  y: number;
}

export interface RushState {
  orbs: Orb[];
  lives: number;
  sinceSpawn: number;
  nextId: number;
  over: boolean;
  events: { dropped: number; died: boolean };
}

export const START_LIVES = 3;
/** Where an orb counts as missed. */
export const FLOOR_Y = 75;

export function createColorState(): RushState {
  return {
    orbs: [],
    lives: START_LIVES,
    sinceSpawn: 0,
    nextId: 1,
    over: false,
    events: { dropped: 0, died: false },
  };
}

/**
 * Fall speed in percent per second.
 *
 * The original constant was 62.5. Wave 1 stays close to that so the game feels
 * the same to start with, and it climbs from there.
 */
export function fallSpeedFor(wave: number): number {
  return Math.min(150, 58 + (wave - 1) * 7);
}

export interface ColorStepOptions {
  /** From the shared run, so spawning tightens with difficulty. */
  spawnIntervalMs: number;
  wave: number;
  rng: () => number;
}

/** Advances one fixed step. Mutates `s`. */
export function stepColor(s: RushState, dt: number, opts: ColorStepOptions): void {
  s.events = { dropped: 0, died: false };
  if (s.over) return;

  const speed = fallSpeedFor(opts.wave);
  const survivors: Orb[] = [];
  for (const orb of s.orbs) {
    const y = orb.y + speed * dt;
    if (y >= FLOOR_Y) s.events.dropped += 1;
    else survivors.push({ ...orb, y });
  }
  s.orbs = survivors;

  if (s.events.dropped > 0) {
    // A dropped orb costs a life on the same terms as a wrong tap.
    s.lives -= s.events.dropped;
    if (s.lives <= 0) {
      s.lives = 0;
      s.over = true;
      s.events.died = true;
      return;
    }
  }

  s.sinceSpawn += dt * 1000;
  if (s.sinceSpawn >= opts.spawnIntervalMs) {
    s.sinceSpawn = 0;
    const color = COLOR_KEYS[Math.floor(opts.rng() * COLOR_KEYS.length)]!;
    s.orbs = [...s.orbs, { id: s.nextId++, color, y: 0 }];
  }
}

export type MatchResult = "hit" | "wrong" | "empty";

/**
 * Answers the lowest orb with a colour.
 *
 * Returns what happened so the view can score and shake; it does not know
 * about points, which belong to the shared run.
 */
export function matchColor(s: RushState, color: ColorKey): MatchResult {
  if (s.over) return "empty";
  const target = s.orbs[0];
  if (!target) return "empty";

  if (target.color === color) {
    s.orbs = s.orbs.slice(1);
    return "hit";
  }

  s.lives -= 1;
  if (s.lives <= 0) {
    s.lives = 0;
    s.over = true;
    s.events.died = true;
  }
  return "wrong";
}
