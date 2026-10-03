import { describe, it, expect } from "vitest";
import type { GameId, Player } from "@playora/game-types";
import { CarRaceEngine } from "../racing/CarRaceEngine.js";
import { BikeRaceEngine } from "../racing/BikeRaceEngine.js";
import { buildTrack, sampleTrack, trackCenterline, trackToWorld } from "../racing/track.js";
import { cornerSpeedFor, brakingDistance, planCorner } from "../racing/racing-line.js";
import { MAX_CURVATURE } from "../racing/track.js";
import {
  BIKES,
  CARS,
  vehicleById,
  vehicleStats,
  type VehicleSpec,
} from "../racing/garage.js";
import {
  BIKE_LEVELS,
  CAR_LEVELS,
  isPass,
  levelsFor,
  starsFor,
  unlockedLevels,
} from "../racing/levels.js";
import {
  COUNTDOWN_TICKS,
  SERVER_PLAYER_ID,
  TICK_RATE,
  type RacingAction,
  type RacingGameState,
  type VehicleInput,
} from "../racing/types.js";

const players = (n: number): Player[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    userId: `p${i + 1}`,
    displayName: `Player ${i + 1}`,
    isBot: false,
    isGuest: false,
    seat: i,
  })) as Player[];

const tickAction = (ticks = 1): RacingAction => ({
  type: "TICK",
  playerId: SERVER_PLAYER_ID,
  payload: { ticks },
  timestamp: Date.now(),
});

const inputAction = (playerId: string, input: Partial<VehicleInput>): RacingAction => ({
  type: "SET_INPUT",
  playerId,
  payload: input,
  timestamp: Date.now(),
});

/** Runs the race past the countdown so the vehicles can actually move. */
function started(engine: CarRaceEngine | BikeRaceEngine, count = 1): RacingGameState {
  let state = engine.init(players(count), { randomSeed: "test-track", trackLength: 1500 });
  for (let i = 0; i < COUNTDOWN_TICKS / 20 + 2; i++) {
    state = engine.applyAction(state, tickAction(20)).state;
  }
  return state;
}

/**
 * Steers towards the centre of the road, countering the corner.
 *
 * Tests that hold the throttle with no steering do not test racing — the car
 * is thrown into the wall by the first bend and beaches there, which is correct
 * physics and a useless test. This is the minimum competent driver, and it is
 * what lets a test actually complete a lap.
 */
function autoInput(state: RacingGameState, playerId: string): Partial<VehicleInput> {
  const vehicle = state.vehicles[playerId]!;
  const { curvature } = sampleTrack(state.track, vehicle.distance);
  const correction = -vehicle.lateral * 2.5 + curvature * 24;
  return { throttle: true, steer: Math.max(-1, Math.min(1, correction)) };
}

/** Runs a race to its end with every vehicle driven competently. */
function raceToEnd(
  engine: CarRaceEngine | BikeRaceEngine,
  state: RacingGameState,
  maxTicks = 60 * 180,
): RacingGameState {
  let next = state;
  for (let elapsed = 0; elapsed < maxTicks && !next.isFinished; elapsed += 5) {
    for (const id of next.playerOrder) {
      if (next.vehicles[id]!.finishedAtTick === null) {
        next = engine.applyAction(next, inputAction(id, autoInput(next, id))).state;
      }
    }
    next = engine.applyAction(next, tickAction(5)).state;
  }
  return next;
}

function drive(
  engine: CarRaceEngine | BikeRaceEngine,
  state: RacingGameState,
  playerId: string,
  input: Partial<VehicleInput>,
  ticks: number,
): RacingGameState {
  let next = engine.applyAction(state, inputAction(playerId, input)).state;
  for (let i = 0; i < ticks; i += 20) {
    next = engine.applyAction(next, tickAction(Math.min(20, ticks - i))).state;
  }
  return next;
}

describe("track generation", () => {
  it("is deterministic for a seed", () => {
    const a = buildTrack("same-seed", 2000);
    const b = buildTrack("same-seed", 2000);
    expect(a).toEqual(b);
  });

  it("differs between seeds", () => {
    const a = buildTrack("seed-a", 2000);
    const b = buildTrack("seed-b", 2000);
    expect(a.segments).not.toEqual(b.segments);
  });

  it("closes into a loop", () => {
    // A lap needs the road to come back to where it started.
    for (const seed of ["c1", "c2", "c3", "c4"]) {
      const track = buildTrack(seed, 2000);
      const first = track.points[0]!;
      const last = track.points[track.points.length - 1]!;
      const gap = Math.hypot(last.x - first.x, last.z - first.z);
      // Within one sample step, which is what "adjacent" means here.
      expect(gap, `seed ${seed} leaves a ${gap.toFixed(1)}m gap at the join`).toBeLessThan(14);
    }
  });

  it("starts on the straightest part of the circuit", () => {
    // The grid, the countdown and the finish line all sit here.
    for (const seed of ["s1", "s2", "s3"]) {
      const track = buildTrack(seed, 2000);
      const opening = track.segments.slice(0, 6).reduce((m, s) => Math.max(m, Math.abs(s.curvature)), 0);
      const worst = track.segments.reduce((m, s) => Math.max(m, Math.abs(s.curvature)), 0);
      expect(opening).toBeLessThan(worst);
    }
  });

  it("never blocks the road completely", () => {
    // A track that can be walled off is not hard, it is broken.
    for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      const track = buildTrack(seed, 4000);
      const byDistance = new Map<number, typeof track.obstacles>();
      for (const o of track.obstacles) {
        byDistance.set(o.distance, [...(byDistance.get(o.distance) ?? []), o]);
      }

      for (const [distance, group] of byDistance) {
        // Sample the road and check at least one lateral position is clear.
        let clear = false;
        for (let x = -1; x <= 1.0001; x += 0.05) {
          if (group.every((o) => Math.abs(o.lateral - x) > o.halfWidth + 0.16)) {
            clear = true;
            break;
          }
        }
        expect(clear, `seed ${seed} blocks the road at ${distance}m`).toBe(true);
      }
    }
  });

  it("keeps coins out of obstacles", () => {
    const track = buildTrack("coins", 3000);
    for (const coin of track.coins) {
      const inside = track.obstacles.some(
        (o) => Math.abs(o.distance - coin.distance) < 6 && Math.abs(o.lateral - coin.lateral) < o.halfWidth,
      );
      expect(inside, `coin at ${coin.distance} sits inside an obstacle`).toBe(false);
    }
  });

  it("spaces the centreline evenly by distance", () => {
    // Sampled by arc length, not by angle: uneven spacing would build the road
    // out of stretched quads exactly where it turns.
    const track = buildTrack("line", 2000);
    const line = trackCenterline(track);
    expect(line.length).toBeGreaterThan(10);

    for (let i = 1; i < line.length; i++) {
      const gap = Math.hypot(line[i]!.x - line[i - 1]!.x, line[i]!.z - line[i - 1]!.z);
      expect(gap).toBeGreaterThan(8);
      expect(gap).toBeLessThan(12);
    }
    expect(sampleTrack(track, 0).curvature).toBeCloseTo(track.segments[0]!.curvature);
  });
});

