import { describe, it, expect } from "vitest";
import {
  BASE_RATING,
  applyRating,
  classifyMatch,
  expectedScore,
  isRated,
  kFactor,
  levelForXp,
  levelProgress,
  rankForRating,
  ratingToNextRank,
  totalXpForLevel,
  xpForMatch,
} from "../index.js";

describe("expectedScore", () => {
  it("is even between equal ratings", () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5, 5);
  });

  it("favours the stronger player and is symmetric", () => {
    const strong = expectedScore(1600, 1200);
    const weak = expectedScore(1200, 1600);
    expect(strong).toBeGreaterThan(0.9);
    expect(strong + weak).toBeCloseTo(1, 5);
  });
});

describe("kFactor", () => {
  it("moves new players fastest", () => {
    expect(kFactor(0, 1200)).toBeGreaterThan(kFactor(50, 1200));
  });

  it("moves elite players slowest", () => {
    expect(kFactor(100, 2500)).toBeLessThan(kFactor(100, 1500));
  });
});

describe("applyRating", () => {
  it("gains on a win and loses on a loss", () => {
    const base = { rating: 1200, gamesPlayed: 50, opponentRating: 1200 };
    expect(applyRating({ ...base, outcome: "win" }).delta).toBeGreaterThan(0);
    expect(applyRating({ ...base, outcome: "loss" }).delta).toBeLessThan(0);
  });

  it("barely moves on a draw between equals", () => {
    const change = applyRating({
      rating: 1200,
      gamesPlayed: 50,
      opponentRating: 1200,
      outcome: "draw",
    });
    expect(Math.abs(change.delta)).toBeLessThanOrEqual(1);
  });

  it("rewards beating a stronger opponent more than an equal one", () => {
    const upset = applyRating({
      rating: 1200, gamesPlayed: 50, opponentRating: 1800, outcome: "win",
    });
    const expectedWin = applyRating({
      rating: 1200, gamesPlayed: 50, opponentRating: 1200, outcome: "win",
    });
    expect(upset.delta).toBeGreaterThan(expectedWin.delta);
  });

  it("punishes losing to a much weaker opponent more", () => {
    const bad = applyRating({
      rating: 1800, gamesPlayed: 50, opponentRating: 1200, outcome: "loss",
    });
    const normal = applyRating({
      rating: 1800, gamesPlayed: 50, opponentRating: 1800, outcome: "loss",
    });
    expect(bad.delta).toBeLessThan(normal.delta);
  });

  it("is roughly zero-sum between two equal players", () => {
    const a = applyRating({ rating: 1400, gamesPlayed: 50, opponentRating: 1400, outcome: "win" });
    const b = applyRating({ rating: 1400, gamesPlayed: 50, opponentRating: 1400, outcome: "loss" });
    expect(Math.abs(a.delta + b.delta)).toBeLessThanOrEqual(1);
  });

  it("never drops a rating below the floor", () => {
    let rating = 150;
    for (let i = 0; i < 40; i++) {
      rating = applyRating({ rating, gamesPlayed: 100, opponentRating: 2400, outcome: "loss" }).after;
    }
    expect(rating).toBeGreaterThanOrEqual(100);
  });
});

describe("match classification", () => {
  it("distinguishes human, bot and mixed", () => {
    expect(classifyMatch([{}, {}])).toBe("human");
    expect(classifyMatch([{ isBot: true }, { isBot: true }])).toBe("bot");
    expect(classifyMatch([{}, { isBot: true }])).toBe("mixed");
  });

  it("only rates all-human matches (spec section 13)", () => {
    expect(isRated("human")).toBe(true);
    expect(isRated("bot")).toBe(false);
    expect(isRated("mixed")).toBe(false);
  });
});

describe("rank tiers", () => {
  it("maps ratings to increasing tiers", () => {
    expect(rankForRating(900).id).toBe("bronze");
    expect(rankForRating(BASE_RATING).id).toBe("silver");
    expect(rankForRating(1350).id).toBe("gold");
    expect(rankForRating(9999).id).toBe("grandmaster");
  });

  it("reports the gap to the next tier, and nothing at the top", () => {
    const next = ratingToNextRank(1250);
    expect(next?.tier.id).toBe("gold");
    expect(next?.needed).toBe(50);
    expect(ratingToNextRank(5000)).toBeNull();
  });
});

describe("xp", () => {
  it("awards XP even for a loss, because XP is not skill", () => {
    expect(xpForMatch({ outcome: "loss", durationSeconds: 300, rated: true })).toBeGreaterThan(0);
  });

  it("rewards a win more than a draw, and a draw more than a loss", () => {
    const base = { durationSeconds: 300, rated: true } as const;
    const win = xpForMatch({ ...base, outcome: "win" });
    const draw = xpForMatch({ ...base, outcome: "draw" });
    const loss = xpForMatch({ ...base, outcome: "loss" });
    expect(win).toBeGreaterThan(draw);
    expect(draw).toBeGreaterThan(loss);
  });

  it("gives unrated (AI/offline) matches reduced XP but not zero", () => {
    const rated = xpForMatch({ outcome: "win", durationSeconds: 300, rated: true });
    const unrated = xpForMatch({ outcome: "win", durationSeconds: 300, rated: false });
    expect(unrated).toBeLessThan(rated);
    expect(unrated).toBeGreaterThan(0);
  });

  it("caps the duration bonus so long idle games are not farmable", () => {
    const tenMin = xpForMatch({ outcome: "win", durationSeconds: 600, rated: true });
    const twoHours = xpForMatch({ outcome: "win", durationSeconds: 7200, rated: true });
    expect(twoHours).toBe(tenMin);
  });

  it("handles a negative duration without going backwards", () => {
    expect(xpForMatch({ outcome: "win", durationSeconds: -50, rated: true })).toBeGreaterThan(0);
  });
});

describe("levels", () => {
  it("starts everyone at level 1 with zero XP", () => {
    expect(levelForXp(0)).toBe(1);
    expect(totalXpForLevel(1)).toBe(0);
  });

  it("requires strictly more XP for each level", () => {
    for (let level = 2; level < 40; level++) {
      expect(totalXpForLevel(level)).toBeGreaterThan(totalXpForLevel(level - 1));
    }
  });

  it("gets progressively harder to level up", () => {
    const gap = (l: number) => totalXpForLevel(l + 1) - totalXpForLevel(l);
    expect(gap(10)).toBeGreaterThan(gap(2));
  });

  it("round-trips level thresholds", () => {
    for (let level = 1; level < 30; level++) {
      expect(levelForXp(totalXpForLevel(level))).toBe(level);
      expect(levelForXp(totalXpForLevel(level + 1) - 1)).toBe(level);
    }
  });

  it("reports progress through the current level", () => {
    const p = levelProgress(totalXpForLevel(5));
    expect(p.level).toBe(5);
    expect(p.xpIntoLevel).toBe(0);
    expect(p.progress).toBe(0);

    const mid = levelProgress(totalXpForLevel(5) + Math.floor(p.xpForNextLevel / 2));
    expect(mid.progress).toBeGreaterThan(0.4);
    expect(mid.progress).toBeLessThan(0.6);
  });

  it("clamps negative XP", () => {
    expect(levelForXp(-500)).toBe(1);
  });
});
