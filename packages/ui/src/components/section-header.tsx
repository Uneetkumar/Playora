import type * as React from "react";
import { cn } from "../lib/utils.js";

export interface SectionHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned slot: a "See all" link, carousel arrows, a filter. */
  action?: React.ReactNode;
  /** Small leading icon (lucide), drawn in the primary-as-text colour. */
  icon?: React.ReactNode;
  /** Heading level; sections under a page's h1 are h2. */
  as?: "h1" | "h2" | "h3";
  /** id for the heading, so the section can be `aria-labelledby` it. */
  headingId?: string;
}

/**
 * The title row above a section or rail: title (`text-rail`, 20/700), an optional
 * line of description, and an action slot that stays on the title's line.
 * Knows nothing about what the section holds.
 */
export function SectionHeader({
  title,
  description,
  action,
  icon,
  as: Heading = "h2",
  headingId,
  className,
  ...props
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)} {...props}>
      <div className="min-w-0">
        <Heading
          id={headingId}
          className="flex items-center gap-2 font-display text-rail text-foreground"
        >
          {icon && (
            <span className="text-primary-accent [&_svg]:h-5 [&_svg]:w-5" aria-hidden>
              {icon}
            </span>
          )}
          <span className="truncate">{title}</span>
        </Heading>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
