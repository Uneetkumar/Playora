import { describe, it, expect, vi } from "vitest";
import { SupabaseResultStore, isBotId, recordMatchSafely } from "../src/lib/result-store.js";
import type { MatchResult } from "../src/handlers/game-handler.js";

const URL_BASE = "https://example.supabase.co";
const KEY = "sb_secret_test";

const RESULT: MatchResult = {
  winnerId: "11111111-1111-4111-8111-111111111111",
  scores: [
    {
      playerId: "11111111-1111-4111-8111-111111111111",
      userId: "11111111-1111-4111-8111-111111111111",
      rank: 1,
      score: 1,
      isWinner: true,
    },
  ],
  durationSeconds: 120,
  reason: "normal",
};

const record = (over: Partial<Parameters<SupabaseResultStore["recordMatch"]>[0]> = {}) => ({
  roomCode: "ABCDEF",
  sessionId: "22222222-2222-4222-8222-222222222222",
  startedAt: 1_700_000_000_000,
  endedAt: 1_700_000_120_000,
  result: RESULT,
  ...over,
});

/** Fake PostgREST: room lookup, then two inserts. */
function fakeFetch(opts: { room?: unknown[]; sessionOk?: boolean; resultOk?: boolean } = {}) {
  const calls: Array<{ url: string; body?: unknown }> = [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const href = String(url);
    calls.push({ url: href, body: init?.body ? JSON.parse(String(init.body)) : undefined });

    if (href.includes("/rooms?")) {
      return new Response(JSON.stringify(opts.room ?? [{ id: "room-1", game_id: "game-1" }]), {
        status: 200,
      });
    }
    if (href.includes("/game_sessions")) {
      return new Response(null, { status: opts.sessionOk === false ? 500 : 201 });
    }
    return new Response(null, { status: opts.resultOk === false ? 500 : 201 });
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

describe("isBotId", () => {
  it("recognises bot seats", () => {
    expect(isBotId("bot-abc")).toBe(true);
    expect(isBotId("11111111-1111-4111-8111-111111111111")).toBe(false);
    expect(isBotId(null)).toBe(false);
  });
});

describe("SupabaseResultStore", () => {
  it("writes a session and a result for a persisted room", async () => {
    const { impl, calls } = fakeFetch();
    const store = new SupabaseResultStore(URL_BASE, KEY, impl);

    await expect(store.recordMatch(record())).resolves.toEqual({ ok: true });

    expect(calls).toHaveLength(3);
    expect(calls[1]?.url).toContain("/game_sessions");
    expect(calls[1]?.body).toMatchObject({ room_id: "room-1", status: "completed" });
    expect(calls[2]?.url).toContain("/game_results");
    expect(calls[2]?.body).toMatchObject({ duration_seconds: 120, finish_reason: "normal" });
  });

  it("skips rooms that were never persisted rather than erroring", async () => {
    const { impl, calls } = fakeFetch({ room: [] });
    const store = new SupabaseResultStore(URL_BASE, KEY, impl);

    const outcome = await store.recordMatch(record());
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toMatch(/not persisted/);
    // No writes attempted without a room to attach them to.
    expect(calls).toHaveLength(1);
  });

  it("never stores a bot as winner_id, which has no profile row", async () => {
    const { impl, calls } = fakeFetch();
    const store = new SupabaseResultStore(URL_BASE, KEY, impl);

    await store.recordMatch(
      record({ result: { ...RESULT, winnerId: "bot-9999" } }),
    );

    const resultBody = calls[2]?.body as { winner_id: unknown; scores: unknown };
    expect(resultBody.winner_id).toBeNull();
    // The bot still appears in the scores payload.
    expect(resultBody.scores).toBeDefined();
  });

  it("reports a failed session write", async () => {
    const { impl } = fakeFetch({ sessionOk: false });
    const store = new SupabaseResultStore(URL_BASE, KEY, impl);
    const outcome = await store.recordMatch(record());
    expect(outcome).toMatchObject({ ok: false });
    expect(outcome.reason).toMatch(/session write failed/);
  });

  it("sends the service-role key on every request", async () => {
    const seen: string[] = [];
    const impl = (async (url: string | URL | Request, init?: RequestInit) => {
      seen.push(String((init?.headers as Record<string, string>)?.apikey));
      if (String(url).includes("/rooms?")) {
        return new Response(JSON.stringify([{ id: "r", game_id: "g" }]), { status: 200 });
      }
      return new Response(null, { status: 201 });
    }) as unknown as typeof fetch;

    await new SupabaseResultStore(URL_BASE, KEY, impl).recordMatch(record());
    expect(seen).toEqual([KEY, KEY, KEY]);
  });
});

describe("recordMatchSafely", () => {
  it("does nothing when no store is configured", async () => {
    await expect(recordMatchSafely(null, record())).resolves.toBeUndefined();
  });

  it("swallows store failures so a match is never broken by the database", async () => {
    const throwing = {
      recordMatch: async () => {
        throw new Error("postgres exploded");
      },
    };
    await expect(recordMatchSafely(throwing, record())).resolves.toBeUndefined();
  });
});
