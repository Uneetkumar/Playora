import {
  applyRating,
  classifyMatch,
  evaluateAchievements,
  isRated,
  levelForXp,
  seasonStartRating,
  xpForMatch,
  type AchievementContext,
  type Outcome,
} from "@playora/progression";
import type { MatchResult } from "../handlers/game-handler.js";
import { log, errorFields } from "./logger.js";
import { isBotId } from "./result-store.js";

interface Participant {
  userId: string;
  outcome: Outcome;
  isBot: boolean;
}

/**
 * What one player gained or lost from a match.
 *
 * All of this was already computed in order to write it; returning it as well
 * means the result screen can show real numbers the moment the match ends,
 * instead of the client re-reading rows it just caused to be written.
 */
export interface PlayerProgression {
  userId: string;
  outcome: Outcome;
  /** Unrated matches (against bots, or offline) still award XP but not rating. */
  rated: boolean;
  ratingBefore: number;
  ratingAfter: number;
  ratingDelta: number;
  xpBefore: number;
  xpAfter: number;
  xpGained: number;
  levelBefore: number;
  levelAfter: number;
  streak: number;
  bestStreak: number;
  /** Achievement ids unlocked by this match, if any. */
  unlockedAchievements: string[];
}

/**
 * Applies rating, XP and streaks after a finished match.
 *
 * Runs after the result has already been broadcast and written, so a failure
 * here costs a player their points but never their game (spec section 67).
 */
