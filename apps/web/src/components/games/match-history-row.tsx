"use client";

import * as React from "react";
import Link from "next/link";
import { Badge, buttonVariants, cn } from "@playora/ui";
import { History, Trophy, Handshake, Flag, ArrowRight } from "lucide-react";
import type { MatchRecord } from "../../hooks/use-match-history";

export function MatchRow({ match }: { match: MatchRecord }) {
  const Icon = match.outcome === "win" ? Trophy : match.outcome === "draw" ? Handshake : Flag;
  const tone =
    match.outcome === "win"
      ? "text-success"
      : match.outcome === "draw"
        ? "text-warning"
        : "text-destructive";

  return (
    <Link
      href={`/history/${match.sessionId}`}
      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40"
    >
      <span className={cn("shrink-0", tone)}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("font-display text-sm font-bold uppercase tracking-wide", tone)}>
            {match.outcome}
          </span>
          <Badge variant="secondary" className="text-[10px]">
            {match.gameName}
          </Badge>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {describeOpponents(match)} · {formatDuration(match.durationSeconds)} ·{" "}
          {formatWhen(match.playedAt)}
        </p>
      </div>

      {match.ratingDelta !== null && (
        <span
          className={cn(
            "numeric shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold",
            match.ratingDelta > 0
              ? "bg-success/15 text-success"
              : match.ratingDelta < 0
                ? "bg-destructive/15 text-destructive"
                : "bg-muted text-muted-foreground",
          )}
        >
          {match.ratingDelta > 0 ? "+" : ""}
          {match.ratingDelta}
        </span>
      )}

      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

export function EmptyState({
  title,
  body,
  action = false,
}: {
  title: string;
  body: string;
  action?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
      <History className="h-8 w-8 text-muted-foreground" aria-hidden />
      <p className="font-display text-lg font-bold text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
      {action && (
        <Link href="/games" className={cn(buttonVariants({ size: "sm" }))}>
          Find a game
        </Link>
      )}
    </div>
  );
}

export function describeOpponents(match: MatchRecord): string {
  const others = match.opponents;
  if (others.length === 0) return "Solo";
  const names = others.slice(0, 3).map((p) => p.displayName);
  return `vs ${names.join(", ")}${others.length > 3 ? ` +${others.length - 3}` : ""}`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function formatWhen(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
