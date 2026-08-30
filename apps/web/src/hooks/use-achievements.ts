"use client";

import * as React from "react";
import { ACHIEVEMENTS, achievementPoints, type AchievementDef } from "@playora/progression";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import { isSupabaseConfigured } from "../lib/env";

export interface AchievementProgress {
  unlockedIds: string[];
  unlockedAt: Record<string, string>;
  points: number;
  /** Points available across the whole catalogue. */
  totalPoints: number;
  unlocked: AchievementDef[];
  locked: AchievementDef[];
}

const EMPTY: AchievementProgress = {
  unlockedIds: [],
  unlockedAt: {},
  points: 0,
  totalPoints: ACHIEVEMENTS.reduce((sum, a) => sum + a.points, 0),
  unlocked: [],
  locked: [...ACHIEVEMENTS],
};

/**
 * Which achievements a player has, merged against the catalogue in code.
 *
 * Only the unlocks are stored, so an achievement added to the catalogue shows
 * up as locked for everyone immediately, and an achievement removed from it
 * simply stops being listed — no migration either way.
 */
export function useAchievements(userId: string | null | undefined) {
  const [progress, setProgress] = React.useState<AchievementProgress>(EMPTY);
  const [isLoading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!userId || !isSupabaseConfigured) {
      setProgress(EMPTY);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase
          .from("user_achievements")
          .select("achievement_id,unlocked_at")
          .eq("user_id", userId);

        if (cancelled) return;
        const rows = (data ?? []) as Array<{ achievement_id: string; unlocked_at: string }>;
        const ids = new Set(rows.map((r) => r.achievement_id));

        setProgress({
          unlockedIds: [...ids],
          unlockedAt: Object.fromEntries(rows.map((r) => [r.achievement_id, r.unlocked_at])),
          points: achievementPoints([...ids]),
          totalPoints: EMPTY.totalPoints,
          unlocked: ACHIEVEMENTS.filter((a) => ids.has(a.id)),
          locked: ACHIEVEMENTS.filter((a) => !ids.has(a.id)),
        });
      } catch {
        if (!cancelled) setProgress(EMPTY);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { progress, isLoading };
}
