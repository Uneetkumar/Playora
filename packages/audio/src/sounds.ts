import type { AudioBus } from "./mixer.js";

/**
 * Every sound the platform can make, described rather than recorded.
 *
 * These are synthesised at play time from oscillators and noise instead of
 * shipped as audio files. Three reasons, in order of importance: there is no
 * licensed sound library in this repo and inventing one would mean shipping
 * assets nobody owns; a card flip is a 40ms transient that costs more in HTTP
 * overhead than in samples; and a described sound can be retuned in a diff.
 *
 * When real recorded audio is licensed later, the `SoundId` union and the
 * engine's `play()` stay as they are — only the source of the waveform changes.
 */
export type SoundId =
  // Interface
  | "ui.click"
  | "ui.hover"
  | "ui.back"
  | "ui.error"
  | "ui.notify"
  // Cards
  | "card.deal"
  | "card.play"
  | "card.draw"
  | "card.shuffle"
  | "card.uno"
  // Chess
  | "chess.move"
  | "chess.capture"
  | "chess.castle"
  | "chess.check"
  // Match flow
  | "match.start"
  | "match.turn"
  | "match.tick"
  | "match.victory"
  | "match.defeat"
  | "match.draw"
  | "match.levelup";

export type Waveform = "sine" | "square" | "sawtooth" | "triangle";

/** One oscillator or noise burst within a sound. */
export interface Layer {
  kind: "tone" | "noise";
  waveform?: Waveform;
  /** Hz at the start of the layer. */
  frequency?: number;
  /** Hz to glide to over the layer's duration. Omitted means no glide. */
  endFrequency?: number;
  /** Seconds from the sound's start. */
  delay: number;
  duration: number;
  /** Peak gain for this layer, before bus and master are applied. */
  gain: number;
  /** Seconds of fade-in. The rest of the layer is the decay. */
  attack: number;
  /** Low-pass cutoff in Hz. Noise without one is harsh at any volume. */
  filter?: number;
}

export interface SoundSpec {
  bus: AudioBus;
  layers: Layer[];
  /**
   * Minimum gap between retriggers, in ms.
   *
   * Dealing seven cards fires seven identical transients; without a floor they
   * phase into a single click, and a hover sound on a list turns into a buzz.
   */
  throttleMs?: number;
}

const tone = (
  frequency: number,
  duration: number,
  gain: number,
  extra: Partial<Layer> = {},
): Layer => ({
  kind: "tone",
  waveform: "sine",
  frequency,
  delay: 0,
  duration,
  gain,
  attack: 0.005,
  ...extra,
});

const noise = (duration: number, gain: number, extra: Partial<Layer> = {}): Layer => ({
  kind: "noise",
  delay: 0,
  duration,
  gain,
  attack: 0.001,
  filter: 2200,
  ...extra,
});

