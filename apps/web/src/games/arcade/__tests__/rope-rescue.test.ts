import { describe, it, expect } from "vitest";
import {
  createRopeState,
  stepRope,
  setAnchor,
  startZip,
  nextLevel,
  starsFor,
  batchSizeFor,
  CLEAR_FRACTION,
  START_ANCHOR,
  type RopeState,
} from "../rope-rescue";

const opts = (wave = 1, rngValue = 0.99) => ({ wave, rng: () => rngValue });
const run = (s: RopeState, seconds: number, o = opts()) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) stepRope(s, 1 / 60, o);
};

describe("rope rescue", () => {
  it("starts with a batch waiting and nobody zipping", () => {
    const s = createRopeState();
    expect(s.waiting).toBe(batchSizeFor(1));
    expect(s.zipping).toBe(false);
  });

  it("sends bigger batches at higher levels, then holds", () => {
    // `level` used to be cosmetic: a button incremented it, restart never
    // reset it, and nothing read it.
    expect(batchSizeFor(3)).toBeGreaterThan(batchSizeFor(1));
    expect(batchSizeFor(99)).toBeLessThanOrEqual(18);
  });

  it("moves the blade on the same clock as everything else", () => {
    const s = createRopeState();
    const before = s.sawY;
    run(s, 1);
    expect(s.sawY).not.toBe(before);
  });

  it("does not send anyone until zipping starts", () => {
    const s = createRopeState();
    run(s, 2);
    expect(s.rescued + s.lost).toBe(0);
  });

  it("sends survivors across once started", () => {
    const s = createRopeState();
    startZip(s);
    run(s, 1);
    expect(s.rescued + s.lost).toBeGreaterThan(0);
  });

  it("a rope clear of the blade mostly rescues", () => {
    const s = createRopeState();
    // rng at 0.99 never trips the low clear-rope risk.
    setAnchor(s, 250);
    s.sawY = 70;
    startZip(s);
    run(s, 2, opts(1, 0.99));
    expect(s.rescued).toBeGreaterThan(0);
    expect(s.lost).toBe(0);
  });

  it("a rope through the blade mostly loses", () => {
    const s = createRopeState();
    // rng at 0.01 trips even a modest risk.
    startZip(s);
    run(s, 2, opts(1, 0.01));
    expect(s.lost).toBeGreaterThan(0);
  });

  it("clears the level when enough survive", () => {
    const s = createRopeState();
    setAnchor(s, 250);
    s.sawY = 70;
    startZip(s);
    run(s, 20, opts(1, 0.99));
    expect(s.cleared).toBe(true);
    expect(s.over).toBe(false);
    expect(s.rescued / batchSizeFor(1)).toBeGreaterThanOrEqual(CLEAR_FRACTION);
  });

  it("ends the run when too many are lost", () => {
    const s = createRopeState();
    startZip(s);
    run(s, 20, opts(1, 0.001));
    expect(s.over).toBe(true);
    expect(s.cleared).toBe(false);
    expect(s.events.died || s.over).toBe(true);
  });

  it("awards stars on the share rescued", () => {
    const s = createRopeState();
    s.rescued = batchSizeFor(1);
    expect(starsFor(s)).toBe(3);
    s.rescued = Math.ceil(batchSizeFor(1) * 0.5);
    expect(starsFor(s)).toBe(2);
    s.rescued = 1;
    expect(starsFor(s)).toBe(1);
    s.rescued = 0;
    expect(starsFor(s)).toBe(0);
  });

  it("the next level is a fresh batch that is bigger", () => {
    const s = createRopeState();
    s.rescued = 5;
    const n = nextLevel(s);
    expect(n.level).toBe(2);
    expect(n.rescued).toBe(0);
    expect(n.waiting).toBe(batchSizeFor(2));
    expect(n.anchorY).toBe(START_ANCHOR);
  });

  it("clamps the rope to the arena", () => {
    const s = createRopeState();
    setAnchor(s, -500);
    expect(s.anchorY).toBeGreaterThanOrEqual(70);
    setAnchor(s, 9999);
    expect(s.anchorY).toBeLessThanOrEqual(250);
  });

  it("stops simulating once the level is cleared or the run is over", () => {
    const s = createRopeState();
    s.cleared = true;
    const before = s.sawY;
    run(s, 2);
    expect(s.sawY).toBe(before);
  });
});
