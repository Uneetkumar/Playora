import { describe, it, expect } from "vitest";
import { getNextSnakeDirection, checkSnakeSelfCollision } from "../RetroSnakeView";

describe("Retro Snake Core Logic", () => {
  describe("getNextSnakeDirection", () => {
    it("allows valid perpendicular turns", () => {
      expect(getNextSnakeDirection("UP", "LEFT")).toBe("LEFT");
      expect(getNextSnakeDirection("UP", "RIGHT")).toBe("RIGHT");
      expect(getNextSnakeDirection("LEFT", "UP")).toBe("UP");
      expect(getNextSnakeDirection("LEFT", "DOWN")).toBe("DOWN");
      expect(getNextSnakeDirection("DOWN", "LEFT")).toBe("LEFT");
      expect(getNextSnakeDirection("DOWN", "RIGHT")).toBe("RIGHT");
      expect(getNextSnakeDirection("RIGHT", "UP")).toBe("UP");
      expect(getNextSnakeDirection("RIGHT", "DOWN")).toBe("DOWN");
    });

    it("prevents 180-degree immediate reverse collisions", () => {
      expect(getNextSnakeDirection("UP", "DOWN")).toBe("UP");
      expect(getNextSnakeDirection("DOWN", "UP")).toBe("DOWN");
      expect(getNextSnakeDirection("LEFT", "RIGHT")).toBe("LEFT");
      expect(getNextSnakeDirection("RIGHT", "LEFT")).toBe("RIGHT");
    });

    it("maintains current direction if same direction is pressed", () => {
      expect(getNextSnakeDirection("UP", "UP")).toBe("UP");
      expect(getNextSnakeDirection("DOWN", "DOWN")).toBe("DOWN");
      expect(getNextSnakeDirection("LEFT", "LEFT")).toBe("LEFT");
      expect(getNextSnakeDirection("RIGHT", "RIGHT")).toBe("RIGHT");
    });
  });

  describe("checkSnakeSelfCollision", () => {
    const snake = [
      { x: 5, y: 5 }, // head
      { x: 5, y: 6 },
      { x: 6, y: 6 },
      { x: 6, y: 5 }, // tail
    ];

    it("allows moving into the current tail tile if food is not eaten (tail vacates tile)", () => {
      const movingIntoTail = { x: 6, y: 5 };
      expect(checkSnakeSelfCollision(snake, movingIntoTail, false)).toBe(false);
    });

    it("detects collision if food is eaten while moving into the tail (tail does not vacate)", () => {
      const movingIntoTail = { x: 6, y: 5 };
      expect(checkSnakeSelfCollision(snake, movingIntoTail, true)).toBe(true);
    });

    it("detects collision with middle body segments regardless of food", () => {
      const hittingBody = { x: 5, y: 6 };
      expect(checkSnakeSelfCollision(snake, hittingBody, false)).toBe(true);
      expect(checkSnakeSelfCollision(snake, hittingBody, true)).toBe(true);
    });

    it("returns false for open empty tiles", () => {
      const openTile = { x: 4, y: 5 };
      expect(checkSnakeSelfCollision(snake, openTile, false)).toBe(false);
    });
  });
});
