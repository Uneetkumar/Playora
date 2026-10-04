import { driveCurve } from "./loops.js";
import { clampHz, glide, glideIfChanged, noiseSource, releaseNodes, whiteNoise } from "./synth.js";

/**
 * A combustion engine, synthesised.
 *
 * The `engine` loop in loops.ts is one generic engine with two knobs; this is
 * the version a racing game steers directly, with the parts that make one car
 * sound unlike another:
 *
 *   saw ─┐                                  ┌─ lift-off: filter closed, little drive
 *   sq  ─┼─► mix ─► drive ─► shaper ─► LPF ─┤                                    ─► level ─► cut ─► out
 *   sub ─┘    ▲                              └─ full load: filter open, shaper biting
 *           lump LFO (uneven firing)
 *   noise ─► band-pass (intake roar) ───────────────────────────────────────────┘
 *   sine (turbo whistle) ────────────────────────────────────────────────────────┘
 *
 * The pitch is the firing frequency — cylinders × rpm / 120 for a four-stroke —
 * so a V12 and an inline-four at the same revs are an octave and a half apart,
 * which is most of the difference a listener hears between them. What the
 * throttle does is timbre rather than volume: lifting off at 7000 rpm closes the
 * filter and takes the grit out, and that muffled overrun is the cue players
 * use to hear a car braking for a corner.
 */
export interface EngineVoiceSpec {
  /** Cylinders of a four-stroke: firing events per two revolutions. */
  cylinders: number;
  /** Levels of the three tone voices: sawtooth body, square edge, triangle an octave down. */
  saw: number;
  square: number;
  sub: number;
  /** Cents between the two main oscillators. Near-unison beating is what makes it sound mechanical. */
  detune: number;
  /** 0..1: uneven firing — a cross-plane V8's burble, a big twin's thump. Fades with revs. */
  lump: number;
  /** Level of the band-passed noise induction roar, which rises with load. */
  intake: number;
  /** Turbo whistle level, 0 for a naturally aspirated engine. */
  turbo: number;
  /** Low-pass cutoff with the throttle shut and wide open, Hz. */
  cutoff: readonly [closed: number, open: number];
  /** Resonance on that filter. Higher is a more nasal, hollow engine. */
  q: number;
  /** WaveShaper saturation, 0..1. */
  shaper: number;
  /** Gain into the shaper with the throttle shut and wide open. */
  drive: readonly [closed: number, open: number];
  /** Output level at full throttle at the limiter. */
  gain: number;
}

export interface EngineVoiceState {
  rpm: number;
  /** The redline, used to normalise revs; anything non-positive means 8000. */
  rpmMax: number;
  /** Applied throttle, 0..1. */
  throttle: number;
  /** Multiplier on pitch, e.g. a nitro lift or a Doppler shift. */
  pitch?: number;
  /** Multiplier on the filter cutoff. */
  bright?: number;
}

/** What the node graph is steered to for one state. Pure, so it can be tested without Web Audio. */
export interface EngineVoiceTargets {
  /** Hz of the firing fundamental (the sawtooth and square). */
  frequency: number;
  cutoff: number;
  drive: number;
  level: number;
  intakeFrequency: number;
  intakeLevel: number;
  /** Hz of the uneven-firing wobble: once per engine cycle. */
  lumpRate: number;
  /** Depth of that wobble as a fraction of the mix. */
  lumpDepth: number;
  turboFrequency: number;
  turboLevel: number;
}

const clamp = (n: number, lo: number, hi: number): number => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo);
const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Firing frequency of a four-stroke: each cylinder fires once every two revolutions. */
export function firingFrequency(rpm: number, cylinders: number): number {
  if (!Number.isFinite(rpm) || !Number.isFinite(cylinders)) return 0;
  return (Math.max(0, cylinders) * Math.max(0, rpm)) / 120;
}

