import { describe, it, expect } from "vitest";
import { calculateWhackScore } from "../WhackAMoleView";

describe("Whack-A-Mole Core Logic", () => {
  describe("calculateWhackScore", () => {
    it("awards 10 points for standard mole at combo 0 and increases combo to 1", () => {
      const res = calculateWhackScore("standard", 0, 50);
      expect(res.points).toBe(10);
      expect(res.nextCombo).toBe(1);
      expect(res.nextScore).toBe(60);
      expect(res.bonusTime).toBe(0);
    });

    it("scales standard points with combo multiplier up to 5x", () => {
      const res = calculateWhackScore("standard", 4, 100);
      expect(res.points).toBe(50); // 10 * 5
      expect(res.nextCombo).toBe(5);
      expect(res.nextScore).toBe(150);

      // Capped at 5x
      const resCap = calculateWhackScore("standard", 5, 150);
      expect(resCap.points).toBe(50);
      expect(resCap.nextCombo).toBe(5);
      expect(resCap.nextScore).toBe(200);
    });

    it("awards 30x points and bonus time for golden mole", () => {
      const res = calculateWhackScore("golden", 1, 50);
      expect(res.points).toBe(60); // 30 * 2
      expect(res.nextCombo).toBe(2);
      expect(res.nextScore).toBe(110);
      expect(res.bonusTime).toBe(1000);
    });

    it("penalizes bomb hit, resets combo, and floors score at 0", () => {
      const res = calculateWhackScore("bomb", 4, 15);
      expect(res.points).toBe(-25);
      expect(res.nextCombo).toBe(0);
      expect(res.nextScore).toBe(0); // floored at 0, not -10
    });
  });
});
