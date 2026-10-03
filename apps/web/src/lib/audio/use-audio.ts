"use client";

import * as React from "react";
import { getAudioEngine, type SoundId } from "@playora/audio";
import { useAudioStore } from "../store/audio-store";

/**
 * Play a sound from anywhere.
 *
 * The returned function is stable across renders, so it can sit in an effect's
 * dependency list without re-running it — which matters, because the effects
 * that play sounds are the ones watching game state, and an unstable callback
 * in exactly that position has caused three separate bugs in this codebase.
 *
 * It also arms the first-gesture unlock. Views using this hook play from
 * effects, never from a click, and iOS keeps a context silent unless it is
 * resumed inside a gesture; the unlock does that on the next tap anywhere.
 *
 * For inline specs, pitch and loops, see `useSfx` in ./use-sfx.ts.
 */
export function useAudio(): (id: SoundId) => void {
  React.useEffect(() => {
    getAudioEngine().installGestureUnlock();
  }, []);
  return useAudioStore((s) => s.play);
}