export function engineVoiceTargets(spec: EngineVoiceSpec, state: EngineVoiceState): EngineVoiceTargets {
  const rpmMax = Number.isFinite(state.rpmMax) && state.rpmMax > 0 ? state.rpmMax : 8000;
  const rpm = clamp(state.rpm, 0, rpmMax * 1.25);
  const revs = clamp(rpm / rpmMax, 0, 1.25);
  const n = Math.min(1, revs);
  const throttle = clamp(state.throttle, 0, 1);
  const pitch = state.pitch === undefined ? 1 : clamp(state.pitch, 0.25, 4);
  const bright = state.bright === undefined ? 1 : clamp(state.bright, 0.25, 4);

  const frequency = clamp(firingFrequency(rpm, spec.cylinders) * pitch, 1, 8000);
  const [closed, open] = spec.cutoff;
  // Geometric between the two cutoffs, so half throttle sounds half open.
  const cutoff = clampHz(closed * Math.pow(open / Math.max(1, closed), throttle) * (1 + 0.6 * n) * bright);
  const drive = (spec.drive[0] + (spec.drive[1] - spec.drive[0]) * throttle) * (0.8 + 0.4 * n);
  const level = spec.gain * (0.5 + 0.5 * throttle) * (0.7 + 0.3 * n);
  const intakeFrequency = clampHz(clamp(frequency * 3, 280, 4200));
  // Band-passed noise keeps a fraction of its level through the filter, so
  // the scale is large for the roar to sit just under the tones at full load.
  const intakeLevel = spec.intake * throttle * (0.15 + 0.85 * n) * 1.2;
  // A lumpy cam is obvious at idle and smooths into a howl near the redline.
  const lumpRate = Math.max(0.5, rpm / 120);
  const lumpDepth = clamp(spec.lump * (1 - 0.75 * n) * 0.5, 0, 0.5);
  // Boost needs load and revs together; the whistle squares in as it spools.
  const boost = throttle * smoothstep(0.25, 0.85, n);
  const turboFrequency = 1800 + 5200 * boost;
  const turboLevel = spec.turbo * boost * boost * 0.03;

  return {
    frequency,
    cutoff,
    drive: Math.max(0, drive),
    level: Math.max(0, level),
    intakeFrequency,
    intakeLevel: Math.max(0, intakeLevel),
    lumpRate,
    lumpDepth,
    turboFrequency,
    turboLevel: Math.max(0, turboLevel),
  };
}

export interface EngineVoiceOptions {
  /**
   * `full` is the player's own engine. `lite` is one oscillator through a
   * filter, for opponents: eight full engines would be ninety nodes, and a
   * car forty metres away does not need its intake roar.
   */
  quality?: "full" | "lite";
}

type Last = Partial<Record<keyof EngineVoiceTargets, number>>;

export class EngineVoice {
  /** The voice's last node; already connected to the destination given. */
  readonly output: GainNode;
  private readonly context: BaseAudioContext;
  private readonly spec: EngineVoiceSpec;
  private readonly lite: boolean;
  private readonly tones: Array<{ osc: OscillatorNode; ratio: number }> = [];
  private readonly sources: AudioScheduledSourceNode[] = [];
  private readonly nodes: AudioNode[] = [];
  private readonly drive: GainNode | null = null;
  private readonly filter: BiquadFilterNode;
  private readonly level: GainNode;
  private readonly lfo: OscillatorNode | null = null;
  private readonly lfoDepth: GainNode | null = null;
  private readonly intakeFilter: BiquadFilterNode | null = null;
  private readonly intakeLevel: GainNode | null = null;
  private readonly turbo: OscillatorNode | null = null;
  private readonly turboLevel: GainNode | null = null;
  private last: Last = {};
  private stopped = false;
  private current: EngineVoiceTargets;

