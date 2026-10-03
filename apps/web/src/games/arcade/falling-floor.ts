/**
 * Falling Floor simulation.
 *
 * The collapse used to be a `setTimeout` created inside an effect, one per
 * tile. That needed a cleanup to stop a pending collapse outliving a restart —
 * the floor dropping out from under a player who had done nothing — and the
 * cleanup only worked because the effect happened to re-run. Making the
 * countdown part of the tile removes the whole category: there is no timer to
 * outlive anything, and `createFloorState()` is a complete reset by
 * construction.
 *
 * Pure: no React, no DOM, no clock.
 */

export type TileState = "intact" | "shaking" | "collapsed";

export interface HexTile {
  id: number;
  row: number;
  col: number;
  layer: number;
  state: TileState;
  /** Seconds until this tile collapses. Only meaningful while shaking. */
  shakeLeft: number;
}

export interface FloorState {
  tiles: HexTile[];
  layer: number;
  row: number;
  col: number;
  /** Seconds survived, fractional. */
  survived: number;
  /** Whole seconds already paid for, so a second is never scored twice. */
  secondsPaid: number;
  prize: { row: number; col: number } | null;
  over: boolean;
  /** Consumed by the view each step for scoring and juice. */
  events: {
    secondsSurvived: number;
    prizeTaken: boolean;
    fellThrough: boolean;
    died: boolean;
  };
}

export const GRID = 5;
export const LAYERS = 3;
const START_ROW = 2;
const START_COL = 2;

/**
 * How long a tile holds once stepped on.
 *
 * This was a flat 800 ms, so the game never got harder — the only escalation
 * was the player's own boredom. It now tightens with the wave and floors at
 * 320 ms, which is still enough time to reach an adjacent tile.
 */
export function collapseDelayFor(wave: number): number {
  return Math.max(0.32, 0.9 - (wave - 1) * 0.07);
}

export function createFloorState(rng: () => number = Math.random): FloorState {
  const tiles: HexTile[] = [];
  let id = 1;
  for (let layer = 1; layer <= LAYERS; layer++) {
    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        tiles.push({ id: id++, row, col, layer, state: "intact", shakeLeft: 0 });
      }
    }
  }
  return {
    tiles,
    layer: 1,
    row: START_ROW,
    col: START_COL,
    survived: 0,
    secondsPaid: 0,
    prize: randomPrize(rng),
    over: false,
    events: { secondsSurvived: 0, prizeTaken: false, fellThrough: false, died: false },
  };
}

function randomPrize(rng: () => number) {
  return { row: Math.floor(rng() * GRID), col: Math.floor(rng() * GRID) };
}

export interface FloorStepOptions {
  /** Current wave, so the collapse delay can tighten. */
  wave: number;
  rng: () => number;
}

/** Advances one fixed step. Mutates `s`. */
export function stepFloor(s: FloorState, dt: number, opts: FloorStepOptions): void {
  s.events = { secondsSurvived: 0, prizeTaken: false, fellThrough: false, died: false };
  if (s.over) return;

  s.survived += dt;
  const wholeSeconds = Math.floor(s.survived);
  if (wholeSeconds > s.secondsPaid) {
    s.events.secondsSurvived = wholeSeconds - s.secondsPaid;
    s.secondsPaid = wholeSeconds;
  }

  for (const t of s.tiles) {
    if (t.state !== "shaking") continue;
    t.shakeLeft -= dt;
    if (t.shakeLeft <= 0) {
      t.state = "collapsed";
      t.shakeLeft = 0;
    }
  }

  settle(s, opts);
}

/**
 * Resolves where the player is standing.
 *
 * Shared by the step and by movement, because "did the floor just go" and
 * "did I just step onto nothing" are the same question and were previously
 * answered in two places.
 */
function settle(s: FloorState, opts: FloorStepOptions): void {
  const tile = tileAt(s, s.layer, s.row, s.col);

  if (!tile || tile.state === "collapsed") {
    if (s.layer < LAYERS) {
      s.layer += 1;
      s.events.fellThrough = true;
      return;
    }
    s.over = true;
    s.events.died = true;
    return;
  }

  if (s.prize && s.prize.row === s.row && s.prize.col === s.col) {
    s.events.prizeTaken = true;
    s.prize = randomPrize(opts.rng);
  }

  if (tile.state === "intact") {
    tile.state = "shaking";
    tile.shakeLeft = collapseDelayFor(opts.wave);
  }
}

export function tileAt(
  s: FloorState,
  layer: number,
  row: number,
  col: number,
): HexTile | undefined {
  return s.tiles.find((t) => t.layer === layer && t.row === row && t.col === col);
}

/** Moves the player one step, clamped to the grid. */
export function moveFloor(
  s: FloorState,
  dr: number,
  dc: number,
  opts: FloorStepOptions,
): void {
  if (s.over) return;
  s.row = Math.max(0, Math.min(GRID - 1, s.row + dr));
  s.col = Math.max(0, Math.min(GRID - 1, s.col + dc));
  settle(s, opts);
}
