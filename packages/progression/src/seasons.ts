/**
 * Competitive seasons (spec section 15).
 *
 * A season is a time-boxed competitive period. It does **not** replace the
 * all-time per-game rating in `game_ratings` — it runs beside it, in its own
 * rows, so that "best I have ever been at chess" and "how I am doing this
 * season" stay two different questions with two different answers. Wiping the
 * all-time rating every few months would throw away the only long-run record
 * the platform has of a player's skill.
 *
 * This module is pure. Everything here is arithmetic over dates and numbers, so
 * the season boundary, the reset and the placement bands can all be tested
 * without a database — which matters, because the one thing that must never be
 * wrong is who finished where when a season closes.
 */

import { BASE_RATING } from "./rating.js";

export interface Season {
  id: string;
  slug: string;
  name: string;
  /** Inclusive. */
  startsAt: number;
  /** Exclusive: a season ends the instant the next one may begin. */
  endsAt: number;
  /**
   * When final standings were written, or null if they have not been.
   *
   * Deliberately a timestamp rather than a status string. A season being over
   * (a fact about the clock) and its placements having been computed (a fact
   * about work the server has done) are two different things, and a single
   * `status` column would have to lie about one of them in the window between.
   */
  closedAt: number | null;
}

export type SeasonPhase = "upcoming" | "active" | "ended";

/**
 * Where a season sits relative to now.
 *
 * Derived from the dates every time rather than stored, because a stored status
 * is only as current as the last job that updated it — and a season that ended
 * an hour ago but still says "active" would keep accepting results into it.
 */
export function seasonPhase(season: Season, now: number): SeasonPhase {
  if (now < season.startsAt) return "upcoming";
  if (now >= season.endsAt) return "ended";
  return "active";
}

/** Milliseconds until a season ends, or 0 once it has. */
export function timeRemaining(season: Season, now: number): number {
  return Math.max(0, season.endsAt - now);
}

/** How far through a season we are, 0 to 1. */
export function seasonProgress(season: Season, now: number): number {
  const span = season.endsAt - season.startsAt;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (now - season.startsAt) / span));
}

/**
 * How much of a rating carries into the next season.
 *
 * 0.6 keeps enough that a strong player is not thrown back in with beginners,
 * and sheds enough that the top of the ladder is reachable again.
 */
export const SEASON_RETENTION = 0.6;

/**
 * A player's starting rating for a new season.
 *
 * Regression toward the mean, symmetric on purpose: a player who finished at
 * 2000 starts at 1680, and one who finished at 900 starts at 1020. Pulling weak
 * players *up* looks wrong at first glance, but the reset also clears
 * `games_played`, so everyone is provisional again and moves at K=40 — a player
 * placed above their level falls back within a handful of games. Compressing
 * the whole distribution is the point; only compressing the top would push
 * every season's ladder steadily downward.
 */
export function seasonStartRating(previousRating: number | null): number {
  if (previousRating === null) return BASE_RATING;
  return Math.round(BASE_RATING + (previousRating - BASE_RATING) * SEASON_RETENTION);
}

/**
 * Games needed in a season before a player is ranked in it.
 *
 * Without a floor, one lucky win against a strong opponent on the last day
 * outranks someone who played all season, because a single result can carry a
 * provisional rating a long way.
 */
export const SEASON_PLACEMENT_GAMES = 10;

export function isPlaced(gamesPlayed: number): boolean {
  return gamesPlayed >= SEASON_PLACEMENT_GAMES;
}

export type PlacementTier =
  | "champion"
  | "elite"
  | "veteran"
  | "challenger"
  | "competitor"
  | "participant";

/**
 * Population below which percentile bands are not used.
 *
 * "Top 1%" of eleven players is one player, and calling them elite says nothing
 * about them. Under this threshold only first place is distinguished.
 */
export const MIN_POPULATION_FOR_PERCENTILES = 20;

export interface PlacementBand {
  tier: PlacementTier;
  label: string;
  /** Upper bound of the band as a fraction of the ranked population. */
  maxPercentile: number;
}

export const PLACEMENT_BANDS: readonly PlacementBand[] = [
  { tier: "elite", label: "Elite", maxPercentile: 0.01 },
  { tier: "veteran", label: "Veteran", maxPercentile: 0.1 },
  { tier: "challenger", label: "Challenger", maxPercentile: 0.25 },
  { tier: "competitor", label: "Competitor", maxPercentile: 0.5 },
  { tier: "participant", label: "Participant", maxPercentile: 1 },
] as const;

/**
 * The reward band for a final position.
 *
 * `rank` is 1-based and `totalRanked` counts only players who met
 * `SEASON_PLACEMENT_GAMES`, so the percentile is over people who actually
 * competed rather than everyone who opened the game once.
 */
export function placementTier(rank: number, totalRanked: number): PlacementTier {
  if (rank === 1) return "champion";
  if (totalRanked < MIN_POPULATION_FOR_PERCENTILES) return "competitor";

  const percentile = rank / totalRanked;
  for (const band of PLACEMENT_BANDS) {
    if (percentile <= band.maxPercentile) return band.tier;
  }
  return "participant";
}

export function placementLabel(tier: PlacementTier): string {
  if (tier === "champion") return "Champion";
  return PLACEMENT_BANDS.find((b) => b.tier === tier)?.label ?? "Participant";
}

/**
 * A human-readable countdown: "3 days left", "4 hours left", "Ended".
 *
 * Rounds down rather than to nearest, because a banner saying "1 day left" when
 * there are eleven hours left is a promise the platform cannot keep.
 */
export function formatTimeRemaining(season: Season, now: number): string {
  const ms = timeRemaining(season, now);
  if (ms <= 0) return "Ended";

  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days >= 1) return `${days} day${days === 1 ? "" : "s"} left`;
  if (hours >= 1) return `${hours} hour${hours === 1 ? "" : "s"} left`;
  if (minutes >= 1) return `${minutes} minute${minutes === 1 ? "" : "s"} left`;
  return "Ending now";
}
