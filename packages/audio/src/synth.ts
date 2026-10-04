import { resolvePlayParams, type Layer, type PlayParams, type ResolvedPlayParams } from "./sounds.js";

/**
 * Building blocks for graphs a game wires up itself.
 *
 * The engine's `play()` and `loop()` cover sounds that can be described as
 * data. A racing car is not one of those: its engine, tyres and wind are a
 * dozen nodes steered sixty times a second from physics. These helpers are the
 * pieces such code needs to stay as well-behaved as the catalogue — no zipper
 * noise, no NaN reaching an AudioParam, one shared noise buffer — while
 * connecting to whatever destination it is given. That destination is a mixer
 * bus from `AudioEngine.output()` in a game, or an OfflineAudioContext's
 * destination in a test that renders the sound and measures it.
 *
 * Everything takes a `BaseAudioContext` so the same code runs offline.
 */

/** Seconds of shared white noise. Long enough that its loop point is inaudible. */
export const NOISE_SECONDS = 2;

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

/**
 * White noise, made once per context and shared by every caller.
 *
 * Two seconds at 48 kHz is 384 KB; one per voice would be megabytes for a
 * grid of eight cars. Callers decorrelate by starting at different offsets.
 */
export function whiteNoise(context: BaseAudioContext): AudioBuffer {
  const cached = noiseCache.get(context);
  if (cached) return cached;
  const frames = Math.max(1, Math.floor(context.sampleRate * NOISE_SECONDS));
  const buffer = context.createBuffer(1, frames, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  noiseCache.set(context, buffer);
  return buffer;
}

/**
 * A looping noise source started at a random point of the shared buffer.
 *
 * Two layers fed from the same offset are the same signal and simply add up;
 * a random start is what makes wind and tyres sound like two things.
 */
export function noiseSource(context: BaseAudioContext, buffer: AudioBuffer = whiteNoise(context)): AudioBufferSourceNode {
  const node = context.createBufferSource();
  node.buffer = buffer;
  node.loop = true;
  node.start(context.currentTime, Math.random() * buffer.duration);
  return node;
}

/** Clamps to what an AudioParam can hold for a frequency without misbehaving. */
export const clampHz = (hz: number): number => (Number.isFinite(hz) ? Math.min(20000, Math.max(20, hz)) : 20);

/**
 * Steers an AudioParam towards `value`, starting from wherever it is now.
 *
 * `setTargetAtTime` rather than a ramp, because a game loop sends a new value
 * every frame: a ramp would restart from its scheduled origin and step, while
 * an exponential approach bends towards each new target from the current
 * value. `timeConstant` is the time to cover ~63% of the way.
 *
 * A non-finite value is dropped rather than applied: a NaN on an AudioParam
 * silences the node for the life of the page.
 */
export function glide(param: AudioParam, value: number, at: number, timeConstant: number): void {
  if (!Number.isFinite(value) || !Number.isFinite(at)) return;
  try {
    param.setTargetAtTime(value, at, Math.max(0.001, Number.isFinite(timeConstant) ? timeConstant : 0.02));
  } catch {
    param.value = value;
  }
}

/**
 * Only steers the param when `value` moved meaningfully since `last`.
 *
 * Every `setTargetAtTime` is an event on the param's timeline; at 60 Hz for a
 * dozen params that is a lot of bookkeeping for values that did not change.
 * Returns the value now heading for, to store as the next `last`.
 */
export function glideIfChanged(
  param: AudioParam,
  value: number,
  last: number | undefined,
  at: number,
  timeConstant: number,
  epsilon = 1e-3,
): number {
  if (last !== undefined && Math.abs(value - last) <= epsilon * Math.max(1, Math.abs(value))) return last;
  glide(param, value, at, timeConstant);
  return value;
}

/** Sets a param exactly from `at`, discarding anything scheduled after it. */
export function holdAt(param: AudioParam, value: number, at: number): void {
  if (!Number.isFinite(value)) return;
  try {
    param.cancelScheduledValues(at);
    param.setValueAtTime(value, at);
  } catch {
    param.value = value;
  }
}

/** Stops and disconnects nodes now, tolerating ones never started or already gone. */
export function releaseNodes(nodes: Iterable<AudioNode>): void {
  for (const node of nodes) {
    const stop = (node as Partial<AudioScheduledSourceNode>).stop;
    if (typeof stop === "function") {
      try {
        stop.call(node);
      } catch {
        // Never started, or already stopped.
      }
    }
    try {
      node.disconnect();
    } catch {
      // Already disconnected.
    }
  }
}

/**
 * Schedules one layer of a sound spec onto any destination.
 *
 * This is the engine's own one-shot renderer, shared so that hand-built graphs
 * can play catalogue-style sounds through their own gain (a race's local mute,
 * say) instead of straight onto the bus.
 */
export function scheduleLayer(
  context: BaseAudioContext,
  layer: Layer,
  startTime: number,
  params: ResolvedPlayParams,
  destination: AudioNode,
  noise: AudioBuffer,
): void {
  const begin = startTime + layer.delay;
  const end = begin + layer.duration;
  const peak = Math.max(0.0001, layer.gain * params.gain);

  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, begin);
  gain.gain.exponentialRampToValueAtTime(peak, begin + Math.max(0.001, layer.attack));
  // Exponential to near-zero rather than to zero: a ramp to exactly 0 is
  // undefined for exponential curves and clicks audibly.
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  let source: AudioNode;
  if (layer.kind === "noise") {
    const node = context.createBufferSource();
    node.buffer = noise;
    // A random window of the shared buffer: two noise layers of one sound
    // must not be the same samples, or they sum into one louder layer.
    const room = Math.max(0, noise.duration - layer.duration);
    if (layer.duration >= noise.duration) node.loop = true;
    node.start(begin, Math.random() * room);
    node.stop(end);
    source = node;
  } else {
    const osc = context.createOscillator();
    osc.type = layer.waveform ?? "sine";
    osc.frequency.setValueAtTime((layer.frequency ?? 440) * params.pitch, begin);
    if (layer.endFrequency !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, layer.endFrequency * params.pitch), end);
    }
    osc.start(begin);
    osc.stop(end);
    source = osc;
  }

  if (layer.filter !== undefined) {
    const filter = context.createBiquadFilter();
    filter.type = layer.filterType ?? "lowpass";
    // Pitch moves the filter with the tone, so a sound pitched up keeps its
    // character instead of getting duller.
    filter.frequency.setValueAtTime(clampHz(layer.filter * params.pitch), begin);
    if (layer.endFilter !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(clampHz(layer.endFilter * params.pitch), end);
    }
    if (layer.q !== undefined) filter.Q.setValueAtTime(layer.q, begin);
    source.connect(filter);
    filter.connect(gain);
  } else {
    source.connect(gain);
  }

  gain.connect(destination);
}

