import {
  applyRating,
  classifyMatch,
  isRated,
  levelForXp,
  xpForMatch,
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

  async apply(params: {
    gameId: string;
    sessionId: string;
    result: MatchResult;
    botIds: string[];
  }): Promise<{ ok: boolean; reason?: string }> {
    const botSet = new Set(params.botIds);
    const participants: Participant[] = params.result.scores.map((s) => ({
      userId: s.userId,
      outcome: outcomeFor(s, params.result),
      isBot: botSet.has(s.userId) || isBotId(s.userId),
    }));

    const matchType = classifyMatch(participants);
    const rated = isRated(matchType);
    const humans = participants.filter((p) => !p.isBot);

    for (const player of humans) {
      // Opponents' average rating stands in for a single opponent in games with
      // more than two seats; exact pairwise Elo is overkill until such a game exists.
      const opponents = participants.filter((p) => p.userId !== player.userId);

      const current = await this.json<Array<{ rating: number; games_played: number }>>(
        `/rest/v1/game_ratings?user_id=eq.${player.userId}&game_id=eq.${params.gameId}&select=rating,games_played`,
      );
      let rating = current?.[0]?.rating ?? 1200;
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

        await this.fetchImpl(`${this.base}/rest/v1/rating_history`, {
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
      }

      await this.upsertRating(player, params.gameId, rating, rated);
      await this.awardXp(player, params.result.durationSeconds, rated);
    }

    log.info("progression.applied", {
      gameId: params.gameId,
      sessionId: params.sessionId,
      matchType,
      rated,
      humans: humans.length,
    });
    return { ok: true };
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

    await this.fetchImpl(`${this.base}/rest/v1/game_ratings`, {
      method: "POST",
      headers: this.headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({
        user_id: player.userId,
        game_id: gameId,
        rating,
        peak_rating: Math.max(rating, row?.peak_rating ?? rating),
        games_played: (row?.games_played ?? 0) + 1,
        wins: (row?.wins ?? 0) + (player.outcome === "win" ? 1 : 0),
        losses: (row?.losses ?? 0) + (player.outcome === "loss" ? 1 : 0),
        draws: (row?.draws ?? 0) + (player.outcome === "draw" ? 1 : 0),
        updated_at: new Date().toISOString(),
      }),
    });
    void rated;
  }

  private async awardXp(
    player: Participant,
    durationSeconds: number,
    rated: boolean,
  ): Promise<void> {
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
    if (!p) return;

    const gained = xpForMatch({ outcome: player.outcome, durationSeconds, rated });
    const xp = p.xp + gained;
    // A streak counts consecutive wins; any other result ends it.
    const streak = player.outcome === "win" ? p.current_streak + 1 : 0;

    await this.fetchImpl(`${this.base}/rest/v1/profiles?id=eq.${player.userId}`, {
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
): Promise<void> {
  if (!store) return;
  try {
    await store.apply(params);
  } catch (err) {
    log.error("progression.failed", { sessionId: params.sessionId, ...errorFields(err) });
  }
}
