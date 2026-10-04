"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { LevelProgress } from "@playora/progression";
import { Skeleton, cn, focusRingClass } from "@playora/ui";
import { useAuthStore } from "../../lib/store/auth-store";
import { usePlayerProgression } from "../../hooks/use-progression";

/**
 * A signed-in player's level, slim enough to share a row with the genre
 * chips: a ring that fills with XP around the level number, and on wider
 * screens the numbers beside it. The whole thing links to the profile.
 *
 * It replaces the home page's old sidebar card, which invented progress for
 * everyone who was not signed in (a third of a bar and "150 / 500 XP"). A
 * guest sees nothing here; a player whose level is still loading sees a
 * placeholder of the same size, so the chips beside it do not jump.
 */
export function PlayerStatus({ className }: { className?: string }) {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = usePlayerProgression(user?.id);

  if (!user) return null;

  if (isLoading || !data) {
    // A failed read has nothing honest to show, so it shows nothing.
    if (!isLoading) return null;
    return (
      <Skeleton
        aria-hidden
        className={cn("h-11 w-11 shrink-0 rounded-full sm:w-[11.5rem]", className)}
      />
    );
  }

  return <PlayerStatusLink progress={data.level} className={className} />;
}

/** The pill itself, for a level already in hand. */
export function PlayerStatusLink({
  progress,
  className,
}: {
  progress: LevelProgress;
  className?: string;
}) {
  const { level, xpIntoLevel, xpForNextLevel } = progress;
  const percent = Math.round(Math.min(1, Math.max(0, progress.progress)) * 100);

  return (
    <Link
      href="/profile"
      aria-label={`Level ${level}, ${xpIntoLevel} of ${xpForNextLevel} XP to the next level. Open your profile`}
      className={cn(
        "group flex h-11 shrink-0 items-center gap-2.5 rounded-full border border-border bg-card p-0.5 shadow-card sm:pr-3",
        "transition-colors duration-hover ease-out-expo hover:bg-foreground/[0.04]",
        focusRingClass,
        className
      )}
    >
      <LevelRing level={level} percent={percent} />
      <span aria-hidden className="hidden min-w-0 flex-col sm:flex">
        <span className="text-xs font-semibold leading-tight text-foreground">Level {level}</span>
        <span className="numeric text-xs leading-tight text-muted-foreground">
          {xpIntoLevel.toLocaleString("en")} / {xpForNextLevel.toLocaleString("en")} XP
        </span>
      </span>
      <ChevronRight
        aria-hidden
        className="hidden h-4 w-4 shrink-0 text-muted-foreground transition-colors duration-hover ease-out-expo group-hover:text-foreground sm:block"
      />
    </Link>
  );
}

/** The level number inside a ring that fills clockwise from the top. */
function LevelRing({ level, percent }: { level: number; percent: number }) {
  // r = 17 in a 40-unit box leaves room for the 3-unit stroke.
  const circumference = 2 * Math.PI * 17;
  return (
    <span aria-hidden className="relative grid h-10 w-10 shrink-0 place-items-center">
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
        <circle cx="20" cy="20" r="17" fill="none" strokeWidth="3" className="stroke-muted" />
        <circle
          cx="20"
          cy="20"
          r="17"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
          className="stroke-primary transition-[stroke-dashoffset] duration-sheet ease-out-expo"
        />
      </svg>
      <span className="numeric text-sm font-bold text-foreground">{level}</span>
    </span>
  );
}
