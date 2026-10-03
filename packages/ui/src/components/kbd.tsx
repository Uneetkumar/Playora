import type * as React from "react";
import { cn } from "../lib/utils.js";

/**
 * A key or shortcut, e.g. <Kbd>Esc</Kbd> or <Kbd>⌘K</Kbd>. The darker bottom
 * edge makes it read as a keycap without a picture of one.
 */
export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "pointer-events-none inline-flex h-5 min-w-5 select-none items-center justify-center gap-0.5 rounded border border-border bg-raised px-1.5",
        "font-mono text-[11px] font-medium leading-none text-muted-foreground shadow-[inset_0_-1px_0_hsl(var(--border))]",
        className,
      )}
      {...props}
    />
  );
}
