"use client";

/**
 * Game audio through the one shared engine: one-shots, continuous loops, and
 * the global mute, in a single hook.
 *
 * MIGRATION — retiring a game's private AudioContext
 *
 * Sixteen views under games/board and games/arcade (and bridge-audio.ts) each
 * carry a copy of `getAudioContext()` plus a local `soundEnabled` toggle. Every
 * copy opens its own AudioContext and connects straight to `ctx.destination`,
 * so none of them hears the settings-page sliders or the global mute. To move
 * one over:
 *
 *   1. Delete `sharedAudioCtx`, `getAudioContext()` and the `soundEnabled`
 *      state. The view's sound button drives the global mute instead:
 *
 *        const { play, output, muted, setMuted } = useSfx();
 *        <button onClick={() => setMuted(!muted)}>…</button>
 *
 *   2a. Quickest: keep the hand-written oscillators and change the plumbing.
 *
 *        - if (!soundEnabled) return;
 *        - const ctx = getAudioContext();
 *        - if (!ctx) return;
 *        + const out = output();          // null while muted or without Web Audio
 *        + if (!out) return;
 *        + const ctx = out.context;
 *          …
 *        - gain.connect(ctx.destination);
 *        + gain.connect(out.destination); // the sfx bus
 *
 *   2b. Better: describe the sounds, or use a shared id, and delete the switch.
 *
 *        const PONG = {
 *          paddle: { bus: "sfx", layers: [tone(420, 0.06, 0.2, { endFrequency: 840 })] },
 *          wall: { bus: "sfx", layers: [tone(260, 0.05, 0.12, { waveform: "triangle" })] },
 *        } satisfies Record<string, SoundSpec>;
 *
 *        play(PONG.paddle);
 *        play("game.point");
 *        play("tile.merge", { pitch: semitones(Math.log2(value)) });
 *
 *      Keep specs at module scope: retrigger throttling is keyed by the spec
 *      object, so a spec rebuilt on every call is never throttled.
 *
 *   Continuous sounds use a loop handle, steered from the frame loop:
 *
 *        const engine = useLoop("engine");
 *        useEffect(() => {
 *          if (racing) engine.start();
 *          else engine.stop();
 *        }, [racing, engine]);
 *        engine.setParams({ rpm: car.rpm, throttle: input.throttle });  // every frame
 *
 *   Code outside React (bridge-audio.ts) reaches the same engine with
 *   `getAudioEngine()` from "@playora/audio": `.output()`, `.play()`, `.loop()`.
 */

import * as React from "react";
import {
  getAudioEngine,
  type AudioBus,
  type AudioOutput,
  type LoopHandle,
  type LoopId,
  type LoopParamName,
  type LoopParamValues,
  type LoopSpec,
  type PlayParams,
  type SoundId,
  type SoundSpec,
} from "@playora/audio";
import { useAudioStore } from "../store/audio-store";

export interface SfxLoop {
  <L extends LoopId>(id: L, params?: LoopParamValues<LoopParamName<L>>): LoopHandle<LoopParamName<L>>;
  (spec: LoopSpec, params?: LoopParamValues): LoopHandle;
}

export interface Sfx {
  /** Plays a catalogue id or an inline spec. False when nothing was heard (muted, throttled, no audio). */
  play: (sound: SoundId | SoundSpec, params?: PlayParams) => boolean;
  /**
   * A loop handle, stopped automatically when the component unmounts. Call it
   * from an effect or a handler, not during render; for one loop per mount,
   * `useLoop` is shorter.
   */
  loop: SfxLoop;
  /** The shared context and a bus, for hand-built nodes. See the migration note. */
  output: (bus?: AudioBus) => AudioOutput | null;
  muted: boolean;
  setMuted: (muted: boolean) => void;
}

/** Hydrates the stored mixer once and arms the first-gesture unlock. */
function useAudioReady(): void {
  React.useEffect(() => {
    const store = useAudioStore.getState();
    // The server rendered the default mixer; the stored one arrives after
    // mount, as on the settings page, so a mute button hydrates cleanly.
    if (!store.hydrated) store.hydrate();
    getAudioEngine().installGestureUnlock();
  }, []);
}

export function useSfx(): Sfx {
  const muted = useAudioStore((s) => s.mixer.muted);
  const setMuted = useAudioStore((s) => s.setMuted);
  const owned = React.useRef(new Set<LoopHandle>());

  useAudioReady();

  React.useEffect(() => {
    const handles = owned.current;
    // Stopped, not disposed: under StrictMode the component remounts with the
    // same handles, and a disposed handle could never start again.
    return () => {
      for (const handle of handles) handle.stop(0.1);
    };
  }, []);

  // Stable for the component's lifetime, so they can sit in effect deps
  // without re-running the effects that watch game state (see use-audio.ts).
  const play = React.useCallback(
    (sound: SoundId | SoundSpec, params?: PlayParams) => getAudioEngine().play(sound, params),
    [],
  );

  const loop = React.useCallback(
    ((source: LoopId | LoopSpec, params?: LoopParamValues) => {
      const engine = getAudioEngine();
      const handle = typeof source === "string" ? engine.loop(source, params) : engine.loop(source, params);
      owned.current.add(handle);
      return handle;
    }) as SfxLoop,
    [],
  );

  const output = React.useCallback((bus?: AudioBus) => getAudioEngine().output(bus), []);

  return React.useMemo(
    () => ({ play, loop, output, muted, setMuted }),
    [play, loop, output, muted, setMuted],
  );
}

/**
 * One loop for the life of the component: created on mount, stopped on
 * unmount, started and steered by the caller. `params` are the starting
 * values and are read once; change them afterwards with `setParam`. A custom
 * `LoopSpec` should live at module scope, or every render builds a new handle.
 */
export function useLoop<L extends LoopId>(
  id: L,
  params?: LoopParamValues<LoopParamName<L>>,
): LoopHandle<LoopParamName<L>>;
export function useLoop(spec: LoopSpec, params?: LoopParamValues): LoopHandle;
export function useLoop(source: LoopId | LoopSpec, params?: LoopParamValues): LoopHandle {
  const initial = React.useRef(params);
  const handle = React.useMemo(() => {
    const engine = getAudioEngine();
    return typeof source === "string" ? engine.loop(source, initial.current) : engine.loop(source, initial.current);
  }, [source]);

  useAudioReady();

  React.useEffect(() => () => handle.stop(0.1), [handle]);
  return handle;
}