/**
 * Plays a list of layers on `destination`, now or `params.delay` from now.
 * One bad layer is skipped rather than silencing the rest.
 */
export function scheduleLayers(
  context: BaseAudioContext,
  destination: AudioNode,
  layers: readonly Layer[],
  params?: PlayParams,
): void {
  const resolved = resolvePlayParams(params);
  const start = context.currentTime + resolved.delay;
  const noise = whiteNoise(context);
  for (const layer of layers) {
    try {
      scheduleLayer(context, layer, start, resolved, destination, noise);
    } catch {
      // One bad layer must not silence the rest of the sound.
    }
  }
}

/**
 * A short percussive buffer: an exhaust pop, a backfire, a crackle.
 *
 * Synthesised once per context and replayed through a buffer source at a
 * varied rate, because a crackling overrun is a dozen pops a second, and a
 * dozen oscillator-plus-filter chains a second is real work on a phone.
 * `variant` changes the noise seed and the thump, so a run of pops is not one
 * pop repeated.
 */
export function popBuffer(context: BaseAudioContext, variant = 0): AudioBuffer {
  const key = Math.max(0, Math.floor(variant)) % POP_VARIANTS.length;
  let perContext = popCache.get(context);
  if (!perContext) {
    perContext = [];
    popCache.set(context, perContext);
  }
  const cached = perContext[key];
  if (cached) return cached;

  const shape = POP_VARIANTS[key] ?? POP_VARIANTS[0]!;
  const rate = context.sampleRate;
  const frames = Math.max(1, Math.floor(rate * shape.seconds));
  const buffer = context.createBuffer(1, frames, rate);
  const data = buffer.getChannelData(0);
  // A small deterministic generator, so each variant is the same pop every
  // time it is rebuilt (hot reload, a new context) and can be judged by ear.
  let seed = 0x9e3779b9 ^ (key * 0x85ebca6b);
  const rand = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) / 0xffffffff) * 2 - 1;
  };
  let low = 0;
  for (let i = 0; i < frames; i++) {
    const t = i / rate;
    // A one-pole low-pass on the noise takes the hiss off the crack.
    low += (rand() - low) * shape.tone;
    const crack = low * Math.exp(-t / shape.crack);
    const thump = Math.sin(2 * Math.PI * shape.thumpHz * t) * Math.exp(-t / shape.thump);
    data[i] = Math.max(-1, Math.min(1, crack * 0.9 + thump * 0.7));
  }
  perContext[key] = buffer;
  return buffer;
}

const popCache = new WeakMap<BaseAudioContext, AudioBuffer[]>();

const POP_VARIANTS = [
  { seconds: 0.09, crack: 0.008, thump: 0.03, thumpHz: 78, tone: 0.55 },
  { seconds: 0.12, crack: 0.012, thump: 0.045, thumpHz: 62, tone: 0.4 },
  { seconds: 0.07, crack: 0.005, thump: 0.02, thumpHz: 95, tone: 0.7 },
] as const;

export const POP_VARIANT_COUNT = POP_VARIANTS.length;
