import * as React from "react";
import { cn } from "@playora/ui";

/**
 * The frame every platform page sits in: the 1200px content column with the
 * standard gutters (16 / 24 / 32) and vertical rhythm.
 *
 * Leaderboard, profile, settings and the rest each picked their own width,
 * from `max-w-2xl` to 1400px, and their own heading size, so moving between
 * them felt like moving between sites. They all start from here now; a page
 * that needs a narrower reading measure (a form) narrows its own content,
 * not the column, so headers still line up across pages.
 */
export function PageContainer({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1200px] px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title: React.ReactNode;
  /** One sentence under the title. */
  description?: React.ReactNode;
  /** A lucide icon, drawn in the brand tile beside the title. */
  icon?: React.ReactNode;
  /**
   * The page's primary action, right of the title from `sm` up and under it
   * below. One action, two at most: a header is not a toolbar.
   */
  action?: React.ReactNode;
}

/**
 * Title in the display face, a short description, and the primary action on
 * the right. The icon tile is the same violet tile the 404 and error pages
 * use, so every page in the platform opens the same way.
 */
export function PageHeader({
  title,
  description,
  icon,
  action,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header
      className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}
      {...props}
    >
      <div className="flex min-w-0 items-start gap-4">
        {icon && (
          <span
            className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary-accent ring-1 ring-inset ring-primary/30 sm:flex [&_svg]:h-6 [&_svg]:w-6"
            aria-hidden
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-balance font-display text-h1 text-foreground">{title}</h1>
          {description && (
            <p className="mt-1.5 max-w-2xl text-pretty text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </header>
  );
}
