import { describe, it, expect } from "vitest";
import { GameLoop } from "@playora/game-runtime";
import {
  createRushState,
  stepRush,
  removeTarget,
  ROUND_SECONDS,
  MAX_TARGETS,
  TARGET_LIFETIME,
  type RushState,
} from "../target-rush";

const seeded = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};

/** Runs the simulation through the real loop against a clock we control. */
const play = (seconds: number, spawnIntervalMs = 650, seed = 1) => {
  const s = createRushState();
  const rng = seeded(seed);
  let now = 0;
  const loop = new GameLoop(
    { update: (dt) => stepRush(s, dt, { spawnIntervalMs, rng }) },
    {},
    { now: () => now, requestFrame: () => 1, cancelFrame: () => {} },
  );
  loop.start();
  // 16ms frames, which is what a real display would deliver.
  for (let t = 0; t < seconds * 1000; t += 16) {
    now += 16;
    loop.frame(now);
  }
  return { state: s, loop };
};

describe("target rush simulation", () => {
  it("counts the round down in real seconds", () => {
    const { state } = play(10);
    // Ten seconds of frames should remove ten seconds from the clock, within
    // one step. A setInterval countdown could not promise this.
    expect(ROUND_SECONDS - state.timeLeft).toBeGreaterThan(9.9);
    expect(ROUND_SECONDS - state.timeLeft).toBeLessThan(10.1);
  });

  it("ends the round when the clock runs out", () => {
    const { state } = play(ROUND_SECONDS + 1);
    expect(state.over).toBe(true);
    expect(state.timeLeft).toBe(0);
  });

  it("spawns targets as time passes", () => {
    const { state } = play(3);
    expect(state.targets.length).toBeGreaterThan(0);
  });

  it("never exceeds the on-screen cap", () => {
    const s = createRushState();
    const rng = seeded(3);
    for (let i = 0; i < 4000; i++) stepRush(s, 1 / 60, { spawnIntervalMs: 16, rng });
    expect(s.targets.length).toBeLessThanOrEqual(MAX_TARGETS);
  });

  it("expires targets rather than leaving them standing", () => {
    // The bug this fixes: targets persisted until clicked, so the board
    // saturated at six and the game stopped being timed.
    const s = createRushState();
    const rng = seeded(4);
    stepRush(s, 1 / 60, { spawnIntervalMs: 0, rng });
    expect(s.targets).toHaveLength(1);
    const id = s.targets[0]!.id;
    for (let i = 0; i < Math.ceil(TARGET_LIFETIME * 60) + 2; i++) {
      stepRush(s, 1 / 60, { spawnIntervalMs: 999_999, rng });
    }
    expect(s.targets.find((t) => t.id === id)).toBeUndefined();
  });

  it("reports an expired bullseye so the chain can break, but not expired TNT", () => {
    const s = createRushState();
    const rng = seeded(5);
    // Fill the board, then let everything time out with no further spawns.
    for (let i = 0; i < 60; i++) stepRush(s, 1 / 60, { spawnIntervalMs: 0, rng });
    const bullseyes = s.targets.filter((t) => t.type !== "tnt").length;
    let reported = 0;
    for (let i = 0; i < Math.ceil(TARGET_LIFETIME * 60) + 4; i++) {
      stepRush(s, 1 / 60, { spawnIntervalMs: 999_999, rng });
      reported += s.expiredThisStep;
    }
    expect(reported).toBe(bullseyes);
  });

  it("is deterministic for a seed", () => {
    const a = play(5, 650, 42).state;
    const b = play(5, 650, 42).state;
    expect(a.targets.map((t) => `${t.id}:${t.type}`)).toEqual(
      b.targets.map((t) => `${t.id}:${t.type}`),
    );
    expect(a.timeLeft).toBe(b.timeLeft);
  });

  it("runs the same simulation regardless of frame rate", () => {
    // The property `setInterval` could never provide: a 30fps device and a
    // 144Hz display play the same game.
    const at = (frameMs: number): RushState => {
      const s = createRushState();
      const rng = seeded(7);
      let now = 0;
      const loop = new GameLoop(
        { update: (dt) => stepRush(s, dt, { spawnIntervalMs: 650, rng }) },
        { maxStepsPerFrame: 20 },
        { now: () => now, requestFrame: () => 1, cancelFrame: () => {} },
      );
      loop.start();
      for (let t = 0; t < 5000; t += frameMs) {
        now += frameMs;
        loop.frame(now);
      }
      return s;
    };
    const slow = at(33);
    const fast = at(7);
    expect(Math.abs(slow.timeLeft - fast.timeLeft)).toBeLessThan(0.05);
  });

  it("removes a hit target and reports whether it was there", () => {
    const s = createRushState();
    const rng = seeded(8);
    stepRush(s, 1 / 60, { spawnIntervalMs: 0, rng });
    const id = s.targets[0]!.id;
    expect(removeTarget(s, id)).toBe(true);
    expect(removeTarget(s, id)).toBe(false);
    expect(s.targets).toHaveLength(0);
  });

  it("stops simulating once the round is over", () => {
    const s = createRushState();
    s.timeLeft = 0.001;
    const rng = seeded(9);
    stepRush(s, 1 / 60, { spawnIntervalMs: 0, rng });
    expect(s.over).toBe(true);
    const targets = s.targets.length;
    stepRush(s, 1 / 60, { spawnIntervalMs: 0, rng });
    expect(s.targets.length).toBe(targets);
  });
});
