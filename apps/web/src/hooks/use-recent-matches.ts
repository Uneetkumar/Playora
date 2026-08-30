"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import { isSupabaseConfigured } from "../lib/env";
import { queryKeys } from "../lib/query/keys";

export interface RecentMatch {
  sessionId: string;
  gameSlug: string;
  gameName: string;
  isWinner: boolean;
  isDraw: boolean;
  durationSeconds: number;
  playedAt: string;
}

interface ResultRow {
  session_id: string;
  winner_id: string | null;
  duration_seconds: number;
  finish_reason: string;
  created_at: string;
  scores: Array<{ userId: string; isWinner: boolean }>;
  games: { slug: string; name: string } | null;
}

/**
 * The player's most recent finished matches.
 *
 * Reads `game_results` directly — results are written by the server after each
 * match, so this is the record rather than anything the client tracks.
 */
export function useRecentMatches(userId: string | null | undefined, limit = 5) {
  const query = useQuery({
    queryKey: queryKeys.recentMatches(userId, limit),
    enabled: Boolean(userId) && isSupabaseConfigured,
    queryFn: async (): Promise<RecentMatch[]> => {
      const supabase = getSupabaseBrowserClient();
      // Scoped server-side against the GIN index on `scores` (migration
      // 00005). This used to fetch the newest 40 results platform-wide and
      // filter them here, which returns nothing at all once other people are
      // playing between one visit and the next.
      const { data } = await supabase
        .from("game_results")
        .select("session_id,winner_id,duration_seconds,finish_reason,created_at,scores,games(slug,name)")
        .filter("scores", "cs", JSON.stringify([{ userId }]))
        .order("created_at", { ascending: false })
        .limit(limit);

      return ((data ?? []) as unknown as ResultRow[]).map((r) => ({
        sessionId: r.session_id,
        gameSlug: r.games?.slug ?? "chess",
        gameName: r.games?.name ?? "Game",
        isWinner: r.winner_id === userId,
        isDraw: r.winner_id === null,
        durationSeconds: r.duration_seconds,
        playedAt: r.created_at,
      }));
    },
  });

  return {
    matches: query.data ?? [],
    isLoading: query.isPending && query.fetchStatus !== "idle",
  };
}
