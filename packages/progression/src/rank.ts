/**
 * Competitive rank tiers.
 *
 * A presentational band derived from rating — a third concept, separate from
 * both rating and platform level (spec sections 11, 104.6).
 */
export interface RankTier {
  id: string;
  label: string;
  /** Inclusive lower bound. */
  minRating: number;
  /** Token name, not a raw colour. */
  color: string;
}

export const RANK_TIERS: readonly RankTier[] = [
  { id: "bronze", label: "Bronze", minRating: 0, color: "warning" },
  { id: "silver", label: "Silver", minRating: 1100, color: "muted-foreground" },
  { id: "gold", label: "Gold", minRating: 1300, color: "warning" },
  { id: "platinum", label: "Platinum", minRating: 1500, color: "cyan" },
  { id: "diamond", label: "Diamond", minRating: 1750, color: "secondary" },
  { id: "master", label: "Master", minRating: 2000, color: "pink" },
  { id: "grandmaster", label: "Grandmaster", minRating: 2300, color: "primary" },
] as const;

export function rankForRating(rating: number): RankTier {
  let tier = RANK_TIERS[0]!;
  for (const candidate of RANK_TIERS) {
    if (rating >= candidate.minRating) tier = candidate;
  }
  return tier;
}

/** Rating still needed for the next tier, or null at the top. */
export function ratingToNextRank(rating: number): { tier: RankTier; needed: number } | null {
  const next = RANK_TIERS.find((t) => t.minRating > rating);
  return next ? { tier: next, needed: next.minRating - rating } : null;
}
