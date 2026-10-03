import { describe, it, expect } from "vitest";
import {
  INITIAL_RUN_TALLY,
  runTallyReducer,
  type RunTally,
  type RunTallyAction,
} from "../use-arcade-run";
import { pointsFor } from "../scoring";

const apply = (actions: RunTallyAction[], from: RunTally = INITIAL_RUN_TALLY) =>
  actions.reduce(runTallyReducer, from);

describe("runTallyReducer", () => {
  it("scores one hit exactly once", () => {
    const after = runTallyReducer(INITIAL_RUN_TALLY, { type: "hit", basePoints: 10 });
    expect(after).toEqual({ score: 10, combo: 1, bestCombo: 1 });
  });

  it("is pure, so StrictMode calling it twice cannot double count", () => {
    // React double-invokes reducers and updaters in development. The old
    // hook added to the score inside one, and every hit counted twice.
    const before = { ...INITIAL_RUN_TALLY };
    const first = runTallyReducer(before, { type: "hit", basePoints: 10 });
    const second = runTallyReducer(before, { type: "hit", basePoints: 10 });
    expect(second).toEqual(first);
    expect(first.score).toBe(10);
    expect(before).toEqual(INITIAL_RUN_TALLY);
  });

  it("applies the combo multiplier as the chain grows", () => {
    const after = apply([
      { type: "hit", basePoints: 10 },
      { type: "hit", basePoints: 10 },
      { type: "hit", basePoints: 10 },
    ]);
    expect(after.combo).toBe(3);
    expect(after.score).toBe(pointsFor(10, 1) + pointsFor(10, 2) + pointsFor(10, 3));
  });

  it("ends the chain on a miss but keeps the score and longest chain", () => {
    const after = apply([
      { type: "hit", basePoints: 10 },
      { type: "hit", basePoints: 10 },
      { type: "miss" },
      { type: "hit", basePoints: 10 },
    ]);
    expect(after.combo).toBe(1);
    expect(after.bestCombo).toBe(2);
    expect(after.score).toBe(pointsFor(10, 1) + pointsFor(10, 2) + pointsFor(10, 1));
  });

  it("returns the same object for a miss with no chain, so nothing re-renders", () => {
    expect(runTallyReducer(INITIAL_RUN_TALLY, { type: "miss" })).toBe(INITIAL_RUN_TALLY);
  });

  it("banks flat points without the chain multiplier, and ends the chain", () => {
    const chained = apply(Array.from({ length: 6 }, () => ({ type: "hit", basePoints: 1 }) as const));
    const after = runTallyReducer(chained, { type: "bank", points: 90 });
    expect(after.score).toBe(chained.score + 90);
    expect(after.combo).toBe(0);
    expect(after.bestCombo).toBe(6);
  });

  it("rounds banked points and never banks a negative", () => {
    expect(runTallyReducer(INITIAL_RUN_TALLY, { type: "bank", points: 12.6 }).score).toBe(13);
    expect(runTallyReducer(INITIAL_RUN_TALLY, { type: "bank", points: -50 }).score).toBe(0);
  });

  it("resets to the initial tally", () => {
    const played = apply([
      { type: "hit", basePoints: 10 },
      { type: "bank", points: 5 },
    ]);
    expect(runTallyReducer(played, { type: "reset" })).toEqual(INITIAL_RUN_TALLY);
  });
});
