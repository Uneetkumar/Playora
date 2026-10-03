"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { readReducedMotionPref, subscribeReducedMotionPref } from "@playora/animation";

/**
 * Whether to reduce motion: true if the OS asks for it OR the player turned
 * on "Reduce motion" in Settings.
 *
 * Use this instead of framer-motion's `useReducedMotion`, which only sees the
 * OS setting and so ignores the in-app toggle. Pass the result to the
 * `@playora/animation` builders (`riseIn(reduced)`, `pressProps(reduced)`,
 * `transition({ reduced })`), and use it to skip hover video, carousel
 * auto-advance and anything else CSS cannot switch off on its own.
 *
 * It lives here rather than in @playora/animation because that package has
 * no React dependency; the logic it wraps does live there.
 *
 * The server snapshot is `false`, so the server render and hydration agree;
 * a player who prefers reduced motion gets the corrected value one commit
 * later, and the CSS rules in globals.css have already stopped the motion
 * in the meantime.
 */
export function useReducedMotionPref(): boolean {
  return useSyncExternalStore(subscribeReducedMotionPref, readReducedMotionPref, serverSnapshot);
}

function serverSnapshot(): boolean {
  return false;
}

/**
 * A number easing from `from` up to `to` (ease-out cubic), restarting when
 * either changes; instantly `to` under reduced motion. Unrounded, so the
 * caller formats it: a score rounds, a lap time might not.
 *
 * For result screens, where a number that simply appears reads as a label
 * rather than something the player earned.
 */
export function useCountUp(to: number, { from = 0, durationMs = 800 }: { from?: number; durationMs?: number } = {}): number {
  const reduced = useReducedMotionPref();
  const [value, setValue] = useState(reduced ? to : from);

  useEffect(() => {
    if (reduced) {
      setValue(to);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setValue(from + (to - from) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, from, durationMs, reduced]);

  return value;
}
