"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "../lib/utils.js";

/**
 * On/off setting (role="switch"). The thumb is white in both themes so it
 * stands out against the violet "on" track and the grey "off" one alike.
 *
 * The off track is `subtle-foreground`, not `input`: a control's shape must
 * reach 3:1 against what it sits on, and `input` on a card is about 1.3:1 in
 * dark, which leaves a white dot floating with no visible pill. Subtle is the
 * weakest ink that clears 3:1 on page, card and raised in both themes.
 *
 * The switch draws 44x24, and an invisible `before:` band stretches its hit
 * area to 40px tall without changing the layout.
 */
export const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-hover ease-out-expo",
      "before:absolute before:-inset-x-0.5 before:-inset-y-2.5 before:content-['']",
      "data-[state=checked]:bg-primary data-[state=unchecked]:bg-subtle-foreground",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-card ring-0",
        "transition-transform duration-hover ease-out-expo data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;
