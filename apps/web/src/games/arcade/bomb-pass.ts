/**
 * Bomb Pass simulation.
 *
 * Replaces two `setInterval`s — a 100 ms fuse tick and a 1200 ms AI loop — plus
 * the `latest` ref that mirrored players/holder/gameOver so both could read
 * them. The mirror was there because the original ran its whole elimination
 * inside `setFuseTime(t => ...)`, which StrictMode double-invokes.
 *
 * Two gameplay problems came out of the extraction:
 *
 *   - The fuse reset to a hardcoded 7.0 after every explosion, so the wave
 *     badge described an escalation the bomb never performed.
 *   - Bots passed on a flat 35% roll every 1200 ms, completely blind to how
 *     much fuse was left. A bot holding a bomb about to go off behaved exactly
 *     like one holding a fresh one, which made them feel like furniture rather
 *     than opponents.
 */

export interface BombPlayer {
  id: string;
  name: string;
  isBot: boolean;
  x: number;
  y: number;
  alive: boolean;
  color: string;
}

export interface BombState {
  players: BombPlayer[];
  holderId: string;
  /** Seconds left on the fuse. Visible to the player — the bet is readable. */
  fuse: number;
  /** How long the human has held it this pass. */
  held: number;
  /** Seconds until the holding bot next considers passing. */
  botThink: number;
  round: number;
  over: boolean;
  winner: string | null;
  events: {
    exploded: boolean;
    /** True when the human survived the round the bomb went off. */
    survivedRound: boolean;
    died: boolean;
    botPassed: boolean;
  };
}

export const HUMAN_ID = "p1";
const START_FUSE = 8;

export function createBombState(): BombState {
  return {
    players: [
      { id: "p1", name: "You", isBot: false, x: 25, y: 70, alive: true, color: "#06b6d4" },
      { id: "p2", name: "ApexBot", isBot: true, x: 75, y: 30, alive: true, color: "#f59e0b" },
      { id: "p3", name: "CyberAce", isBot: true, x: 30, y: 30, alive: true, color: "#a855f7" },
      { id: "p4", name: "Shadow", isBot: true, x: 70, y: 70, alive: true, color: "#10b981" },
    ],
    holderId: HUMAN_ID,
    fuse: START_FUSE,
    held: 0,
    botThink: 0.6,
    round: 1,
    over: false,
    winner: null,
    events: { exploded: false, survivedRound: false, died: false, botPassed: false },
  };
}

/**
 * Fuse length for a new round.
 *
 * Was a hardcoded 7.0. Shortens with the wave and floors at 3s, below which
 * there is no time to decide who to pass to.
 */
export function fuseForWave(wave: number): number {
  return Math.max(3, 7.5 - (wave - 1) * 0.45);
}

/**
 * How likely a holding bot is to pass this decision.
 *
 * Rises sharply as the fuse burns down: a bot sitting on two seconds should be
 * desperate, not indifferent. The old flat 35% made them read as scenery.
 */
export function botPassChance(fuseLeft: number): number {
  if (fuseLeft <= 1.5) return 0.95;
  if (fuseLeft <= 3) return 0.7;
  if (fuseLeft <= 5) return 0.4;
  return 0.2;
}

export interface BombStepOptions {
  wave: number;
  rng: () => number;
}

const aliveOf = (s: BombState) => s.players.filter((p) => p.alive);

/** Advances one fixed step. Mutates `s`. */
export function stepBomb(s: BombState, dt: number, opts: BombStepOptions): void {
  s.events = { exploded: false, survivedRound: false, died: false, botPassed: false };
  if (s.over) return;

  s.fuse -= dt;
  const holder = s.players.find((p) => p.id === s.holderId);

  if (holder && !holder.isBot) {
    s.held += dt;
  } else if (holder) {
    s.botThink -= dt;
    if (s.botThink <= 0 && s.fuse > 0) {
      s.botThink = 0.5 + opts.rng() * 0.7;
      if (opts.rng() < botPassChance(s.fuse)) {
        const targets = s.players.filter((p) => p.alive && p.id !== s.holderId);
        const target = targets[Math.floor(opts.rng() * targets.length)];
        if (target) {
          s.holderId = target.id;
          s.events.botPassed = true;
          return;
        }
      }
    }
  }

  if (s.fuse <= 0) explode(s, opts);
}

function explode(s: BombState, opts: BombStepOptions): void {
  const holder = s.holderId;
  s.events.exploded = true;
  s.players = s.players.map((p) => (p.id === holder ? { ...p, alive: false } : p));

  const remaining = aliveOf(s);
  if (remaining.length <= 1) {
    s.over = true;
    s.winner = remaining[0]?.name ?? "None";
    s.events.died = holder === HUMAN_ID;
    if (!s.events.died) s.events.survivedRound = true;
    return;
  }

  // The human only scores a round they were not holding the bomb for.
  s.events.survivedRound = holder !== HUMAN_ID;
  s.events.died = holder === HUMAN_ID;

  const nextHolder = remaining[Math.floor(opts.rng() * remaining.length)]!;
  s.holderId = nextHolder.id;
  s.round += 1;
  s.fuse = fuseForWave(opts.wave);
  // Whatever was riding on the hold is lost with the explosion.
  s.held = 0;
  s.botThink = 0.5 + opts.rng() * 0.7;
}

/**
 * Hands the bomb on. Returns the seconds held, for banking.
 *
 * The fuse deliberately does **not** reset: whoever receives it inherits
 * however little is left. That is the whole strategy — hold long enough to be
 * worth something, then hand on a bomb nobody can survive.
 */
export function passBomb(s: BombState, targetId: string): number | null {
  if (s.over || s.holderId !== HUMAN_ID) return null;
  const target = s.players.find((p) => p.id === targetId);
  if (!target || !target.alive || target.id === HUMAN_ID) return null;

  const held = s.held;
  s.held = 0;
  s.holderId = targetId;
  s.botThink = 0.4;
  return held;
}

export function humanAlive(s: BombState): boolean {
  return s.players.find((p) => p.id === HUMAN_ID)?.alive === true;
}
