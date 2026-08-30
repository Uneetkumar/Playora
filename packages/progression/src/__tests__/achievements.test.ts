import { describe, it, expect } from "vitest";
import {
  ACHIEVEMENTS,
  ACHIEVEMENTS_BY_ID,
  achievementPoints,
  evaluateAchievements,
  type AchievementContext,
} from "../achievements.js";

const ctx = (over: Partial<AchievementContext> = {}): AchievementContext => ({
  totals: {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    currentStreak: 0,
    bestStreak: 0,
    level: 1,
    xp: 0,
    ...over.totals,
  },
  perGame: over.perGame ?? {},
  match: over.match ?? null,
});

describe("achievement catalogue", () => {
  it("has unique ids", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every achievement a name, description and icon", () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.name.length, `${a.id} has no name`).toBeGreaterThan(0);
      expect(a.description.length, `${a.id} has no description`).toBeGreaterThan(0);
      expect(a.icon.length, `${a.id} has no icon`).toBeGreaterThan(0);
      expect(a.points, `${a.id} is worth nothing`).toBeGreaterThan(0);
    }
  });

  it("unlocks nothing for a player who has never finished a game", () => {
    expect(evaluateAchievements(ctx())).toEqual([]);
  });

  it("unlocks the first-match achievement on the first finished game", () => {
    const unlocked = evaluateAchievements(ctx({ totals: { ...ctx().totals, gamesPlayed: 1 } }));
    expect(unlocked.map((a) => a.id)).toContain("first-match");
  });

  it("never awards the same achievement twice", () => {
    const state = ctx({ totals: { ...ctx().totals, gamesPlayed: 1, wins: 1 } });
    const first = evaluateAchievements(state).map((a) => a.id);
    expect(first).toContain("first-win");

    const second = evaluateAchievements(state, first).map((a) => a.id);
    expect(second).toEqual([]);
  });

  it("awards streak achievements from the best streak, not the current one", () => {
    // A player who hit five in a row and then lost has still done it.
    const unlocked = evaluateAchievements(
      ctx({ totals: { ...ctx().totals, gamesPlayed: 6, wins: 5, currentStreak: 0, bestStreak: 5 } }),
    ).map((a) => a.id);
    expect(unlocked).toContain("streak-3");
    expect(unlocked).not.toContain("streak-10");
  });

  it("uses peak rating, so a climb is not undone by a later loss", () => {
    const unlocked = evaluateAchievements(
      ctx({ perGame: { chess: { gamesPlayed: 40, wins: 25, rating: 1310, peakRating: 1450 } } }),
    ).map((a) => a.id);
    expect(unlocked).toContain("rated-1400");
  });

  it("keeps match-shaped achievements locked when there is no match", () => {
    const unlocked = evaluateAchievements(ctx()).map((a) => a.id);
    expect(unlocked).not.toContain("quick-win");
    expect(unlocked).not.toContain("marathon");
  });

  it("awards a fast win only for a win", () => {
    const quickLoss = evaluateAchievements(
      ctx({
        totals: { ...ctx().totals, gamesPlayed: 1 },
        match: { gameSlug: "chess", outcome: "loss", durationSeconds: 45, reason: "normal", rated: true },
      }),
    ).map((a) => a.id);
    expect(quickLoss).not.toContain("quick-win");

    const quickWin = evaluateAchievements(
      ctx({
        totals: { ...ctx().totals, gamesPlayed: 1, wins: 1 },
        match: { gameSlug: "chess", outcome: "win", durationSeconds: 45, reason: "normal", rated: true },
      }),
    ).map((a) => a.id);
    expect(quickWin).toContain("quick-win");
  });

  it("requires every game for the breadth achievement", () => {
    const two = evaluateAchievements(
      ctx({
        perGame: {
          chess: { gamesPlayed: 5, wins: 1, rating: 1200, peakRating: 1200 },
          uno: { gamesPlayed: 5, wins: 1, rating: 1200, peakRating: 1200 },
        },
      }),
    ).map((a) => a.id);
    expect(two).not.toContain("all-games");

    const three = evaluateAchievements(
      ctx({
        perGame: {
          chess: { gamesPlayed: 5, wins: 1, rating: 1200, peakRating: 1200 },
          uno: { gamesPlayed: 5, wins: 1, rating: 1200, peakRating: 1200 },
          "uno-no-mercy": { gamesPlayed: 1, wins: 0, rating: 1200, peakRating: 1200 },
        },
      }),
    ).map((a) => a.id);
    expect(three).toContain("all-games");
  });

  it("survives a rule that throws", () => {
    // Rules run on the server right after a match is written. One bad rule must
    // not cost the player the rest of their achievements.
    const exploding = {
      id: "boom",
      name: "Boom",
      description: "Throws",
      icon: "x",
      tier: "bronze" as const,
      points: 10,
      check: () => {
        throw new Error("bad rule");
      },
    };
    const catalogue = [...ACHIEVEMENTS, exploding];
    const unlocked = catalogue
      .filter((a) => {
        try {
          return a.check(ctx({ totals: { ...ctx().totals, gamesPlayed: 1 } }));
        } catch {
          return false;
        }
      })
      .map((a) => a.id);
    expect(unlocked).toContain("first-match");
    expect(unlocked).not.toContain("boom");
  });

  it("totals points and ignores ids it does not know", () => {
    const bronze = ACHIEVEMENTS.find((a) => a.tier === "bronze")!;
    expect(achievementPoints([bronze.id, "not-a-real-achievement"])).toBe(bronze.points);
    expect(ACHIEVEMENTS_BY_ID[bronze.id]).toBe(bronze);
  });
});
