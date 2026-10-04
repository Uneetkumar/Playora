"use client";

import * as React from "react";
import Link from "next/link";
import { ACHIEVEMENTS, rankForRating, ratingToNextRank } from "@playora/progression";
import type { GameResult, Player } from "@playora/game-types";
import type { PlayerProgressionPayload } from "@playora/protocol";
import { Button, Card, SectionHeader } from "@playora/ui";
import { Bot, Globe2, Moon, Sun, UserRound, Users } from "lucide-react";
import type { LeaderboardEntry } from "../../../hooks/use-leaderboard";
import type { GameRating } from "../../../hooks/use-progression";
import { applyTheme } from "../../../lib/theme";
import { BoardRow, BoardSkeleton, BoardTable, Podium } from "../../leaderboard/board";
import { RatingCard } from "../../profile/rating-card";
import { PageContainer, PageHeader } from "../../../components/page/page-header";
import { AchievementBadge } from "../../../components/games/achievement-badge";
import {
  MatchHistoryRow,
  MatchHistorySkeleton,
  type MatchRowItem,
} from "../../../components/games/match-history-row";
import { MatchResult } from "../../../components/games/match-result";

/*
 * Made-up players and results. Nothing here is fetched or stored: the
 * components are handed data the way their pages hand it, so what shows is
 * exactly what a real board, row or result card draws.
 */

const NAMES = [
  "Ada Lovelace",
  "grandmaster_flash",
  "Kasparov Jr",
  "Nina",
  "Theo",
  "QuietStorm",
  "Bishop Bob",
  "Rook Rachel",
  "Pawnstar",
  "A name long enough to need truncating on a phone",
];

/** Ten players, 2420 down in steps of 160, so every tier from Grandmaster shows. */
const ENTRIES: LeaderboardEntry[] = NAMES.map((name, i) => ({
  rank: i + 1,
  userId: `demo-${i}`,
  displayName: name,
  username: name.toLowerCase().replace(/\W+/g, "_"),
  avatarUrl: null,
  rating: 2420 - i * 160,
  peakRating: 2500 - i * 120,
  gamesPlayed: 120 - i * 7,
  wins: 80 - i * 5,
  losses: 30 + i,
  draws: Math.max(0, 10 - i),
  isMe: i === 5,
}));

const ME = ENTRIES[5]!;
const ME_ID = ME.userId;

function rows(now: number): MatchRowItem[] {
  const ago = (hours: number) => new Date(now - hours * 3_600_000).toISOString();
  return [
    {
      id: "r1",
      gameId: "chess",
      gameName: "Chess",
      outcome: "win",
      modeLabel: "Online",
      modeIcon: Globe2,
      opponents: "vs grandmaster_flash",
      durationSeconds: 1_312,
      playedAt: ago(2),
      ratingDelta: 14,
      href: "/history/demo",
    },
    {
      id: "r2",
      gameId: "uno",
      gameName: "UNO",
      outcome: "loss",
      modeLabel: "Online",
      modeIcon: Users,
      opponents: "vs Nina, Theo, QuietStorm",
      durationSeconds: 905,
      playedAt: ago(26),
      ratingDelta: -9,
      href: "/history/demo",
    },
    {
      id: "r3",
      gameId: "connect-four",
      gameName: "Connect Four",
      outcome: "draw",
      modeLabel: "vs AI · level 4",
      modeIcon: Bot,
      durationSeconds: 75,
      playedAt: ago(80),
      ratingDelta: null,
    },
    {
      id: "r4",
      gameId: null,
      gameName: "A game this build does not know",
      outcome: "win",
      modeLabel: "Pass & Play",
      modeIcon: UserRound,
      durationSeconds: 42,
      playedAt: ago(400),
      ratingDelta: 0,
    },
  ];
}

/** One rating per tier band, the top tier, and a game this build does not know. */
const RATINGS: GameRating[] = (
  [
    ["chess", "Chess", 1634, 1702, 41, 6],
    ["uno", "UNO", 2269, 2269, 88, 0],
    ["car-race", "Car Race", 980, 1040, 9, 1],
    ["connect-four", "Connect Four", 2420, 2455, 130, 12],
    ["retired-game", "A retired game", 1205, 1300, 20, 2],
  ] as const
).map(([gameSlug, gameName, rating, peakRating, wins, draws]) => ({
  gameSlug,
  gameName,
  rating,
  peakRating,
  gamesPlayed: wins * 2 + draws,
  wins,
  losses: wins,
  draws,
  rank: rankForRating(rating),
  toNextRank: ratingToNextRank(rating),
}));

const PLAYERS: Record<string, Player> = Object.fromEntries(
  ENTRIES.slice(0, 4).map((e, i) => [
    e.userId,
    {
      id: e.userId,
      userId: e.userId,
      username: e.username,
      displayName: e.displayName,
      avatarUrl: null,
      role: i === 0 ? "host" : "player",
      isReady: true,
      seatIndex: i,
      status: "connected",
      joinedAt: 0,
      lastPingAt: 0,
      isGuest: false,
    } as Player,
  ])
);
PLAYERS[ME_ID] = { ...PLAYERS["demo-0"]!, id: ME_ID, userId: ME_ID, displayName: ME.displayName };

