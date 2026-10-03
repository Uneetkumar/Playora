import type { AudioBus } from "./mixer.js";
import type { FilterType, Waveform } from "./sounds.js";

/**
 * Continuous sounds: an engine, the wind, tyres, a crowd.
 *
 * A loop is described the same way a one-shot is — as data — but with knobs.
 * Each loop declares its parameters in game terms (rpm, throttle, speed, slip)
 * and a list of mappings from those parameters onto four shared targets of one
 * fixed node graph:
 *
 *   voices ─► mix ─► drive ─► [shaper] ─► [filter] ─► out ─► [pan] ─► bus
 *                      ▲                     ▲          ▲
 *                    drive                 cutoff      gain      (pitch → every tone voice)
 *
 * Keeping the mapping declarative is what makes it testable: whether the engine
 * pitch follows rpm, or the tyres stay silent below the slip threshold, is a
 * question about numbers that `resolveLoopTargets` answers without Web Audio.
 */

export interface LoopParamSpec {
  min: number;
  max: number;
  default: number;
  /**
   * Seconds a change takes to (mostly) arrive.
   *
   * A game loop feeds rpm at 60 Hz in visible steps; heard raw, each step is a
   * click. The smoothing is per parameter because the right value is physical:
   * revs move fast, a crowd swells slowly.
   */
  smoothing: number;
}

export interface LoopVoice {
  kind: "tone" | "noise";
  waveform?: Waveform;
  /** Multiple of the loop's `pitch` target. Tones only; defaults to 1. */
  ratio?: number;
  /** Cents. Two near-unison oscillators drift in and out of phase, which is most of what makes a synth engine sound mechanical rather than electronic. */
  detune?: number;
  gain: number;
  /** A fixed filter on this voice alone, ahead of the shared one. */
  filter?: { type: FilterType; frequency: number; q?: number };
  /** Slow amplitude wobble: a crowd swells, wind gusts. `depth` is a fraction of `gain`. */
  wobble?: { rate: number; depth: number };
}

export type LoopTarget = "pitch" | "cutoff" | "gain" | "drive";

export interface LoopMapping {
  param: string;
  target: LoopTarget;
  /** Output at the parameter's min and at its max. */
  range: readonly [number, number];
  /** Exponent on the normalised input: above 1 the response arrives late, below 1 early. */
  curve?: number;
  /** Normalised input at or below which the output stays at `range[0]`. */
  threshold?: number;
  /** Interpolate geometrically — right for Hz, where equal steps should be equal intervals. */
  exponential?: boolean;
}

export interface LoopSpec {
  bus: AudioBus;
  voices: readonly LoopVoice[];
  /** The shared filter after the mix. Its frequency is the `cutoff` target. */
  filter?: { type: FilterType; q?: number };
  /** WaveShaper saturation, 0..1. The `drive` target pushes the signal into it. */
  shaper?: number;
  params: Record<string, LoopParamSpec>;
  /**
   * Mappings onto the same target multiply. Give one of them the unit (Hz for
   * pitch and cutoff) and keep the rest unitless factors around 1.
   */
  mappings: readonly LoopMapping[];
  /** Starting value of each target before mappings multiply in. Defaults to 1. */
  base?: Partial<Record<LoopTarget, number>>;
}

/**
 * Parameters every loop has, whatever its spec says.
 *
 * `volume` is how an opponent's engine sits under the player's own; `pan` is
 * where it is. Neither belongs in a spec, because they describe the listener's
 * relation to the sound, not the sound.
 */
export const COMMON_LOOP_PARAMS = {
  volume: { min: 0, max: 1, default: 1, smoothing: 0.05 },
  pan: { min: -1, max: 1, default: 0, smoothing: 0.05 },
} as const satisfies Record<string, LoopParamSpec>;

