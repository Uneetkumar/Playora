"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Button, cn } from "@playora/ui";
import type { PlayerProgressionPayload } from "@playora/protocol";
import { Trophy, RotateCcw, ChevronRight, Home, Flag, Timer, Coins } from "lucide-react";
import { formatLapTime } from "./gears";
import { Stars } from "./LevelSelect";

export interface RaceResultProps {
  place: number;
  total: number;
  /** Ticks from the lights going green to crossing the line. */
  raceTicks: number;
  bestLapTicks: number | null;
  coins: number;
  /** Career levels only. */
  stars?: number;
  passed?: boolean;
  levelName?: string;
  /** Why the level was not passed, in the player's terms. */
  requirement?: string;
  /** Real rating and XP, when the race was online and rated. */
  progression?: PlayerProgressionPayload | null;
  onPlayAgain: () => void;
  onNext?: (() => void) | null;
  onExit: () => void;
  exitLabel?: string;
}

function ordinal(place: number): string {
  const suffix =
    place === 1 ? "st" : place === 2 ? "nd" : place === 3 ? "rd" : "th";
  return `${place}${suffix}`;
}

/**
 * The end of a race.
 *
 * Shows what is actually true. The design pack puts XP and a rating change on
 * this screen, and online rated races supply both — but an offline race is
 * deliberately unrated and never written to the server, so inventing a number
 * there would be a lie the player could check on their profile. Offline gets
 * the things that are real: placing, time, best lap, and the coins collected.
 */
export function RaceResult({
  place,
  total,
  raceTicks,
  bestLapTicks,
  coins,
  stars,
  passed,
  levelName,
  requirement,
  progression,
  onPlayAgain,
  onNext,
  onExit,
  exitLabel = "Back to lobby",
}: RaceResultProps) {
  const reduced = useReducedMotion();
  const won = place === 1;
  const podium = place <= 3;

  const headline = won
    ? "VICTORY!"
    : podium
      ? "WELL DRIVEN"
      : passed === false
        ? "NOT QUITE"
        : "GOOD RACE!";

  const accent = won
    ? "text-warning"
    : podium
      ? "text-success"
      : "text-muted-foreground";

  const spring = reduced
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 220, damping: 22 };

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring}
      className="relative mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-2xl"
      role="dialog"
      aria-label={`Finished ${ordinal(place)}`}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b to-transparent",
          won ? "from-warning/25" : podium ? "from-success/20" : "from-muted/30",
        )}
        aria-hidden
      />

      <div className="relative px-6 pb-5 pt-7 text-center">
        {won && (
          <motion.div
            initial={reduced ? false : { scale: 0.4, rotate: -14, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={reduced ? { duration: 0 } : { ...spring, delay: 0.1 }}
          >
            <Trophy className="mx-auto h-12 w-12 text-warning" aria-hidden />
          </motion.div>
        )}

        <div className={cn("mt-2 font-display text-6xl font-black leading-none", accent)}>
          {place}
          <span className="text-3xl align-super">
            {ordinal(place).replace(String(place), "")}
          </span>
        </div>
        <p className={cn("mt-1 font-display text-xl font-black tracking-wide", accent)}>
          {headline}
        </p>
        {levelName && (
          <p className="mt-1 text-xs text-muted-foreground">{levelName}</p>
        )}

        {stars !== undefined && (
          <div className="mt-3 flex justify-center">
            <Stars earned={stars} size="lg" />
          </div>
        )}
      </div>

      <div className="border-t border-border px-6 py-4">
        <dl className="space-y-2.5">
          <Row icon={<Timer className="h-3.5 w-3.5" aria-hidden />} label="Race time">
            {formatLapTime(raceTicks)}
          </Row>
          <Row icon={<Flag className="h-3.5 w-3.5" aria-hidden />} label="Best lap">
            {formatLapTime(bestLapTicks)}
          </Row>
          <Row label="Position">
            {place} / {total}
          </Row>
          <Row icon={<Coins className="h-3.5 w-3.5 text-warning" aria-hidden />} label="Coins">
            {coins}
          </Row>

          {progression?.rated && (
            <>
              <Row label="Rating">
                <span
                  className={cn(
                    progression.ratingDelta > 0
                      ? "text-success"
                      : progression.ratingDelta < 0
                        ? "text-destructive"
                        : "",
                  )}
                >
                  {progression.ratingDelta > 0 ? "+" : ""}
                  {progression.ratingDelta} → {progression.ratingAfter}
                </span>
              </Row>
              <Row label="XP">
                <span className="text-success">+{progression.xpGained}</span>
              </Row>
            </>
          )}
        </dl>

        {!progression && (
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Offline races are unrated and are not saved to your history.
          </p>
        )}

        {passed === false && requirement && (
          <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-center text-xs text-foreground">
            {requirement}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-border px-6 py-4 sm:flex-row">
        {onNext ? (
          <Button className="flex-1 gap-2" onClick={onNext}>
            <ChevronRight className="h-4 w-4" aria-hidden />
            Next level
          </Button>
        ) : null}
        <Button
          variant={onNext ? "outline" : "default"}
          className="flex-1 gap-2"
          onClick={onPlayAgain}
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          Play again
        </Button>
        <Button variant="outline" className="flex-1 gap-2" onClick={onExit}>
          <Home className="h-4 w-4" aria-hidden />
          {exitLabel}
        </Button>
      </div>
    </motion.div>
  );
}

function Row({
  label,
  children,
  icon,
}: {
  label: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="numeric text-sm font-bold tabular-nums text-foreground">{children}</dd>
    </div>
  );
}
