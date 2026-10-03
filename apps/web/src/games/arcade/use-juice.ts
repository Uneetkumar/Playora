"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { SHAKE, hitStopMs, shakeOffset, type ShakeStrength } from "./juice";

export interface Juice {
  /** Props to spread on the element that should shake. */
  shakeProps: { style: React.CSSProperties };
  /** Fires impact feedback. Returns the freeze duration so callers can pause. */
  impact: (strength: ShakeStrength) => number;
  /** True while a hit-stop freeze is in effect. */
  frozen: boolean;
}

/**
 * Screen shake and hit-stop, wired to a container.
 *
 * Reduced motion disables the shake outright and keeps the freeze: hit-stop is
 * a pause, not movement, so it still communicates the impact to someone who
 * has asked not to be moved around.
 */
export function useJuice(): Juice {
  const reduced = useReducedMotion() ?? false;
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [frozen, setFrozen] = React.useState(false);

  const shakeRef = React.useRef<{ strength: number; start: number; seed: number } | null>(null);
  const freezeUntil = React.useRef(0);
  /*
   * Bumped by `impact` to re-arm the animation loop.
   *
   * An explicit counter rather than keying the effect off the offset itself:
   * that read as `[offset.x === 0 && offset.y === 0 ? 0 : 1]`, which is a
   * expression the hooks rule cannot check and a reader cannot follow.
   */
  const [armed, setArmed] = React.useState(0);

  React.useEffect(() => {
    if (!shakeRef.current) return;

    let raf = 0;
    const DURATION = 260;

    const step = () => {
      const active = shakeRef.current;
      if (!active) return;

      const elapsed = performance.now() - active.start;
      if (elapsed >= DURATION) {
        shakeRef.current = null;
        setOffset({ x: 0, y: 0 });
        return;
      }

      setOffset(shakeOffset(active.strength, elapsed, DURATION, active.seed));
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [armed]);

  const impact = React.useCallback(
    (strength: ShakeStrength) => {
      const freeze = hitStopMs(strength);

      if (!reduced && SHAKE[strength] > 0) {
        shakeRef.current = { strength: SHAKE[strength], start: performance.now(), seed: Math.random() * 1000 };
        setArmed((n) => n + 1);
      }

      if (freeze > 0) {
        freezeUntil.current = performance.now() + freeze;
        setFrozen(true);
        window.setTimeout(() => {
          if (performance.now() >= freezeUntil.current) setFrozen(false);
        }, freeze);
      }

      return freeze;
    },
    [reduced],
  );

  return {
    shakeProps: {
      style: {
        transform: offset.x || offset.y ? `translate3d(${offset.x}px, ${offset.y}px, 0)` : undefined,
        // `will-change` only while it is actually moving: leaving it on
        // promotes a layer for the whole session for no reason.
        willChange: offset.x || offset.y ? "transform" : undefined,
      },
    },
    impact,
    frozen,
  };
}
