import * as React from "react";
import { Card, cn } from "@playora/ui";

/**
 * A labelled number: games played, win rate, points. The number is in
 * tabular figures so a row of tiles keeps its columns as the values change.
 */
export function StatTile({
  icon,
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  /** `warning` when the number needs someone's attention (open reports). */
  tone?: "default" | "warning";
  className?: string;
}) {
  return (
    <Card className={cn("p-4 sm:p-5", className)}>
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon && (
          <span className="[&_svg]:h-4 [&_svg]:w-4" aria-hidden>
            {icon}
          </span>
        )}
        <span className="text-tag uppercase">{label}</span>
      </div>
      <div
        className={cn(
          "numeric mt-2 font-display text-3xl font-bold leading-none",
          tone === "warning" ? "text-warning-ink" : "text-foreground"
        )}
      >
        {value}
      </div>
      {hint && <p className="mt-2 truncate text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

/**
 * A determinate bar (level, season, points). The fill eases over the hover
 * duration; under reduced motion the global rules make that instant.
 */
export function ProgressBar({
  value,
  label,
  tone = "primary",
  size = "md",
  className,
}: {
  /** 0..1. */
  value: number;
  /** Accessible name: "Level 4 progress". */
  label: string;
  tone?: "primary" | "reward" | "success";
  size?: "sm" | "md";
  className?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      className={cn(
        "overflow-hidden rounded-full bg-muted",
        size === "sm" ? "h-1.5" : "h-2.5",
        className
      )}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-sheet ease-out-expo",
          tone === "primary" && "bg-gradient-to-r from-primary to-secondary",
          tone === "reward" && "bg-reward",
          tone === "success" && "bg-success"
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
