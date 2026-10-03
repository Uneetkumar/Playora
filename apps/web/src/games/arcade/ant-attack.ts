/**
 * Ant Attack simulation.
 *
 * This game ran on **three** clocks: a 550 ms `setInterval` spawning bugs, a
 * `requestAnimationFrame` loop moving them, and a third `setInterval` counting
 * the spray cooldown down. rAF stops in a background tab and `setInterval` does
 * not, so switching away and back returned the player to a screen full of bugs
 * that had spawned but never moved — the same class of bug that had the Rope
 * Rescue blade frozen while its survivors kept scoring.
 *
 * The spawn interval was also a hardcoded 550 ms, so despite a wave badge and a
 * difficulty ramp elsewhere in the game, bugs arrived at exactly the same rate
 * in minute five as in second five.
 *
 * Movement, spawning and the cooldown now share one fixed step. Rendering stays
 * in the view, where the canvas is.
 */

export type BugType = "worker" | "fire" | "beetle" | "queen" | "golden";

export interface Bug {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  type: BugType;
  hp: number;
  maxHp: number;
  size: number;
  legPhase: number;
  color: string;
}

export interface AntState {
  bugs: Bug[];
  cakeHealth: number;
  /** Seconds left before the spray can be used again. */
  sprayCooldown: number;
  sinceSpawn: number;
  nextId: number;
  /**
   * Seconds left before a whiff costs the chain, or null when not counting.
   *
   * This was a `setTimeout` in the view — a fourth clock, and one with a
   * subtle flaw: a whiff scheduled the chain break and only *another whiff*
   * cancelled it, so killing a bug immediately after a near-miss did not save
   * the streak the player had just fought for. A kill clears it now.
   */
  whiffGrace: number | null;
  over: boolean;
  events: { reachedCake: number; died: boolean; chainBroken: boolean };
}

/** Everything that distinguishes one bug from another, in one table. */
export const BUG_KINDS: Record<
  BugType,
  { hp: number; size: number; speed: [number, number]; color: string; damage: number; points: number }
> = {
  worker: { hp: 1, size: 18, speed: [1.6, 2.4], color: "#18181b", damage: 8, points: 20 },
  fire: { hp: 1, size: 20, speed: [2.4, 2.4], color: "#dc2626", damage: 8, points: 40 },
  beetle: { hp: 2, size: 26, speed: [1.2, 1.2], color: "#15803d", damage: 15, points: 80 },
  queen: { hp: 4, size: 34, speed: [1.1, 1.1], color: "#831843", damage: 25, points: 200 },
  golden: { hp: 1, size: 20, speed: [3.4, 3.4], color: "#eab308", damage: 8, points: 150 },
};

export const START_HEALTH = 100;
export const SPRAY_COOLDOWN = 12;
/** How long a whiff has before it costs the chain. */
export const WHIFF_GRACE = 1.2;

export function createAntState(): AntState {
  return {
    bugs: [],
    cakeHealth: START_HEALTH,
    sprayCooldown: 0,
    sinceSpawn: 0,
    nextId: 1,
    whiffGrace: null,
    over: false,
    events: { reachedCake: 0, died: false, chainBroken: false },
  };
}

/** Picks a bug kind. Rarer, tougher bugs become likelier as waves climb. */
export function rollBugType(rng: () => number, wave: number): BugType {
  const r = rng();
  // The golden bug stays rare; the heavies grow their share with the wave.
  const heavy = Math.min(0.55, 0.3 + (wave - 1) * 0.03);
  if (r < 0.08) return "golden";
  if (r < 0.08 + heavy * 0.3) return "queen";
  if (r < 0.08 + heavy * 0.75) return "beetle";
  if (r < 0.08 + heavy) return "fire";
  return "worker";
}

export interface AntStepOptions {
  /** Canvas size, so spawn and target positions track the arena. */
  width: number;
  height: number;
  /** From the shared run, so the swarm actually thickens. */
  spawnIntervalMs: number;
  wave: number;
  rng: () => number;
}

/** Where the cake sits, as a y coordinate. */
export function cakeY(height: number): number {
  return height - 40;
}

