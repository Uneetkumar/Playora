import {
  AUDIO_BUSES,
  DEFAULT_MIXER,
  effectiveVolume,
  normalizeMixer,
  setBusVolume,
  setMaster,
  toggleBus,
  toggleMute,
  type AudioBus,
  type MixerState,
} from "./mixer.js";
import {
  SOUNDS,
  resolvePlayParams,
  type Layer,
  type PlayParams,
  type ResolvedPlayParams,
  type SoundId,
  type SoundSpec,
} from "./sounds.js";
import { LOOPS, type LoopId, type LoopParamName, type LoopParamValues, type LoopSpec } from "./loops.js";
import { LoopPlayer, type LoopHandle, type LoopHost } from "./loop-player.js";

/** Where gesture listeners go. `window` in a browser; a stub in tests. */
export type GestureTarget = Pick<EventTarget, "addEventListener" | "removeEventListener">;

export interface AudioEngineOptions {
  /** Injected for tests; defaults to the browser's AudioContext. */
  contextFactory?: () => AudioContext;
  /** Where mixer settings are read from and written to. */
  storage?: Pick<Storage, "getItem" | "setItem">;
  storageKey?: string;
  now?: () => number;
  /**
   * Whether the page has had a user gesture yet. Defaults to the browser's
   * `navigator.userActivation`; injected for tests.
   */
  hasUserActivation?: () => boolean;
}

/** The shared context and a bus to connect hand-built nodes to. */
export interface AudioOutput {
  context: AudioContext;
  destination: AudioNode;
}

const STORAGE_KEY = "playora.audio";

/** Seconds of the shared noise buffer. Long enough that its loop point is inaudible. */
const NOISE_SECONDS = 2;

/** Time constant for mixer changes, so dragging a volume slider does not zipper. */
const MIXER_SMOOTHING = 0.015;

const GESTURE_EVENTS = ["pointerdown", "keydown", "touchend"] as const;

/**
 * Plays the platform's sounds.
 *
 * Three things drive the design:
 *
 * 1. **One AudioContext, made late.** Browsers refuse to start audio before
 *    the user has interacted with the page, and each context holds an audio
 *    device. The context is created by the first sound after a gesture, the
 *    first loop started, or the first gesture once `installGestureUnlock()` is
 *    armed — and resumed whenever it is found suspended.
 *
 * 2. **Volume lives in the graph.** Every sound goes through a gain node per
 *    bus and then a master gain, so a slider moved or a mute pressed reaches a
 *    loop that is already running, not only the sounds that start afterwards.
 *
 * 3. **Never throw.** Audio is decoration. A browser without Web Audio, a
 *    context that will not resume, storage that is unavailable in private
 *    browsing — none of that is allowed to interrupt a game, so every entry
 *    point degrades to silence instead of raising.
 */
export class AudioEngine implements LoopHost {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private busGains: Partial<Record<AudioBus, GainNode>> = {};
  private noise: AudioBuffer | null = null;
  private mixer: MixerState;
  private lastPlayed = new Map<SoundId, number>();
  /** Throttle bookkeeping for inline specs, keyed by object so they can be collected. */
  private lastPlayedSpec = new WeakMap<SoundSpec, number>();
  private loops = new Set<LoopPlayer>();
  private removeGestureListeners: (() => void) | null = null;
  private primed = false;
  private readonly contextFactory: () => AudioContext;
  private readonly storage: Pick<Storage, "getItem" | "setItem"> | null;
  private readonly storageKey: string;
  private readonly now: () => number;
  private readonly hasUserActivation: () => boolean;
  private unavailable = false;

  constructor(options: AudioEngineOptions = {}) {
    this.contextFactory =
      options.contextFactory ??
      (() => {
        const Ctor =
          (globalThis as { AudioContext?: typeof AudioContext }).AudioContext ??
          (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) throw new Error("Web Audio is not available.");
        return new Ctor();
      });
    this.storage = options.storage ?? safeLocalStorage();
    this.storageKey = options.storageKey ?? STORAGE_KEY;
    this.now = options.now ?? (() => Date.now());
    this.hasUserActivation = options.hasUserActivation ?? browserUserActivation;
    this.mixer = this.load();
  }

