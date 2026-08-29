import { describe, it, expect } from "vitest";
import {
  findExpired,
  findMatch,
  isCompatible,
  ratingWindowFor,
  type QueueEntry,
} from "../src/lib/matchmaking.js";

const NOW = 1_700_000_000_000;

const entry = (over: Partial<QueueEntry> & { userId: string }): QueueEntry => ({
  displayName: over.userId,
  rating: 1200,
  enqueuedAt: NOW,
  connectionId: `c-${over.userId}`,
  ...over,
});

describe("ratingWindowFor", () => {
  it("widens the longer a player waits", () => {
    const windows = [0, 10_000, 20_000, 40_000, 60_000].map(ratingWindowFor);
    // Strictly increasing: waiting must never make matching harder.
    for (let i = 1; i < windows.length; i++) {
      expect(windows[i]!).toBeGreaterThan(windows[i - 1]!);
    }
  });

  it("starts strict and ends unbounded", () => {
    expect(ratingWindowFor(0)).toBe(50);
    expect(ratingWindowFor(120_000)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("isCompatible", () => {
  it("pairs close ratings immediately", () => {
    const a = entry({ userId: "a", rating: 1200 });
    const b = entry({ userId: "b", rating: 1230 });
    expect(isCompatible(a, b, NOW)).toBe(true);
  });

  it("refuses a wide gap early on", () => {
    const a = entry({ userId: "a", rating: 1200 });
    const b = entry({ userId: "b", rating: 1900 });
    expect(isCompatible(a, b, NOW)).toBe(false);
  });

  it("allows that same gap once both have waited", () => {
    const a = entry({ userId: "a", rating: 1200, enqueuedAt: NOW - 70_000 });
    const b = entry({ userId: "b", rating: 1900, enqueuedAt: NOW - 70_000 });
    expect(isCompatible(a, b, NOW)).toBe(true);
  });

  it("requires both windows, not just the patient player's", () => {
    // "a" has waited long enough to accept anyone; "b" just arrived.
    const a = entry({ userId: "a", rating: 1200, enqueuedAt: NOW - 70_000 });
    const b = entry({ userId: "b", rating: 1900, enqueuedAt: NOW });
    expect(isCompatible(a, b, NOW)).toBe(false);
  });

  it("never matches a player with themselves", () => {
    const a = entry({ userId: "a" });
    expect(isCompatible(a, { ...a }, NOW)).toBe(false);
  });
});

describe("findMatch", () => {
  it("returns null below the required player count", () => {
    expect(findMatch([entry({ userId: "a" })], NOW, 2)).toBeNull();
    expect(findMatch([], NOW, 2)).toBeNull();
  });

  it("anchors on the longest-waiting player", () => {
    const oldest = entry({ userId: "oldest", enqueuedAt: NOW - 30_000 });
    const recent = entry({ userId: "recent", enqueuedAt: NOW - 1_000 });
    const match = findMatch([recent, oldest], NOW, 2);
    expect(match?.[0]?.userId).toBe("oldest");
  });

  it("prefers the closest rating among valid partners", () => {
    const anchor = entry({ userId: "anchor", rating: 1200, enqueuedAt: NOW - 30_000 });
    const near = entry({ userId: "near", rating: 1210, enqueuedAt: NOW - 30_000 });
    const far = entry({ userId: "far", rating: 1500, enqueuedAt: NOW - 30_000 });
    const match = findMatch([anchor, far, near], NOW, 2);
    expect(match?.map((m) => m.userId)).toEqual(["anchor", "near"]);
  });

  it("returns null when nobody is within range yet", () => {
    const a = entry({ userId: "a", rating: 1000 });
    const b = entry({ userId: "b", rating: 2400 });
    expect(findMatch([a, b], NOW, 2)).toBeNull();
  });

  it("supports groups larger than two", () => {
    const players = ["a", "b", "c", "d"].map((id) => entry({ userId: id, rating: 1200 }));
    const match = findMatch(players, NOW, 4);
    expect(match).toHaveLength(4);
  });

  it("does not return a partial group", () => {
    const players = ["a", "b"].map((id) => entry({ userId: id, rating: 1200 }));
    expect(findMatch(players, NOW, 4)).toBeNull();
  });
});

describe("findExpired", () => {
  it("only reports entries past the threshold", () => {
    const stale = entry({ userId: "stale", enqueuedAt: NOW - 200_000 });
    const fresh = entry({ userId: "fresh", enqueuedAt: NOW - 1_000 });
    const expired = findExpired([stale, fresh], NOW, 120_000);
    expect(expired.map((e) => e.userId)).toEqual(["stale"]);
  });
});
