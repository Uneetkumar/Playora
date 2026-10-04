import { describe, expect, it } from "vitest";
import { rankForRating, ratingToNextRank } from "@playora/progression";
import type { GameRating } from "../../../../hooks/use-progression";
import type { LocalMatchRecord } from "../../../../hooks/use-local-history";
import { bestScore, detailStats, ratedStanding } from "../detail-stats";

function rating(over: Partial<GameRating> = {}): GameRating {
  const value = over.rating ?? 1342;
  return {
    gameSlug: "chess",
    gameName: "Chess",
    rating: value,
    peakRating: 1400,
    gamesPlayed: 12,
    wins: 7,
    losses: 4,
    draws: 1,
    rank: rankForRating(value),
    toNextRank: ratingToNextRank(value),
    ...over,
  };
}

let n = 0;
function record(over: Partial<LocalMatchRecord> = {}): LocalMatchRecord {
  n += 1;
  return {
    id: `local-${n}`,
    gameId: "tic-tac-toe",
    gameName: "Tic Tac Toe",
    mode: "vs-ai",
    outcome: "win",
    durationSeconds: 40,
    playedAt: new Date(2026, 9, 1, 12, n).toISOString(),
    source: "local",
    ...over,
  };
}

describe("detailStats", () => {
  it("is empty with no records at all, so the strip is hidden", () => {
    expect(detailStats({ rating: null, local: [], solo: false })).toEqual([]);
  });

  it("ignores an account rating that no rated game has moved", () => {
    expect(ratedStanding(rating({ gamesPlayed: 0 }))).toBeNull();
    expect(detailStats({ rating: rating({ gamesPlayed: 0, rating: 1200 }), local: [], solo: false })).toEqual([]);
  });

  it("shows the rating with its peak and tier, and the rated record", () => {
    const stats = detailStats({ rating: rating(), local: [], solo: false });
    expect(stats.map((s) => s.id)).toEqual(["rating", "record"]);
    expect(stats[0]).toMatchObject({ value: "1,342", hint: `Peak 1,400 · ${rankForRating(1342).label}` });
    expect(stats[1]).toMatchObject({ value: "7–4–1", hint: "12 rated games" });
  });

  it("counts this device's games and wins for a game with opponents", () => {
    const local = [record(), record({ outcome: "loss" }), record({ outcome: "draw" }), record()];
    const stats = detailStats({ rating: null, local, solo: false });
    expect(stats.map((s) => s.id)).toEqual(["played", "wins"]);
    expect(stats[0]?.value).toBe("4");
    expect(stats[1]).toMatchObject({ value: "2", hint: "50% of games here" });
  });

  it("gives a solo game its best score instead of wins", () => {
    const local = [record({ score: 120 }), record({ score: 2480, outcome: "loss" }), record({ score: 0 })];
    const stats = detailStats({ rating: null, local, solo: true });
    expect(stats.map((s) => s.id)).toEqual(["played", "best"]);
    expect(stats[1]?.value).toBe("2,480");
  });
});

describe("bestScore", () => {
  it("never reports the board games' 100-for-a-win stand-in", () => {
    expect(bestScore([record({ score: 100 })], false)).toBeNull();
  });

  it("skips missing, zero and non-finite scores", () => {
    expect(bestScore([record(), record({ score: 0 }), record({ score: Number.NaN })], true)).toBeNull();
    expect(bestScore([record({ score: 7 }), record({ score: Number.POSITIVE_INFINITY })], true)).toBe(7);
  });
});
