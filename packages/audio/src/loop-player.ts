import type { AudioBus } from "./mixer.js";
import {
  clampLoopParam,
  driveCurve,
  loopParamSpecs,
  resolveLoopParams,
  resolveLoopTargets,
  type LoopParamSpec,
  type LoopParamValues,
  type LoopSpec,
  type LoopTargets,
} from "./loops.js";

/**
 * A continuous sound you can start, steer and stop.
 *
 * Handles are cheap and inert until `start()`. Every method is safe to call in
 * any state — before start, after stop, without Web Audio at all — because the
 * callers are game loops, and a game loop must never need a try/catch around
 * its sound.
 */
export interface LoopHandle<P extends string = string> {
  /** True between `start()` and `stop()` while audio is actually running. */
  readonly playing: boolean;
  /** Builds the nodes and fades in. Does nothing if already playing. */
  start(): void;
  /** Fades out over `fadeSeconds` (default 0.2) and releases the nodes. Can be started again. */
  stop(fadeSeconds?: number): void;
  /**
   * Steers the sound. Values are clamped to the loop's declared range, and the
   * change glides over the parameter's smoothing time unless `rampSeconds`
   * says otherwise. Cheap enough to call every frame: an unchanged value
   * schedules nothing.
   */
  setParam(name: P, value: number, rampSeconds?: number): void;
  setParams(values: LoopParamValues<P>, rampSeconds?: number): void;
  getParam(name: P): number;
  /** Stops, and turns every later call into a no-op. */
  dispose(): void;
}

/** What a loop needs from the engine. */
export interface LoopHost {
  /** The live context, the bus input to connect to, and a looping noise buffer; null without Web Audio. */
  attachLoop(bus: AudioBus): { context: AudioContext; destination: AudioNode; noise: AudioBuffer } | null;
  loopStarted(loop: LoopPlayer): void;
  loopStopped(loop: LoopPlayer): void;
}

interface Graph {
  context: AudioContext;
  sources: AudioScheduledSourceNode[];
  tones: Array<{ node: OscillatorNode; ratio: number }>;
  drive: GainNode;
  filter: BiquadFilterNode | null;
  out: GainNode;
  panner: StereoPannerNode | null;
  nodes: AudioNode[];
}

/** Seconds of fade-in on start: long enough not to click, short enough to feel instant. */
const FADE_IN = 0.04;

/**
 * Glide an AudioParam towards `value`.
 *
 * `setTargetAtTime` rather than a linear ramp: it starts from wherever the
 * parameter currently *is*, so a new value arriving mid-glide — every frame,
 * from a game loop — bends the curve instead of jumping back to restart it.
 * The time constant is a third of the ramp, so the value is ~95% there by then.
 */
function glide(param: AudioParam, value: number, at: number, seconds: number): void {
  try {
    param.setTargetAtTime(value, at, Math.max(0.001, seconds / 3));
  } catch {
    param.value = value;
  }
}

function differs(a: number, b: number): boolean {
  return Math.abs(a - b) > 1e-4 * Math.max(1, Math.abs(b));
}

export class LoopPlayer<P extends string = string> implements LoopHandle<P> {
  private values: Record<string, number>;
  private readonly params: Record<string, LoopParamSpec>;
  private graph: Graph | null = null;
  private applied: LoopTargets | null = null;
  private disposed = false;

  constructor(
    private readonly host: LoopHost,
    private readonly spec: LoopSpec,
    initial: Record<string, number | undefined> = {},
  ) {
    this.params = loopParamSpecs(spec);
    this.values = resolveLoopParams(spec, initial);
  }

  get playing(): boolean {
    return this.graph !== null;
  }

  start(): void {
    // No voices (an unknown id) means nothing to hear: do not open a context for it.
    if (this.disposed || this.graph || this.spec.voices.length === 0) return;
    const port = this.host.attachLoop(this.spec.bus);
    if (!port) return;

    try {
      this.graph = this.build(port.context, port.destination, port.noise);
    } catch {
      // A browser missing a node type gets silence, not an exception.
      this.graph = null;
      return;
    }
    this.host.loopStarted(this);
  }

  stop(fadeSeconds = 0.2): void {
    const graph = this.graph;
    if (!graph) return;
    this.graph = null;
    this.applied = null;
    this.host.loopStopped(this);

    const fade = Number.isFinite(fadeSeconds) ? Math.min(5, Math.max(0, fadeSeconds)) : 0.2;
    try {
      const now = graph.context.currentTime;
      glide(graph.out.gain, 0, now, fade);
      // A little past the fade, so the tail of the exponential is not cut off.
      const end = now + fade + 0.05;
      for (const source of graph.sources) source.stop(end);
      const first = graph.sources[0];
      if (first) {
        first.onended = () => {
          for (const node of graph.nodes) {
            try {
              node.disconnect();
            } catch {
              // Already disconnected.
            }
          }
        };
      }
    } catch {
      // The context was closed under us; its nodes are already gone.
    }
  }

  setParam(name: P, value: number, rampSeconds?: number): void {
    this.setParams({ [name]: value } as LoopParamValues<P>, rampSeconds);
  }

