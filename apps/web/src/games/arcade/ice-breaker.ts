/**
 * Ice Breaker simulation.
 *
 * Replaces a 1200 ms shrink interval, an AI interval, and a physics effect
 * that depended on `racers` and called `setRacers(curr.map(...))` — `map`
 * returns a new array whether or not anything changed, a new reference is
 * never `Object.is`-equal, so the effect re-ran, set state, and looped until
 * "Maximum update depth exceeded".
 *
 * The extraction also caught a bot that did not play. Its comment said "random
 * nudge towards center or player"; the code was a pure random walk with no
 * term for either, so bots wandered off the edge by accident. They now steer
 * for the middle as the ice closes in, which is what makes surviving them an
 * achievement rather than a wait.
 */

export interface IceRacer {
  id: string;
  name: string;
  isBot: boolean;
  x: number;
  y: number;
  alive: boolean;
  color: string;
}

export interface IceState {
  racers: IceRacer[];
  /** Radius of the iceberg, in the same percent units as positions. */
  radius: number;
  sinceShrink: number;
  sinceBotMove: number;
  over: boolean;
  winner: string | null;
  events: { shrank: boolean; sank: number; died: boolean };
}

export const CENTRE = 50;
export const MIN_RADIUS = 18;
export const HUMAN_ID = "p1";
const SHRINK_INTERVAL = 1.2;
const BOT_INTERVAL = 0.35;

export function createIceState(): IceState {
  return {
    racers: [
      { id: "p1", name: "You", isBot: false, x: 50, y: 50, alive: true, color: "#06b6d4" },
      { id: "p2", name: "BlizzardBot", isBot: true, x: 25, y: 35, alive: true, color: "#ef4444" },
      { id: "p3", name: "FrostKing", isBot: true, x: 75, y: 35, alive: true, color: "#a855f7" },
      { id: "p4", name: "PolarAce", isBot: true, x: 50, y: 75, alive: true, color: "#f59e0b" },
    ],
    radius: 42,
    sinceShrink: 0,
    sinceBotMove: 0,
    over: false,
    winner: null,
    events: { shrank: false, sank: 0, died: false },
  };
}

/** How much the iceberg loses per shrink, growing with the wave. */
export function shrinkAmountFor(wave: number): number {
  return Math.min(2, 0.5 + (wave - 1) * 0.12);
}

export function distanceFromCentre(r: { x: number; y: number }): number {
  const dx = r.x - CENTRE;
  const dy = r.y - CENTRE;
  return Math.sqrt(dx * dx + dy * dy);
}

export interface IceStepOptions {
  wave: number;
  rng: () => number;
}

/** Advances one fixed step. Mutates `s`. */
export function stepIce(s: IceState, dt: number, opts: IceStepOptions): void {
  s.events = { shrank: false, sank: 0, died: false };
  if (s.over) return;

  s.sinceShrink += dt;
  if (s.sinceShrink >= SHRINK_INTERVAL) {
    s.sinceShrink -= SHRINK_INTERVAL;
    s.radius = Math.max(MIN_RADIUS, s.radius - shrinkAmountFor(opts.wave));
    s.events.shrank = true;
  }

  s.sinceBotMove += dt;
  if (s.sinceBotMove >= BOT_INTERVAL) {
    s.sinceBotMove -= BOT_INTERVAL;
    moveBots(s, opts);
  }

  settleIce(s);
}

/**
 * Bots that actually play.
 *
 * The pull towards the centre strengthens the closer a bot is to the edge, so
 * they wander while safe and commit inward when the ice reaches them.
 */
function moveBots(s: IceState, opts: IceStepOptions): void {
  s.racers = s.racers.map((r) => {
    if (!r.alive || !r.isBot) return r;

    const dist = distanceFromCentre(r);
    // 0 at the middle, 1 at the edge.
    const danger = Math.min(1, dist / Math.max(1, s.radius));
    const towardCentre = danger * danger;

    const dirX = (CENTRE - r.x) / Math.max(1, dist);
    const dirY = (CENTRE - r.y) / Math.max(1, dist);
    const wander = 4 * (1 - towardCentre);

    const dx = dirX * towardCentre * 5 + (opts.rng() - 0.5) * wander;
    const dy = dirY * towardCentre * 5 + (opts.rng() - 0.5) * wander;

    return {
      ...r,
      x: Math.max(5, Math.min(95, r.x + dx)),
      y: Math.max(5, Math.min(95, r.y + dy)),
    };
  });
}

/** Anyone outside the iceberg goes into the water. */
function settleIce(s: IceState): void {
  let sank = 0;
  const next = s.racers.map((r) => {
    if (!r.alive) return r;
    if (distanceFromCentre(r) > s.radius) {
      sank += 1;
      return { ...r, alive: false };
    }
    return r;
  });

  // Only write when something changed. The original wrote unconditionally,
  // which is what made the effect loop forever.
  if (sank === 0) return;

  s.racers = next;
  s.events.sank = sank;

  const remaining = s.racers.filter((r) => r.alive);
  if (remaining.length <= 1) {
    s.over = true;
    s.winner = remaining[0]?.name ?? "Nobody";
    s.events.died = remaining[0]?.id !== HUMAN_ID;
  }
}

/** How close a bot has to be to get shoved. */
export const BUMP_RANGE = 10;
const BUMP_FORCE = 2.2;

/**
 * Moves the human, shoving any bot they run into.
 *
 * Clamped to the arena, not to the ice: walking off the edge is a legal (bad)
 * move, and the bump is the only offensive tool in the game — it is how you
 * win rather than merely outlast.
 */
export function moveRacer(s: IceState, dx: number, dy: number): void {
  if (s.over) return;

  const me = s.racers.find((r) => r.id === HUMAN_ID);
  if (!me || !me.alive) return;

  const nextX = Math.max(5, Math.min(95, me.x + dx));
  const nextY = Math.max(5, Math.min(95, me.y + dy));

  s.racers = s.racers.map((r) => {
    if (r.id === HUMAN_ID) return { ...r, x: nextX, y: nextY };
    if (!r.alive) return r;
    // Bumped from where the player ends up, not where they started — shoving
    // from the old position let a bot be pushed by someone who had walked past.
    const dist = Math.hypot(r.x - nextX, r.y - nextY);
    if (dist >= BUMP_RANGE) return r;
    return {
      ...r,
      x: Math.max(0, Math.min(100, r.x + dx * BUMP_FORCE)),
      y: Math.max(0, Math.min(100, r.y + dy * BUMP_FORCE)),
    };
  });

  settleIce(s);
}

export function humanAlive(s: IceState): boolean {
  return s.racers.find((r) => r.id === HUMAN_ID)?.alive === true;
}
