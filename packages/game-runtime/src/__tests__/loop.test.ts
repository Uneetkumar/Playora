import { describe, it, expect } from "vitest";
import { GameLoop } from "../loop.js";

/** A clock we control, so the loop's behaviour is observed rather than timed. */
const harness = (opts = {}) => {
  const updates: Array<{ dt: number; tick: number }> = [];
  const renders: number[] = [];
  let now = 0;
  const loop = new GameLoop(
    {
      update: (dt, tick) => updates.push({ dt, tick }),
      render: (alpha) => renders.push(alpha),
    },
    opts,
    { now: () => now, requestFrame: () => 1, cancelFrame: () => {} },
  );
  return {
    loop,
    updates,
    renders,
    advance(ms: number) {
      now += ms;
      loop.frame(now);
    },
  };
};

describe("fixed-timestep loop", () => {
  it("runs a whole number of steps with an identical dt", () => {
    const h = harness();
    h.loop.start();
    // 51ms rather than 50: three steps of 1000/60 sum to 50.000000000000004,
    // so exactly 50 lands on the wrong side of the boundary and the third step
    // carries to the next frame. Correct, but not what this test is about.
    h.advance(51);
    expect(h.updates).toHaveLength(3);
    expect(new Set(h.updates.map((u) => u.dt)).size).toBe(1);
    expect(h.updates[0]!.dt).toBeCloseTo(1 / 60, 5);
  });

  it("carries the remainder rather than dropping or duplicating time", () => {
    const h = harness();
    h.loop.start();
    h.advance(10);
    expect(h.updates).toHaveLength(0);
    h.advance(10);
    // The two 10ms frames add up to one step plus change.
    expect(h.updates).toHaveLength(1);
  });

  it("loses no time at a step boundary — the remainder carries", () => {
    const h = harness();
    h.loop.start();
    h.advance(50);
    const first = h.updates.length;
    h.advance(1);
    // The step that 50ms just missed arrives on the very next frame.
    expect(h.updates.length).toBe(first + 1);
  });

  it("renders once per frame regardless of how many steps ran", () => {
    const h = harness();
    h.loop.start();
    h.advance(50);
    h.advance(2);
    expect(h.renders).toHaveLength(2);
  });

  it("caps catch-up after a stall instead of simulating it all at once", () => {
    const h = harness({ maxStepsPerFrame: 5 });
    h.loop.start();
    // Ten seconds hidden. Without the cap this is 600 steps in one frame,
    // which freezes the page and then teleports everything.
    h.advance(10_000);
    expect(h.updates).toHaveLength(5);
  });

  it("does not replay the pause when resumed", () => {
    const h = harness();
    h.loop.start();
    h.loop.pause();
    h.advance(5_000);
    expect(h.updates).toHaveLength(0);
    h.loop.resume();
    h.advance(16.7);
    // One step for the frame after resuming, not 300 for the pause.
    expect(h.updates).toHaveLength(1);
  });

  it("counts ticks monotonically for deterministic replay", () => {
    const h = harness();
    h.loop.start();
    // Kept under the default 5-step catch-up cap, which is a separate rule
    // with its own test.
    h.advance(85);
    expect(h.updates.map((u) => u.tick)).toEqual([0, 1, 2, 3, 4]);
    expect(h.loop.ticks).toBe(5);
  });

  it("reports running state through pause and stop", () => {
    const h = harness();
    expect(h.loop.isRunning).toBe(false);
    h.loop.start();
    expect(h.loop.isRunning).toBe(true);
    h.loop.pause();
    expect(h.loop.isRunning).toBe(false);
    h.loop.resume();
    expect(h.loop.isRunning).toBe(true);
    h.loop.stop();
    expect(h.loop.isRunning).toBe(false);
  });

  it("honours a custom step rate", () => {
    const h = harness({ stepsPerSecond: 30 });
    h.loop.start();
    h.advance(101);
    expect(h.updates).toHaveLength(3);
    expect(h.updates[0]!.dt).toBeCloseTo(1 / 30, 5);
  });

  it("gives render an interpolation factor inside [0,1)", () => {
    const h = harness();
    h.loop.start();
    h.advance(25);
    const alpha = h.renders.at(-1)!;
    expect(alpha).toBeGreaterThanOrEqual(0);
    expect(alpha).toBeLessThan(1);
  });

  it("ignores a second start", () => {
    const h = harness();
    h.loop.start();
    h.advance(20);
    const count = h.updates.length;
    h.loop.start();
    h.advance(0);
    expect(h.updates.length).toBe(count);
  });
});
