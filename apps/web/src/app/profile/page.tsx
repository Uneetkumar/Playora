"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ACHIEVEMENTS } from "@playora/progression";
import { Avatar, Badge, Button, SectionHeader, Skeleton } from "@playora/ui";
import {
  Award,
  CalendarDays,
  ChevronRight,
  Flame,
  Gamepad2,
  History,
  LogOut,
  Settings,
  Swords,
  TrendingUp,
  Trophy,
  UserRound,
} from "lucide-react";
import { useAuthStore } from "../../lib/store/auth-store";
import { usePlayerProgression } from "../../hooks/use-progression";
import { useAchievements } from "../../hooks/use-achievements";
import { useMatchHistory } from "../../hooks/use-match-history";
import { useLocalHistory } from "../../hooks/use-local-history";
import { PageContainer, PageHeader } from "../../components/page/page-header";
import { EmptyState } from "../../components/page/empty-state";
import { ProgressBar, StatTile } from "../../components/page/stat";
import { RatingCard } from "./rating-card";
import { AchievementBadge } from "../../components/games/achievement-badge";
import {
  MatchHistoryRow,
  MatchHistorySkeleton,
  fromLocalMatch,
  fromOnlineMatch,
} from "../../components/games/match-history-row";
import { GoogleMark } from "../../components/auth/google-mark";

const RECENT = 5;
const ACHIEVEMENTS_SHOWN = 6;

export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoading: authLoading, signOut, linkGoogleAccount } = useAuthStore();
  const { data, isLoading, error } = usePlayerProgression(user?.id);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  // Signed out, the page still opens with its own h1, as every page does;
  // the empty state's line is a paragraph, not a heading.
  if (!authLoading && !user) {
    return (
      <PageContainer>
        <PageHeader icon={<UserRound />} title="Profile" />
        <EmptyState
          className="mx-auto mt-8 max-w-2xl"
          icon={<UserRound />}
          title="Sign in to see your profile"
          body="Your level, ratings and achievements live here. Playing as a guest keeps all of it, and you can link Google later."
          action={
            <Button asChild size="lg">
              <Link href="/login?next=/profile">Sign in or play as guest</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const loading = authLoading || isLoading;
  const displayName = user?.displayName ?? "Player";
  const level = data?.level;
  const memberSince = data?.memberSince ?? user?.createdAt ?? null;

  return (
    <PageContainer className="space-y-10">
      {/* ─── Hero ─── */}
      <section
        aria-label="Player"
        className="overflow-hidden rounded-3xl border border-border bg-card shadow-card"
      >
        <div
          className="relative h-28 overflow-hidden bg-gradient-to-br from-primary/40 via-primary/15 to-secondary/25 sm:h-36"
          aria-hidden
        >
          <div className="absolute -left-10 top-4 h-40 w-40 rounded-full bg-primary/30 blur-3xl" />
          <div className="absolute right-10 -top-16 h-48 w-48 rounded-full bg-secondary/25 blur-3xl" />
        </div>

        <div className="px-5 pb-6 sm:px-8 sm:pb-8">
          {/* Only the avatar crosses into the banner; the name sits on the card. */}
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:gap-5">
              {authLoading ? (
                <Skeleton className="-mt-12 h-24 w-24 shrink-0 rounded-full ring-4 ring-card sm:-mt-14 sm:h-28 sm:w-28" />
              ) : (
                <Avatar
                  src={user?.avatarUrl}
                  alt=""
                  aria-hidden
                  fallbackText={displayName}
                  className="-mt-12 h-24 w-24 text-2xl ring-4 ring-card sm:-mt-14 sm:h-28 sm:w-28 sm:text-3xl"
                />
              )}
              <div className="min-w-0 sm:pt-4">
                {authLoading ? (
                  <Skeleton className="h-8 w-48" />
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate font-display text-h1 text-foreground">{displayName}</h1>
                    {user?.isGuest ? (
                      <Badge variant="warning">Guest</Badge>
                    ) : (
                      <Badge variant="success">Google account</Badge>
                    )}
                  </div>
                )}
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span>@{user?.username ?? "player"}</span>
                  {memberSince && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                      Joined{" "}
                      {new Date(memberSince).toLocaleDateString(undefined, {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 md:pt-4">
              {user?.isGuest && (
                <Button onClick={() => void linkGoogleAccount()}>
                  <GoogleMark className="h-4 w-4" />
                  Link Google
                </Button>
              )}
              <Button asChild variant="secondary">
                <Link href="/settings">
                  <Settings className="h-4 w-4" aria-hidden />
                  Settings
                </Link>
              </Button>
              <Button variant="ghost" onClick={() => void handleSignOut()}>
                <LogOut className="h-4 w-4" aria-hidden />
                Sign out
              </Button>
            </div>
          </div>

          {/* Platform level: participation, deliberately separate from rating. */}
          <div className="mt-6 flex items-center gap-4 rounded-xl border border-border bg-surface/60 p-4">
            <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/15 text-primary-accent ring-1 ring-inset ring-primary/30">
              <span className="text-[9px] font-bold uppercase tracking-wider">Lvl</span>
              <span className="font-mono-num -mt-0.5 text-lg font-bold leading-none">
                {loading ? "–" : (level?.level ?? 1)}
              </span>
            </span>
            <div className="min-w-0 flex-1">
              {loading ? (
                <>
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="mt-3 h-2.5 w-full rounded-full" />
                </>
              ) : !level ? (
                <>
                  <p className="font-display text-sm font-bold text-foreground">Level 1</p>
                  <ProgressBar value={0} label="Level 1 progress" className="mt-2" />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Finish a match to start earning XP, won or lost.
                  </p>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-display text-sm font-bold text-foreground">
                      Level {level.level}
                    </span>
                    <span className="font-mono-num text-xs text-muted-foreground">
                      {level.xpIntoLevel} / {level.xpForNextLevel} XP
                    </span>
                  </div>
                  <ProgressBar
                    value={level.progress}
                    label={`Level ${level.level} progress`}
                    className="mt-2"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    <span className="font-mono-num font-bold text-foreground">
                      {Math.max(0, level.xpForNextLevel - level.xpIntoLevel)}
                    </span>{" "}
                    XP to level {level.level + 1}. Every finished match earns some, won or lost.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive-ink"
        >
          {error}
        </p>
      )}

      {/* ─── Numbers ─── */}
      <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {loading ? (
          Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[6.5rem] rounded-xl" />
          ))
        ) : (
          <>
            <StatTile icon={<Gamepad2 />} label="Games" value={data?.gamesPlayed ?? 0} />
            <StatTile
              icon={<Trophy />}
              label="Wins"
              value={data?.wins ?? 0}
              hint={data ? `${data.losses} losses · ${data.draws} draws` : undefined}
            />
            <StatTile
              icon={<TrendingUp />}
              label="Win rate"
              value={data && data.gamesPlayed > 0 ? `${Math.round(data.winRate * 100)}%` : "–"}
            />
            <StatTile
              icon={<Flame />}
              label="Streak"
              value={data?.currentStreak ?? 0}
              hint={data ? `Best ${data.bestStreak}` : undefined}
            />
          </>
        )}
      </section>

      {/* ─── Ranks ─── */}
      <section aria-labelledby="ranks-heading" className="space-y-4">
        <SectionHeader
          headingId="ranks-heading"
          title="Ranks"
          description="Each game is rated on its own: being strong at one says nothing about another."
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/leaderboard">
                Leaderboards
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          }
        />
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-44 rounded-xl" />
            ))}
          </div>
        ) : data && data.ratings.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
            {data.ratings.map((r) => (
              <li key={r.gameSlug}>
                <RatingCard rating={r} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            size="compact"
            icon={<Award />}
            title="No ranks yet"
            body="Play someone online to get a rating. Games against the AI and offline earn XP but stay unrated."
            action={
              <Button asChild>
                <Link href="/rooms">
                  <Swords className="h-4 w-4" aria-hidden />
                  Find an opponent
                </Link>
              </Button>
            }
          />
        )}
      </section>

      <RecentMatches userId={user?.id ?? null} />

      <AchievementsPreview userId={user?.id ?? null} />
    </PageContainer>
  );
}