describe("server authority", () => {
  const engine = new CarRaceEngine();

  it("refuses to let a player advance the clock", () => {
    const state = engine.init(players(2), { randomSeed: "auth" });
    const result = engine.validateAction(state, {
      type: "TICK",
      playerId: "p1",
      payload: { ticks: 10_000 },
      timestamp: Date.now(),
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("server");
  });

  it("accepts a tick from the server", () => {
    const state = engine.init(players(2), { randomSeed: "auth" });
    expect(engine.validateAction(state, tickAction()).valid).toBe(true);
  });

  it("refuses input from someone not in the race", () => {
    const state = engine.init(players(2), { randomSeed: "auth" });
    expect(engine.validateAction(state, inputAction("stranger", { throttle: true })).valid).toBe(false);
  });

  it("caps how far one tick action can advance the world", () => {
    // A caller that has been asleep must not teleport every vehicle down the
    // road in a single step, skipping every collision test on the way.
    const state = started(engine);
    const after = engine.applyAction(state, tickAction(100_000)).state;
    expect(after.tick - state.tick).toBeLessThanOrEqual(20);
  });

  it("clamps a steering value instead of trusting it", () => {
    const state = started(engine);
    const after = engine.applyAction(state, inputAction("p1", { steer: 500 })).state;
    expect(after.vehicles.p1!.input.steer).toBe(1);
  });

  it("ignores a position a client tries to send", () => {
    const state = started(engine);
    const before = state.vehicles.p1!.distance;
    const after = engine.applyAction(state, {
      type: "SET_INPUT",
      playerId: "p1",
      // There is no field for this; the point is that inventing one changes nothing.
      payload: { steer: 0, distance: 999_999, speed: 999 } as never,
      timestamp: Date.now(),
    }).state;
    expect(after.vehicles.p1!.distance).toBe(before);
    expect(after.vehicles.p1!.speed).toBe(state.vehicles.p1!.speed);
  });
});

describe("racing", () => {
  const engine = new CarRaceEngine();

  it("holds everyone on the grid through the countdown", () => {
    let state = engine.init(players(2), { randomSeed: "grid", trackLength: 1500 });
    for (let i = 0; i < 20; i++) state = engine.applyAction(state, tickAction(5)).state;

    expect(state.racingPhase).toBe("countdown");
    // Throttle during the countdown must not move anyone.
    state = drive(engine, state, "p1", { throttle: true }, 40);
    expect(state.vehicles.p1!.speed).toBe(0);
  });

  it("starts the race after the countdown", () => {
    const state = started(engine, 2);
    expect(state.racingPhase).toBe("racing");
  });

  it("accelerates under throttle and slows when it is released", () => {
    let state = started(engine);
    state = drive(engine, state, "p1", { throttle: true }, 120);
    const fast = state.vehicles.p1!.speed;
    expect(fast).toBeGreaterThan(10);

    state = drive(engine, state, "p1", { throttle: false }, 120);
    expect(state.vehicles.p1!.speed).toBeLessThan(fast);
  });

  it("never exceeds the top speed without nitro", () => {
    /*
     * The track is stripped of everything that grants a boost.
     *
     * "Without nitro" used to mean "we did not press the button", which held
     * only for as long as the car happened not to drive over a boost pad. The
     * new circuits put one on its line and the ceiling was legitimately
     * exceeded — a fragile premise, not a bug.
     */
    const base = started(engine);
    const clean: RacingGameState = {
      ...base,
      track: { ...base.track, boostPads: [], zones: [], pickups: [] },
    };
    const state = drive(engine, clean, "p1", { throttle: true }, 60 * 30);
    expect(state.vehicles.p1!.speed).toBeLessThanOrEqual(engine.vehicleTuning().maxSpeed + 0.001);
  });

  it("cannot steer while stationary", () => {
    let state = started(engine);
    const before = state.vehicles.p1!.lateral;
    state = drive(engine, state, "p1", { steer: 1, throttle: false }, 60);
    expect(state.vehicles.p1!.lateral).toBeCloseTo(before, 3);
  });

  it("steers once moving", () => {
    let state = started(engine);
    state = drive(engine, state, "p1", { throttle: true }, 180);
    const before = state.vehicles.p1!.lateral;
    state = drive(engine, state, "p1", { throttle: true, steer: 1 }, 60);
    expect(state.vehicles.p1!.lateral).toBeGreaterThan(before);
  });

  it("keeps the vehicle on the road", () => {
    let state = started(engine);
    state = drive(engine, state, "p1", { throttle: true, steer: 1 }, 60 * 20);
    expect(Math.abs(state.vehicles.p1!.lateral)).toBeLessThanOrEqual(1.25);
  });

  it("spends one nitro charge per press, not per tick held", () => {
    let state = started(engine);
    state = drive(engine, state, "p1", { throttle: true }, 60);
    const charges = state.vehicles.p1!.nitroCharges;

    state = drive(engine, state, "p1", { throttle: true, nitro: true }, 120);
    expect(state.vehicles.p1!.nitroCharges).toBe(charges - 1);
  });

  it("goes faster on nitro than without it, from the same start", () => {
    // Compared against the same starting state over the same stretch of road,
    // so the only difference is the boost.
    const base = started(engine);
    const plain = drive(engine, base, "p1", { throttle: true }, 120);
    const boosted = drive(engine, base, "p1", { throttle: true, nitro: true }, 120);

    expect(boosted.vehicles.p1!.speed).toBeGreaterThan(plain.vehicles.p1!.speed);
    expect(boosted.vehicles.p1!.distance).toBeGreaterThan(plain.vehicles.p1!.distance);
  });

  it("drops back to the normal ceiling once the boost expires", () => {
    const base = started(engine);
    const boosted = drive(engine, base, "p1", { throttle: true, nitro: true }, 60 * 12);
    expect(boosted.vehicles.p1!.speed).toBeLessThanOrEqual(engine.vehicleTuning().maxSpeed + 0.001);
  });

  it("finishes the race and names a winner", () => {
    let state = engine.init(players(1), { randomSeed: "finish", trackLength: 800, laps: 1 });
    for (let i = 0; i < 60 * 5; i += 20) state = engine.applyAction(state, tickAction(20)).state;
    // Driven competently: a circuit has no straight to coast down, so holding
    // the throttle with no steering just parks the car in the first wall.
    state = raceToEnd(engine, state);

    expect(state.isFinished).toBe(true);
    expect(state.winnerId).toBe("p1");
    expect(state.vehicles.p1!.place).toBe(1);
    expect(state.vehicles.p1!.distance).toBeGreaterThanOrEqual(state.track.length);
  });

  it("counts laps and records a time for each", () => {
    let state = engine.init(players(1), { randomSeed: "laps", trackLength: 700, laps: 3 });
    for (let i = 0; i < 60 * 5; i += 20) state = engine.applyAction(state, tickAction(20)).state;
    state = raceToEnd(engine, state);

    const me = state.vehicles.p1!;
    expect(state.isFinished).toBe(true);
    expect(me.lapsDone).toBeGreaterThanOrEqual(3);
    expect(me.lapTicks.length).toBeGreaterThanOrEqual(3);
    expect(me.bestLapTicks).toBe(Math.min(...me.lapTicks));
    // Three laps is three times the distance of one.
    expect(me.distance).toBeGreaterThanOrEqual(state.track.length * 3);
  });

  it("does not end a three-lap race after one lap", () => {
    let state = engine.init(players(1), { randomSeed: "one-lap", trackLength: 700, laps: 3 });
    for (let i = 0; i < 60 * 5; i += 20) state = engine.applyAction(state, tickAction(20)).state;

    let completedOne = false;
    for (let elapsed = 0; elapsed < 60 * 200 && !completedOne; elapsed += 5) {
      for (const id of state.playerOrder) {
        state = engine.applyAction(state, inputAction(id, autoInput(state, id))).state;
      }
      state = engine.applyAction(state, tickAction(5)).state;
      completedOne = state.vehicles.p1!.lapsDone >= 1;
    }

    expect(completedOne).toBe(true);
    expect(state.isFinished).toBe(false);
    expect(state.vehicles.p1!.finishedAtTick).toBeNull();
  });

  it("resets the checkpoint progress each lap", () => {
    // The bar measures the lap being driven, not the whole race.
    let state = engine.init(players(1), { randomSeed: "cp", trackLength: 700, laps: 3 });
    for (let i = 0; i < 60 * 5; i += 20) state = engine.applyAction(state, tickAction(20)).state;

    let sawReset = false;
    let previous = 0;
    for (let elapsed = 0; elapsed < 60 * 200 && !sawReset; elapsed += 5) {
      for (const id of state.playerOrder) {
        state = engine.applyAction(state, inputAction(id, autoInput(state, id))).state;
      }
      state = engine.applyAction(state, tickAction(5)).state;
      const now = state.vehicles.p1!.checkpoint;
      if (previous > 0 && now < previous) sawReset = true;
      previous = now;
      expect(now).toBeLessThanOrEqual(state.track.checkpoints.length);
    }
    expect(sawReset).toBe(true);
  });

  it("stops the race at the time limit even if nobody finishes", () => {
    // One idle driver must not be able to hold a room open forever.
    let state = engine.init(players(1), {
      randomSeed: "timeout",
      trackLength: 50_000,
      timeLimitSeconds: 30,
    });
    for (let i = 0; i < 60 * 40 && !state.isFinished; i += 20) {
      state = engine.applyAction(state, tickAction(20)).state;
    }
    expect(state.isFinished).toBe(true);
    expect(state.vehicles.p1!.place).toBe(1);
  });

  it("gives every finisher a distinct place", () => {
    let state = engine.init(players(4), { randomSeed: "places", trackLength: 900 });
    for (let i = 0; i < 60 * 5; i += 20) state = engine.applyAction(state, tickAction(20)).state;
    state = raceToEnd(engine, state);

    expect(state.isFinished).toBe(true);
    const places = Object.values(state.vehicles).map((v) => v.place);
    expect(new Set(places).size).toBe(4);
    expect([...places].sort()).toEqual([1, 2, 3, 4]);
  });

  it("replays identically from the same seed and inputs", () => {
    const run = () => {
      let state = engine.init(players(2), { randomSeed: "replay", trackLength: 1200 });
      for (let i = 0; i < 60 * 4; i += 20) state = engine.applyAction(state, tickAction(20)).state;
      for (let step = 0; step < 60; step++) {
        state = engine.applyAction(
          state,
          inputAction("p1", { throttle: true, steer: Math.sin(step / 6) }),
        ).state;
        state = engine.applyAction(state, inputAction("p2", { throttle: true, steer: 0 })).state;
        state = engine.applyAction(state, tickAction(10)).state;
      }
      return state;
    };

    const a = run();
    const b = run();
    expect(a.vehicles.p1!.distance).toBe(b.vehicles.p1!.distance);
    expect(a.vehicles.p1!.lateral).toBe(b.vehicles.p1!.lateral);
    expect(a.vehicles.p2!.coins).toBe(b.vehicles.p2!.coins);
  });

  it("collects a coin only once, even with two cars on the same line", () => {
    let state = engine.init(players(2), { randomSeed: "coins-once", trackLength: 2000 });
    for (let i = 0; i < 60 * 5; i += 20) state = engine.applyAction(state, tickAction(20)).state;
    for (const id of ["p1", "p2"]) {
      state = engine.applyAction(state, inputAction(id, { throttle: true })).state;
    }
    for (let i = 0; i < 60 * 60 && !state.isFinished; i += 20) {
      state = engine.applyAction(state, tickAction(20)).state;
    }

    const taken = state.vehicles.p1!.coins + state.vehicles.p2!.coins;
    expect(taken).toBe(state.collectedCoins.length);
  });

  it("reports a view with standings and no hidden fields", () => {
    const state = started(engine, 3);
    const view = engine.getPlayerView(state, "p2");
    expect(view.me?.playerId).toBe("p2");
    expect(view.vehicles).toHaveLength(3);
    expect(view.standings).toHaveLength(3);
    // The view carries the seed, not the geometry: the client rebuilds the
    // identical road rather than being sent 17 KB of it on every snapshot.
    expect(view.trackSeed).toBe(state.track.seed);
    expect(view.trackLength).toBe(state.track.length);
    expect(buildTrack(view.trackSeed, view.trackLength)).toEqual(state.track);
  });
});

describe("bikes differ from cars", () => {
  const car = new CarRaceEngine();
  const bike = new BikeRaceEngine();

  it("accelerates harder but tops out lower", () => {
    expect(bike.vehicleTuning().acceleration).toBeGreaterThan(car.vehicleTuning().acceleration);
    expect(bike.vehicleTuning().maxSpeed).toBeLessThan(car.vehicleTuning().maxSpeed);
  });

  it("is narrower, so it fits gaps a car cannot", () => {
    expect(bike.vehicleTuning().halfWidth).toBeLessThan(car.vehicleTuning().halfWidth);
  });

  it("is punished harder for hitting something", () => {
    expect(bike.vehicleTuning().crashPenalty).toBeLessThan(car.vehicleTuning().crashPenalty);
    expect(bike.vehicleTuning().crashStunTicks).toBeGreaterThan(car.vehicleTuning().crashStunTicks);
  });

  it("beats a car away from the line", () => {
    const sprint = (engine: CarRaceEngine | BikeRaceEngine) => {
      let state = started(engine);
      state = drive(engine, state, "p1", { throttle: true }, TICK_RATE * 2);
      return state.vehicles.p1!.distance;
    };
    expect(sprint(bike)).toBeGreaterThan(sprint(car));
  });

  it("runs a full race without any value going out of range", () => {
    let state = bike.init(players(2), { randomSeed: "bike-race", trackLength: 1200 });
    for (let i = 0; i < 60 * 5; i += 20) state = bike.applyAction(state, tickAction(20)).state;

    for (let elapsed = 0; elapsed < 60 * 180 && !state.isFinished; elapsed += 5) {
      for (const id of state.playerOrder) {
        if (state.vehicles[id]!.finishedAtTick === null) {
          state = bike.applyAction(state, inputAction(id, autoInput(state, id))).state;
        }
      }
      state = bike.applyAction(state, tickAction(5)).state;

      for (const v of Object.values(state.vehicles)) {
        expect(Math.abs(v.lateral)).toBeLessThanOrEqual(1.25);
        expect(Number.isFinite(v.speed)).toBe(true);
        expect(v.speed).toBeGreaterThanOrEqual(0);
      }
    }
    expect(state.isFinished).toBe(true);
  });
});

describe("track to world space", () => {
  const track = buildTrack("world", 800);
  const line = trackCenterline(track, 10);
  const at = (distance: number, lateral: number) =>
    trackToWorld(line, distance, lateral, 8, 10)!;

  it("puts the centreline where the centreline is", () => {
    const point = at(0, 0);
    expect(point.x).toBeCloseTo(line[0]!.x, 5);
    expect(point.z).toBeCloseTo(line[0]!.z, 5);
  });

  it("maps a positive lateral offset to the driver's right, at any heading", () => {
    // Steering right must move the car to the right of the picture. Stated as a
    // cross product rather than "smaller x", because on a circuit the heading
    // at a given distance is arbitrary — the old form only held near heading 0
    // and would have passed while the game steered backwards.
    for (const distance of [0, 137, 421, 905, 1500]) {
      const centre = at(distance, 0);
      const right = at(distance, 1);

      const forward = { x: Math.sin(centre.heading), z: Math.cos(centre.heading) };
      const offset = { x: right.x - centre.x, z: right.z - centre.z };
      const cross = forward.x * offset.z - forward.z * offset.x;

      expect(cross, `wrong side at ${distance}m`).toBeGreaterThan(0);
    }
  });

  it("offsets by exactly the road half-width at the edge", () => {
    const centre = at(0, 0);
    const edge = at(0, 1);
    expect(Math.hypot(edge.x - centre.x, edge.z - centre.z)).toBeCloseTo(8, 5);
  });

  it("interpolates between samples instead of snapping to them", () => {
    // Without interpolation a vehicle jumps every ten metres.
    const a = at(100, 0);
    const mid = at(105, 0);
    const b = at(110, 0);
    expect(mid.z).toBeGreaterThan(Math.min(a.z, b.z));
    expect(mid.z).toBeLessThan(Math.max(a.z, b.z));
  });

  it("wraps around the loop rather than clamping", () => {
    // Grid positions are negative and racing distances run past a lap, so both
    // ends have to come back onto the circuit.
    const start = at(0, 0);
    const wrapped = at(track.length, 0);
    expect(wrapped.x).toBeCloseTo(start.x, 3);
    expect(wrapped.z).toBeCloseTo(start.z, 3);
    expect(Number.isFinite(at(-50, 0).x)).toBe(true);
    expect(Number.isFinite(at(track.length * 3 + 120, 0).x)).toBe(true);
  });

  it("returns null for an empty centreline", () => {
    expect(trackToWorld([], 0, 0, 8, 10)).toBeNull();
  });
});

describe("circuits are driveable", () => {
  it("never exceeds the curvature a vehicle can hold", () => {
    /*
     * Asserted against MAX_CURVATURE, not a hardcoded number.
     *
     * The old 0.03 encoded "the tightest bend holdable at top speed", which was
     * the right bound when nothing on a track required braking. Corners now
     * exist that you must slow for, so the limit is what can be driven at all,
     * and the constant is the single source of it.
     */
    for (const seed of ["d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8"]) {
      for (const length of [900, 1600, 3000]) {
        const track = buildTrack(seed, length);
        const worst = track.segments.reduce((m, s) => Math.max(m, Math.abs(s.curvature)), 0);
        expect(worst, `seed ${seed} at ${length}m has a corner of ${worst}`).toBeLessThanOrEqual(MAX_CURVATURE);
      }
    }
  });

  it("turns exactly once around", () => {
    // The defining property of a closed loop, and the thing that makes a lap
    // mean something.
    for (const seed of ["w1", "w2", "w3", "w4"]) {
      const track = buildTrack(seed, 2500);
      const total = track.segments.reduce((sum, s) => sum + s.curvature * s.length, 0);
      expect(Math.abs(total)).toBeCloseTo(Math.PI * 2, 1);
    }
  });

  it("still produces corners worth driving", () => {
    // A perfect circle would pass every other test here and be no fun at all,
    // so the curvature has to actually vary around the lap.
    const track = buildTrack("variety", 1400);
    const curvatures = track.segments.map((s) => Math.abs(s.curvature));
    const max = Math.max(...curvatures);
    const min = Math.min(...curvatures);
    expect(max).toBeGreaterThan(min * 3);
  });
});

describe("the racing career ladder", () => {
  const ladders = [CAR_LEVELS, BIKE_LEVELS];

  it("gets harder on every axis, never easier", () => {
    for (const levels of ladders) {
      for (let i = 1; i < levels.length; i++) {
        const previous = levels[i - 1]!;
        const level = levels[i]!;
        // Total race distance is what actually grows: lap length and lap count
        // both climb, and one long lap is a gentler circuit than three short ones.
        expect(level.trackLength * level.laps).toBeGreaterThan(
          previous.trackLength * previous.laps,
        );
        expect(level.laps).toBeGreaterThanOrEqual(previous.laps);
        expect(level.opponents).toBeGreaterThanOrEqual(previous.opponents);
        expect(level.aiLevel).toBeGreaterThanOrEqual(previous.aiLevel);
        expect(level.nitroCharges).toBeLessThanOrEqual(previous.nitroCharges);
      }
    }
  });

  it("numbers levels from one, in order, with copy on every card", () => {
    for (const levels of ladders) {
      levels.forEach((level, i) => {
        expect(level.index).toBe(i + 1);
        expect(level.name.length).toBeGreaterThan(0);
        expect(level.blurb.length).toBeGreaterThan(0);
        expect(level.targetPlace).toBeGreaterThanOrEqual(1);
        // A target nobody could meet would be a level that cannot be passed.
        expect(level.targetPlace).toBeLessThanOrEqual(level.opponents + 1);
      });
    }
  });

  it("picks the ladder for the game", () => {
    expect(levelsFor("car-race")).toBe(CAR_LEVELS);
    expect(levelsFor("bike-race")).toBe(BIKE_LEVELS);
  });

  it("awards stars by finishing position", () => {
    const level = CAR_LEVELS[2]!; // target is 2nd
    expect(starsFor(level, 1)).toBe(3);
    expect(starsFor(level, 2)).toBe(2);
    expect(starsFor(level, 3)).toBe(0);
    expect(isPass(level, 2)).toBe(true);
    expect(isPass(level, 3)).toBe(false);
    // Never finishing is not a pass.
    expect(isPass(level, 0)).toBe(false);
  });

  it("gives one star for meeting a loose target without a podium", () => {
    const loose = { ...CAR_LEVELS[0]!, targetPlace: 4 };
    expect(starsFor(loose, 4)).toBe(1);
    expect(isPass(loose, 4)).toBe(true);
    expect(starsFor(loose, 5)).toBe(0);
  });
});

describe("level unlocking", () => {
  it("opens only the first level to a new player", () => {
    const unlocked = unlockedLevels(CAR_LEVELS, {});
    expect(unlocked[0]).toBe(true);
    expect(unlocked.slice(1).every((u) => u === false)).toBe(true);
  });

  it("opens the next level once the previous is passed", () => {
    const unlocked = unlockedLevels(CAR_LEVELS, { 1: 1 });
    expect(unlocked[1]).toBe(true);
    expect(unlocked[2]).toBe(false);
  });

  it("does not open the next level for a finish short of the target", () => {
    // Level 1 needs a win; finishing second is not a pass.
    expect(unlockedLevels(CAR_LEVELS, { 1: 2 })[1]).toBe(false);
  });

  it("does not let a later result unlock past a gap", () => {
    // Progress recorded for level 5 must not open level 4 -- there is no path
    // that produces this, but a bug in the storage layer could write it.
    const unlocked = unlockedLevels(CAR_LEVELS, { 1: 1, 5: 1 });
    expect(unlocked[1]).toBe(true);
    expect(unlocked[2]).toBe(false);
    expect(unlocked[5]).toBe(true);
    expect(unlocked[3]).toBe(false);
  });

  it("opens the whole ladder once every level is won", () => {
    const best = Object.fromEntries(CAR_LEVELS.map((l) => [l.index, 1]));
    expect(unlockedLevels(CAR_LEVELS, best).every(Boolean)).toBe(true);
  });
});

describe("the garage", () => {
  const rosters: Array<[GameId, VehicleSpec[]]> = [
    ["car-race", CARS],
    ["bike-race", BIKES],
  ];

  it("gives every vehicle a unique id, a name and copy", () => {
    for (const [, roster] of rosters) {
      const ids = roster.map((v) => v.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const vehicle of roster) {
        expect(vehicle.name.length).toBeGreaterThan(0);
        expect(vehicle.blurb.length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back to the class default for an unknown id", () => {
    expect(vehicleById("car-race", "nonsense").id).toBe(CARS[0]!.id);
    expect(vehicleById("bike-race", null).id).toBe(BIKES[0]!.id);
    expect(vehicleById("car-race", undefined).kind).toBe("car");
  });

  it("derives the stat bars from the physics, not from a separate list", () => {
    // The whole reason stats are computed: a car showing more speed must
    // actually have a higher top speed, or the garage is lying to the player.
    const fast = vehicleById("car-race", "car-speed");
    const balanced = vehicleById("car-race", "car-balanced");

    expect(vehicleStats(fast).speed).toBeGreaterThan(vehicleStats(balanced).speed);
    expect(fast.modifiers.maxSpeed).toBeGreaterThan(balanced.modifiers.maxSpeed);

    const grippy = vehicleById("car-race", "car-grip");
    expect(vehicleStats(grippy).handling).toBeGreaterThan(vehicleStats(balanced).handling);
  });

  it("keeps every bar on the scale", () => {
    for (const [, roster] of rosters) {
      for (const vehicle of roster) {
        const stats = vehicleStats(vehicle);
        for (const [name, value] of Object.entries(stats)) {
          expect(value, `${vehicle.id} ${name} is ${value}`).toBeGreaterThanOrEqual(1);
          expect(value, `${vehicle.id} ${name} is ${value}`).toBeLessThanOrEqual(10);
        }
      }
    }
  });

  it("uses the whole scale, so the bars are worth comparing", () => {
    // A roster whose bars all sit at the same value tells the player nothing.
    for (const [, roster] of rosters) {
      const speeds = roster.map((v) => vehicleStats(v).speed);
      expect(Math.max(...speeds) - Math.min(...speeds)).toBeGreaterThan(2);
    }
  });

  it("applies the modifiers to the tuning the physics actually uses", () => {
    const engine = new CarRaceEngine();
    const balanced = engine.vehicleTuningFor("car-balanced");
    const fast = engine.vehicleTuningFor("car-speed");
    const grippy = engine.vehicleTuningFor("car-grip");

    expect(fast.maxSpeed).toBeGreaterThan(balanced.maxSpeed);
    expect(fast.steerRate).toBeLessThan(balanced.steerRate);
    // Lower centrifugal means a corner throws it less.
    expect(grippy.centrifugal).toBeLessThan(balanced.centrifugal);
  });

  it("makes the straight-line car genuinely quicker in a straight line", () => {
    const engine = new CarRaceEngine();

    const topSpeed = (vehicleId: string) => {
      let state = engine.init(players(1), {
        randomSeed: "garage",
        trackLength: 3000,
        laps: 1,
        vehicles: { p1: vehicleId },
      });
      for (let i = 0; i < 60 * 5; i += 20) state = engine.applyAction(state, tickAction(20)).state;

      let fastest = 0;
      for (let elapsed = 0; elapsed < 60 * 90 && !state.isFinished; elapsed += 5) {
        state = engine.applyAction(state, inputAction("p1", autoInput(state, "p1"))).state;
        state = engine.applyAction(state, tickAction(5)).state;
        fastest = Math.max(fastest, state.vehicles.p1!.speed);
      }
      return fastest;
    };

    expect(topSpeed("car-speed")).toBeGreaterThan(topSpeed("car-balanced"));
  });

  it("makes that speed cost real cornering", () => {
    // Stated as physics rather than as a lap time. Only about a tenth of a
    // circuit is tight enough to matter, so straight-line speed dominates the
    // clock and a lap-time comparison measures the straights, not the trade.
    const engine = new CarRaceEngine();
    const grippy = engine.vehicleTuningFor("car-grip");
    const fast = engine.vehicleTuningFor("car-speed");

    // The tightest corner a circuit actually produces.
    const curvature = 0.024;

    const holdable = (t: ReturnType<typeof engine.vehicleTuningFor>) => {
      const push = curvature * t.maxSpeed * t.centrifugal;
      return { push, lock: t.steerRate, canHold: push < t.steerRate };
    };

    // The car built for straights cannot take the tightest corner flat out.
    expect(holdable(fast).canHold).toBe(false);
    // The car built for corners can.
    expect(holdable(grippy).canHold).toBe(true);
  });

  it("asks a stock car to lift for the tightest corners but not the ordinary ones", () => {
    // The difficulty curve, stated as physics. If full lock beat every corner,
    // nothing would ever demand a lift and braking would never pay; if it beat
    // none of them the game would be undriveable.
    const engine = new CarRaceEngine();
    const stock = engine.vehicleTuningFor("car-balanced");
    const push = (curvature: number) => curvature * stock.maxSpeed * stock.centrifugal;

    // A typical fast corner — roughly the tightest tenth of a circuit — is
    // holdable flat out by a competent driver.
    expect(push(0.017)).toBeLessThan(stock.steerRate);

    // The tightest a circuit can produce is not. That corner is a braking
    // point, which is what makes the rest of the lap worth setting up for.
    expect(push(0.028)).toBeGreaterThan(stock.steerRate);
  });

  it("seats each player in the vehicle they chose", () => {
    const engine = new CarRaceEngine();
    const state = engine.init(players(2), {
      randomSeed: "seats",
      vehicles: { p1: "car-grip", p2: "car-speed" },
    });
    expect(state.vehicles.p1!.vehicleId).toBe("car-grip");
    expect(state.vehicles.p2!.vehicleId).toBe("car-speed");
  });
});

describe("surface zones", () => {
  /**
   * Puts one zone under the vehicle and nothing else, so a measurement is
   * attributable. Generated tracks scatter zones by seed, which is right for
   * play and useless for a test: you cannot tell whether a car slowed down
   * because of the slick you meant to test or the mud thirty metres later.
   */
  function withOnlyZone(
    state: RacingGameState,
    kind: "boost" | "slow" | "grip" | "slick" | "nitro",
  ): RacingGameState {
    const vehicle = state.vehicles.p1!;
    return {
      ...state,
      track: {
        ...state.track,
        obstacles: [],
        zones: [
          {
            kind,
            distance: vehicle.distance - 5,
            lateral: vehicle.lateral,
            halfWidth: 1,
            length: 400,
          },
        ],
      },
    };
  }

  const speedAfter = (state: RacingGameState) => state.vehicles.p1!.speed;

  it("places zones on a generated track without overlapping obstacles", () => {
    const track = buildTrack("zone-seed", 2000);
    expect(track.zones.length).toBeGreaterThan(0);

    for (const zone of track.zones) {
      const clash = track.obstacles.some(
        (o) =>
          Math.abs(o.distance - zone.distance) < zone.length &&
          Math.abs(o.lateral - zone.lateral) < o.halfWidth + 0.3,
      );
      // A hazard inside an obstacle reads as the obstacle having caused it.
      expect(clash).toBe(false);
    }
  });

  it("is deterministic for a seed", () => {
    expect(buildTrack("same", 2000).zones).toEqual(buildTrack("same", 2000).zones);
  });

  it("reports the zone the vehicle is standing in", () => {
    const engine = new CarRaceEngine();
    const state = withOnlyZone(started(engine), "slick");
    const next = drive(engine, state, "p1", { throttle: true }, 30);
    expect(next.vehicles.p1!.zone).toBe("slick");
  });

  it("reports null on clean tarmac", () => {
    const engine = new CarRaceEngine();
    const base = started(engine);
    const clean = { ...base, track: { ...base.track, zones: [], obstacles: [] } };
    const next = drive(engine, clean, "p1", { throttle: true }, 30);
    expect(next.vehicles.p1!.zone).toBeNull();
  });

  it("a slow zone costs speed against clean tarmac", () => {
    const engine = new CarRaceEngine();
    const base = started(engine);
    const clean = drive(
      engine,
      { ...base, track: { ...base.track, zones: [], obstacles: [] } },
      "p1",
      { throttle: true },
      120,
    );
    const slowed = drive(engine, withOnlyZone(base, "slow"), "p1", { throttle: true }, 120);
    expect(speedAfter(slowed)).toBeLessThan(speedAfter(clean));
  });

  it("a boost zone adds speed but never past the vehicle's ceiling", () => {
    const engine = new CarRaceEngine();
    const base = started(engine);
    const clean = drive(
      engine,
      { ...base, track: { ...base.track, zones: [], obstacles: [] } },
      "p1",
      { throttle: true },
      120,
    );
    const boosted = drive(engine, withOnlyZone(base, "boost"), "p1", { throttle: true }, 120);

    expect(speedAfter(boosted)).toBeGreaterThan(speedAfter(clean));

    // Held for a long time it must still respect the top speed, or a boost
    // strip becomes an unbounded speed exploit.
    const long = drive(engine, withOnlyZone(base, "boost"), "p1", { throttle: true }, 60 * 30);
    const spec = vehicleById(long.vehicles.p1!.vehicleId)!;
    expect(speedAfter(long)).toBeLessThanOrEqual(spec.modifiers.maxSpeed * 60 + 1);
  });

  it("a slick zone turns in less sharply than clean tarmac", () => {
    const engine = new CarRaceEngine();
    const base = started(engine);
    const straight = { ...base, track: { ...base.track, zones: [], obstacles: [] } };

    const clean = drive(engine, straight, "p1", { throttle: true, steer: 1 }, 60);
    const slick = drive(engine, withOnlyZone(base, "slick"), "p1", { throttle: true, steer: 1 }, 60);

    // Less grip means the same steering input moves the car across less.
    const cleanMove = Math.abs(clean.vehicles.p1!.lateral - base.vehicles.p1!.lateral);
    const slickMove = Math.abs(slick.vehicles.p1!.lateral - base.vehicles.p1!.lateral);
    expect(slickMove).toBeLessThan(cleanMove);
  });

  it("a grip zone turns in more sharply than clean tarmac", () => {
    const engine = new CarRaceEngine();
    const base = started(engine);
    const straight = { ...base, track: { ...base.track, zones: [], obstacles: [] } };

    const clean = drive(engine, straight, "p1", { throttle: true, steer: 1 }, 60);
    const gripped = drive(engine, withOnlyZone(base, "grip"), "p1", { throttle: true, steer: 1 }, 60);

    const cleanMove = Math.abs(clean.vehicles.p1!.lateral - base.vehicles.p1!.lateral);
    const grippedMove = Math.abs(gripped.vehicles.p1!.lateral - base.vehicles.p1!.lateral);
    expect(grippedMove).toBeGreaterThan(cleanMove);
  });

  it("a nitro zone grants at most one charge, however long you sit on it", () => {
    const engine = new CarRaceEngine();
    const base = started(engine);
    const spent = drive(engine, withOnlyZone(base, "nitro"), "p1", { nitro: true }, 5);
    const before = spent.vehicles.p1!.nitroCharges;

    // Parking on the strip for ten seconds must not refill repeatedly.
    const parked = drive(engine, spent, "p1", { throttle: false }, 60 * 10);
    expect(parked.vehicles.p1!.nitroCharges).toBeLessThanOrEqual(before + 1);
  });

  it("a nitro zone never exceeds the vehicle's charge capacity", () => {
    const engine = new CarRaceEngine();
    const base = started(engine);
    const capacity = base.vehicles.p1!.nitroCharges;
    const parked = drive(engine, withOnlyZone(base, "nitro"), "p1", { throttle: true }, 60 * 20);
    expect(parked.vehicles.p1!.nitroCharges).toBeLessThanOrEqual(capacity);
  });

  it("a client cannot claim to be in a zone", () => {
    // The only way into a zone is to be standing in one. SET_INPUT carries no
    // zone field, and the resolver recomputes it from position every tick.
    const engine = new CarRaceEngine();
    const base = started(engine);
    const clean = { ...base, track: { ...base.track, zones: [], obstacles: [] } };
    const forged = engine.applyAction(
      clean,
      inputAction("p1", { throttle: true, zone: "boost" } as never),
    ).state;
    const next = drive(engine, forged, "p1", { throttle: true }, 30);
    expect(next.vehicles.p1!.zone).toBeNull();
  });
});

describe("power-up pickups", () => {
  /** One pickup directly ahead, nothing else on the track. */
  function withOnlyPickup(
    state: RacingGameState,
    kind: "nitro" | "perfectNitro" | "shield" | "magnet" | "repair" | null,
    aheadBy = 40,
  ): RacingGameState {
    const vehicle = state.vehicles.p1!;
    return {
      ...state,
      track: {
        ...state.track,
        obstacles: [],
        zones: [],
        coins: [],
        pickups: [{ distance: vehicle.distance + aheadBy, lateral: vehicle.lateral, kind }],
      },
    };
  }

  it("places pickups on a generated track, clear of obstacles", () => {
    const track = buildTrack("pickup-seed", 2000);
    expect(track.pickups.length).toBeGreaterThan(0);
    for (const p of track.pickups) {
      const clash = track.obstacles.some(
        (o) => Math.abs(o.distance - p.distance) < 12 && Math.abs(o.lateral - p.lateral) < o.halfWidth + 0.3,
      );
      expect(clash).toBe(false);
    }
  });

  it("keeps roughly a third of boxes a mystery", () => {
    // Fixed contents would be readable from the seed, which every client has.
    let mystery = 0;
    let total = 0;
    for (const seed of ["a", "b", "c", "d", "e", "f"]) {
      for (const p of buildTrack(seed, 2000).pickups) {
        total += 1;
        if (p.kind === null) mystery += 1;
      }
    }
    expect(total).toBeGreaterThan(10);
    expect(mystery / total).toBeGreaterThan(0.1);
    expect(mystery / total).toBeLessThan(0.6);
  });

  it("a nitro pickup grants a charge, capped at capacity", () => {
    const engine = new CarRaceEngine();
    const base = started(engine);
    const capacity = base.vehicles.p1!.nitroCharges;

    // Spend one so there is room, then collect.
    const spent = drive(engine, withOnlyPickup(base, "nitro"), "p1", { nitro: true }, 5);
    const after = drive(engine, spent, "p1", { throttle: true }, 240);
    expect(after.vehicles.p1!.nitroCharges).toBeLessThanOrEqual(capacity);
    expect(after.vehicles.p1!.nitroCharges).toBeGreaterThan(spent.vehicles.p1!.nitroCharges);
  });

  it("a shield absorbs one hit, leaving speed and control intact", () => {
    const engine = new CarRaceEngine();
    const base = started(engine);
    const vehicle = base.vehicles.p1!;

    // A shield, then a barrier immediately after it.
    const withBoth: RacingGameState = {
      ...base,
      track: {
        ...base.track,
        zones: [],
        coins: [],
        pickups: [{ distance: vehicle.distance + 30, lateral: vehicle.lateral, kind: "shield" }],
        obstacles: [
          {
            distance: vehicle.distance + 120,
            lateral: vehicle.lateral,
            kind: "barrier",
            halfWidth: 0.5,
          },
        ],
      },
    };

    /*
     * Driven only as far as the barrier, and checked the moment it is passed.
     * Running on for hundreds of ticks with no steering eventually puts the car
     * into the outside wall, and a wall crash would be indistinguishable here
     * from the barrier crash the shield is supposed to have prevented.
     */
    let after = withBoth;
    const barrierAt = vehicle.distance + 120;
    for (let i = 0; i < 60 && after.vehicles.p1!.distance <= barrierAt; i++) {
      after = drive(engine, after, "p1", { throttle: true }, 5);
    }

    // The shield is spent and the crash never happened.
    expect(after.vehicles.p1!.distance).toBeGreaterThan(barrierAt);
    expect(after.vehicles.p1!.shielded).toBe(false);
    expect(after.vehicles.p1!.crashTicks).toBe(0);
  });

  it("without a shield the same barrier does stun the driver", () => {
    // Guards the test above: if the barrier were never reached, the shield
    // test would pass for the wrong reason.
    const engine = new CarRaceEngine();
    const base = started(engine);
    const vehicle = base.vehicles.p1!;

    const unshielded: RacingGameState = {
      ...base,
      track: {
        ...base.track,
        zones: [],
        coins: [],
        pickups: [],
        obstacles: [
          {
            distance: vehicle.distance + 120,
            lateral: vehicle.lateral,
            kind: "barrier",
            halfWidth: 0.5,
          },
        ],
      },
    };

    let hit = false;
    let next = unshielded;
    for (let i = 0; i < 40 && !hit; i++) {
      next = drive(engine, next, "p1", { throttle: true }, 10);
      if (next.vehicles.p1!.crashTicks > 0) hit = true;
    }
    expect(hit).toBe(true);
  });

  it("a magnet collects coins the car does not drive over", () => {
    const engine = new CarRaceEngine();
    const base = started(engine);
    const vehicle = base.vehicles.p1!;

    // A coin far across the road — unreachable without a magnet.
    const offside = vehicle.lateral + 0.7;
    const track = {
      ...base.track,
      obstacles: [],
      zones: [],
      coins: [{ distance: vehicle.distance + 120, lateral: offside }],
    };

    const withMagnet = drive(
      engine,
      { ...base, track: { ...track, pickups: [{ distance: vehicle.distance + 30, lateral: vehicle.lateral, kind: "magnet" as const }] } },
      "p1",
      { throttle: true },
      300,
    );
    const without = drive(
      engine,
      { ...base, track: { ...track, pickups: [] } },
      "p1",
      { throttle: true },
      300,
    );

    expect(withMagnet.vehicles.p1!.coins).toBeGreaterThan(without.vehicles.p1!.coins);
  });

  it("a mystery box is decided at pickup time, not from the seed", () => {
    // Same track, same box, opened on different ticks: the contents must not
    // be a fixed function of the seed alone.
    const engine = new CarRaceEngine();
    const results = new Set<string>();

    for (const delay of [0, 7, 23, 51, 96]) {
      const base = drive(engine, started(engine), "p1", { throttle: false }, delay);
      const withBox = withOnlyPickup(base, null, 30);
      const after = drive(engine, withBox, "p1", { throttle: true }, 300);
      const v = after.vehicles.p1!;
      results.add(`${v.shielded}|${v.magnetUntilTick > 0}|${v.nitroCharges}`);
    }

    // Not a strict requirement that all five differ, but a single outcome
    // across five openings would mean the roll is not varying at all.
    expect(results.size).toBeGreaterThan(1);
  });

  it("a client cannot grant itself a shield or a magnet", () => {
    const engine = new CarRaceEngine();
    const base = started(engine);
    const clean: RacingGameState = {
      ...base,
      track: { ...base.track, pickups: [], obstacles: [], zones: [], coins: [] },
    };

    const forged = engine.applyAction(
      clean,
      inputAction("p1", { throttle: true, shielded: true, magnetUntilTick: 99999 } as never),
    ).state;
    const after = drive(engine, forged, "p1", { throttle: true }, 60);

    expect(after.vehicles.p1!.shielded).toBe(false);
    expect(after.vehicles.p1!.magnetUntilTick).toBe(0);
  });
});

describe("race boundaries and finishing", () => {
  it("keeps the car inside the painted edge, not on top of it", () => {
    // The barrier used to sit at 1.25 — a quarter of the road's half-width
    // outside the line, which is two metres of drivable space the player can
    // see they should not be on.
    const engine = new CarRaceEngine();
    const base = started(engine);
    const clean: RacingGameState = {
      ...base,
      track: { ...base.track, obstacles: [], zones: [], coins: [], pickups: [] },
    };

    // Hold full lock for long enough to reach the wall on either side.
    for (const steer of [1, -1]) {
      const pinned = drive(engine, clean, "p1", { throttle: true, steer }, 400);
      const lateral = Math.abs(pinned.vehicles.p1!.lateral);
      // Out past the line, but stopped by the barrier well before the scenery.
      expect(lateral).toBeLessThan(1.35);
    }
  });

  it("ends the race once the podium is settled", () => {
    // Watching the last car trundle home decides nothing.
    const engine = new CarRaceEngine();
    let state = started(engine, 6);

    const trackLength = state.track.length;
    const vehicles = { ...state.vehicles };
    // Three cars placed on the line, three left well behind.
    const ids = state.playerOrder;
    for (let i = 0; i < 3; i++) {
      vehicles[ids[i]!] = { ...vehicles[ids[i]!]!, distance: trackLength * 3 - 5 };
    }
    state = { ...state, vehicles };

    const finished = raceToEnd(engine, state, 60 * 60);
    expect(finished.isFinished).toBe(true);

    const home = Object.values(finished.vehicles).filter((v) => v.finishedAtTick !== null);
    // The three that crossed decided it; the rest are placed by distance.
    expect(home.length).toBeGreaterThanOrEqual(3);
    expect(home.length).toBeLessThan(6);
  });

  it("still requires everyone in a field smaller than the podium", () => {
    // A two-player race must not end the moment nobody can reach third.
    const engine = new CarRaceEngine();
    const state = started(engine, 2);
    expect(state.isFinished).toBe(false);
    const oneTick = engine.applyAction(state, tickAction(1)).state;
    expect(oneTick.isFinished).toBe(false);
  });
});

describe("racing line: corner speed and braking", () => {
  const HANDLING = { steerRate: 1.5, centrifugal: 0.9 };  // the car's real tuning
  const BRAKE = 20;     // m/s^2 of deceleration
  const MAX = 78;

  it("a straight has no corner limit", () => {
    expect(cornerSpeedFor(0, HANDLING, MAX)).toBe(MAX);
  });

  it("a tighter corner has a lower limit", () => {
    // Curvature is radians per metre, so 1/k is the radius. Both of these have
    // to be genuinely tight: at this car's steering authority anything above
    // roughly a 90m radius is taken flat, which is exactly why measuring the
    // real limit mattered.
    const wide = cornerSpeedFor(1 / 25, HANDLING, MAX);
    const tight = cornerSpeedFor(1 / 12, HANDLING, MAX);
    expect(tight).toBeLessThan(wide);
    expect(wide).toBeLessThan(MAX);
  });

  it("matches the engine's own lateral equation", () => {
    // v = steerRate * downforce / (k * centrifugal). At a 15m radius the car
    // is well clear of the top-speed clamp, so the relation is exact.
    const v = cornerSpeedFor(1 / 15, HANDLING, MAX);
    const ratio = v / MAX;
    const downforce = 1 + Math.min(0.55, ratio * ratio * 0.55);
    expect(v).toBeCloseTo((HANDLING.steerRate * downforce) / ((1 / 15) * HANDLING.centrifugal), 2);
  });

  it("lets these tracks be taken flat — which is the point of measuring", () => {
    // Anything above roughly a 30m radius is flat for this car; the tightest
    // corner a generated track produces is about 123m.
    // and the engine holds that at full speed. A model that said otherwise
    // made the bots brake for nothing and cost them a quarter of their lap.
    expect(cornerSpeedFor(1 / 123, HANDLING, MAX)).toBe(MAX);
  });

  it("never exceeds the vehicle's own top speed", () => {
    // A gentle sweeper could in theory be taken at 200 m/s; the car cannot.
    expect(cornerSpeedFor(1 / 100000, HANDLING, MAX)).toBe(MAX);
  });

  it("needs no braking distance when already slow enough", () => {
    expect(brakingDistance(30, 40, BRAKE)).toBe(0);
    expect(brakingDistance(40, 40, BRAKE)).toBe(0);
  });

  it("computes braking distance from the kinematics", () => {
    // (78^2 - 43^2) / (2 * 20) = 105.9m
    expect(brakingDistance(78, 43, BRAKE)).toBeCloseTo((78 * 78 - 43 * 43) / 40, 3);
  });

  it("needs more room from a higher speed", () => {
    expect(brakingDistance(78, 40, BRAKE)).toBeGreaterThan(brakingDistance(60, 40, BRAKE));
  });

  const plan = (distance: number, speed: number, lookahead = 160) =>
    planCorner({
      track: buildTrack("plan-seed", 2000),
      distance,
      speed,
      maxSpeed: MAX,
      handling: HANDLING,
      brakingPower: BRAKE,
      lookahead,
    });

  it("holds full throttle when nothing needs slowing for", () => {
    // Crawling: no corner within sight requires braking from this speed.
    const slow = plan(0, 8);
    expect(slow.brake).toBe(0);
    expect(slow.throttle).toBe(1);
  });

  it("brakes before the corner, not at it", () => {
    /*
     * Against a hairpin, because a generated track has none.
     *
     * The whole point of the change is that braking starts at a distance
     * computed from how much speed has to come off, rather than when the car
     * is already too fast at the corner. Proving that needs a corner the car
     * actually has to slow for — the tracks this game generates bottom out at
     * about a 123m radius, which this car takes flat.
     */
    const track = buildTrack("plan-seed", 2000);
    const hairpinAt = 300;
    const withHairpin: typeof track = {
      ...track,
      segments: track.segments.map((seg, i) => {
        const at = i * (track.length / track.segments.length);
        return Math.abs(at - hairpinAt) < 20 ? { ...seg, curvature: 1 / 18 } : seg;
      }),
    };

    const farOut = planCorner({
      track: withHairpin, distance: hairpinAt - 150, speed: MAX, maxSpeed: MAX,
      handling: HANDLING, brakingPower: BRAKE, lookahead: 220,
    });

    expect(farOut.brake).toBeGreaterThan(0);
    // Still well short of the corner when the brakes come on.
    expect(farOut.distanceToCorner).toBeGreaterThan(20);
    expect(farOut.targetSpeed).toBeLessThan(MAX);
  });

  it("brakes harder the later it is", () => {
    const track = buildTrack("plan-seed", 2000);
    void track;
    // Find a spot that is braking, then compare the same spot at a higher speed.
    for (let d = 0; d < track.length; d += 10) {
      const at70 = planCorner({ track, distance: d, speed: 70, maxSpeed: MAX, handling: HANDLING, brakingPower: BRAKE, lookahead: 200 });
      if (at70.brake <= 0 || at70.brake >= 1) continue;
      const at78 = planCorner({ track, distance: d, speed: 78, maxSpeed: MAX, handling: HANDLING, brakingPower: BRAKE, lookahead: 200 });
      expect(at78.brake).toBeGreaterThanOrEqual(at70.brake);
      return;
    }
  });

  it("never brakes and throttles at the same time", () => {
    const track = buildTrack("plan-seed", 2000);
    for (let d = 0; d < track.length; d += 7) {
      for (const speed of [10, 40, 78]) {
        const p = planCorner({ track, distance: d, speed, maxSpeed: MAX, handling: HANDLING, brakingPower: BRAKE, lookahead: 200 });
        expect(p.brake > 0 && p.throttle > 0, `d=${d} v=${speed}`).toBe(false);
      }
    }
  });

  it("a cautious margin brakes no later than an aggressive one", () => {
    const track = buildTrack("plan-seed", 2000);
    for (let d = 0; d < track.length; d += 10) {
      const base = { track, distance: d, speed: 70, maxSpeed: MAX, handling: HANDLING, brakingPower: BRAKE, lookahead: 200 };
      const cautious = planCorner({ ...base, margin: 0.6 });
      const late = planCorner({ ...base, margin: 0.05 });
      // Cautious can only ever be braking at least as much.
      expect(cautious.brake).toBeGreaterThanOrEqual(late.brake);
    }
  });
});

describe("circuits have corners worth braking for", () => {
  /*
   * The point of the generator change. Before it, the tightest bend any track
   * produced was a 103m radius and this car holds anything above about 28m
   * flat out — so no corner on any track required braking, which is why the
   * AI never lifted and why racing felt flat.
   */
  const HANDLING = { steerRate: 1.5, centrifugal: 0.9 };
  const SEEDS = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"];

  it("closes the lap exactly, at any corner severity", () => {
    // The reason this generator was kept over a planned-corner one: a closed
    // radial curve is closed at every amplitude, so tightening the corners
    // cannot open a seam.
    for (const seed of SEEDS) {
      const track = buildTrack(seed, 2000);
      const first = track.points[0]!;
      const last = track.points[track.points.length - 1]!;
      const spacing = Math.hypot(last.x - first.x, last.z - first.z);
      // One point-step apart, which is what a closed loop looks like.
      expect(Math.abs(spacing - 10), `seed ${seed} joins with a ${spacing}m step`).toBeLessThan(1);
    }
  });

  it("produces corners that cannot be taken flat", () => {
    let seedsNeedingBrakes = 0;

    for (const seed of SEEDS) {
      const track = buildTrack(seed, 2000);
      let tightest = Infinity;
      for (let d = 0; d < track.length; d += 10) {
        const k = Math.abs(sampleTrack(track, d).curvature);
        if (k > 1e-6) tightest = Math.min(tightest, 1 / k);
      }
      if (cornerSpeedFor(1 / tightest, HANDLING, 78) < 78) seedsNeedingBrakes += 1;
    }

    // Not every circuit has to be technical — a fast one is a valid circuit —
    // but most must, or the braking model has nothing to act on.
    expect(seedsNeedingBrakes).toBeGreaterThanOrEqual(SEEDS.length - 2);
  });

  it("keeps every corner inside the drivable limit", () => {
    for (const seed of SEEDS) {
      for (const length of [900, 2000, 3000]) {
        const track = buildTrack(seed, length);
        const worst = track.segments.reduce((m, s) => Math.max(m, Math.abs(s.curvature)), 0);
        expect(worst, `seed ${seed} at ${length}m`).toBeLessThanOrEqual(MAX_CURVATURE);
      }
    }
  });

  it("is still deterministic for a seed", () => {
    expect(buildTrack("same", 2000).points).toEqual(buildTrack("same", 2000).points);
  });
});

describe("off-track is staged, not instant", () => {
  const engine = new CarRaceEngine();

  /**
   * One tick off the road, at a given amount of time already spent out there.
   *
   * Seeding `offTrackTicks` directly rather than driving the car into the
   * run-off and hoping it stays: the band between the line and the barrier is
   * narrow, a corner pushes the car back onto the road within half a second,
   * and scraping the wall applies a much larger penalty that would drown out
   * the thing being measured.
   */
  function speedAfterOneTickOffTrack(alreadyOffFor: number): number {
    const base = started(engine);
    const state: RacingGameState = {
      ...base,
      track: { ...base.track, obstacles: [], zones: [], boostPads: [], pickups: [] },
      vehicles: {
        ...base.vehicles,
        p1: { ...base.vehicles.p1!, lateral: 1.1, speed: 60, offTrackTicks: alreadyOffFor },
      },
    };
    return drive(engine, state, "p1", { throttle: true }, 1).vehicles.p1!.speed;
  }

  it("costs nothing for a brief excursion", () => {
    // Clipping a kerb on a hairpin exit is racing, not a mistake to punish.
    // Inside the grace window the car is still accelerating.
    expect(speedAfterOneTickOffTrack(0)).toBeGreaterThan(60);
  });

  it("bites once you stay out there, and harder still after that", () => {
    const grace = speedAfterOneTickOffTrack(0);
    const stage1 = speedAfterOneTickOffTrack(60);
    const stage2 = speedAfterOneTickOffTrack(200);

    expect(stage1).toBeLessThan(grace);
    expect(stage2).toBeLessThan(stage1);
  });

  it("resets the moment the car is back on the road", () => {
    const base = started(engine);
    const out: RacingGameState = {
      ...base,
      track: { ...base.track, obstacles: [], zones: [], boostPads: [], pickups: [] },
      vehicles: { ...base.vehicles, p1: { ...base.vehicles.p1!, lateral: 1.2, offTrackTicks: 90 } },
    };
    const back = drive(engine, out, "p1", { throttle: true, steer: -1 }, 120);
    expect(Math.abs(back.vehicles.p1!.lateral)).toBeLessThan(1);
    expect(back.vehicles.p1!.offTrackTicks).toBe(0);
  });

  it("leaves run-off reachable at all", () => {
    // The regression this guards: a barrier inside the painted line made
    // `offRoad` unreachable and the whole staged penalty dead code.
    const base = started(engine);
    const clean: RacingGameState = {
      ...base,
      track: { ...base.track, obstacles: [], zones: [], boostPads: [], pickups: [] },
    };
    const wide = drive(engine, clean, "p1", { throttle: true, steer: 1 }, 400);
    expect(Math.abs(wide.vehicles.p1!.lateral)).toBeGreaterThan(1);
  });
});
