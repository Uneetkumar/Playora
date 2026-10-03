import { REDUCE_MOTION_CLASS, REDUCE_MOTION_STORAGE_KEY } from "@playora/animation";

/**
 * Theme choice, in one place.
 *
 * The switcher used to live entirely inside the settings page: it wrote
 * `playora:theme` to localStorage and toggled the class on `<html>`, and
 * nothing else ever read it. `layout.tsx` hardcoded `class="dark"`, so
 * choosing Light worked until you reloaded any other page, at which point the
 * saved preference was silently ignored. The palette existed; almost nothing
 * applied it.
 *
 * `THEME_BOOTSTRAP` runs before first paint so the choice survives a reload
 * without a flash of the wrong theme, and `applyTheme` is what the settings
 * page calls. Both go through `resolveTheme`, so a change to how "system" is
 * interpreted cannot land in one and miss the other.
 *
 * The in-app "Reduce motion" setting had the same bug — saved, but only ever
 * re-applied by visiting Settings — so the bootstrap restores it too, and
 * `applyReduceMotion` / `readStoredReduceMotion` are its counterparts to the
 * theme functions. `useReducedMotionPref` (lib/motion.ts) is how components
 * read the result.
 */

export type ThemeChoice = "dark" | "light" | "system";

export const THEME_STORAGE_KEY = "playora:theme";

export { REDUCE_MOTION_CLASS, REDUCE_MOTION_STORAGE_KEY };

/** Whether a choice should render light, resolving `system` against the OS. */
export function resolveLight(choice: ThemeChoice): boolean {
  if (choice === "light") return true;
  if (choice === "dark") return false;
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: light)").matches
  );
}

export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  const light = resolveLight(choice);
  root.classList.toggle("light", light);
  root.classList.toggle("dark", !light);
  // Native controls — scrollbars, form widgets, the URL bar on mobile — read
  // this rather than our class, and look wrong without it.
  root.style.colorScheme = light ? "light" : "dark";
}

export function readStoredTheme(): ThemeChoice {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeChoice | null;
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "dark";
  } catch {
    // Private browsing or blocked storage: the default is fine.
    return "dark";
  }
}

/**
 * Turns the in-app reduced-motion setting on or off for this page and saves
 * it. The class is what CSS and `useReducedMotionPref` read; the stored value
 * is what the bootstrap restores on the next load.
 */
export function applyReduceMotion(on: boolean): void {
  document.documentElement.classList.toggle(REDUCE_MOTION_CLASS, on);
  try {
    localStorage.setItem(REDUCE_MOTION_STORAGE_KEY, on ? "1" : "0");
  } catch {
    /* storage unavailable: the setting lasts for this page only */
  }
}

export function readStoredReduceMotion(): boolean {
  try {
    return localStorage.getItem(REDUCE_MOTION_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Inlined into <head> and run before the first paint.
 *
 * Deliberately terse and dependency-free: it blocks rendering, and a theme
 * flash on every load is worse than the few bytes it saves. Kept in sync with
 * `applyTheme` and `applyReduceMotion` by hand because those functions cannot
 * be serialised here.
 */
export const THEME_BOOTSTRAP = `(function(){try{var s=localStorage,c=s.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var l=c==="light"||(c==="system"&&window.matchMedia("(prefers-color-scheme: light)").matches);var r=document.documentElement;r.classList.toggle("light",l);r.classList.toggle("dark",!l);r.style.colorScheme=l?"light":"dark";r.classList.toggle(${JSON.stringify(
  REDUCE_MOTION_CLASS,
)},s.getItem(${JSON.stringify(REDUCE_MOTION_STORAGE_KEY)})==="1");}catch(e){}})();`;
