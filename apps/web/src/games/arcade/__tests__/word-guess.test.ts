import { describe, it, expect } from "vitest";
import { evaluateGuess, processWordGuessKey } from "../WordGuessView";

describe("Word Guess Core Logic", () => {
  describe("evaluateGuess", () => {
    it("evaluates an exact 5-letter match with all greens", () => {
      const result = evaluateGuess("CRANE", "CRANE");
      expect(result).toEqual(["correct", "correct", "correct", "correct", "correct"]);
    });

    it("evaluates a completely mismatched word with all grays", () => {
      const result = evaluateGuess("PILOT", "CRANE");
      expect(result).toEqual(["absent", "absent", "absent", "absent", "absent"]);
    });

    it("handles repeated letters in the guess (e.g. PUPPY vs APPLE)", () => {
      const result = evaluateGuess("PUPPY", "APPLE");
      expect(result).toEqual(["present", "absent", "correct", "absent", "absent"]);
    });

    it("handles repeated letters in target word (e.g. APPLE vs APPLY)", () => {
      const result = evaluateGuess("APPLY", "APPLE");
      expect(result).toEqual(["correct", "correct", "correct", "correct", "absent"]);
    });

    it("handles misplaced letter when duplicate is also guessed (e.g. SPEED vs ERECT)", () => {
      const result = evaluateGuess("SPEED", "ERECT");
      expect(result).toEqual(["absent", "absent", "correct", "present", "absent"]);
    });

    it("handles anagram permutation with all yellows", () => {
      const result = evaluateGuess("ALERT", "LATER");
      expect(result).toEqual(["present", "present", "present", "present", "present"]);
    });
  });

  describe("processWordGuessKey", () => {
    it("allows typing 'R' into guess without restarting", () => {
      const res = processWordGuessKey("B", "r");
      expect(res.nextGuess).toBe("BR");
      expect(res.submit).toBe(false);
    });

    it("caps guess length at 5 letters", () => {
      const res = processWordGuessKey("CRANE", "S");
      expect(res.nextGuess).toBe("CRANE");
      expect(res.submit).toBe(false);
    });

    it("handles BACKSPACE and DEL to remove last character", () => {
      const res1 = processWordGuessKey("CRAN", "BACKSPACE");
      expect(res1.nextGuess).toBe("CRA");
      expect(res1.submit).toBe(false);

      const res2 = processWordGuessKey("CRAN", "DEL");
      expect(res2.nextGuess).toBe("CRA");
      expect(res2.submit).toBe(false);
    });

    it("flags submit on ENTER", () => {
      const res = processWordGuessKey("CRANE", "ENTER");
      expect(res.nextGuess).toBe("CRANE");
      expect(res.submit).toBe(true);
    });
  });
});
