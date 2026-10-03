import { describe, it, expect } from "vitest";
import {
  readRecent,
  recordLocalPlay,
  clearLocalRecent,
  RECENT_STORAGE_KEY,
  MAX_RECENT,
  type RecentStore,
} from "../recent-local";

/** An in-memory stand-in, so these run without a DOM. */
const memoryStore = (initial?: string): RecentStore & { raw: () => string | null } => {
  let value: string | null = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_k, v) => {
      value = v;
    },
    removeItem: () => {
      value = null;
    },
    raw: () => value,
  };
};

const at = (iso: string) => new Date(iso);

describe("recently played, signed out", () => {
  it("starts empty", () => {
    expect(readRecent(memoryStore())).toEqual([]);
  });

  it("records a play", () => {
    const store = memoryStore();
    const list = recordLocalPlay("chess", store, at("2026-01-01T10:00:00Z"));
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ gameSlug: "chess", playCount: 1 });
  });

  it("counts repeat plays instead of duplicating the game", () => {
    const store = memoryStore();
    recordLocalPlay("chess", store, at("2026-01-01T10:00:00Z"));
    const list = recordLocalPlay("chess", store, at("2026-01-01T11:00:00Z"));
    expect(list).toHaveLength(1);
    expect(list[0]!.playCount).toBe(2);
  });

  it("moves the most recent game to the front", () => {
    const store = memoryStore();
    recordLocalPlay("chess", store, at("2026-01-01T10:00:00Z"));
    recordLocalPlay("uno", store, at("2026-01-01T11:00:00Z"));
    recordLocalPlay("chess", store, at("2026-01-01T12:00:00Z"));
    expect(readRecent(store).map((e) => e.gameSlug)).toEqual(["chess", "uno"]);
  });

  it("caps the list so it stays recent and small", () => {
    const store = memoryStore();
    for (let i = 0; i < MAX_RECENT + 8; i++) {
      recordLocalPlay(`game-${i}`, store, at(`2026-01-01T10:${String(i).padStart(2, "0")}:00Z`));
    }
    expect(readRecent(store)).toHaveLength(MAX_RECENT);
  });

  it("drops the oldest when capping, not the newest", () => {
    const store = memoryStore();
    for (let i = 0; i < MAX_RECENT + 1; i++) {
      recordLocalPlay(`game-${i}`, store, at(`2026-01-01T10:${String(i).padStart(2, "0")}:00Z`));
    }
    const slugs = readRecent(store).map((e) => e.gameSlug);
    expect(slugs).toContain(`game-${MAX_RECENT}`);
    expect(slugs).not.toContain("game-0");
  });

  it("survives corrupt storage rather than throwing on the way into a game", () => {
    expect(readRecent(memoryStore("not json at all"))).toEqual([]);
    expect(readRecent(memoryStore('{"not":"an array"}'))).toEqual([]);
  });

  it("discards malformed entries but keeps good ones", () => {
    const store = memoryStore(
      JSON.stringify([
        { gameSlug: "chess", lastPlayedAt: "2026-01-01T10:00:00Z", playCount: 3 },
        { gameSlug: 42, lastPlayedAt: "2026-01-01T11:00:00Z", playCount: 1 },
        { nope: true },
      ]),
    );
    const list = readRecent(store);
    expect(list).toHaveLength(1);
    expect(list[0]!.gameSlug).toBe("chess");
  });

  it("works when storage is unavailable", () => {
    // Private browsing, or storage blocked by policy.
    expect(readRecent(null)).toEqual([]);
    expect(() => recordLocalPlay("chess", null)).not.toThrow();
    expect(() => clearLocalRecent(null)).not.toThrow();
  });

  it("does not throw when the quota is exceeded", () => {
    const full: RecentStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    };
    expect(() => recordLocalPlay("chess", full)).not.toThrow();
  });

  it("clears the list", () => {
    const store = memoryStore();
    recordLocalPlay("chess", store);
    clearLocalRecent(store);
    expect(readRecent(store)).toEqual([]);
  });

  it("stores under one known key, so it can be migrated into an account later", () => {
    const store = memoryStore();
    recordLocalPlay("chess", store);
    expect(store.raw()).toBeTruthy();
    expect(RECENT_STORAGE_KEY).toBe("playora:recent");
  });
});
