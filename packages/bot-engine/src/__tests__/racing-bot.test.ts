import { describe, it, expect } from "vitest";
import {
  BikeRaceEngine,
  CarRaceEngine,
  COUNTDOWN_TICKS,
  SERVER_PLAYER_ID,
  type RacingAction,
  type RacingEngine,
  type RacingGameState,
} from "@playora/game-engine";
import type { Player } from "@playora/game-types";
import { RacingBot } from "../racing/RacingBot.js";
import type { AiLevel } from "../types.js";

const seeded = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const players = (n: number): Player[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    userId: `p${i + 1}`,
    displayName: `Player ${i + 1}`,
    isBot: true,
    isGuest: false,
    seat: i,
  })) as Player[];

const tick = (ticks = 1): RacingAction => ({
  type: "TICK",
  playerId: SERVER_PLAYER_ID,
  payload: { ticks },
  timestamp: Date.now(),
});

/**
 * Runs a full race with every seat driven by a bot.
 *
 * Bots are asked for an action every 5 ticks rather than every tick, which is
 * how the server will drive them: a decision twelve times a second is plenty
 * for a vehicle and a twelfth of the work.
 */
function runRace(
  engine: RacingEngine,
  levels: AiLevel[],
  seed: string,
  trackLength = 1400,
): RacingGameState {
  let state = engine.init(players(levels.length), { randomSeed: seed, trackLength });
  const bots = levels.map((_, i) => new RacingBot(engine, seeded(1000 + i)));

  for (let elapsed = 0; elapsed < 60 * 300 && !state.isFinished; elapsed += 5) {
    state.playerOrder.forEach((id, i) => {
      if (state.vehicles[id]!.finishedAtTick !== null) return;
      const action = bots[i]!.chooseAction(state, id, levels[i]!);
      if (action) state = engine.executeAction(state, action).state;
    });
    state = engine.applyAction(state, tick(5)).state;
  }
  return state;
}

describe("RacingBot", () => {
  const car = new CarRaceEngine();

  it("only ever proposes actions the engine accepts", () => {
    let state = car.init(players(2), { randomSeed: "legal", trackLength: 900 });
    const bot = new RacingBot(car, seeded(7));

    for (let elapsed = 0; elapsed < 60 * 120 && !state.isFinished; elapsed += 5) {
      for (const id of state.playerOrder) {
        if (state.vehicles[id]!.finishedAtTick !== null) continue;
        const action = bot.chooseAction(state, id, 5);
        if (!action) continue;
        // The safety claim in one assertion: a bot goes through the same door
        // a human does, and cannot reach a state a player could not.
        expect(car.validateAction(state, action)).toEqual({ valid: true });
        state = car.executeAction(state, action).state;
      }
      state = car.applyAction(state, tick(5)).state;
    }
  });

  it("never asks to advance the clock", () => {
    const state = car.init(players(1), { randomSeed: "no-tick" });
    const bot = new RacingBot(car, seeded(1));
    for (let i = 0; i < 50; i++) {
      const action = bot.chooseAction(state, "p1", 7);
      expect(action?.type).not.toBe("TICK");
    }
  });

  it("stays off the throttle during the countdown", () => {
    const state = car.init(players(1), { randomSeed: "countdown" });
    const bot = new RacingBot(car, seeded(2));
    const action = bot.chooseAction(state, "p1", 7)!;
    expect((action.payload as { throttle: boolean }).throttle).toBe(false);
    expect(state.tick).toBeLessThan(COUNTDOWN_TICKS);
  });

  it("declines to act for a vehicle that has already finished", () => {
    const state = car.init(players(1), { randomSeed: "done" });
    const finished: RacingGameState = {
      ...state,
      vehicles: { p1: { ...state.vehicles.p1!, finishedAtTick: 10 } },
    };
    expect(new RacingBot(car, seeded(3)).chooseAction(finished, "p1", 5)).toBeNull();
  });

  it("finishes a race unaided", () => {
    const state = runRace(car, [5], "solo");
    expect(state.isFinished).toBe(true);
    expect(state.vehicles.p1!.distance).toBeGreaterThanOrEqual(1400);
  });

  it("keeps four bots on the road for a whole race", () => {
    const state = runRace(car, [3, 4, 5, 6], "field");
    expect(state.isFinished).toBe(true);
    for (const vehicle of Object.values(state.vehicles)) {
      expect(Math.abs(vehicle.lateral)).toBeLessThanOrEqual(1.25);
      expect(Number.isFinite(vehicle.distance)).toBe(true);
    }
  });

  it("makes a master beat a beginner", () => {
    // Seats are swapped between runs so the result is skill, not grid position.
    let masterWins = 0;
    for (let round = 0; round < 8; round++) {
      const levels: AiLevel[] = round % 2 === 0 ? [1, 7] : [7, 1];
      const state = runRace(car, levels, `duel-${round}`, 1200);
      const masterSeat = round % 2 === 0 ? "p2" : "p1";
      if (state.vehicles[masterSeat]!.place === 1) masterWins += 1;
    }
    expect(masterWins).toBeGreaterThanOrEqual(7);
  });

  it("drives a bike as well as a car", () => {
    const bike = new BikeRaceEngine();
    const state = runRace(bike, [5, 5], "bikes");
    expect(state.isFinished).toBe(true);
    expect(state.winnerId).toBeTruthy();
  });

  it("detours for coins at high levels and ignores them at low ones", () => {
    // Averaged over several tracks, because on any single one a novice weaving
    // across the road crosses coin lines by accident and can out-collect a
    // driver holding a tight line. Over six tracks the difference is roughly
    // double, which is the actual behaviour the profile flag buys.
    const total = (level: AiLevel) =>
      ["c1", "c2", "c3", "c4", "c5", "c6"].reduce(
        (sum, seed) => sum + runRace(car, [level], seed, 1800).vehicles.p1!.coins,
        0,
      );

    expect(total(5)).toBeGreaterThan(total(1) * 1.5);
  });

  it("gets round faster the higher the level", () => {
    // The cleanest statement of what difficulty means here: the same track,
    // the same physics, less time taken.
    const pace = (level: AiLevel) =>
      ["c1", "c2", "c3"].reduce(
        (sum, seed) => sum + runRace(car, [level], seed, 1800).tick,
        0,
      );

    const beginner = pace(1);
    const middling = pace(3);
    const master = pace(7);

    expect(middling).toBeLessThan(beginner);
    expect(master).toBeLessThan(middling);
  });

  it("spends nitro rather than hoarding it", () => {
    const state = runRace(car, [6], "nitro", 2000);
    expect(state.vehicles.p1!.nitroCharges).toBeLessThan(2);
  });

  it("thinks faster at higher levels", () => {
    const bot = new RacingBot(car, seeded(4));
    expect(bot.thinkingTimeMs(7)).toBeLessThan(bot.thinkingTimeMs(1));
  });

  it("reports the game id of the engine it was given", () => {
    expect(new RacingBot(new CarRaceEngine()).gameId).toBe("car-race");
    expect(new RacingBot(new BikeRaceEngine()).gameId).toBe("bike-race");
  });
});
