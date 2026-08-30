"use client";

import * as React from "react";
import Link from "next/link";
import { Button, Card, Badge } from "@playora/ui";
import { Play, Zap, TrendingUp, Trophy, Users, UserPlus } from "lucide-react";
import { GAME_CATALOG, isPlayable } from "../lib/games/catalog";
import { GameRow } from "../components/games/game-tile";
import { useAuthStore } from "../lib/store/auth-store";
import { usePlayerProgression } from "../hooks/use-progression";
import { useRecentMatches } from "../hooks/use-recent-matches";

/**
 * Home: a wall of games, the way a games platform opens.
 *
 * Rows are ordered by how likely they are to get someone playing — what you
 * were already playing, then what is actually playable, then the rest. Progress
 * and recent results sit beside them rather than above: they are context, not
 * the reason anyone opened the page.
 */
export default function HomePage() {
  const { user, isLoading, initialize } = useAuthStore();
  const { data: progression } = usePlayerProgression(user?.id);
  const { matches } = useRecentMatches(user?.id, 4);

  React.useEffect(() => {
    void initialize();
  }, [initialize]);

  const playable = GAME_CATALOG.filter(isPlayable);
  const upcoming = GAME_CATALOG.filter((g) => !isPlayable(g));

  // "Continue playing" is only meaningful once you have a record somewhere.
  const playedSlugs = new Set((progression?.ratings ?? []).map((r) => r.gameSlug));
  const continuePlaying = GAME_CATALOG.filter((g) => playedSlugs.has(g.id));

  return (
    <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6">
      {/* Hero: one dominant action. */}
      <Card className="relative mb-8 overflow-hidden border-primary/40 bg-gradient-to-br from-primary/25 via-card to-card p-6 sm:p-8">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-primary/20 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Badge variant="default" className="mb-3">
              <Zap className="mr-1 h-3 w-3" aria-hidden />
              Quick Play
            </Badge>
            <h1 className="font-display text-3xl font-extrabold text-foreground sm:text-4xl">
              {user ? `Welcome back, ${(user.displayName ?? "Player").split(" ")[0]}` : "Play together. Win together."}
            </h1>
            <p className="mt-2 max-w-lg text-muted-foreground">
              Play against the computer, pass the device to a friend, or challenge
              someone online. No download, and the offline modes need no account.
            </p>
          </div>
          <Link href="/play" className="shrink-0">
            <Button size="lg" className="gap-2 shadow-glow-primary">
              <Play className="h-5 w-5 fill-current" aria-hidden />
              Play now
            </Button>
          </Link>
        </div>
      </Card>

      <div className="grid gap-8 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          {continuePlaying.length > 0 && (
            <GameRow title="Continue playing" games={continuePlaying} href="/games" />
          )}

          <GameRow title="Playable now" games={playable} href="/games" size="lg" />

          <GameRow
            title="Coming soon"
            games={upcoming}
            emptyNote="Every game is playable — more on the way."
          />
        </div>

        {/* Side column: context, not the main event. */}
        <aside className="space-y-5">
          {progression && (
            <Card className="border-border bg-card p-5">
              <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
                <TrendingUp className="h-4 w-4" aria-hidden />
                Your progress
              </h2>
              <div className="flex items-baseline justify-between">
                <span className="font-display text-sm font-bold text-foreground">
                  Level <span className="numeric text-primary">{progression.level.level}</span>
                </span>
                <span className="numeric text-xs text-muted-foreground">
                  {progression.level.xpIntoLevel} / {progression.level.xpForNextLevel} XP
                </span>
              </div>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={Math.round(progression.level.progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Level progress"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
                  style={{ width: `${progression.level.progress * 100}%` }}
                />
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  ["Games", progression.gamesPlayed],
                  ["Wins", progression.wins],
                  ["Streak", progression.currentStreak],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg bg-muted/40 py-2">
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
                    <dd className="numeric text-base text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}

          {matches.length > 0 && (
            <Card className="border-border bg-card p-5">
              <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
                <Trophy className="h-4 w-4" aria-hidden />
                Recent matches
              </h2>
              <ul className="space-y-2">
                {matches.map((m) => (
                  <li key={m.sessionId} className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2">
                    <span className="truncate text-sm text-foreground">{m.gameName}</span>
                    <Badge
                      variant={m.isDraw ? "secondary" : m.isWinner ? "success" : "destructive"}
                      className="shrink-0 text-[10px]"
                    >
                      {m.isDraw ? "Draw" : m.isWinner ? "Won" : "Lost"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="border-border bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
              <Users className="h-4 w-4" aria-hidden />
              Friends
            </h2>
            <div className="rounded-lg border border-dashed border-border p-5 text-center">
              <UserPlus className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden />
              <p className="mt-2 text-sm text-foreground">No friends yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Use the room code box in the header to play with someone you know.
              </p>
            </div>
          </Card>

          {!user && !isLoading && (
            <Card className="border-primary/40 bg-primary/10 p-5 text-center">
              <p className="text-sm text-foreground">Sign in to keep your progress</p>
              <Link href="/login">
                <Button size="sm" className="mt-3 w-full">
                  Sign in or play as guest
                </Button>
              </Link>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
