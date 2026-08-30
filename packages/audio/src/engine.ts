import {
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
import { SOUNDS, type Layer, type SoundId } from "./sounds.js";

export interface AudioEngineOptions {
  /** Injected for tests; defaults to the browser's AudioContext. */
  contextFactory?: () => AudioContext;
  /** Where mixer settings are read from and written to. */
  storage?: Pick<Storage, "getItem" | "setItem">;
  storageKey?: string;
  now?: () => number;
}

const STORAGE_KEY = "playora.audio";

/**
 * Plays the platform's sounds.
 *
 * Two things drive the design:
 *
 * 1. **No AudioContext until a gesture.** Browsers refuse to start audio before
 *    the user has interacted with the page, and constructing one early leaves a
 *    permanently suspended context that never recovers. The context is created
 *    on the first `play()` and resumed on every one, which is cheap when it is
 *    already running.
 *
 * 2. **Never throw.** Audio is decoration. A browser without Web Audio, a
 *    context that will not resume, storage that is unavailable in private
 *    browsing — none of that is allowed to interrupt a game, so every entry
 *    point degrades to silence instead of raising.
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private mixer: MixerState;
  private lastPlayed = new Map<SoundId, number>();
  private readonly contextFactory: () => AudioContext;
  private readonly storage: Pick<Storage, "getItem" | "setItem"> | null;
  private readonly storageKey: string;
  private readonly now: () => number;
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
   * Plays a sound, or does nothing.
   *
   * Returns whether it actually made a noise, which is what tests assert on —
   * "did not throw" is not the same as "played".
   */
  play(id: SoundId): boolean {
    if (this.unavailable) return false;

    const spec = SOUNDS[id];
    if (!spec) return false;

    const volume = effectiveVolume(this.mixer, spec.bus);
    if (volume <= 0) return false;

    const throttle = spec.throttleMs ?? 0;
    const at = this.now();
    if (throttle > 0) {
      const previous = this.lastPlayed.get(id);
      if (previous !== undefined && at - previous < throttle) return false;
    }

    const context = this.ensureContext();
    if (!context) return false;

    this.lastPlayed.set(id, at);
    const start = context.currentTime;
    for (const layer of spec.layers) {
      try {
        this.scheduleLayer(context, layer, start, volume);
      } catch {
        // One bad layer must not silence the rest of the sound.
      }
    }
    return true;
  }

  /** Releases the audio device. Safe to call when nothing was ever started. */
  async dispose(): Promise<void> {
    const context = this.context;
    this.context = null;
    this.masterGain = null;
    if (!context) return;
    try {
      await context.close();
    } catch {
      // Already closed, or never opened.
    }
  }

  private commit(next: MixerState): MixerState {
    this.mixer = next;
    if (this.masterGain && this.context) {
      // The node graph carries master only; per-bus level is applied per sound,
      // because a sound's bus is known at schedule time and never changes after.
      this.masterGain.gain.value = next.muted ? 0 : 1;
    }
    try {
      this.storage?.setItem(this.storageKey, JSON.stringify(next));
    } catch {
      // Private browsing, or storage disabled. Settings simply will not persist.
    }
    return next;
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
    if (this.context) {
      // Tabs suspend contexts on backgrounding; resuming is a no-op when running.
      if (this.context.state === "suspended") void this.context.resume().catch(() => {});
      return this.context;
    }
    try {
      const context = this.contextFactory();
      const gain = context.createGain();
      gain.gain.value = this.mixer.muted ? 0 : 1;
      gain.connect(context.destination);
      this.context = context;
      this.masterGain = gain;
      return context;
    } catch {
      // No Web Audio at all. Stop trying: retrying per sound costs a throw each.
      this.unavailable = true;
      return null;
    }
  }

  private scheduleLayer(
    context: AudioContext,
    layer: Layer,
    startTime: number,
    volume: number,
  ): void {
    const begin = startTime + layer.delay;
    const end = begin + layer.duration;
    const peak = Math.max(0.0001, layer.gain * volume);

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, begin);
    gain.gain.exponentialRampToValueAtTime(peak, begin + Math.max(0.001, layer.attack));
    // Exponential to near-zero rather than to zero: a ramp to exactly 0 is
    // undefined for exponential curves and clicks audibly.
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    let source: AudioNode;
    if (layer.kind === "noise") {
      const buffer = this.noiseBuffer(context, layer.duration);
      const node = context.createBufferSource();
      node.buffer = buffer;
      node.start(begin);
      node.stop(end);
      source = node;
    } else {
      const osc = context.createOscillator();
      osc.type = layer.waveform ?? "sine";
      osc.frequency.setValueAtTime(layer.frequency ?? 440, begin);
      if (layer.endFrequency !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, layer.endFrequency), end);
      }
      osc.start(begin);
      osc.stop(end);
      source = osc;
    }

    if (layer.filter !== undefined) {
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(layer.filter, begin);
      source.connect(filter);
      filter.connect(gain);
    } else {
      source.connect(gain);
    }

    gain.connect(this.masterGain ?? context.destination);
  }

  private noiseBuffer(context: AudioContext, duration: number): AudioBuffer {
    const frames = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
}

function safeLocalStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Accessing localStorage itself throws when site data is blocked.
    return null;
  }
}
