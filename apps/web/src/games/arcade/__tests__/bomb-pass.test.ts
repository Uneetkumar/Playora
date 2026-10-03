import { describe, it, expect } from "vitest";
import {
  createBombState,
  stepBomb,
  passBomb,
  fuseForWave,
  botPassChance,
  humanAlive,
  HUMAN_ID,
  type BombState,
} from "../bomb-pass";

const opts = (wave = 1, rngValue = 0.5) => ({ wave, rng: () => rngValue });
const run = (s: BombState, seconds: number, o = opts()) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) stepBomb(s, 1 / 60, o);
};

describe("bomb pass", () => {
  it("starts with four alive and the human holding", () => {
    const s = createBombState();
    expect(s.players.filter((p) => p.alive)).toHaveLength(4);
    expect(s.holderId).toBe(HUMAN_ID);
  });

  it("burns the fuse in real time", () => {
    const s = createBombState();
    const before = s.fuse;
    run(s, 1);
    expect(before - s.fuse).toBeGreaterThan(0.9);
    expect(before - s.fuse).toBeLessThan(1.1);
  });

  it("counts the human's hold", () => {
    const s = createBombState();
    run(s, 0.5);
    expect(s.held).toBeGreaterThan(0.4);
  });

  it("eliminates the holder when the fuse expires", () => {
    const s = createBombState();
    s.fuse = 0.01;
    stepBomb(s, 1 / 60, opts());
    expect(s.players.find((p) => p.id === HUMAN_ID)!.alive).toBe(false);
    expect(s.events.exploded).toBe(true);
    expect(s.events.died).toBe(true);
  });

  it("scores the human only for a round they were not holding", () => {
    const s = createBombState();
    s.holderId = "p2";
    s.fuse = 0.01;
    stepBomb(s, 1 / 60, opts());
    expect(s.events.survivedRound).toBe(true);
    expect(s.events.died).toBe(false);
  });

  it("shortens the fuse as the wave climbs, with a floor", () => {
    // It used to reset to a hardcoded 7.0 every round, so the wave badge
    // described an escalation the bomb never performed.
    expect(fuseForWave(5)).toBeLessThan(fuseForWave(1));
    expect(fuseForWave(99)).toBeGreaterThanOrEqual(3);
  });

  it("makes bots desperate as the fuse burns down", () => {
    // The old AI rolled a flat 35% every 1200ms no matter how much fuse was
    // left, so a bot on two seconds behaved like one on eight.
    expect(botPassChance(1)).toBeGreaterThan(botPassChance(4));
    expect(botPassChance(4)).toBeGreaterThan(botPassChance(8));
  });

  it("a bot passes it on rather than sitting on it", () => {
    const s = createBombState();
    s.holderId = "p2";
    s.botThink = 0.1;
    s.fuse = 5;
    run(s, 0.5, opts(1, 0.1));
    expect(s.holderId).not.toBe("p2");
    expect(s.events.botPassed || s.holderId !== "p2").toBe(true);
  });

  it("a bot never passes after the fuse is gone", () => {
    const s = createBombState();
    s.holderId = "p2";
    s.botThink = 0.5;
    s.fuse = 0.1;
    run(s, 0.3, opts(1, 0.1));
    expect(s.players.find((p) => p.id === "p2")!.alive).toBe(false);
  });

  it("passing does NOT reset the fuse — that is the strategy", () => {
    const s = createBombState();
    run(s, 3);
    const fuseAtPass = s.fuse;
    passBomb(s, "p3");
    expect(s.fuse).toBeCloseTo(fuseAtPass, 3);
    expect(s.holderId).toBe("p3");
  });

  it("returns the hold so it can be banked, and clears it", () => {
    const s = createBombState();
    run(s, 2);
    const held = passBomb(s, "p2");
    expect(held).toBeGreaterThan(1.9);
    expect(s.held).toBe(0);
  });

  it("refuses a pass when the human is not holding", () => {
    const s = createBombState();
    s.holderId = "p2";
    expect(passBomb(s, "p3")).toBeNull();
  });

  it("refuses a pass to a dead player or to yourself", () => {
    const s = createBombState();
    s.players = s.players.map((p) => (p.id === "p3" ? { ...p, alive: false } : p));
    expect(passBomb(s, "p3")).toBeNull();
    expect(passBomb(s, HUMAN_ID)).toBeNull();
  });

  it("ends with a winner when one is left", () => {
    const s = createBombState();
    s.players = s.players.map((p) => (p.id === "p3" || p.id === "p4" ? { ...p, alive: false } : p));
    s.holderId = HUMAN_ID;
    s.fuse = 0.01;
    stepBomb(s, 1 / 60, opts());
    expect(s.over).toBe(true);
    expect(s.winner).toBe("ApexBot");
  });

  it("one tick eliminates exactly one player", () => {
    const s = createBombState();
    s.fuse = 0.01;
    stepBomb(s, 1 / 60, opts());
    expect(s.players.filter((p) => !p.alive)).toHaveLength(1);
  });

  it("knows whether the human is still in", () => {
    const s = createBombState();
    expect(humanAlive(s)).toBe(true);
    s.players = s.players.map((p) => (p.id === HUMAN_ID ? { ...p, alive: false } : p));
    expect(humanAlive(s)).toBe(false);
  });
});
