import { describe, it, expect } from "vitest";
import { SupabaseProgressionStore } from "../src/lib/progression-store.js";

/**
 * These tests exist because of a bug that ran in production unnoticed.
 *
 * Every rating upsert was posted without an `on_conflict` target. PostgREST
 * defaults that to the primary key, and both rating tables have a surrogate
 * `id` that never collides, so the insert fell through to the composite unique
 * constraint and came back 409 — for every match after a player's first. The
 * response was never checked, so nothing surfaced: `rating_history` kept
 * recording deltas while `game_ratings.rating` stayed at whatever the player's
 * first ever match set it to.
 *
 * A fake fetch is enough to catch it, because the defect is entirely in the
 * request the store builds.
 */

interface Call {
  url: string;
  method: string;
  body: unknown;
  headers: Record<string, string>;
}

function harness(options: { failUnkeyedUpserts?: boolean; failXpPatch?: boolean } = {}) {
  const calls: Call[] = [];
  // Rows the "database" already holds, keyed the way the real unique
  // constraints key them.
  const rows = new Map<string, Record<string, unknown>>();

  const fetchImpl = (async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ url, method, body, headers });

    const path = url.replace(/^https?:\/\/[^/]+/, "");

    if (method === "GET") {
      if (path.includes("/seasons?")) {
        return json([{ id: "season-1" }]);
      }
      if (path.includes("/profiles?")) {
        return json([
          {
            xp: 0,
            level: 1,
            total_games_played: 0,
            total_wins: 0,
            total_losses: 0,
            total_draws: 0,
            current_streak: 0,
            best_streak: 0,
          },
        ]);
      }
      const key = keyFor(path);
      const row = key ? rows.get(key) : undefined;
      return json(row ? [row] : []);
    }

    if (method === "POST" && path.includes("/rest/v1/")) {
      const table = path.split("/rest/v1/")[1]!.split("?")[0]!;
      if (table === "game_ratings" || table === "season_ratings") {
        const key = rowKey(table, body as Record<string, unknown>);
        const exists = rows.has(key);
        const hasTarget = path.includes("on_conflict=");

        // Postgres's actual behaviour: without a matching conflict target the
        // second write violates the unique constraint.
        if (exists && !hasTarget && options.failUnkeyedUpserts !== false) {
          return new Response(JSON.stringify({ code: "23505" }), { status: 409 });
        }
        rows.set(key, body as Record<string, unknown>);
      }
      return new Response("", { status: 201 });
    }

    if (method === "PATCH" && path.includes("/profiles")) {
      return new Response("", { status: options.failXpPatch ? 500 : 204 });
    }

    return new Response("", { status: 200 });
  }) as unknown as typeof fetch;

  const store = new SupabaseProgressionStore("https://db.test", "service-key", fetchImpl);
  return { store, calls, rows };
}

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function keyFor(path: string): string | null {
  const user = /user_id=eq\.([^&]+)/.exec(path)?.[1];
  const game = /game_id=eq\.([^&]+)/.exec(path)?.[1];
  if (!user || !game) return null;
  const season = /season_id=eq\.([^&]+)/.exec(path)?.[1];
  return season ? `season:${season}:${user}:${game}` : `game:${user}:${game}`;
}

function rowKey(table: string, body: Record<string, unknown>): string {
  return table === "season_ratings"
    ? `season:${body.season_id}:${body.user_id}:${body.game_id}`
    : `game:${body.user_id}:${body.game_id}`;
}

const result = (winner: string, loser: string) => ({
  scores: [
    { userId: winner, score: 1 },
    { userId: loser, score: 0 },
  ],
  winnerId: winner,
  reason: "checkmate",
  durationSeconds: 300,
});

async function playMatch(store: SupabaseProgressionStore, a: string, b: string) {
  return store.apply({
    gameId: "game-1",
    gameSlug: "chess",
    sessionId: `session-${Math.random()}`,
    result: result(a, b) as never,
    botIds: [],
  });
}

describe("rating upserts name their conflict target", () => {
  it("targets the composite unique constraint, not the surrogate primary key", async () => {
    const { store, calls } = harness();
    await playMatch(store, "alice", "bob");

    const ratingWrites = calls.filter(
      (c) => c.method === "POST" && c.url.includes("/game_ratings"),
    );
    expect(ratingWrites.length).toBeGreaterThan(0);
    for (const write of ratingWrites) {
      expect(write.url).toContain("on_conflict=user_id,game_id");
    }
  });

  it("targets season, user and game together for season standings", async () => {
    const { store, calls } = harness();
    await playMatch(store, "alice", "bob");

    const seasonWrites = calls.filter(
      (c) => c.method === "POST" && c.url.includes("/season_ratings"),
    );
    expect(seasonWrites.length).toBeGreaterThan(0);
    for (const write of seasonWrites) {
      expect(write.url).toContain("on_conflict=season_id,user_id,game_id");
    }
  });

  it("a player's second match updates their rating instead of failing", async () => {
    // The regression itself: before the fix this second call 409'd and the
    // rating stayed at the value the first match wrote.
    const { store, rows } = harness();
    await playMatch(store, "alice", "bob");
    const afterFirst = rows.get("game:alice:game-1")?.games_played;

    await playMatch(store, "alice", "bob");
    const afterSecond = rows.get("game:alice:game-1")?.games_played;

    expect(afterFirst).toBe(1);
    expect(afterSecond).toBe(2);
  });

  it("keeps season standings on their own rows, never touching the all-time row", async () => {
    const { store, rows } = harness();
    await playMatch(store, "alice", "bob");

    expect(rows.has("game:alice:game-1")).toBe(true);
    expect(rows.has("season:season-1:alice:game-1")).toBe(true);
    // Two separate ladders, two separate rows.
    expect(rows.get("game:alice:game-1")).not.toBe(rows.get("season:season-1:alice:game-1"));
  });

  it("looks the active season up once, not once per player", async () => {
    const { store, calls } = harness();
    await playMatch(store, "alice", "bob");
    await playMatch(store, "alice", "bob");

    const seasonLookups = calls.filter((c) => c.method === "GET" && c.url.includes("/seasons?"));
    expect(seasonLookups).toHaveLength(1);
  });
});

describe("progression is never reported unless it was written", () => {
  it("reports XP when the profile write succeeds", async () => {
    const { store } = harness();
    const outcome = await playMatch(store, "alice", "bob");

    expect(outcome.players.length).toBeGreaterThan(0);
    expect(outcome.players[0]!.xpGained).toBeGreaterThan(0);
  });

  it("reports nothing for a player whose XP write failed", async () => {
    // The alternative is a result screen counting up an XP bar and a level-up
    // that the database never received. Showing nothing is recoverable;
    // showing a level the player does not have is not.
    const { store } = harness({ failXpPatch: true });
    const outcome = await playMatch(store, "alice", "bob");

    expect(outcome.ok).toBe(true);
    expect(outcome.players).toHaveLength(0);
  });

  it("still writes the rating even when the XP write fails", async () => {
    // Rating and XP are separate systems; one failing must not roll the other
    // back, because the match really was played.
    const { store, rows } = harness({ failXpPatch: true });
    await playMatch(store, "alice", "bob");

    expect(rows.has("game:alice:game-1")).toBe(true);
  });
});
