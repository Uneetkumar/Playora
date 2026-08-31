"use client";

import * as React from "react";
import Link from "next/link";
import { Badge, Card, LoadingState, buttonVariants, cn } from "@playora/ui";
import { ACHIEVEMENTS, type AchievementTier } from "@playora/progression";
import { Award, Lock } from "lucide-react";
import { useAuthStore } from "../../lib/store/auth-store";
import { useAchievements } from "../../hooks/use-achievements";
import { AchievementBadge, TIER_STYLES } from "../../components/games/achievement-badge";

const TIERS: AchievementTier[] = ["bronze", "silver", "gold", "platinum"];

export default function AchievementsPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const { progress, isLoading } = useAchievements(user?.id);
  const [filter, setFilter] = React.useState<"all" | "unlocked" | "locked">("all");

  const shown =
    filter === "unlocked"
      ? progress.unlocked
      : filter === "locked"
        ? progress.locked
        : [...ACHIEVEMENTS];

  const pct =
    progress.totalPoints > 0 ? Math.round((progress.points / progress.totalPoints) * 100) : 0;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-extrabold text-foreground sm:text-4xl">
          Achievements
        </h1>
        <p className="mt-1 text-muted-foreground">
          Most of these are for playing rather than winning.
        </p>
      </header>

      {authLoading || isLoading ? (
        <LoadingState title="Loading your achievements" />
      ) : (
        <>
          <Card className="border-border bg-card p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Points
                </p>
                <p className="numeric font-display text-3xl font-black text-foreground">
                  {progress.points}
                  <span className="text-base font-medium text-muted-foreground">
                    {" / "}
                    {progress.totalPoints}
                  </span>
                </p>
              </div>
              <p className="numeric text-sm text-muted-foreground">
                {progress.unlockedIds.length} of {ACHIEVEMENTS.length} unlocked
              </p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-[width] duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-xs">
              {TIERS.map((tier) => {
                const total = ACHIEVEMENTS.filter((a) => a.tier === tier).length;
                const have = progress.unlocked.filter((a) => a.tier === tier).length;
                return (
                  <span key={tier} className="inline-flex items-center gap-1.5">
                    <span
                      className={cn("h-2.5 w-2.5 rounded-full border", TIER_STYLES[tier].ring)}
                      aria-hidden
                    />
                    <span className="text-muted-foreground">
                      {TIER_STYLES[tier].label}{" "}
                      <span className="numeric">
                        {have}/{total}
                      </span>
                    </span>
                  </span>
                );
              })}
            </div>
          </Card>

          {!user && (
            <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              You are not signed in, so nothing is being recorded yet. Playing a game creates a
              guest account automatically and your achievements start counting from there.
            </p>
          )}

          <div className="mt-6 flex gap-2">
            {(["all", "unlocked", "locked"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                aria-pressed={filter === id}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
                  filter === id
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {id}
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
              {filter === "unlocked" ? (
                <Award className="h-8 w-8 text-muted-foreground" aria-hidden />
              ) : (
                <Lock className="h-8 w-8 text-muted-foreground" aria-hidden />
              )}
              <p className="font-display text-lg font-bold text-foreground">
                {filter === "unlocked" ? "Nothing unlocked yet" : "Everything unlocked"}
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {filter === "unlocked"
                  ? "Finish a game — the first one unlocks two on its own."
                  : "There is nothing left to earn. More will be added."}
              </p>
              {filter === "unlocked" && (
                <Link href="/games" className={cn(buttonVariants({ size: "sm" }))}>
                  Find a game
                </Link>
              )}
            </div>
          ) : (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {shown.map((achievement) => (
                <li key={achievement.id}>
                  <AchievementBadge
                    achievement={achievement}
                    unlocked={progress.unlockedIds.includes(achievement.id)}
                  />
                  {progress.unlockedAt[achievement.id] && (
                    <span className="sr-only">
                      Unlocked {new Date(progress.unlockedAt[achievement.id]!).toLocaleDateString()}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="shrink-0 text-[10px]">
              How they work
            </Badge>
            <span>
              Achievements are awarded by the server after a match, from the result it decided.
              Nothing a client sends can unlock one.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