export const SOUNDS: Record<SoundId, SoundSpec> = {
  "ui.click": { bus: "ui", layers: [tone(660, 0.06, 0.25, { waveform: "triangle" })], throttleMs: 40 },
  "ui.hover": { bus: "ui", layers: [tone(880, 0.035, 0.1, { waveform: "sine" })], throttleMs: 90 },
  "ui.back": { bus: "ui", layers: [tone(520, 0.08, 0.22, { waveform: "triangle", endFrequency: 380 })] },
  "ui.error": {
    bus: "ui",
    layers: [
      tone(220, 0.1, 0.3, { waveform: "square" }),
      tone(170, 0.16, 0.25, { waveform: "square", delay: 0.09 }),
    ],
  },
  "ui.notify": {
    bus: "ui",
    layers: [tone(784, 0.09, 0.22), tone(1046, 0.14, 0.18, { delay: 0.08 })],
  },

  // A card is mostly a broadband transient: paper, not pitch.
  "card.deal": { bus: "sfx", layers: [noise(0.07, 0.3, { filter: 3200 })], throttleMs: 45 },
  "card.play": {
    bus: "sfx",
    layers: [noise(0.09, 0.38, { filter: 2600 }), tone(320, 0.06, 0.12, { waveform: "triangle" })],
    throttleMs: 60,
  },
  "card.draw": { bus: "sfx", layers: [noise(0.12, 0.28, { filter: 1800 })], throttleMs: 60 },
  "card.shuffle": {
    bus: "sfx",
    layers: [
      noise(0.16, 0.22, { filter: 3000 }),
      noise(0.16, 0.2, { filter: 2400, delay: 0.09 }),
      noise(0.16, 0.18, { filter: 2000, delay: 0.18 }),
    ],
  },
  "card.uno": {
    bus: "sfx",
    layers: [
      tone(523, 0.12, 0.3),
      tone(659, 0.12, 0.3, { delay: 0.1 }),
      tone(880, 0.22, 0.32, { delay: 0.2 }),
    ],
  },

  // A piece landing on a board is a short, low knock.
  "chess.move": {
    bus: "sfx",
    layers: [tone(180, 0.07, 0.3, { waveform: "triangle", endFrequency: 120 }), noise(0.04, 0.12, { filter: 900 })],
    throttleMs: 50,
  },
  "chess.capture": {
    bus: "sfx",
    layers: [noise(0.1, 0.34, { filter: 1400 }), tone(140, 0.1, 0.32, { waveform: "square", endFrequency: 90 })],
    throttleMs: 50,
  },
  "chess.castle": {
    bus: "sfx",
    layers: [
      tone(190, 0.06, 0.26, { waveform: "triangle" }),
      tone(190, 0.06, 0.26, { waveform: "triangle", delay: 0.11 }),
    ],
  },
  "chess.check": {
    bus: "sfx",
    layers: [tone(880, 0.1, 0.3, { waveform: "square" }), tone(1174, 0.16, 0.26, { delay: 0.08 })],
  },

  "match.start": {
    bus: "sfx",
    layers: [tone(392, 0.14, 0.3), tone(523, 0.14, 0.3, { delay: 0.12 }), tone(659, 0.26, 0.32, { delay: 0.24 })],
  },
  "match.turn": { bus: "sfx", layers: [tone(700, 0.09, 0.22, { waveform: "triangle" })], throttleMs: 400 },
  // The clock: dry, quiet, and impossible to mistake for anything else.
  "match.tick": { bus: "sfx", layers: [tone(1200, 0.03, 0.14, { waveform: "square" })], throttleMs: 400 },
  "match.victory": {
    bus: "sfx",
    layers: [
      tone(523, 0.16, 0.32),
      tone(659, 0.16, 0.32, { delay: 0.14 }),
      tone(784, 0.16, 0.32, { delay: 0.28 }),
      tone(1046, 0.44, 0.34, { delay: 0.42 }),
    ],
  },
  "match.defeat": {
    bus: "sfx",
    layers: [
      tone(392, 0.2, 0.28, { waveform: "triangle" }),
      tone(330, 0.2, 0.28, { waveform: "triangle", delay: 0.18 }),
      tone(262, 0.5, 0.3, { waveform: "triangle", delay: 0.36 }),
    ],
  },
  "match.draw": {
    bus: "sfx",
    layers: [tone(440, 0.2, 0.26, { waveform: "triangle" }), tone(440, 0.3, 0.24, { waveform: "triangle", delay: 0.22 })],
  },
  "match.levelup": {
    bus: "sfx",
    layers: [
      tone(659, 0.1, 0.3),
      tone(880, 0.1, 0.3, { delay: 0.09 }),
      tone(1046, 0.1, 0.3, { delay: 0.18 }),
      tone(1318, 0.36, 0.32, { delay: 0.27 }),
    ],
  },
};

/** Total wall-clock length of a sound, so callers can sequence around it. */
export function durationOf(id: SoundId): number {
  const spec = SOUNDS[id];
  return spec.layers.reduce((longest, l) => Math.max(longest, l.delay + l.duration), 0);
}
