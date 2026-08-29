"use client";

import * as React from "react";
import Link from "next/link";
import { Button, Badge, Card } from "@playora/ui";
import {
  Zap, Play, Users, TrendingUp, Trophy, Clock, ChevronRight,
  UserPlus, Gamepad2, Flame,
} from "lucide-react";
import { usePlayerProgression } from "../../hooks/use-progression";
import { useRecentMatches } from "../../hooks/use-recent-matches";
import { useAuthStore } from "../../lib/store/auth-store";
import { GAME_CATALOG, isPlayable } from "../../lib/games/catalog";
import { GameSearch } from "../games/game-search";
import { JoinByCode } from "../rooms/join-by-code";

/**
 * Home dashboard for a signed-in player.
 *
 * It exists to answer four questions fast: what can I play, what should I play,
 * what are my friends doing, and how am I progressing. Sections are ordered by
 * that priority, and any section without real data says so rather than showing
 * an invented placeholder.
 */

function SectionHeading({
  icon: Icon,
  title,
  href,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden />
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="flex items-center gap-0.5 text-xs text-primary transition-opacity hover:opacity-80"
        >
          {action ?? "See all"}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function relativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function HomeDashboard() {
  const { user } = useAuthStore();
  const { data: progression, isLoading: progressionLoading } = usePlayerProgression(user?.id);
  const { matches, isLoading: matchesLoading } = useRecentMatches(user?.id);

  const playableGames = GAME_CATALOG.filter(isPlayable);
  // "Continue playing" means games you actually have a record in.
  const continuePlaying = (progression?.ratings ?? []).slice(0, 3);
  const firstName = (user?.displayName ?? "Player").split(" ")[0];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Search sits at the top, as the pack has it. */}
      <div className="mb-8">
        <GameSearch />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Quick Play hero — the single dominant action on the page. */}
        <Card className="relative overflow-hidden border-primary/40 bg-gradient-to-br from-primary/25 via-card to-card p-6 lg:col-span-2">
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-primary/20 blur-3xl" aria-hidden />
          <div className="relative">
            <Badge variant="default" className="mb-3">
              <Zap className="mr-1 h-3 w-3" aria-hidden />
              Quick Play
            </Badge>
            <h1 className="font-display text-3xl font-extrabold text-foreground sm:text-4xl">
              Welcome back, {firstName}
            </h1>
            <p className="mt-2 max-w-md text-muted-foreground">
              Jump into a game instantly — against the computer, a friend, or someone
              near your level.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/play">
                <Button size="lg" className="gap-2 shadow-glow-primary">
                  <Play className="h-5 w-5 fill-current" aria-hidden />
                  Play now
                </Button>
              </Link>
              <Link href="/games">
                <Button size="lg" variant="outline" className="gap-2">
                  <Gamepad2 className="h-5 w-5" aria-hidden />
                  Browse games
                </Button>
              </Link>
            </div>
          </div>
        </Card>

        {/* Your progress */}
        <Card className="border-border bg-card p-6">
          <SectionHeading icon={TrendingUp} title="Your progress" href="/profile" />
          {progressionLoading ? (
            <div className="h-28 animate-pulse rounded-lg bg-muted/40" aria-busy="true" />
          ) : progression ? (
            <>
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

              <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
                {[
                  ["Games", progression.gamesPlayed],
                  ["Wins", progression.wins],
                  ["Streak", progression.currentStreak],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg bg-muted/40 py-2">
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {label}
                    </dt>
                    <dd className="numeric text-lg text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Play a game to start tracking progress.</p>
          )}
        </Card>

        {/* Continue playing */}
        <Card className="border-border bg-card p-6 lg:col-span-2">
          <SectionHeading icon={Clock} title="Continue playing" href="/games" />
          {progressionLoading ? (
            <div className="grid gap-3 sm:grid-cols-3" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-lg bg-muted/40" />
              ))}
            </div>
          ) : continuePlaying.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {continuePlaying.map((r) => (
                <Link key={r.gameSlug} href={`/play?game=${r.gameSlug}`}>
                  <div className="group rounded-lg border border-border bg-muted/20 p-4 transition-colors hover:border-primary">
                    <div className="font-display font-bold text-foreground">{r.gameName}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="numeric text-lg text-primary">{r.rating}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {r.rank.label}
                      </Badge>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {r.gamesPlayed} played · {r.wins}W
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <p className="text-sm text-foreground">Nothing in progress yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Games you play will show up here so you can pick straight back up.
              </p>
              <Link href="/play">
                <Button size="sm" className="mt-4 gap-2">
                  <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
                  Play your first game
                </Button>
              </Link>
            </div>
          )}
        </Card>

        {/* Friends — honest about not existing yet */}
        <Card className="border-border bg-card p-6">
          <SectionHeading icon={Users} title="Friends online" />
          <div className="rounded-lg border border-dashed border-border p-5 text-center">
            <UserPlus className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden />
            <p className="mt-2 text-sm text-foreground">No friends yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Share a room code to play with someone you know.
            </p>
            <div className="mt-4">
              <JoinByCode />
            </div>
          </div>
        </Card>

        {/* Games */}
        <Card className="border-border bg-card p-6 lg:col-span-2">
          <SectionHeading icon={Gamepad2} title="Games" href="/games" />
          <div className="grid gap-3 sm:grid-cols-2">
            {playableGames.map((game) => (
              <Link key={game.id} href={`/play?game=${game.id}`}>
                <div className="group flex items-center justify-between rounded-lg border border-border bg-muted/20 p-4 transition-colors hover:border-primary">
                  <div>
                    <div className="font-display font-bold text-foreground">{game.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {game.category} · {game.minPlayers}-{game.maxPlayers} players · {game.duration}
                    </div>
                  </div>
                  <Play
                    className="h-5 w-5 shrink-0 fill-current text-muted-foreground transition-colors group-hover:text-primary"
                    aria-hidden
                  />
                </div>
              </Link>
            ))}
          </div>
        </Card>

        {/* Recent matches */}
        <Card className="border-border bg-card p-6">
          <SectionHeading icon={Trophy} title="Recent matches" href="/profile" />
          {matchesLoading ? (
            <div className="space-y-2" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/40" />
              ))}
            </div>
          ) : matches.length > 0 ? (
            <ul className="space-y-2">
              {matches.map((m) => (
                <li
                  key={m.sessionId}
                  className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-foreground">{m.gameName}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {relativeTime(m.playedAt)}
                    </span>
                  </span>
                  {/* Outcome named, not just coloured. */}
                  <Badge
                    variant={m.isDraw ? "secondary" : m.isWinner ? "success" : "destructive"}
                    className="shrink-0 text-[10px]"
                  >
                    {m.isDraw ? "Draw" : m.isWinner ? "Won" : "Lost"}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-5 text-center">
              <Flame className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden />
              <p className="mt-2 text-xs text-muted-foreground">
                Finished games appear here with your result and rating change.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