  setParams(values: LoopParamValues<P>, rampSeconds?: number): void {
    if (this.disposed) return;
    let smoothing = 0;
    let changed = false;
    for (const [name, raw] of Object.entries(values) as Array<[string, number | undefined]>) {
      const param = this.params[name];
      if (!param || raw === undefined) continue;
      const next = clampLoopParam(param, raw);
      if (next === this.values[name]) continue;
      this.values[name] = next;
      smoothing = Math.max(smoothing, param.smoothing);
      changed = true;
    }
    if (!changed || !this.graph) return;
    const ramp = rampSeconds !== undefined && Number.isFinite(rampSeconds) ? Math.max(0, rampSeconds) : smoothing;
    this.apply(this.graph, ramp);
  }

  getParam(name: P): number {
    return this.values[name] ?? this.params[name]?.default ?? 0;
  }

  dispose(): void {
    this.stop(0.05);
    this.disposed = true;
  }

  private build(context: AudioContext, destination: AudioNode, noise: AudioBuffer): Graph {
    const nodes: AudioNode[] = [];
    const sources: AudioScheduledSourceNode[] = [];
    // Seconds into the noise buffer each noise source begins at. Each starts
    // somewhere different, or two noise voices would be the same signal and
    // simply add up instead of sounding like two.
    const offsets = new Map<AudioScheduledSourceNode, number>();
    const tones: Graph["tones"] = [];
    const track = <N extends AudioNode>(node: N): N => {
      nodes.push(node);
      return node;
    };

    const targets = resolveLoopTargets(this.spec, this.values);
    const mix = track(context.createGain());

    for (const voice of this.spec.voices) {
      let source: AudioScheduledSourceNode;
      if (voice.kind === "noise") {
        const node = track(context.createBufferSource());
        node.buffer = noise;
        node.loop = true;
        offsets.set(node, Math.random() * noise.duration);
        source = node;
      } else {
        const node = track(context.createOscillator());
        node.type = voice.waveform ?? "sine";
        const ratio = voice.ratio ?? 1;
        node.frequency.value = targets.pitch * ratio;
        if (voice.detune) node.detune.value = voice.detune;
        tones.push({ node, ratio });
        source = node;
      }
      sources.push(source);

      let tail: AudioNode = source;
      if (voice.filter) {
        const filter = track(context.createBiquadFilter());
        filter.type = voice.filter.type;
        filter.frequency.value = voice.filter.frequency;
        if (voice.filter.q !== undefined) filter.Q.value = voice.filter.q;
        tail.connect(filter);
        tail = filter;
      }

      const level = track(context.createGain());
      level.gain.value = voice.gain;
      tail.connect(level);
      level.connect(mix);

      if (voice.wobble) {
        // An LFO added onto the gain param: gain swings ±depth around its value.
        const lfo = track(context.createOscillator());
        lfo.frequency.value = voice.wobble.rate;
        const depth = track(context.createGain());
        depth.gain.value = voice.gain * voice.wobble.depth;
        lfo.connect(depth);
        depth.connect(level.gain);
        sources.push(lfo);
      }
    }

    const drive = track(context.createGain());
    drive.gain.value = targets.drive;
    mix.connect(drive);
    let tail: AudioNode = drive;

    if (this.spec.shaper !== undefined) {
      const shaper = track(context.createWaveShaper());
      shaper.curve = driveCurve(this.spec.shaper);
      // Distortion makes harmonics; without oversampling the ones above
      // Nyquist fold back down as inharmonic fizz.
      shaper.oversample = "2x";
      tail.connect(shaper);
      tail = shaper;
    }

    let filter: BiquadFilterNode | null = null;
    if (this.spec.filter) {
      filter = track(context.createBiquadFilter());
      filter.type = this.spec.filter.type;
      filter.frequency.value = targets.cutoff;
      if (this.spec.filter.q !== undefined) filter.Q.value = this.spec.filter.q;
      tail.connect(filter);
      tail = filter;
    }

    const out = track(context.createGain());
    out.gain.value = 0;
    tail.connect(out);
    tail = out;

    let panner: StereoPannerNode | null = null;
    if (typeof context.createStereoPanner === "function") {
      panner = track(context.createStereoPanner());
      panner.pan.value = targets.pan;
      tail.connect(panner);
      tail = panner;
    }
    tail.connect(destination);

    const now = context.currentTime;
    for (const source of sources) {
      const offset = offsets.get(source);
      if (offset === undefined) source.start(now);
      else (source as AudioBufferSourceNode).start(now, offset);
    }

    const graph: Graph = { context, sources, tones, drive, filter, out, panner, nodes };
    glide(out.gain, targets.gain, now, FADE_IN * 3);
    this.applied = targets;
    return graph;
  }

  private apply(graph: Graph, seconds: number): void {
    const next = resolveLoopTargets(this.spec, this.values);
    const prev = this.applied;
    const now = graph.context.currentTime;
    try {
      if (!prev || differs(next.pitch, prev.pitch)) {
        for (const { node, ratio } of graph.tones) glide(node.frequency, next.pitch * ratio, now, seconds);
      }
      if (graph.filter && (!prev || differs(next.cutoff, prev.cutoff))) {
        glide(graph.filter.frequency, next.cutoff, now, seconds);
      }
      if (!prev || differs(next.gain, prev.gain)) glide(graph.out.gain, next.gain, now, seconds);
      if (!prev || differs(next.drive, prev.drive)) glide(graph.drive.gain, next.drive, now, seconds);
      if (graph.panner && (!prev || differs(next.pan, prev.pan))) glide(graph.panner.pan, next.pan, now, seconds);
      this.applied = next;
    } catch {
      // Context closed mid-update. The next start() rebuilds on a fresh one.
    }
  }
}

