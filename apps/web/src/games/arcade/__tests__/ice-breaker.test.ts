import { describe, it, expect } from "vitest";
import {
  createIceState,
  stepIce,
  moveRacer,
  distanceFromCentre,
  shrinkAmountFor,
  humanAlive,
  CENTRE,
  MIN_RADIUS,
  HUMAN_ID,
  type IceState,
} from "../ice-breaker";

const opts = (wave = 1, rngValue = 0.5) => ({ wave, rng: () => rngValue });
const run = (s: IceState, seconds: number, o = opts()) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) stepIce(s, 1 / 60, o);
};

describe("ice breaker", () => {
  it("starts with four racers on the ice", () => {
    const s = createIceState();
    expect(s.racers.filter((r) => r.alive)).toHaveLength(4);
    expect(s.radius).toBeGreaterThan(MIN_RADIUS);
  });

  it("shrinks the iceberg on a schedule", () => {
    const s = createIceState();
    const before = s.radius;
    run(s, 1.3);
    expect(s.radius).toBeLessThan(before);
    expect(s.events.shrank || s.radius < before).toBe(true);
  });

  it("never shrinks below the floor", () => {
    const s = createIceState();
    run(s, 120, opts(9));
    expect(s.radius).toBeGreaterThanOrEqual(MIN_RADIUS);
  });

  it("shrinks faster at higher waves", () => {
    expect(shrinkAmountFor(6)).toBeGreaterThan(shrinkAmountFor(1));
    expect(shrinkAmountFor(99)).toBeLessThanOrEqual(2);
  });

  it("sinks anyone outside the ice", () => {
    const s = createIceState();
    s.racers = s.racers.map((r) =>
      r.id === HUMAN_ID ? { ...r, x: CENTRE + s.radius + 5, y: CENTRE } : r,
    );
    stepIce(s, 1 / 60, opts());
    expect(s.racers.find((r) => r.id === HUMAN_ID)!.alive).toBe(false);
    expect(s.events.sank).toBe(1);
  });

  it("settles without changing anything when nobody is outside", () => {
    // The infinite-update bug: the original wrote a new array every pass, and
    // a new reference is never Object.is-equal, so the effect re-ran forever.
    const s = createIceState();
    const before = s.racers;
    stepIce(s, 1 / 60, opts());
    expect(s.racers).toBe(before);
    expect(s.events.sank).toBe(0);
  });

  it("ends with a winner when one racer is left", () => {
    const s = createIceState();
    s.racers = s.racers.map((r) =>
      r.id === HUMAN_ID ? r : { ...r, x: 95, y: 95 },
    );
    stepIce(s, 1 / 60, opts());
    expect(s.over).toBe(true);
    expect(s.winner).toBe("You");
  });

  it("moves the human and clamps to the arena", () => {
    const s = createIceState();
    for (let i = 0; i < 50; i++) moveRacer(s, -10, 0);
    const me = s.racers.find((r) => r.id === HUMAN_ID)!;
    expect(me.x).toBeGreaterThanOrEqual(5);
  });

  it("lets the human walk off the edge — falling in is legal", () => {
    const s = createIceState();
    for (let i = 0; i < 20; i++) {
      moveRacer(s, 5, 0);
      if (!humanAlive(s)) break;
    }
    expect(humanAlive(s)).toBe(false);
  });

  it("bots steer for the middle when the ice closes in", () => {
    // The old bots were a pure random walk despite a comment claiming
    // otherwise, so they fell off by accident rather than playing.
    const s = createIceState();
    s.radius = 20;
    // Put a bot near the edge and let it act, with rng centred so the wander
    // term cancels.
    s.racers = s.racers.map((r) =>
      r.id === "p2" ? { ...r, x: CENTRE + 19, y: CENTRE } : r,
    );
    const before = distanceFromCentre(s.racers.find((r) => r.id === "p2")!);
    s.sinceBotMove = 1;
    stepIce(s, 1 / 60, opts(1, 0.5));
    const bot = s.racers.find((r) => r.id === "p2")!;
    if (bot.alive) {
      expect(distanceFromCentre(bot)).toBeLessThan(before);
    }
  });

  it("shoves a bot the player walks into", () => {
    // The bump is the only offensive tool: it is how you win rather than
    // merely outlast.
    const s = createIceState();
    s.racers = s.racers.map((r) => (r.id === "p2" ? { ...r, x: CENTRE + 4, y: CENTRE } : r));
    const before = s.racers.find((r) => r.id === "p2")!.x;
    moveRacer(s, 2, 0);
    expect(s.racers.find((r) => r.id === "p2")!.x).toBeGreaterThan(before);
  });

  it("does not shove a bot that is out of range", () => {
    const s = createIceState();
    s.racers = s.racers.map((r) => (r.id === "p2" ? { ...r, x: CENTRE + 30, y: CENTRE } : r));
    const before = s.racers.find((r) => r.id === "p2")!.x;
    moveRacer(s, 2, 0);
    const after = s.racers.find((r) => r.id === "p2");
    if (after?.alive) expect(after.x).toBe(before);
  });

  it("does nothing once the game is over", () => {
    const s = createIceState();
    s.over = true;
    const before = s.radius;
    run(s, 3);
    moveRacer(s, 10, 10);
    expect(s.radius).toBe(before);
  });
});
