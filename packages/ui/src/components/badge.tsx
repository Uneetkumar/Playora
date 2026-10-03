import type * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils.js";

/**
 * Badges come in two families.
 *
 * Status badges (default, secondary, outline, success, warning, destructive)
 * are tinted: a 15% wash of the colour, so they sit quietly in a row of
 * content. The text is the colour's `-ink` token rather than the colour
 * itself, because the wash takes contrast away from it: light-theme success
 * on its own tint is 3.8:1, its ink 5.5:1.
 *
 * Catalogue badges (live, new, hot, updated, top, soon) are what a game card
 * wears over its cover art, where a tint would vanish into the picture. They
 * are solid fills of the signal colour, the same in both themes because the
 * art is, with the badge ink tokens for text and the uppercase `text-tag`
 * style (`font-extrabold` restated, since the base `font-semibold` is emitted
 * after the font-size utility and would otherwise win). Only one should
 * appear on a card at a time. LIVE carries a pulsing
 * dot, which the global reduced-motion rules hold still.
 */
export const badgeVariants = cva(
  [
    "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-4 transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "[&_svg]:h-3 [&_svg]:w-3 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        default: "border-primary/30 bg-primary/15 text-primary-accent",
        secondary: "border-border bg-raised text-foreground",
        outline: "border-border bg-transparent text-foreground",
        success: "border-success/30 bg-success/15 text-success-ink",
        warning: "border-warning/30 bg-warning/15 text-warning-ink",
        destructive: "border-destructive/30 bg-destructive/15 text-destructive-ink",
        live: "border-transparent bg-badge-live px-2 text-tag font-extrabold uppercase text-badge-foreground",
        new: "border-transparent bg-badge-new px-2 text-tag font-extrabold uppercase text-badge-foreground",
        hot: "border-transparent bg-badge-hot px-2 text-tag font-extrabold uppercase text-badge-foreground",
        updated:
          "border-transparent bg-badge-updated px-2 text-tag font-extrabold uppercase text-badge-foreground",
        top: "border-transparent bg-badge-top px-2 text-tag font-extrabold uppercase text-badge-foreground",
        soon: "border-transparent bg-badge-soon px-2 text-tag font-extrabold uppercase text-badge-soon-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {variant === "live" && <LiveDot />}
      {children}
    </span>
  );
}

function LiveDot() {
  return (
    <span className="inline-flex h-1.5 w-1.5 animate-pulse-dot rounded-full bg-current" aria-hidden />
  );
}
