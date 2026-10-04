import type { EngineVoiceSpec } from "@playora/audio";

/**
 * How each car and bike in the garage sounds.
 *
 * Keyed by the garage's model id, because the sound is a property of the
 * engine layout, not of the paint or the name: a flat-six, a V12 and a
 * cross-plane V8 at the same revs differ mostly in firing frequency (cylinders)
 * and in how uneven the firing is (lump), and the rest is filter colour. The
 * numbers were tuned by ear on the /dev/race-audio bench against the engines
 * garage.ts describes.
 */
export interface RaceEngineProfile {
  key: string;
  /** Shown on the dev bench. */
  label: string;
  voice: EngineVoiceSpec;
  /** 0..1: how readily the exhaust pops on the overrun and on downshifts. */
  crackle: number;
  /** Rally anti-lag: bangs on every lift, not only from high revs. */
  antiLag: boolean;
  /** A turbo's blow-off valve hisses when the throttle snaps shut on boost. */
  blowOff: boolean;
}

const profile = (key: string, label: string, voice: EngineVoiceSpec, extra: Partial<RaceEngineProfile> = {}): RaceEngineProfile => ({
  key,
  label,
  voice,
  crackle: 0.4,
  antiLag: false,
  blowOff: false,
  ...extra,
});

export const ENGINE_PROFILES: Record<string, RaceEngineProfile> = {
  // Twin-turbo flat-six: smooth and mechanical, a rasp on top, muffled by the turbos.
  gt: profile(
    "gt",
    "Flat-six twin-turbo",
    {
      cylinders: 6,
      saw: 0.45,
      square: 0.3,
      sub: 0.3,
      detune: 9,
      lump: 0.06,
      intake: 0.35,
      turbo: 0.5,
      cutoff: [380, 3600],
      q: 1.8,
      shaper: 0.55,
      drive: [0.6, 2],
      gain: 0.3,
    },
    { crackle: 0.45, blowOff: true },
  ),
  // Naturally aspirated V12: twelve firings per cycle make a high, smooth howl
  // that keeps climbing; the intake is a big part of it.
  supercar: profile(
    "supercar",
    "V12, naturally aspirated",
    {
      cylinders: 12,
      saw: 0.55,
      square: 0.2,
      sub: 0.2,
      detune: 6,
      lump: 0,
      intake: 0.5,
      turbo: 0,
      cutoff: [450, 5200],
      q: 2.4,
      shaper: 0.45,
      drive: [0.5, 1.8],
      gain: 0.3,
    },
    { crackle: 0.35 },
  ),
  // Turbo four: buzzy, square-heavy, the whistle loud enough to hear.
  hatch: profile(
    "hatch",
    "Inline-four turbo",
    {
      cylinders: 4,
      saw: 0.35,
      square: 0.45,
      sub: 0.18,
      detune: 12,
      lump: 0.05,
      intake: 0.4,
      turbo: 0.8,
      cutoff: [380, 3000],
      q: 1.5,
      shaper: 0.65,
      drive: [0.6, 2.2],
      gain: 0.28,
    },
    { crackle: 0.4, blowOff: true },
  ),
  // Cross-plane V8: the burble is uneven firing, so it is mostly lump and sub.
  muscle: profile(
    "muscle",
    "V8, cross-plane",
    {
      cylinders: 8,
      saw: 0.5,
      square: 0.25,
      sub: 0.55,
      detune: 16,
      lump: 0.4,
      intake: 0.25,
      turbo: 0,
      cutoff: [260, 2400],
      q: 1.2,
      shaper: 0.8,
      drive: [0.7, 2.6],
      gain: 0.32,
    },
    { crackle: 0.85 },
  ),
  // Rally four with anti-lag: harsh, gritty, and banging on every lift.
  rally: profile(
    "rally",
    "Inline-four turbo, anti-lag",
    {
      cylinders: 4,
      saw: 0.4,
      square: 0.45,
      sub: 0.22,
      detune: 10,
      lump: 0.1,
      intake: 0.45,
      turbo: 1,
      cutoff: [420, 3400],
      q: 1.7,
      shaper: 0.72,
      drive: [0.7, 2.5],
      gain: 0.3,
    },
    { crackle: 1, antiLag: true, blowOff: true },
  ),
  // A high-revving racing four: thin, resonant, all intake.
  formula: profile(
    "formula",
    "Racing inline-four turbo",
    {
      cylinders: 4,
      saw: 0.3,
      square: 0.55,
      sub: 0.1,
      detune: 6,
      lump: 0.03,
      intake: 0.55,
      turbo: 0.45,
      cutoff: [600, 6000],
      q: 3,
      shaper: 0.5,
      drive: [0.6, 2],
      gain: 0.28,
    },
    { crackle: 0.25, blowOff: true },
  ),

  // Bikes rev twice as high and have no body around the engine: a thinner,
  // more nasal timbre, less sub, the intake right under the rider.
  "bike-sport": profile(
    "bike-sport",
    "600 cc inline-four",
    {
      cylinders: 4,
      saw: 0.25,
      square: 0.55,
      sub: 0.06,
      detune: 7,
      lump: 0.02,
      intake: 0.6,
      turbo: 0,
      cutoff: [650, 6500],
      q: 2.8,
      shaper: 0.5,
      drive: [0.6, 1.9],
      gain: 0.24,
    },
    { crackle: 0.35 },
  ),
  "bike-hyper": profile(
    "bike-hyper",
    "1000 cc inline-four",
    {
      cylinders: 4,
      saw: 0.32,
      square: 0.5,
      sub: 0.1,
      detune: 8,
      lump: 0.04,
      intake: 0.55,
      turbo: 0,
      cutoff: [560, 5800],
      q: 2.4,
      shaper: 0.58,
      drive: [0.6, 2.1],
      gain: 0.26,
    },
    { crackle: 0.45 },
  ),
  "bike-light": profile(
    "bike-light",
    "400 cc inline-four",
    {
      cylinders: 4,
      saw: 0.2,
      square: 0.55,
      sub: 0.04,
      detune: 6,
      lump: 0.02,
      intake: 0.6,
      turbo: 0,
      cutoff: [700, 7000],
      q: 3,
      shaper: 0.45,
      drive: [0.55, 1.7],
      gain: 0.2,
    },
    { crackle: 0.25 },
  ),
  // A triple's 240° firing gives it a growl between a four and a twin.
  "bike-naked": profile(
    "bike-naked",
    "890 cc triple",
    {
      cylinders: 3,
      saw: 0.45,
      square: 0.4,
      sub: 0.2,
      detune: 10,
      lump: 0.22,
      intake: 0.5,
      turbo: 0,
      cutoff: [500, 4800],
      q: 1.8,
      shaper: 0.65,
      drive: [0.7, 2.2],
      gain: 0.26,
    },
    { crackle: 0.5 },
  ),
};

