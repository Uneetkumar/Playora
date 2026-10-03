import { describe, it, expect } from "vitest";
import {
  createAntState,
  stepAnts,
  swat,
  fireSpray,
  spawnBug,
  rollBugType,
  cakeY,
  BUG_KINDS,
  START_HEALTH,
  SPRAY_COOLDOWN,
  WHIFF_GRACE,
  type AntState,
} from "../ant-attack";

const opts = (over: Partial<Parameters<typeof stepAnts>[2]> = {}) => ({
  width: 800,
  height: 600,
  spawnIntervalMs: 550,
  wave: 1,
  rng: () => 0.5,
  ...over,
});
const run = (s: AntState, seconds: number, o = opts()) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) stepAnts(s, 1 / 60, o);
};

describe("ant attack", () => {
  it("starts with a whole cake and no bugs", () => {
    const s = createAntState();
    expect(s.cakeHealth).toBe(START_HEALTH);
    expect(s.bugs).toHaveLength(0);
  });

  it("spawns on the interval it is given, not a hardcoded one", () => {
    // Spawn was a fixed 550ms regardless of wave, so the swarm never thickened.
    const s = createAntState();
    run(s, 1, opts({ spawnIntervalMs: 250 }));
    expect(s.bugs.length).toBeGreaterThanOrEqual(3);
  });

  it("sends heavier bugs as the waves climb", () => {
    const heavyAt = (wave: number) => {
      let heavy = 0;
      for (let i = 0; i < 100; i++) {
        const t = rollBugType(() => i / 100, wave);
        if (t === "queen" || t === "beetle") heavy += 1;
      }
      return heavy;
    };
    expect(heavyAt(10)).toBeGreaterThan(heavyAt(1));
  });

  it("moves bugs toward the cake", () => {
    const s = createAntState();
    const o = opts();
    s.bugs = [spawnBug(s, o)];
    const startY = s.bugs[0]!.y;
    run(s, 0.5, o);
    if (s.bugs.length) expect(s.bugs[0]!.y).toBeGreaterThan(startY);
  });

  it("damages the cake when a bug reaches it", () => {
    const s = createAntState();
    const o = opts();
    s.bugs = [{ ...spawnBug(s, o), y: cakeY(o.height) - 11, angle: Math.PI / 2, speed: 5 }];
    run(s, 0.2, opts({ spawnIntervalMs: 999_999 }));
    expect(s.cakeHealth).toBeLessThan(START_HEALTH);
    expect(s.events.reachedCake > 0 || s.cakeHealth < START_HEALTH).toBe(true);
  });

  it("a queen hurts more than a worker", () => {
    expect(BUG_KINDS.queen.damage).toBeGreaterThan(BUG_KINDS.worker.damage);
  });

  it("ends the run when the cake is gone", () => {
    const s = createAntState();
    s.cakeHealth = 5;
    const o = opts({ spawnIntervalMs: 999_999 });
    s.bugs = [{ ...spawnBug(s, o), y: cakeY(o.height) - 11, angle: Math.PI / 2, speed: 5 }];
    // Events are per-step, so the death has to be caught on the step it
    // happens rather than read after the loop has moved on.
    let sawDeath = false;
    for (let i = 0; i < 12; i++) {
      stepAnts(s, 1 / 60, o);
      if (s.events.died) sawDeath = true;
    }
    expect(s.over).toBe(true);
    expect(sawDeath).toBe(true);
  });

  it("swats a bug that is under the finger", () => {
    const s = createAntState();
    const o = opts();
    const bug = { ...spawnBug(s, o), x: 100, y: 100, hp: 1 };
    s.bugs = [bug];
    const result = swat(s, 100, 100);
    expect(result.hit).toBe(true);
    expect(result.killed?.id).toBe(bug.id);
    expect(s.bugs).toHaveLength(0);
  });

  it("takes more than one hit to kill a tough bug", () => {
    const s = createAntState();
    const o = opts();
    s.bugs = [{ ...spawnBug(s, o), x: 100, y: 100, type: "queen", hp: 4, maxHp: 4 }];
    expect(swat(s, 100, 100).killed).toBeNull();
    expect(s.bugs[0]!.hp).toBe(3);
  });

  it("misses cleanly when nothing is there", () => {
    const s = createAntState();
    const result = swat(s, 10, 10);
    expect(result.hit).toBe(false);
    expect(result.points).toBe(0);
  });

  it("has a forgiving hit radius, because a finger is not a pointer", () => {
    const s = createAntState();
    const o = opts();
    s.bugs = [{ ...spawnBug(s, o), x: 100, y: 100, size: 18, hp: 1 }];
    // 40px away still counts.
    expect(swat(s, 140, 100).hit).toBe(true);
  });

  it("the spray clears the board and then has to recharge", () => {
    const s = createAntState();
    const o = opts();
    s.bugs = [spawnBug(s, o), spawnBug(s, o), spawnBug(s, o)];
    expect(fireSpray(s)).toBe(3);
    expect(s.bugs).toHaveLength(0);
    expect(s.sprayCooldown).toBe(SPRAY_COOLDOWN);
    expect(fireSpray(s)).toBeNull();
  });

  it("counts the spray cooldown on the same clock as everything else", () => {
    // It used to run on its own third `setInterval`.
    const s = createAntState();
    s.sprayCooldown = 2;
    run(s, 1, opts({ spawnIntervalMs: 999_999 }));
    expect(s.sprayCooldown).toBeGreaterThan(0.9);
    expect(s.sprayCooldown).toBeLessThan(1.1);
  });

  it("a whiff starts a grace period, and connecting cancels it", () => {
    // The old `setTimeout` version was only cancelled by *another whiff*, so
    // killing a bug right after a near-miss did not save the streak.
    const s = createAntState();
    const o = opts();
    swat(s, 5, 5);
    expect(s.whiffGrace).toBeGreaterThan(0);

    s.bugs = [{ ...spawnBug(s, o), x: 100, y: 100, hp: 1 }];
    swat(s, 100, 100);
    expect(s.whiffGrace).toBeNull();
  });

  it("breaks the chain when the grace runs out", () => {
    const s = createAntState();
    swat(s, 5, 5);
    let broke = false;
    for (let i = 0; i < Math.ceil(WHIFF_GRACE * 60) + 4; i++) {
      stepAnts(s, 1 / 60, opts({ spawnIntervalMs: 999_999 }));
      if (s.events.chainBroken) broke = true;
    }
    expect(broke).toBe(true);
    expect(s.whiffGrace).toBeNull();
  });

  it("does nothing once the run is over", () => {
    const s = createAntState();
    s.over = true;
    const before = s.bugs.length;
    run(s, 2);
    expect(s.bugs.length).toBe(before);
    expect(swat(s, 0, 0).hit).toBe(false);
    expect(fireSpray(s)).toBeNull();
  });
});
