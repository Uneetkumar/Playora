"use client";

import { useQuery } from "@tanstack/react-query";
import { ACHIEVEMENTS, achievementPoints, type AchievementDef } from "@playora/progression";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import { isSupabaseConfigured } from "../lib/env";
import { queryKeys } from "../lib/query/keys";

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
  const query = useQuery({
    queryKey: queryKeys.achievements(userId),
    enabled: Boolean(userId) && isSupabaseConfigured,
    queryFn: async (): Promise<AchievementProgress> => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase
        .from("user_achievements")
        .select("achievement_id,unlocked_at")
        .eq("user_id", userId!);

      const rows = (data ?? []) as Array<{ achievement_id: string; unlocked_at: string }>;
      const ids = new Set(rows.map((r) => r.achievement_id));

      // Merged against the catalogue in code, so an achievement added to the
      // list shows up as locked for everyone with no migration.
      return {
        unlockedIds: [...ids],
        unlockedAt: Object.fromEntries(rows.map((r) => [r.achievement_id, r.unlocked_at])),
        points: achievementPoints([...ids]),
        totalPoints: EMPTY.totalPoints,
        unlocked: ACHIEVEMENTS.filter((a) => ids.has(a.id)),
        locked: ACHIEVEMENTS.filter((a) => !ids.has(a.id)),
      };
    },
  });

  return {
    progress: query.data ?? EMPTY,
    isLoading: query.isPending && query.fetchStatus !== "idle",
  };
}
