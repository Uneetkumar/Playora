/**
 * Cinematics: one timeline for a moment made of many moving parts.
 *
 * Motion (framer-motion) stays the default for everything in the platform, and
 * nothing built with it was replaced. GSAP is here for the narrow case Motion
 * handles badly — a sequence of eight or ten elements whose timing is relative
 * to each other. Expressed in Motion that becomes a `delay` hand-tuned on every
 * element, spread across the component, and re-tuned by hand whenever a step is
 * inserted. A timeline puts the whole sequence in one readable block.
 *
 * GSAP is loaded on demand and never at module scope, so a player who does not
 * reach a cinematic never downloads it.
 */

import { DURATION_S, EASE, stagger } from "./tokens.js";

/** The slice of GSAP this module uses, so consumers need no gsap types. */
export interface CinematicTimeline {
  to(target: unknown, vars: Record<string, unknown>, position?: string | number): CinematicTimeline;
  from(target: unknown, vars: Record<string, unknown>, position?: string | number): CinematicTimeline;
  fromTo(
    target: unknown,
    from: Record<string, unknown>,
    to: Record<string, unknown>,
    position?: string | number,
  ): CinematicTimeline;
  set(target: unknown, vars: Record<string, unknown>, position?: string | number): CinematicTimeline;
  /** Jumps the whole timeline to a position, 0 to 1. */
  progress(value: number): CinematicTimeline;
  kill(): void;
}

export interface CinematicApi {
  timeline(vars?: Record<string, unknown>): CinematicTimeline;
  set(target: unknown, vars: Record<string, unknown>): void;
}

let pending: Promise<CinematicApi | null> | null = null;

/**
 * Loads GSAP once, and answers null if it cannot be loaded.
 *
 * Null rather than a throw: a cinematic is decoration, and a chunk that fails
 * to arrive over a bad connection must degrade to "no animation", never to a
 * screen that does not render.
 */
export function loadCinematics(): Promise<CinematicApi | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  pending ??= import("gsap")
    .then((mod) => (mod.gsap ?? mod.default) as unknown as CinematicApi)
    .catch(() => null);
  return pending;
}

/** Timing vocabulary shared with the token system, so both agree. */
export const CINEMATIC = {
  duration: DURATION_S,
  ease: EASE,
  stagger,
} as const;

/**
 * Attribute used to hide participating elements for the one frame before the
 * timeline can set their opening state.
 *
 * GSAP arrives asynchronously, so without this the elements paint at their
 * final position first and then jump back to the start of the animation. The
 * host stylesheet hides `[data-cinematic="pending"] [data-cine]`, and this
 * module's contract is that the attribute is *always* cleared — on success, on
 * reduced motion, on load failure, and on a timeout — because an element left
 * hidden by a decorative system is a broken screen.
 */
export const CINEMATIC_ROOT_ATTR = "data-cinematic";
export const CINEMATIC_ITEM_ATTR = "data-cine";

/** How long to wait for GSAP before giving up and just showing the content. */
export const CINEMATIC_LOAD_TIMEOUT_MS = 1500;

export interface CinematicBuildContext {
  gsap: CinematicApi;
  root: HTMLElement;
  /** Elements marked with `data-cine`, in document order. */
  items: HTMLElement[];
  /** Elements carrying a given `data-cine` value. */
  select: (name: string) => HTMLElement[];
}

export type CinematicBuilder = (context: CinematicBuildContext) => CinematicTimeline | void;

export interface RunCinematicOptions {
  root: HTMLElement;
  build: CinematicBuilder;
  reduced: boolean;
  /** Injectable for tests. */
  load?: () => Promise<CinematicApi | null>;
  timeoutMs?: number;
}

/**
 * Runs a cinematic against a root element and returns its teardown.
 *
 * Written as a plain function rather than a hook so it can be tested without a
 * renderer — the ordering guarantees here (reveal always happens; reveal
 * happens before the timeline is built) are the part worth testing, and they
 * are pure DOM behaviour.
 */
export function runCinematic(options: RunCinematicOptions): () => void {
  const { root, build, reduced, load = loadCinematics, timeoutMs = CINEMATIC_LOAD_TIMEOUT_MS } = options;

  let cancelled = false;
  let timeline: CinematicTimeline | null = null;

  const reveal = () => root.setAttribute(CINEMATIC_ROOT_ATTR, "done");

  // Reduced motion never loads the library at all. Honouring the preference
  // by playing the same sequence faster would still be motion.
  if (reduced) {
    reveal();
    return () => {};
  }

  // A safety net independent of the import: if the chunk is slow or the network
  // is gone, the content appears anyway.
  const timer = setTimeout(reveal, timeoutMs);

  /**
   * Ends the sequence at its final frame.
   *
   * `kill()` on its own stops the timeline wherever it happens to be and leaves
   * the inline styles it had written — which for a fade-in means the content
   * stays at whatever opacity it had reached, including zero. Jumping to the
   * end first is what makes an interrupted cinematic indistinguishable from a
   * finished one.
   */
  const finish = () => {
    if (!timeline) return;
    try {
      timeline.progress(1);
    } catch {
      /* a timeline already killed elsewhere */
    }
    timeline.kill();
    timeline = null;
  };

  /**
   * A backgrounded tab stops `requestAnimationFrame`, and GSAP's ticker stops
   * with it — so a cinematic that begins just as the player switches away
   * freezes part-way through, with elements stranded at the opacity the fade
   * had reached. Nobody is watching an animation in a hidden tab, so the right
   * response is to skip to the end rather than hold the content hostage to a
   * clock that is not running.
   */
  const onVisibility = () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") finish();
  };
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
  }

  void load().then((gsap) => {
    clearTimeout(timer);
    if (cancelled || !gsap) {
      reveal();
      return;
    }

    // Already backgrounded before the library even arrived: show the content
    // rather than start a sequence that cannot advance.
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      reveal();
      return;
    }

    const items = Array.from(
      root.querySelectorAll<HTMLElement>(`[${CINEMATIC_ITEM_ATTR}]`),
    );
    const select = (name: string) =>
      items.filter((el) => el.getAttribute(CINEMATIC_ITEM_ATTR) === name);

    try {
      // The opening state is set before the guard is lifted, so the elements
      // are never painted at their final position first.
      gsap.set(items, { opacity: 0 });
      reveal();
      const built = build({ gsap, root, items, select });
      timeline = built ?? null;
    } catch {
      // A malformed timeline must not leave the screen blank.
      gsap.set(items, { opacity: 1, clearProps: "transform" });
      reveal();
    }
  });

  return () => {
    cancelled = true;
    clearTimeout(timer);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibility);
    }
    finish();
    reveal();
  };
}
