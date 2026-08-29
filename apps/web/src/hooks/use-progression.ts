"use client";

import * as React from "react";
import { levelProgress, rankForRating, ratingToNextRank } from "@playora/progression";
import type { LevelProgress, RankTier } from "@playora/progression";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import { isSupabaseConfigured } from "../lib/env";

export interface GameRating {
  gameSlug: string;
  gameName: string;
  rating: number;
  peakRating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  rank: RankTier;
  toNextRank: { tier: RankTier; needed: number } | null;
}

export interface PlayerProgression {
  level: LevelProgress;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  memberSince: string | null;
  ratings: GameRating[];
}

interface ProfileRow {
  xp: number;
  total_games_played: number;
  total_wins: number;
  total_losses: number;
  total_draws: number;
  current_streak: number;
  best_streak: number;
  created_at: string;
}

interface RatingRow {
  rating: number;
  peak_rating: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
  games: { slug: string; name: string } | null;
}

/**
 * Loads a player's progression.
 *
 * Level/XP and per-game rating are fetched separately because they are separate
 * systems (spec sections 11, 104.6) — one measures participation, the other
 * skill, and they live in different tables for that reason.
 */
export function usePlayerProgression(userId: string | null | undefined) {
  const [data, setData] = React.useState<PlayerProgression | null>(null);
  const [isLoading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!userId || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const [profileRes, ratingsRes] = await Promise.all([
          supabase
            .from("profiles")
            .select(
              "xp,total_games_played,total_wins,total_losses,total_draws,current_streak,best_streak,created_at",
            )
            .eq("id", userId)
            .maybeSingle(),
          supabase
            .from("game_ratings")
            .select("rating,peak_rating,games_played,wins,losses,draws,games(slug,name)")
            .eq("user_id", userId)
            .order("rating", { ascending: false }),
        ]);

        if (cancelled) return;
        if (profileRes.error) {
          setError("Couldn't load your profile.");
          return;
        }

        const p = profileRes.data as ProfileRow | null;
        if (!p) {
          setError("Profile not found.");
          return;
        }

        const rows = (ratingsRes.data ?? []) as unknown as RatingRow[];
        const ratings: GameRating[] = rows
          .filter((r) => r.games)
          .map((r) => ({
            gameSlug: r.games!.slug,
            gameName: r.games!.name,
            rating: r.rating,
            peakRating: r.peak_rating,
            gamesPlayed: r.games_played,
            wins: r.wins,
            losses: r.losses,
            draws: r.draws,
            rank: rankForRating(r.rating),
            toNextRank: ratingToNextRank(r.rating),
          }));

        setData({
          level: levelProgress(p.xp),
          gamesPlayed: p.total_games_played,
          wins: p.total_wins,
          losses: p.total_losses,
          draws: p.total_draws,
          // Guard against dividing by zero for a player with no games yet.
          winRate: p.total_games_played > 0 ? p.total_wins / p.total_games_played : 0,
          currentStreak: p.current_streak,
          bestStreak: p.best_streak,
          memberSince: p.created_at,
          ratings,
        });
        setError(null);
      } catch {
        if (!cancelled) setError("Couldn't load your profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { data, isLoading, error };
}
