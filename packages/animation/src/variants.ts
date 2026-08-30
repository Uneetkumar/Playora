import { SPRING, DURATION_S, EASE, stagger } from "./tokens.js";

/**
 * The handful of motions this platform actually uses.
 *
 * Spec v2 section 6 warns against inventing durations throughout the app. The
 * same applies to the motions themselves: a codebase with thirty bespoke
 * entrance animations does not feel richer than one with five, it feels
 * unplanned. Each of these is a Motion variant object, used with
 * `initial="hidden" animate="visible"`.
 *
 * Every one takes `reduced`, because a variant that ignores the preference is
 * worse than no variant — the user asked for less motion and got a different
 * animation instead.
 */

type Variants = Record<string, Record<string, unknown>>;

/** Fades and lifts. The default for a card, a panel, a row. */
export function riseIn(reduced = false, delay = 0): Variants {
  return {
    hidden: reduced ? { opacity: 1 } : { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: reduced ? { duration: 0 } : { ...SPRING.medium, delay },
    },
    exit: reduced
      ? { opacity: 1 }
      : { opacity: 0, y: -8, transition: { duration: DURATION_S.fast, ease: EASE.in } },
  };
}

/** Scales up from slightly small. Modals, results, anything that interrupts. */
export function popIn(reduced = false, delay = 0): Variants {
  return {
    hidden: reduced ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.96 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: reduced ? { duration: 0 } : { ...SPRING.medium, delay },
    },
    exit: reduced
      ? { opacity: 1 }
      : { opacity: 0, scale: 0.97, transition: { duration: DURATION_S.fast, ease: EASE.in } },
  };
}

/** Overshoots. Rewards, unlocks, a card landing on the pile. */
export function celebrate(reduced = false, delay = 0): Variants {
  return {
    hidden: reduced ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5, rotate: -8 },
    visible: {
      opacity: 1,
      scale: 1,
      rotate: 0,
      transition: reduced ? { duration: 0 } : { ...SPRING.bouncy, delay },
    },
  };
}

/** Slides from an edge. Drawers and bottom sheets. */
export function slideIn(from: "left" | "right" | "bottom", reduced = false): Variants {
  const offset =
    from === "bottom" ? { y: "100%" } : from === "left" ? { x: "-100%" } : { x: "100%" };

  return {
    hidden: reduced ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, ...offset },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: reduced ? { duration: 0 } : { ...SPRING.heavy },
    },
    exit: reduced
      ? { opacity: 1 }
      : { opacity: 0, ...offset, transition: { duration: DURATION_S.normal, ease: EASE.in } },
  };
}

/**
 * A parent that staggers its children.
 *
 * Applied to the container; each child uses one of the variants above with the
 * same names, and Motion propagates the state.
 */
export function staggerChildren(reduced = false, step = 0.045): Variants {
  return {
    hidden: {},
    visible: {
      transition: reduced ? { duration: 0 } : { staggerChildren: step, delayChildren: 0.02 },
    },
  };
}

/** The delay a list item at `index` should use when staggering by hand. */
export const staggerDelay = stagger;
