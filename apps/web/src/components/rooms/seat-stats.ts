"use client";

import * as React from "react";
import type { GameId, Player } from "@playora/game-types";
import { usePlayerProgression } from "../../hooks/use-progression";

/** What a seat card can say about a player beyond their name. All of it optional. */
export interface SeatStats {
  /** Platform level, from XP. */
  level?: number;
  /** Rating in this room's game, when they have played it rated. */
  rating?: number;
  /** The rank tier that rating falls in ("Gold"). */
  rankLabel?: string;
}

/**
 * A seated human's level and their rating in this game, read from their
 * progression.
 *
 * Nothing is shown until real numbers arrive: a bot has none, a signed-out
 * build without Supabase has none, and a player who has never played this
 * game rated has a level but no rating. The card leaves those lines out
 * rather than filling them with placeholders.
 */
export function useSeatStats(player: Player | null, gameId: GameId): SeatStats | null {
  const userId = player && !player.isBot ? player.userId : null;
  const { data } = usePlayerProgression(userId);

  return React.useMemo(() => {
    if (!data) return null;
    const rating = data.ratings.find((r) => r.gameSlug === gameId);
    return {
      level: data.level.level,
      ...(rating ? { rating: rating.rating, rankLabel: rating.rank.label } : {}),
    };
  }, [data, gameId]);
}
