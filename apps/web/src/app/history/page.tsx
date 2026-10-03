"use client";

import * as React from "react";
import Link from "next/link";
import { Button, LoadingState, cn } from "@playora/ui";
import {
  ChevronLeft,
  ChevronRight,
  Trophy,
  Handshake,
  Flag,
  Bot,
  WifiOff,
  Users,
  History,
  Wifi,
  Trash2,
  Clock,
} from "lucide-react";
import { useAuthStore } from "../../lib/store/auth-store";
import { useMatchHistory } from "../../hooks/use-match-history";
import { useLocalHistory, clearLocalHistory, type LocalMatchRecord } from "../../hooks/use-local-history";
import { formatDuration, formatWhen } from "../../components/games/match-history-row";
import { GAME_CATALOG } from "../../lib/games/catalog";
import { isGameImplemented } from "../../lib/play/modes";
import type { GameId } from "@playora/game-types";

const PAGE_SIZE = 20;

function outcomeConfig(outcome: "win" | "loss" | "draw") {
  if (outcome === "win")
    return {
      icon: Trophy,
      label: "Victory",
      ringColor: "border-emerald-500/40",
      bg: "from-emerald-950/60 to-[#0A0B14]",
      badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      glow: "shadow-[0_0_18px_rgba(52,211,153,0.12)]",
      iconColor: "text-emerald-400",
    };
  if (outcome === "draw")
    return {
      icon: Handshake,
      label: "Draw",
      ringColor: "border-amber-500/40",
      bg: "from-amber-950/50 to-[#0A0B14]",
      badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      glow: "shadow-[0_0_18px_rgba(245,158,11,0.10)]",
      iconColor: "text-amber-400",
    };
  return {
    icon: Flag,
    label: "Defeat",
    ringColor: "border-red-500/30",
    bg: "from-red-950/40 to-[#0A0B14]",
    badge: "bg-red-500/20 text-red-300 border-red-500/30",
    glow: "shadow-[0_0_18px_rgba(239,68,68,0.08)]",
    iconColor: "text-red-400",
  };
}

function LocalMatchRow({ match }: { match: LocalMatchRecord }) {
  const cfg = outcomeConfig(match.outcome);
  const Icon = cfg.icon;
  const ModeIcon =
    match.mode === "vs-ai" ? Bot : match.mode === "lan" ? Wifi : match.mode === "career" ? Trophy : Users;

  return (
    <div
      className={cn(
        "group relative flex items-center gap-4 rounded-2xl border bg-gradient-to-r p-4 transition-all duration-200 hover:scale-[1.01]",
        cfg.ringColor,
        cfg.bg,
        cfg.glow
      )}
    >
      {/* Outcome Icon */}
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border", cfg.badge)}>
        <Icon className={cn("h-5 w-5", cfg.iconColor)} />
      </div>

      {/* Main Info */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider", cfg.badge)}>
            {cfg.label}
          </span>
          <span className="text-sm font-bold text-foreground">{match.gameName}</span>
          <span className="flex items-center gap-1 rounded-full bg-foreground/5 border border-border px-2 py-0.5 text-[10px] text-foreground/80">
            <ModeIcon className="h-3 w-3" />
            {match.mode === "vs-ai"
              ? `AI Level ${match.aiLevel ?? ""}`
              : match.mode === "career"
              ? "Career"
              : match.mode === "lan"
              ? "Wi-Fi LAN"
              : "Pass & Play"}
          </span>
        </div>
        <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(match.durationSeconds)}
          </span>
          <span>·</span>
          <span>{formatWhen(match.playedAt)}</span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <WifiOff className="h-3 w-3" />
            Offline
          </span>
        </p>
      </div>
    </div>
  );
}

function OnlineMatchRow({
  match,
}: {
  match: { sessionId: string; gameName: string; outcome: "win" | "loss" | "draw"; finishReason: string; durationSeconds: number; playedAt: string; ratingDelta: number | null; opponentName?: string };
}) {
  const cfg = outcomeConfig(match.outcome);
  const Icon = cfg.icon;

  return (
    <Link
      href={`/history/${match.sessionId}`}
      className={cn(
        "group relative flex items-center gap-4 rounded-2xl border bg-gradient-to-r p-4 transition-all duration-200 hover:scale-[1.01]",
        cfg.ringColor,
        cfg.bg,
        cfg.glow
      )}
    >
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border", cfg.badge)}>
        <Icon className={cn("h-5 w-5", cfg.iconColor)} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider", cfg.badge)}>
            {cfg.label}
          </span>
          <span className="text-sm font-bold text-foreground">{match.gameName}</span>
          <span className="flex items-center gap-1 rounded-full bg-foreground/5 border border-border px-2 py-0.5 text-[10px] text-foreground/80">
            <Wifi className="h-3 w-3" />
            Online
          </span>
        </div>
        <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(match.durationSeconds)}
          </span>
          <span>·</span>
          <span>{formatWhen(match.playedAt)}</span>
        </p>
      </div>

      {match.ratingDelta !== null && (
        <span
          className={cn(
            "numeric shrink-0 rounded-lg px-2.5 py-1 text-xs font-black",
            match.ratingDelta > 0
              ? "bg-emerald-500/20 text-emerald-300"
              : match.ratingDelta < 0
              ? "bg-red-500/20 text-red-300"
              : "bg-foreground/10 text-muted-foreground"
          )}
        >
          {match.ratingDelta > 0 ? "+" : ""}
          {match.ratingDelta} RP
        </span>
      )}
    </Link>
  );
}

