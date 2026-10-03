"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "../lib/utils.js";
import { focusRing } from "../lib/styles.js";

/**
 * Range input on Radix: arrow keys, Page Up/Down and Home/End, with a thumb
 * per value. Radix puts role="slider" on each thumb, not the root, so the
 * root's `aria-label` / `aria-labelledby` are forwarded to the thumbs here —
 * left on the root they would name nothing, and a volume slider with no name
 * is announced as just "slider". Name thumbs individually with `thumbLabels`.
 *
 * The root is at least 40px across the track (`min-h-10`, or `min-w-10` when
 * vertical), with the 6px track centred in it. Radix starts a drag from a
 * pointerdown anywhere on the root, so that is the touch target, not the
 * 20px thumb.
 */
export interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  /** Accessible names for the thumbs, in order, when there is more than one. */
  thumbLabels?: string[];
}

export const Slider = React.forwardRef<React.ComponentRef<typeof SliderPrimitive.Root>, SliderProps>(
  (
    {
      className,
      thumbLabels,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
      ...props
    },
    ref,
  ) => {
    // One thumb per value, so a two-value range gets two handles.
    const count = (props.value ?? props.defaultValue ?? [props.min ?? 0]).length;
    return (
      <SliderPrimitive.Root
        ref={ref}
        className={cn(
          "relative flex w-full touch-none select-none items-center data-[disabled]:opacity-50",
          "data-[orientation=horizontal]:min-h-10",
          "data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-40 data-[orientation=vertical]:w-auto data-[orientation=vertical]:min-w-10 data-[orientation=vertical]:flex-col",
          className,
        )}
        {...props}
      >
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-foreground/10 data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5">
          <SliderPrimitive.Range className="absolute h-full bg-primary data-[orientation=vertical]:w-full" />
        </SliderPrimitive.Track>
        {Array.from({ length: count }, (_, i) => (
          <SliderPrimitive.Thumb
            key={i}
            aria-label={thumbLabels?.[i] ?? ariaLabel}
            aria-labelledby={thumbLabels?.[i] ? undefined : ariaLabelledBy}
            className={cn(
              "block h-5 w-5 rounded-full border-2 border-primary bg-white shadow-card transition-[box-shadow,transform] duration-hover ease-out-expo",
              "hover:scale-110 motion-reduce:hover:scale-100 [.reduce-motion_&]:hover:scale-100",
              focusRing,
            )}
          />
        ))}
      </SliderPrimitive.Root>
    );
  },
);
Slider.displayName = SliderPrimitive.Root.displayName;
