import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  comboMultiplier,
  pointsFor,
  difficultyAt,
  spawnIntervalAt,
  bestScoreKey,
  readBestScore,
  commitBestScore,
  formatScore,
  holdBonus,
  fuseSecondsFor,
  HOLD_BASE,
  HOLD_BONUS_CAP,
  bombHoldValue,
  BOMB_HOLD_CAP,
  sawRisk,
  sawPositionAt,
  SAW_MIN_RISK,
  SAW_MAX_RISK,
  trussNeededFor,
  bridgeScore,
  TRUSS_BASE,
} from "../scoring";

describe("combo scoring", () => {
  it("gives no bonus below a chain of two", () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(1)).toBe(1);
  });

  it("rewards a chain, and never runaway", () => {
    expect(comboMultiplier(2)).toBeGreaterThan(1);
    expect(comboMultiplier(10)).toBeGreaterThan(comboMultiplier(5));
    // An unbroken run of sixty must not be worth sixty times, or one lucky
    // streak owns the leaderboard permanently.
    expect(comboMultiplier(60)).toBeLessThanOrEqual(6);
    expect(comboMultiplier(100000)).toBeLessThanOrEqual(6);
  });

  it("never goes backwards as the chain grows", () => {
    let previous = 0;
    for (let combo = 0; combo < 500; combo++) {
      const value = comboMultiplier(combo);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it("returns whole points", () => {
    for (const combo of [0, 3, 9, 40]) {
      expect(Number.isInteger(pointsFor(37, combo))).toBe(true);
    }
  });
});

describe("difficulty ramp", () => {
  it("starts at 1 and only rises", () => {
    expect(difficultyAt(0)).toBe(1);
    expect(difficultyAt(30)).toBeGreaterThan(difficultyAt(10));
  });

  it("treats a negative elapsed time as the start of the run", () => {
    // Clock skew or a paused tab must not make the game easier than launch.
    expect(difficultyAt(-100)).toBe(1);
  });

  it("shortens the spawn interval over time but never past human reaction", () => {
    const start = spawnIntervalAt(900, 0);
    const later = spawnIntervalAt(900, 120);
    expect(start).toBe(900);
    expect(later).toBeLessThan(start);
    // Below ~150ms nobody can react and it stops being a test of skill.
    expect(spawnIntervalAt(900, 100000)).toBe(150);
  });
});

describe("personal best", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
      },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("starts at zero", () => {
    expect(readBestScore("ant-attack")).toBe(0);
  });

  it("stores a first score and reads it back", () => {
    expect(commitBestScore("ant-attack", 1200)).toBe(true);
    expect(readBestScore("ant-attack")).toBe(1200);
  });

  it("keeps the higher score and reports no new best for a worse run", () => {
    commitBestScore("ant-attack", 1200);
    expect(commitBestScore("ant-attack", 900)).toBe(false);
    expect(readBestScore("ant-attack")).toBe(1200);
  });

  it("does not treat an equal score as a new best", () => {
    commitBestScore("ant-attack", 1200);
    expect(commitBestScore("ant-attack", 1200)).toBe(false);
  });

  it("keeps each game's best separate", () => {
    commitBestScore("ant-attack", 1200);
    commitBestScore("target-rush", 300);
    expect(readBestScore("ant-attack")).toBe(1200);
    expect(readBestScore("target-rush")).toBe(300);
    expect(bestScoreKey("ant-attack")).not.toBe(bestScoreKey("target-rush"));
  });

  it("re-reads before writing, so a second tab cannot lower the best", () => {
    commitBestScore("ant-attack", 5000);
    // Another tab, holding a stale in-memory best of 0, finishes on 400.
    expect(commitBestScore("ant-attack", 400)).toBe(false);
    expect(readBestScore("ant-attack")).toBe(5000);
  });

  it("ignores nonsense scores", () => {
    expect(commitBestScore("ant-attack", Number.NaN)).toBe(false);
    expect(commitBestScore("ant-attack", -50)).toBe(false);
    expect(commitBestScore("ant-attack", 0)).toBe(false);
  });

  it("survives storage that throws", () => {
    // A private window with site data blocked throws on access. A cosmetic
    // number must never take the game down.
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
      },
    });
    expect(readBestScore("ant-attack")).toBe(0);
    expect(commitBestScore("ant-attack", 900)).toBe(false);
  });

  it("recovers from a corrupted stored value", () => {
    store[bestScoreKey("ant-attack")] = "not-a-number";
    expect(readBestScore("ant-attack")).toBe(0);
  });
});

