"use client";

import * as React from "react";
import { getAudioEngine } from "@playora/audio";
import { useAudioStore } from "../../../lib/store/audio-store";
import { createRaceAudio, type RaceAudio, type RaceAudioOptions } from "./race-audio";

const GESTURES = ["pointerdown", "keydown", "touchend"] as const;

function hasBeenActive(): boolean {
  const activation = (globalThis as { navigator?: { userActivation?: { hasBeenActive?: boolean } } }).navigator
    ?.userActivation;
  return activation?.hasBeenActive === true;
}

/**
 * Race audio for the life of a component.
 *
 * Returns a stable object with the `RaceAudio` methods, safe to call from a
 * render loop from the first frame. Behind it, the real instance is created on
 * mount and disposed on unmount — so StrictMode's mount, unmount, mount gets a
 * fresh one rather than a disposed one — and started on the first gesture
 * anywhere on the page, or at once if the player already clicked their way
 * here (which they did: a race is reached through a Start button).
 */
export function useRaceAudio(options?: Pick<RaceAudioOptions, "vehicle">): RaceAudio {
  const vehicle = options?.vehicle ?? null;
  const live = React.useRef<RaceAudio | null>(null);
  const wanted = React.useRef({ muted: false, vehicle });

  React.useEffect(() => {
    // The stored mixer, so a player who muted in Settings stays muted here.
    const store = useAudioStore.getState();
    if (!store.hydrated) store.hydrate();
    getAudioEngine().installGestureUnlock();

    const audio = createRaceAudio({ vehicle: wanted.current.vehicle });
    audio.setMuted(wanted.current.muted);
    live.current = audio;

    const target = typeof window !== "undefined" ? window : null;
    const onGesture = () => {
      audio.start();
      for (const type of GESTURES) target?.removeEventListener(type, onGesture, true);
    };
    if (hasBeenActive()) audio.start();
    else for (const type of GESTURES) target?.addEventListener(type, onGesture, { capture: true, passive: true });

    return () => {
      for (const type of GESTURES) target?.removeEventListener(type, onGesture, true);
      audio.dispose();
      if (live.current === audio) live.current = null;
    };
  }, []);

  React.useEffect(() => {
    wanted.current.vehicle = vehicle;
    live.current?.setVehicle(vehicle);
  }, [vehicle]);

  const [facade] = React.useState<RaceAudio>(() => ({
    start: () => live.current?.start(),
    frame: (f, dt) => live.current?.frame(f, dt),
    event: (e, strength) => live.current?.event(e, strength),
    setOpponents: (list, listener) => live.current?.setOpponents(list, listener),
    setMuted: (m) => {
      wanted.current.muted = m;
      live.current?.setMuted(m);
    },
    setVehicle: (modelId) => {
      wanted.current.vehicle = modelId;
      live.current?.setVehicle(modelId);
    },
    // The component's unmount disposes the real instance; a caller's dispose
    // only silences it early.
    dispose: () => {
      wanted.current.muted = true;
      live.current?.setMuted(true);
    },
  }));
  return facade;
}
