import type * as React from "react";
import { cn } from "../lib/utils.js";

/**
 * Skeleton block for content whose shape is known ahead of time.
 * Preferable to a spinner where it avoids the layout jumping on arrival.
 *
 * Tinted from the foreground rather than a fixed grey so it shows on the page,
 * a card or a popover alike, in either theme.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded-lg bg-foreground/[0.07]",
        className,
      )}
      {...props}
    />
  );
}
