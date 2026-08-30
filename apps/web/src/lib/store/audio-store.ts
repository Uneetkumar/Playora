"use client";

import { create } from "zustand";
import {
  AudioEngine,
  DEFAULT_MIXER,
  type AudioBus,
  type MixerState,
  type SoundId,
} from "@playora/audio";

/**
 * One AudioEngine for the whole app.
 *
 * Created at module scope on purpose: the engine does not touch Web Audio until
 * something is played, and its storage read is guarded, so importing it on the
 * server is inert. What it must never be is per-component — several engines
 * would each hold their own AudioContext, and browsers cap how many a page gets.
 */
let engine: AudioEngine | null = null;

function getEngine(): AudioEngine {
  engine ??= new AudioEngine();
  return engine;
}

interface AudioStoreState {
  mixer: MixerState;
  /**
   * False until the stored mixer has been read on the client.
   *
   * The server has no localStorage, so it always renders the defaults; a
   * settings control that reflected the real values immediately would hydrate
   * with different markup than the server sent.
   */
  hydrated: boolean;
  hydrate: () => void;
  play: (id: SoundId) => void;
  setMaster: (value: number) => void;
  setVolume: (bus: AudioBus, value: number) => void;
  setMuted: (muted: boolean) => void;
  toggleBusMuted: (bus: AudioBus) => void;
}

export const useAudioStore = create<AudioStoreState>((set) => ({
  mixer: DEFAULT_MIXER,
  hydrated: false,

  hydrate: () => set({ mixer: getEngine().getMixer(), hydrated: true }),

  play: (id) => {
    getEngine().play(id);
  },

  setMaster: (value) => set({ mixer: getEngine().setMasterVolume(value) }),
  setVolume: (bus, value) => set({ mixer: getEngine().setVolume(bus, value) }),
  setMuted: (muted) => set({ mixer: getEngine().setMuted(muted) }),
  toggleBusMuted: (bus) => set({ mixer: getEngine().toggleBusMuted(bus) }),
}));
