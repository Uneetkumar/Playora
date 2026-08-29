import { generateRoomCode } from "@playora/game-types";
import { log, errorFields } from "./logger.js";

export interface CreatedRoom {
  id: string;
  code: string;
}

/**
 * Creates the persisted room a matched group will play in.
 *
 * Matchmaking needs a room that exists in Postgres before it can tell players
 * where to go, otherwise the match would not be recordable when it finishes.
 * Uses the service-role key, which is a Worker secret.
 */
export class SupabaseRoomStore {
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly supabaseUrl: string,
    private readonly serviceRoleKey: string,
    fetchImpl?: typeof fetch,
  ) {
    // Must be bound to globalThis on Workers; see result-store.ts.
    this.fetchImpl = fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      apikey: this.serviceRoleKey,
      Authorization: `Bearer ${this.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...extra,
    };
  }

  async createMatchRoom(params: {
    gameSlug: string;
    hostId: string;
    maxPlayers: number;
  }): Promise<CreatedRoom | null> {
    const base = this.supabaseUrl.replace(/\/+$/, "");

    const gameRes = await this.fetchImpl(
      `${base}/rest/v1/games?slug=eq.${encodeURIComponent(params.gameSlug)}&select=id`,
      { headers: this.headers() },
    );
    if (!gameRes.ok) return null;
    const game = ((await gameRes.json()) as Array<{ id: string }>)[0];
    if (!game) return null;

    // The unique index on rooms.code is the real guard; retry on a clash.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateRoomCode();
      const res = await this.fetchImpl(`${base}/rest/v1/rooms`, {
        method: "POST",
        headers: this.headers({ Prefer: "return=representation" }),
        body: JSON.stringify({
          code,
          name: "Quick Match",
          host_id: params.hostId,
          game_id: game.id,
          status: "waiting",
          is_private: true, // matched rooms are not listed publicly
          max_players: params.maxPlayers,
          settings: { source: "quick_match" },
        }),
      });
      if (res.ok) {
        const row = ((await res.json()) as Array<{ id: string; code: string }>)[0];
        if (row) return { id: row.id, code: row.code };
      }
      if (res.status !== 409) return null;
    }
    return null;
  }
}

export function createRoomStore(env: {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}): SupabaseRoomStore | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return new SupabaseRoomStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Reads a player's rating for the given game, defaulting to the base rating. */
export async function fetchRating(
  env: { SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string },
  userId: string,
): Promise<number> {
  const DEFAULT_RATING = 1200;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return DEFAULT_RATING;
  try {
    const res = await globalThis.fetch(
      `${env.SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/profiles?id=eq.${userId}&select=rating`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    );
    if (!res.ok) return DEFAULT_RATING;
    const rows = (await res.json()) as Array<{ rating: number }>;
    return rows[0]?.rating ?? DEFAULT_RATING;
  } catch (err) {
    log.warn("rating.lookup_failed", { userId, ...errorFields(err) });
    return DEFAULT_RATING;
  }
}