  getMixer(): MixerState {
    return this.mixer;
  }

  setMasterVolume(value: number): MixerState {
    return this.commit(setMaster(this.mixer, value));
  }

  setVolume(bus: AudioBus, value: number): MixerState {
    return this.commit(setBusVolume(this.mixer, bus, value));
  }

  setMuted(muted: boolean): MixerState {
    return this.commit(muted === this.mixer.muted ? this.mixer : toggleMute(this.mixer));
  }

  toggleBusMuted(bus: AudioBus): MixerState {
    return this.commit(toggleBus(this.mixer, bus));
  }

  /**
   * Plays a sound from the catalogue, or one described inline, or does nothing.
   *
   * Returns whether it actually made a noise, which is what tests assert on —
   * "did not throw" is not the same as "played".
   */
  play(sound: SoundId | SoundSpec, params?: PlayParams): boolean {
    if (this.unavailable) return false;

    const spec = typeof sound === "string" ? SOUNDS[sound] : sound;
    if (!spec || !Array.isArray(spec.layers)) return false;

    if (effectiveVolume(this.mixer, spec.bus) <= 0) return false;

    const throttle = spec.throttleMs ?? 0;
    const at = this.now();
    if (throttle > 0) {
      const previous = typeof sound === "string" ? this.lastPlayed.get(sound) : this.lastPlayedSpec.get(sound);
      if (previous !== undefined && at - previous < throttle) return false;
    }

    const context = this.readyContext();
    if (!context) return false;
    const bus = this.busGains[spec.bus];
    if (!bus) return false;

    if (typeof sound === "string") this.lastPlayed.set(sound, at);
    else this.lastPlayedSpec.set(sound, at);

    const resolved = resolvePlayParams(params);
    const start = context.currentTime + resolved.delay;
    const destination = this.panned(context, bus, resolved.pan);
    for (const layer of spec.layers) {
      try {
        this.scheduleLayer(context, layer, start, resolved, destination);
      } catch {
        // One bad layer must not silence the rest of the sound.
      }
    }
    return true;
  }

  /**
   * A continuous sound: `loop("engine", { rpm: 900 })`, or a `LoopSpec` of a
   * game's own. The handle is inert until `start()`.
   */
  loop<L extends LoopId>(id: L, params?: LoopParamValues<LoopParamName<L>>): LoopHandle<LoopParamName<L>>;
  loop(spec: LoopSpec, params?: LoopParamValues): LoopHandle;
  loop(source: LoopId | LoopSpec, params: LoopParamValues = {}): LoopHandle {
    const spec: LoopSpec | undefined = typeof source === "string" ? LOOPS[source] : source;
    // An unknown id from untyped code still gets a handle, just a silent one.
    return new LoopPlayer(this, spec ?? SILENT_LOOP, params);
  }

  /**
   * The shared context and a bus input, for code that builds its own nodes.
   *
   * This is the migration path for hand-written synthesis that is not worth
   * redescribing as a `SoundSpec`: keep the oscillators, connect them here
   * instead of to a private context's destination, and they obey the mixer.
   * Null when there is no audio or the bus is silent, so the caller's existing
   * `if (!ctx) return` also covers mute.
   */
  output(bus: AudioBus = "sfx"): AudioOutput | null {
    if (this.unavailable || effectiveVolume(this.mixer, bus) <= 0) return null;
    const context = this.readyContext();
    if (!context) return null;
    const destination = this.busGains[bus];
    return destination ? { context, destination } : null;
  }

  /**
   * Starts audio from inside a user gesture.
   *
   * Call it from a click handler (a Start button) to guarantee the first sound
   * after it is heard; `installGestureUnlock` does the same automatically.
   */
  unlock(): void {
    const context = this.ensureContext();
    if (!context || this.primed) return;
    this.primed = true;
    try {
      // iOS Safari before 17 only opens output for a source started inside
      // the gesture itself; resume() alone leaves it silent. One silent frame
      // is enough.
      const tick = context.createBufferSource();
      tick.buffer = context.createBuffer(1, 1, context.sampleRate);
      tick.connect(context.destination);
      tick.start(0);
    } catch {
      // Nothing to unlock with; the resume() in ensureContext is the best we have.
    }
  }

