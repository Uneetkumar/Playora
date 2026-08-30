/**
 * The mixer: which buses exist, how loud each one is, and how that combines.
 *
 * Pure data and pure functions, deliberately. Every decision about how loud a
 * sound should be is made here and is testable without an AudioContext; the
 * engine only turns the number into gain.
 */

export const AUDIO_BUSES = ["music", "sfx", "ui", "voice"] as const;
export type AudioBus = (typeof AUDIO_BUSES)[number];

export const BUS_LABELS: Record<AudioBus, string> = {
  music: "Music",
  sfx: "Game sounds",
  ui: "Interface",
  voice: "Voice chat",
};

export interface MixerState {
  /** 0..1, applied on top of every bus. */
  master: number;
  /** Silences everything without losing the volumes behind it. */
  muted: boolean;
  volumes: Record<AudioBus, number>;
  /** Buses silenced individually. */
  mutedBuses: AudioBus[];
}

/**
 * Sensible opening levels.
 *
 * Music sits well below effects because it plays continuously while effects are
 * momentary; matching their nominal volumes makes the music feel twice as loud
 * as it is.
 */
export const DEFAULT_MIXER: MixerState = {
  master: 0.7,
  muted: false,
  volumes: { music: 0.35, sfx: 0.8, ui: 0.6, voice: 1 },
  mutedBuses: [],
};

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** The gain a sound on `bus` should actually play at, 0 when silenced. */
export function effectiveVolume(state: MixerState, bus: AudioBus): number {
  if (state.muted) return 0;
  if (state.mutedBuses.includes(bus)) return 0;
  return clamp01(state.master) * clamp01(state.volumes[bus] ?? 0);
}

export function setMaster(state: MixerState, value: number): MixerState {
  return { ...state, master: clamp01(value) };
}

export function setBusVolume(state: MixerState, bus: AudioBus, value: number): MixerState {
  return { ...state, volumes: { ...state.volumes, [bus]: clamp01(value) } };
}

export function toggleMute(state: MixerState): MixerState {
  return { ...state, muted: !state.muted };
}

export function toggleBus(state: MixerState, bus: AudioBus): MixerState {
  const silenced = state.mutedBuses.includes(bus);
  return {
    ...state,
    mutedBuses: silenced
      ? state.mutedBuses.filter((b) => b !== bus)
      : [...state.mutedBuses, bus],
  };
}

/**
 * Rebuilds mixer state from whatever was stored, without trusting any of it.
 *
 * Stored settings are user-editable in practice (devtools, a synced profile, a
 * future import), so a malformed value has to degrade to the default rather
 * than reach the Web Audio API, where a NaN gain silences the page permanently.
 */
export function normalizeMixer(input: unknown): MixerState {
  if (!input || typeof input !== "object") return DEFAULT_MIXER;
  const raw = input as Partial<MixerState>;

  const volumes = { ...DEFAULT_MIXER.volumes };
  if (raw.volumes && typeof raw.volumes === "object") {
    for (const bus of AUDIO_BUSES) {
      const value = (raw.volumes as Record<string, unknown>)[bus];
      if (typeof value === "number") volumes[bus] = clamp01(value);
    }
  }

  return {
    master: typeof raw.master === "number" ? clamp01(raw.master) : DEFAULT_MIXER.master,
    muted: raw.muted === true,
    volumes,
    mutedBuses: Array.isArray(raw.mutedBuses)
      ? raw.mutedBuses.filter((b): b is AudioBus => AUDIO_BUSES.includes(b as AudioBus))
      : [],
  };
}
