"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";
import {
  runCinematic,
  CINEMATIC_ROOT_ATTR,
  type CinematicBuilder,
} from "@playora/animation";

/**
 * Attaches a GSAP timeline to a subtree.
 *
 * Returns the props for the root element, which start it in the "pending" state
 * that hides participating children for the frame before the timeline can set
 * their opening position. Everything about clearing that state again lives in
 * `runCinematic`, which guarantees it happens on every path including failure.
 *
 * `build` is intentionally not in the dependency list. An inline arrow is a new
 * function on every render, so depending on it would replay the cinematic
 * whenever the parent re-rendered — a result screen that restarts its own
 * animation every time a number ticks. The timeline is keyed to `deps` instead.
 */
export function useCinematic(build: CinematicBuilder, deps: React.DependencyList = []) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion() ?? false;
  const buildRef = React.useRef(build);
  buildRef.current = build;

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    return runCinematic({
      root,
      build: (context) => buildRef.current(context),
      reduced,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, ...deps]);

  return {
    ref: rootRef,
    [CINEMATIC_ROOT_ATTR]: "pending",
  } as const;
}
