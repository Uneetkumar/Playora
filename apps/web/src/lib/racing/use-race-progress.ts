"use client";

import * as React from "react";
import type { GameId } from "@playora/game-types";
import { levelsFor, starsFor, unlockedLevels, type RaceLevel } from "@playora/game-engine";

export interface RaceProgress {
  /** Best finishing place per level index. Absent means never completed. */
  best: Record<number, number>;
}

const EMPTY: RaceProgress = { best: {} };

const key = (gameId: GameId) => `playora:race-progress:${gameId}`;

function load(gameId: GameId): RaceProgress {
  try {
    const raw = localStorage.getItem(key(gameId));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<RaceProgress>;
    const best: Record<number, number> = {};
    // Only whole positive numbers, and only for levels that exist. Stored
    // progress is editable in practice, and a junk value here would decide
    // which levels a player can open.
    const count = levelsFor(gameId).length;
    for (const [index, place] of Object.entries(parsed.best ?? {})) {
      const i = Number(index);
      if (Number.isInteger(i) && i >= 1 && i <= count && Number.isInteger(place) && place >= 1) {
        best[i] = place as number;
      }
    }
    return { best };
  } catch {
    return EMPTY;
  }
}

/**
 * Which levels are open, and how well each has been driven.
 *
 * Kept per device in localStorage rather than on the account, because offline
 * races are unrated and are deliberately not written to the server. A player
 * who signs in on another machine starts the ladder again — which is the
 * honest consequence of not recording offline play, not an oversight.
 */
export function useRaceProgress(gameId: GameId) {
  const [progress, setProgress] = React.useState<RaceProgress>(EMPTY);
  const [hydrated, setHydrated] = React.useState(false);

  // Read after mount: the server has no localStorage, and rendering a
  // different set of unlocked levels than the server sent is a hydration error.
  React.useEffect(() => {
    setProgress(load(gameId));
    setHydrated(true);
  }, [gameId]);

  const levels = React.useMemo(() => levelsFor(gameId), [gameId]);

  // Derived by the engine's own function, so the rule that decides what a
  // player can open is covered by tests rather than by clicking through it.
  const unlocked = React.useMemo(
    () => unlockedLevels(levels, progress.best),
    [levels, progress.best],
  );

  const isUnlocked = React.useCallback(
    (level: RaceLevel) => unlocked[level.index - 1] ?? false,
    [unlocked],
  );

  const record = React.useCallback(
    (level: RaceLevel, place: number) => {
      setProgress((current) => {
        const existing = current.best[level.index];
        // Keep the best result, so replaying a level for fun cannot demote it.
        if (existing !== undefined && existing <= place) return current;

        const next = { best: { ...current.best, [level.index]: place } };
        try {
          localStorage.setItem(key(gameId), JSON.stringify(next));
        } catch {
          /* storage unavailable; progress simply will not persist */
        }
        return next;
      });
    },
    [gameId],
  );

  const stars = React.useCallback(
    (level: RaceLevel) => {
      const place = progress.best[level.index];
      return place === undefined ? 0 : starsFor(level, place);
    },
    [progress],
  );

  const totalStars = levels.reduce((sum, level) => sum + stars(level), 0);
  const nextLevel = levels.find((level) => isUnlocked(level) && stars(level) === 0) ?? null;

  return { levels, progress, hydrated, isUnlocked, record, stars, totalStars, nextLevel };
}