/** The last few matches, online and on this device, newest first. */
function RecentMatches({ userId }: { userId: string | null }) {
  const { matches, isLoading } = useMatchHistory(userId, { limit: RECENT });
  const local = useLocalHistory({ limit: RECENT });

  const items = React.useMemo(
    () =>
      [...matches.map(fromOnlineMatch), ...local.map(fromLocalMatch)]
        .sort((a, b) => Date.parse(b.playedAt) - Date.parse(a.playedAt))
        .slice(0, RECENT),
    [matches, local]
  );

  return (
    <section aria-labelledby="recent-heading" className="space-y-4">
      <SectionHeader
        headingId="recent-heading"
        title="Recent matches"
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/history">
              All matches
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        }
      />
      {isLoading ? (
        <MatchHistorySkeleton rows={3} />
      ) : items.length === 0 ? (
        <EmptyState
          size="compact"
          icon={<History />}
          title="No matches yet"
          body="Finished games land here, online and offline alike."
          action={
            <Button asChild>
              <Link href="/games">Find a game</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <MatchHistoryRow item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Earned first, then the closest locked ones, up to a grid's worth. */
function AchievementsPreview({ userId }: { userId: string | null }) {
  const { progress, isLoading } = useAchievements(userId);
  const shown = [...progress.unlocked, ...progress.locked].slice(0, ACHIEVEMENTS_SHOWN);

  return (
    <section aria-labelledby="achievements-heading" className="space-y-4">
      <SectionHeader
        headingId="achievements-heading"
        title="Achievements"
        description={
          <>
            <span className="font-mono-num font-bold text-foreground">
              {progress.unlockedIds.length}
            </span>{" "}
            of {ACHIEVEMENTS.length} unlocked ·{" "}
            <span className="font-mono-num font-bold text-foreground">{progress.points}</span>{" "}
            points
          </>
        }
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/achievements">
              See all
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        }
      />
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: ACHIEVEMENTS_SHOWN }, (_, i) => (
            <Skeleton key={i} className="h-[4.5rem] rounded-xl" />
          ))}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((achievement) => (
            <li key={achievement.id}>
              <AchievementBadge
                achievement={achievement}
                unlocked={progress.unlockedIds.includes(achievement.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
