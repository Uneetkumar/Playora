"use client";

import * as React from "react";
import type { AnalogInput } from "./input/race-input";
import { approachSteer } from "./input/shaping";

/**
 * Whether this device is driven by a finger rather than a mouse.
 *
 * `pointer: coarse` and not a width breakpoint. A narrow desktop window still
 * has a mouse and a keyboard, and taking its drag-steering away would be wrong;
 * a large tablet has neither, and leaving drag-steering on would let a stray
 * thumb on the canvas override the on-screen controls.
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const query = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarse(query.matches);
    update();

    // A tablet with a keyboard case attached and removed changes this at
    // runtime, so it is watched rather than read once.
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return coarse;
}

/*
 * Touch capability, shared by every component that asks. A module-level store
 * rather than per-component state, because "the player just touched the
 * screen" is one fact about the page.
 */
let touchSeen = false;
const touchListeners = new Set<() => void>();
let stopWatching: (() => void) | null = null;

function coarseQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia("(pointer: coarse)");
}

function notifyTouch(): void {
  for (const listener of touchListeners) listener();
}

function watchTouch(): () => void {
  const query = coarseQuery();
  const onPointer = (e: PointerEvent) => {
    // The last kind of pointer used decides, on a laptop with a touchscreen:
    // touch the screen and the controls appear, go back to the trackpad and
    // they get out of the way. A pen says nothing either way.
    const next = e.pointerType === "touch" ? true : e.pointerType === "mouse" ? false : touchSeen;
    if (next === touchSeen) return;
    touchSeen = next;
    notifyTouch();
  };
  query?.addEventListener("change", notifyTouch);
  window.addEventListener("pointerdown", onPointer, { capture: true, passive: true });
  return () => {
    query?.removeEventListener("change", notifyTouch);
    window.removeEventListener("pointerdown", onPointer, true);
  };
}

function subscribeTouch(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  touchListeners.add(listener);
  stopWatching ??= watchTouch();
  return () => {
    touchListeners.delete(listener);
    if (touchListeners.size === 0 && stopWatching) {
      stopWatching();
      stopWatching = null;
    }
  };
}

/** True when on-screen driving controls should show. */
export function readTouchCapable(): boolean {
  if (typeof window === "undefined") return false;
  if (touchSeen) return true;
  const query = coarseQuery();
  if (query) return query.matches;
  // No media queries at all: an old WebView, which is a phone.
  return typeof navigator !== "undefined" && (navigator.maxTouchPoints ?? 0) > 0;
}

/**
 * Whether to show on-screen driving controls: decided by the input the device
 * has, never by the screen's width. A phone or tablet (primary pointer coarse)
 * always gets them; a touchscreen laptop gets them once it is touched. False
 * on the server, so the first render matches it; the real answer arrives one
 * commit later.
 */
export function useTouchCapable(): boolean {
  return React.useSyncExternalStore(subscribeTouch, readTouchCapable, () => false);
}

/** The on-screen controls a TouchDrive knows how to drive. */
export type TouchControl = "left" | "right" | "throttle" | "brake" | "handbrake" | "nitro" | "lookBack" | "camera";

export interface TouchButtonHandlers {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void;
  onLostPointerCapture: (e: React.PointerEvent<HTMLElement>) => void;
  onContextMenu: (e: React.MouseEvent<HTMLElement>) => void;
}

export interface TouchDrive {
  press(control: TouchControl, pointerId: number): void;
  release(pointerId: number): void;
  releaseAll(): void;
  /** Spread onto an on-screen button: `<button {...drive.bind("throttle")}>`. */
  bind(control: TouchControl): TouchButtonHandlers;
  dispose(): void;
}

export interface TouchDriveOptions {
  requestFrame?: (cb: (t: number) => void) => number;
  cancelFrame?: (id: number) => void;
}

/**
 * On-screen buttons wired to a RaceInput's touch channel.
 *
 * Every finger is tracked by its pointer id, which fixes the two ways touch
 * driving used to break: lifting one steering finger while the other is still
 * down no longer centres the wheel, and a touch the browser takes over (a
 * system gesture, a notification) releases its button through pointercancel
 * instead of leaving the throttle pinned. Steering buttons ramp the wheel the
 * same way held keys do; the ramp's animation frame runs only while the
 * wheel is moving.
 */
export function createTouchDrive(
  input: { setTouch: (partial: Partial<AnalogInput>) => void },
  options: TouchDriveOptions = {},
): TouchDrive {
  const requestFrame =
    options.requestFrame ?? ((cb: (t: number) => void) => (typeof requestAnimationFrame === "function" ? requestAnimationFrame(cb) : 0));
  const cancelFrame = options.cancelFrame ?? ((id: number) => typeof cancelAnimationFrame === "function" && cancelAnimationFrame(id));
  const fingers = new Map<number, TouchControl>();
  let lastSteer: "left" | "right" | null = null;
  let steer = 0;
  let frame = 0;
  let lastTime: number | null = null;

  const holding = (control: TouchControl) => {
    for (const held of fingers.values()) if (held === control) return true;
    return false;
  };

  const steerTarget = (): number => {
    const left = holding("left");
    const right = holding("right");
    if (left && right) return lastSteer === "left" ? -1 : 1;
    return left ? -1 : right ? 1 : 0;
  };

  const tick = (time: number) => {
    frame = 0;
    const dt = lastTime === null ? 1 / 60 : Math.min(0.1, Math.max(0, (time - lastTime) / 1000));
    lastTime = time;
    const target = steerTarget();
    steer = approachSteer(steer, target, dt);
    input.setTouch({ steer });
    if (steer !== target) frame = requestFrame(tick);
    else lastTime = null;
  };

  const sync = () => {
    input.setTouch({
      throttle: holding("throttle") ? 1 : 0,
      brake: holding("brake") ? 1 : 0,
      handbrake: holding("handbrake"),
      nitro: holding("nitro"),
      lookBack: holding("lookBack"),
    });
    if (!frame && steer !== steerTarget()) frame = requestFrame(tick);
  };

  const drive: TouchDrive = {
    press(control, pointerId) {
      fingers.set(pointerId, control);
      if (control === "left" || control === "right") lastSteer = control;
      if (control === "camera") input.setTouch({ cameraNext: true });
      sync();
    },
    release(pointerId) {
      if (!fingers.delete(pointerId)) return;
      sync();
    },
    releaseAll() {
      fingers.clear();
      lastSteer = null;
      if (frame) cancelFrame(frame);
      frame = 0;
      lastTime = null;
      steer = 0;
      input.setTouch({ steer: 0 });
      sync();
    },
    bind(control) {
      return {
        onPointerDown: (e) => {
          e.preventDefault();
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // Without capture, the release still arrives as pointerup or cancel.
          }
          drive.press(control, e.pointerId);
        },
        onPointerUp: (e) => drive.release(e.pointerId),
        onPointerCancel: (e) => drive.release(e.pointerId),
        onLostPointerCapture: (e) => drive.release(e.pointerId),
        // A long press would otherwise open the callout menu over the race.
        onContextMenu: (e) => e.preventDefault(),
      };
    },
    dispose() {
      drive.releaseAll();
    },
  };
  return drive;
}
