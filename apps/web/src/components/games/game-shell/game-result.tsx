"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { SPRING } from "@playora/animation";
import type { SoundId } from "@playora/audio";
import { Badge, Button, cn } from "@playora/ui";
import { ArrowLeft, ChevronRight, Flag, Handshake, Medal, RotateCcw, Trophy } from "lucide-react";
import { useAudio } from "../../../lib/audio/use-audio";
import { useCountUp, useReducedMotionPref } from "../../../lib/motion";

/** How a match against someone ended, in the words match history stores. */
export type MatchOutcome = "win" | "loss" | "draw";

/** A match outcome, or `score` for a solo run measured by its number. */
export type GameResultOutcome = MatchOutcome | "score";

export interface GameResultStat {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}

export interface GameResultProps {
  /** Win, loss or draw against someone; `score` for a solo run measured by its number. */
  outcome: GameResultOutcome;
  /** Defaults by outcome: "You win!", "You lose", "It's a draw", "Game over". */
  title?: React.ReactNode;
  /** The big number. Counts up when it is a number; a string (a lap time) is shown as is. */
  score?: number | string;
  scoreLabel?: string;
  formatScore?: (score: number) => string;
  /** Short lines under the title: how it ended, what was close. */
  lines?: React.ReactNode[];
  stats?: GameResultStat[];
  /** The personal best before this game. With `isNewBest` false, shown as the number to beat. */
  best?: number;
  isNewBest?: boolean;
  onPlayAgain?: () => void;
  playAgainLabel?: string;
  onNext?: () => void;
  nextLabel?: string;
  onBack?: () => void;
  backLabel?: string;
  /**
   * `overlay` covers its positioned parent with a scrim and centres the
   * panel; `inline` is just the panel, for a parent that places it.
   */
  layout?: "overlay" | "inline";
  /** Moves focus to the panel when it appears, so Tab reaches Play again next. */
  autoFocus?: boolean;
  /**
   * Plays the outcome's sting on mount, as MatchResult does: victory, defeat
   * or draw. A `score` run has none. Turn off when the game already played
   * its own.
   */
  sound?: boolean;
  /** Anything game-specific (stars, a replay link), between the lines and the stats. */
  children?: React.ReactNode;
  className?: string;
}

const COPY: Record<GameResultOutcome, string> = {
  win: "You win!",
  loss: "You lose",
  draw: "It's a draw",
  score: "Game over",
};

/*
 * Shared with MatchResult, so the two end screens colour, illustrate and
 * sound an outcome the same way.
 */
export const RESULT_TONE: Record<GameResultOutcome, { text: string; glow: string }> = {
  win: { text: "text-success", glow: "from-success/25" },
  loss: { text: "text-destructive", glow: "from-destructive/20" },
  draw: { text: "text-warning", glow: "from-warning/20" },
  score: { text: "text-foreground", glow: "from-game-accent-soft" },
};

export const RESULT_ICON: Record<GameResultOutcome, React.ComponentType<{ className?: string }>> = {
  win: Trophy,
  loss: Flag,
  draw: Handshake,
  score: Medal,
};

export const RESULT_SOUND: Record<GameResultOutcome, SoundId | null> = {
  win: "match.victory",
  loss: "match.defeat",
  draw: "match.draw",
  score: null,
};

const defaultFormat = (n: number) => Math.round(n).toLocaleString("en-US");

/**
 * The end-of-game panel every game shares: the verdict, the number, how it
 * compares with the best, a few stats, then Play again.
 *
 * Games each drew their own win banner, so the same moment looked different
 * in every title and most of them buried the one thing a player wants next,
 * another go. Play again is the green Play button because on this screen it
 * is the one action that starts a game.
 *
 * The panel is a non-modal dialog: the finished board stays readable behind
 * the scrim, and a screen reader hears the verdict when focus moves here.
 *
 * Named `GameResultPanel` because `GameResult` is already the result *data*
 * type in @playora/game-types, which the online views import.
 */
