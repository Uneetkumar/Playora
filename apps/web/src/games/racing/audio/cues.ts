import { noise, semitones, SOUNDS, tone, type Layer, type PlayParams } from "@playora/audio";

/**
 * The race's one-shot sounds, as data.
 *
 * Kept apart from race-audio.ts so the whole set can be listed, auditioned on
 * the dev bench and checked by a test for an event without a sound — the
 * event list is a contract other code fires against.
 */
export const RACE_AUDIO_EVENTS = [
  "countdown-beep",
  "go",
  "gear-up",
  "gear-down",
  "nitro",
  "collision",
  "skid-start",
  "lap",
  "final-lap",
  "finish",
  "coin",
  "boost-pad",
  "mini-turbo",
] as const;

export type RaceAudioEvent = (typeof RACE_AUDIO_EVENTS)[number];

export const RACE_CUES: Record<RaceAudioEvent, readonly Layer[]> = {
  // Start lights: a low beep per light, then one high, long one for go. The
  // pitch change carries the meaning, so a player watching the track rather
  // than the gantry still launches on time.
  "countdown-beep": [
    tone(698.5, 0.3, 0.4, { waveform: "square", filter: 2400, attack: 0.003 }),
    tone(1397, 0.3, 0.08, { attack: 0.003 }),
  ],
  go: [
    tone(1396.9, 0.9, 0.4, { waveform: "square", filter: 4200, attack: 0.003 }),
    tone(2793.8, 0.9, 0.08, { attack: 0.003 }),
    tone(698.5, 0.5, 0.12, { waveform: "triangle", attack: 0.003 }),
  ],
  // The clunk in the box. The throttle cut and the exhaust do the rest.
  "gear-up": [
    noise(0.035, 0.22, { filter: 1400 }),
    tone(140, 0.06, 0.2, { waveform: "triangle", endFrequency: 70 }),
  ],
  "gear-down": [
    noise(0.04, 0.22, { filter: 1100 }),
    tone(120, 0.07, 0.2, { waveform: "triangle", endFrequency: 60 }),
  ],
  // A whoosh: noise behind a band-pass sweeping up, under a rising growl.
  nitro: [
    noise(0.9, 0.28, { filterType: "bandpass", filter: 350, endFilter: 3400, q: 1.1, attack: 0.06 }),
    tone(90, 0.7, 0.1, { waveform: "sawtooth", endFrequency: 190, filter: 700, attack: 0.05 }),
  ],
  // The thud; strength scales level and drops the pitch (see cueParams).
  collision: [
    tone(95, 0.28, 0.45, { endFrequency: 38 }),
    noise(0.2, 0.38, { filter: 650 }),
  ],
  // Tyres breaking away: a short chirp ahead of the continuous squeal.
  "skid-start": [noise(0.18, 0.6, { filterType: "bandpass", filter: 1900, endFilter: 1500, q: 3, attack: 0.01 })],
  lap: [tone(1318.5, 0.12, 0.2), tone(1975.5, 0.4, 0.2, { delay: 0.1 })],
  // More urgent than a lap: three notes, the last a fifth up and held.
  "final-lap": [
    tone(987.8, 0.1, 0.18, { waveform: "square", filter: 3000 }),
    tone(987.8, 0.1, 0.18, { waveform: "square", filter: 3000, delay: 0.14 }),
    tone(1480, 0.55, 0.2, { waveform: "square", filter: 3600, delay: 0.28 }),
    tone(2960, 0.55, 0.05, { delay: 0.28 }),
  ],
  // A rising arpeggio into a held chord, over a crowd swelling in the stands.
  finish: [
    tone(1046.5, 0.14, 0.2),
    tone(1318.5, 0.14, 0.2, { delay: 0.11 }),
    tone(1568, 0.14, 0.2, { delay: 0.22 }),
    tone(2093, 0.9, 0.22, { waveform: "triangle", delay: 0.33 }),
    tone(1046.5, 0.9, 0.1, { waveform: "triangle", delay: 0.33 }),
    tone(1318.5, 0.9, 0.08, { delay: 0.33 }),
    noise(2.6, 0.12, { filterType: "bandpass", filter: 1100, q: 0.6, attack: 0.6, delay: 0.2 }),
  ],
  coin: SOUNDS["game.point"].layers,
  "boost-pad": [
    tone(220, 0.35, 0.2, { waveform: "sawtooth", endFrequency: 880, filter: 2200 }),
    noise(0.45, 0.4, { filterType: "bandpass", filter: 600, endFilter: 4200, q: 1.3, attack: 0.03 }),
  ],
  // Pitched up per tier, so the third tier is heard to be the big one.
  "mini-turbo": [
    noise(0.32, 0.42, { filterType: "bandpass", filter: 900, endFilter: 3600, q: 1.4, attack: 0.01 }),
    tone(330, 0.22, 0.18, { waveform: "square", endFrequency: 990, filter: 3000 }),
  ],
};

/** A heavy hit adds the crunch of bodywork on top of the thud. */
export const METAL_CRUNCH: readonly Layer[] = [
  noise(0.1, 0.2, { filterType: "highpass", filter: 2500, delay: 0.008 }),
  noise(0.22, 0.12, { filterType: "bandpass", filter: 1400, q: 3, delay: 0.02 }),
];

/** A turbo's blow-off valve: a falling hiss. */
export const BLOW_OFF: readonly Layer[] = [
  noise(0.3, 0.07, { filterType: "bandpass", filter: 2600, endFilter: 1200, q: 2, attack: 0.005 }),
];

/** Minimum seconds between two of the same cue, so a scrape is not a buzz. */
export const CUE_GAP: Partial<Record<RaceAudioEvent, number>> = {
  collision: 0.07,
  "skid-start": 0.25,
  coin: 0.04,
  "gear-up": 0.08,
  "gear-down": 0.08,
  nitro: 0.3,
  "boost-pad": 0.15,
};

const clamp01 = (n: number | undefined, fallback: number): number =>
  n === undefined || !Number.isFinite(n) ? fallback : Math.min(1, Math.max(0, n));

/** How loud and how high a cue plays for an event's strength. */
export function cueParams(event: RaceAudioEvent, strength?: number): PlayParams {
  switch (event) {
    case "collision": {
      const s = clamp01(strength, 0.6);
      return { gain: 0.25 + 0.95 * s, pitch: 1.15 - 0.35 * s };
    }
    case "skid-start":
      return { gain: 0.5 + 0.7 * clamp01(strength, 0.6) };
    case "mini-turbo": {
      const tier = Math.min(3, Math.max(1, Math.round(strength ?? 1)));
      return { pitch: semitones((tier - 1) * 3), gain: 0.8 + 0.15 * tier };
    }
    case "coin":
      return { gain: 0.7 };
    default:
      return {};
  }
}
