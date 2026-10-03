/**
 * Animation tokens (spec v2 section 6).
 *
 * One place that decides how long things take. Durations were previously
 * invented per component — 0.18 here, 240ms there, 0.35 somewhere else — which
 * is how an interface ends up feeling subtly inconsistent without any single
 * screen looking wrong.
 *
 * Durations are exported in both units because the two consumers disagree:
 * Motion takes seconds, CSS takes milliseconds.
 */

export const DURATION_MS = {
  /** A state flip the eye should barely register: hover, focus, checkbox. */
  micro: 120,
  /** A small element arriving or leaving: tooltip, badge, inline expand. */
  fast: 180,
  /** The default. Cards, tabs, drawers, list items. */
  normal: 240,
  /** Something asking to be noticed: a modal, a result, a rank change. */
  emphasis: 360,
  /** A sequence that tells a story. Match found, victory, promotion. */
  cinematic: 600,
} as const;

export type DurationToken = keyof typeof DURATION_MS;

/** The same values in seconds, which is what Motion expects. */
export const DURATION_S = {
  micro: DURATION_MS.micro / 1000,
  fast: DURATION_MS.fast / 1000,
  normal: DURATION_MS.normal / 1000,
  emphasis: DURATION_MS.emphasis / 1000,
  cinematic: DURATION_MS.cinematic / 1000,
} as const;

/**
 * Spring presets.
 *
 * Named for how they feel rather than for their numbers, because `stiffness:
 * 210, damping: 26` tells a reader nothing about whether it is the right one.
 */
export const SPRING = {
  /** Barely overshoots. Layout shifts, things that should not draw the eye. */
  soft: { type: "spring", stiffness: 170, damping: 26, mass: 1 },
  /** The default. A little life without bouncing. */
  medium: { type: "spring", stiffness: 220, damping: 22, mass: 1 },
  /** Overshoots visibly. Rewards, unlocks, a card being played. */
  bouncy: { type: "spring", stiffness: 320, damping: 14, mass: 0.9 },
  /** Slow and weighted. Large surfaces: sheets, full-screen panels. */
  heavy: { type: "spring", stiffness: 120, damping: 30, mass: 1.4 },

  // The design system's three (docs/DESIGN_SYSTEM.md, "Motion"). New code
  // reaches for these first; the four above stay for what already uses them.

  /**
   * Press, toggle, hover lift. Quick, and the slight overshoot it has
   * (damping ratio ~0.67) is too small on a 3% scale change to read as bounce.
   */
  micro: { type: "spring", stiffness: 500, damping: 30, mass: 1 },
  /** Sheets, drawers, popovers, a sliding tab indicator. Near-critical: no overshoot. */
  panel: { type: "spring", stiffness: 300, damping: 32, mass: 1 },
  /** Decorative drift: hero art, background glows. Soft and slow to settle. */
  ambient: { type: "spring", stiffness: 120, damping: 20, mass: 1 },
} as const;

export type SpringToken = keyof typeof SPRING;

/** Easing curves, for the cases where a spring is the wrong tool. */
export const EASE = {
  /** Arriving. */
  out: [0.16, 1, 0.3, 1],
  /** Leaving. */
  in: [0.7, 0, 0.84, 0],
  /** Moving between two on-screen positions. */
  inOut: [0.65, 0, 0.35, 1],
} as const;

export type EaseToken = keyof typeof EASE;

/**
 * The same curves as CSS `transition-timing-function` values, derived rather
 * than retyped so the two forms cannot disagree. `EASE_CSS.out` is the
 * Tailwind `ease-out-expo` class.
 */
export const EASE_CSS = {
  out: `cubic-bezier(${EASE.out.join(", ")})`,
  in: `cubic-bezier(${EASE.in.join(", ")})`,
  inOut: `cubic-bezier(${EASE.inOut.join(", ")})`,
} as const;

/**
 * Interaction timings, by what is being interacted with rather than by size.
 *
 * Separate from `DURATION_MS` because that is a ladder of emphasis (each step
 * longer than the last), and these are not: a press is faster than any of it.
 * The CSS side of the same numbers is `motion.duration` in @playora/ui's
 * tokens and the Tailwind `duration-press` / `duration-hover` /
 * `duration-sheet` / `duration-sheet-exit` classes; change them together.
 */
export const INTERACTION_MS = {
  /** Press feedback: the scale-down on tap. */
  press: 80,
  /** Hover and focus states. The spec allows 180–220ms. */
  hover: 200,
  /** Sheets, drawers, dialogs arriving. The spec allows 280–360ms. */
  sheet: 320,
  /** The same leaving: exits run a little faster than entrances. */
  sheetExit: 280,
} as const;

export const INTERACTION_S = {
  press: INTERACTION_MS.press / 1000,
  hover: INTERACTION_MS.hover / 1000,
  sheet: INTERACTION_MS.sheet / 1000,
  sheetExit: INTERACTION_MS.sheetExit / 1000,
} as const;

export type InteractionToken = keyof typeof INTERACTION_MS;

/**
 * Whether this device has asked for less motion.
 *
 * Safe on the server, where there is no `matchMedia` — it returns false rather
 * than throwing, and the client corrects on hydration.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface TransitionOptions {
  duration?: DurationToken;
  spring?: SpringToken;
  ease?: EaseToken;
  delay?: number;
  /** Set from the component's own reduced-motion hook. */
  reduced?: boolean;
}

/**
 * Builds a Motion transition from tokens.
 *
 * Honouring reduced motion is not optional (spec v2 section 6), so it is
 * handled here rather than left to each caller to remember: a reduced
 * transition is instant, and instant means `duration: 0`, never a spring —
 * a zero-duration spring still oscillates.
 */
export function transition(options: TransitionOptions = {}): Record<string, unknown> {
  const { duration = "normal", spring, ease, delay = 0, reduced = false } = options;

  if (reduced) return { duration: 0 };

  if (spring) {
    return delay > 0 ? { ...SPRING[spring], delay } : { ...SPRING[spring] };
  }

  return {
    duration: DURATION_S[duration],
    ease: EASE[ease ?? "out"],
    ...(delay > 0 ? { delay } : {}),
  };
}

/**
 * A stagger delay for the nth item in a list.
 *
 * Capped, because a long list otherwise takes seconds to finish arriving and
 * the last row appears after the player has already moved on.
 */
export function stagger(index: number, step = 0.045, max = 0.35): number {
  return Math.min(index * step, max);
}
