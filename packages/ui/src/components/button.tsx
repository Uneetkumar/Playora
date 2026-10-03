import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils.js";

/**
 * Buttons.
 *
 * `play` is the green launch colour and is reserved for the one primary Play
 * action on a screen; everything else that is primary uses `default`. Primary
 * has hover and pressed tokens of its own. Play and destructive have none, so
 * hover applies the `--hover-brightness` filter (brighter in dark theme,
 * darker in light, set by the theme rather than a `dark:` class) and press
 * darkens. `active:` is emitted after `hover:` at the same specificity, so
 * the press wins while the pointer is down over the button.
 *
 * Hover eases over 200ms; the press tightens to 80ms so the scale reads as a
 * response to the finger, then releases on the slower curve. Under reduced
 * motion — the OS setting or the in-app `.reduce-motion` class — the press
 * scale is dropped entirely rather than merely made instant.
 *
 * `asChild` renders the styles onto the child instead of a <button>, which is
 * how a link that looks like a button is written: `<Button asChild><Link/>`.
 * Wrapping a <button> in an <a> nests two interactive elements and gives
 * keyboard users two tab stops for one action.
 */
export const buttonVariants = cva(
  [
    "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold",
    "transition-[color,background-color,border-color,box-shadow,transform,filter] duration-hover ease-out-expo",
    "active:scale-[0.97] active:duration-press motion-reduce:active:scale-100 [.reduce-motion_&]:active:scale-100",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-card hover:bg-primary-hover active:bg-primary-pressed",
        play: "bg-play font-bold text-play-foreground shadow-card hover:brightness-hover active:brightness-90",
        secondary:
          "border border-border bg-raised text-foreground shadow-card hover:bg-border",
        outline:
          "border border-border bg-transparent text-foreground hover:border-foreground/20 hover:bg-foreground/[0.06]",
        ghost: "text-foreground hover:bg-foreground/[0.08]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-card hover:brightness-hover active:brightness-90",
        link: "text-primary-accent underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 px-6 text-base",
        xl: "h-14 rounded-xl px-8 text-lg font-bold",
        icon: "h-10 w-10 p-0",
        "icon-sm": "h-8 w-8 rounded-md p-0",
        "icon-lg": "h-12 w-12 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render onto the single child element (e.g. a Link) instead of a <button>. */
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = "Button";
