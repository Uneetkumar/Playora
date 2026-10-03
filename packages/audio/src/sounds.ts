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
 *
 * The ids are a runtime list, not only a type, so the tests can prove every id
 * has a spec and no spec is orphaned — a union type alone cannot be iterated.
 */
export const SOUND_IDS = [
  // Interface
  "ui.click",
  "ui.hover",
  "ui.select",
  "ui.back",
  "ui.error",
  "ui.notify",
  // Cards
  "card.deal",
  "card.play",
  "card.draw",
  "card.shuffle",
  "card.uno",
  "card.skip",
  "card.reverse",
  "card.wild",
  "card.stack",
  // UNO table events
  "uno.call",
  "uno.caught",
  "player.eliminated",
  // Chess
  "chess.move",
  "chess.capture",
  "chess.castle",
  "chess.check",
  // Board pieces, dice and tiles, for every board and puzzle game
  "piece.move",
  "piece.capture",
  "dice.roll",
  "tile.flip",
  "tile.merge",
  // Racing
  "race.light",
  "race.go",
  "race.gear",
  "race.nitro",
  "race.collision",
  "race.checkpoint",
  // In-game feedback, shorter than the match-flow stings below
  "game.win",
  "game.lose",
  "game.point",
  "game.error",
  // Match flow
  "match.start",
  "match.turn",
  "match.tick",
  "match.victory",
  "match.defeat",
  "match.draw",
  "match.levelup",
] as const;

export type SoundId = (typeof SOUND_IDS)[number];

export type Waveform = "sine" | "square" | "sawtooth" | "triangle";
export type FilterType = "lowpass" | "highpass" | "bandpass";

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
  /** Filter cutoff (or centre, for band-pass) in Hz. Noise without one is harsh at any volume. */
  filter?: number;
  /** Defaults to low-pass, which is what "make it less harsh" almost always means. */
  filterType?: FilterType;
  /** Filter resonance. A high Q on a band-pass turns noise into a whistle. */
  q?: number;
  /** Hz for the filter to sweep to over the layer — a whoosh is noise with a moving filter. */
  endFilter?: number;
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

/**
 * Per-call variation on a sound.
 *
 * This is what lets one spec serve a family of events: `card.stack` rises with
 * every +2 piled on, `tile.merge` climbs with the tile's value, an opponent's
 * collision plays quieter and off to one side.
 */
export interface PlayParams {
  /** Frequency ratio applied to every tone and filter: 2 is an octave up. */
  pitch?: number;
  /** Multiplier on the sound's own level, before bus and master. */
  gain?: number;
  /** Stereo position, -1 hard left to 1 hard right. */
  pan?: number;
  /** Seconds to wait on the audio clock, which is sample-accurate where a timer is not. */
  delay?: number;
}

/**
 * Bounds on `PlayParams`.
 *
 * Callers compute these from game state (stack depth, tile value, distance),
 * so a runaway value is a matter of time. Two octaves either way is already
 * past musical; beyond it a tone either vanishes under 20 Hz or aliases.
 */
export const PLAY_PARAM_LIMITS = {
  pitch: { min: 0.25, max: 4, default: 1 },
  gain: { min: 0, max: 2, default: 1 },
  pan: { min: -1, max: 1, default: 0 },
  delay: { min: 0, max: 10, default: 0 },
} as const;

export type ResolvedPlayParams = Required<PlayParams>;

function clampTo(value: number | undefined, limits: { min: number; max: number; default: number }): number {
  // NaN and Infinity fall back to the default rather than to a bound: a NaN
  // pitch is a bug upstream, and playing it at 4x would hide that it happened.
  if (value === undefined || !Number.isFinite(value)) return limits.default;
  return Math.min(limits.max, Math.max(limits.min, value));
}

