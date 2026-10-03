/**
 * Hot Potato simulation.
 *
 * This game carried the most machinery of any of them: a 100 ms `setInterval`,
 * a `latest` ref mirroring three pieces of state so the interval could read
 * them, and a separate `setTimeout` for the bot's pass. The ref mirror existed
 * because the original did all of its work inside `setTimerSeconds(t => ...)`
 * — calling four other setters from within a state updater, which React
 * re-invokes when it re-bases a queued update and deliberately double-invokes
 * under StrictMode. One logical tick eliminated two players and moved the
 * potato twice.
 *
 * A fixed step over plain state removes the updater, the mirror and the second
 * timer at once: there is one clock, and reading state is just reading state.
 */

import { fuseSecondsFor } from "./scoring";

export interface PotatoPlayer {
  id: string;
  name: string;
  isBot: boolean;
  eliminated: boolean;
}

export interface PotatoState {
  players: PotatoPlayer[];
  /** Index of whoever is holding it. */
  holder: number;
  /** Seconds left on the hidden fuse. */
  fuse: number;
  /** How long the human has held it this turn. */
  held: number;
  /** Seconds until the current bot passes it on. */
  botDelay: number;
  over: boolean;
  winner: string | null;
  events: {
    exploded: boolean;
    /** Set when the human passed, carrying the seconds they held. */
    humanPassedAfter: number | null;
    botPassed: boolean;
    died: boolean;
  };
}

export const HUMAN_INDEX = 0;

export function createPotatoState(rng: () => number = Math.random): PotatoState {
  return {
    players: [
      { id: "p1", name: "You", isBot: false, eliminated: false },
      { id: "p2", name: "SpudLord", isBot: true, eliminated: false },
      { id: "p3", name: "ChefPip", isBot: true, eliminated: false },
      { id: "p4", name: "TaterTot", isBot: true, eliminated: false },
      { id: "p5", name: "ButterAce", isBot: true, eliminated: false },
    ],
    holder: HUMAN_INDEX,
    fuse: fuseSecondsFor(1, rng()),
    held: 0,
    botDelay: 0,
    over: false,
    winner: null,
    events: { exploded: false, humanPassedAfter: null, botPassed: false, died: false },
  };
}

/**
 * The next player still in, skipping anyone eliminated.
 *
 * The original advance was a bare `(idx + 1) % 5`, which could hand the potato
 * to someone already out — and then eliminate them a second time on the next
 * explosion.
 */
export function nextActiveIndex(from: number, roster: PotatoPlayer[]): number {
  for (let step = 1; step <= roster.length; step++) {
    const candidate = (from + step) % roster.length;
    if (!roster[candidate]?.eliminated) return candidate;
  }
  return from;
}

export interface PotatoStepOptions {
  wave: number;
  rng: () => number;
}

/** How long a bot waits before passing. Quick, but not instant. */
function botThinkTime(rng: () => number): number {
  return 0.4 + rng() * 0.8;
}

/** Advances one fixed step. Mutates `s`. */
export function stepPotato(s: PotatoState, dt: number, opts: PotatoStepOptions): void {
  s.events = { exploded: false, humanPassedAfter: null, botPassed: false, died: false };
  if (s.over) return;

  s.fuse -= dt;
  const holder = s.players[s.holder];

  if (holder && !holder.isBot) {
    s.held += dt;
  } else if (holder) {
    s.botDelay -= dt;
    if (s.botDelay <= 0 && s.fuse > 0) {
      passPotato(s, opts);
      s.events.botPassed = true;
      return;
    }
  }

  if (s.fuse <= 0) explode(s, opts);
}

function explode(s: PotatoState, opts: PotatoStepOptions): void {
  s.events.exploded = true;
  s.players = s.players.map((p, i) => (i === s.holder ? { ...p, eliminated: true } : p));

  const remaining = s.players.filter((p) => !p.eliminated);
  if (remaining.length <= 1) {
    s.over = true;
    s.winner = remaining[0]?.name ?? "None";
    s.events.died = true;
    return;
  }

  s.holder = nextActiveIndex(s.holder, s.players);
  // The fuse shortens as the run goes on, with a floor: below about a second
  // and a half there is no decision left, only a coin flip.
  s.fuse = fuseSecondsFor(opts.wave, opts.rng());
  s.held = 0;
  s.botDelay = botThinkTime(opts.rng);
}

/**
 * Hands the potato on.
 *
 * Records how long a human held it so the caller can bank it; a bot passing
 * is not the player's doing and banks nothing.
 */
export function passPotato(s: PotatoState, opts: PotatoStepOptions): void {
  if (s.over) return;
  const holder = s.players[s.holder];
  if (!holder) return;

  if (!holder.isBot) {
    s.events.humanPassedAfter = s.held;
    s.held = 0;
  }

  s.holder = nextActiveIndex(s.holder, s.players);
  s.botDelay = botThinkTime(opts.rng);
}

/** Whether the human is still in. */
export function humanAlive(s: PotatoState): boolean {
  return s.players[HUMAN_INDEX]?.eliminated === false;
}
