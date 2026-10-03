import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { elevation, motion, typography, zIndex } from "../tokens.js";

/**
 * tailwind-merge, taught this project's theme keys.
 *
 * It resolves conflicts by recognising class *groups*, and out of the box it
 * knows only Tailwind's default scales. An unknown `text-*` is taken for a
 * colour, so `cn("text-tag text-badge-foreground")` silently dropped the font
 * size as a clashing colour, while `cn("text-xs", "text-tag")` kept both
 * sizes. The keys come from tokens.ts, which the Tailwind config also reads,
 * so the two cannot drift apart.
 */
const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: Object.keys(typography.scale),
      shadow: [...Object.keys(elevation.dark), "glow", "glow-primary"],
      ease: ["out-expo"],
      animate: ["shimmer", "pulse-dot", "float", "accordion-down", "accordion-up"],
    },
    classGroups: {
      z: [{ z: Object.keys(zIndex) }],
      duration: [{ duration: Object.keys(motion.duration).map(kebab) }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
