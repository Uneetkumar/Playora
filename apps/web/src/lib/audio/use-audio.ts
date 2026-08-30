"use client";

import type { SoundId } from "@playora/audio";
import { useAudioStore } from "../store/audio-store";

/**
 * Play a sound from anywhere.
 *
 * The returned function is stable across renders, so it can sit in an effect's
 * dependency list without re-running it — which matters, because the effects
 * that play sounds are the ones watching game state, and an unstable callback
 * in exactly that position has caused three separate bugs in this codebase.
 */
export function useAudio(): (id: SoundId) => void {
  return useAudioStore((s) => s.play);
}
