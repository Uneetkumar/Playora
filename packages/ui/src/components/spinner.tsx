import { cn } from "../lib/utils.js";

/**
 * The platform's loading mark.
 *
 * A ring rather than a generic spinner so a wait still looks like part of the
 * product. Sized in ems so it inherits from whatever it sits inside, and
 * labelled for screen readers — a silent spinner tells a non-sighted user
 * nothing at all.
 */
export function Spinner({
  size = "md",
  className,
  label = "Loading",
}: {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  label?: string;
}) {
  const dims = {
    xs: "h-4 w-4 border-2",
    sm: "h-6 w-6 border-2",
    md: "h-10 w-10 border-[3px]",
    lg: "h-16 w-16 border-4",
  }[size];

  return (
    <span role="status" aria-live="polite" className={cn("inline-flex", className)}>
      <span
        className={cn(
          "animate-spin rounded-full border-primary/25 border-t-primary",
          dims,
        )}
        aria-hidden
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * Full-panel loading state with a message.
 *
 * Every wait should say what it is waiting for — "Loading" alone leaves people
 * wondering whether anything is happening at all (spec section 51).
 */
export function LoadingState({
  title = "Loading",
  hint,
  className,
}: {
  title?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[240px] flex-col items-center justify-center gap-4 text-center",
        className,
      )}
    >
      <Spinner size="lg" label={title} />
      <div>
        <p className="font-display font-bold text-foreground">{title}</p>
        {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

/**
 * Skeleton block for content whose shape is known ahead of time.
 * Preferable to a spinner where it avoids the layout jumping on arrival.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-lg bg-muted/50", className)}
    />
  );
}
