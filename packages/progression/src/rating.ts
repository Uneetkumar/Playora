/**
 * Per-game Elo rating.
 *
 * Ratings are **per game** (spec section 13): a strong chess player is not
 * automatically a strong racer. Platform level and XP are a separate system
 * entirely and must never be conflated with this (spec section 104.6).
 */

export const BASE_RATING = 1200;

/** Matches played before a rating is considered settled. */
export const PROVISIONAL_GAMES = 20;

/**
 * How far a single result can move a rating.
 *
 * New players move fast so they reach their true level quickly; established
 * players move slowly so one bad game does not undo a season.
 */
export function kFactor(gamesPlayed: number, rating: number): number {
  if (gamesPlayed < PROVISIONAL_GAMES) return 40;
  if (rating >= 2400) return 16;
  return 24;
}

/** Probability that `rating` beats `opponentRating`. */
export function expectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}

/** Result from one player's point of view. */
export type Outcome = "win" | "loss" | "draw";

export function scoreOf(outcome: Outcome): number {
  if (outcome === "win") return 1;
  if (outcome === "draw") return 0.5;
  return 0;
}

export interface RatingInput {
  rating: number;
  gamesPlayed: number;
  opponentRating: number;
  outcome: Outcome;
}

export interface RatingChange {
  before: number;
  after: number;
  delta: number;
}

/**
 * Applies one result to a rating.
 *
 * Ratings are floored at 100 so a losing streak cannot drive a player into
 * negative numbers, which read as broken rather than as feedback.
 */
export function applyRating(input: RatingInput): RatingChange {
  const k = kFactor(input.gamesPlayed, input.rating);
  const expected = expectedScore(input.rating, input.opponentRating);
  const actual = scoreOf(input.outcome);

  const after = Math.max(100, Math.round(input.rating + k * (actual - expected)));
  return { before: input.rating, after, delta: after - input.rating };
}

/**
 * Whether a result should move competitive rating.
 *
 * Bot matches do not by default (spec section 13) — practising against an AI
 * should never inflate or deflate a competitive number.
 */
export type MatchType = "human" | "bot" | "mixed";

export function isRated(matchType: MatchType): boolean {
  return matchType === "human";
}

export function classifyMatch(participants: Array<{ isBot?: boolean }>): MatchType {
  const bots = participants.filter((p) => p.isBot).length;
  if (bots === 0) return "human";
  if (bots === participants.length) return "bot";
  return "mixed";
}