  constructor(
    context: BaseAudioContext,
    destination: AudioNode,
    spec: EngineVoiceSpec,
    state: EngineVoiceState,
    options: EngineVoiceOptions = {},
  ) {
    this.context = context;
    this.spec = spec;
    this.lite = options.quality === "lite";
    const t = engineVoiceTargets(spec, state);
    this.current = t;
    const track = <N extends AudioNode>(node: N): N => {
      this.nodes.push(node);
      return node;
    };
    const now = context.currentTime;

    const mix = track(context.createGain());
    const tone = (type: OscillatorType, ratio: number, detune: number, gain: number) => {
      if (gain <= 0) return;
      const osc = track(context.createOscillator());
      osc.type = type;
      osc.frequency.value = t.frequency * ratio;
      if (detune) osc.detune.value = detune;
      const level = track(context.createGain());
      level.gain.value = gain;
      osc.connect(level);
      level.connect(mix);
      osc.start(now);
      this.tones.push({ osc, ratio });
      this.sources.push(osc);
    };

    if (this.lite) {
      // One sawtooth carries the pitch, which is all distance leaves of an engine.
      tone("sawtooth", 1, 0, 0.8);
    } else {
      tone("sawtooth", 1, -spec.detune / 2, spec.saw);
      tone("square", 1, spec.detune / 2, spec.square);
      tone("triangle", 0.5, 0, spec.sub);
    }

    let tail: AudioNode = mix;
    if (!this.lite) {
      const drive = track(context.createGain());
      drive.gain.value = t.drive;
      mix.connect(drive);
      const shaper = track(context.createWaveShaper());
      shaper.curve = driveCurve(spec.shaper);
      // Distortion makes harmonics; without oversampling the ones above
      // Nyquist fold back down as inharmonic fizz.
      shaper.oversample = "2x";
      drive.connect(shaper);
      tail = shaper;
      this.drive = drive;

      if (spec.lump > 0) {
        // An LFO summed onto the mix gain: the level swings once per cycle,
        // as a V8 with uneven firing intervals does.
        const lfo = track(context.createOscillator());
        lfo.frequency.value = t.lumpRate;
        const depth = track(context.createGain());
        depth.gain.value = t.lumpDepth;
        lfo.connect(depth);
        depth.connect(mix.gain);
        lfo.start(now);
        this.lfo = lfo;
        this.lfoDepth = depth;
        this.sources.push(lfo);
      }
    }

    const filter = track(context.createBiquadFilter());
    filter.type = "lowpass";
    filter.frequency.value = this.lite ? Math.min(t.cutoff, 2400) : t.cutoff;
    filter.Q.value = this.lite ? 0.9 : spec.q;
    tail.connect(filter);
    this.filter = filter;

    const level = track(context.createGain());
    level.gain.value = 0;
    filter.connect(level);
    this.level = level;

    if (!this.lite && spec.intake > 0) {
      const noise = noiseSource(context, whiteNoise(context));
      track(noise);
      this.sources.push(noise);
      const band = track(context.createBiquadFilter());
      band.type = "bandpass";
      band.frequency.value = t.intakeFrequency;
      band.Q.value = 1.3;
      const intake = track(context.createGain());
      intake.gain.value = t.intakeLevel;
      noise.connect(band);
      band.connect(intake);
      intake.connect(level);
      this.intakeFilter = band;
      this.intakeLevel = intake;
    }

    if (!this.lite && spec.turbo > 0) {
      const whistle = track(context.createOscillator());
      whistle.type = "sine";
      whistle.frequency.value = t.turboFrequency;
      const turboLevel = track(context.createGain());
      turboLevel.gain.value = t.turboLevel;
      whistle.connect(turboLevel);
      turboLevel.connect(level);
      whistle.start(now);
      this.turbo = whistle;
      this.turboLevel = turboLevel;
      this.sources.push(whistle);
    }

    const output = track(context.createGain());
    output.gain.value = 1;
    level.connect(output);
    output.connect(destination);
    this.output = output;

    // Fade in rather than switch on: a voice appearing at full level clicks.
    glide(level.gain, t.level, now, 0.03);
    this.last = { level: t.level };
  }

  /** The targets the voice is heading for. */
  get targets(): EngineVoiceTargets {
    return this.current;
  }