  /**
   * Unlocks audio on the first pointer, key or touch anywhere on the page.
   *
   * Idempotent, so every component that wants sound can call it on mount. The
   * listeners remove themselves once the context is running; the returned
   * function removes them earlier, which only tests need.
   */
  installGestureUnlock(target: GestureTarget | null = defaultGestureTarget()): () => void {
    if (this.removeGestureListeners) return this.removeGestureListeners;
    if (!target || this.unavailable) return () => {};

    const remove = () => {
      for (const type of GESTURE_EVENTS) target.removeEventListener(type, onGesture, true);
      if (this.removeGestureListeners === remove) this.removeGestureListeners = null;
    };
    const onGesture = () => {
      this.unlock();
      const context = this.context;
      if (!context) {
        if (this.unavailable) remove();
        return;
      }
      if (context.state === "running") {
        remove();
        return;
      }
      void context
        .resume()
        .then(() => {
          if (context.state === "running") remove();
        })
        .catch(() => {});
    };

    for (const type of GESTURE_EVENTS) {
      // Capture phase, so a game that stops propagation on its canvas still unlocks.
      target.addEventListener(type, onGesture, { capture: true, passive: true });
    }
    this.removeGestureListeners = remove;
    return remove;
  }

  /** Releases the audio device. Safe to call when nothing was ever started. */
  async dispose(): Promise<void> {
    for (const loop of [...this.loops]) loop.stop(0);
    this.loops.clear();
    this.removeGestureListeners?.();
    const context = this.context;
    this.resetGraph();
    if (!context) return;
    try {
      await context.close();
    } catch {
      // Already closed, or never opened.
    }
  }

  /** @internal LoopHost */
  attachLoop(bus: AudioBus): { context: AudioContext; destination: AudioNode; noise: AudioBuffer } | null {
    if (this.unavailable) return null;
    // Unlike `play`, a loop starts even while muted or before a gesture: it is
    // meant to be running when the sound comes back, and the bus gain is what
    // keeps it quiet until then.
    const context = this.ensureContext();
    const destination = this.busGains[bus];
    if (!context || !destination) return null;
    try {
      return { context, destination, noise: this.noiseBuffer(context) };
    } catch {
      return null;
    }
  }

  /** @internal LoopHost */
  loopStarted(loop: LoopPlayer): void {
    this.loops.add(loop);
  }

  /** @internal LoopHost */
  loopStopped(loop: LoopPlayer): void {
    this.loops.delete(loop);
  }

  private commit(next: MixerState): MixerState {
    this.mixer = next;
    this.applyMixer(false);
    try {
      this.storage?.setItem(this.storageKey, JSON.stringify(next));
    } catch {
      // Private browsing, or storage disabled. Settings simply will not persist.
    }
    return next;
  }

  /** Pushes the mixer onto the live graph: master × bus is `effectiveVolume`. */
  private applyMixer(immediate: boolean): void {
    const context = this.context;
    if (!context || !this.masterGain) return;
    const set = (param: AudioParam, value: number) => {
      if (immediate) {
        param.value = value;
        return;
      }
      try {
        param.setTargetAtTime(value, context.currentTime, MIXER_SMOOTHING);
      } catch {
        param.value = value;
      }
    };
    set(this.masterGain.gain, this.mixer.muted ? 0 : clamp01(this.mixer.master));
    for (const bus of AUDIO_BUSES) {
      const node = this.busGains[bus];
      if (!node) continue;
      set(node.gain, this.mixer.mutedBuses.includes(bus) ? 0 : clamp01(this.mixer.volumes[bus] ?? 0));
    }
  }

