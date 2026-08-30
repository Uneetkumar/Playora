"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import { isSupabaseConfigured } from "../lib/env";
import { queryKeys } from "../lib/query/keys";

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
  const query = useQuery({
    queryKey: queryKeys.leaderboard(gameSlug, scope, userId),
    enabled: isSupabaseConfigured,
    queryFn: async (): Promise<{ entries: LeaderboardEntry[]; me: LeaderboardEntry | null }> => {
      const supabase = getSupabaseBrowserClient();

      const { data: gameRow } = await supabase
        .from("games")
        .select("id")
        .eq("slug", gameSlug)
        .limit(1);
      const gameId = (gameRow as Array<{ id: string }> | null)?.[0]?.id;
      if (!gameId) return { entries: [], me: null };

      let ids: string[] | null = null;
      if (scope === "friends") {
        ids = await friendIds(supabase, userId);
        // Your own row belongs on a friends board; comparing against people
        // you know is the whole point of it.
        if (userId) ids = [...new Set([...ids, userId])];
        if (ids.length === 0) return { entries: [], me: null };
      }

      let request = supabase
        .from("game_ratings")
        .select(SELECT)
        .eq("game_id", gameId)
        // An unplayed 1200 is a default, not a ranking.
        .gt("games_played", 0)
        .order("rating", { ascending: false })
        .limit(limit);

      if (ids) request = request.in("user_id", ids);

      const { data, error } = await request;
      if (error) throw new Error(error.message);

      const rows = (data ?? []) as unknown as RatingRow[];
      const entries = rows.map((row, i) => toEntry(row, i + 1, userId));

      // Where the viewer sits, if they are not already on screen.
      const me =
        userId && !entries.some((e) => e.isMe)
          ? await standingFor(supabase, gameId, userId, ids)
          : null;

      return { entries, me };
    },
  });

  return {
    entries: query.data?.entries ?? [],
    me: query.data?.me ?? null,
    isLoading: query.isPending && query.fetchStatus !== "idle",
    error: query.error instanceof Error ? query.error.message : null,
  };
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
