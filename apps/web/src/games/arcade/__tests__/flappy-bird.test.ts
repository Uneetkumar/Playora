import { describe, it, expect } from "vitest";
import { checkFlappyPipeCollision } from "../FlappyBirdView";

describe("Flappy Bird Core Logic", () => {
  describe("checkFlappyPipeCollision", () => {
    const pipe = { x: 100, topHeight: 150, bottomY: 275, width: 54 };
    const radius = 13;

    it("detects no collision when bird is comfortably in the middle of gap", () => {
      const bird = { x: 120, y: 210 };
      expect(checkFlappyPipeCollision(bird, radius, pipe)).toBe(false);
    });

    it("detects collision when bird hits top pipe", () => {
      const bird = { x: 120, y: 155 }; // top edge: 155 - 13 = 142 < 150
      expect(checkFlappyPipeCollision(bird, radius, pipe)).toBe(true);
    });

    it("detects collision when bird hits bottom pipe", () => {
      const bird = { x: 120, y: 270 }; // bottom edge: 270 + 13 = 283 > 275
      expect(checkFlappyPipeCollision(bird, radius, pipe)).toBe(true);
    });

    it("detects no collision when bird is horizontally before the pipe", () => {
      const bird = { x: 80, y: 100 }; // horizontally before x:100 (80+13 = 93 < 100)
      expect(checkFlappyPipeCollision(bird, radius, pipe)).toBe(false);
    });

    it("detects no collision when bird is horizontally past the pipe", () => {
      const bird = { x: 180, y: 100 }; // horizontally past x:100+54=154 (180-13 = 167 > 154)
      expect(checkFlappyPipeCollision(bird, radius, pipe)).toBe(false);
    });
  });
});