export const DEFAULT_CAR_PROFILE = "gt";
export const DEFAULT_BIKE_PROFILE = "bike-sport";

/**
 * The profile for a garage model id, or the class default for an id this
 * table does not know (a model added to the garage before it was voiced).
 */
export function engineProfileFor(modelId: string | null | undefined, kind: "car" | "bike"): RaceEngineProfile {
  const known = modelId ? ENGINE_PROFILES[modelId] : undefined;
  if (known) return known;
  const fallback = kind === "bike" ? DEFAULT_BIKE_PROFILE : DEFAULT_CAR_PROFILE;
  return ENGINE_PROFILES[fallback] as RaceEngineProfile;
}

/**
 * What an opponent sounds like. Opponents get the cheap one-oscillator voice,
 * which keeps only the pitch, so only the cylinder count and a typical redline
 * matter; using one layout for all of them keeps the player's own car the one
 * with character.
 */
export const RIVAL_ENGINE: Record<"car" | "bike", { voice: EngineVoiceSpec; rpmMax: number }> = {
  car: { voice: { ...(ENGINE_PROFILES.gt as RaceEngineProfile).voice, gain: 0.5 }, rpmMax: 8000 },
  bike: { voice: { ...(ENGINE_PROFILES["bike-sport"] as RaceEngineProfile).voice, gain: 0.45 }, rpmMax: 15000 },
};
