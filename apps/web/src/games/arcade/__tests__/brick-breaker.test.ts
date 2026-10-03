import { describe, it, expect } from "vitest";
import { calculatePaddleBounce } from "../BrickBreakerView";

describe("Brick Breaker Core Logic", () => {
  describe("calculatePaddleBounce", () => {
    it("bounces straight up when hitting the exact center of paddle", () => {
      const { dx, dy } = calculatePaddleBounce(100, 55, 90, 5); // paddle center is 55 + 45 = 100
      expect(Math.abs(dx)).toBeLessThan(0.001);
      expect(dy).toBeLessThan(0); // upward
    });

    it("bounces sharply to the right when hitting near the right edge of paddle", () => {
      const { dx, dy } = calculatePaddleBounce(140, 55, 90, 5); // right of center
      expect(dx).toBeGreaterThan(0);
      expect(dy).toBeLessThan(0);
    });

    it("bounces sharply to the left when hitting near the left edge of paddle", () => {
      const { dx, dy } = calculatePaddleBounce(60, 55, 90, 5); // left of center
      expect(dx).toBeLessThan(0);
      expect(dy).toBeLessThan(0);
    });

    it("clamps extreme edge hits to avoid horizontal trajectory locks", () => {
      const { dy } = calculatePaddleBounce(1000, 55, 90, 5);
      expect(dy).toBeLessThanOrEqual(-3.2); // vertical component is preserved
    });
  });
});