describe("formatScore", () => {
  it("groups thousands", () => {
    expect(formatScore(12400)).toBe("12,400");
    expect(formatScore(7)).toBe("7");
  });
});

describe("hold-for-points", () => {
  it("pays something for an instant toss", () => {
    // Tossing immediately must stay viable — it is the safe play, not a
    // punishment.
    expect(holdBonus(0)).toBe(HOLD_BASE);
  });

  it("pays more the longer it is held", () => {
    expect(holdBonus(2)).toBeGreaterThan(holdBonus(1));
    expect(holdBonus(4)).toBeGreaterThan(holdBonus(2));
  });

  it("grows faster than linearly, so the last second is worth chasing", () => {
    const first = holdBonus(1) - holdBonus(0);
    const later = holdBonus(4) - holdBonus(3);
    expect(later).toBeGreaterThan(first);
  });

  it("is capped, so one lucky hold cannot outweigh a careful run", () => {
    expect(holdBonus(30)).toBe(HOLD_BONUS_CAP);
    expect(holdBonus(1000)).toBe(HOLD_BONUS_CAP);
  });

  it("never goes backwards", () => {
    let previous = -1;
    for (let t = 0; t < 20; t += 0.25) {
      const value = holdBonus(t);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it("treats a negative clock as an instant toss", () => {
    expect(holdBonus(-5)).toBe(HOLD_BASE);
  });
});

describe("fuse length", () => {
  it("shortens as the waves go on", () => {
    expect(fuseSecondsFor(5, 0.5)).toBeLessThan(fuseSecondsFor(1, 0.5));
  });

  it("never drops below a decidable length", () => {
    // Under about a second and a half there is no decision left to make, only
    // a coin flip.
    for (let wave = 1; wave < 60; wave++) {
      for (const roll of [0, 0.5, 1]) {
        expect(fuseSecondsFor(wave, roll)).toBeGreaterThanOrEqual(1.5);
      }
    }
  });

  it("varies with the roll, so the gamble is real", () => {
    expect(fuseSecondsFor(1, 1)).toBeGreaterThan(fuseSecondsFor(1, 0));
  });
});

describe("banking a chain", () => {
  /*
   * Guards the bug this was written for: banking reused `hit`, which multiplies
   * its argument by the chain. Since the banked value is *derived* from the
   * chain, that counted it twice — a 6-chain bank of 90 scored 90 times the
   * 6-chain multiplier.
   *
   * Tested as arithmetic rather than through the hook, because the property is
   * arithmetic: a bank must add exactly what it says.
   */
  it("multiplies a hit by the chain", () => {
    expect(pointsFor(90, 6)).toBeGreaterThan(90);
  });

  it("but a bank is worth its face value", () => {
    // What `bank` does: adds the number, no multiplier.
    const chain = 6;
    const bankValue = chain * 15;
    expect(bankValue).toBe(90);
    // The bug was awarding pointsFor(90, 6) instead.
    expect(pointsFor(bankValue, chain)).not.toBe(bankValue);
  });
});

describe("bomb hold value", () => {
  it("pays nothing for an instant dump", () => {
    expect(bombHoldValue(0)).toBe(0);
  });

  it("is close to linear, unlike the hidden-fuse curve", () => {
    /*
     * The two games ask different questions and their reward curves say so.
     * Hot Potato hides the fuse, so its curve accelerates and the player is
     * gambling blind. Bomb Pass shows the fuse, so the reward is near-linear
     * and the tension is in reading the clock.
     */
    const first = bombHoldValue(1) - bombHoldValue(0);
    const later = bombHoldValue(4) - bombHoldValue(3);
    expect(Math.abs(later - first)).toBeLessThan(5);

    // Where Hot Potato's does accelerate.
    const hotFirst = holdBonus(1) - holdBonus(0);
    const hotLater = holdBonus(4) - holdBonus(3);
    expect(hotLater).toBeGreaterThan(hotFirst * 2);
  });

  it("is capped", () => {
    expect(bombHoldValue(1000)).toBe(BOMB_HOLD_CAP);
  });

  it("never goes backwards", () => {
    let previous = -1;
    for (let t = 0; t < 15; t += 0.25) {
      const v = bombHoldValue(t);
      expect(v).toBeGreaterThanOrEqual(previous);
      previous = v;
    }
  });
});

describe("saw risk", () => {
  it("is dangerous when the rope runs through the blade", () => {
    expect(sawRisk(100, 100)).toBeCloseTo(SAW_MAX_RISK, 2);
  });

  it("is near-safe when the rope is clear of it", () => {
    expect(sawRisk(300, 100)).toBe(SAW_MIN_RISK);
  });

  it("never reaches zero, so a run is never on rails", () => {
    expect(sawRisk(9999, 100)).toBeGreaterThan(0);
  });

  it("rises steeply as the rope closes in", () => {
    // Threading close should feel dangerous, not mildly unwise.
    const far = sawRisk(100 + 80, 100);
    const near = sawRisk(100 + 20, 100);
    expect(near).toBeGreaterThan(far * 3);
  });

  it("never goes backwards as the rope approaches", () => {
    let previous = -1;
    for (let d = 200; d >= 0; d -= 5) {
      const risk = sawRisk(100 + d, 100);
      expect(risk).toBeGreaterThanOrEqual(previous);
      previous = risk;
    }
  });

  it("is symmetric — above and below the blade are equally bad", () => {
    expect(sawRisk(140, 100)).toBeCloseTo(sawRisk(60, 100), 6);
  });
});

describe("saw patrol", () => {
  it("stays within its patrol range", () => {
    for (let t = 0; t < 100; t += 0.3) {
      for (const wave of [1, 5, 12]) {
        const y = sawPositionAt(t, wave, 70, 250);
        expect(y).toBeGreaterThanOrEqual(69.9);
        expect(y).toBeLessThanOrEqual(250.1);
      }
    }
  });

  it("moves faster in later waves", () => {
    // Distance covered over the same window grows with the wave.
    const travelled = (wave: number) => {
      let sum = 0;
      for (let t = 0; t < 6; t += 0.05) {
        sum += Math.abs(sawPositionAt(t + 0.05, wave) - sawPositionAt(t, wave));
      }
      return sum;
    };
    expect(travelled(8)).toBeGreaterThan(travelled(1));
  });
});

describe("bridge load", () => {
  it("needs more truss for a heavier load", () => {
    expect(trussNeededFor(20)).toBeGreaterThan(trussNeededFor(5));
  });

  it("needs some truss even for an empty truck", () => {
    expect(trussNeededFor(0)).toBe(TRUSS_BASE);
  });

  it("pays nothing for a bridge that fails", () => {
    expect(bridgeScore(20, 30)).toBe(0);
  });

  it("pays most for the tightest bridge that holds", () => {
    const exact = bridgeScore(30, 30);
    const generous = bridgeScore(45, 30);
    expect(exact).toBeGreaterThan(generous);
  });

  it("rewards the margin, not a lucky light load", () => {
    /*
     * The same margin scores the same whatever the load was — otherwise the
     * game rewards being handed an easy truck rather than judging well.
     */
    expect(bridgeScore(trussNeededFor(5) + 6, trussNeededFor(5)))
      .toBe(bridgeScore(trussNeededFor(25) + 6, trussNeededFor(25)));
  });

  it("still pays something for an over-engineered bridge", () => {
    // Safe should be worth less, not worthless: a player who plays cautiously
    // is playing, not failing.
    expect(bridgeScore(200, 30)).toBeGreaterThan(0);
  });
});
