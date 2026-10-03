"use client";

import * as React from "react";
import type { GameId } from "@playora/game-types";
import {
  commitBestScore,
  difficultyAt,
  pointsFor,
  readBestScore,
  spawnIntervalAt,
} from "./scoring";

export interface ArcadeRun {
  score: number;
  combo: number;
  /** Longest chain this run. */
  bestCombo: number;
  /** Personal best before this run started. */
  best: number;
  /** True once the run has ended above the previous best. */
  isNewBest: boolean;
  /** Seconds since the run started. */
  elapsed: number;
  /** Difficulty multiplier for right now. */
  difficulty: number;
  /** Spawn interval for right now, given a base rate. */
  spawnInterval: (baseMs: number) => number;
  /** Scores a hit, applying and extending the combo. */
  hit: (basePoints: number) => void;
  /** Ends the chain without scoring — a miss. */
  miss: () => void;
  /**
   * Banks a flat number of points and ends the chain.
   *
   * Separate from `hit` because `hit` multiplies by the chain, and banking a
   * value that was *derived* from the chain would count it twice — a 6-chain
   * bank of 90 would score 90 x the 6-chain multiplier.
   */
  bank: (points: number) => void;
  /** Commits the score. Safe to call more than once. */
  end: () => void;
  reset: () => void;
}

/**
 * Score, combo, difficulty and a personal best, for an arcade run.
 *
 * Every one of these games threw its score away when the round ended, so a run
 * had nothing to be measured against and no reason to be repeated. This gives
 * all of them the same three things — a number that grows, a chain that rewards
 * not missing, and a best that survives the page — without each view inventing
 * its own version.
 *
 * `elapsed` is driven by a one-second timer rather than by counting frames, so
 * the difficulty curve is the same on a 144Hz monitor as on a throttled tab.
 */
export function useArcadeRun(gameId: GameId | string): ArcadeRun {
  const [score, setScore] = React.useState(0);
  const [combo, setCombo] = React.useState(0);
  const [bestCombo, setBestCombo] = React.useState(0);
  const [best, setBest] = React.useState(0);
  const [isNewBest, setIsNewBest] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [running, setRunning] = React.useState(true);

  // The previous best is read once, on mount, so the HUD can show "BEST" while
  // the run is still going without re-reading storage every render.
  React.useEffect(() => {
    setBest(readBestScore(gameId));
  }, [gameId]);

  React.useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);

  // Held in a ref as well as state so `end` can commit the final score without
  // depending on a render having flushed first.
  const scoreRef = React.useRef(0);
  const endedRef = React.useRef(false);

  const hit = React.useCallback((basePoints: number) => {
    setCombo((c) => {
      const next = c + 1;
      setBestCombo((b) => (next > b ? next : b));
      const gained = pointsFor(basePoints, next);
      scoreRef.current += gained;
      setScore(scoreRef.current);
      return next;
    });
  }, []);

  const miss = React.useCallback(() => setCombo(0), []);

  const bank = React.useCallback((points: number) => {
    scoreRef.current += Math.max(0, Math.round(points));
    setScore(scoreRef.current);
    setCombo(0);
  }, []);

  const end = React.useCallback(() => {
    // Idempotent: a game-over can be reached from several places at once — a
    // timer expiring in the same tick a hazard lands — and committing twice
    // would compare the score against a best it had just set.
    if (endedRef.current) return;
    endedRef.current = true;
    setRunning(false);
    setIsNewBest(commitBestScore(gameId, scoreRef.current));
  }, [gameId]);

  const reset = React.useCallback(() => {
    endedRef.current = false;
    scoreRef.current = 0;
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setElapsed(0);
    setIsNewBest(false);
    setRunning(true);
    // Re-read: the run that just finished may have raised it.
    setBest(readBestScore(gameId));
  }, [gameId]);

  const spawnInterval = React.useCallback(
    (baseMs: number) => spawnIntervalAt(baseMs, elapsed),
    [elapsed],
  );

  return {
    score,
    combo,
    bestCombo,
    best,
    isNewBest,
    elapsed,
    difficulty: difficultyAt(elapsed),
    spawnInterval,
    hit,
    miss,
    bank,
    end,
    reset,
  };
}
