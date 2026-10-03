import { describe, it, expect } from "vitest";
import { checkSimonStep } from "../SimonSaysView";

describe("Simon Says Core Logic", () => {
  describe("checkSimonStep", () => {
    it("recognizes correct step in progress", () => {
      const result = checkSimonStep(["green", "red", "blue"], 0, "green");
      expect(result.correct).toBe(true);
      expect(result.roundComplete).toBe(false);
    });

    it("recognizes final correct step completing the round", () => {
      const result = checkSimonStep(["green", "red", "blue"], 2, "blue");
      expect(result.correct).toBe(true);
      expect(result.roundComplete).toBe(true);
    });

    it("recognizes incorrect step leading to game over", () => {
      const result = checkSimonStep(["green", "red", "blue"], 1, "yellow");
      expect(result.correct).toBe(false);
      expect(result.roundComplete).toBe(false);
    });

    it("handles out of bounds step cleanly", () => {
      const result = checkSimonStep(["green"], 5, "green");
      expect(result.correct).toBe(false);
      expect(result.roundComplete).toBe(false);
    });
  });
});
