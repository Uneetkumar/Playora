"use client";

import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import type { VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils.js";
import { toggleVariants } from "./toggle.js";

/**
 * A row of toggles where `type="single"` makes a segmented control (pick one
 * mode, one time control) and `type="multiple"` a set of filters. Roving
 * focus: the group is one tab stop and arrow keys move within it.
 *
 * The default `segmented` look sits the items in a recessed track, matching
 * TabsList; `outline` gives each item its own border for looser layouts.
 *
 * Radix lets a single-select group be emptied by pressing the chosen item
 * again. For a setting that must always have a value, ignore the empty string
 * in onValueChange: `onValueChange={(v) => v && setMode(v)}`.
 */
interface GroupStyle {
  variant: "segmented" | "outline";
  size: VariantProps<typeof toggleVariants>["size"];
}

const GroupContext = React.createContext<GroupStyle>({ variant: "segmented", size: "default" });

export const ToggleGroup = React.forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> & {
    variant?: "segmented" | "outline";
    size?: VariantProps<typeof toggleVariants>["size"];
  }
>(({ className, variant = "segmented", size = "default", children, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn(
      "inline-flex items-center gap-1",
      variant === "segmented" && "rounded-lg border border-border bg-surface p-1",
      className,
    )}
    {...props}
  >
    <GroupContext.Provider value={{ variant, size }}>{children}</GroupContext.Provider>
  </ToggleGroupPrimitive.Root>
));
ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName;

export const ToggleGroupItem = React.forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> & {
    size?: VariantProps<typeof toggleVariants>["size"];
  }
>(({ className, children, size, ...props }, ref) => {
  const group = React.useContext(GroupContext);
  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        toggleVariants({
          variant: group.variant === "outline" ? "outline" : "default",
          size: size ?? group.size,
        }),
        // Inside the track the items flex to share it evenly when the group is stretched.
        group.variant === "segmented" && "flex-1",
        className,
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  );
});
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;
