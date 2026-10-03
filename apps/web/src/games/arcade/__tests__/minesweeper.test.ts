import { describe, it, expect } from "vitest";
import {
  createEmptyMinesweeperGrid,
  populateMinesweeperGrid,
  cascadeReveal,
  checkMinesweeperVictory,
  type MinesweeperCell,
} from "../MinesweeperView";

describe("Minesweeper Core Logic", () => {
  it("initializes an empty grid with correct dimensions and default states", () => {
    const size = 8;
    const grid = createEmptyMinesweeperGrid(size);
    expect(grid).toHaveLength(size);
    expect(grid[0]).toHaveLength(size);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        expect(grid[r]![c]!.isMine).toBe(false);
        expect(grid[r]![c]!.isRevealed).toBe(false);
        expect(grid[r]![c]!.isFlagged).toBe(false);
        expect(grid[r]![c]!.neighborMines).toBe(0);
      }
    }
  });

  it("populates mines respecting the safe click radius (safe cell and 8 neighbors have NO mines)", () => {
    const size = 8;
    const totalMines = 10;
    const safeR = 3;
    const safeC = 3;
    const emptyGrid = createEmptyMinesweeperGrid(size);
    const populated = populateMinesweeperGrid(safeR, safeC, size, totalMines, emptyGrid);

    // Count mines placed
    const mineCount = populated.flat().filter((cell) => cell.isMine).length;
    expect(mineCount).toBe(totalMines);

    // Verify safe zone (3x3 area around safeR, safeC)
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = safeR + dr;
        const nc = safeC + dc;
        expect(populated[nr]![nc]!.isMine).toBe(false);
      }
    }

    // Verify neighbor counts match actual surrounding mines
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!populated[r]![c]!.isMine) {
          let count = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = r + dr;
              const nc = c + dc;
              if (nr >= 0 && nr < size && nc >= 0 && nc < size && populated[nr]![nc]!.isMine) {
                count++;
              }
            }
          }
          expect(populated[r]![c]!.neighborMines).toBe(count);
        }
      }
    }
  });

  it("performs cascade flood fill revealing contiguous empty cells and their borders", () => {
    const size = 4;
    const grid: MinesweeperCell[][] = [
      [
        { r: 0, c: 0, isMine: false, isRevealed: false, isFlagged: false, neighborMines: 0 },
        { r: 0, c: 1, isMine: false, isRevealed: false, isFlagged: false, neighborMines: 0 },
        { r: 0, c: 2, isMine: false, isRevealed: false, isFlagged: false, neighborMines: 1 },
        { r: 0, c: 3, isMine: true, isRevealed: false, isFlagged: false, neighborMines: 0 },
      ],
      [
        { r: 1, c: 0, isMine: false, isRevealed: false, isFlagged: false, neighborMines: 0 },
        { r: 1, c: 1, isMine: false, isRevealed: false, isFlagged: false, neighborMines: 0 },
        { r: 1, c: 2, isMine: false, isRevealed: false, isFlagged: false, neighborMines: 1 },
        { r: 1, c: 3, isMine: false, isRevealed: false, isFlagged: false, neighborMines: 1 },
      ],
      [
        { r: 2, c: 0, isMine: false, isRevealed: false, isFlagged: false, neighborMines: 0 },
        { r: 2, c: 1, isMine: false, isRevealed: false, isFlagged: false, neighborMines: 0 },
        { r: 2, c: 2, isMine: false, isRevealed: false, isFlagged: false, neighborMines: 0 },
        { r: 2, c: 3, isMine: false, isRevealed: false, isFlagged: false, neighborMines: 0 },
      ],
      [
        { r: 3, c: 0, isMine: false, isRevealed: false, isFlagged: false, neighborMines: 0 },
        { r: 3, c: 1, isMine: false, isRevealed: false, isFlagged: false, neighborMines: 0 },
        { r: 3, c: 2, isMine: false, isRevealed: false, isFlagged: false, neighborMines: 0 },
        { r: 3, c: 3, isMine: false, isRevealed: false, isFlagged: false, neighborMines: 0 },
      ],
    ];

    cascadeReveal(0, 0, size, grid);

    // All non-mine cells should be revealed
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!grid[r]![c]!.isMine) {
          expect(grid[r]![c]!.isRevealed).toBe(true);
        } else {
          expect(grid[r]![c]!.isRevealed).toBe(false);
        }
      }
    }
  });

  it("does not cascade into flagged cells", () => {
    const size = 3;
    const grid: MinesweeperCell[][] = [
      [
        { r: 0, c: 0, isMine: false, isRevealed: false, isFlagged: false, neighborMines: 0 },
        { r: 0, c: 1, isMine: false, isRevealed: false, isFlagged: true, neighborMines: 0 }, // Flagged!
        { r: 0, c: 2, isMine: false, isRevealed: false, isFlagged: false, neighborMines: 0 },
      ],
      [
        { r: 1, c: 0, isMine: false, isRevealed: false, isFlagged: false, neighborMines: 0 },
        { r: 1, c: 1, isMine: false, isRevealed: false, isFlagged: false, neighborMines: 0 },
        { r: 1, c: 2, isMine: false, isRevealed: false, isFlagged: false, neighborMines: 0 },
      ],
      [
        { r: 2, c: 0, isMine: false, isRevealed: false, isFlagged: false, neighborMines: 0 },
        { r: 2, c: 1, isMine: false, isRevealed: false, isFlagged: false, neighborMines: 0 },
        { r: 2, c: 2, isMine: false, isRevealed: false, isFlagged: false, neighborMines: 0 },
      ],
    ];

    cascadeReveal(0, 0, size, grid);
    expect(grid[0]![1]!.isRevealed).toBe(false);
    expect(grid[0]![1]!.isFlagged).toBe(true);
  });

  it("evaluates victory correctly", () => {
    const size = 2;
    const grid: MinesweeperCell[][] = [
      [
        { r: 0, c: 0, isMine: true, isRevealed: false, isFlagged: true, neighborMines: 0 },
        { r: 0, c: 1, isMine: false, isRevealed: true, isFlagged: false, neighborMines: 1 },
      ],
      [
        { r: 1, c: 0, isMine: false, isRevealed: true, isFlagged: false, neighborMines: 1 },
        { r: 1, c: 1, isMine: false, isRevealed: false, isFlagged: false, neighborMines: 1 },
      ],
    ];

    expect(checkMinesweeperVictory(size, grid)).toBe(false);

    grid[1]![1]!.isRevealed = true;
    expect(checkMinesweeperVictory(size, grid)).toBe(true);
  });
});
