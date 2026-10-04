import * as React from "react";
import { cn } from "@playora/ui";

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** A lucide icon. Decorative: the title says what is (not) here. */
  icon: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  /**
   * The one thing to do about it: usually a `<Button asChild><Link/></Button>`.
   * One, because an empty state that offers three ways out offers none.
   */
  action?: React.ReactNode;
  /** `tone="success"` for an empty that is good news: "Nothing waiting". */
  tone?: "default" | "success";
  /** `compact` for a section inside a page, where the full height would dominate. */
  size?: "default" | "compact";
}

/**
 * What a list shows when there is nothing in it: an icon, a line saying so,
 * a line saying why or what next, and one action.
 *
 * Every page used to draw its own dashed box with its own icon size and
 * padding; this is that box, once.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
  tone = "default",
  size = "default",
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed border-border bg-card/50 px-6 text-center",
        size === "compact" ? "py-8" : "py-12 sm:py-16",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-2xl ring-1 ring-inset [&_svg]:h-7 [&_svg]:w-7",
          tone === "success"
            ? "bg-success/15 text-success-ink ring-success/30"
            : "bg-muted text-muted-foreground ring-border"
        )}
        aria-hidden
      >
        {icon}
      </span>
      <p className="mt-4 text-balance font-display text-lg font-bold text-foreground">{title}</p>
      {body && <p className="mt-1.5 max-w-md text-pretty text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
