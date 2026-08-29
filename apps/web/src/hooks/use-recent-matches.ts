"use client";

import * as React from "react";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import { isSupabaseConfigured } from "../lib/env";

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
  const [matches, setMatches] = React.useState<RecentMatch[]>([]);
  const [isLoading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!userId || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase
          .from("game_results")
          .select("session_id,winner_id,duration_seconds,finish_reason,created_at,scores,games(slug,name)")
          .order("created_at", { ascending: false })
          .limit(40);

        if (cancelled) return;
        const rows = (data ?? []) as unknown as ResultRow[];

        // Filter to matches this player actually took part in. RLS allows
        // reading results generally, so the scope has to be applied here.
        const mine = rows
          .filter((r) => Array.isArray(r.scores) && r.scores.some((s) => s.userId === userId))
          .slice(0, limit)
          .map((r) => ({
            sessionId: r.session_id,
            gameSlug: r.games?.slug ?? "chess",
            gameName: r.games?.name ?? "Game",
            isWinner: r.winner_id === userId,
            isDraw: r.winner_id === null,
            durationSeconds: r.duration_seconds,
            playedAt: r.created_at,
          }));

        setMatches(mine);
      } catch {
        if (!cancelled) setMatches([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, limit]);

  return { matches, isLoading };
}
