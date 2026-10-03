"use client";

import * as React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { SPRING } from "@playora/animation";
import { Button, Badge, buttonVariants, cn } from "@playora/ui";
import { ACHIEVEMENTS_BY_ID, levelProgress, rankForRating } from "@playora/progression";
import type { PlayerProgressionPayload } from "@playora/protocol";
import type { GameResult, Player } from "@playora/game-types";
import { Trophy, RotateCcw, Home, Flame, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useAudio } from "../../lib/audio/use-audio";
import { useCountUp, useReducedMotionPref } from "../../lib/motion";
import { AchievementBadge } from "./achievement-badge";
import {
  RESULT_ICON,
  RESULT_SOUND,
  RESULT_TONE,
  type MatchOutcome,
} from "./game-shell/game-result";

export type { MatchOutcome };

interface MatchResultProps {
  result: GameResult;
  players: Record<string, Player>;
  currentUserId: string;
  /** Rating and XP, keyed by user id. Absent for unrated and offline games. */
  progression?: Record<string, PlayerProgressionPayload> | null;
  /** Offered when a rematch is possible; omitted for a finished offline game. */
  onRematch?: () => void;
  rematchLabel?: string;
  /** Disabled while waiting on the other player to accept. */
  rematchPending?: boolean;
  onExit?: () => void;
  exitHref?: string;
}

const OUTCOME_COPY: Record<MatchOutcome, { title: string; sub: string }> = {
  win: { title: "Victory", sub: "Well played." },
  loss: { title: "Defeat", sub: "Close one — go again?" },
  draw: { title: "Draw", sub: "Nobody blinked." },
};

const REASON_COPY: Record<string, string> = {
  normal: "Played to the end",
  resignation: "Won by resignation",
  timeout: "Won on time",
  disconnect: "Opponent disconnected",
  draw: "Agreed draw",
};

