"use client";

import * as React from "react";
import Link from "next/link";
import { BarChart3, BookOpen, ChevronRight, History, Medal } from "lucide-react";
import type { GameId } from "@playora/game-types";
import { rankForRating } from "@playora/progression";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Avatar,
  Badge,
  Button,
  SectionHeader,
  Skeleton,
  cn,
} from "@playora/ui";
import type { GameView } from "../../../lib/games/view";
import type { PlayMode } from "../../../lib/play/modes";
import { useLeaderboard, type LeaderboardEntry } from "../../../hooks/use-leaderboard";
import { MatchHistoryRow, type MatchRowItem } from "../../../components/games/match-history-row";
import { RankBadge } from "../../../components/progression/rank-badge";
import { modeCopy } from "./play-options";
import type { DetailStat } from "./detail-stats";

/*
 * The sections under the hero, in the order a player wants them: how the game
 * works, how they are doing at it, and who is best at it. Each one that has
 * nothing real to show renders nothing, so a first visit is the rules and the
 * play box rather than a column of empty states.
 */

/* ─── How to play ───────────────────────────────────────────────────────── */

export function HowToPlay({ game, modes }: { game: Pick<GameView, "id" | "description" | "rules">; modes: readonly PlayMode[] }) {
  const ready = modes.filter((m) => m.status === "ready");
  return (
    <section aria-labelledby="how-to-play" className="space-y-4">
      <SectionHeader headingId="how-to-play" title="How to play" icon={<BookOpen />} />
      <p className="max-w-prose text-base text-muted-foreground">{game.description}</p>

      <Accordion
        type="multiple"
        defaultValue={["rules"]}
        className="rounded-xl border border-border bg-card px-4 shadow-card sm:px-5"
      >
        <AccordionItem value="rules" className={cn(ready.length < 2 && "border-b-0")}>
          <AccordionTrigger className="text-base">Rules</AccordionTrigger>
          <AccordionContent>
            <ol className="space-y-3">
              {game.rules.map((rule, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    aria-hidden
                    className="numeric flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-game-accent-soft text-xs font-bold text-foreground"
                  >
                    {i + 1}
                  </span>
                  <span className="pt-0.5 leading-relaxed text-foreground">{rule}</span>
                </li>
              ))}
            </ol>
          </AccordionContent>
        </AccordionItem>

        {/* A solo game has one way to play, which the play box already says. */}
        {ready.length > 1 && (
          <AccordionItem value="modes" className="border-b-0">
            <AccordionTrigger className="text-base">Ways to play</AccordionTrigger>
            <AccordionContent>
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {ready.map((mode) => {
                  const copy = modeCopy(mode.id, game.id);
                  return (
                    <div key={mode.id}>
                      <dt className="font-semibold text-foreground">{copy.option}</dt>
                      <dd className="mt-0.5 leading-relaxed">
                        {copy.hint} {mode.needsInternet ? "Needs internet." : "Works offline."}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </section>
  );
}

/* ─── Your stats ────────────────────────────────────────────────────────── */

export function YourStats({ stats }: { stats: readonly DetailStat[] }) {
  if (stats.length === 0) return null;
  return (
    <section aria-labelledby="your-stats" className="space-y-4">
      <SectionHeader headingId="your-stats" title="Your stats" icon={<BarChart3 />} />
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
        {stats.map((stat) => (
          <div key={stat.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <dt className="text-tag uppercase text-muted-foreground">{stat.label}</dt>
            <dd className="numeric mt-2 font-display text-2xl font-bold leading-none text-foreground">{stat.value}</dd>
            {stat.hint && <dd className="mt-2 truncate text-xs text-muted-foreground">{stat.hint}</dd>}
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ─── Recent matches ────────────────────────────────────────────────────── */

export function RecentMatches({ items }: { items: readonly MatchRowItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="recent-matches" className="space-y-4">
      <SectionHeader
        headingId="recent-matches"
        title="Recent matches"
        icon={<History />}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/history">
              All matches
              <ChevronRight aria-hidden className="h-4 w-4" />
            </Link>
          </Button>
        }
      />
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <MatchHistoryRow item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ─── Leaderboard ───────────────────────────────────────────────────────── */

const PREVIEW_SIZE = 5;

/**
 * The top of this game's board, and the viewer's own place when it is
 * further down. Only mounted for a rated game on a deployment with a
 * database; an error hides it rather than putting a failure on a game page.
 */
export function LeaderboardPreview({
  gameId,
  gameName,
  userId,
}: {
  gameId: GameId;
  gameName: string;
  userId: string | null | undefined;
}) {
  const { entries, me, isLoading, error } = useLeaderboard(userId, { gameSlug: gameId, limit: PREVIEW_SIZE });
  if (error) return null;

  return (
    <section aria-labelledby="leaderboard-preview" className="space-y-4">
      <SectionHeader
        headingId="leaderboard-preview"
        title="Leaderboard"
        icon={<Medal />}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href={`/leaderboard?game=${gameId}`}>
              Full board
              <ChevronRight aria-hidden className="h-4 w-4" />
            </Link>
          </Button>
        }
      />
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        {isLoading ? (
          <div role="status" className="divide-y divide-border">
            <span className="sr-only">Loading the {gameName} leaderboard</span>
            {Array.from({ length: PREVIEW_SIZE }, (_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-4 w-5" />
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-32 max-w-[40%]" />
                <Skeleton className="ml-auto h-4 w-12" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nobody is ranked in {gameName} yet. Win a rated match to top the board.
          </p>
        ) : (
          <ol aria-label={`Top ${gameName} players`} className="divide-y divide-border">
            {entries.slice(0, PREVIEW_SIZE).map((entry) => (
              <li key={entry.userId}>
                <LeaderRow entry={entry} />
              </li>
            ))}
            {me && (
              <li aria-label="Your place" className="border-t-2 border-dashed border-border">
                <LeaderRow entry={me} />
              </li>
            )}
          </ol>
        )}
      </div>
    </section>
  );
}

/** First, second and third, by the same reward / neutral / streak colours the podium uses. */
const PLACE_TONE: Record<number, string> = {
  1: "text-reward",
  2: "text-foreground",
  3: "text-streak",
};

function LeaderRow({ entry }: { entry: LeaderboardEntry }) {
  return (
    <div className={cn("flex items-center gap-3 px-4 py-3", entry.isMe && "bg-primary/[0.08]")}>
      <span className={cn("font-mono-num w-6 shrink-0 text-sm font-bold", PLACE_TONE[entry.rank] ?? "text-muted-foreground")}>
        <span className="sr-only">Rank </span>
        {entry.rank}
      </span>
      <Avatar src={entry.avatarUrl} alt="" aria-hidden fallbackText={entry.displayName} size="sm" />
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sm font-semibold text-foreground">{entry.displayName}</span>
        {entry.isMe && (
          <Badge variant="default" className="px-2 text-[10px]">
            You
          </Badge>
        )}
      </span>
      <RankBadge tier={rankForRating(entry.rating)} size="sm" className="hidden sm:inline-flex" />
      <span className="font-mono-num w-14 shrink-0 text-right text-sm font-bold text-foreground">
        <span className="sr-only">Rating </span>
        {entry.rating}
      </span>
    </div>
  );
}