  private load(): MixerState {
    try {
      const raw = this.storage?.getItem(this.storageKey);
      return raw ? normalizeMixer(JSON.parse(raw)) : DEFAULT_MIXER;
    } catch {
      return DEFAULT_MIXER;
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.unavailable) return null;
    if (this.context) {
      if (this.context.state === "closed") {
        // Closed by someone else. Start over rather than talk to a dead graph,
        // and let running loops know they are no longer running.
        for (const loop of [...this.loops]) loop.stop(0);
        this.resetGraph();
      } else {
        // Tabs suspend contexts on backgrounding, and iOS "interrupts" them for
        // calls; resuming is a no-op when already running.
        if (this.context.state !== "running") void this.context.resume().catch(() => {});
        return this.context;
      }
    }
    try {
      const context = this.contextFactory();
      const master = context.createGain();
      master.connect(context.destination);
      const buses: Partial<Record<AudioBus, GainNode>> = {};
      for (const bus of AUDIO_BUSES) {
        const node = context.createGain();
        node.connect(master);
        buses[bus] = node;
      }
      this.context = context;
      this.masterGain = master;
      this.busGains = buses;
      this.applyMixer(true);
      if (context.state !== "running") void context.resume().catch(() => {});
      return context;
    } catch {
      // No Web Audio at all. Stop trying: retrying per sound costs a throw each.
      this.unavailable = true;
      return null;
    }
  }

  private resetGraph(): void {
    this.context = null;
    this.masterGain = null;
    this.busGains = {};
    this.noise = null;
    this.primed = false;
  }

  /**
   * The context, if a one-shot scheduled on it now will be heard now.
   *
   * A context that is suspended because the page has never been touched will
   * not start until it is — and then plays everything queued at once, so seven
   * dealt cards and a turn chime arrive as one burst on the first click. Better
   * to drop them, and not to make a context at all yet: it could only start
   * suspended, and Chrome logs a warning for every one that does. Once there
   * has been a gesture, a suspension is momentary (a backgrounded tab, a
   * resume in flight) and the sound should be queued.
   */
  private readyContext(): AudioContext | null {
    if (!this.context && !this.hasUserActivation()) return null;
    const context = this.ensureContext();
    if (!context) return null;
    return context.state === "running" || this.hasUserActivation() ? context : null;
  }

  /** A stereo panner in front of `bus` for one sound, or the bus itself when centred. */
  private panned(context: AudioContext, bus: AudioNode, pan: number): AudioNode {
    if (pan === 0 || typeof context.createStereoPanner !== "function") return bus;
    try {
      const panner = context.createStereoPanner();
      panner.pan.value = pan;
      panner.connect(bus);
      return panner;
    } catch {
      return bus;
    }
  }

  private scheduleLayer(
    context: AudioContext,
    layer: Layer,
    startTime: number,
    params: ResolvedPlayParams,
    destination: AudioNode,
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
      const buffer = this.noiseBuffer(context);
      const node = context.createBufferSource();
      node.buffer = buffer;
      // A random window of the shared buffer: two noise layers of one sound
      // must not be the same samples, or they sum into one louder layer.
      const room = Math.max(0, NOISE_SECONDS - layer.duration);
      if (layer.duration >= NOISE_SECONDS) node.loop = true;
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

  /** White noise, made once per context and shared by every sound and loop. */
  private noiseBuffer(context: AudioContext): AudioBuffer {
    if (this.noise) return this.noise;
    const frames = Math.max(1, Math.floor(context.sampleRate * NOISE_SECONDS));
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;
    return buffer;
  }
}

/** A loop with nothing in it, for ids that do not exist. */
const SILENT_LOOP: LoopSpec = { bus: "sfx", voices: [], params: {}, mappings: [] };

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const clampHz = (hz: number): number => Math.min(20000, Math.max(20, hz));

function safeLocalStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Accessing localStorage itself throws when site data is blocked.
    return null;
  }
}

function defaultGestureTarget(): GestureTarget | null {
  const target = (globalThis as { window?: GestureTarget }).window;
  return target && typeof target.addEventListener === "function" ? target : null;
}

/**
 * `navigator.userActivation.hasBeenActive` where the browser has it. Where it
 * does not (Safari before 16.4, Node), assume yes: that keeps the behaviour of
 * scheduling every sound, which is what the engine did before this check.
 */
function browserUserActivation(): boolean {
  const nav = (globalThis as { navigator?: { userActivation?: { hasBeenActive?: boolean } } }).navigator;
  const activation = nav?.userActivation;
  return activation && typeof activation.hasBeenActive === "boolean" ? activation.hasBeenActive : true;
}
