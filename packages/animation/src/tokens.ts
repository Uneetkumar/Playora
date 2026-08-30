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
