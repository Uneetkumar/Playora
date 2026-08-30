/**
 * Query keys, in one place.
 *
 * Keys are how a cache entry is found and invalidated, so an inline array
 * literal at each call site is a cache miss waiting to happen — `["matches",
 * userId]` in one file and `["match-history", userId]` in another are two
 * caches of the same data that never agree.
 */
export const queryKeys = {
  progression: (userId: string | null | undefined) => ["progression", userId] as const,

  matchHistory: (
    userId: string | null | undefined,
    gameSlug: string | null,
    page: number,
    limit: number,
  ) => ["match-history", userId, gameSlug, page, limit] as const,

  recentMatches: (userId: string | null | undefined, limit: number) =>
    ["match-history", userId, "recent", limit] as const,

  matchDetail: (sessionId: string, userId: string | null | undefined) =>
    ["match-detail", sessionId, userId] as const,

  leaderboard: (gameSlug: string, scope: string, userId: string | null | undefined) =>
    ["leaderboard", gameSlug, scope, userId] as const,

  achievements: (userId: string | null | undefined) => ["achievements", userId] as const,

  friends: (userId: string | null | undefined) => ["friends", userId] as const,

  season: (gameSlug: string | null, userId: string | null | undefined) =>
    ["season", gameSlug, userId] as const,
} as const;