export function resolvePlayParams(params: PlayParams = {}): ResolvedPlayParams {
  return {
    pitch: clampTo(params.pitch, PLAY_PARAM_LIMITS.pitch),
    gain: clampTo(params.gain, PLAY_PARAM_LIMITS.gain),
    pan: clampTo(params.pan, PLAY_PARAM_LIMITS.pan),
    delay: clampTo(params.delay, PLAY_PARAM_LIMITS.delay),
  };
}

/** The pitch ratio for `n` semitones: `play("card.stack", { pitch: semitones(depth * 2) })`. */
export function semitones(n: number): number {
  return Math.pow(2, n / 12);
}

/** A sine blip; the building block of almost every sound below. */
export const tone = (
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

/** A burst of low-passed white noise: paper, wood, impact, air. */
export const noise = (duration: number, gain: number, extra: Partial<Layer> = {}): Layer => ({
  kind: "noise",
  delay: 0,
  duration,
  gain,
  attack: 0.001,
  filter: 2200,
  ...extra,
});

/**
 * Dice in a cup: a run of tiny, irregular, band-passed clicks that thin out,
 * then the knock of the landing. Spelled out as data rather than generated at
 * import so the rhythm is the same every roll and can be retuned by eye.
 */
const DICE_CLICKS: ReadonlyArray<readonly [delay: number, gain: number, centre: number]> = [
  [0, 0.26, 3200],
  [0.05, 0.22, 2600],
  [0.09, 0.24, 3800],
  [0.16, 0.2, 2900],
  [0.21, 0.18, 3500],
  [0.3, 0.15, 2700],
  [0.39, 0.12, 3300],
];

export const SOUNDS: Record<SoundId, SoundSpec> = {
  "ui.click": { bus: "ui", layers: [tone(660, 0.06, 0.25, { waveform: "triangle" })], throttleMs: 40 },
  "ui.hover": { bus: "ui", layers: [tone(880, 0.035, 0.1, { waveform: "sine" })], throttleMs: 90 },
  // A confirm reads as "up": two notes a fifth apart, the second landing.
  "ui.select": {
    bus: "ui",
    layers: [tone(660, 0.05, 0.2, { waveform: "triangle" }), tone(990, 0.09, 0.2, { delay: 0.045 })],
    throttleMs: 60,
  },
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
  // The action cards keep the paper slap of `card.play` and add a gesture on
  // top, so a player who is not looking still hears *which* card landed.
  // Skip: a door shutting — two falling, filtered square notes.
  "card.skip": {
    bus: "sfx",
    layers: [
      noise(0.07, 0.3, { filter: 2600 }),
      tone(587, 0.06, 0.22, { waveform: "square", filter: 2000 }),
      tone(392, 0.14, 0.24, { waveform: "square", filter: 1600, delay: 0.07, endFrequency: 349 }),
    ],
    throttleMs: 60,
  },
  // Reverse: a swoop up and straight back down.
  "card.reverse": {
    bus: "sfx",
    layers: [
      noise(0.07, 0.28, { filter: 2600 }),
      tone(330, 0.12, 0.24, { waveform: "triangle", endFrequency: 880 }),
      tone(880, 0.14, 0.22, { waveform: "triangle", endFrequency: 330, delay: 0.12 }),
    ],
    throttleMs: 60,
  },
  // Wild: one quick note per colour, then a shimmer.
  "card.wild": {
    bus: "sfx",
    layers: [
      noise(0.07, 0.26, { filter: 3000 }),
      tone(523, 0.12, 0.2, { delay: 0.02 }),
      tone(659, 0.12, 0.2, { delay: 0.07 }),
      tone(784, 0.12, 0.2, { delay: 0.12 }),
      tone(1046, 0.14, 0.2, { delay: 0.17 }),
      tone(1568, 0.32, 0.1, { waveform: "triangle", delay: 0.22 }),
    ],
    throttleMs: 80,
  },
  // Stack: a punchy hit meant to be replayed higher for each card piled on —
  // pass `{ pitch: semitones(depth * 2) }`.
  "card.stack": {
    bus: "sfx",
    layers: [
      noise(0.09, 0.4, { filter: 2400 }),
      tone(220, 0.12, 0.3, { waveform: "sawtooth", endFrequency: 330, filter: 1800 }),
      tone(440, 0.1, 0.16, { waveform: "square", filter: 2400, delay: 0.03 }),
    ],
    throttleMs: 50,
  },

  // Calling UNO is a shout: a bright, filtered-saw chord rather than a melody,
  // so it cannot be confused with `card.uno` (one card left) right before it.
  "uno.call": {
    bus: "sfx",
    layers: [
      tone(784, 0.08, 0.26, { waveform: "square", filter: 3000 }),
      tone(1046, 0.24, 0.3, { waveform: "sawtooth", filter: 3500, delay: 0.07 }),
      tone(523, 0.3, 0.2, { waveform: "triangle", delay: 0.07 }),
    ],
    throttleMs: 300,
  },
  // Caught without calling it: a penalty buzzer that sags.
  "uno.caught": {
    bus: "sfx",
    layers: [
      tone(311, 0.14, 0.28, { waveform: "square", filter: 1400 }),
      tone(233, 0.3, 0.3, { waveform: "square", filter: 1200, delay: 0.12, endFrequency: 207 }),
      noise(0.1, 0.14, { filter: 900 }),
    ],
    throttleMs: 300,
  },
  // Knocked out: everything falls — two sweeps an octave apart and a rumble.
  "player.eliminated": {
    bus: "sfx",
    layers: [
      tone(440, 0.55, 0.28, { waveform: "sawtooth", endFrequency: 110, filter: 1400 }),
      tone(220, 0.6, 0.24, { waveform: "square", endFrequency: 55, filter: 700, delay: 0.05 }),
      noise(0.35, 0.16, { filter: 800, endFilter: 200, delay: 0.05 }),
    ],
    throttleMs: 200,
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

  // Plastic and wood rather than chess's felt-bottomed weight: higher, with a
  // band-passed tick on top so it reads on phone speakers.
  "piece.move": {
    bus: "sfx",
    layers: [
      tone(240, 0.06, 0.28, { waveform: "triangle", endFrequency: 160 }),
      noise(0.03, 0.14, { filterType: "bandpass", filter: 1800, q: 2 }),
    ],
    throttleMs: 40,
  },
  "piece.capture": {
    bus: "sfx",
    layers: [
      tone(160, 0.12, 0.32, { waveform: "triangle", endFrequency: 90 }),
      noise(0.08, 0.3, { filter: 1600 }),
      tone(320, 0.05, 0.12, { waveform: "square", filter: 1200, delay: 0.04 }),
    ],
    throttleMs: 50,
  },
  "dice.roll": {
    bus: "sfx",
    layers: [
      ...DICE_CLICKS.map(([delay, gain, centre]) =>
        noise(0.03, gain, { delay, filterType: "bandpass", filter: centre, q: 3 }),
      ),
      tone(200, 0.06, 0.22, { waveform: "triangle", endFrequency: 140, delay: 0.46 }),
    ],
    throttleMs: 250,
  },
  "tile.flip": {
    bus: "sfx",
    layers: [noise(0.05, 0.24, { filter: 3500 }), tone(600, 0.06, 0.12, { waveform: "triangle", endFrequency: 900 })],
    throttleMs: 40,
  },
  // A pop that climbs; pass a pitch that rises with the merged value.
  "tile.merge": {
    bus: "sfx",
    layers: [
      tone(330, 0.09, 0.28, { endFrequency: 660 }),
      tone(660, 0.07, 0.12, { waveform: "triangle", endFrequency: 1320, delay: 0.02 }),
    ],
    throttleMs: 30,
  },

  // Start lights: low beeps for the count, one high long one for go — the
  // arcade-racer convention, which players parse faster than reading digits.
  "race.light": {
    bus: "sfx",
    layers: [
      tone(440, 0.2, 0.28, { waveform: "square", filter: 2200, attack: 0.004 }),
      tone(880, 0.2, 0.08, { attack: 0.004 }),
    ],
  },
  "race.go": {
    bus: "sfx",
    layers: [
      tone(880, 0.5, 0.3, { waveform: "square", filter: 3200, attack: 0.004 }),
      tone(1760, 0.5, 0.1, { attack: 0.004 }),
    ],
  },
  // A gear change is a clunk in the box plus a pop from the exhaust as the
  // throttle lifts; the engine loop's pitch drop does the rest.
  "race.gear": {
    bus: "sfx",
    layers: [
      noise(0.05, 0.3, { filter: 1200 }),
      tone(120, 0.08, 0.26, { waveform: "triangle", endFrequency: 60 }),
      noise(0.04, 0.24, { filterType: "bandpass", filter: 600, q: 1.5, delay: 0.02 }),
    ],
    throttleMs: 120,
  },
  // A whoosh is noise behind a band-pass that sweeps up, with a slow swell in.
  "race.nitro": {
    bus: "sfx",
    layers: [
      noise(0.7, 0.4, { filterType: "bandpass", filter: 400, endFilter: 3000, q: 1.2, attack: 0.08 }),
      tone(110, 0.6, 0.14, { waveform: "sawtooth", endFrequency: 220, filter: 800, attack: 0.05 }),
    ],
    throttleMs: 300,
  },
  "race.collision": {
    bus: "sfx",
    layers: [
      tone(100, 0.25, 0.42, { endFrequency: 40 }),
      noise(0.18, 0.38, { filter: 700 }),
      // The metal: a short high-passed crunch over the thud.
      noise(0.08, 0.18, { filterType: "highpass", filter: 2500, delay: 0.01 }),
    ],
    throttleMs: 80,
  },
  "race.checkpoint": {
    bus: "sfx",
    layers: [tone(1046, 0.1, 0.22), tone(1568, 0.25, 0.22, { delay: 0.08 })],
    throttleMs: 200,
  },

  "game.win": {
    bus: "sfx",
    layers: [
      tone(523, 0.1, 0.28),
      tone(659, 0.1, 0.28, { delay: 0.08 }),
      tone(784, 0.1, 0.28, { delay: 0.16 }),
      tone(1046, 0.35, 0.3, { waveform: "triangle", delay: 0.24 }),
    ],
  },
  "game.lose": {
    bus: "sfx",
    layers: [
      tone(392, 0.18, 0.26, { waveform: "triangle", endFrequency: 370 }),
      tone(311, 0.18, 0.26, { waveform: "triangle", delay: 0.16 }),
      tone(262, 0.4, 0.28, { waveform: "triangle", endFrequency: 247, delay: 0.32 }),
    ],
  },
  // The coin: two square notes a fourth apart. Pitch it up for combos.
  "game.point": {
    bus: "sfx",
    layers: [
      tone(988, 0.05, 0.2, { waveform: "square", filter: 4000 }),
      tone(1319, 0.14, 0.2, { waveform: "square", filter: 4000, delay: 0.05 }),
    ],
    throttleMs: 40,
  },
  // In-game "not allowed" (an illegal move), on sfx rather than ui so it obeys
  // the game-sounds slider; two near-unison low notes beat against each other.
  "game.error": {
    bus: "sfx",
    layers: [
      tone(196, 0.16, 0.26, { waveform: "sawtooth", filter: 900 }),
      tone(185, 0.16, 0.22, { waveform: "square", filter: 900 }),
    ],
    throttleMs: 150,
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
export function durationOf(sound: SoundId | SoundSpec): number {
  const spec = typeof sound === "string" ? SOUNDS[sound] : sound;
  return spec.layers.reduce((longest, l) => Math.max(longest, l.delay + l.duration), 0);
}
