"use client";

import { useQuery } from "@tanstack/react-query";
import {
  seasonPhase,
  seasonProgress,
  formatTimeRemaining,
  placementTier,
  placementLabel,
  isPlaced,
  SEASON_PLACEMENT_GAMES,
  type Season,
  type PlacementTier,
} from "@playora/progression";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import { isSupabaseConfigured } from "../lib/env";
import { queryKeys } from "../lib/query/keys";

export interface SeasonStanding {
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  /** Null until the player has met the minimum, because there is no rank yet. */
  rank: number | null;
  /** How many more games before they are ranked. */
  gamesToPlacement: number;
}

export interface SeasonView {
  season: Season | null;
  phase: ReturnType<typeof seasonPhase> | null;
  progress: number;
  remainingLabel: string;
  standing: SeasonStanding | null;
}

interface SeasonRow {
  id: string;
  slug: string;
  name: string;
  theme: string | null;
  starts_at: string;
  ends_at: string;
  closed_at: string | null;
}

/**
 * The active season and, if asked for a game, the viewer's standing in it.
 *
 * Season standing is a different number from the all-time rating shown on a
 * profile, and the two are deliberately never merged: a player mid-season can
 * be 1350 this season and 1720 all-time, and both are true.
 */
export function useSeason(userId: string | null | undefined, gameSlug?: string) {
  const query = useQuery({
    queryKey: queryKeys.season(gameSlug ?? null, userId),
    enabled: isSupabaseConfigured,
    // A season boundary moves once every few months; re-reading it on every
    // window focus is pure waste.
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<{ season: Season | null; standing: SeasonStanding | null }> => {
      const supabase = getSupabaseBrowserClient();
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from("seasons")
        .select("id,slug,name,theme,starts_at,ends_at,closed_at")
        .lte("starts_at", now)
        .gt("ends_at", now)
        .limit(1);

      if (error) throw new Error(error.message);

      const row = ((data ?? []) as SeasonRow[])[0];
      if (!row) return { season: null, standing: null };

      const season: Season = {
        id: row.id,
        slug: row.slug,
        name: row.name,
        startsAt: Date.parse(row.starts_at),
        endsAt: Date.parse(row.ends_at),
        closedAt: row.closed_at ? Date.parse(row.closed_at) : null,
      };

      if (!userId || !gameSlug) return { season, standing: null };

      const { data: gameRow } = await supabase
        .from("games")
        .select("id")
        .eq("slug", gameSlug)
        .limit(1);
      const gameId = (gameRow as Array<{ id: string }> | null)?.[0]?.id;
      if (!gameId) return { season, standing: null };

      const { data: mine } = await supabase
        .from("season_ratings")
        .select("rating,games_played,wins,losses,draws")
        .eq("season_id", season.id)
        .eq("game_id", gameId)
        .eq("user_id", userId)
        .limit(1);

      const standingRow = (mine as Array<Omit<SeasonStanding, "rank" | "gamesToPlacement">> | null)?.[0];
      if (!standingRow) return { season, standing: null };

      // Counted rather than paged to, the same way the all-time board does it:
      // a player ranked 4,000th must be able to see their position without
      // reading the 3,999 rows above them.
      let rank: number | null = null;
      if (isPlaced(standingRow.gamesPlayed)) {
        const { count } = await supabase
          .from("season_ratings")
          .select("user_id", { count: "exact", head: true })
          .eq("season_id", season.id)
          .eq("game_id", gameId)
          .gte("games_played", SEASON_PLACEMENT_GAMES)
          .gt("rating", standingRow.rating);
        rank = (count ?? 0) + 1;
      }

      return {
        season,
        standing: {
          ...standingRow,
          rank,
          gamesToPlacement: Math.max(0, SEASON_PLACEMENT_GAMES - standingRow.gamesPlayed),
        },
      };
    },
  });

  const season = query.data?.season ?? null;
  const now = Date.now();

  const view: SeasonView = {
    season,
    phase: season ? seasonPhase(season, now) : null,
    progress: season ? seasonProgress(season, now) : 0,
    remainingLabel: season ? formatTimeRemaining(season, now) : "",
    standing: query.data?.standing ?? null,
  };

  return {
    ...view,
    isLoading: query.isPending && query.fetchStatus !== "idle",
    error: query.error instanceof Error ? query.error.message : null,
  };
}

/** The reward band a rank falls into, for display beside a placement. */
export function tierFor(rank: number, totalRanked: number): { tier: PlacementTier; label: string } {
  const tier = placementTier(rank, totalRanked);
  return { tier, label: placementLabel(tier) };
}
