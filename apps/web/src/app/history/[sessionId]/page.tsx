"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge, LoadingState, buttonVariants, cn } from "@playora/ui";
import { ArrowLeft, Bot, Trophy, Handshake, Flag, Clock, Hash } from "lucide-react";
import { useAuthStore } from "../../../lib/store/auth-store";
import { useMatchDetail } from "../../../hooks/use-match-history";
import { formatDuration, formatWhen } from "../../../components/games/match-history-row";

const REASON_COPY: Record<string, string> = {
  normal: "Played to the end",
  resignation: "Ended by resignation",
  timeout: "Ended on the clock",
  disconnect: "Ended by disconnection",
  draw: "Agreed draw",
};

export default function MatchDetailPage() {
  const params = useParams();
  const sessionId = (params?.sessionId as string) ?? "";
  const { user } = useAuthStore();
  const { match, isLoading, notFound } = useMatchDetail(sessionId, user?.id);

  const Icon = match?.outcome === "win" ? Trophy : match?.outcome === "draw" ? Handshake : Flag;
  const tone =
    match?.outcome === "win"
      ? "text-success"
      : match?.outcome === "draw"
        ? "text-warning"
        : "text-destructive";

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link
        href="/history"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mb-6 gap-2")}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All matches
      </Link>

      {isLoading ? (
        <LoadingState title="Loading this match" />
      ) : notFound || !match ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center">
          <p className="font-display text-lg font-bold text-foreground">Match not found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This match may have been removed, or the link is wrong.
          </p>
        </div>
      ) : (
        <article className="overflow-hidden rounded-2xl border border-border bg-card">
          <header className="border-b border-border px-6 py-6 text-center">
            <span className={cn("inline-flex", tone)}>
              <Icon className="h-8 w-8" aria-hidden />
            </span>
            <h1
              className={cn(
                "mt-2 font-display text-3xl font-black uppercase tracking-tight",
                tone,
              )}
            >
              {match.outcome}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {match.gameName} · {REASON_COPY[match.finishReason] ?? "Finished"}
            </p>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" aria-hidden />
                {formatDuration(match.durationSeconds)}
              </Badge>
              <Badge variant="outline">{formatWhen(match.playedAt)}</Badge>
              {match.ratingDelta !== null && (
                <Badge variant={match.ratingDelta >= 0 ? "success" : "destructive"}>
                  {match.ratingDelta > 0 ? "+" : ""}
                  {match.ratingDelta} rating
                  {match.ratingAfter !== null && ` → ${match.ratingAfter}`}
                </Badge>
              )}
            </div>
          </header>

          <section className="px-6 py-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Final standings
            </h2>
            <ol className="space-y-2">
              {match.participants.map((p) => {
                const isMe = p.userId === user?.id;
                return (
                  <li
                    key={p.userId}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-xl border px-3 py-2",
                      isMe ? "border-primary/40 bg-primary/5" : "border-border/60",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="numeric w-5 text-sm text-muted-foreground">{p.rank}</span>
                      <span className="truncate text-sm font-medium text-foreground">
                        {p.displayName}
                        {isMe && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                      </span>
                      {p.isBot && <Bot className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
                      {p.isWinner && <Trophy className="h-3.5 w-3.5 text-warning" aria-hidden />}
                    </div>
                    <span className="numeric text-sm text-muted-foreground">{p.score}</span>
                  </li>
                );
              })}
            </ol>
          </section>

          <footer className="flex flex-wrap items-center gap-3 border-t border-border px-6 py-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Hash className="h-3 w-3" aria-hidden />
              {/* Useful when reporting a disputed result. */}
              <span className="numeric">{match.sessionId.slice(0, 8)}</span>
            </span>
            <Link
              href={`/play?game=${match.gameSlug}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "ml-auto")}
            >
              Play {match.gameName} again
            </Link>
          </footer>
        </article>
      )}
    </div>
  );
}
