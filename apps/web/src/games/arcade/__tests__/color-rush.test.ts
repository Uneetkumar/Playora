import { describe, it, expect } from "vitest";
import {
  createColorState,
  stepColor,
  matchColor,
  fallSpeedFor,
  START_LIVES,
  FLOOR_Y,
} from "../color-rush";

const opts = (wave = 1, spawnIntervalMs = 1100) => ({
  spawnIntervalMs,
  wave,
  rng: () => 0.1,
});

describe("colour rush", () => {
  it("starts with lives and an empty arena", () => {
    const s = createColorState();
    expect(s.lives).toBe(START_LIVES);
    expect(s.orbs).toHaveLength(0);
  });

  it("spawns on the interval it is given", () => {
    const s = createColorState();
    for (let i = 0; i < 60; i++) stepColor(s, 1 / 60, opts(1, 500));
    // One second at a 500ms interval is two orbs.
    expect(s.orbs.length).toBe(2);
  });

  it("actually gets harder — this is the bug it was written for", () => {
    // Spawn was hardcoded at 1100ms and fall speed at a constant 62.5, so the
    // wave counter in the HUD described an escalation that did not exist.
    expect(fallSpeedFor(5)).toBeGreaterThan(fallSpeedFor(1));
    expect(fallSpeedFor(20)).toBeGreaterThan(fallSpeedFor(5));
  });

  it("caps the fall speed so it stays playable", () => {
    expect(fallSpeedFor(500)).toBeLessThanOrEqual(150);
  });

  it("costs a life when an orb reaches the floor", () => {
    const s = createColorState();
    s.orbs = [{ id: 1, color: "cyan", y: FLOOR_Y - 0.5 }];
    stepColor(s, 1 / 60, opts());
    expect(s.events.dropped).toBe(1);
    expect(s.lives).toBe(START_LIVES - 1);
    expect(s.orbs).toHaveLength(0);
  });

  it("ends the run when the last life goes", () => {
    const s = createColorState();
    s.lives = 1;
    s.orbs = [{ id: 1, color: "cyan", y: FLOOR_Y - 0.5 }];
    stepColor(s, 1 / 60, opts());
    expect(s.over).toBe(true);
    expect(s.events.died).toBe(true);
    expect(s.lives).toBe(0);
  });

  it("clears the lowest orb on a correct colour", () => {
    const s = createColorState();
    s.orbs = [
      { id: 1, color: "red", y: 40 },
      { id: 2, color: "cyan", y: 10 },
    ];
    expect(matchColor(s, "red")).toBe("hit");
    expect(s.orbs.map((o) => o.id)).toEqual([2]);
    expect(s.lives).toBe(START_LIVES);
  });

  it("costs a life on the wrong colour and leaves the orb", () => {
    const s = createColorState();
    s.orbs = [{ id: 1, color: "red", y: 40 }];
    expect(matchColor(s, "cyan")).toBe("wrong");
    expect(s.lives).toBe(START_LIVES - 1);
    expect(s.orbs).toHaveLength(1);
  });

  it("reports an empty arena rather than punishing a tap into nothing", () => {
    const s = createColorState();
    expect(matchColor(s, "cyan")).toBe("empty");
    expect(s.lives).toBe(START_LIVES);
  });

  it("does nothing once the run is over", () => {
    const s = createColorState();
    s.over = true;
    s.orbs = [{ id: 1, color: "red", y: 10 }];
    stepColor(s, 1 / 60, opts());
    expect(s.orbs[0]!.y).toBe(10);
    expect(matchColor(s, "cyan")).toBe("empty");
  });

  it("falls at the same rate regardless of step size", () => {
    // The property the 40ms interval could not give: a throttled tab and a
    // 144Hz display drop the orb at the same speed.
    const fall = (dt: number, steps: number) => {
      const s = createColorState();
      s.orbs = [{ id: 1, color: "cyan", y: 0 }];
      for (let i = 0; i < steps; i++) stepColor(s, dt, opts(1, 999_999));
      return s.orbs[0]?.y ?? FLOOR_Y;
    };
    const a = fall(1 / 60, 30); // half a second
    const b = fall(1 / 120, 60); // half a second
    expect(Math.abs(a - b)).toBeLessThan(0.5);
  });
});
