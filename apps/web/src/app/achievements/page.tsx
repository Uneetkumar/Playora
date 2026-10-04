"use client";

import * as React from "react";
import Link from "next/link";
import { ACHIEVEMENTS, type AchievementTier } from "@playora/progression";
import { Button, Card, Skeleton, ToggleGroup, ToggleGroupItem, cn } from "@playora/ui";
import { Award, Info, Lock, LockOpen, Sparkles, UserRound } from "lucide-react";
import { useAuthStore } from "../../lib/store/auth-store";
import { useAchievements } from "../../hooks/use-achievements";
import { AchievementBadge, TIER_STYLES } from "../../components/games/achievement-badge";
import { PageContainer, PageHeader } from "../../components/page/page-header";
import { EmptyState } from "../../components/page/empty-state";
import { ProgressBar } from "../../components/page/stat";

const TIERS: AchievementTier[] = ["bronze", "silver", "gold", "platinum"];

type Filter = "all" | "unlocked" | "locked";

export default function AchievementsPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const { progress, isLoading } = useAchievements(user?.id);
  const [filter, setFilter] = React.useState<Filter>("all");

  // Earned ones lead in "All": what you have is more interesting than what
  // you do not, and it is the order the profile preview uses too.
  const shown =
    filter === "unlocked"
      ? progress.unlocked
      : filter === "locked"
        ? progress.locked
        : [...progress.unlocked, ...progress.locked];

  const loading = authLoading || isLoading;
  const fraction = progress.totalPoints > 0 ? progress.points / progress.totalPoints : 0;

  return (
    <PageContainer className="space-y-8">
      <PageHeader
        icon={<Award />}
        title="Achievements"
        description="Most of these are for playing rather than winning. The server awards them after a match, from the result it decided."
        action={
          <Button asChild>
            <Link href="/games">Find a game</Link>
          </Button>
        }
      />

      {/* ─── Summary ─── */}
      <Card className="p-5 sm:p-6">
        {loading ? (
          <div className="space-y-4" role="status" aria-live="polite">
            <span className="sr-only">Loading your achievements</span>
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-2.5 w-full rounded-full" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-tag uppercase text-muted-foreground">Points</p>
                <p className="mt-1 font-display text-4xl font-extrabold leading-none text-foreground">
                  <span className="font-mono-num">{progress.points}</span>
                  <span className="font-mono-num text-lg font-medium text-muted-foreground">
                    {" / "}
                    {progress.totalPoints}
                  </span>
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-mono-num font-bold text-foreground">
                  {progress.unlockedIds.length}
                </span>{" "}
                of <span className="font-mono-num">{ACHIEVEMENTS.length}</span> unlocked
              </p>
            </div>
            <ProgressBar value={fraction} label="Achievement points earned" className="mt-4" />

            <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TIERS.map((tier) => {
                const total = ACHIEVEMENTS.filter((a) => a.tier === tier).length;
                const have = progress.unlocked.filter((a) => a.tier === tier).length;
                return (
                  <li
                    key={tier}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface/60 px-3 py-2"
                  >
                    <span className="flex items-center gap-2 text-sm text-foreground">
                      <span
                        className={cn("h-2.5 w-2.5 rounded-full", TIER_STYLES[tier].dot)}
                        aria-hidden
                      />
                      {TIER_STYLES[tier].label}
                    </span>
                    <span className="font-mono-num text-sm text-muted-foreground">
                      <span className="font-bold text-foreground">{have}</span>/{total}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>

      {!loading && !user && (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/[0.08] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-3 text-sm text-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary-accent" aria-hidden />
            You are not signed in, so nothing is being recorded yet. Playing as a guest starts the
            count, and you can link Google later.
          </p>
          <Button asChild variant="secondary" size="sm" className="shrink-0">
            <Link href="/login?next=/achievements">
              <UserRound className="h-4 w-4" aria-hidden />
              Sign in
            </Link>
          </Button>
        </div>
      )}

      {/* ─── List ─── */}
      <section aria-label="Achievement list" className="space-y-4">
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(v) => v && setFilter(v as Filter)}
          aria-label="Show"
          className="w-full sm:w-auto"
        >
          <ToggleGroupItem value="all" className="flex-1 sm:flex-none">
            <Sparkles aria-hidden />
            All
            <span className="font-mono-num text-xs opacity-80">{ACHIEVEMENTS.length}</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="unlocked" className="flex-1 sm:flex-none">
            <LockOpen aria-hidden />
            Unlocked
            <span className="font-mono-num text-xs opacity-80">{progress.unlocked.length}</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="locked" className="flex-1 sm:flex-none">
            <Lock aria-hidden />
            Locked
            <span className="font-mono-num text-xs opacity-80">{progress.locked.length}</span>
          </ToggleGroupItem>
        </ToggleGroup>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }, (_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          filter === "unlocked" ? (
            <EmptyState
              icon={<Award />}
              title="Nothing unlocked yet"
              body="Finish a game: the first one unlocks two on its own."
              action={
                <Button asChild>
                  <Link href="/games">Find a game</Link>
                </Button>
              }
            />
          ) : (
            <EmptyState
              tone="success"
              icon={<LockOpen />}
              title="Everything unlocked"
              body="There is nothing left to earn. More will be added."
            />
          )
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((achievement) => (
              <li key={achievement.id}>
                <AchievementBadge
                  achievement={achievement}
                  unlocked={progress.unlockedIds.includes(achievement.id)}
                  unlockedAt={progress.unlockedAt[achievement.id]}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}
