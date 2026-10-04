"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Avatar, Badge, Button, Card, Skeleton, cn } from "@playora/ui";
import { ArrowLeft, Bot, Clock, Hash, RotateCcw, SearchX, Trophy } from "lucide-react";
import { useAuthStore } from "../../../lib/store/auth-store";
import { useMatchDetail } from "../../../hooks/use-match-history";
import { isGameId } from "../../../lib/games/catalog";
import {
  OUTCOME_STYLE,
  RatingDelta,
  formatDuration,
  formatWhen,
} from "../../../components/games/match-history-row";
import { PageContainer } from "../../../components/page/page-header";
import { EmptyState } from "../../../components/page/empty-state";
import { GameThumb } from "../../../components/shell/game-thumb";

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

  return (
    <PageContainer className="max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/history">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All matches
        </Link>
      </Button>

      {isLoading ? (
        <Card className="space-y-4 p-6" role="status" aria-live="polite">
          <span className="sr-only">Loading this match</span>
          <Skeleton className="mx-auto h-14 w-14 rounded-xl" />
          <Skeleton className="mx-auto h-8 w-40" />
          <Skeleton className="mx-auto h-4 w-56" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </Card>
      ) : notFound || !match ? (
        <EmptyState
          icon={<SearchX />}
          title="Match not found"
          body="It may have been removed, the link may be wrong, or it may belong to another account."
          action={
            <Button asChild>
              <Link href="/history">Back to your matches</Link>
            </Button>
          }
        />
      ) : (
        <MatchCard match={match} viewerId={user?.id} />
      )}
    </PageContainer>
  );
}

function MatchCard({
  match,
  viewerId,
}: {
  match: NonNullable<ReturnType<typeof useMatchDetail>["match"]>;
  viewerId: string | undefined;
}) {
  const outcome = OUTCOME_STYLE[match.outcome];
  const Icon = outcome.icon;

  return (
    <Card className="overflow-hidden p-0">
      <header className="relative border-b border-border px-6 pb-6 pt-8 text-center">
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b to-transparent",
            match.outcome === "win"
              ? "from-success/15"
              : match.outcome === "draw"
                ? "from-warning/15"
                : "from-destructive/15"
          )}
          aria-hidden
        />
        <span
          className={cn(
            "relative mx-auto flex h-14 w-14 items-center justify-center rounded-xl",
            outcome.tint
          )}
          aria-hidden
        >
          <Icon className="h-7 w-7" />
        </span>
        <h1 className="relative mt-3 font-display text-h1 text-foreground">{outcome.label}</h1>
        <p className="relative mt-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          {isGameId(match.gameSlug) && (
            <GameThumb id={match.gameSlug} sizes="20px" className="h-5 w-5 rounded" />
          )}
          {match.gameName} · {REASON_COPY[match.finishReason] ?? "Finished"}
        </p>

        <div className="relative mt-4 flex flex-wrap items-center justify-center gap-2">
          <Badge variant="outline">
            <Clock aria-hidden />
            <span className="numeric">{formatDuration(match.durationSeconds)}</span>
          </Badge>
          <Badge variant="outline">{formatWhen(match.playedAt)}</Badge>
          {match.ratingDelta !== null && (
            <span className="inline-flex items-center gap-1.5">
              <RatingDelta delta={match.ratingDelta} />
              {match.ratingAfter !== null && (
                <span className="text-xs text-muted-foreground">
                  now{" "}
                  <span className="font-mono-num font-bold text-foreground">
                    {match.ratingAfter}
                  </span>
                </span>
              )}
            </span>
          )}
        </div>
      </header>

      <section className="px-6 py-5" aria-labelledby="standings-heading">
        <h2 id="standings-heading" className="mb-3 text-tag uppercase text-muted-foreground">
          Final standings
        </h2>
        <ol className="space-y-2">
          {match.participants.map((p) => {
            const isMe = p.userId === viewerId;
            return (
              <li
                key={p.userId}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5",
                  isMe ? "border-primary/40 bg-primary/[0.08]" : "border-border"
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="font-mono-num w-5 text-sm font-bold text-muted-foreground">
                    {p.rank}
                  </span>
                  <Avatar alt="" aria-hidden fallbackText={p.displayName} size="sm" />
                  <span className="truncate text-sm font-medium text-foreground">
                    {p.displayName}
                    {isMe && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                  </span>
                  {p.isBot && (
                    <Bot className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Bot" />
                  )}
                  {p.isWinner && (
                    <Trophy className="h-3.5 w-3.5 shrink-0 text-reward" aria-label="Winner" />
                  )}
                </div>
                <span className="font-mono-num text-sm font-bold text-foreground">{p.score}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <footer className="flex flex-wrap items-center gap-3 border-t border-border px-6 py-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Hash className="h-3 w-3" aria-hidden />
          {/* Useful when reporting a disputed result. */}
          <span className="font-mono-num">{match.sessionId.slice(0, 8)}</span>
        </span>
        <Button asChild variant="secondary" size="sm" className="ml-auto">
          <Link href={isGameId(match.gameSlug) ? `/games/${match.gameSlug}` : "/games"}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Play {match.gameName} again
          </Link>
        </Button>
      </footer>
    </Card>
  );
}
