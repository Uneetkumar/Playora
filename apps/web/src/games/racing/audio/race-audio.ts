import {
  EngineVoice,
  POP_VARIANT_COUNT,
  PositionalSource,
  dopplerFactor,
  effectiveVolume,
  getAudioEngine,
  glide,
  glideIfChanged,
  noiseSource,
  popBuffer,
  releaseNodes,
  scheduleLayers,
  toListenerSpace,
  type ListenerPose,
  type ListenerSpacePoint,
} from "@playora/audio";
import { BLOW_OFF, CUE_GAP, METAL_CRUNCH, RACE_AUDIO_EVENTS, RACE_CUES, cueParams, type RaceAudioEvent } from "./cues";
import { RIVAL_ENGINE, engineProfileFor, type RaceEngineProfile } from "./engine-profiles";
import { assignRivalSlots, rivalDetune } from "./opponents";

export { RACE_AUDIO_EVENTS, type RaceAudioEvent };

/** What the player's vehicle is doing this frame. */
export interface RaceAudioFrame {
  rpm: number;
  rpmMax: number;
  /** Applied throttle, 0..1. */
  throttle: number;
  /** m/s. */
  speed: number;
  /** How far past the grip limit the tyres are, 0..1. */
  slip: number;
  nitro: boolean;
  offRoad: boolean;
  kind: "car" | "bike";
}

/** An opponent, in the same world frame (metres, y up) as the listener. */
export interface RaceAudioOpponent {
  id: string;
  x: number;
  y: number;
  z: number;
  rpm: number;
}

/** Where the ears are — the camera, or the player's car — and which way they face. */
export type RaceAudioListener = ListenerPose;

export interface RaceAudio {
  /** Call from a user gesture (the Start button): browsers keep audio locked until one. */
  start(): void;
  /** Every rendered frame. `dt` in seconds. */
  frame(f: RaceAudioFrame, dt: number): void;
  /** A one-shot. `strength` is 0..1, except `mini-turbo`, where it is the tier 1..3. */
  event(e: RaceAudioEvent, strength?: number): void;
  /** Every frame, with every opponent; the nearest few are voiced. */
  setOpponents(list: ReadonlyArray<RaceAudioOpponent>, listener: RaceAudioListener): void;
  /** The race's own mute (pause menu, result screen), on top of the platform's. */
  setMuted(m: boolean): void;
  /**
   * Voices the player's engine as a garage model (`gt`, `muscle`, `bike-sport`…).
   * Without it the engine is the class default for `frame().kind`.
   */
  setVehicle(modelId: string | null): void;
  dispose(): void;
}

export interface RaceAudioOutput {
  context: BaseAudioContext;
  destination: AudioNode;
}

export interface RaceAudioOptions {
  /**
   * Where the mix goes. Defaults to the platform's sfx bus, which carries the
   * Settings volume and mute; a test passes an OfflineAudioContext.
   */
  output?: () => RaceAudioOutput | null;
  /** Garage model id; see `setVehicle`. */
  vehicle?: string | null;
  /**
   * Fade the mix out when frames stop arriving — a pause that forgot to mute,
   * a backgrounded tab — rather than drone on at the last rpm. On by default.
   */
  watchdog?: boolean;
  /** Milliseconds clock for the watchdog. */
  now?: () => number;
}

/** Opponents voiced at once. Four is the pack around you; more is mud. */
const MAX_RIVALS = 4;
/** Metres beyond which an opponent is not voiced, and the distance it fades in over. */
const RIVAL_RANGE = 180;
const RIVAL_FADE = 40;
/** m/s at which wind noise is at full level, about 300 km/h. */
const WIND_REF = 85;
/**
 * Peak gains of the continuous layers. Filtered noise loses most of its
 * energy in the filter — a band-pass a few hundred hertz wide keeps about a
 * tenth of white noise's level — so these look large. Measured after the
 * filters by the offline self-test, a full slide sits about 7 dB under the
 * engine at full throttle, wind and road at 300 km/h about 9 dB under, and
 * gravel about 6 dB under, loud enough to tell the player they left the road.
 */
