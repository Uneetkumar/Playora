"use client";

import * as React from "react";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import { isSupabaseConfigured } from "../lib/env";

export type LeaderboardScope = "global" | "friends";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  rating: number;
  peakRating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  isMe: boolean;
}

interface RatingRow {
  user_id: string;
  rating: number;
  peak_rating: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
  profiles: { username: string; display_name: string; avatar_url: string | null } | null;
}

const SELECT =
  "user_id,rating,peak_rating,games_played,wins,losses,draws,profiles!inner(username,display_name,avatar_url)";

export interface LeaderboardOptions {
  gameSlug: string;
  scope?: LeaderboardScope;
  limit?: number;
}

/**
 * A per-game leaderboard, plus the viewer's own standing.
 *
 * Rating is per game (spec sections 10, 104.7), so there is no such thing as a
 * single platform leaderboard — every view here is scoped to one game.
 *
 * The viewer's row is fetched separately rather than searched for in the page,
 * because someone ranked 4,000th has to be able to see where they stand without
 * paging through everyone above them.
 */
export function useLeaderboard(
  userId: string | null | undefined,
  { gameSlug, scope = "global", limit = 50 }: LeaderboardOptions,
) {
  const [entries, setEntries] = React.useState<LeaderboardEntry[]>([]);
  const [me, setMe] = React.useState<LeaderboardEntry | null>(null);
  const [isLoading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const supabase = getSupabaseBrowserClient();

        const { data: gameRow } = await supabase
          .from("games")
          .select("id")
          .eq("slug", gameSlug)
          .limit(1);
        const gameId = (gameRow as Array<{ id: string }> | null)?.[0]?.id;
        if (!gameId) {
          if (!cancelled) {
            setEntries([]);
            setMe(null);
            setError(null);
          }
          return;
        }

        let ids: string[] | null = null;
        if (scope === "friends") {
          ids = await friendIds(supabase, userId);
          // Your own row belongs on a friends board; comparing against people
          // you know is the whole point of it.
          if (userId) ids = [...new Set([...ids, userId])];
          if (ids.length === 0) {
            if (!cancelled) {
              setEntries([]);
              setMe(null);
              setError(null);
            }
            return;
          }
        }

        let query = supabase
          .from("game_ratings")
          .select(SELECT)
          .eq("game_id", gameId)
          // An unplayed 1200 is a default, not a ranking.
          .gt("games_played", 0)
          .order("rating", { ascending: false })
          .limit(limit);

        if (ids) query = query.in("user_id", ids);

        const { data, error: queryError } = await query;
        if (cancelled) return;
        if (queryError) throw new Error(queryError.message);

        const rows = (data ?? []) as unknown as RatingRow[];
        const list = rows.map((row, i) => toEntry(row, i + 1, userId));
        setEntries(list);

        // Where the viewer sits, if they are not already on screen.
        if (userId && !list.some((e) => e.isMe)) {
          setMe(await standingFor(supabase, gameId, userId, ids));
        } else {
          setMe(null);
        }
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setEntries([]);
        setMe(null);
        setError(err instanceof Error ? err.message : "Could not load the leaderboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, gameSlug, scope, limit]);

  return { entries, me, isLoading, error };
}

type SupabaseClient = ReturnType<typeof getSupabaseBrowserClient>;

/** Accepted friendships in either direction. */
async function friendIds(
  supabase: SupabaseClient,
  userId: string | null | undefined,
): Promise<string[]> {
  if (!userId) return [];
  const { data } = await supabase
    .from("friendships")
    .select("user_id,friend_id")
    .eq("status", "accepted")
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

  const rows = (data ?? []) as Array<{ user_id: string; friend_id: string }>;
  return [...new Set(rows.map((r) => (r.user_id === userId ? r.friend_id : r.user_id)))];
}

/**
 * The viewer's rank, counted rather than paged to.
 *
 * Rank is "how many players are rated above me, plus one" — a head-only count
 * query against the (game_id, rating DESC) index, so it costs the same whether
 * they are 5th or 50,000th.
 */
async function standingFor(
  supabase: SupabaseClient,
  gameId: string,
  userId: string,
  restrictTo: string[] | null,
): Promise<LeaderboardEntry | null> {
  const { data } = await supabase
    .from("game_ratings")
    .select(SELECT)
    .eq("game_id", gameId)
    .eq("user_id", userId)
    .limit(1);

  const row = ((data ?? []) as unknown as RatingRow[])[0];
  if (!row || row.games_played === 0) return null;

  let counter = supabase
    .from("game_ratings")
    .select("user_id", { count: "exact", head: true })
    .eq("game_id", gameId)
    .gt("games_played", 0)
    .gt("rating", row.rating);

  if (restrictTo) counter = counter.in("user_id", restrictTo);

  const { count } = await counter;
  return toEntry(row, (count ?? 0) + 1, userId);
}

function toEntry(row: RatingRow, rank: number, userId: string | null | undefined): LeaderboardEntry {
  return {
    rank,
    userId: row.user_id,
    displayName: row.profiles?.display_name ?? row.profiles?.username ?? "Player",
    username: row.profiles?.username ?? "player",
    avatarUrl: row.profiles?.avatar_url ?? null,
    rating: row.rating,
    peakRating: row.peak_rating,
    gamesPlayed: row.games_played,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    isMe: row.user_id === userId,
  };
}
