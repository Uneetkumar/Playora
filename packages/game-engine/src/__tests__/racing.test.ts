import { describe, it, expect } from "vitest";
import type { Player } from "@playora/game-types";
import { CarRaceEngine } from "../racing/CarRaceEngine.js";
import { BikeRaceEngine } from "../racing/BikeRaceEngine.js";
import { buildTrack, sampleTrack, trackCenterline, trackToWorld } from "../racing/track.js";
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
    let state = started(engine);
    state = drive(engine, state, "p1", { throttle: true }, 60 * 30);
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
    // Above roughly 0.03 the centrifugal push at top speed beats full steering
    // lock, and the corner is impossible rather than hard.
    for (const seed of ["d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8"]) {
      for (const length of [900, 1600, 3000]) {
        const track = buildTrack(seed, length);
        const worst = track.segments.reduce((m, s) => Math.max(m, Math.abs(s.curvature)), 0);
        expect(worst, `seed ${seed} at ${length}m has a corner of ${worst}`).toBeLessThanOrEqual(0.03);
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