export default function MatchHistoryPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const [gameSlug, setGameSlug] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(0);
  const [tab, setTab] = React.useState<"all" | "online" | "local">("all");

  const selectGame = React.useCallback((slug: string | null) => {
    setGameSlug(slug);
    setPage(0);
  }, []);

  // Online matches from Supabase
  const { matches: onlineMatches, isLoading, hasMore, error } = useMatchHistory(user?.id, {
    gameSlug,
    limit: PAGE_SIZE,
    page,
  });

  // Local matches from localStorage
  const localMatches = useLocalHistory({
    gameId: gameSlug as GameId | null,
    limit: 100,
  });

  const showOnline = tab === "all" || tab === "online";
  const showLocal = tab === "all" || tab === "local";

  const hasAnyMatches =
    (showOnline && onlineMatches.length > 0) || (showLocal && localMatches.length > 0);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
      {/* ─── Header ─── */}
      <header>
        <h1 className="font-display text-3xl font-extrabold text-foreground sm:text-4xl">
          Match History
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All your games — online and offline — in one place.
        </p>
      </header>

      {/* ─── Source Tabs ─── */}
      <div className="flex items-center gap-2">
        {(["all", "online", "local"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-bold transition-all",
              tab === t
                ? "bg-primary text-white shadow-[0_0_16px_rgba(124,58,237,0.4)]"
                : "bg-foreground/5 text-foreground/80 hover:bg-foreground/10 hover:text-foreground border border-border"
            )}
          >
            {t === "all" ? "All Games" : t === "online" ? "🌐 Online" : "🖥️ Offline"}
          </button>
        ))}
        {localMatches.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Clear all offline match history?")) clearLocalHistory();
            }}
            title="Clear offline history"
            className="ml-auto flex items-center gap-1.5 rounded-full bg-foreground/5 border border-border px-3 py-1.5 text-[11px] text-muted-foreground hover:text-red-700 dark:hover:text-red-400 hover:bg-red-500/20 dark:hover:bg-red-950/30 hover:border-red-500/30 transition-all"
          >
            <Trash2 className="h-3 w-3" />
            Clear offline
          </button>
        )}
      </div>

      {/* ─── Game Filter ─── */}
      <div className="flex flex-wrap gap-2">
        <FilterChip active={gameSlug === null} onClick={() => selectGame(null)}>
          All games
        </FilterChip>
        {GAME_CATALOG.filter((g) => isGameImplemented(g.id)).map((game) => (
          <FilterChip
            key={game.id}
            active={gameSlug === game.id}
            onClick={() => selectGame(game.id)}
          >
            {game.name}
          </FilterChip>
        ))}
      </div>

      {/* ─── Content ─── */}
      {authLoading || (showOnline && isLoading) ? (
        <LoadingState title="Loading your matches" />
      ) : error && showOnline ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : !hasAnyMatches ? (
        <EmptyState
          noUser={!user && showOnline}
          localOnly={!user || tab === "local"}
        />
      ) : (
        <div className="space-y-3">
          {/* Local matches section */}
          {showLocal && localMatches.length > 0 && (
            <>
              {tab === "all" && (
                <div className="flex items-center gap-2 pt-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Offline Games</span>
                  <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] text-muted-foreground">{localMatches.length}</span>
                </div>
              )}
              {localMatches.map((m) => (
                <LocalMatchRow key={m.id} match={m} />
              ))}
            </>
          )}

          {/* Online matches section */}
          {showOnline && onlineMatches.length > 0 && (
            <>
              {tab === "all" && localMatches.length > 0 && (
                <div className="flex items-center gap-2 pt-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Online Games</span>
                  <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] text-muted-foreground">{onlineMatches.length}</span>
                </div>
              )}
              {onlineMatches.map((match) => (
                <OnlineMatchRow
                  key={match.sessionId}
                  match={{
                    sessionId: match.sessionId,
                    gameName: match.gameName,
                    outcome: match.outcome,
                    finishReason: match.finishReason,
                    durationSeconds: match.durationSeconds,
                    playedAt: match.playedAt,
                    ratingDelta: match.ratingDelta,
                  }}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* ─── Pagination (online only) ─── */}
      {showOnline && (page > 0 || hasMore) && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-border text-foreground hover:bg-foreground/10"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Newer
          </Button>
          <span className="text-xs text-muted-foreground">Page {page + 1}</span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-border text-foreground hover:bg-foreground/10"
            disabled={!hasMore}
            onClick={() => setPage((p) => p + 1)}
          >
            Older
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      )}
    </div>
  );
}

function EmptyState({ noUser, localOnly }: { noUser: boolean; localOnly: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-foreground/10 bg-card/40 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground/5 border border-border">
        <History className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <p className="font-display text-lg font-bold text-foreground">
          {noUser ? "Sign in to see online history" : "No matches yet"}
        </p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {noUser
            ? "Offline games are shown above. Sign in to track online matches and ratings."
            : localOnly
            ? "Play a game and your results will appear here — no sign-in required."
            : "Play a game online or offline and it will appear here automatically."}
        </p>
      </div>
      <Link
        href="/"
        className="rounded-xl bg-primary hover:bg-primary/90 px-6 py-2.5 text-sm font-bold text-white transition-colors shadow-lg"
      >
        Find a game
      </Link>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all",
        active
          ? "border-[#7C3AED]/50 bg-primary/20 text-[#C084FC] shadow-[0_0_12px_rgba(124,58,237,0.2)]"
          : "border-border bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
