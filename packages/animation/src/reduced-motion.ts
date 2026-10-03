import { prefersReducedMotion } from "./tokens.js";

/**
 * The player's reduced-motion preference: the OS setting OR the in-app toggle.
 *
 * Settings offers its own "Reduce motion" switch, because plenty of people
 * want calmer game UI without changing their whole device. That switch puts
 * `reduce-motion` on <html>, which the CSS in globals.css honours, and saves
 * the choice under `playora:reduce-motion` so the theme bootstrap can restore
 * the class before first paint. Framer's own `useReducedMotion` only sees the
 * OS setting, so a component that used it ignored the toggle entirely.
 *
 * The class on <html> is the runtime truth and the stored key is its
 * persisted form. Reading the class rather than storage means there is one
 * thing to observe, and it is already correct by the time any script runs.
 *
 * No React here — this package does not depend on it. The hook is
 * `useReducedMotionPref` in apps/web/src/lib/motion.ts, a one-line
 * `useSyncExternalStore` over the two functions below.
 */

export const REDUCE_MOTION_CLASS = "reduce-motion";
export const REDUCE_MOTION_STORAGE_KEY = "playora:reduce-motion";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * The in-app setting alone, for the control that edits it: a switch showing
 * the combined value would read "on" for an OS preference it cannot turn off.
 */
export function readInAppReducedMotion(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains(REDUCE_MOTION_CLASS);
}

/** True when either the OS or the in-app setting asks for less motion. False on the server. */
export function readReducedMotionPref(): boolean {
  return prefersReducedMotion() || readInAppReducedMotion();
}

/**
 * Calls `onChange` whenever either source might have changed. Returns the
 * unsubscribe function, in the shape `useSyncExternalStore` expects.
 *
 * The in-app toggle flips a class and fires no event, so the class attribute
 * is watched directly. The observer fires for theme changes too (same
 * attribute); the hook compares snapshots, so those cost a read, not a render.
 */
export function subscribeReducedMotionPref(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};

  const media = typeof window.matchMedia === "function" ? window.matchMedia(QUERY) : null;
  media?.addEventListener("change", onChange);

  const observer = typeof MutationObserver === "function" ? new MutationObserver(onChange) : null;
  observer?.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  return () => {
    media?.removeEventListener("change", onChange);
    observer?.disconnect();
  };
}