const LEVEL = {
  squeal: 0.9,
  squealBike: 0.55,
  /** The pitched part of the squeal, relative to the noise. */
  squealTone: 0.08,
  nitro: 0.055,
  wind: 0.24,
  windBike: 0.4,
  road: 0.27,
  roadBike: 0.18,
  rough: 1.8,
} as const;
/** A narrow band, but not so narrow it whistles: real squeal wanders. */
const SQUEAL_Q = 4;
/** Milliseconds without a `frame()` call before the mix is faded out. */
const STALL_MS = 400;
/** Frames to wait before asking for an output again after it was refused. */
const RETRY_FRAMES = 30;

const clamp = (n: number, lo: number, hi: number): number => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo);
const clamp01 = (n: number): number => clamp(n, 0, 1);
const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

interface Rival {
  id: string;
  voice: EngineVoice;
  level: GainNode;
  place: PositionalSource;
  detune: number;
  distance?: number;
  at?: number;
  /** m/s the distance is changing at, smoothed: the Doppler input. */
  radial: number;
  levelLast?: number;
}

interface Graph {
  context: BaseAudioContext;
  out: GainNode;
  player: GainNode;
  fx: GainNode;
  rivals: GainNode;
  engine: EngineVoice;
  profile: RaceEngineProfile;
  squealBand: BiquadFilterNode;
  squealLevel: GainNode;
  squealTone: OscillatorNode;
  squealToneLevel: GainNode;
  nitroLevel: GainNode;
  windFilter: BiquadFilterNode;
  windLevel: GainNode;
  roadFilter: BiquadFilterNode;
  roadLevel: GainNode;
  roughLevel: GainNode;
  roughLfo: OscillatorNode;
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
  slots: Array<Rival | null>;
  /** Voices handed back, kept until their fade is over and then disconnected. */
  retired: Array<{ until: number; release: () => void }>;
  /** Last value sent to each continuous param, so unchanged ones schedule nothing. */
  last: Record<string, number | undefined>;
  heard: boolean;
  watchdog: ReturnType<typeof setInterval> | null;
}

/**
 * The race's sound: the player's engine, tyres, wind and surface, the nearest
 * opponents placed around the listener, and every one-shot cue.
 *
 * Everything is synthesised; nothing is downloaded. The graph is built only
 * while it can be heard — after `start()`, unmuted, with the platform's game
 * sounds on — and torn down otherwise, so a muted race costs one property read
 * per frame. Every method is safe in every state, because the callers are a
 * render loop and a game loop, neither of which should need a try/catch around
 * its sound.
 */
