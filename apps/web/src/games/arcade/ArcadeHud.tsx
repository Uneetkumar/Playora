"use client";

import * as React from "react";
import { cn } from "@playora/ui";
import { Flame, Trophy } from "lucide-react";
import { GameResultPanel } from "../../components/games/game-shell";
import { formatScore } from "./scoring";
import type { ArcadeRun } from "./use-arcade-run";

/**
 * The score readout every arcade game shares.
 *
 * One component rather than ten, because these games previously each drew
 * their own — where they drew one at all — and a player moving between them
 * had to relearn where the number lived every time.
 *
 * The personal best sits next to the live score on purpose. A score with
 * nothing beside it is just a number; a score beside the one to beat is a goal,
 * and that is the whole difference between one round and five.
 *
 * Numbers are in the mono face so a score that ticks up does not shuffle the
 * boxes sideways. `size="sm"` is a single-line strip for GameShell's top bar;
 * the default stacks label over number for laying over the play field.
 */
export function ArcadeHud({
  run,
  className,
  size = "md",
}: {
  run: ArcadeRun;
  className?: string;
  size?: "md" | "sm";
}) {
  const chasing = run.best > 0 && run.score < run.best;
  const compact = size === "sm";

  return (
    <div className={cn("flex items-center", compact ? "gap-1.5" : "gap-2 sm:gap-3", className)}>
      <HudCell label="Score" compact={compact}>
        {formatScore(run.score)}
      </HudCell>

      {run.best > 0 && (
        <HudCell
          label={chasing ? "Best" : "Ahead"}
          icon={<Trophy className="h-2.5 w-2.5 text-reward" aria-hidden />}
          compact={compact}
          // Passed it mid-run: say so immediately rather than saving the news
          // for the result screen.
          className={chasing ? undefined : "border-reward/60 bg-reward/15"}
        >
          {formatScore(run.best)}
        </HudCell>
      )}

      {run.combo >= 2 && (
        <div
          className={cn(
            "flex items-center gap-1 border border-streak/60 bg-streak/15 backdrop-blur-md",
            compact ? "h-8 rounded-full px-2.5" : "rounded-xl px-3 py-1.5",
          )}
          // Announced politely: a combo counter that interrupts a screen reader
          // on every hit is unusable.
          aria-live="polite"
        >
          <Flame className="h-3.5 w-3.5 text-streak" aria-hidden />
          <span
            className={cn(
              "font-mono-num font-bold leading-none text-foreground",
              compact ? "text-sm" : "text-lg sm:text-xl",
            )}
          >
            {run.combo}
          </span>
          <span className="text-tag uppercase text-muted-foreground">Chain</span>
        </div>
      )}
    </div>
  );
}

function HudCell({
  label,
  icon,
  compact,
  className,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  compact: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  if (compact) {
    return (
      <div
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-full border border-border bg-card/70 px-2.5",
          className,
        )}
      >
        <span className="flex items-center gap-1 text-tag uppercase text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className="font-mono-num text-sm font-bold leading-none text-foreground">{children}</span>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "rounded-xl border border-border/70 bg-background/70 px-3 py-1.5 backdrop-blur-md transition-colors duration-hover ease-out-expo",
        className,
      )}
    >
      <div className="flex items-center gap-1 text-tag uppercase text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="font-mono-num text-lg font-bold leading-none text-foreground sm:text-xl">
        {children}
      </div>
    </div>
  );
}

/**
 * The end-of-run panel every arcade game shares, as the shared GameResultPanel.
 *
 * Leads with whether the best was beaten, because that is the only question a
 * player has at the end of a run: a beaten best turns the icon into a gold
 * trophy with a NEW BEST badge above the title, so the title can still say
 * how the run ended.
 */
export function ArcadeResult({
  run,
  onRestart,
  onExit,
  title = "Run over",
}: {
  run: ArcadeRun;
  onRestart: () => void;
  onExit?: () => void;
  title?: string;
}) {
  return (
    <GameResultPanel
      outcome="score"
      title={title}
      score={run.score}
      formatScore={formatScore}
      best={run.best}
      isNewBest={run.isNewBest}
      stats={run.bestCombo >= 2 ? [{ label: "Longest chain", value: run.bestCombo }] : undefined}
      onPlayAgain={onRestart}
      onBack={onExit}
    />
  );
}
