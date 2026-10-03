import { describe, it, expect } from "vitest";
import {
  createFloorState,
  stepFloor,
  moveFloor,
  tileAt,
  collapseDelayFor,
  GRID,
  LAYERS,
} from "../falling-floor";

const opts = (wave = 1) => ({ wave, rng: () => 0.5 });
const run = (s: ReturnType<typeof createFloorState>, seconds: number, wave = 1) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) stepFloor(s, 1 / 60, opts(wave));
};

describe("falling floor", () => {
  it("builds a full grid on every layer", () => {
    const s = createFloorState();
    expect(s.tiles).toHaveLength(GRID * GRID * LAYERS);
  });

  it("starts the player on an intact tile that begins shaking", () => {
    const s = createFloorState();
    stepFloor(s, 1 / 60, opts());
    expect(tileAt(s, s.layer, s.row, s.col)!.state).toBe("shaking");
  });

  it("collapses the tile the player is standing on after the delay", () => {
    const s = createFloorState();
    const tile = () => tileAt(s, 1, s.row, s.col)!;
    stepFloor(s, 1 / 60, opts());
    expect(tile().state).toBe("shaking");
    run(s, collapseDelayFor(1) + 0.1);
    // The player did not move, so they drop a layer and the tile is gone.
    expect(s.layer).toBe(2);
  });

  it("drops a layer rather than ending the run, until the last one", () => {
    const s = createFloorState();
    run(s, collapseDelayFor(1) + 0.1);
    expect(s.layer).toBe(2);
    expect(s.over).toBe(false);
    run(s, collapseDelayFor(1) + 0.1);
    expect(s.layer).toBe(3);
    expect(s.over).toBe(false);
    run(s, collapseDelayFor(1) + 0.1);
    expect(s.over).toBe(true);
  });

  it("pays each survived second exactly once", () => {
    const s = createFloorState();
    let paid = 0;
    for (let i = 0; i < 60 * 3; i++) {
      stepFloor(s, 1 / 60, opts());
      paid += s.events.secondsSurvived;
      if (s.over) break;
    }
    // Three seconds of stepping, and never the same second twice.
    expect(paid).toBeLessThanOrEqual(3);
    expect(paid).toBeGreaterThanOrEqual(2);
  });

  it("gets harder as the wave climbs, with a floor", () => {
    expect(collapseDelayFor(5)).toBeLessThan(collapseDelayFor(1));
    expect(collapseDelayFor(50)).toBeGreaterThanOrEqual(0.32);
  });

  it("clamps movement to the grid", () => {
    const s = createFloorState();
    for (let i = 0; i < 10; i++) moveFloor(s, -1, -1, opts());
    expect(s.row).toBe(0);
    expect(s.col).toBe(0);
    for (let i = 0; i < 10; i++) moveFloor(s, 1, 1, opts());
    expect(s.row).toBe(GRID - 1);
    expect(s.col).toBe(GRID - 1);
  });

  it("starts the new tile shaking when the player moves onto it", () => {
    const s = createFloorState();
    moveFloor(s, 1, 0, opts());
    expect(tileAt(s, s.layer, s.row, s.col)!.state).toBe("shaking");
  });

  it("awards the prize and moves it somewhere else", () => {
    const s = createFloorState();
    // Place the prize under the player's next step.
    s.prize = { row: s.row + 1, col: s.col };
    moveFloor(s, 1, 0, opts());
    expect(s.events.prizeTaken).toBe(true);
    expect(s.prize).not.toEqual({ row: s.row, col: s.col });
  });

  it("stepping onto an already-collapsed tile drops the player through", () => {
    const s = createFloorState();
    const target = tileAt(s, 1, s.row + 1, s.col)!;
    target.state = "collapsed";
    moveFloor(s, 1, 0, opts());
    expect(s.events.fellThrough).toBe(true);
    expect(s.layer).toBe(2);
  });

  it("does nothing once the run is over", () => {
    const s = createFloorState();
    s.over = true;
    const before = JSON.stringify(s.tiles);
    stepFloor(s, 1 / 60, opts());
    moveFloor(s, 1, 1, opts());
    expect(JSON.stringify(s.tiles)).toBe(before);
  });

  it("a restart is a fresh grid, with no collapse left over from the last run", () => {
    // The bug the old `setTimeout` version needed a cleanup to avoid.
    const s = createFloorState();
    run(s, 2);
    const fresh = createFloorState();
    expect(fresh.tiles.every((t) => t.state === "intact")).toBe(true);
    expect(fresh.tiles.every((t) => t.shakeLeft === 0)).toBe(true);
    expect(fresh.over).toBe(false);
  });
});