export function GameResultPanel({
  outcome,
  title,
  score,
  scoreLabel = "Score",
  formatScore = defaultFormat,
  lines,
  stats,
  best,
  isNewBest = false,
  onPlayAgain,
  playAgainLabel = "Play again",
  onNext,
  nextLabel = "Next",
  onBack,
  backLabel = "Back",
  layout = "overlay",
  autoFocus = true,
  sound = true,
  children,
  className,
}: GameResultProps) {
  const reduced = useReducedMotionPref();
  const titleId = React.useId();
  const panelRef = React.useRef<HTMLElement>(null);
  const tone = RESULT_TONE[outcome];
  const Icon = isNewBest ? Trophy : RESULT_ICON[outcome];

  const numeric = typeof score === "number" ? score : null;
  const shown = useCountUp(numeric ?? 0);

  React.useEffect(() => {
    if (autoFocus) panelRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  // The panel mounts once per finished game, so mount is the moment.
  const play = useAudio();
  React.useEffect(() => {
    const id = RESULT_SOUND[outcome];
    if (sound && id) play(id);
  }, [sound, outcome, play]);

  const chase =
    numeric !== null && best !== undefined && best > 0 && !isNewBest
      ? { best, gap: best - numeric }
      : null;

  const panel = (
    <motion.section
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      initial={reduced ? false : { opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={reduced ? { duration: 0 } : SPRING.panel}
      className={cn(
        "relative w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card p-6 text-center text-card-foreground shadow-overlay",
        "focus:outline-none",
        className,
      )}
    >
      <div
        className={cn("pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b to-transparent", tone.glow)}
        aria-hidden
      />

      <div className="relative">
        <div
          className={cn(
            "mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-background/60",
            isNewBest ? "text-reward" : outcome === "score" ? "game-accent" : tone.text,
          )}
          aria-hidden
        >
          <Icon className="h-7 w-7" />
        </div>

        {isNewBest && (
          <Badge variant="top" className="mt-3">
            New best
          </Badge>
        )}

        <h2 id={titleId} className={cn("mt-3 font-display text-h1", tone.text)}>
          {title ?? COPY[outcome]}
        </h2>

        {score !== undefined && (
          <p className="mt-3">
            <span className="sr-only">
              {scoreLabel}: {numeric !== null ? formatScore(numeric) : score}
            </span>
            <span aria-hidden className="block font-mono-num text-5xl font-bold leading-none tracking-tight">
              {numeric !== null ? formatScore(shown) : score}
            </span>
            <span aria-hidden className="mt-2 block text-tag uppercase text-muted-foreground">
              {scoreLabel}
            </span>
          </p>
        )}

        {chase && (
          <p className="mt-2 text-sm text-muted-foreground">
            {chase.gap > 0 ? (
              <>
                Best <span className="font-mono-num text-foreground">{formatScore(chase.best)}</span>
                {" · "}
                <span className="font-mono-num">{formatScore(chase.gap)}</span> to beat it
              </>
            ) : (
              <>
                Matched your best of{" "}
                <span className="font-mono-num text-foreground">{formatScore(chase.best)}</span>
              </>
            )}
          </p>
        )}

        {lines?.map((line, i) => (
          <p key={i} className="mt-2 text-sm text-muted-foreground">
            {line}
          </p>
        ))}

        {children}

        {stats && stats.length > 0 && (
          <dl
            className={cn(
              "mt-5 grid gap-2",
              stats.length % 3 === 0 ? "grid-cols-3" : stats.length === 1 ? "grid-cols-1" : "grid-cols-2",
            )}
          >
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-border bg-background/60 px-2 py-2.5">
                <dt className="text-tag uppercase text-muted-foreground">{stat.label}</dt>
                <dd className="mt-1 flex items-center justify-center gap-1 font-mono-num text-lg font-bold leading-none">
                  {stat.icon}
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {(onPlayAgain || onNext || onBack) && (
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            {onPlayAgain && (
              <Button variant="play" size="lg" className="flex-1" onClick={onPlayAgain}>
                <RotateCcw className="h-4 w-4" aria-hidden />
                {playAgainLabel}
              </Button>
            )}
            {onNext && (
              <Button variant="secondary" size="lg" className="flex-1" onClick={onNext}>
                {nextLabel}
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            )}
            {onBack && (
              <Button variant="outline" size="lg" className="flex-1" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" aria-hidden />
                {backLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    </motion.section>
  );

  if (layout === "inline") return panel;

  return (
    <div className="absolute inset-0 z-20 flex overflow-y-auto bg-background/75 p-4 backdrop-blur-sm">
      {/* m-auto rather than items-center: a panel taller than its parent then scrolls from its top instead of losing it. */}
      <div className="m-auto flex w-full justify-center">{panel}</div>
    </div>
  );
}
