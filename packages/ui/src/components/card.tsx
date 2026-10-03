import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils.js";

/**
 * Cards.
 *
 * Padding stays on the Card itself (CardHeader/CardContent only space their
 * children apart), unlike upstream shadcn: every existing card in the app was
 * written against that contract, and moving it would collapse them all.
 *
 * `interactive` is for a card that is itself the target of a click. It lifts
 * and gains the deep hover shadow plus a 1px ring in the card's accent: the
 * `--game-accent` custom property when a game sets one on the card or an
 * ancestor, and the primary colour otherwise. The lift is dropped under
 * reduced motion; the shadow and ring still say "this responds".
 */
export const cardVariants = cva(
  [
    "rounded-xl border p-6 text-card-foreground shadow-card",
    "transition-[border-color,background-color,box-shadow,transform] duration-hover ease-out-expo",
  ],
  {
    variants: {
      variant: {
        default: "border-border bg-card",
        raised: "border-border bg-raised",
        ghost: "border-transparent bg-transparent shadow-none",
      },
      interactive: {
        true: [
          "hover:-translate-y-0.5 hover:shadow-card-hover focus-within:shadow-card-hover",
          "motion-reduce:hover:translate-y-0 [.reduce-motion_&]:hover:translate-y-0",
        ],
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      interactive: false,
    },
  },
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, interactive, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ variant, interactive }), className)} {...props} />
  ),
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1.5 pb-4", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "font-display text-lg font-bold leading-tight tracking-tight text-card-foreground",
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("pt-0", className)} {...props} />,
);
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center gap-2 pt-4", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";
