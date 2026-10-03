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

/** The part of a run that scoring changes: what `hit`, `miss` and `bank` touch. */
export interface RunTally {
  score: number;
  combo: number;
  bestCombo: number;
}

export type RunTallyAction =
  | { type: "hit"; basePoints: number }
  | { type: "miss" }
  | { type: "bank"; points: number }
  | { type: "reset" };

export const INITIAL_RUN_TALLY: RunTally = { score: 0, combo: 0, bestCombo: 0 };

/**
 * Every scoring rule of a run, as one pure function.
 *
 * `hit` used to add to the score from inside a `setCombo` updater. React
 * calls updaters twice under StrictMode to flush out exactly that kind of side
 * effect, so in development every hit scored double. Here the next tally is
 * computed from the previous one and nothing else, so calling it twice with
 * the same input is harmless, and the rules can be tested without a renderer.
 */
export function runTallyReducer(state: RunTally, action: RunTallyAction): RunTally {
  switch (action.type) {
    case "hit": {
      const combo = state.combo + 1;
      return {
        score: state.score + pointsFor(action.basePoints, combo),
        combo,
        bestCombo: Math.max(state.bestCombo, combo),
      };
    }
    case "miss":
      return state.combo === 0 ? state : { ...state, combo: 0 };
    case "bank":
      return {
        ...state,
        score: state.score + Math.max(0, Math.round(action.points)),
        combo: 0,
      };
    case "reset":
      return INITIAL_RUN_TALLY;
  }
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
  const [tally, setTally] = React.useState<RunTally>(INITIAL_RUN_TALLY);
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

  /*
   * The tally lives in a ref, and state is a copy of it for rendering. Each
   * action runs the reducer once, in the event handler that caused it, and
   * hands React the finished value rather than an updater — so there is
   * nothing for StrictMode to repeat. The ref is also what lets `end` commit
   * the final score in the same tick as the last `hit` or `bank`, before any
   * render has flushed; several hits in one tick each build on the last.
   */
  const tallyRef = React.useRef<RunTally>(INITIAL_RUN_TALLY);
  const endedRef = React.useRef(false);

  const dispatch = React.useCallback((action: RunTallyAction) => {
    const next = runTallyReducer(tallyRef.current, action);
    if (next === tallyRef.current) return;
    tallyRef.current = next;
    setTally(next);
  }, []);

  const hit = React.useCallback(
    (basePoints: number) => dispatch({ type: "hit", basePoints }),
    [dispatch],
  );

  const miss = React.useCallback(() => dispatch({ type: "miss" }), [dispatch]);

  const bank = React.useCallback(
    (points: number) => dispatch({ type: "bank", points }),
    [dispatch],
  );

  const end = React.useCallback(() => {
    // Idempotent: a game-over can be reached from several places at once — a
    // timer expiring in the same tick a hazard lands — and committing twice
    // would compare the score against a best it had just set.
    if (endedRef.current) return;
    endedRef.current = true;
    setRunning(false);
    setIsNewBest(commitBestScore(gameId, tallyRef.current.score));
  }, [gameId]);

  const reset = React.useCallback(() => {
    endedRef.current = false;
    dispatch({ type: "reset" });
    setElapsed(0);
    setIsNewBest(false);
    setRunning(true);
    // Re-read: the run that just finished may have raised it.
    setBest(readBestScore(gameId));
  }, [dispatch, gameId]);

  const spawnInterval = React.useCallback(
    (baseMs: number) => spawnIntervalAt(baseMs, elapsed),
    [elapsed],
  );

  return {
    score: tally.score,
    combo: tally.combo,
    bestCombo: tally.bestCombo,
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
