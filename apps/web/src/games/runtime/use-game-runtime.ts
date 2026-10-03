"use client";

import * as React from "react";
import {
  GameLoop,
  InputManager,
  DEFAULT_BINDINGS,
  type Bindings,
  type LoopOptions,
} from "@playora/game-runtime";

/**
 * Binds the fixed-timestep runtime to a React component.
 *
 * The arcade games each owned a `setInterval` that wrote directly to
 * `useState`, which made every simulation step a render and tied the tick rate
 * to reconciliation. This inverts that:
 *
 *   - Simulation state lives in a ref and is mutated by `update`, at a fixed
 *     step, with no React involvement.
 *   - Once per animation frame a snapshot is published to React state. Render
 *     rate and simulation rate are now independent, which is what lets the
 *     simulation stay deterministic while the view stays smooth.
 *
 * The game writes plain functions over its own state object. It does not touch
 * the loop, the clock, or the input devices.
 */
export interface GameRuntimeConfig<TState, TSnapshot> {
  /** Fresh state for a new run. Called again on `restart`. */
  create: () => TState;
  /** One fixed step. Mutate `state`; return nothing. */
  update: (state: TState, ctx: StepContext) => void;
  /** Derive what the view needs. Keep it cheap — it runs once per frame. */
  snapshot: (state: TState) => TSnapshot;
  /** Called once when `update` sets `ctx.over`. */
  onGameOver?: (state: TState) => void;
  bindings?: Bindings;
  loop?: LoopOptions;
}

export interface StepContext {
  /** Seconds for this step. Always the same value. */
  dt: number;
  /** Steps completed since the run started. */
  tick: number;
  input: InputManager;
  /** Set to end the run. The loop stops and `onGameOver` fires once. */
  over: boolean;
}

export interface GameRuntime<TState, TSnapshot> {
  /** Latest published snapshot. Safe to render. */
  state: TSnapshot;
  running: boolean;
  over: boolean;
  /** Attach to the element that should receive pointer input. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  input: InputManager;
  /**
   * Change simulation state from an event handler.
   *
   * `state` above is the published snapshot, not the simulation — writing to
   * it changes what was rendered and leaves the simulation untouched, which is
   * a silent no-op and exactly the kind of bug this API exists to prevent. Use
   * this for a click, a key, anything outside the step function.
   */
  mutate: (fn: (state: TState) => void) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
}

export function useGameRuntime<TState, TSnapshot>(
  config: GameRuntimeConfig<TState, TSnapshot>,
): GameRuntime<TState, TSnapshot> {
  // Held in a ref so changing a callback identity never restarts the loop —
  // the bug pattern that made three separate arcade games reset themselves.
  const configRef = React.useRef(config);
  configRef.current = config;

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const stateRef = React.useRef<TState | null>(null);
  const inputRef = React.useRef<InputManager | null>(null);
  const loopRef = React.useRef<GameLoop | null>(null);
  const overRef = React.useRef(false);

  if (stateRef.current === null) stateRef.current = config.create();
  if (inputRef.current === null) {
    inputRef.current = new InputManager(config.bindings ?? DEFAULT_BINDINGS);
  }

  const [snapshot, setSnapshot] = React.useState<TSnapshot>(() =>
    config.snapshot(stateRef.current as TState),
  );
  const [running, setRunning] = React.useState(false);
  const [over, setOver] = React.useState(false);

  React.useEffect(() => {
    const input = inputRef.current!;
    const loop = new GameLoop(
      {
        update: (dt, tick) => {
          const ctx: StepContext = { dt, tick, input, over: false };
          configRef.current.update(stateRef.current as TState, ctx);
          input.endStep();
          if (ctx.over && !overRef.current) {
            overRef.current = true;
            loop.stop();
            setRunning(false);
            setOver(true);
            configRef.current.onGameOver?.(stateRef.current as TState);
          }
        },
        render: () => {
          // One publish per frame. The object identity changes so React
          // re-renders, but the simulation already ran at its own rate.
          setSnapshot(configRef.current.snapshot(stateRef.current as TState));
        },
      },
      configRef.current.loop,
    );
    loopRef.current = loop;
    input.attach(containerRef.current);

    return () => {
      loop.stop();
      input.detach();
      loopRef.current = null;
    };
  }, []);

  const start = React.useCallback(() => {
    if (overRef.current) return;
    loopRef.current?.start();
    setRunning(true);
  }, []);

  const pause = React.useCallback(() => {
    loopRef.current?.pause();
    setRunning(false);
  }, []);

  const resume = React.useCallback(() => {
    if (overRef.current) return;
    loopRef.current?.resume();
    setRunning(true);
  }, []);

  const mutate = React.useCallback((fn: (state: TState) => void) => {
    if (stateRef.current === null) return;
    fn(stateRef.current);
    // Publish immediately so the view reflects the change on this interaction
    // rather than waiting for the next frame, which reads as input lag.
    setSnapshot(configRef.current.snapshot(stateRef.current));
  }, []);

  const restart = React.useCallback(() => {
    stateRef.current = configRef.current.create();
    overRef.current = false;
    setOver(false);
    setSnapshot(configRef.current.snapshot(stateRef.current));
    loopRef.current?.stop();
    loopRef.current?.start();
    setRunning(true);
  }, []);

  return {
    state: snapshot,
    running,
    over,
    containerRef,
    input: inputRef.current,
    mutate,
    start,
    pause,
    resume,
    restart,
  };
}
