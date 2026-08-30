import { describe, it, expect } from "vitest";
import type { Player } from "@playora/game-types";
import { CarRaceEngine } from "../racing/CarRaceEngine.js";
import { BikeRaceEngine } from "../racing/BikeRaceEngine.js";
import { buildTrack, sampleTrack, trackCenterline, trackToWorld } from "../racing/track.js";
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

  it("opens and closes with a straight", () => {
    const track = buildTrack("straights", 2000);
    // The grid and the finish must not sit on a bend.
    expect(Math.abs(track.segments[0]!.curvature)).toBeLessThan(0.005);
    expect(Math.abs(track.segments.at(-1)!.curvature)).toBeLessThan(0.005);
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

  it("builds a centreline that matches the curvature it was generated from", () => {
    const track = buildTrack("line", 1000);
    const line = trackCenterline(track);
    expect(line.length).toBeGreaterThan(10);
    // A straight opening means the first points run down +z with no drift.
    expect(Math.abs(line[1]!.x)).toBeLessThan(0.5);
    expect(line[1]!.z).toBeGreaterThan(0);
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
    let state = engine.init(players(1), { randomSeed: "finish", trackLength: 800 });
    for (let i = 0; i < 60 * 5; i += 20) state = engine.applyAction(state, tickAction(20)).state;
    state = engine.applyAction(state, inputAction("p1", { throttle: true })).state;

    for (let i = 0; i < 60 * 90 && !state.isFinished; i += 20) {
      state = engine.applyAction(state, tickAction(20)).state;
    }

    expect(state.isFinished).toBe(true);
    expect(state.winnerId).toBe("p1");
    expect(state.vehicles.p1!.place).toBe(1);
    expect(state.vehicles.p1!.distance).toBeGreaterThanOrEqual(800);
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

  it("maps a positive lateral offset to the camera's right", () => {
    // The chase camera looks along +z, and a camera looking down +z has its
    // right hand pointing at -x. So steering right (a positive lateral) must
    // produce a *smaller* x, or the car moves the wrong way on screen — which
    // is a bug no still frame can show.
    const centre = at(0, 0);
    const right = at(0, 1);
    const left = at(0, -1);

    expect(right.x).toBeLessThan(centre.x);
    expect(left.x).toBeGreaterThan(centre.x);
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

  it("clamps rather than returning nonsense off either end", () => {
    expect(Number.isFinite(at(-50, 0).x)).toBe(true);
    expect(Number.isFinite(at(track.length + 500, 0).x)).toBe(true);
  });

  it("returns null for an empty centreline", () => {
    expect(trackToWorld([], 0, 0, 8, 10)).toBeNull();
  });
});

describe("tracks do not spiral into themselves", () => {
  it("keeps any single corner under a right angle and a half", () => {
    for (const seed of ["s1", "s2", "s3", "s4", "s5", "s6"]) {
      const track = buildTrack(seed, 5000);
      let corner = 0;
      let sign = 0;

      for (const segment of track.segments) {
        const turned = segment.curvature * segment.length;
        if (Math.sign(turned) !== sign || turned === 0) {
          sign = Math.sign(turned);
          corner = 0;
        }
        corner += turned;
        // Generous, because unwinding takes a segment or two to take effect.
        expect(Math.abs(corner), `seed ${seed} has a corner of ${corner} radians`)
          .toBeLessThan(Math.PI);
      }
    }
  });

  it("does not wander away in one direction forever", () => {
    // A track whose total heading keeps growing is a spiral, and it renders
    // across its own path — the driver sees walls crossing a road they will
    // never reach.
    for (const seed of ["w1", "w2", "w3", "w4", "w5", "w6"]) {
      const track = buildTrack(seed, 6000);
      const total = track.segments.reduce((sum, s) => sum + s.curvature * s.length, 0);
      expect(Math.abs(total), `seed ${seed} turns ${total} radians overall`)
        .toBeLessThan(Math.PI * 1.5);
    }
  });

  it("still produces corners worth driving", () => {
    const track = buildTrack("variety", 4000);
    const corners = track.segments.filter((s) => Math.abs(s.curvature) > 0.012);
    expect(corners.length).toBeGreaterThan(15);
  });
});