export function createRaceAudio(options: RaceAudioOptions = {}): RaceAudio {
  const now =
    options.now ?? (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
  const watchdogOn = options.watchdog !== false;
  let vehicle: string | null = options.vehicle ?? null;
  let kind: "car" | "bike" = "car";
  let started = false;
  let localMuted = false;
  let disposed = false;
  let graph: Graph | null = null;
  let retry = 0;
  let stalled = false;
  let lastFrameAt = 0;
  let prevThrottle = 0;
  let slip = 0;
  let lastPopAt = -Infinity;
  const lastCue = new Map<RaceAudioEvent, number>();

  const audible = (): boolean => {
    // An injected output is its owner's to silence.
    if (options.output) return true;
    return effectiveVolume(getAudioEngine().getMixer(), "sfx") > 0;
  };

  const openOutput = (): RaceAudioOutput | null => {
    if (options.output) return options.output();
    return getAudioEngine().output("sfx");
  };

  function ensureGraph(): Graph | null {
    if (!started || localMuted || disposed || !audible()) {
      teardown();
      return null;
    }
    if (graph) {
      if (graph.context.state !== "closed") return graph;
      // The shared context was closed (a hot reload replaced the engine).
      teardown();
    }
    if (retry > 0) {
      retry--;
      return null;
    }
    const output = openOutput();
    if (!output) {
      retry = RETRY_FRAMES;
      return null;
    }
    try {
      graph = build(output.context, output.destination, engineProfileFor(vehicle, kind));
    } catch {
      // A browser missing a node type gets silence, not an exception.
      graph = null;
      retry = RETRY_FRAMES * 4;
    }
    return graph;
  }

  function build(context: BaseAudioContext, destination: AudioNode, profile: RaceEngineProfile): Graph {
    const nodes: AudioNode[] = [];
    const sources: AudioScheduledSourceNode[] = [];
    const track = <N extends AudioNode>(node: N): N => {
      nodes.push(node);
      return node;
    };
    const t = context.currentTime;
    const gain = (value: number, to: AudioNode): GainNode => {
      const node = track(context.createGain());
      node.gain.value = value;
      node.connect(to);
      return node;
    };
    const filter = (type: BiquadFilterType, frequency: number, q: number, to: AudioNode): BiquadFilterNode => {
      const node = track(context.createBiquadFilter());
      node.type = type;
      node.frequency.value = frequency;
      node.Q.value = q;
      node.connect(to);
      return node;
    };
    const osc = (type: OscillatorType, frequency: number, to: AudioNode): OscillatorNode => {
      const node = track(context.createOscillator());
      node.type = type;
      node.frequency.value = frequency;
      node.connect(to);
      node.start(t);
      sources.push(node);
      return node;
    };

    const out = gain(0, destination);
    glide(out.gain, 1, t, 0.03);
    // The player's bus stays shut until the first frame says what the engine
    // is doing; an engine voiced at 0 rpm is a 1 Hz click train.
    const player = gain(0, out);
    const fx = gain(1, out);
    const rivals = gain(0.9, out);

    const engine = new EngineVoice(context, player, profile.voice, { rpm: 900, rpmMax: 8000, throttle: 0 });

    // Two noise sources at different offsets: tyres and nitro on one, air and
    // surface on the other. Correlated noise in different bands is fine.
    const noiseA = track(noiseSource(context));
    const noiseB = track(noiseSource(context));
    sources.push(noiseA, noiseB);

    // Tyre squeal: a narrow band of noise with a quiet tone at its centre —
    // real squeal is a stick-slip oscillation with an actual pitch.
    const squealLevel = gain(0, player);
    const squealBand = filter("bandpass", 1400, SQUEAL_Q, squealLevel);
    noiseA.connect(squealBand);
    const squealToneLevel = gain(0, player);
    const squealTone = osc("triangle", 1400, squealToneLevel);

    const nitroLevel = gain(0, player);
    noiseA.connect(filter("highpass", 2800, 0.7, nitroLevel));

    const windLevel = gain(0, player);
    const windFilter = filter("lowpass", 300, 0.6, windLevel);
    noiseB.connect(windFilter);

    // Tyre roar on tarmac: low, steady, proportional to speed.
    const roadLevel = gain(0, player);
    const roadFilter = filter("lowpass", 200, 0.8, roadLevel);
    noiseB.connect(roadFilter);

    // Gravel and grass: low noise chopped by an LFO into bumps that come
    // faster with speed.
    const roughLevel = gain(0, player);
    const roughAm = gain(0.6, roughLevel);
    noiseB.connect(filter("lowpass", 420, 0.9, roughAm));
    const roughDepth = track(context.createGain());
    roughDepth.gain.value = 0.4;
    roughDepth.connect(roughAm.gain);
    const roughLfo = osc("sine", 6, roughDepth);

    const g: Graph = {
      context,
      out,
      player,
      fx,
      rivals,
      engine,
      profile,
      squealBand,
      squealLevel,
      squealTone,
      squealToneLevel,
      nitroLevel,
      windFilter,
      windLevel,
      roadFilter,
      roadLevel,
      roughLevel,
      roughLfo,
      sources,
      nodes,
      slots: Array.from({ length: MAX_RIVALS }, () => null),
      retired: [],
      last: {},
      heard: false,
      watchdog: null,
    };

    lastFrameAt = now();
    stalled = false;
    if (watchdogOn && typeof setInterval === "function") {
      g.watchdog = setInterval(() => {
        if (graph !== g || stalled || now() - lastFrameAt < STALL_MS) return;
        stalled = true;
        try {
          glide(g.out.gain, 0, g.context.currentTime, 0.06);
        } catch {
          // Closed; the next frame rebuilds.
        }
        // Distances measured across the gap would read as a huge velocity.
        for (const slot of g.slots) if (slot) slot.at = undefined;
      }, 250);
    }
    return g;
  }

  function teardown(): void {
    const g = graph;
    if (!g) return;
    graph = null;
    stalled = false;
    if (g.watchdog) clearInterval(g.watchdog);
    try {
      const t = g.context.currentTime;
      g.out.gain.cancelScheduledValues(t);
      glide(g.out.gain, 0, t, 0.015);
      g.engine.stop(0.05);
      for (const slot of g.slots) slot?.voice.stop(0.05);
      for (const source of g.sources) source.stop(t + 0.1);
      const release = () => {
        releaseNodes(g.nodes);
        for (const slot of g.slots) slot?.place.dispose();
        for (const r of g.retired) r.release();
      };
      const first = g.sources[0];
      if (first) first.onended = release;
      else release();
    } catch {
      releaseNodes(g.nodes);
    }
  }

  /** One exhaust pop at `when`, through the cue bus. */
  function pop(g: Graph, when: number, level: number): void {
    if (level <= 0.001) return;
    try {
      const context = g.context;
      const source = context.createBufferSource();
      source.buffer = popBuffer(context, Math.floor(Math.random() * POP_VARIANT_COUNT));
      source.playbackRate.value = 0.8 + Math.random() * 0.5;
      const amp = context.createGain();
      amp.gain.value = Math.min(0.5, level);
      source.connect(amp);
      amp.connect(g.fx);
      source.onended = () => {
        source.disconnect();
        amp.disconnect();
      };
      source.start(when);
    } catch {
      // A pop is decoration.
    }
  }

  /**
   * A run of pops thinning out: the overrun crackle of unburnt fuel lighting
   * in a hot exhaust. `spread` stretches it — anti-lag keeps banging for a second.
   */
  function crackle(g: Graph, amount: number, spread: number): void {
    if (amount <= 0.05) return;
    const t = g.context.currentTime;
    const count = Math.round(2 + 5 * Math.min(1.5, amount));
    let at = t + 0.03 + Math.random() * 0.05;
    for (let i = 0; i < count; i++) {
      const fade = 1 - (i / count) * 0.55;
      pop(g, at, 0.13 * Math.min(1.3, amount) * (0.55 + Math.random() * 0.6) * fade);
      at += 0.035 + Math.random() * 0.24 * spread;
    }
    lastPopAt = t;
  }

  function createRival(g: Graph, id: string, rpm: number): Rival {
    const spec = RIVAL_ENGINE[kind];
    const place = new PositionalSource(g.context, g.rivals, {
      refDistance: 6,
      maxDistance: 400,
      rolloffFactor: 1.1,
      model: "inverse",
    });
    const level = g.context.createGain();
    level.gain.value = 0;
    level.connect(place.input);
    const voice = new EngineVoice(
      g.context,
      level,
      spec.voice,
      { rpm, rpmMax: spec.rpmMax, throttle: 0.8 },
      { quality: "lite" },
    );
    return { id, voice, level, place, detune: rivalDetune(id), radial: 0 };
  }

  function retireRival(g: Graph, slot: Rival): void {
    const t = g.context.currentTime;
    glide(slot.level.gain, 0, t, 0.04);
    slot.voice.stop(0.15);
    g.retired.push({
      until: t + 0.5,
      release: () => {
        slot.place.dispose();
        try {
          slot.level.disconnect();
        } catch {
          // Already gone.
        }
      },
    });
  }

  return {
    start() {
      if (disposed) return;
      started = true;
      retry = 0;
      if (!options.output) {
        // Inside the gesture this is what actually opens the device on iOS.
        const engine = getAudioEngine();
        engine.unlock();
        engine.installGestureUnlock();
      }
      ensureGraph();
    },

    frame(f, dt) {
      if (disposed || !f) return;
      kind = f.kind === "bike" ? "bike" : "car";
      lastFrameAt = now();
      const throttle = clamp01(f.throttle);
      const g = ensureGraph();
      if (!g) {
        prevThrottle = throttle;
        return;
      }
      const t = g.context.currentTime;
      const last = g.last;
      const bike = kind === "bike";

      if (stalled) {
        stalled = false;
        glide(g.out.gain, 1, t, 0.04);
      }
      if (!g.heard) {
        g.heard = true;
        glide(g.player.gain, 1, t, 0.03);
      }

      const profile = engineProfileFor(vehicle, kind);
      if (profile.key !== g.profile.key) {
        g.engine.stop(0.08);
        g.engine = new EngineVoice(g.context, g.player, profile.voice, { rpm: f.rpm, rpmMax: f.rpmMax, throttle });
        g.profile = profile;
      }

      const rpmMax = Number.isFinite(f.rpmMax) && f.rpmMax > 0 ? f.rpmMax : bike ? 14000 : 8000;
      // An engine that reports nothing still idles; zero would be a click train.
      const rpm = Number.isFinite(f.rpm) && f.rpm > 300 ? Math.min(f.rpm, rpmMax * 1.3) : 900;
      const revs = rpm / rpmMax;
      const speed = Math.max(0, Number.isFinite(f.speed) ? f.speed : 0);
      const step = clamp(dt, 0, 0.1);
      // A few frames of smoothing on slip, so a one-frame spike from a kerb
      // does not chirp.
      slip += (clamp01(f.slip) - slip) * (1 - Math.exp(-step / 0.05));

      g.engine.update({
        rpm,
        rpmMax,
        throttle,
        pitch: f.nitro ? 1.04 : 1,
        bright: f.nitro ? 1.35 : 1,
      });
      last.nitro = glideIfChanged(g.nitroLevel.gain, f.nitro ? LEVEL.nitro : 0, last.nitro, t, 0.06);

      // Tyres.
      const grip = f.offRoad ? 0.12 : 1;
      const onset = Math.pow(smoothstep(0.12, 0.6, slip), 1.2) * Math.min(1, speed / 5);
      const squeal = onset * (bike ? LEVEL.squealBike : LEVEL.squeal) * grip;
      if (squeal > 0.001 || (last.squeal ?? 0) > 0.001) {
        const centre = (bike ? 1700 : 1150) + (bike ? 1300 : 1100) * slip;
        // A wandering centre is what makes it a squeal and not a whistle.
        const wander = centre * (1 + (Math.random() - 0.5) * 0.12);
        glide(g.squealBand.frequency, wander, t, 0.03);
        glide(g.squealTone.frequency, wander, t, 0.03);
      }
      last.squeal = glideIfChanged(g.squealLevel.gain, squeal, last.squeal, t, 0.04);
      last.squealTone = glideIfChanged(g.squealToneLevel.gain, squeal * LEVEL.squealTone, last.squealTone, t, 0.04);

      // Air: level with speed squared, as drag is; brighter as it rises. A
      // rider has no cabin around the helmet.
      const air = Math.min(1.2, speed / WIND_REF);
      last.wind = glideIfChanged(g.windLevel.gain, air * air * (bike ? LEVEL.windBike : LEVEL.wind), last.wind, t, 0.12);
      last.windCut = glideIfChanged(g.windFilter.frequency, 260 * Math.pow(16, Math.min(1, air)), last.windCut, t, 0.12, 1e-2);

      // Surface.
      const roll = Math.min(1, speed / 70);
      last.road = glideIfChanged(g.roadLevel.gain, roll * (bike ? LEVEL.roadBike : LEVEL.road) * (f.offRoad ? 0.4 : 1), last.road, t, 0.08);
      last.roadCut = glideIfChanged(g.roadFilter.frequency, 160 + 640 * roll, last.roadCut, t, 0.1, 1e-2);
      last.rough = glideIfChanged(g.roughLevel.gain, f.offRoad ? Math.min(1, speed / 22) * LEVEL.rough : 0, last.rough, t, 0.08);
      last.roughRate = glideIfChanged(g.roughLfo.frequency, 5 + 11 * Math.min(1, speed / 40), last.roughRate, t, 0.2, 1e-2);

      // Lifting off hard from high revs: crackle, and the blow-off valve.
      const lifted = prevThrottle > 0.5 && throttle < 0.15;
      if (lifted && t - lastPopAt > 0.6 && speed > 4) {
        const from = profile.antiLag ? 0.35 : 0.55;
        if (revs > from) crackle(g, profile.crackle * (0.5 + 0.6 * revs) * (profile.antiLag ? 1.4 : 1), profile.antiLag ? 1 : 0.55);
        if (profile.blowOff && revs > 0.45) scheduleLayers(g.context, g.fx, BLOW_OFF, { gain: 0.6 + 0.6 * revs });
      }
      prevThrottle = throttle;

      // Drop the voices retired long enough ago that their fade is over.
      if (g.retired.length > 0) {
        g.retired = g.retired.filter((r) => {
          if (r.until > t) return true;
          r.release();
          return false;
        });
      }
    },

    event(e, strength) {
      if (disposed) return;
      const layers = RACE_CUES[e];
      if (!layers) return;
      const g = ensureGraph();
      if (!g) return;
      const t = g.context.currentTime;
      const gap = CUE_GAP[e] ?? 0;
      const previous = lastCue.get(e);
      if (gap > 0 && previous !== undefined && t - previous < gap && t >= previous) return;
      lastCue.set(e, t);

      scheduleLayers(g.context, g.fx, layers, cueParams(e, strength));
      switch (e) {
        case "gear-up":
          // The box cuts drive while the ratios swap; a sequential box under
          // load fires one crack out of the exhaust as it does.
          g.engine.cut(0.3, 0.085);
          if (prevThrottle > 0.7 && g.profile.crackle > 0.3) pop(g, t + 0.025, 0.08 * g.profile.crackle);
          break;
        case "gear-down":
          g.engine.cut(0.55, 0.05);
          crackle(g, g.profile.crackle * 0.6, 0.4);
          break;
        case "collision": {
          const s = strength === undefined || !Number.isFinite(strength) ? 0.6 : clamp01(strength);
          if (s > 0.45) scheduleLayers(g.context, g.fx, METAL_CRUNCH, { gain: 0.2 + s });
          break;
        }
        case "mini-turbo":
          pop(g, t + 0.01, 0.1);
          break;
        default:
          break;
      }
    },

    setOpponents(list, listener) {
      if (disposed) return;
      // Nothing is voiced unless the race is audible: no cost while muted.
      const g = graph;
      if (!g || !Array.isArray(list) || !listener) return;
      const t = g.context.currentTime;

      const near = new Map<string, { point: ListenerSpacePoint; rpm: number }>();
      for (const o of list) {
        if (!o || typeof o.id !== "string") continue;
        near.set(o.id, { point: toListenerSpace(o, listener), rpm: o.rpm });
      }
      const ids = assignRivalSlots(
        g.slots.map((s) => s?.id ?? null),
        [...near].map(([id, v]) => ({ id, distance: v.point.distance })),
        RIVAL_RANGE,
      );

      ids.forEach((id, i) => {
        let slot = g.slots[i] ?? null;
        if (slot && slot.id !== id) {
          retireRival(g, slot);
          slot = null;
          g.slots[i] = null;
        }
        if (id === null) return;
        const car = near.get(id);
        if (!car) return;
        const spec = RIVAL_ENGINE[kind];
        const rpm = Number.isFinite(car.rpm) && car.rpm > 300 ? car.rpm : spec.rpmMax * 0.5;
        if (!slot) {
          slot = createRival(g, id, rpm);
          g.slots[i] = slot;
        }

        // Doppler from how fast the distance is changing, measured on the
        // audio clock, which advances in 3 ms steps: skip a call that lands
        // in the same step, and forget a gap long enough to be a pause.
        const distance = car.point.distance;
        if (slot.at === undefined || slot.distance === undefined) {
          slot.at = t;
          slot.distance = distance;
        } else {
          const elapsed = t - slot.at;
          if (elapsed > 0.25 || elapsed < 0) {
            slot.radial = 0;
            slot.at = t;
            slot.distance = distance;
          } else if (elapsed > 0.004) {
            const v = (distance - slot.distance) / elapsed;
            slot.radial += (v - slot.radial) * 0.25;
            slot.at = t;
            slot.distance = distance;
          }
        }

        slot.voice.update(
          { rpm, rpmMax: spec.rpmMax, throttle: 0.8, pitch: dopplerFactor(slot.radial) * slot.detune },
          0.05,
        );
        slot.place.setPosition(car.point, 0.04);
        const fade = clamp01((RIVAL_RANGE - distance) / RIVAL_FADE);
        slot.levelLast = glideIfChanged(slot.level.gain, fade, slot.levelLast, t, 0.08);
      });
    },

    setMuted(m) {
      localMuted = Boolean(m);
      if (localMuted) teardown();
    },

    setVehicle(modelId) {
      vehicle = typeof modelId === "string" && modelId ? modelId : null;
    },

    dispose() {
      disposed = true;
      teardown();
    },
  };
}
