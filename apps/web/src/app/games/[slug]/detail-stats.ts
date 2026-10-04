import type { GameRating } from "../../../hooks/use-progression";
import type { LocalMatchRecord } from "../../../hooks/use-local-history";

/**
 * The detail page's "Your stats" strip, from records that exist: the
 * account's rating for this game and the matches finished on this device.
 *
 * Nothing here invents a number. The page used to fall back to a 1200 rating,
 * a Silver badge, "100 more rating to reach Gold" and a bar fixed at 75% for
 * anyone with no rated games, which told a new player they had a standing
 * they did not have. A stat with no record behind it is left out, and so is
 * the strip when every stat is.
 */

export interface DetailStat {
  id: "rating" | "record" | "played" | "wins" | "best";
  label: string;
  value: string;
  hint?: string;
}

/** The account's rating for this game, only once a rated game has been played. */
export function ratedStanding(rating: GameRating | null | undefined): GameRating | null {
  return rating && rating.gamesPlayed > 0 ? rating : null;
}

/**
 * The highest score on this device, for a game whose score means something.
 *
 * Only solo games qualify. The board games write 100, 50 or 0 as a stand-in
 * for win, draw or loss, so their "best" would always read 100; the arcade
 * games write the points the player actually scored, where higher is better.
 */
export function bestScore(records: readonly LocalMatchRecord[], solo: boolean): number | null {
  if (!solo) return null;
  let best: number | null = null;
  for (const r of records) {
    if (typeof r.score === "number" && Number.isFinite(r.score) && r.score > 0) {
      best = best === null ? r.score : Math.max(best, r.score);
    }
  }
  return best;
}

const count = new Intl.NumberFormat("en");

export function detailStats({
  rating,
  local,
  solo,
}: {
  rating: GameRating | null | undefined;
  /** This game's records from this device. */
  local: readonly LocalMatchRecord[];
  /** The game has no opponent, so wins are not a measure and scores are. */
  solo: boolean;
}): DetailStat[] {
  const stats: DetailStat[] = [];
  const rated = ratedStanding(rating);

  if (rated) {
    stats.push(
      {
        id: "rating",
        label: "Rating",
        value: count.format(rated.rating),
        hint: `Peak ${count.format(rated.peakRating)} · ${rated.rank.label}`,
      },
      {
        id: "record",
        label: "Rated record",
        value: `${rated.wins}–${rated.losses}–${rated.draws}`,
        hint: `${count.format(rated.gamesPlayed)} rated ${rated.gamesPlayed === 1 ? "game" : "games"}`,
      },
    );
  }

  if (local.length > 0) {
    stats.push({
      id: "played",
      label: "Played here",
      value: count.format(local.length),
      hint: "On this device",
    });

    if (!solo) {
      const wins = local.filter((r) => r.outcome === "win").length;
      stats.push({
        id: "wins",
        label: "Wins",
        value: count.format(wins),
        hint: `${Math.round((wins / local.length) * 100)}% of games here`,
      });
    }
  }

  const best = bestScore(local, solo);
  if (best !== null) {
    stats.push({ id: "best", label: "Best score", value: count.format(best), hint: "On this device" });
  }

  return stats;
}