export function outcomeFor(result: GameResult, userId: string): MatchOutcome {
  if (result.reason === "draw" || result.winnerId === null) return "draw";
  return result.winnerId === userId ? "win" : "loss";
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/**
 * Counts up to a number, because a rating change that simply appears reads as a
 * label rather than something the player earned.
 */
function CountUp({ to, from = 0 }: { to: number; from?: number }) {
  const value = useCountUp(to, { from, durationMs: 900 });
  return <span className="font-mono-num">{Math.round(value)}</span>;
}

export function MatchResult({
  result,
  players,
  currentUserId,
  progression,
  onRematch,
  rematchLabel = "Rematch",
  rematchPending = false,
  onExit,
  exitHref,
}: MatchResultProps) {
  const reduced = useReducedMotionPref();
  const outcome = outcomeFor(result, currentUserId);
  const copy = OUTCOME_COPY[outcome];
  const mine = progression?.[currentUserId] ?? null;

  // The result screen mounts exactly once per finished match, so mount is the
  // right moment for the fanfare. Keyed on the session so a rematch re-fires it.
  const play = useAudio();
  React.useEffect(() => {
    const id = RESULT_SOUND[outcome];
    if (id) play(id);
  }, [play, outcome]);

  // Ids come from the server; anything the client does not recognise is simply
  // not shown, so an older client never renders a blank row for a new award.
  const unlocked = React.useMemo(
    () =>
      (mine?.unlockedAchievements ?? [])
        .map((id) => ACHIEVEMENTS_BY_ID[id])
        .filter((a): a is NonNullable<typeof a> => Boolean(a)),
    [mine],
  );

  const levelledUp = mine !== null && mine.levelAfter > mine.levelBefore;
  React.useEffect(() => {
    if (!levelledUp) return;
    // After the fanfare, not over it.
    const timer = setTimeout(() => play("match.levelup"), 900);
    return () => clearTimeout(timer);
  }, [levelledUp, play]);

  const { text: accent, glow } = RESULT_TONE[outcome];
  const Icon = RESULT_ICON[outcome];

  const ordered = [...(result.scores ?? [])].sort((a, b) => a.rank - b.rank);

  const spring = reduced ? { duration: 0 } : SPRING.panel;

  return (
    <motion.div
      role="dialog"
      aria-modal="false"
      aria-label={`${copy.title}. ${copy.sub}`}
      initial={reduced ? false : { opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring}
      className="relative mx-auto w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-overlay"
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b to-transparent",
          glow,
        )}
        aria-hidden
      />

      <div className="relative px-6 pb-6 pt-8 text-center">
        <motion.div
          initial={reduced ? false : { scale: 0.5, rotate: -12, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={reduced ? { duration: 0 } : { ...spring, delay: 0.08 }}
          className={cn(
            "mx-auto flex h-16 w-16 items-center justify-center rounded-xl border border-border bg-background/60",
            accent,
          )}
        >
          <Icon className="h-8 w-8" aria-hidden />
        </motion.div>

        <h2 className={cn("mt-4 font-display text-4xl font-extrabold tracking-tight", accent)}>
          {copy.title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{copy.sub}</p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Badge variant="secondary">{REASON_COPY[result.reason] ?? "Finished"}</Badge>
          <Badge variant="outline">{formatDuration(result.durationSeconds)}</Badge>
          {mine && !mine.rated && <Badge variant="outline">Unrated</Badge>}
        </div>
      </div>

      {/* Scoreboard */}
      <div className="border-t border-border px-6 py-4">
        <ul className="space-y-2">
          {ordered.map((score, i) => {
            const player = players[score.userId] ?? players[score.playerId];
            const isMe = score.userId === currentUserId;
            const theirs = progression?.[score.userId];
            return (
              <motion.li
                key={score.playerId}
                initial={reduced ? false : { opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={reduced ? { duration: 0 } : { delay: 0.15 + i * 0.07 }}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border px-3 py-2",
                  isMe ? "border-primary/40 bg-primary/5" : "border-border/60",
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="font-mono-num w-5 text-sm text-muted-foreground">{score.rank}</span>
                  <span className="truncate text-sm font-medium text-foreground">
                    {player?.displayName ?? "Player"}
                    {isMe && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                  </span>
                  {score.isWinner && <Trophy className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />}
                </div>

                {theirs?.rated ? (
                  <RatingDelta payload={theirs} />
                ) : (
                  <span className="font-mono-num text-sm font-bold text-foreground">{score.score}</span>
                )}
              </motion.li>
            );
          })}
        </ul>
      </div>

      {/* Your progression. Absent when the match was unrated or the write failed. */}
      {mine && (
        <div className="border-t border-border px-6 py-4">
          <XpBar payload={mine} />

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="XP earned" value={`+${mine.xpGained}`} />
            <Stat
              label="Level"
              value={
                mine.levelAfter > mine.levelBefore
                  ? `${mine.levelBefore} → ${mine.levelAfter}`
                  : String(mine.levelAfter)
              }
              highlight={mine.levelAfter > mine.levelBefore}
            />
            <Stat
              label="Win streak"
              value={mine.streak > 0 ? String(mine.streak) : "—"}
              icon={mine.streak >= 3 ? <Flame className="h-3.5 w-3.5 text-warning" aria-hidden /> : null}
            />
          </div>

          {unlocked.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-tag uppercase text-muted-foreground">
                {unlocked.length === 1 ? "Achievement unlocked" : "Achievements unlocked"}
              </p>
              <ul className="space-y-2">
                {unlocked.map((achievement, i) => (
                  <motion.li
                    key={achievement.id}
                    initial={reduced ? false : { opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={reduced ? { duration: 0 } : { ...spring, delay: 0.6 + i * 0.12 }}
                  >
                    <AchievementBadge achievement={achievement} unlocked size="sm" />
                  </motion.li>
                ))}
              </ul>
            </div>
          )}

          {mine.levelAfter > mine.levelBefore && (
            <motion.p
              initial={reduced ? false : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={reduced ? { duration: 0 } : { ...spring, delay: 0.5 }}
              className="mt-3 rounded-lg bg-success/10 px-3 py-2 text-center text-sm font-semibold text-success"
            >
              Level up — you reached level {mine.levelAfter}
            </motion.p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-border px-6 py-4 sm:flex-row">
        {onRematch && (
          <Button variant="play" className="flex-1" onClick={onRematch} disabled={rematchPending}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            {rematchPending ? "Waiting for opponent…" : rematchLabel}
          </Button>
        )}
        {exitHref ? (
          <Link
            href={exitHref}
            className={cn(buttonVariants({ variant: "outline" }), "flex-1")}
          >
            <Home className="h-4 w-4" aria-hidden />
            Back to games
          </Link>
        ) : (
          onExit && (
            <Button variant="outline" className="flex-1" onClick={onExit}>
              <Home className="h-4 w-4" aria-hidden />
              Back
            </Button>
          )
        )}
      </div>
    </motion.div>
  );
}

function RatingDelta({ payload }: { payload: PlayerProgressionPayload }) {
  const up = payload.ratingDelta > 0;
  const flat = payload.ratingDelta === 0;
  const tier = rankForRating(payload.ratingAfter);

  return (
    <div className="flex items-center gap-2 text-right">
      <div className="leading-tight">
        <div className="text-sm font-semibold text-foreground">
          <CountUp from={payload.ratingBefore} to={payload.ratingAfter} />
        </div>
        <div className="text-tag uppercase text-muted-foreground">{tier.label}</div>
      </div>
      <span
        className={cn(
          "font-mono-num inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-bold",
          flat
            ? "bg-muted text-muted-foreground"
            : up
              ? "bg-success/15 text-success"
              : "bg-destructive/15 text-destructive",
        )}
      >
        {!flat &&
          (up ? (
            <ArrowUpRight className="h-3 w-3" aria-hidden />
          ) : (
            <ArrowDownRight className="h-3 w-3" aria-hidden />
          ))}
        {up ? "+" : ""}
        {payload.ratingDelta}
      </span>
    </div>
  );
}

function XpBar({ payload }: { payload: PlayerProgressionPayload }) {
  const reduced = useReducedMotionPref();
  const before = levelProgress(payload.xpBefore);
  const after = levelProgress(payload.xpAfter);
  const levelledUp = payload.levelAfter > payload.levelBefore;

  // On a level-up the bar would have to run backwards, so it fills to the end
  // of the old level instead and the new level is announced separately.
  const from = before.progress;
  const to = levelledUp ? 1 : after.progress;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-xs">
        <span className="text-tag uppercase text-muted-foreground">
          Level {payload.levelBefore}
        </span>
        <span className="font-mono-num text-muted-foreground">
          {after.xpIntoLevel} / {after.xpForNextLevel} XP
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
          initial={reduced ? { width: `${to * 100}%` } : { width: `${from * 100}%` }}
          animate={{ width: `${to * 100}%` }}
          transition={reduced ? { duration: 0 } : { duration: 0.9, delay: 0.25, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight = false,
  icon = null,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 px-2 py-2">
      <div
        className={cn(
          "font-mono-num flex items-center justify-center gap-1 text-sm font-bold",
          highlight ? "text-success" : "text-foreground",
        )}
      >
        {icon}
        {value}
      </div>
      <div className="mt-0.5 text-tag uppercase text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