export const LOOPS = {
  /**
   * A combustion engine. Pitch follows rpm, the filter opens and the
   * distortion bites as the throttle goes down — so a car coasting at 7000
   * rpm sounds different from one accelerating through it, which is the cue
   * players actually listen for.
   */
  engine: {
    bus: "sfx",
    voices: [
      { kind: "tone", waveform: "sawtooth", detune: -8, gain: 0.5 },
      { kind: "tone", waveform: "square", detune: 8, gain: 0.3 },
    ],
    shaper: 0.6,
    filter: { type: "lowpass", q: 2 },
    params: {
      rpm: { min: 800, max: 9000, default: 900, smoothing: 0.06 },
      throttle: { min: 0, max: 1, default: 0, smoothing: 0.08 },
    },
    mappings: [
      // A six-cylinder four-stroke fires three times per revolution, so the
      // fundamental is rpm / 60 * 3: 40 Hz at 800 rpm, 450 Hz at 9000. Low, but
      // the sawtooth and the shaper put the harmonics where speakers can play them.
      { param: "rpm", target: "pitch", range: [40, 450] },
      { param: "throttle", target: "cutoff", range: [380, 3400], exponential: true },
      // Revs brighten the sound a little even off throttle.
      { param: "rpm", target: "cutoff", range: [1, 1.6] },
      { param: "throttle", target: "gain", range: [0.45, 1] },
      { param: "throttle", target: "drive", range: [0.6, 2.2] },
    ],
    base: { gain: 0.22 },
  },

  /** Air past the car. Speed is normalised: 0 standing, 1 top speed. */
  wind: {
    bus: "sfx",
    voices: [
      { kind: "noise", gain: 0.6, wobble: { rate: 0.23, depth: 0.25 } },
      { kind: "noise", gain: 0.35, filter: { type: "highpass", frequency: 1800 }, wobble: { rate: 0.37, depth: 0.3 } },
    ],
    filter: { type: "lowpass", q: 0.7 },
    params: {
      speed: { min: 0, max: 1, default: 0, smoothing: 0.25 },
    },
    mappings: [
      // Aerodynamic noise grows much faster than speed; a squared response
      // keeps town speeds quiet and makes top speed roar.
      { param: "speed", target: "gain", range: [0, 1], curve: 2 },
      { param: "speed", target: "cutoff", range: [300, 4200], exponential: true },
    ],
    base: { gain: 0.3 },
  },

  /**
   * Tyres at the limit. Slip is normalised: 0 full grip, 1 sliding.
   *
   * Real squeal is a stick-slip oscillation with an actual pitch, so a quiet
   * triangle sits at the centre of the band-passed noise and moves with it.
   */
  "tyre-squeal": {
    bus: "sfx",
    voices: [
      { kind: "noise", gain: 0.8, wobble: { rate: 7, depth: 0.2 } },
      { kind: "tone", waveform: "triangle", gain: 0.12 },
    ],
    filter: { type: "bandpass", q: 9 },
    params: {
      slip: { min: 0, max: 1, default: 0, smoothing: 0.05 },
    },
    mappings: [
      // Every car slips a little in every corner; below the threshold that is
      // grip, not a slide, and squealing through it would be constant noise.
      { param: "slip", target: "gain", range: [0, 1], threshold: 0.15, curve: 1.5 },
      { param: "slip", target: "cutoff", range: [1500, 2600], exponential: true },
      { param: "slip", target: "pitch", range: [1500, 2600], exponential: true },
    ],
    base: { gain: 0.35 },
  },

  /** A stadium murmur that swells into a roar. Intensity 0..1. */
  crowd: {
    bus: "sfx",
    voices: [
      // Two bands in the voice range, wobbling at unrelated rates so the
      // swell never repeats audibly.
      { kind: "noise", gain: 0.7, filter: { type: "bandpass", frequency: 700, q: 0.8 }, wobble: { rate: 0.17, depth: 0.35 } },
      { kind: "noise", gain: 0.4, filter: { type: "bandpass", frequency: 1600, q: 1.2 }, wobble: { rate: 0.29, depth: 0.4 } },
    ],
    filter: { type: "lowpass", q: 0.5 },
    params: {
      intensity: { min: 0, max: 1, default: 0.3, smoothing: 0.6 },
    },
    mappings: [
      { param: "intensity", target: "gain", range: [0.15, 1], curve: 1.3 },
      { param: "intensity", target: "cutoff", range: [1200, 5000], exponential: true },
    ],
    base: { gain: 0.25 },
  },
} satisfies Record<string, LoopSpec>;

export type LoopId = keyof typeof LOOPS;
export const LOOP_IDS = Object.keys(LOOPS) as LoopId[];

/** The parameter names a given loop accepts, its own plus the common ones. */
export type LoopParamName<L extends LoopId> =
  | Extract<keyof (typeof LOOPS)[L]["params"], string>
  | keyof typeof COMMON_LOOP_PARAMS;

