import { UNO_COLORS, type UnoCard, type UnoColor, type UnoValue } from "./types.js";

/**
 * Deterministic RNG (mulberry32).
 *
 * The server is authoritative over shuffling, and a seeded generator means a
 * match can be replayed exactly from its starting state — which is what makes
 * dealing testable and disputes resolvable.
 */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const NUMBER_VALUES: UnoValue[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const ACTION_VALUES: UnoValue[] = ["skip", "reverse", "draw2"];

/**
 * A standard 108-card UNO deck:
 * per colour — one 0, two each of 1-9, two each of skip/reverse/draw2 (25 x 4),
 * plus four wilds and four wild draw fours.
 */
export function buildDeck(): UnoCard[] {
  const cards: UnoCard[] = [];
  let n = 0;
  const push = (color: UnoColor | null, value: UnoValue) =>
    cards.push({ id: `c${n++}`, color, value });

  for (const color of UNO_COLORS) {
    push(color, "0");
    for (const value of NUMBER_VALUES) {
      push(color, value);
      push(color, value);
    }
    for (const value of ACTION_VALUES) {
      push(color, value);
      push(color, value);
    }
  }
  for (let i = 0; i < 4; i++) {
    push(null, "wild");
    push(null, "wild_draw4");
  }
  return cards;
}

/** Fisher-Yates, driven by the seeded RNG so shuffles are reproducible. */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i]!;
    const b = out[j]!;
    out[i] = b;
    out[j] = a;
  }
  return out;
}
