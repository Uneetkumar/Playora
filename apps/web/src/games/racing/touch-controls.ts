"use client";

import * as React from "react";

/**
 * Controls a player is physically holding down, whatever they are holding.
 *
 * Kept in a ref rather than React state on purpose: these change many times a
 * second while a finger is down, and re-rendering the whole race HUD on every
 * change would cost more than the race loop itself.
 */
export interface HeldControls {
  left: boolean;
  right: boolean;
  throttle: boolean;
  brake: boolean;
}

export const NO_CONTROLS: HeldControls = {
  left: false,
  right: false,
  throttle: false,
  brake: false,
};

/**
 * Whether this device is driven by a finger rather than a mouse.
 *
 * `pointer: coarse` and not a width breakpoint. A narrow desktop window still
 * has a mouse and a keyboard, and showing it a set of thumb pads would be
 * wrong; a large tablet has neither, and hiding them would leave it unable to
 * steer.
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

/**
 * A set of on-screen controls that can be held.
 *
 * Returns the live state as a ref plus a factory for each control's handlers.
 * Every control releases on `pointercancel` and `pointerleave` as well as
 * `pointerup`: a finger that slides off a button, or a touch the browser takes
 * over for a system gesture, never fires `pointerup` — and a throttle stuck on
 * because of that is a car that drives itself into a wall.
 */
export function useHeldControls() {
  const held = React.useRef<HeldControls>({ ...NO_CONTROLS });

  const release = React.useCallback(() => {
    held.current = { ...NO_CONTROLS };
  }, []);

  // Losing the window mid-corner would otherwise leave the throttle down.
  React.useEffect(() => {
    window.addEventListener("blur", release);
    return () => window.removeEventListener("blur", release);
  }, [release]);

  const bind = React.useCallback((key: keyof HeldControls) => {
    const set = (value: boolean) => () => {
      held.current = { ...held.current, [key]: value };
    };
    return {
      onPointerDown: (event: React.PointerEvent) => {
        // Capture so the control keeps receiving events if the finger drifts
        // slightly off it, which happens constantly while cornering.
        event.currentTarget.setPointerCapture?.(event.pointerId);
        set(true)();
      },
      onPointerUp: set(false),
      onPointerCancel: set(false),
      onLostPointerCapture: set(false),
      // Prevents the long-press context menu and text selection on iOS.
      onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
    };
  }, []);

  return { held, bind, release };
}
