import { describe, it, expect } from "vitest";
import { slide2048Line, canMake2048Move } from "../Game2048View";

describe("2048 Core Logic", () => {
  describe("slide2048Line", () => {
    it("handles empty line", () => {
      const { line, points } = slide2048Line([0, 0, 0, 0]);
      expect(line).toEqual([0, 0, 0, 0]);
      expect(points).toBe(0);
    });

    it("slides non-zero values to the left without merges", () => {
      const { line, points } = slide2048Line([0, 2, 0, 4]);
      expect(line).toEqual([2, 4, 0, 0]);
      expect(points).toBe(0);
    });

    it("merges identical adjacent tiles and awards points", () => {
      const { line, points } = slide2048Line([2, 0, 2, 0]);
      expect(line).toEqual([4, 0, 0, 0]);
      expect(points).toBe(4);
    });

    it("merges two pairs in a single line correctly", () => {
      const { line, points } = slide2048Line([2, 2, 2, 2]);
      expect(line).toEqual([4, 4, 0, 0]);
      expect(points).toBe(8);
    });

    it("does not chain-merge in a single slide (e.g. 4+2+2 merges 2+2, leaves 4)", () => {
      const { line, points } = slide2048Line([4, 2, 2, 0]);
      expect(line).toEqual([4, 4, 0, 0]);
      expect(points).toBe(4);
    });

    it("leaves a locked line unchanged", () => {
      const { line, points } = slide2048Line([2, 4, 8, 16]);
      expect(line).toEqual([2, 4, 8, 16]);
      expect(points).toBe(0);
    });
  });

  describe("canMake2048Move", () => {
    it("returns true if any cell is empty (0)", () => {
      const grid = [
        [2, 4, 8, 16],
        [32, 64, 128, 256],
        [512, 1024, 2048, 4096],
        [8192, 16384, 32768, 0],
      ];
      expect(canMake2048Move(grid)).toBe(true);
    });

    it("returns true if full grid has a horizontal mergeable pair", () => {
      const grid = [
        [2, 4, 8, 16],
        [32, 64, 128, 256],
        [512, 1024, 2048, 4096],
        [8192, 16384, 16384, 32768],
      ];
      expect(canMake2048Move(grid)).toBe(true);
    });

    it("returns true if bottom row has adjacent horizontal merge (specifically tests bottom-row boundary fix)", () => {
      const grid = [
        [2, 4, 8, 16],
        [4, 2, 16, 8],
        [2, 4, 8, 16],
        [4, 8, 8, 2], // bottom row: col 1 and 2 match!
      ];
      expect(canMake2048Move(grid)).toBe(true);
    });

    it("returns true if full grid has a vertical mergeable pair", () => {
      const grid = [
        [2, 4, 8, 16],
        [2, 8, 16, 32],
        [8, 16, 32, 64],
        [16, 32, 64, 128],
      ];
      expect(canMake2048Move(grid)).toBe(true);
    });

    it("returns false when no moves are possible (game over)", () => {
      const grid = [
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 4, 2],
      ];
      expect(canMake2048Move(grid)).toBe(false);
    });
  });
});
