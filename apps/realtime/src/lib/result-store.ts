import type { MatchResult } from "../handlers/game-handler.js";
import { log, errorFields } from "./logger.js";

export interface MatchRecord {
  /** Room code, used to find the persisted room. */
  roomCode: string;
  sessionId: string;
  startedAt: number;
  endedAt: number;
  result: MatchResult;
}

export interface ResultStore {
  recordMatch(record: MatchRecord): Promise<{ ok: boolean; reason?: string }>;
}

/** Bots have no profile row, so they can never be a foreign-keyed winner. */
export function isBotId(id: string | null): boolean {
  return typeof id === "string" && id.startsWith("bot-");
}

/**
 * Writes finished matches to Supabase over PostgREST.
 *
 * Uses the service-role key, which is a Worker secret and never reaches the
 * browser. Results are decided by the server, so clients must not be able to
 * write these tables at all (spec sections 63, 83).
 *
 * A room that was never persisted -- someone navigating straight to a room code
 * rather than creating one through the API -- is skipped rather than treated as
 * an error: the match stays playable, it just isn't recorded.
 */
export class SupabaseResultStore implements ResultStore {
  constructor(
    private readonly supabaseUrl: string,
    private readonly serviceRoleKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      apikey: this.serviceRoleKey,
      Authorization: `Bearer ${this.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...extra,
    };
  }

  async recordMatch(record: MatchRecord): Promise<{ ok: boolean; reason?: string }> {
    const base = this.supabaseUrl.replace(/\/+$/, "");

    const roomRes = await this.fetchImpl(
      `${base}/rest/v1/rooms?code=eq.${encodeURIComponent(record.roomCode)}&select=id,game_id`,
      { headers: this.headers() },
    );
    if (!roomRes.ok) return { ok: false, reason: `room lookup failed (${roomRes.status})` };

    const rooms = (await roomRes.json()) as Array<{ id: string; game_id: string }>;
    const room = rooms[0];
    if (!room) return { ok: false, reason: "room not persisted; result skipped" };

    const sessionRes = await this.fetchImpl(`${base}/rest/v1/game_sessions`, {
      method: "POST",
      headers: this.headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({
        id: record.sessionId,
        room_id: room.id,
        game_id: room.game_id,
        status: "completed",
        started_at: new Date(record.startedAt).toISOString(),
        ended_at: new Date(record.endedAt).toISOString(),
      }),
    });
    if (!sessionRes.ok) return { ok: false, reason: `session write failed (${sessionRes.status})` };

    const resultRes = await this.fetchImpl(`${base}/rest/v1/game_results`, {
      method: "POST",
      headers: this.headers({ Prefer: "return=minimal" }),
      body: JSON.stringify({
        session_id: record.sessionId,
        room_id: room.id,
        game_id: room.game_id,
        // A bot winner is stored in `scores` but not in winner_id, which
        // references profiles and would otherwise violate the foreign key.
        winner_id: isBotId(record.result.winnerId) ? null : record.result.winnerId,
        scores: record.result.scores,
        duration_seconds: record.result.durationSeconds,
        finish_reason: record.result.reason,
      }),
    });
    if (!resultRes.ok) return { ok: false, reason: `result write failed (${resultRes.status})` };

    return { ok: true };
  }
}

/** Builds a store when the Worker is configured for it; null otherwise. */
export function createResultStore(env: {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}): ResultStore | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return new SupabaseResultStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Records a match without ever failing the game.
 *
 * Players have already been told the result by the time this runs; a database
 * problem must not surface as a broken match (spec section 67).
 */
export async function recordMatchSafely(
  store: ResultStore | null,
  record: MatchRecord,
): Promise<void> {
  if (!store) return;
  try {
    const outcome = await store.recordMatch(record);
    if (outcome.ok) {
      log.info("result.persisted", { roomCode: record.roomCode, sessionId: record.sessionId });
    } else {
      log.warn("result.not_persisted", { roomCode: record.roomCode, reason: outcome.reason });
    }
  } catch (err) {
    log.error("result.persist_failed", { roomCode: record.roomCode, ...errorFields(err) });
  }
}
