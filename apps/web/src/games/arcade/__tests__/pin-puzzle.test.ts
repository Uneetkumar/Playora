import { describe, it, expect } from "vitest";
import {
  buildPinLevel,
  canPull,
  chamberAfter,
  isDeadEnd,
  isSolved,
  nextSafePin,
} from "../pin-puzzle";

const seeded = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};

describe("pin puzzle rules", () => {
  const level = buildPinLevel(1, seeded(1));
  const water = level.pins.find((p) => p.content === "water")!;
  const gold = level.pins.find((p) => p.content === "gold")!;

  it("starts with the lava hot", () => {
    expect(chamberAfter(level, []).lavaHot).toBe(true);
  });

  it("melts the gold if it is dropped on hot lava", () => {
    expect(chamberAfter(level, [gold.id]).melted).toBe(true);
    expect(canPull(level, gold.id, [])).toBe(false);
  });

  it("cools the lava with water, which makes the gold safe", () => {
    expect(chamberAfter(level, [water.id]).lavaHot).toBe(false);
    expect(canPull(level, gold.id, [water.id])).toBe(true);
    expect(chamberAfter(level, [water.id, gold.id]).goldBanked).toBe(1);
  });

  it("lets the heat back in after each gold, so every gold is paid for", () => {
    // The whole reason a level is more than one decision.
    expect(chamberAfter(level, [water.id, gold.id]).lavaHot).toBe(true);
  });

  it("wastes a rock dropped on lava that is already cool", () => {
    const withRock = buildPinLevel(9, seeded(4));
    const w = withRock.pins.find((p) => p.content === "water")!;
    const rock = withRock.pins.find((p) => p.content === "rock");
    if (!rock) return;
    // Cooled by the water, so the rock buys nothing.
    const after = chamberAfter(withRock, [w.id, rock.id]);
    expect(after.lavaHot).toBe(false);
    expect(isDeadEnd(withRock, [w.id, rock.id])).toBe(true);
  });

  it("accepts a rock as a coolant against hot lava", () => {
    const withRock = buildPinLevel(9, seeded(4));
    const rock = withRock.pins.find((p) => p.content === "rock");
    if (!rock) return;
    expect(chamberAfter(withRock, [rock.id]).lavaHot).toBe(false);
  });
});

describe("pin puzzle levels", () => {
  it("is always solvable by its own solution, with no wrong step on the way", () => {
    for (let lvl = 1; lvl <= 12; lvl++) {
      const built = buildPinLevel(lvl, seeded(lvl));
      const pulled: string[] = [];
      for (const id of built.solution) {
        expect(canPull(built, id, pulled), `level ${lvl} at ${id}`).toBe(true);
        expect(isDeadEnd(built, pulled), `level ${lvl} stranded at ${id}`).toBe(false);
        pulled.push(id);
      }
      expect(isSolved(built, pulled), `level ${lvl}`).toBe(true);
    }
  });

  it("gets harder by tightening the budget, not by adding rules", () => {
    // Early levels carry a spare coolant; later ones give exactly enough.
    const early = buildPinLevel(1, seeded(1));
    const late = buildPinLevel(12, seeded(1));
    const spare = (l: ReturnType<typeof buildPinLevel>) =>
      l.pins.filter((p) => p.content !== "gold").length -
      l.pins.filter((p) => p.content === "gold").length;
    expect(spare(early)).toBeGreaterThan(spare(late));
    expect(spare(late)).toBe(0);
  });

  it("asks for more gold as the levels go on", () => {
    const golds = (l: ReturnType<typeof buildPinLevel>) =>
      l.pins.filter((p) => p.content === "gold").length;
    expect(golds(buildPinLevel(1, seeded(1)))).toBeLessThan(golds(buildPinLevel(9, seeded(1))));
  });

  it("keeps the board readable", () => {
    for (let lvl = 1; lvl <= 30; lvl++) {
      expect(buildPinLevel(lvl, seeded(lvl)).pins.length).toBeLessThanOrEqual(6);
    }
  });

  it("has no pin that does nothing", () => {
    // The original had three pins and used two. Every content here has an
    // effect: water and rock cool, gold banks.
    for (let lvl = 1; lvl <= 12; lvl++) {
      for (const pin of buildPinLevel(lvl, seeded(lvl)).pins) {
        expect(["water", "rock", "gold"]).toContain(pin.content);
      }
    }
  });

  it("leaves more than one way through, so there is a decision at each pin", () => {
    // A strict chain has exactly one safe pin at a time, which is what made
    // the previous design a guess. At least one level must offer a choice.
    let sawChoice = false;
    for (let lvl = 1; lvl <= 12; lvl++) {
      const built = buildPinLevel(lvl, seeded(lvl));
      const safe = built.pins.filter((p) => canPull(built, p.id, []));
      if (safe.length > 1) sawChoice = true;
    }
    expect(sawChoice).toBe(true);
  });

  it("refuses to pull the same pin twice", () => {
    const built = buildPinLevel(3, seeded(4));
    const first = built.solution[0]!;
    expect(canPull(built, first, [])).toBe(true);
    expect(canPull(built, first, [first])).toBe(false);
  });

  it("shuffles the display order, so the answer is not left-to-right", () => {
    let anyShuffled = false;
    for (let seed = 1; seed <= 12; seed++) {
      const built = buildPinLevel(9, seeded(seed));
      if (built.pins.map((p) => p.id).join() !== built.solution.join()) anyShuffled = true;
    }
    expect(anyShuffled).toBe(true);
  });

  it("spots a stranded board rather than leaving the player pulling at it", () => {
    const built = buildPinLevel(12, seeded(7));
    const gold = built.pins.find((p) => p.content === "gold")!;
    const coolants = built.pins.filter((p) => p.content !== "gold");
    // Burn two coolants back to back: the second is wasted on cool lava, and
    // a tight level cannot absorb that.
    if (coolants.length >= 2 && built.pins.filter((p) => p.content === "gold").length >= 2) {
      expect(isDeadEnd(built, [coolants[0]!.id, coolants[1]!.id])).toBe(true);
    }
    expect(isDeadEnd(built, [gold.id])).toBe(true);
  });

  it("offers one sound step as a hint, not the whole chamber", () => {
    const built = buildPinLevel(7, seeded(5));
    const hint = nextSafePin(built, [])!;
    expect(canPull(built, hint, [])).toBe(true);
    expect(isDeadEnd(built, [hint])).toBe(false);
    expect(nextSafePin(built, built.solution)).toBeNull();
  });

  it("is deterministic for a seed", () => {
    expect(buildPinLevel(6, seeded(9))).toEqual(buildPinLevel(6, seeded(9)));
  });
});
