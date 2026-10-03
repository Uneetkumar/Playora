import { describe, it, expect } from "vitest";
import {
  createPotatoState,
  stepPotato,
  passPotato,
  nextActiveIndex,
  humanAlive,
  HUMAN_INDEX,
  type PotatoState,
} from "../hot-potato";

const opts = (wave = 1) => ({ wave, rng: () => 0.5 });
const run = (s: PotatoState, seconds: number, wave = 1) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) stepPotato(s, 1 / 60, opts(wave));
};

describe("hot potato", () => {
  it("starts with five players and the human holding", () => {
    const s = createPotatoState();
    expect(s.players).toHaveLength(5);
    expect(s.holder).toBe(HUMAN_INDEX);
    expect(s.fuse).toBeGreaterThan(0);
  });

  it("counts the human's hold while they have it", () => {
    const s = createPotatoState();
    run(s, 0.5);
    expect(s.held).toBeGreaterThan(0.4);
    expect(s.held).toBeLessThan(0.6);
  });

  it("eliminates whoever holds it when the fuse runs out", () => {
    const s = createPotatoState();
    s.fuse = 0.1;
    run(s, 0.2);
    expect(s.events.exploded || s.players[HUMAN_INDEX]!.eliminated).toBe(true);
    expect(s.players[HUMAN_INDEX]!.eliminated).toBe(true);
  });

  it("never hands the potato to someone already out", () => {
    // The original advance was `(idx + 1) % 5`, which could pass to an
    // eliminated player and then eliminate them again.
    const roster = createPotatoState().players.map((p, i) =>
      i === 1 || i === 2 ? { ...p, eliminated: true } : p,
    );
    expect(nextActiveIndex(0, roster)).toBe(3);
  });

  it("resets the fuse and the hold after an explosion", () => {
    const s = createPotatoState();
    s.fuse = 0.01;
    s.held = 4;
    stepPotato(s, 1 / 60, opts());
    expect(s.fuse).toBeGreaterThan(0);
    expect(s.held).toBe(0);
  });

  it("ends when one player is left, and names them", () => {
    const s = createPotatoState();
    // Everyone out but the last bot and whoever is holding.
    s.players = s.players.map((p, i) => (i > 1 ? { ...p, eliminated: true } : p));
    s.holder = 0;
    s.fuse = 0.01;
    stepPotato(s, 1 / 60, opts());
    expect(s.over).toBe(true);
    expect(s.winner).toBe("SpudLord");
    expect(s.events.died).toBe(true);
  });

  it("reports the hold when the human passes, so it can be banked", () => {
    const s = createPotatoState();
    run(s, 1.2);
    passPotato(s, opts());
    expect(s.events.humanPassedAfter).toBeGreaterThan(1);
    expect(s.held).toBe(0);
    expect(s.holder).not.toBe(HUMAN_INDEX);
  });

  it("banks nothing when a bot passes", () => {
    const s = createPotatoState();
    s.holder = 1;
    passPotato(s, opts());
    expect(s.events.humanPassedAfter).toBeNull();
  });

  it("bots pass it on by themselves", () => {
    const s = createPotatoState();
    s.holder = 1;
    s.botDelay = 0.3;
    s.fuse = 10;
    run(s, 0.5);
    expect(s.holder).not.toBe(1);
  });

  it("a bot never passes after the fuse has gone", () => {
    // Otherwise the potato escapes the explosion and nobody is eliminated.
    const s = createPotatoState();
    s.holder = 1;
    s.botDelay = 0.5;
    s.fuse = 0.1;
    run(s, 0.3);
    expect(s.players[1]!.eliminated).toBe(true);
  });

  it("does nothing once the game is over", () => {
    const s = createPotatoState();
    s.over = true;
    const before = JSON.stringify(s);
    stepPotato(s, 1 / 60, opts());
    passPotato(s, opts());
    expect(JSON.parse(before).holder).toBe(s.holder);
  });

  it("knows whether the human is still in", () => {
    const s = createPotatoState();
    expect(humanAlive(s)).toBe(true);
    s.players = s.players.map((p, i) => (i === 0 ? { ...p, eliminated: true } : p));
    expect(humanAlive(s)).toBe(false);
  });

  it("one tick eliminates exactly one player", () => {
    // The StrictMode double-invoke bug: work inside a state updater ran twice,
    // so a single logical tick took out two players.
    const s = createPotatoState();
    s.fuse = 0.01;
    stepPotato(s, 1 / 60, opts());
    expect(s.players.filter((p) => p.eliminated)).toHaveLength(1);
  });
});