export type LoopParamValues<P extends string = string> = Partial<Record<P, number>>;

export interface LoopTargets {
  /** Hz of a ratio-1 tone voice. */
  pitch: number;
  /** Hz of the shared filter. */
  cutoff: number;
  /** Output level, before bus and master. */
  gain: number;
  /** Level into the shaper. */
  drive: number;
  pan: number;
}

/** Every parameter a spec accepts, with its bounds. */
export function loopParamSpecs(spec: LoopSpec): Record<string, LoopParamSpec> {
  return { ...COMMON_LOOP_PARAMS, ...spec.params };
}

/**
 * Clamps `value` into `param`'s range. Non-finite values fall back to the
 * default: a NaN rpm from a physics blow-up must not reach an AudioParam, where
 * it silences the node for good.
 */
export function clampLoopParam(param: LoopParamSpec, value: number): number {
  if (!Number.isFinite(value)) return param.default;
  return Math.min(param.max, Math.max(param.min, value));
}

/**
 * A complete, clamped set of parameter values: defaults filled in, unknown
 * names dropped.
 */
export function resolveLoopParams(spec: LoopSpec, input: Record<string, number | undefined> = {}): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, param] of Object.entries(loopParamSpecs(spec))) {
    const raw = input[name];
    out[name] = raw === undefined ? param.default : clampLoopParam(param, raw);
  }
  return out;
}

/** One mapping's output for one (already clamped) parameter value. */
export function mapLoopParam(mapping: LoopMapping, param: LoopParamSpec, value: number): number {
  const [lo, hi] = mapping.range;
  const span = param.max - param.min;
  let t = span > 0 ? (value - param.min) / span : 0;
  t = Math.min(1, Math.max(0, t));

  const threshold = mapping.threshold ?? 0;
  if (threshold > 0) t = t <= threshold ? 0 : (t - threshold) / (1 - threshold);
  t = Math.pow(t, mapping.curve ?? 1);

  // Geometric interpolation is undefined through zero; such a range is linear.
  if (mapping.exponential && lo > 0 && hi > 0) return lo * Math.pow(hi / lo, t);
  return lo + (hi - lo) * t;
}

/** What the node graph should be set to for a set of parameter values. */
export function resolveLoopTargets(spec: LoopSpec, values: Record<string, number>): LoopTargets {
  const specs = loopParamSpecs(spec);
  const targets: Record<LoopTarget, number> = {
    pitch: spec.base?.pitch ?? 1,
    cutoff: spec.base?.cutoff ?? 1,
    gain: spec.base?.gain ?? 1,
    drive: spec.base?.drive ?? 1,
  };
  for (const mapping of spec.mappings) {
    const param = specs[mapping.param];
    if (!param) continue;
    const value = clampLoopParam(param, values[mapping.param] ?? param.default);
    targets[mapping.target] *= mapLoopParam(mapping, param, value);
  }

  const volume = clampLoopParam(COMMON_LOOP_PARAMS.volume, values.volume ?? 1);
  const pan = clampLoopParam(COMMON_LOOP_PARAMS.pan, values.pan ?? 0);
  return {
    // Bounded to what an AudioParam and a listener can use: below 20 Hz a
    // filter cutoff is silence, above 20 kHz it is past Nyquist at 44.1 kHz.
    pitch: Math.min(20000, Math.max(1, targets.pitch)),
    cutoff: Math.min(20000, Math.max(20, targets.cutoff)),
    gain: Math.max(0, targets.gain * volume),
    drive: Math.max(0, targets.drive),
    pan,
  };
}

const curveCache = new Map<number, Float32Array<ArrayBuffer>>();

/**
 * A soft-clipping transfer curve for the WaveShaper.
 *
 * tanh rather than a hard clip: hard clipping adds harmonics all the way up to
 * Nyquist, which aliases into a fizz; tanh rounds off and stays warm. Normalised
 * so full-scale input still maps to ±1 whatever the amount.
 */
export function driveCurve(amount: number, samples = 1024): Float32Array<ArrayBuffer> {
  const a = Math.min(1, Math.max(0, Number.isFinite(amount) ? amount : 0));
  const key = Math.round(a * 1000) * 100000 + samples;
  const cached = curveCache.get(key);
  if (cached) return cached;

  const k = 1 + a * 8;
  const norm = Math.tanh(k);
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / norm;
  }
  curveCache.set(key, curve);
  return curve;
}
