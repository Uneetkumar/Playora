"use client";

import * as React from "react";
import { Badge, Card, LoadingState, cn } from "@playora/ui";
import type { GameId } from "@playora/game-types";
import { Lock, Star, Trophy, Users, Flag, Zap } from "lucide-react";
import { useRaceProgress } from "../../lib/racing/use-race-progress";
import type { RaceLevel } from "@playora/game-engine";

interface LevelSelectProps {
  gameId: GameId;
  onStart: (level: RaceLevel) => void;
}

/**
 * The career ladder.
 *
 * A locked level says exactly what would open it, rather than being greyed out
 * with no explanation — "finish 2nd or better in Neon Mile" is a goal, a
 * padlock on its own is a wall.
 */
export function LevelSelect({ gameId, onStart }: LevelSelectProps) {
  const { levels, hydrated, isUnlocked, stars, totalStars } = useRaceProgress(gameId);

  if (!hydrated) {
    return <LoadingState title="Loading your progress" />;
  }

  const maxStars = levels.length * 3;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-extrabold text-foreground">Career</h2>
          <p className="text-sm text-muted-foreground">
            Finish a level to open the next one.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-warning/40 bg-warning/10 px-3 py-1.5">
          <Star className="h-4 w-4 fill-warning text-warning" aria-hidden />
          <span className="numeric text-sm font-bold text-foreground">
            {totalStars}
            <span className="text-muted-foreground">/{maxStars}</span>
          </span>
        </div>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {levels.map((level) => {
          const unlocked = isUnlocked(level);
          const earned = stars(level);
          const previous = levels[level.index - 2];

          return (
            <li key={level.index}>
              <Card
                className={cn(
                  "flex h-full flex-col gap-3 border-border bg-card p-4 transition-colors",
                  unlocked ? "hover:border-primary/50" : "opacity-70",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="numeric flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-sm font-black text-primary">
                        {level.index}
                      </span>
                      <h3 className="truncate font-display text-base font-bold text-foreground">
                        {level.name}
                      </h3>
                    </div>
                  </div>
                  {unlocked ? (
                    <Stars earned={earned} />
                  ) : (
                    <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  {unlocked
                    ? level.blurb
                    : previous
                      ? `Finish ${ordinal(previous.targetPlace)} or better in ${previous.name} to unlock.`
                      : "Locked."}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    <Flag className="h-3 w-3" aria-hidden />
                    {(level.trackLength / 1000).toFixed(1)} km
                  </Badge>
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    <Users className="h-3 w-3" aria-hidden />
                    {level.opponents}
                  </Badge>
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    <Zap className="h-3 w-3" aria-hidden />
                    {level.nitroCharges}×
                  </Badge>
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    <Trophy className="h-3 w-3" aria-hidden />
                    {ordinal(level.targetPlace)}
                  </Badge>
                </div>

                <button
                  type="button"
                  disabled={!unlocked}
                  onClick={() => onStart(level)}
                  className={cn(
                    "mt-auto rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                    unlocked
                      ? "bg-primary text-white hover:bg-primary/90"
                      : "cursor-not-allowed bg-muted text-muted-foreground",
                  )}
                >
                  {!unlocked ? "Locked" : earned > 0 ? "Race again" : "Start"}
                </button>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Stars({ earned, size = "sm" }: { earned: number; size?: "sm" | "lg" }) {
  const box = size === "lg" ? "h-6 w-6" : "h-3.5 w-3.5";
  return (
    <span className="flex shrink-0 gap-0.5" aria-label={`${earned} of 3 stars`}>
      {[1, 2, 3].map((n) => (
        <Star
          key={n}
          className={cn(
            box,
            n <= earned ? "fill-warning text-warning" : "text-muted-foreground/40",
          )}
          aria-hidden
        />
      ))}
    </span>
  );
}

function ordinal(place: number): string {
  if (place === 1) return "1st";
  if (place === 2) return "2nd";
  if (place === 3) return "3rd";
  return `${place}th`;
}
