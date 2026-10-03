"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "../lib/utils.js";

/**
 * Tooltips.
 *
 * Radix throws if a Tooltip renders outside a provider. Mount one
 * TooltipProvider near the root so tooltips share a delay group — once one
 * has opened, moving to the next opens it immediately — but a Tooltip that
 * finds no provider of ours above it supplies its own rather than crashing
 * the page. That fallback opens on its own delay, without the grouping.
 *
 * A tooltip labels or explains; it is never the only place something is said.
 * It does not appear on touch, and disabled buttons do not fire the pointer
 * events it listens for (wrap those in a span to explain why they are off).
 */
const ProviderMounted = React.createContext(false);

export function TooltipProvider({
  delayDuration = 300,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <ProviderMounted.Provider value={true}>
      <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />
    </ProviderMounted.Provider>
  );
}

export function Tooltip(props: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  const hasProvider = React.useContext(ProviderMounted);
  const root = <TooltipPrimitive.Root {...props} />;
  return hasProvider ? root : <TooltipProvider>{root}</TooltipProvider>;
}

export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
  React.ComponentRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, collisionPadding = 8, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      className={cn(
        "z-tooltip max-w-xs origin-[var(--radix-tooltip-content-transform-origin)] rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-raised",
        "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        "data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;
