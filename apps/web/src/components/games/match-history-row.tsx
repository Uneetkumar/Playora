import * as React from "react";
import Link from "next/link";
import type { GameId } from "@playora/game-types";
import { Skeleton, cn } from "@playora/ui";
import {
  Bot,
  ChevronRight,
  Flag,
  Gamepad2,
  Handshake,
  Trophy,
  Users,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import type { MatchRecord } from "../../hooks/use-match-history";
import type { LocalMatchRecord } from "../../hooks/use-local-history";
import { isGameId } from "../../lib/games/catalog";
import { GameThumb } from "../shell/game-thumb";

/*
 * One finished match, as every list shows it: History, the profile's recent
 * matches. Online results (from the server) and offline ones (from this
 * device) are normalised to one shape first, so the two lists cannot drift
 * into two looks again: the offline rows used to be emerald and red
 * gradients over a hard-coded near-black, invisible in the light theme.
 */

export type MatchOutcome = "win" | "loss" | "draw";

export interface MatchRowItem {
  id: string;
  /** Null when the server names a game this build does not know. */
  gameId: GameId | null;
  gameName: string;
  outcome: MatchOutcome;
  /** "Online", "vs AI · level 3", "Pass & Play". */
  modeLabel: string;
  modeIcon: LucideIcon;
  /** "vs Ada, Bo" when known. */
  opponents?: string;
  durationSeconds: number;
  playedAt: string;
  /** Null for unrated and offline matches. */
  ratingDelta: number | null;
  /** The match's own page, when it has one (online results do). */
  href?: string;
}

export const OUTCOME_STYLE: Record<
  MatchOutcome,
  { label: string; icon: LucideIcon; tint: string; solid: string }
> = {
  win: {
    label: "Victory",
    icon: Trophy,
    tint: "bg-success/15 text-success-ink",
    solid: "bg-success text-success-foreground",
  },
  draw: {
    label: "Draw",
    icon: Handshake,
    tint: "bg-warning/15 text-warning-ink",
    solid: "bg-warning text-warning-foreground",
  },
  loss: {
    label: "Defeat",
    icon: Flag,
    tint: "bg-destructive/15 text-destructive-ink",
    solid: "bg-destructive text-destructive-foreground",
  },
};

export function fromOnlineMatch(match: MatchRecord): MatchRowItem {
  return {
    id: match.sessionId,
    gameId: isGameId(match.gameSlug) ? match.gameSlug : null,
    gameName: match.gameName,
    outcome: match.outcome,
    modeLabel: "Online",
    modeIcon: Wifi,
    opponents: describeOpponents(match),
    durationSeconds: match.durationSeconds,
    playedAt: match.playedAt,
    ratingDelta: match.ratingDelta,
    href: `/history/${match.sessionId}`,
  };
}

export function fromLocalMatch(match: LocalMatchRecord): MatchRowItem {
  const mode: { label: string; icon: LucideIcon } =
    match.mode === "vs-ai"
      ? { label: match.aiLevel ? `vs AI · level ${match.aiLevel}` : "vs AI", icon: Bot }
      : match.mode === "lan"
        ? { label: "Same Wi-Fi", icon: Wifi }
        : match.mode === "career"
          ? { label: "Career", icon: Trophy }
          : match.mode === "solo"
            ? { label: "Solo", icon: Gamepad2 }
            : { label: "Pass & Play", icon: Users };
  return {
    id: match.id,
    gameId: isGameId(match.gameId) ? match.gameId : null,
    gameName: match.gameName,
    outcome: match.outcome,
    modeLabel: mode.label,
    modeIcon: mode.icon,
    opponents: match.opponentName ? `vs ${match.opponentName}` : undefined,
    durationSeconds: match.durationSeconds,
    playedAt: match.playedAt,
    ratingDelta: null,
  };
}

export function MatchHistoryRow({ item }: { item: MatchRowItem }) {
  const outcome = OUTCOME_STYLE[item.outcome];
  const OutcomeIcon = outcome.icon;
  const ModeIcon = item.modeIcon;

  const body = (
    <>
      <span className="relative shrink-0">
        {item.gameId ? (
          <GameThumb id={item.gameId} sizes="48px" className="h-12 w-12 rounded-lg" />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Gamepad2 className="h-5 w-5" aria-hidden />
          </span>
        )}
        <span
          className={cn(
            "absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-card",
            outcome.solid
          )}
          aria-hidden
        >
          <OutcomeIcon className="h-3 w-3" />
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-semibold text-foreground">{item.gameName}</span>
          <span className={cn("rounded-full px-2 py-0.5 text-tag uppercase", outcome.tint)}>
            {outcome.label}
          </span>
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <ModeIcon className="h-3 w-3" aria-hidden />
            {item.modeLabel}
          </span>
          {item.opponents && (
            <>
              <span aria-hidden>·</span>
              <span className="truncate">{item.opponents}</span>
            </>
          )}
          <span aria-hidden>·</span>
          <span className="numeric">{formatDuration(item.durationSeconds)}</span>
          <span aria-hidden>·</span>
          <span>{formatWhen(item.playedAt)}</span>
        </span>
      </span>

      {item.ratingDelta !== null && <RatingDelta delta={item.ratingDelta} />}
      {item.href && (
        <ChevronRight
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-hover ease-out-expo group-hover:translate-x-0.5"
          aria-hidden
        />
      )}
    </>
  );

  const frame =
    "group flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 shadow-card sm:gap-4 sm:px-4";

  return item.href ? (
    <Link
      href={item.href}
      className={cn(
        frame,
        "transition-[box-shadow,border-color] duration-hover ease-out-expo hover:shadow-card-hover focus-visible:shadow-card-hover"
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={frame}>{body}</div>
  );
}

export function RatingDelta({ delta, className }: { delta: number; className?: string }) {
  return (
    <span
      className={cn(
        "font-mono-num shrink-0 rounded-md px-2 py-1 text-xs font-bold",
        delta > 0
          ? "bg-success/15 text-success-ink"
          : delta < 0
            ? "bg-destructive/15 text-destructive-ink"
            : "bg-muted text-muted-foreground",
        className
      )}
    >
      <span className="sr-only">Rating </span>
      {delta > 0 ? "+" : ""}
      {delta}
    </span>
  );
}

/** Rows' shape while they load. */
export function MatchHistorySkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-2">
      <span className="sr-only">Loading matches</span>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3"
        >
          <Skeleton className="h-12 w-12" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40 max-w-[60%]" />
            <Skeleton className="h-3 w-56 max-w-[80%]" />
          </div>
        </div>
      ))}
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
