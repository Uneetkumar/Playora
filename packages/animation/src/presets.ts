import { SPRING } from "./tokens.js";

/**
 * Interaction presets: the two motions nearly every interactive surface uses,
 * as ready-to-spread Motion props.
 *
 * Each returns an empty object under reduced motion rather than a zeroed
 * animation. A press that does not scale is the correct reduced behaviour —
 * the colour change on press still says "pressed" — and an empty object
 * leaves nothing behind for Motion to animate or for a reader to puzzle over.
 *
 * The transition sits inside the gesture target, not alongside it, so it
 * governs only that gesture and does not override the component's own
 * `transition` for its other animations.
 */

/** The scale a pressed control shrinks to. The CSS twin is `active:scale-[.97]`. */
export const PRESS_SCALE = 0.97;

/** How far a card rises on hover or keyboard focus. */
export const HOVER_LIFT = { y: -4, scale: 1.02 } as const;

/** `<motion.button {...pressProps(reduced)}>`: shrinks to 0.97 while held. */
export function pressProps(reduced = false): Record<string, unknown> {
  if (reduced) return {};
  return { whileTap: { scale: PRESS_SCALE, transition: SPRING.micro } };
}

/**
 * `<motion.div {...liftProps(reduced)}>`: rises on hover and on focus, so a
 * keyboard player sees the same affordance a mouse player does.
 */
export function liftProps(reduced = false): Record<string, unknown> {
  if (reduced) return {};
  const lifted = { ...HOVER_LIFT, transition: SPRING.micro };
  return { whileHover: lifted, whileFocus: lifted };
}
