"use client";

import * as React from "react";
import { motion } from "../tokens.js";

/**
 * Whether motion should be reduced, from either source the app honours.
 *
 * Settings stores its own toggle as a `reduce-motion` class on <html>, in
 * addition to the OS preference. CSS already respects both (globals.css), but
 * motion driven from JavaScript — a carousel's scroll animation, say — never
 * sees a stylesheet, so it has to ask here. Reading through
 * useSyncExternalStore means a change to either source re-renders the
 * consumer, and the server snapshot is "full motion" so markup matches the
 * first client render before the stores are read.
 *
 * This is @playora/animation's `readReducedMotionPref` again, because this
 * package cannot depend on that one. The query and class name come from
 * tokens.ts, and an apps/web test holds them equal to animation's, so a
 * rename there cannot silently switch carousel autoplay back on.
 */
const QUERY = motion.reducedMotionQuery;
const CLASS = motion.reduceMotionClass;

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => {
    mql.removeEventListener("change", onChange);
    observer.disconnect();
  };
}

function snapshot(): boolean {
  return (
    window.matchMedia(QUERY).matches || document.documentElement.classList.contains(CLASS)
  );
}

export function usePrefersReducedMotion(): boolean {
  return React.useSyncExternalStore(subscribe, snapshot, () => false);
}
