"use client";

import * as React from "react";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import { isSupabaseConfigured } from "../lib/env";

export interface MatchParticipant {
  userId: string;
  displayName: string;
  rank: number;
  score: number;
  isWinner: boolean;
  isBot: boolean;
  /** True for the player viewing this record. */
  isMe: boolean;
}

export interface MatchRecord {
  sessionId: string;
  roomId: string;
  gameSlug: string;
  gameName: string;
  outcome: "win" | "loss" | "draw";
  finishReason: string;
  durationSeconds: number;
  playedAt: string;
  participants: MatchParticipant[];
  /** Everyone except the viewer, so lists do not have to re-derive it. */
  opponents: MatchParticipant[];
  /** Null for unrated matches, and for matches played before rating existed. */
  ratingDelta: number | null;
  ratingAfter: number | null;
}

interface ResultRow {
  session_id: string;
  room_id: string;
  winner_id: string | null;
  duration_seconds: number;
  finish_reason: string;
  created_at: string;
  scores: Array<{ userId: string; playerId: string; rank: number; score: number; isWinner: boolean }>;
  games: { slug: string; name: string } | null;
}

interface RatingRow {
  session_id: string | null;
  delta: number;
  rating_after: number;
}

const BOT_PREFIX = "bot-";

/**
 * Filters `game_results` down to one player's matches, on the server.
 *
 * `scores` is JSONB, so the filter is a containment query against the GIN index
 * added in migration 00005. Doing this client-side (fetch the newest N results
 * platform-wide, then filter) silently returns nothing once other people are
 * playing, which is exactly the kind of bug that only appears in production.
 */
function participantFilter(userId: string): string {
  return JSON.stringify([{ userId }]);
}

export interface MatchHistoryOptions {
  gameSlug?: string | null;
  limit?: number;
  page?: number;
}

export function useMatchHistory(
  userId: string | null | undefined,
  { gameSlug = null, limit = 20, page = 0 }: MatchHistoryOptions = {},
) {
  const [matches, setMatches] = React.useState<MatchRecord[]>([]);
  const [isLoading, setLoading] = React.useState(true);
  const [hasMore, setHasMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!userId || !isSupabaseConfigured) {
      setMatches([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        // One extra row answers "is there a next page" without a count query.
        const from = page * limit;
        let query = supabase
          .from("game_results")
          .select(
            "session_id,room_id,winner_id,duration_seconds,finish_reason,created_at,scores,games!inner(slug,name)",
          )
          .filter("scores", "cs", participantFilter(userId))
          .order("created_at", { ascending: false })
          .range(from, from + limit);

        if (gameSlug) query = query.eq("games.slug", gameSlug);

        const { data, error: queryError } = await query;
        if (cancelled) return;
        if (queryError) throw new Error(queryError.message);

        const rows = (data ?? []) as unknown as ResultRow[];
        const pageRows = rows.slice(0, limit);
        setHasMore(rows.length > limit);

        const [names, ratings] = await Promise.all([
          resolveNames(supabase, pageRows),
          resolveRatingChanges(supabase, pageRows, userId),
        ]);
        if (cancelled) return;

        setMatches(pageRows.map((row) => toRecord(row, userId, names, ratings)));
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setMatches([]);
        setError(err instanceof Error ? err.message : "Could not load your matches.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, gameSlug, limit, page]);

  return { matches, isLoading, hasMore, error };
}

/** One finished match, by session id. Used by the detail page. */
export function useMatchDetail(sessionId: string, userId: string | null | undefined) {
  const [match, setMatch] = React.useState<MatchRecord | null>(null);
  const [isLoading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);

  React.useEffect(() => {
    if (!sessionId || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase
          .from("game_results")
          .select(
            "session_id,room_id,winner_id,duration_seconds,finish_reason,created_at,scores,games(slug,name)",
          )
          .eq("session_id", sessionId)
          .limit(1);

        if (cancelled) return;
        const row = ((data ?? []) as unknown as ResultRow[])[0];
        if (!row) {
          setNotFound(true);
          return;
        }

        const [names, ratings] = await Promise.all([
          resolveNames(supabase, [row]),
          resolveRatingChanges(supabase, [row], userId ?? ""),
        ]);
        if (cancelled) return;
        setMatch(toRecord(row, userId ?? "", names, ratings));
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, userId]);

  return { match, isLoading, notFound };
}

type SupabaseClient = ReturnType<typeof getSupabaseBrowserClient>;

/**
 * Display names for everyone who appeared in these results.
 *
 * Bots have no profile row, so they are named from their id rather than looked
 * up — a missing profile is normal here, not an error.
 */
async function resolveNames(
  supabase: SupabaseClient,
  rows: ResultRow[],
): Promise<Record<string, string>> {
  const ids = [
    ...new Set(
      rows.flatMap((r) => (Array.isArray(r.scores) ? r.scores : []).map((s) => s.userId)),
    ),
  ].filter((id) => id && !id.startsWith(BOT_PREFIX));

  if (ids.length === 0) return {};

  const { data } = await supabase
    .from("profiles")
    .select("id,display_name,username")
    .in("id", ids);

  const out: Record<string, string> = {};
  for (const p of (data ?? []) as Array<{ id: string; display_name: string | null; username: string | null }>) {
    out[p.id] = p.display_name ?? p.username ?? "Player";
  }
  return out;
}

/** The player's own rating movement for each of these sessions, if it was rated. */
async function resolveRatingChanges(
  supabase: SupabaseClient,
  rows: ResultRow[],
  userId: string,
): Promise<Record<string, RatingRow>> {
  if (!userId || rows.length === 0) return {};
  const sessionIds = rows.map((r) => r.session_id).filter(Boolean);
  if (sessionIds.length === 0) return {};

  const { data } = await supabase
    .from("rating_history")
    .select("session_id,delta,rating_after")
    .eq("user_id", userId)
    .in("session_id", sessionIds);

  const out: Record<string, RatingRow> = {};
  for (const r of (data ?? []) as RatingRow[]) {
    if (r.session_id) out[r.session_id] = r;
  }
  return out;
}

function toRecord(
  row: ResultRow,
  userId: string,
  names: Record<string, string>,
  ratings: Record<string, RatingRow>,
): MatchRecord {
  const scores = Array.isArray(row.scores) ? row.scores : [];
  const rating = ratings[row.session_id];

  const participants = [...scores]
    .sort((a, b) => a.rank - b.rank)
    .map((s) => ({
      userId: s.userId,
      displayName: s.userId.startsWith(BOT_PREFIX)
        ? "AI opponent"
        : (names[s.userId] ?? "Player"),
      rank: s.rank,
      score: s.score,
      isWinner: s.isWinner,
      isBot: s.userId.startsWith(BOT_PREFIX),
      isMe: s.userId === userId,
    }));

  return {
    sessionId: row.session_id,
    roomId: row.room_id,
    gameSlug: row.games?.slug ?? "chess",
    gameName: row.games?.name ?? "Game",
    outcome:
      row.winner_id === null || row.finish_reason === "draw"
        ? "draw"
        : row.winner_id === userId
          ? "win"
          : "loss",
    finishReason: row.finish_reason,
    durationSeconds: row.duration_seconds,
    playedAt: row.created_at,
    participants,
    opponents: participants.filter((p) => !p.isMe),
    ratingDelta: rating?.delta ?? null,
    ratingAfter: rating?.rating_after ?? null,
  };
}