export function spawnBug(s: AntState, opts: AntStepOptions): Bug {
  const type = rollBugType(opts.rng, opts.wave);
  const kind = BUG_KINDS[type];
  const spawnX = opts.rng() * Math.max(1, opts.width - 120) + 60;
  const spawnY = -30;
  const targetX = opts.width * 0.5 + (opts.rng() - 0.5) * (opts.width * 0.6);
  const targetY = cakeY(opts.height);
  const [minSpeed, maxSpeed] = kind.speed;

  return {
    id: s.nextId++,
    x: spawnX,
    y: spawnY,
    angle: Math.atan2(targetY - spawnY, targetX - spawnX),
    speed: minSpeed + opts.rng() * (maxSpeed - minSpeed),
    type,
    hp: kind.hp,
    maxHp: kind.hp,
    size: kind.size,
    legPhase: opts.rng() * Math.PI * 2,
    color: kind.color,
  };
}

/** Advances one fixed step. Mutates `s`. */
export function stepAnts(s: AntState, dt: number, opts: AntStepOptions): void {
  s.events = { reachedCake: 0, died: false, chainBroken: false };
  if (s.over) return;

  s.sprayCooldown = Math.max(0, s.sprayCooldown - dt);

  if (s.whiffGrace !== null) {
    s.whiffGrace -= dt;
    if (s.whiffGrace <= 0) {
      s.whiffGrace = null;
      // The reward is for keeping up, not for eventually clicking everything.
      s.events.chainBroken = true;
    }
  }

  s.sinceSpawn += dt * 1000;
  if (s.sinceSpawn >= opts.spawnIntervalMs) {
    s.sinceSpawn = 0;
    s.bugs.push(spawnBug(s, opts));
  }

  const reachLine = cakeY(opts.height) - 10;
  for (let i = s.bugs.length - 1; i >= 0; i--) {
    const bug = s.bugs[i]!;
    bug.legPhase += dt * 18 * (bug.speed / 1.5);
    // A little wander so a swarm does not march in formation.
    bug.angle += (opts.rng() - 0.5) * 0.08;
    // `speed` is in units per 1/60s, kept from the original tuning, so the
    // multiply by 60 converts it to units per second.
    bug.x += Math.cos(bug.angle) * bug.speed * dt * 60;
    bug.y += Math.sin(bug.angle) * bug.speed * dt * 60;

    if (bug.y >= reachLine) {
      s.bugs.splice(i, 1);
      s.cakeHealth = Math.max(0, s.cakeHealth - BUG_KINDS[bug.type].damage);
      s.events.reachedCake += 1;
      if (s.cakeHealth <= 0) {
        s.over = true;
        s.events.died = true;
        return;
      }
    }
  }
}

export interface SwatResult {
  hit: boolean;
  killed: Bug | null;
  points: number;
}

/** Swats at a point. Returns what happened so the view can score and splatter. */
export function swat(s: AntState, x: number, y: number): SwatResult {
  if (s.over) return { hit: false, killed: null, points: 0 };

  for (let i = s.bugs.length - 1; i >= 0; i--) {
    const bug = s.bugs[i]!;
    // A generous radius: a finger is not a mouse pointer, and this is the
    // difference between the game feeling responsive and feeling broken.
    const hitRadius = Math.max(48, bug.size * 2.2);
    if (Math.hypot(bug.x - x, bug.y - y) >= hitRadius) continue;

    bug.hp -= 1;
    // Connecting saves the streak, which is what a near-miss followed by a
    // kill should feel like.
    s.whiffGrace = null;
    if (bug.hp <= 0) {
      s.bugs.splice(i, 1);
      return { hit: true, killed: bug, points: BUG_KINDS[bug.type].points };
    }
    return { hit: true, killed: null, points: 0 };
  }

  s.whiffGrace = WHIFF_GRACE;
  return { hit: false, killed: null, points: 0 };
}

/** Clears the board. Returns how many were caught, or null if not ready. */
export function fireSpray(s: AntState): number | null {
  if (s.over || s.sprayCooldown > 0) return null;
  const caught = s.bugs.length;
  s.bugs = [];
  s.sprayCooldown = SPRAY_COOLDOWN;
  return caught;
}