export class SupabaseProgressionStore {
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly supabaseUrl: string,
    private readonly serviceRoleKey: string,
    fetchImpl?: typeof fetch,
  ) {
    // Bound to globalThis: see result-store.ts.
    this.fetchImpl = fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  /**
   * The active season, looked up once per instance.
   *
   * `undefined` means "not asked yet"; `null` means "asked, and there is no
   * active season". The two must stay distinct or every match would re-query
   * on a platform that happens to be between seasons.
   */
  private activeSeason: { id: string } | null | undefined;

  private get base(): string {
    return this.supabaseUrl.replace(/\/+$/, "");
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      apikey: this.serviceRoleKey,
      Authorization: `Bearer ${this.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...extra,
    };
  }

  private async json<T>(path: string, init?: RequestInit): Promise<T | null> {
    const res = await this.fetchImpl(`${this.base}${path}`, {
      ...init,
      headers: this.headers((init?.headers as Record<string, string>) ?? {}),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : null;
  }

  /**
   * An upsert that names its conflict target and does not fail quietly.
   *
   * Both halves of that matter, and both were learned the hard way. PostgREST
   * resolves `merge-duplicates` against the primary key unless told otherwise,
   * and these tables have a surrogate `id` that never collides — so without an
   * explicit `on_conflict` every write after a player's first hit the composite
   * unique constraint and returned 409. Because the response was never checked,
   * the failure was invisible: rating_history filled up with deltas while the
   * rating itself stayed frozen at whatever the first match set it to.
   */
  private async upsert(
    table: string,
    onConflict: string,
    body: unknown,
    context: Record<string, unknown>,
  ): Promise<boolean> {
    const res = await this.fetchImpl(
      `${this.base}/rest/v1/${table}?on_conflict=${onConflict}`,
      {
        method: "POST",
        headers: this.headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      log.error("progression.upsert_failed", {
        table,
        status: res.status,
        body: await res.text().catch(() => ""),
        ...context,
      });
      return false;
    }
    return true;
  }

  async apply(params: {
    /** The games table UUID, for rating rows. */
    gameId: string;
    /** The engine's slug ("chess", "uno"), which is what achievements key on. */
    gameSlug: string;
    sessionId: string;
    result: MatchResult;
    botIds: string[];
  }): Promise<{ ok: boolean; reason?: string; players: PlayerProgression[] }> {
    const botSet = new Set(params.botIds);
    const participants: Participant[] = params.result.scores.map((s) => ({
      userId: s.userId,
      outcome: outcomeFor(s, params.result),
      isBot: botSet.has(s.userId) || isBotId(s.userId),
    }));

    const matchType = classifyMatch(participants);
    const rated = isRated(matchType);
    const humans = participants.filter((p) => !p.isBot);
    const progressions: PlayerProgression[] = [];

    for (const player of humans) {
      // Opponents' average rating stands in for a single opponent in games with
      // more than two seats; exact pairwise Elo is overkill until such a game exists.
      const opponents = participants.filter((p) => p.userId !== player.userId);

      const current = await this.json<Array<{ rating: number; games_played: number }>>(
        `/rest/v1/game_ratings?user_id=eq.${player.userId}&game_id=eq.${params.gameId}&select=rating,games_played`,
      );
      let rating = current?.[0]?.rating ?? 1200;
      const ratingBefore = rating;
      const gamesPlayed = current?.[0]?.games_played ?? 0;

      if (rated && opponents.length > 0) {
        const opponentRatings = await Promise.all(
          opponents.map(async (o) => {
            const row = await this.json<Array<{ rating: number }>>(
              `/rest/v1/game_ratings?user_id=eq.${o.userId}&game_id=eq.${params.gameId}&select=rating`,
            );
            return row?.[0]?.rating ?? 1200;
          }),
        );
        const averageOpponent = Math.round(
          opponentRatings.reduce((a, b) => a + b, 0) / opponentRatings.length,
        );

        const change = applyRating({
          rating,
          gamesPlayed,
          opponentRating: averageOpponent,
          outcome: player.outcome,
        });
        rating = change.after;

        const historyRes = await this.fetchImpl(`${this.base}/rest/v1/rating_history`, {
          method: "POST",
          headers: this.headers({ Prefer: "return=minimal" }),
          body: JSON.stringify({
            user_id: player.userId,
            game_id: params.gameId,
            session_id: params.sessionId,
            rating_before: change.before,
            rating_after: change.after,
            delta: change.delta,
            outcome: player.outcome,
          }),
        });

        if (!historyRes.ok) {
          // Not fatal — the rating itself is written separately below — but it
          // leaves a gap in the rating chart, and a silent gap is one nobody
          // goes looking for.
          log.error("progression.history_write_failed", {
            userId: player.userId,
            gameId: params.gameId,
            status: historyRes.status,
          });
        }
      }

      await this.upsertRating(player, params.gameId, rating, rated);
      if (rated) await this.upsertSeasonRating(player, params.gameId, opponents, ratingBefore);
      const xp = await this.awardXp(player, params.result.durationSeconds, rated);
      if (xp) {
        const unlockedAchievements = await this.awardAchievements(player, {
          gameSlug: params.gameSlug,
          sessionId: params.sessionId,
          durationSeconds: params.result.durationSeconds,
          reason: params.result.reason,
          rated,
          totals: xp.totals,
        });
        progressions.push({
          userId: player.userId,
          outcome: player.outcome,
          rated,
          ratingBefore,
          ratingAfter: rating,
          ratingDelta: rating - ratingBefore,
          ...xp.progression,
          unlockedAchievements,
        });
      }
    }

    log.info("progression.applied", {
      gameId: params.gameId,
      sessionId: params.sessionId,
      matchType,
      rated,
      humans: humans.length,
    });
    return { ok: true, players: progressions };
  }

  private async upsertRating(
    player: Participant,
    gameId: string,
    rating: number,
    rated: boolean,
  ): Promise<void> {
    const existing = await this.json<
      Array<{ games_played: number; wins: number; losses: number; draws: number; peak_rating: number }>
    >(
      `/rest/v1/game_ratings?user_id=eq.${player.userId}&game_id=eq.${gameId}` +
        `&select=games_played,wins,losses,draws,peak_rating`,
    );
    const row = existing?.[0];

    await this.upsert(
      "game_ratings",
      "user_id,game_id",
      {
        user_id: player.userId,
        game_id: gameId,
        rating,
        peak_rating: Math.max(rating, row?.peak_rating ?? rating),
        games_played: (row?.games_played ?? 0) + 1,
        wins: (row?.wins ?? 0) + (player.outcome === "win" ? 1 : 0),
        losses: (row?.losses ?? 0) + (player.outcome === "loss" ? 1 : 0),
        draws: (row?.draws ?? 0) + (player.outcome === "draw" ? 1 : 0),
        updated_at: new Date().toISOString(),
      },
      { userId: player.userId, gameId },
    );
    void rated;
  }

  /**
   * The season a result counts towards, or null if there is not one.
   *
   * Asked of the database rather than computed from a config constant, because
   * the season boundary has to be the same one the leaderboard reads. Two
   * places deciding independently when Season One ended is how a match lands in
   * a season nobody is looking at.
   */
  private async currentSeason(): Promise<{ id: string } | null> {
    if (this.activeSeason !== undefined) return this.activeSeason;

    const now = new Date().toISOString();
    const rows = await this.json<Array<{ id: string }>>(
      `/rest/v1/seasons?select=id&starts_at=lte.${now}&ends_at=gt.${now}&limit=1`,
    );
    this.activeSeason = rows?.[0] ?? null;
    return this.activeSeason;
  }

  /**
   * Applies the result to the season ladder, which is its own Elo pool.
   *
   * Deliberately a second Elo pass rather than copying the all-time delta
   * across. A delta is a function of the gap between two ratings, and the gap
   * on the season ladder is not the gap on the all-time one -- borrowing the
   * number would make the season table a distorted shadow of the all-time table
   * instead of a standing in its own right, which is the one thing seasons
   * exist to provide.
   *
   * A player's first result in a season seeds their row from a soft reset of
   * their all-time rating. That is a better starting guess than 1200 for anyone
   * who has played before, and it needs no lookup into a previous season, so it
   * works identically for season one and season nine.
   */
  private async upsertSeasonRating(
    player: Participant,
    gameId: string,
    opponents: Participant[],
    allTimeRating: number,
  ): Promise<void> {
    const season = await this.currentSeason();
    if (!season) return;

    const ids = [player.userId, ...opponents.map((o) => o.userId)];
    const rows =
      (await this.json<
        Array<{
          user_id: string;
          rating: number;
          peak_rating: number;
          games_played: number;
          wins: number;
          losses: number;
          draws: number;
        }>
      >(
        `/rest/v1/season_ratings?season_id=eq.${season.id}&game_id=eq.${gameId}` +
          `&user_id=in.(${ids.join(",")})` +
          `&select=user_id,rating,peak_rating,games_played,wins,losses,draws`,
      )) ?? [];

    const byUser = new Map(rows.map((r) => [r.user_id, r]));
    const mine = byUser.get(player.userId);
    const seed = seasonStartRating(allTimeRating);
    let rating = mine?.rating ?? seed;

    const opponentRatings = opponents.map(
      (o) => byUser.get(o.userId)?.rating ?? seasonStartRating(null),
    );

    if (opponentRatings.length > 0) {
      const average = Math.round(
        opponentRatings.reduce((a, b) => a + b, 0) / opponentRatings.length,
      );
      rating = applyRating({
        rating,
        gamesPlayed: mine?.games_played ?? 0,
        opponentRating: average,
        outcome: player.outcome,
      }).after;
    }

    await this.upsert(
      "season_ratings",
      "season_id,user_id,game_id",
      {
        season_id: season.id,
        user_id: player.userId,
        game_id: gameId,
        rating,
        peak_rating: Math.max(rating, mine?.peak_rating ?? rating),
        games_played: (mine?.games_played ?? 0) + 1,
        wins: (mine?.wins ?? 0) + (player.outcome === "win" ? 1 : 0),
        losses: (mine?.losses ?? 0) + (player.outcome === "loss" ? 1 : 0),
        draws: (mine?.draws ?? 0) + (player.outcome === "draw" ? 1 : 0),
        updated_at: new Date().toISOString(),
      },
      { userId: player.userId, gameId, seasonId: season.id },
    );
  }

  private async awardXp(
    player: Participant,
    durationSeconds: number,
    rated: boolean,
  ): Promise<{
    progression: Omit<
      PlayerProgression,
      | "userId"
      | "outcome"
      | "rated"
      | "ratingBefore"
      | "ratingAfter"
      | "ratingDelta"
      | "unlockedAchievements"
    >;
    totals: AchievementContext["totals"];
  } | null> {
    const profile = await this.json<
      Array<{
        xp: number;
        total_games_played: number;
        total_wins: number;
        total_losses: number;
        total_draws: number;
        current_streak: number;
        best_streak: number;
      }>
    >(
      `/rest/v1/profiles?id=eq.${player.userId}` +
        `&select=xp,total_games_played,total_wins,total_losses,total_draws,current_streak,best_streak`,
    );
    const p = profile?.[0];
    if (!p) return null;

    const gained = xpForMatch({ outcome: player.outcome, durationSeconds, rated });
    const xp = p.xp + gained;
    // A streak counts consecutive wins; any other result ends it.
    const streak = player.outcome === "win" ? p.current_streak + 1 : 0;

    const patchRes = await this.fetchImpl(`${this.base}/rest/v1/profiles?id=eq.${player.userId}`, {
      method: "PATCH",
      headers: this.headers({ Prefer: "return=minimal" }),
      body: JSON.stringify({
        xp,
        level: levelForXp(xp),
        total_games_played: p.total_games_played + 1,
        total_wins: p.total_wins + (player.outcome === "win" ? 1 : 0),
        total_losses: p.total_losses + (player.outcome === "loss" ? 1 : 0),
        total_draws: p.total_draws + (player.outcome === "draw" ? 1 : 0),
        current_streak: streak,
        best_streak: Math.max(p.best_streak, streak),
        last_played_at: new Date().toISOString(),
      }),
    });

    if (!patchRes.ok) {
      // Returning null costs this player their result animation, and that is
      // the right trade. The numbers below are what the client counts up on
      // the result screen, and reporting an XP gain that was never written
      // shows the player a level-up they do not have — worse than showing
      // nothing, because they only find out it was false later.
      log.error("progression.xp_write_failed", {
        userId: player.userId,
        status: patchRes.status,
        body: await patchRes.text().catch(() => ""),
      });
      return null;
    }

    const totalsAfter = {
      gamesPlayed: p.total_games_played + 1,
      wins: p.total_wins + (player.outcome === "win" ? 1 : 0),
      losses: p.total_losses + (player.outcome === "loss" ? 1 : 0),
      draws: p.total_draws + (player.outcome === "draw" ? 1 : 0),
      currentStreak: streak,
      bestStreak: Math.max(p.best_streak, streak),
      level: levelForXp(xp),
      xp,
    };

    return {
      progression: {
        xpBefore: p.xp,
        xpAfter: xp,
        xpGained: gained,
        levelBefore: levelForXp(p.xp),
        levelAfter: levelForXp(xp),
        streak,
        bestStreak: totalsAfter.bestStreak,
      },
      totals: totalsAfter,
    };
  }

  /**
   * Evaluates the achievement catalogue and records anything newly unlocked.
   *
   * Runs after the rating and XP writes, so it sees the same numbers the player
   * will. Everything here is best-effort: an achievement that fails to save is
   * re-evaluated after the player's next match, because the conditions are
   * expressed over lifetime totals rather than over "what happened just now".
   */
  private async awardAchievements(
    player: Participant,
    match: {
      gameSlug: string;
      sessionId: string;
      durationSeconds: number;
      reason: string;
      rated: boolean;
      totals: AchievementContext["totals"];
    },
  ): Promise<string[]> {
    try {
      const [existing, ratings] = await Promise.all([
        this.json<Array<{ achievement_id: string }>>(
          `/rest/v1/user_achievements?user_id=eq.${player.userId}&select=achievement_id`,
        ),
        this.json<
          Array<{
            rating: number;
            peak_rating: number;
            games_played: number;
            wins: number;
            games: { slug: string } | null;
          }>
        >(
          `/rest/v1/game_ratings?user_id=eq.${player.userId}` +
            `&select=rating,peak_rating,games_played,wins,games(slug)`,
        ),
      ]);

      const perGame: AchievementContext["perGame"] = {};
      for (const row of ratings ?? []) {
        const slug = row.games?.slug;
        if (!slug) continue;
        perGame[slug] = {
          gamesPlayed: row.games_played,
          wins: row.wins,
          rating: row.rating,
          peakRating: row.peak_rating,
        };
      }

      const unlocked = evaluateAchievements(
        {
          totals: match.totals,
          perGame,
          match: {
            gameSlug: match.gameSlug,
            outcome: player.outcome,
            durationSeconds: match.durationSeconds,
            reason: match.reason,
            rated: match.rated,
          },
        },
        (existing ?? []).map((row) => row.achievement_id),
      );

      if (unlocked.length === 0) return [];

      const res = await this.fetchImpl(`${this.base}/rest/v1/user_achievements`, {
        method: "POST",
        // A race between two matches finishing could try to insert the same
        // unlock twice; the primary key makes that a no-op rather than an error.
        headers: this.headers({ Prefer: "resolution=ignore-duplicates,return=minimal" }),
        body: JSON.stringify(
          unlocked.map((a) => ({
            user_id: player.userId,
            achievement_id: a.id,
            session_id: match.sessionId,
          })),
        ),
      });
      if (!res.ok) {
        log.warn("achievements.not_saved", { userId: player.userId, status: res.status });
        return [];
      }

      log.info("achievements.unlocked", {
        userId: player.userId,
        ids: unlocked.map((a) => a.id),
      });
      return unlocked.map((a) => a.id);
    } catch (err) {
      log.error("achievements.failed", { userId: player.userId, ...errorFields(err) });
      return [];
    }
  }
}

function outcomeFor(
  score: MatchResult["scores"][number],
  result: MatchResult,
): Outcome {
  if (result.reason === "draw" || result.winnerId === null) return "draw";
  return score.isWinner ? "win" : "loss";
}

export function createProgressionStore(env: {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}): SupabaseProgressionStore | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return new SupabaseProgressionStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Never lets a progression failure surface as a broken match. */
export async function applyProgressionSafely(
  store: SupabaseProgressionStore | null,
  params: Parameters<SupabaseProgressionStore["apply"]>[0],
): Promise<PlayerProgression[]> {
  if (!store) return [];
  try {
    const outcome = await store.apply(params);
    return outcome.players;
  } catch (err) {
    log.error("progression.failed", { sessionId: params.sessionId, ...errorFields(err) });
    return [];
  }
}