  /**
   * Steers the voice. Cheap to call every frame; unchanged values schedule
   * nothing. `timeConstant` is how quickly the revs follow — a few frames,
   * so the steps of a 60 Hz physics loop blur into a sweep.
   */
  update(state: EngineVoiceState, timeConstant = 0.035): EngineVoiceTargets {
    const t = engineVoiceTargets(this.spec, state);
    this.current = t;
    if (this.stopped) return t;
    const now = this.context.currentTime;
    const last = this.last;
    try {
      // Two thousandths is about three cents: below what anyone hears, above
      // the jitter of an rpm that is only holding steady.
      if (last.frequency === undefined || Math.abs(t.frequency - last.frequency) > 2e-3 * t.frequency) {
        for (const { osc, ratio } of this.tones) glide(osc.frequency, t.frequency * ratio, now, timeConstant);
        last.frequency = t.frequency;
      }
      const cutoff = this.lite ? Math.min(t.cutoff, 2400) : t.cutoff;
      last.cutoff = glideIfChanged(this.filter.frequency, cutoff, last.cutoff, now, timeConstant * 1.5, 1e-2);
      last.level = glideIfChanged(this.level.gain, t.level, last.level, now, timeConstant * 1.5);
      if (this.drive) last.drive = glideIfChanged(this.drive.gain, t.drive, last.drive, now, timeConstant * 1.5);
      if (this.lfo && this.lfoDepth) {
        last.lumpRate = glideIfChanged(this.lfo.frequency, t.lumpRate, last.lumpRate, now, timeConstant, 1e-2);
        last.lumpDepth = glideIfChanged(this.lfoDepth.gain, t.lumpDepth, last.lumpDepth, now, timeConstant * 3);
      }
      if (this.intakeFilter && this.intakeLevel) {
        last.intakeFrequency = glideIfChanged(this.intakeFilter.frequency, t.intakeFrequency, last.intakeFrequency, now, timeConstant, 1e-2);
        last.intakeLevel = glideIfChanged(this.intakeLevel.gain, t.intakeLevel, last.intakeLevel, now, timeConstant * 2);
      }
      if (this.turbo && this.turboLevel) {
        // A turbo spools over a good fraction of a second; it does not follow the revs.
        last.turboFrequency = glideIfChanged(this.turbo.frequency, t.turboFrequency, last.turboFrequency, now, 0.35, 1e-2);
        last.turboLevel = glideIfChanged(this.turboLevel.gain, t.turboLevel, last.turboLevel, now, 0.25);
      }
    } catch {
      // The context was closed under us; the owner rebuilds on a new one.
    }
    return t;
  }

  /**
   * A throttle cut: the output dips to `depth` and recovers after `seconds`,
   * as it does while a gearbox swaps ratios. Independent of `update`, which
   * steers a different gain, so the next frame does not cancel it.
   */
  cut(depth = 0.3, seconds = 0.08): void {
    if (this.stopped) return;
    const now = this.context.currentTime;
    const gain = this.output.gain;
    try {
      gain.cancelScheduledValues(now);
      gain.setTargetAtTime(clamp(depth, 0, 1), now, 0.008);
      gain.setTargetAtTime(1, now + clamp(seconds, 0.01, 1), 0.03);
    } catch {
      gain.value = 1;
    }
  }

  /** Fades out over `fade` seconds and releases every node. */
  stop(fade = 0.08): void {
    if (this.stopped) return;
    this.stopped = true;
    const now = this.context.currentTime;
    try {
      this.output.gain.cancelScheduledValues(now);
      glide(this.output.gain, 0, now, Math.max(0.005, fade / 3));
      const end = now + Math.max(0, fade) + 0.05;
      for (const source of this.sources) source.stop(end);
      const first = this.sources[0];
      if (first) first.onended = () => releaseNodes(this.nodes);
      else releaseNodes(this.nodes);
    } catch {
      releaseNodes(this.nodes);
    }
  }
}