function result(now: number, winner: string | null): GameResult {
  return {
    sessionId: "demo",
    roomId: "demo",
    gameId: "chess",
    winnerId: winner,
    scores: [ME_ID, "demo-1"].map((userId) => ({
      playerId: userId,
      userId,
      rank: winner === null || userId === winner ? 1 : 2,
      score: userId === winner ? 1 : 0,
      isWinner: userId === winner,
    })),
    durationSeconds: 1_312,
    completedAt: new Date(now).toISOString(),
    reason: winner === null ? "draw" : "resignation",
  };
}

/**
 * On the real XP curve: 940 XP is level 5 and 1010 is level 6, so the win
 * crosses a level and the loss (40 XP from 1010) stays inside one.
 */
function progression(won: boolean): Record<string, PlayerProgressionPayload> {
  const delta = won ? 14 : -9;
  return {
    [ME_ID]: {
      userId: ME_ID,
      outcome: won ? "win" : "loss",
      rated: true,
      ratingBefore: ME.rating,
      ratingAfter: ME.rating + delta,
      ratingDelta: delta,
      xpBefore: won ? 940 : 1_010,
      xpAfter: won ? 1_010 : 1_050,
      xpGained: won ? 70 : 40,
      levelBefore: won ? 5 : 6,
      levelAfter: 6,
      streak: won ? 3 : 0,
      bestStreak: 6,
      unlockedAchievements: won ? ACHIEVEMENTS.slice(0, 2).map((a) => a.id) : [],
    },
    "demo-1": {
      userId: "demo-1",
      outcome: won ? "loss" : "win",
      rated: true,
      ratingBefore: 2260,
      ratingAfter: 2260 - delta,
      ratingDelta: -delta,
      xpBefore: 0,
      xpAfter: 50,
      xpGained: 50,
      levelBefore: 12,
      levelAfter: 12,
      streak: 0,
      bestStreak: 9,
      unlockedAchievements: [],
    },
  };
}

export function PlatformPreview({ now }: { now: number }) {
  const unlocked = new Set(ACHIEVEMENTS.filter((_, i) => i % 3 === 0).map((a) => a.id));

  return (
    <PageContainer className="space-y-12">
      <PageHeader
        title="Platform preview"
        description="The platform pages' full states, on made-up data. Development only."
        action={<ThemeButtons />}
      />

      <section className="space-y-6" aria-labelledby="board-heading">
        <SectionHeader headingId="board-heading" title="Leaderboard" />
        <Podium entries={ENTRIES.slice(0, 3)} />
        <BoardTable entries={ENTRIES.slice(3)} caption="Rankings below the top three" />
        <div>
          <p className="mb-2 text-tag uppercase text-muted-foreground">Your standing</p>
          <BoardRow entry={{ ...ME, rank: 412 }} standalone />
        </div>
        <p className="text-sm text-muted-foreground">A board with two players:</p>
        <Podium entries={ENTRIES.slice(0, 2)} />
        <p className="text-sm text-muted-foreground">Loading:</p>
        <BoardSkeleton />
      </section>

      <section className="space-y-4" aria-labelledby="ranks-heading">
        <SectionHeader headingId="ranks-heading" title="Profile ranks" />
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          {RATINGS.map((r) => (
            <li key={r.gameSlug}>
              <RatingCard rating={r} />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4" aria-labelledby="ach-heading">
        <SectionHeader headingId="ach-heading" title="Achievements, earned and not" />
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ACHIEVEMENTS.map((a) => (
            <li key={a.id}>
              <AchievementBadge
                achievement={a}
                unlocked={unlocked.has(a.id)}
                unlockedAt={
                  unlocked.has(a.id) ? new Date(now - 86_400_000).toISOString() : undefined
                }
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4" aria-labelledby="rows-heading">
        <SectionHeader headingId="rows-heading" title="Match rows" />
        <ul className="space-y-2">
          {rows(now).map((item) => (
            <li key={item.id}>
              <MatchHistoryRow item={item} />
            </li>
          ))}
        </ul>
        <MatchHistorySkeleton rows={2} />
      </section>

      <section className="space-y-4" aria-labelledby="result-heading">
        <SectionHeader
          headingId="result-heading"
          title="Result card"
          description="What a finished online match shows: a rated win with a level-up and two achievements, a loss, and a draw."
        />
        <div className="grid gap-6 lg:grid-cols-3">
          <MatchResult
            result={result(now, ME_ID)}
            players={PLAYERS}
            currentUserId={ME_ID}
            progression={progression(true)}
            onRematch={() => {}}
            exitHref="/dev/platform"
          />
          <MatchResult
            result={result(now, "demo-1")}
            players={PLAYERS}
            currentUserId={ME_ID}
            progression={progression(false)}
            onRematch={() => {}}
            exitHref="/dev/platform"
          />
          <MatchResult result={result(now, null)} players={PLAYERS} currentUserId={ME_ID} />
        </div>
      </section>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-muted-foreground">
          The profile page needs a signed-in player; its preview fakes one in this tab.
        </p>
        <Button asChild variant="secondary" size="sm">
          <Link href="/dev/platform/profile">Signed-in profile</Link>
        </Button>
      </Card>
    </PageContainer>
  );
}

/** Flip the theme without leaving the page, to compare the two. */
function ThemeButtons() {
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => applyTheme("dark")}>
        <Moon className="h-4 w-4" aria-hidden />
        Dark
      </Button>
      <Button variant="outline" size="sm" onClick={() => applyTheme("light")}>
        <Sun className="h-4 w-4" aria-hidden />
        Light
      </Button>
    </>
  );
}
