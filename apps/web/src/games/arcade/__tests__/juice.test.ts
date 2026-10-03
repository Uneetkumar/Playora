import { describe, it, expect } from "vitest";
import { shakeOffset, hitStopMs, squash, waveAt, secondsToNextWave, SHAKE } from "../juice";

describe("screen shake", () => {
  it("is silent once the decay is over", () => {
    expect(shakeOffset(SHAKE.heavy, 300, 300, 1)).toEqual({ x: 0, y: 0 });
    expect(shakeOffset(SHAKE.heavy, 999, 300, 1)).toEqual({ x: 0, y: 0 });
  });

  it("never exceeds the strength it was given", () => {
    for (let t = 0; t < 300; t += 7) {
      const o = shakeOffset(SHAKE.heavy, t, 300, 3);
      expect(Math.abs(o.x)).toBeLessThanOrEqual(SHAKE.heavy);
      expect(Math.abs(o.y)).toBeLessThanOrEqual(SHAKE.heavy);
    }
  });

  it("decays — later is always calmer than earlier, on average", () => {
    const energy = (from: number, to: number) => {
      let sum = 0;
      for (let t = from; t < to; t += 3) {
        const o = shakeOffset(SHAKE.heavy, t, 300, 5);
        sum += Math.hypot(o.x, o.y);
      }
      return sum;
    };
    expect(energy(150, 300)).toBeLessThan(energy(0, 150));
  });

  it("is deterministic, so a re-render mid-shake does not teleport the screen", () => {
    expect(shakeOffset(SHAKE.solid, 40, 200, 9)).toEqual(shakeOffset(SHAKE.solid, 40, 200, 9));
  });

  it("scales with how big the event was", () => {
    // A routine tap must not shake like a game over, or the player learns to
    // ignore the shake entirely.
    expect(SHAKE.tap).toBeLessThan(SHAKE.solid);
    expect(SHAKE.solid).toBeLessThan(SHAKE.heavy);
    expect(SHAKE.heavy).toBeLessThan(SHAKE.fatal);
  });
});

describe("hit-stop", () => {
  it("does not freeze on a routine hit", () => {
    expect(hitStopMs("tap")).toBe(0);
  });

  it("lands in the three-to-five frame window for a real impact", () => {
    expect(hitStopMs("solid")).toBeGreaterThanOrEqual(45);
    expect(hitStopMs("solid")).toBeLessThanOrEqual(55);
    expect(hitStopMs("heavy")).toBeGreaterThan(hitStopMs("solid"));
  });

  it("is capped, so it never reads as a dropped frame", () => {
    for (const s of ["tap", "solid", "heavy", "fatal"] as const) {
      expect(hitStopMs(s)).toBeLessThanOrEqual(120);
    }
  });
});

describe("squash and stretch", () => {
  it("is neutral at rest", () => {
    expect(squash(1)).toEqual({ x: 1, y: 1 });
    expect(squash(-0.5)).toEqual({ x: 1, y: 1 });
  });

  it("conserves volume — squashing one axis stretches the other", () => {
    for (const p of [0.1, 0.3, 0.5, 0.8]) {
      const s = squash(p);
      expect(s.x * s.y).toBeCloseTo(1, 6);
    }
  });

  it("compresses rather than expands", () => {
    // A hit should flatten the thing, not inflate it.
    const mid = squash(0.5);
    expect(mid.y).toBeLessThan(1);
    expect(mid.x).toBeGreaterThan(1);
  });

  it("settles back to rest", () => {
    expect(squash(0.99).y).toBeCloseTo(1, 1);
  });
});

describe("waves", () => {
  it("starts at wave 1", () => {
    expect(waveAt(0)).toBe(1);
    expect(waveAt(19)).toBe(1);
  });

  it("advances on schedule and never goes backwards", () => {
    expect(waveAt(20)).toBe(2);
    expect(waveAt(41)).toBe(3);
    let previous = 0;
    for (let s = 0; s < 300; s++) {
      const w = waveAt(s);
      expect(w).toBeGreaterThanOrEqual(previous);
      previous = w;
    }
  });

  it("treats a negative clock as the start of the run", () => {
    expect(waveAt(-50)).toBe(1);
  });

  it("counts down to the next wave", () => {
    expect(secondsToNextWave(0)).toBe(20);
    expect(secondsToNextWave(15)).toBe(5);
    expect(secondsToNextWave(20)).toBe(20);
  });
});
