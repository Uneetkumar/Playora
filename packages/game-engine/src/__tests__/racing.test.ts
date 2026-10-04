import { describe, it, expect } from "vitest";
import type { GameId, Player } from "@playora/game-types";
import {
  BIKES,
  BikeRaceEngine,
  CARS,
  CarRaceEngine,
  GOOD_LAUNCH_TICKS,
  LIGHTS_FULL_TICK,
  MAX_CURVATURE,
  PAINTS,
  ROAD_HALF_WIDTH,
  RUN_OFF_LIMIT,
  SERVER_PLAYER_ID,
  START_HOLD_MAX_TICKS,
  START_HOLD_MIN_TICKS,
  START_LIGHT_INTERVAL_TICKS,
  START_SETTLE_TICKS,
  TICK_RATE,
  brakingDistance,
  buildTrack,
  cornerGripOf,
  cornerSpeedFor,
  crossedOnLap,
  datan2,
  dcos,
  dsin,
  dtan,
  hashRacingState,
  isValidPaint,
  lapDelta,
  lateralG,
  paintFinishOf,
  planCorner,
  resolvePaint,
  resolveVehicleId,
  sampleTrack,
  simulateZeroTo100,
  steerToward,
  stoppingDistance100,
  trackCenterline,
  trackToWorld,
  vehicleById,
  vehicleStats,
  withinOnLap,
  wrapDistance,
  type CarModelId,
  type RacingAction,
  type RacingConfig,
  type RacingEngine,
  type RacingEvent,
  type RacingGameState,
  type SetInputPayload,
  type TrackSpec,
  type VehicleSpec,
  type VehicleState,
} from "../racing/index.js";
import { BIKE_LEVELS, CAR_LEVELS, isPass, levelsFor, starsFor, unlockedLevels } from "../racing/levels.js";

// ---------------------------------------------------------------- helpers

const players = (n: number, bots = false): Player[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    userId: `p${i + 1}`,
    displayName: `Player ${i + 1}`,
    isBot: bots,
    isGuest: false,
    seat: i,
  })) as unknown as Player[];

const tickAction = (ticks = 1): RacingAction => ({
  type: "TICK",
  playerId: SERVER_PLAYER_ID,
  payload: { ticks },
  timestamp: 0,
});

const inputAction = (playerId: string, input: SetInputPayload): RacingAction => ({
  type: "SET_INPUT",
  playerId,
  payload: input,
  timestamp: 0,
});

/** Advances one tick at a time, collecting every event. */
function run(
  engine: RacingEngine,
  state: RacingGameState,
  ticks: number,
  events: RacingEvent[] = [],
): RacingGameState {
  let next = state;
  for (let i = 0; i < ticks && !next.isFinished; i++) {
    const result = engine.applyAction(next, tickAction(1));
    next = result.state;
    events.push(...(result.events ?? []));
  }
  return next;
}

/** Sets an input and holds it for `ticks`. */
function drive(
  engine: RacingEngine,
  state: RacingGameState,
  playerId: string,
  input: SetInputPayload,
  ticks: number,
  events: RacingEvent[] = [],
): RacingGameState {
  return run(engine, engine.applyAction(state, inputAction(playerId, input)).state, ticks, events);
}

/** Runs the start procedure until the lights go out. */
function started(engine: RacingEngine, count = 1, config: RacingConfig = {}): RacingGameState {
  let state = engine.init(players(count), { randomSeed: "test-track", trackLength: 1500, ...config });
  while (state.racingPhase === "countdown") state = engine.applyAction(state, tickAction(10)).state;
  return state;
}

/** Marks every car as launched, so no launch boost colours a measurement. */
function launched(state: RacingGameState): RacingGameState {
  const vehicles: Record<string, VehicleState> = {};
  for (const [id, v] of Object.entries(state.vehicles)) vehicles[id] = { ...v, launchTicks: 99 };
  return { ...state, vehicles };
}

/** The same track with every object removed. */
function cleanTrack(track: TrackSpec): TrackSpec {
  return { ...track, obstacles: [], zones: [], boostPads: [], pickups: [], coins: [] };
}

/** An empty, flat, dead-straight road (the loop is only used for rendering). */
function straightTrack(track: TrackSpec, gradient = 0): TrackSpec {
  return {
    ...cleanTrack(track),
    segments: track.segments.map((s) => ({ ...s, curvature: 0, gradient })),
  };
}

/** Patches one vehicle. */
function withVehicle(state: RacingGameState, id: string, patch: Partial<VehicleState>): RacingGameState {
  return { ...state, vehicles: { ...state.vehicles, [id]: { ...state.vehicles[id]!, ...patch } } };
}

/** Puts a vehicle on a given lap at a lap-local distance, with the bookkeeping to match. */
function onLap(state: RacingGameState, id: string, lap: number, local: number, patch: Partial<VehicleState> = {}) {
  const length = state.track.length;
  const distance = lap * length + local;
  return withVehicle(state, id, {
    distance,
    lapsDone: lap,
    sectorsDone: Math.floor(distance / (length / 3)),
    checkpoint: state.track.checkpoints.filter((at) => local >= at).length,
    heading: 0,
    slip: 0,
    latAccel: 0,
    launchTicks: 99,
    ...patch,
  });
}

/**
 * A competent driver: the planner's braking points with a safety margin,
 * steering for the centre of the road. Not fast — tests need cars that
 * finish, not cars that win.
 */
function competent(engine: RacingEngine, state: RacingGameState, id: string): SetInputPayload {
  const v = state.vehicles[id]!;
  const t = engine.vehicleTuningFor(v.vehicleId);
  const plan = planCorner({
    track: state.track,
    distance: v.distance,
    speed: v.speed,
    maxSpeed: t.maxSpeed * 1.2,
    grip: cornerGripOf(t, 0.85),
    brakingPower: t.brakePower,
    lookahead: Math.max(150, v.speed * 3),
    margin: 0.3,
  });
  return { steer: steerToward(t, v, state.track, 0), throttle: plan.throttle, brake: plan.brake };
}

function raceToEnd(
  engine: RacingEngine,
  state: RacingGameState,
  maxTicks = TICK_RATE * 900,
  events: RacingEvent[] = [],
): RacingGameState {
  let next = state;
  for (let elapsed = 0; elapsed < maxTicks && !next.isFinished; elapsed += 2) {
    if (next.racingPhase === "racing") {
      for (const id of next.playerOrder) {
        if (next.vehicles[id]!.finishedAtTick === null) {
          next = engine.applyAction(next, inputAction(id, competent(engine, next, id))).state;
        }
      }
    }
    next = run(engine, next, 2, events);
  }
  return next;
}

const count = (events: RacingEvent[], type: RacingEvent["type"], playerId?: string) =>
  events.filter((e) => e.type === type && (playerId === undefined || e.playerId === playerId)).length;

const car = new CarRaceEngine();
const bike = new BikeRaceEngine();

// ---------------------------------------------------------------- track

describe("track generation", () => {
  it("is deterministic for a seed", () => {
    expect(buildTrack("same-seed", 2000)).toEqual(buildTrack("same-seed", 2000));
  });

  it("differs between seeds", () => {
    expect(buildTrack("seed-a", 2000).segments).not.toEqual(buildTrack("seed-b", 2000).segments);
  });

  it("is exactly the length it says, in whole sample steps", () => {
    for (const length of [600, 900, 1234, 3000]) {
      const track = buildTrack(`len-${length}`, length);
      expect(track.length % 10).toBe(0);
      expect(track.points.length * 10).toBe(track.length);
      expect(Math.abs(track.length - length)).toBeLessThanOrEqual(5);
    }
  });

  it("closes into a loop, one sample step from end to start", () => {
    for (const seed of ["c1", "c2", "c3", "c4", "c5", "c6"]) {
      const track = buildTrack(seed, 2000);
      const first = track.points[0]!;
      const last = track.points[track.points.length - 1]!;
      const gap = Math.hypot(last.x - first.x, last.z - first.z);
      expect(Math.abs(gap - 10), `seed ${seed} joins with a ${gap.toFixed(2)}m step`).toBeLessThan(0.5);
    }
  });

  it("turns exactly once around", () => {
    for (const seed of ["w1", "w2", "w3", "w4", "w5"]) {
      const track = buildTrack(seed, 2500);
      const total = track.segments.reduce((sum, s) => sum + s.curvature * s.length, 0);
      expect(Math.abs(total)).toBeCloseTo(Math.PI * 2, 2);
    }
  });

  it("never bends tighter than the limit", () => {
    for (const seed of ["d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8"]) {
      for (const length of [700, 900, 1600, 3000, 5000]) {
        const track = buildTrack(seed, length);
        const worst = track.segments.reduce((m, s) => Math.max(m, Math.abs(s.curvature)), 0);
        expect(worst, `seed ${seed} at ${length}m`).toBeLessThanOrEqual(MAX_CURVATURE);
      }
    }
  });

  it("never brings two unrelated parts of the road within a barrier's reach", () => {
    for (const seed of ["x1", "x2", "x3", "x4", "x5", "x6"]) {
      for (const length of [900, 3000]) {
        const { points } = buildTrack(seed, length);
        const n = points.length;
        let closest = Infinity;
        for (let i = 0; i < n; i++) {
          for (let j = i + 15; j < n; j++) {
            if (n - (j - i) < 15) break;
            closest = Math.min(closest, Math.hypot(points[j]!.x - points[i]!.x, points[j]!.z - points[i]!.z));
          }
        }
        expect(closest, `seed ${seed} at ${length}m`).toBeGreaterThan(4 * ROAD_HALF_WIDTH);
      }
    }
  });

  it("has straights: the longest is long enough for a grid and a drag to the first corner", () => {
    for (const seed of ["s1", "s2", "s3", "s4"]) {
      for (const length of [900, 3000]) {
        const track = buildTrack(seed, length);
        let run = 0;
        let longest = 0;
        for (const s of [...track.segments, ...track.segments]) {
          run = Math.abs(s.curvature) < 0.002 ? run + 1 : 0;
          longest = Math.max(longest, Math.min(run, track.segments.length));
        }
        expect(longest * 10).toBeGreaterThanOrEqual(Math.min(140, length * 0.12));
      }
    }
  });

  it("puts the start line on a straight, with the grid behind it on the straight too", () => {
    for (const seed of ["s1", "s2", "s3", "s4", "s5"]) {
      const track = buildTrack(seed, 2000);
      const n = track.segments.length;
      const around = [...track.segments.slice(n - 5), ...track.segments.slice(0, 4)];
      for (const s of around) expect(Math.abs(s.curvature), `seed ${seed}`).toBeLessThan(0.002);
    }
  });

  it("has corners a car must brake for, and fast ones it need not", () => {
    const gt = car.vehicleTuningFor("car-gt");
    for (const seed of ["b1", "b2", "b3", "b4"]) {
      const track = buildTrack(seed, 3000);
      const speeds = track.segments.map((s) => cornerSpeedFor(s.curvature, cornerGripOf(gt), gt.maxSpeed));
      // A hairpin-class corner: under half the top speed.
      expect(Math.min(...speeds), `seed ${seed}`).toBeLessThan(gt.maxSpeed * 0.5);
      // And plenty of the lap is flat out.
      expect(speeds.filter((v) => v >= gt.maxSpeed).length).toBeGreaterThan(track.segments.length * 0.3);
    }
  });

  it("never blocks the road completely", () => {
    for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      const track = buildTrack(seed, 4000);
      const byDistance = new Map<number, typeof track.obstacles>();
      for (const o of track.obstacles) byDistance.set(o.distance, [...(byDistance.get(o.distance) ?? []), o]);
      for (const [distance, group] of byDistance) {
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

  it("spaces obstacles for racing rather than for dodging", () => {
    const track = buildTrack("spacing", 5000);
    const at = [...new Set(track.obstacles.map((o) => o.distance))].sort((a, b) => a - b);
    for (let i = 1; i < at.length; i++) expect(at[i]! - at[i - 1]!).toBeGreaterThanOrEqual(119);
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
    const track = buildTrack("line", 2000);
    const line = trackCenterline(track);
    for (let i = 1; i < line.length; i++) {
      const gap = Math.hypot(line[i]!.x - line[i - 1]!.x, line[i]!.z - line[i - 1]!.z);
      expect(gap).toBeGreaterThan(9.5);
      expect(gap).toBeLessThan(10.5);
    }
    expect(sampleTrack(track, 0).curvature).toBeCloseTo(track.segments[0]!.curvature);
  });

  it("stores curvature right-positive, the same sign as lateral and steering", () => {
    // A right-hand bend: the heading (which grows to the left) falls.
    const track = buildTrack("sign", 2000);
    track.segments.forEach((s, i) => {
      const a = track.points[i]!.heading;
      const b = track.points[(i + 1) % track.points.length]!.heading;
      let delta = (b - a) % (Math.PI * 2);
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      expect(s.curvature).toBeCloseTo(-delta / 10, 9);
    });
  });
});

describe("lap-local geometry", () => {
  const track = buildTrack("geo", 1000);
  const L = track.length;

  it("wraps distances onto the lap, including negative grid positions", () => {
    expect(wrapDistance(track, L * 3 + 12)).toBeCloseTo(12);
    expect(wrapDistance(track, -10)).toBeCloseTo(L - 10);
  });

  it("measures the gap between cars on different laps by where they are on the road", () => {
    expect(lapDelta(track, L * 2 + 100, 105)).toBeCloseTo(5);
    expect(lapDelta(track, 105, L * 2 + 100)).toBeCloseTo(-5);
    expect(lapDelta(track, L - 3, L + 2)).toBeCloseTo(5);
  });

  it("detects crossing a lap-local point on any lap and across the line", () => {
    expect(crossedOnLap(track, 300, L * 2 + 295, L * 2 + 301)).toBe(true);
    expect(crossedOnLap(track, 300, L * 2 + 301, L * 2 + 305)).toBe(false);
    expect(crossedOnLap(track, 5, L - 3, L + 6)).toBe(true);
    // Half-open: a stationary car is not struck every tick.
    expect(crossedOnLap(track, 300, 300, 300)).toBe(false);
  });

  it("finds a point inside a zone that runs across the finish line", () => {
    expect(withinOnLap(track, L - 20, 50, L * 3 + 10)).toBe(true);
    expect(withinOnLap(track, L - 20, 50, L * 3 + 40)).toBe(false);
  });
});

// ---------------------------------------------------------------- authority

describe("server authority", () => {
  it("refuses to let a player advance the clock", () => {
    const state = car.init(players(2), { randomSeed: "auth" });
    const result = car.validateAction(state, { ...tickAction(10_000), playerId: "p1" });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("server");
  });

  it("accepts a tick from the server", () => {
    const state = car.init(players(2), { randomSeed: "auth" });
    expect(car.validateAction(state, tickAction()).valid).toBe(true);
  });

  it("refuses input from someone not in the race", () => {
    const state = car.init(players(2), { randomSeed: "auth" });
    expect(car.validateAction(state, inputAction("stranger", { throttle: true })).valid).toBe(false);
  });

  it("refuses non-numeric pedals and nitro sequences", () => {
    const state = car.init(players(1), { randomSeed: "auth" });
    expect(car.validateAction(state, inputAction("p1", { throttle: Number.NaN })).valid).toBe(false);
    expect(car.validateAction(state, inputAction("p1", { nitroSeq: Number.POSITIVE_INFINITY })).valid).toBe(false);
    expect(car.validateAction(state, inputAction("p1", { throttle: 0.4, brake: true })).valid).toBe(true);
  });

  it("caps how far one tick action can advance the world", () => {
    const state = started(car);
    const after = car.applyAction(state, tickAction(100_000)).state;
    expect(after.tick - state.tick).toBeLessThanOrEqual(20);
  });

  it("clamps steering and pedals instead of trusting them", () => {
    const state = started(car);
    const after = car.applyAction(state, inputAction("p1", { steer: 500, throttle: 7, brake: -3 })).state;
    expect(after.vehicles.p1!.input.steer).toBe(1);
    expect(after.vehicles.p1!.input.throttle).toBe(1);
    expect(after.vehicles.p1!.input.brake).toBe(0);
  });

  it("accepts boolean pedals from older clients as full or nothing", () => {
    const state = started(car);
    const after = car.applyAction(state, inputAction("p1", { throttle: true, brake: false })).state;
    expect(after.vehicles.p1!.input.throttle).toBe(1);
    expect(after.vehicles.p1!.input.brake).toBe(0);
  });

  it("ignores a position, a zone or a power-up a client tries to send", () => {
    const state = started(car);
    const forged = car.applyAction(
      state,
      inputAction("p1", { steer: 0, distance: 999_999, speed: 999, shielded: true, zone: "boost" } as never),
    ).state;
    expect(forged.vehicles.p1!.distance).toBe(state.vehicles.p1!.distance);
    expect(forged.vehicles.p1!.speed).toBe(state.vehicles.p1!.speed);
    const after = drive(car, { ...forged, track: cleanTrack(forged.track) }, "p1", { throttle: 1 }, 30);
    expect(after.vehicles.p1!.shielded).toBe(false);
    expect(after.vehicles.p1!.zone).toBeNull();
  });

  it("echoes the highest input sequence for reconciliation", () => {
    let state = started(car);
    state = car.applyAction(state, inputAction("p1", { throttle: 1, seq: 7 })).state;
    state = car.applyAction(state, inputAction("p1", { throttle: 1, seq: 5 })).state;
    expect(state.vehicles.p1!.lastInputSeq).toBe(7);
  });
});

// ---------------------------------------------------------------- start

describe("the start: five lights and lights out", () => {
  it("lights one red every 0.8 s after a settle, then all five go out", () => {
    const events: RacingEvent[] = [];
    let state = car.init(players(2), { randomSeed: "lights" });
    const lights: Array<{ tick: number; value: number }> = [];
    while (state.racingPhase === "countdown") {
      const result = car.applyAction(state, tickAction(1));
      state = result.state;
      for (const e of result.events ?? []) {
        events.push(e);
        if (e.type === "START_LIGHT") lights.push({ tick: state.tick, value: e.value! });
      }
    }
    expect(lights.map((l) => l.value)).toEqual([1, 2, 3, 4, 5]);
    lights.forEach((l, i) => expect(l.tick).toBe(START_SETTLE_TICKS + i * START_LIGHT_INTERVAL_TICKS));
    expect(count(events, "LIGHTS_OUT")).toBe(1);
    expect(count(events, "RACE_STARTED")).toBe(1);
    expect(state.start.lightsOutTick).toBe(state.tick);
  });

  it("holds the lights for a seeded 0.2-1.0 s that varies from race to race", () => {
    const ticks = new Set<number>();
    for (let i = 0; i < 12; i++) {
      const a = car.init(players(1), { randomSeed: `hold-${i}` });
      const b = car.init(players(1), { randomSeed: `hold-${i}` });
      expect(a.start.lightsOutTick).toBe(b.start.lightsOutTick);
      expect(a.start.lightsOutTick).toBeGreaterThanOrEqual(LIGHTS_FULL_TICK + START_HOLD_MIN_TICKS);
      expect(a.start.lightsOutTick).toBeLessThanOrEqual(LIGHTS_FULL_TICK + START_HOLD_MAX_TICKS);
      ticks.add(a.start.lightsOutTick);
    }
    expect(ticks.size).toBeGreaterThanOrEqual(4);
  });

  it("keeps the lights-out tick out of every view until it happens", () => {
    let state = car.init(players(2), { randomSeed: "secret" });
    state = run(car, state, LIGHTS_FULL_TICK + 2);
    const before = car.getPlayerView(state, "p1");
    expect(before.start.lights).toBe(5);
    expect(before.start.lightsOutTick).toBeNull();
    expect(JSON.stringify(before)).not.toContain(`"lightsOutTick":${state.start.lightsOutTick}`);
    while (state.racingPhase === "countdown") state = run(car, state, 1);
    const after = car.getPlayerView(state, "p1");
    expect(after.start.lights).toBe(0);
    expect(after.start.lightsOutTick).toBe(state.start.lightsOutTick);
  });

  it("does not move anyone who waits for the lights", () => {
    let state = car.init(players(2), { randomSeed: "grid" });
    const before = state.vehicles.p1!.distance;
    state = run(car, state, LIGHTS_FULL_TICK);
    expect(state.vehicles.p1!.distance).toBe(before);
    expect(state.vehicles.p1!.speed).toBe(0);
  });

  it("revs on brake and throttle without creeping", () => {
    let state = car.init(players(1), { randomSeed: "revs" });
    const events: RacingEvent[] = [];
    state = drive(car, state, "p1", { throttle: 1, brake: 1 }, LIGHTS_FULL_TICK, events);
    const v = state.vehicles.p1!;
    expect(v.rpm).toBeGreaterThan(car.vehicleTuningFor(v.vehicleId).idleRpm * 3);
    expect(v.speed).toBe(0);
    expect(count(events, "JUMP_START")).toBe(0);
  });

  it("calls a jump start on a car that creeps before lights out, and limits it after", () => {
    const events: RacingEvent[] = [];
    let state = car.init(players(2), { randomSeed: "jump", trackLength: 3000 });
    state = run(car, state, START_SETTLE_TICKS + 10);
    // Held only until the fifth light: the jump is the creep, not the launch.
    state = drive(car, state, "p1", { throttle: 1 }, LIGHTS_FULL_TICK - START_SETTLE_TICKS - 10, events);
    expect(count(events, "JUMP_START", "p1")).toBe(1);
    expect(state.vehicles.p1!.jumpStart).toBe(true);
    while (state.racingPhase === "countdown") state = run(car, state, 1, events);
    expect(state.vehicles.p1!.penaltyTicks).toBeGreaterThan(0);

    // The limiter: pit-lane speed for three seconds, however hard it is driven.
    state = { ...state, track: straightTrack(state.track) };
    let fastest = 0;
    for (let i = 0; i < TICK_RATE * 2.5; i++) {
      state = drive(car, state, "p1", { throttle: 1 }, 1, events);
      fastest = Math.max(fastest, state.vehicles.p1!.speed);
    }
    expect(fastest).toBeLessThan(60 / 3.6 + 1.5);
    // And no launch bonus for it.
    expect(events.find((e) => e.type === "LAUNCH" && e.playerId === "p1")?.strength).toBe(0);
  });

  it("rewards a launch on the lights and not a late one", () => {
    const launch = (delay: number) => {
      const events: RacingEvent[] = [];
      let state = car.init(players(1), { randomSeed: "launch", trackLength: 3000 });
      while (state.tick < state.start.lightsOutTick - 1) state = run(car, state, 1);
      state = run(car, state, delay);
      state = drive(car, state, "p1", { throttle: 1 }, 2, events);
      return { state, events };
    };
    const perfect = launch(0);
    expect(count(perfect.events, "PERFECT_LAUNCH")).toBe(1);
    expect(perfect.state.vehicles.p1!.boostTicks).toBeGreaterThan(0);

    const late = launch(GOOD_LAUNCH_TICKS + 10);
    expect(count(late.events, "PERFECT_LAUNCH")).toBe(0);
    expect(late.events.find((e) => e.type === "LAUNCH")?.strength).toBe(0);
    expect(late.state.vehicles.p1!.boostTicks).toBe(0);
  });

  it("varies the grid by seed, so the player is not always at the back", () => {
    const slots = new Set<number>();
    for (let i = 0; i < 10; i++) {
      const state = car.init(players(4), { randomSeed: `grid-${i}` });
      slots.add(state.gridOrder.indexOf("p1"));
      // Positions start in grid order.
      state.gridOrder.forEach((id, slot) => expect(state.vehicles[id]!.position).toBe(slot + 1));
    }
    expect(slots.size).toBeGreaterThanOrEqual(3);
  });

  it("honours an explicit grid, pole first", () => {
    const state = car.init(players(4), { randomSeed: "fixed", grid: ["p3", "p1"] });
    expect(state.gridOrder.slice(0, 2)).toEqual(["p3", "p1"]);
    expect(state.vehicles.p3!.distance).toBeGreaterThan(state.vehicles.p1!.distance);
    expect(new Set(state.gridOrder).size).toBe(4);
  });
});

// ---------------------------------------------------------------- lap 2+

describe("track objects keep working after the first lap", () => {
  /** One car, lap two or three, an object `ahead` metres up the road, a clean track otherwise. */
  function setup(lap: number, local: number, track: Partial<TrackSpec>, patch: Partial<VehicleState> = {}) {
    const base = launched(started(car, 1, { trackLength: 2000 }));
    const state: RacingGameState = { ...base, track: { ...straightTrack(base.track), ...track } };
    return onLap(state, "p1", lap, local, { speed: 30, lateral: 0, ...patch });
  }

  for (const lap of [1, 2]) {
    it(`reports a surface zone on lap ${lap + 1}`, () => {
      const state = setup(lap, 290, { zones: [{ kind: "slick", distance: 300, lateral: 0, halfWidth: 0.5, length: 60 }] });
      const after = drive(car, state, "p1", { throttle: 1 }, 30);
      expect(after.vehicles.p1!.zone).toBe("slick");
    });

    it(`fires a boost pad on lap ${lap + 1}`, () => {
      const events: RacingEvent[] = [];
      const state = setup(lap, 280, { boostPads: [{ distance: 300, lateral: 0, halfWidth: 0.35 }] });
      const after = drive(car, state, "p1", { throttle: 1 }, 60, events);
      expect(count(events, "BOOST_PAD")).toBe(1);
      expect(after.vehicles.p1!.distance).toBeGreaterThan(lap * after.track.length + 300);
    });

    it(`hits an obstacle on lap ${lap + 1}`, () => {
      const events: RacingEvent[] = [];
      const state = setup(lap, 280, { obstacles: [{ kind: "barrier", distance: 300, lateral: 0, halfWidth: 0.4 }] });
      let after = state;
      let stunned = false;
      for (let i = 0; i < 60 && !stunned; i++) {
        after = drive(car, after, "p1", { throttle: 1 }, 1, events);
        stunned = after.vehicles.p1!.crashTicks > 0;
      }
      expect(stunned).toBe(true);
      expect(count(events, "CRASHED")).toBe(1);
    });

    it(`opens a power-up on lap ${lap + 1}`, () => {
      const events: RacingEvent[] = [];
      const state = setup(lap, 280, { pickups: [{ distance: 300, lateral: 0, kind: "nitro" }] }, { nitro: 0.1 });
      const after = drive(car, state, "p1", { throttle: 1 }, 60, events);
      expect(count(events, "PICKUP_COLLECTED")).toBe(1);
      expect(after.vehicles.p1!.nitro).toBeGreaterThan(0.4);
    });

    it(`collects a coin on lap ${lap + 1}`, () => {
      const events: RacingEvent[] = [];
      const state = setup(lap, 280, { coins: [{ distance: 300, lateral: 0 }] });
      const after = drive(car, state, "p1", { throttle: 1 }, 60, events);
      expect(count(events, "COIN_COLLECTED")).toBe(1);
      expect(after.vehicles.p1!.coins).toBe(1);
    });

    it(`passes checkpoints on lap ${lap + 1}`, () => {
      const events: RacingEvent[] = [];
      const base = setup(lap, 0, {});
      const first = base.track.checkpoints[0]!;
      const state = onLap(base, "p1", lap, first - 20, { speed: 30 });
      drive(car, state, "p1", { throttle: 1 }, 60, events);
      expect(events.find((e) => e.type === "CHECKPOINT")?.value).toBe(1);
    });
  }

  it("opens the same box again on the next lap, but only once per lap", () => {
    const events: RacingEvent[] = [];
    let state = setup(1, 280, { pickups: [{ distance: 300, lateral: 0, kind: "nitro" }] }, { nitro: 0 });
    state = drive(car, state, "p1", { throttle: 1 }, 60, events);
    state = onLap(state, "p1", 2, 280, { speed: 30, lateral: 0 });
    state = drive(car, state, "p1", { throttle: 1 }, 60, events);
    expect(count(events, "PICKUP_COLLECTED")).toBe(2);
    expect(state.collectedPickups.length).toBe(2);
  });

  it("collects across the finish-line seam", () => {
    const events: RacingEvent[] = [];
    const base = setup(1, 0, {});
    const L = base.track.length;
    const state = onLap({ ...base, track: { ...base.track, coins: [{ distance: 4, lateral: 0 }] } }, "p1", 1, L - 15, {
      speed: 30,
      lateral: 0,
    });
    drive(car, state, "p1", { throttle: 1 }, 60, events);
    expect(count(events, "COIN_COLLECTED")).toBe(1);
  });

  it("reports a zone that runs across the line", () => {
    const base = setup(2, 0, {});
    const L = base.track.length;
    const zoned = { ...base, track: { ...base.track, zones: [{ kind: "grip" as const, distance: L - 20, lateral: 0, halfWidth: 0.6, length: 60 }] } };
    const state = onLap(zoned, "p1", 2, 5, { speed: 5, lateral: 0 });
    expect(drive(car, state, "p1", { throttle: 0 }, 2).vehicles.p1!.zone).toBe("grip");
  });

  it("drafts a lapped car", () => {
    const base = launched(started(car, 2, { trackLength: 2000 }));
    let state: RacingGameState = { ...base, track: straightTrack(base.track) };
    state = onLap(state, "p1", 2, 300, { speed: 40, lateral: 0 });
    state = onLap(state, "p2", 1, 312, { speed: 40, lateral: 0 });
    const after = run(car, state, 3);
    expect(after.vehicles.p1!.drafting).toBeGreaterThan(0.5);
    expect(after.vehicles.p2!.drafting).toBe(0);
  });

  it("does not let a lapped car pass through the leader", () => {
    const events: RacingEvent[] = [];
    const base = launched(started(car, 2, { trackLength: 2000 }));
    let state: RacingGameState = { ...base, track: straightTrack(base.track) };
    state = onLap(state, "p1", 2, 300, { speed: 45, lateral: 0 });
    state = onLap(state, "p2", 1, 308, { speed: 20, lateral: 0 });
    state = car.applyAction(state, inputAction("p1", { throttle: 1 })).state;
    state = car.applyAction(state, inputAction("p2", { throttle: 0.2 })).state;
    let touching = 0;
    for (let i = 0; i < 90; i++) {
      state = run(car, state, 1, events);
      if (state.contacts.length > 0) touching += 1;
      // Never through it, on any tick.
      expect(lapDelta(state.track, state.vehicles.p1!.distance, state.vehicles.p2!.distance)).toBeGreaterThan(0);
    }
    // Every shunt is one event, however many ticks the cars stay in contact.
    const shunts = count(events, "COLLISION", "p1");
    expect(shunts).toBeGreaterThanOrEqual(1);
    expect(shunts).toBeLessThan(touching);
  });
});

// ---------------------------------------------------------------- contact

describe("car-to-car contact", () => {
  function pair(a: Partial<VehicleState>, b: Partial<VehicleState>, config: RacingConfig = {}): RacingGameState {
    const base = launched(started(car, 2, { trackLength: 2000, ...config }));
    let state: RacingGameState = { ...base, track: straightTrack(base.track) };
    state = onLap(state, "p1", 1, 300, { speed: 30, lateral: 0, ...a });
    state = onLap(state, "p2", 1, 300, { speed: 30, lateral: 0, ...b });
    return state;
  }

  it("uses a car-sized box: three metres apart side by side is clear, one and a half is not", () => {
    const apart = run(car, pair({ lateral: -1.5 / ROAD_HALF_WIDTH }, { lateral: 1.5 / ROAD_HALF_WIDTH }), 1);
    expect(apart.contacts).toEqual([]);
    const touching = run(car, pair({ lateral: -0.75 / ROAD_HALF_WIDTH }, { lateral: 0.75 / ROAD_HALF_WIDTH }), 1);
    expect(touching.contacts).toEqual(["p1|p2"]);
  });

  it("gives the car hit from behind no speed, and takes the closing speed off the one behind", () => {
    const events: RacingEvent[] = [];
    const state = pair({ distance: 0 }, {});
    const L = state.track.length;
    const setup = withVehicle(withVehicle(state, "p1", { distance: L + 296, speed: 40 }), "p2", { distance: L + 300, speed: 25 });
    const coast = (s: RacingGameState) => car.applyAction(s, inputAction("p2", { throttle: 0 })).state;
    const alone = run(car, coast({ ...setup, vehicles: { ...setup.vehicles, p1: { ...setup.vehicles.p1!, lateral: 0.9 } } }), 30);
    const hit = run(car, coast(setup), 30, events);
    expect(hit.vehicles.p2!.speed).toBeLessThanOrEqual(alone.vehicles.p2!.speed + 1e-9);
    expect(hit.vehicles.p1!.speed).toBeLessThan(40);
    expect(count(events, "COLLISION", "p1")).toBe(1);
  });

  it("fires one COLLISION (and one legacy CRASHED) per car per contact, not per tick", () => {
    const events: RacingEvent[] = [];
    let state = pair({ lateral: -0.2 }, { lateral: 0.2 });
    // Both steer into each other for a second.
    state = car.applyAction(state, inputAction("p1", { steer: 0.6, throttle: 0.5 })).state;
    state = car.applyAction(state, inputAction("p2", { steer: -0.6, throttle: 0.5 })).state;
    run(car, state, 60, events);
    for (const id of ["p1", "p2"]) {
      expect(count(events, "COLLISION", id)).toBe(1);
      expect(events.filter((e) => e.type === "CRASHED" && e.playerId === id && e.otherId).length).toBe(1);
    }
  });

  it("pushes the lighter car further", () => {
    const state = pair(
      { lateral: -0.11, heading: 0.15, slip: 0 },
      { lateral: 0.11, heading: -0.15, slip: 0 },
      { vehicles: { p1: "car-muscle", p2: "car-formula" } },
    );
    const after = run(car, state, 6);
    const muscleMoved = Math.abs(after.vehicles.p1!.lateral - state.vehicles.p1!.lateral);
    const formulaMoved = Math.abs(after.vehicles.p2!.lateral - state.vehicles.p2!.lateral);
    expect(formulaMoved).toBeGreaterThan(muscleMoved);
  });

  it("stuns a fragile single-seater where a muscle car shrugs it off", () => {
    const state = pair(
      { lateral: -0.14, heading: 0.15, slip: 0, speed: 30 },
      { lateral: 0.14, heading: -0.15, slip: 0, speed: 30 },
      { vehicles: { p1: "car-muscle", p2: "car-formula" } },
    );
    let after = state;
    let formulaStunned = false;
    let muscleStunned = false;
    for (let i = 0; i < 6; i++) {
      after = run(car, after, 1);
      formulaStunned ||= after.vehicles.p2!.crashTicks > 0;
      muscleStunned ||= after.vehicles.p1!.crashTicks > 0;
    }
    expect(formulaStunned).toBe(true);
    expect(muscleStunned).toBe(false);
  });

  it("ghosts finished cars on their cool-down lap", () => {
    const state = pair({}, { finishedAtTick: 10, place: 1 });
    expect(run(car, state, 2).contacts).toEqual([]);
  });

  it("spins a car shoved far past the angle it can catch", () => {
    const events: RacingEvent[] = [];
    const state = pair({ slip: 1.5, heading: 1.5, speed: 35 }, { lateral: 0.9 });
    run(car, state, 5, events);
    expect(count(events, "SPIN", "p1")).toBe(1);
  });
});

// ---------------------------------------------------------------- physics

describe("vehicle physics", () => {
  /** A car on an empty straight, already moving, nothing to boost it. */
  function onStraight(vehicleId: string, patch: Partial<VehicleState> = {}, gradient = 0): RacingGameState {
    const base = launched(started(car, 1, { trackLength: 3000, vehicles: { p1: vehicleId } }));
    return withVehicle({ ...base, track: straightTrack(base.track, gradient) }, "p1", { lateral: 0, ...patch });
  }

  it("tops out at the car's quoted top speed", () => {
    for (const spec of CARS) {
      let state = onStraight(spec.id, { speed: (spec.specs.topSpeedKmh / 3.6) * 0.85, gear: 5 });
      let fastest = 0;
      for (let i = 0; i < 60; i++) {
        state = drive(car, state, "p1", { throttle: 1 }, 60);
        fastest = Math.max(fastest, state.vehicles.p1!.speed);
      }
      const quoted = spec.specs.topSpeedKmh / 3.6;
      expect(fastest, spec.id).toBeGreaterThan(quoted * 0.97);
      expect(fastest, spec.id).toBeLessThanOrEqual(quoted * 1.005);
    }
  });

  it("does 0-100 km/h in the time on its spec sheet", () => {
    for (const spec of CARS) {
      let state = onStraight(spec.id, { speed: 0, gear: 1, rpm: 1000 });
      state = car.applyAction(state, inputAction("p1", { throttle: 1 })).state;
      let ticks = 0;
      while (state.vehicles.p1!.speed < 100 / 3.6 && ticks < TICK_RATE * 10) {
        state = run(car, state, 1);
        ticks += 1;
      }
      expect(ticks / TICK_RATE, spec.id).toBeCloseTo(spec.specs.zeroTo100S, 0);
      expect(Math.abs(ticks / TICK_RATE - spec.specs.zeroTo100S), spec.id).toBeLessThan(0.1);
    }
  });

  it("shifts up through the box in order under full throttle, revs within the limiter", () => {
    for (const spec of CARS) {
      const events: RacingEvent[] = [];
      let state = onStraight(spec.id, { speed: 0, gear: 1 });
      state = car.applyAction(state, inputAction("p1", { throttle: 1 })).state;
      const t = car.vehicleTuningFor(spec.id);
      let gear = 1;
      let speed = 0;
      for (let i = 0; i < TICK_RATE * 30; i++) {
        state = run(car, state, 1, events);
        const v = state.vehicles.p1!;
        expect(v.gear, spec.id).toBeGreaterThanOrEqual(gear);
        expect(v.rpm).toBeLessThanOrEqual(t.redlineRpm * (1 + t.overrev) + 1);
        expect(v.rpm).toBeGreaterThanOrEqual(t.idleRpm - 1);
        // Drag can take a hair off during a shift's torque cut, nothing more.
        expect(v.speed).toBeGreaterThan(speed - 0.05);
        gear = v.gear;
        speed = v.speed;
      }
      expect(gear, spec.id).toBeGreaterThanOrEqual(t.gearRatios.length - 1);
      expect(count(events, "GEAR_UP")).toBe(gear - 1);
      expect(count(events, "GEAR_DOWN")).toBe(0);
    }
  });

  it("changes down as it brakes", () => {
    const events: RacingEvent[] = [];
    let state = onStraight("car-gt", { speed: 70, gear: 6 });
    state = drive(car, state, "p1", { brake: 1 }, TICK_RATE * 4, events);
    expect(state.vehicles.p1!.gear).toBeLessThanOrEqual(2);
    expect(count(events, "GEAR_DOWN")).toBeGreaterThanOrEqual(3);
  });

  it("stops from 100 km/h in the distance the brakes and tyres allow", () => {
    for (const spec of CARS) {
      let state = onStraight(spec.id, { speed: 100 / 3.6, gear: 3 });
      const from = state.vehicles.p1!.distance;
      state = drive(car, state, "p1", { brake: 1 }, TICK_RATE * 5);
      const travelled = state.vehicles.p1!.distance - from;
      const t = car.vehicleTuningFor(spec.id);
      expect(state.vehicles.p1!.speed).toBe(0);
      expect(travelled, spec.id).toBeLessThan(stoppingDistance100(t) * 1.15);
      expect(travelled, spec.id).toBeGreaterThan(stoppingDistance100(t) * 0.8);
    }
  });

  it("answers analog throttle in proportion", () => {
    const half = drive(car, onStraight("car-gt", { speed: 10, gear: 1 }), "p1", { throttle: 0.4 }, 90);
    const full = drive(car, onStraight("car-gt", { speed: 10, gear: 1 }), "p1", { throttle: 1 }, 90);
    expect(half.vehicles.p1!.speed).toBeGreaterThan(10);
    expect(half.vehicles.p1!.speed).toBeLessThan(full.vehicles.p1!.speed);
  });

  it("slows on a climb and gains on a descent (g sin theta)", () => {
    const flat = drive(car, onStraight("car-gt", { speed: 30, gear: 3 }), "p1", { throttle: 0 }, 120);
    const up = drive(car, onStraight("car-gt", { speed: 30, gear: 3 }, 0.08), "p1", { throttle: 0 }, 120);
    const down = drive(car, onStraight("car-gt", { speed: 30, gear: 3 }, -0.08), "p1", { throttle: 0 }, 120);
    // 8% is 0.78 m/s^2 either way: about 1.5 m/s over two seconds.
    expect(up.vehicles.p1!.speed).toBeLessThan(flat.vehicles.p1!.speed - 1.2);
    expect(down.vehicles.p1!.speed).toBeGreaterThan(flat.vehicles.p1!.speed + 1.2);
  });

  it("cannot steer while stationary", () => {
    const state = drive(car, onStraight("car-gt", { speed: 0 }), "p1", { steer: 1 }, 60);
    expect(state.vehicles.p1!.lateral).toBeCloseTo(0, 6);
  });

  it("steers right to the right: lateral and heading both grow", () => {
    const state = drive(car, onStraight("car-gt", { speed: 25, gear: 3 }), "p1", { steer: 0.5, throttle: 0.3 }, 30);
    expect(state.vehicles.p1!.lateral).toBeGreaterThan(0);
    expect(state.vehicles.p1!.heading).toBeGreaterThan(0);
    expect(state.vehicles.p1!.steerAngle).toBeGreaterThan(0);
  });

  it("takes less lock the faster it goes", () => {
    const slow = drive(car, onStraight("car-gt", { speed: 8, gear: 1 }), "p1", { steer: 1 }, 20);
    const fast = drive(car, onStraight("car-gt", { speed: 60, gear: 5 }), "p1", { steer: 1 }, 20);
    expect(fast.vehicles.p1!.steerAngle).toBeLessThan(slow.vehicles.p1!.steerAngle * 0.5);
  });

  it("never corners harder than the friction circle allows", () => {
    for (const id of ["car-gt", "car-formula", "car-muscle"]) {
      const t = car.vehicleTuningFor(id);
      let state = onStraight(id, { speed: 45, gear: 4 });
      state = { ...state, track: { ...state.track, segments: state.track.segments.map((s) => ({ ...s, curvature: 0.02 })) } };
      for (let i = 0; i < 90; i++) {
        state = drive(car, state, "p1", { steer: 1, throttle: 1 }, 1);
        const v = state.vehicles.p1!;
        if (v.drifting) break;
        const limit = t.mu * (9.81 + (t.liftK * v.speed * v.speed) / t.mass);
        expect(Math.abs(v.latAccel), id).toBeLessThanOrEqual(limit * 1.001);
      }
    }
  });

  it("makes a driver brake for a hairpin: flat out, it leaves the road", () => {
    const hairpin = (brakeFirst: boolean) => {
      const base = launched(started(car, 1, { trackLength: 3000 }));
      const segments = base.track.segments.map((s, i) => ({ ...s, gradient: 0, curvature: i >= 40 && i < 50 ? 1 / 25 : 0 }));
      let state = withVehicle({ ...base, track: { ...cleanTrack(base.track), segments } }, "p1", {
        distance: 200,
        lateral: 0,
        speed: 55,
        gear: 5,
      });
      let worst = 0;
      for (let i = 0; i < TICK_RATE * 8; i++) {
        const v = state.vehicles.p1!;
        const t = car.vehicleTuningFor(v.vehicleId);
        const plan = planCorner({
          track: state.track,
          distance: v.distance,
          speed: v.speed,
          maxSpeed: t.maxSpeed,
          grip: cornerGripOf(t, 0.85),
          brakingPower: t.brakePower,
          lookahead: 200,
          margin: 0.3,
        });
        const steer = steerToward(t, v, state.track, 0);
        const input = brakeFirst ? { steer, throttle: plan.throttle, brake: plan.brake } : { steer, throttle: 1, brake: 0 };
        state = drive(car, state, "p1", input, 1);
        worst = Math.max(worst, Math.abs(state.vehicles.p1!.lateral));
      }
      return worst;
    };
    expect(hairpin(false)).toBeGreaterThan(1);
    expect(hairpin(true)).toBeLessThan(1);
  });

  it("loses grip on a slick, and a rally car loses least", () => {
    const corner = (id: string, slick: boolean) => {
      let state = onStraight(id, { speed: 25, gear: 3 });
      if (slick) {
        state = { ...state, track: { ...state.track, zones: [{ kind: "slick", distance: 0, lateral: 0, halfWidth: 2, length: 5000 }] } };
      }
      let peak = 0;
      for (let i = 0; i < 40; i++) {
        state = drive(car, state, "p1", { steer: 1, throttle: 0.2 }, 1);
        if (state.vehicles.p1!.drifting) break;
        peak = Math.max(peak, Math.abs(state.vehicles.p1!.latAccel));
      }
      return peak;
    };
    const gtLoss = corner("car-gt", true) / corner("car-gt", false);
    const rallyLoss = corner("car-rally", true) / corner("car-rally", false);
    expect(gtLoss).toBeLessThan(0.8);
    expect(rallyLoss).toBeGreaterThan(gtLoss);
  });

  it("stages the off-track penalty: grip first, drag only if it stays out", () => {
    const offFor = (ticks: number) => {
      const state = onStraight("car-gt", { lateral: 1.1, speed: 60, gear: 5, offTrackTicks: ticks });
      return drive(car, state, "p1", { throttle: 1 }, 1).vehicles.p1!.speed;
    };
    expect(offFor(0)).toBeGreaterThan(60 - 0.05);
    expect(offFor(60)).toBeLessThan(offFor(0));
    expect(offFor(200)).toBeLessThan(offFor(60));
  });

  it("keeps the car inside the barrier and reports one crash per contact, not per tick", () => {
    for (const steer of [1, -1]) {
      const events: RacingEvent[] = [];
      let state = drive(car, onStraight("car-gt", { speed: 30, gear: 3 }), "p1", { throttle: 1, steer }, 1, events);
      let contacts = 0;
      let touchingTicks = 0;
      for (let i = 0; i < 300; i++) {
        const before = state.vehicles.p1!.wallContact;
        state = run(car, state, 1, events);
        const v = state.vehicles.p1!;
        expect(Math.abs(v.lateral)).toBeLessThan(RUN_OFF_LIMIT);
        if (v.wallContact) touchingTicks += 1;
        if (v.wallContact && !before) contacts += 1;
      }
      expect(contacts).toBeGreaterThanOrEqual(1);
      expect(count(events, "CRASHED")).toBeGreaterThanOrEqual(1);
      expect(count(events, "CRASHED")).toBeLessThanOrEqual(contacts);
      expect(touchingTicks).toBeGreaterThan(contacts);
    }
  });
});

describe("drifting and the mini-turbo", () => {
  /** A constant right-hand curve the drift can be held on. */
  function curve(vehicleId = "car-gt"): RacingGameState {
    const base = launched(started(car, 1, { trackLength: 3000, vehicles: { p1: vehicleId } }));
    return withVehicle(
      { ...base, track: { ...cleanTrack(base.track), segments: base.track.segments.map((s) => ({ ...s, curvature: 0.012, gradient: 0 })) } },
      "p1",
      { distance: 100, lateral: 0, speed: 30, gear: 3 },
    );
  }

  /** Handbrake in, hold the slide on the line, then counter-steer out. */
  function drift(holdTicks: number) {
    const events: RacingEvent[] = [];
    let state = curve();
    const samples: VehicleState[] = [];
    for (let i = 0; i < holdTicks; i++) {
      const v = state.vehicles.p1!;
      const steer = v.drifting ? Math.max(-0.2, Math.min(1, 0.5 - 2.5 * v.lateral)) : 0.6;
      state = drive(car, state, "p1", { steer, throttle: 0.7, handbrake: i < 20 }, 1, events);
      samples.push(state.vehicles.p1!);
    }
    const peakTier = Math.max(...samples.map((v) => v.miniTurbo));
    for (let i = 0; i < 90 && state.vehicles.p1!.drifting; i++) {
      state = drive(car, state, "p1", { steer: -1, throttle: 0.7 }, 1, events);
    }
    return { state, events, samples, peakTier };
  }

  it("starts on the handbrake, slides the way it was steered, and shows opposite lock", () => {
    const { events, samples } = drift(60);
    expect(count(events, "DRIFT_START")).toBe(1);
    const sliding = samples.filter((v) => v.drifting && Math.abs(v.slip) > 0.15);
    expect(sliding.length).toBeGreaterThan(20);
    for (const v of sliding) {
      expect(Math.sign(v.slip)).toBe(1);
      expect(Math.sign(v.steerAngle)).toBe(-1);
      expect(v.tyreSlip).toBeGreaterThan(0.3);
    }
  });

  it("charges blue, orange, purple and fires the tier on release", () => {
    const short = drift(70);
    expect(short.peakTier).toBe(1);
    expect(short.events.find((e) => e.type === "MINI_TURBO")?.value).toBe(1);

    const long = drift(200);
    expect(long.peakTier).toBe(3);
    const turbo = long.events.find((e) => e.type === "MINI_TURBO");
    expect(turbo?.value).toBe(3);
    expect(count(long.events, "DRIFT_END")).toBe(1);
    expect(long.state.vehicles.p1!.boostTicks).toBeGreaterThan(60);
  });

  it("always comes out on counter-steer, even on full throttle", () => {
    for (const id of ["car-gt", "car-muscle"]) {
      const events: RacingEvent[] = [];
      let state = curve(id);
      state = drive(car, state, "p1", { steer: 0.8, throttle: 1, handbrake: true }, 20, events);
      expect(state.vehicles.p1!.drifting, id).toBe(true);
      // Handbrake is a held control like the pedals: it stays on until released.
      state = drive(car, state, "p1", { steer: -1, throttle: 1, handbrake: false }, 50, events);
      // The slide that was held ends (a muscle car flicked hard the other way
      // on full power may well start a new one — that is an over-correction).
      expect(count(events, "DRIFT_END"), id).toBeGreaterThanOrEqual(1);
      if (id === "car-gt") expect(state.vehicles.p1!.drifting).toBe(false);
    }
  });

  it("lets a muscle car's rear step out under power where a GT holds on", () => {
    const powerOn = (id: string) => {
      const events: RacingEvent[] = [];
      let state = curve(id);
      state = withVehicle(state, "p1", { speed: 14, gear: 2 });
      state = { ...state, track: { ...state.track, segments: state.track.segments.map((s) => ({ ...s, curvature: 0.04 })) } };
      drive(car, state, "p1", { steer: 1, throttle: 1 }, 90, events);
      return count(events, "DRIFT_START");
    };
    expect(powerOn("car-muscle")).toBeGreaterThan(0);
    expect(powerOn("car-gt")).toBe(0);
    expect(powerOn("car-hatch")).toBe(0);
  });
});

describe("nitro", () => {
  it("is a gauge: a third by default, thirds for career charges, any fill when asked", () => {
    expect(car.init(players(1), { randomSeed: "n" }).vehicles.p1!.nitro).toBeCloseTo(1 / 3);
    expect(car.init(players(1), { randomSeed: "n", nitroCharges: 3 }).vehicles.p1!.nitro).toBeCloseTo(1);
    expect(car.init(players(1), { randomSeed: "n", nitroCharges: 3, nitroStart: 0.5 }).vehicles.p1!.nitro).toBe(0.5);
    expect(car.init(players(1), { randomSeed: "n", nitroCharges: 2 }).vehicles.p1!.nitroCharges).toBe(2);
  });

  it("latches a tap that is released before the next tick", () => {
    const events: RacingEvent[] = [];
    let state = launched(started(car, 1, { nitroStart: 1 }));
    state = car.applyAction(state, inputAction("p1", { throttle: 1, nitro: true })).state;
    state = car.applyAction(state, inputAction("p1", { throttle: 1, nitro: false })).state;
    state = run(car, state, 10, events);
    expect(count(events, "NITRO_START")).toBe(1);
    expect(state.vehicles.p1!.nitroActive).toBe(true);
    expect(state.vehicles.p1!.nitro).toBeLessThan(1);
  });

  it("latches by sequence number for clients that send one", () => {
    const events: RacingEvent[] = [];
    let state = launched(started(car, 1, { nitroStart: 1 }));
    state = car.applyAction(state, inputAction("p1", { throttle: 1, nitroSeq: 1 })).state;
    state = car.applyAction(state, inputAction("p1", { throttle: 1, nitroSeq: 1 })).state;
    state = run(car, state, 5, events);
    expect(count(events, "NITRO_START")).toBe(1);
    // The same sequence again is not a new press.
    state = run(car, state, 60, events);
    state = car.applyAction(state, inputAction("p1", { throttle: 1, nitroSeq: 1 })).state;
    run(car, state, 5, events);
    expect(count(events, "NITRO_START")).toBe(1);
  });

  it("goes faster on nitro than without it, and stops when the gauge is empty", () => {
    const base = launched(started(car, 1, { trackLength: 3000, nitroStart: 0.25 }));
    const clean = withVehicle({ ...base, track: straightTrack(base.track) }, "p1", { speed: 30, gear: 3 });
    const plain = drive(car, clean, "p1", { throttle: 1 }, 120);
    const boosted = drive(car, clean, "p1", { throttle: 1, nitro: true }, 120);
    expect(boosted.vehicles.p1!.speed).toBeGreaterThan(plain.vehicles.p1!.speed);
    const later = drive(car, boosted, "p1", { throttle: 1, nitro: true }, 120);
    expect(later.vehicles.p1!.nitro).toBe(0);
    expect(later.vehicles.p1!.nitroActive).toBe(false);
  });

  it("fills from the slipstream", () => {
    const base = launched(started(car, 2, { trackLength: 2000, nitroStart: 0 }));
    let state: RacingGameState = { ...base, track: straightTrack(base.track) };
    state = onLap(state, "p1", 1, 300, { speed: 40, lateral: 0, nitro: 0 });
    state = onLap(state, "p2", 1, 310, { speed: 40, lateral: 0, nitro: 0 });
    state = car.applyAction(state, inputAction("p1", { throttle: 0.6 })).state;
    state = car.applyAction(state, inputAction("p2", { throttle: 0.6 })).state;
    state = run(car, state, 60);
    expect(state.vehicles.p1!.nitro).toBeGreaterThan(0.02);
    expect(state.vehicles.p2!.nitro).toBe(0);
  });

  it("refills a third from a nitro strip once per crossing, never past full", () => {
    const base = launched(started(car, 1, { nitroStart: 0 }));
    const strip = { kind: "nitro" as const, distance: 0, lateral: 0, halfWidth: 2, length: 5000 };
    const state = withVehicle({ ...base, track: { ...straightTrack(base.track), zones: [strip] } }, "p1", { distance: 100, speed: 5 });
    const parked = drive(car, state, "p1", { throttle: 0 }, TICK_RATE * 5);
    expect(parked.vehicles.p1!.nitro).toBeCloseTo(1 / 3);
  });
});

// ---------------------------------------------------------------- race rules

describe("race rules", () => {
  it("finishes, names a winner, and times every lap and sector", () => {
    const events: RacingEvent[] = [];
    let state = car.init(players(1), { randomSeed: "laps", trackLength: 900, laps: 3 });
    state = raceToEnd(car, state, TICK_RATE * 900, events);
    const me = state.vehicles.p1!;
    expect(state.isFinished).toBe(true);
    expect(state.winnerId).toBe("p1");
    expect(me.place).toBe(1);
    expect(me.lapTicks).toHaveLength(3);
    expect(me.bestLapTicks).toBe(Math.min(...me.lapTicks));
    expect(count(events, "LAP_COMPLETED")).toBe(3);
    expect(count(events, "SECTOR")).toBe(9);
    // Three splits that add up to the lap.
    expect(me.lastSectorTicks).toHaveLength(3);
    expect(me.lastSectorTicks.reduce((a, b) => a + b, 0)).toBe(me.lapTicks[2]);
    expect(me.bestSectorTicks.every((b) => b !== null && b > 0)).toBe(true);
    // The final lap is announced once, when the last lap begins.
    const finalLap = events.filter((e) => e.type === "FINAL_LAP");
    expect(finalLap).toHaveLength(1);
    const secondLap = events.findIndex((e) => e.type === "LAP_COMPLETED" && e.value === 2);
    expect(events.indexOf(finalLap[0]!)).toBeGreaterThan(secondLap);
  });

  it("does not end a three-lap race after one lap", () => {
    let state = car.init(players(1), { randomSeed: "one-lap", trackLength: 800, laps: 3 });
    for (let i = 0; i < 200 && state.vehicles.p1!.lapsDone < 1; i++) state = raceToEnd(car, state, 60);
    expect(state.vehicles.p1!.lapsDone).toBe(1);
    expect(state.isFinished).toBe(false);
  });

  it("resets checkpoint progress each lap", () => {
    let state = car.init(players(1), { randomSeed: "cp", trackLength: 800, laps: 3 });
    let previous = 0;
    let sawReset = false;
    for (let i = 0; i < 400 && !sawReset && !state.isFinished; i++) {
      state = raceToEnd(car, state, 20);
      const now = state.vehicles.p1!.checkpoint;
      if (previous > 0 && now < previous) sawReset = true;
      previous = now;
    }
    expect(sawReset).toBe(true);
  });

  it("announces position changes as they happen", () => {
    const events: RacingEvent[] = [];
    const base = launched(started(car, 2, { trackLength: 2000 }));
    let state: RacingGameState = { ...base, track: straightTrack(base.track), raceOrder: ["p2", "p1"] };
    state = onLap(state, "p1", 1, 290, { speed: 50, lateral: -0.5, position: 2 });
    state = onLap(state, "p2", 1, 300, { speed: 20, lateral: 0.5, position: 1 });
    state = car.applyAction(state, inputAction("p1", { throttle: 1 })).state;
    state = run(car, state, 60, events);
    expect(state.raceOrder).toEqual(["p1", "p2"]);
    expect(events.find((e) => e.type === "POSITION_CHANGED" && e.playerId === "p1")).toMatchObject({ value: 1, from: 2 });
    expect(events.find((e) => e.type === "POSITION_CHANGED" && e.playerId === "p2")).toMatchObject({ value: 2, from: 1 });
    expect(count(events, "POSITION_CHANGED")).toBe(2);
  });

  it("warns a car going the wrong way, and clears it when it turns round", () => {
    const events: RacingEvent[] = [];
    const base = launched(started(car, 1, { trackLength: 2000 }));
    let state = withVehicle({ ...base, track: straightTrack(base.track) }, "p1", { distance: 500, speed: 10, heading: Math.PI - 0.01, slip: 0 });
    state = drive(car, state, "p1", { throttle: 0.3 }, 60, events);
    expect(state.vehicles.p1!.wrongWay).toBe(true);
    expect(events.find((e) => e.type === "WRONG_WAY")?.value).toBe(1);
    state = withVehicle(state, "p1", { heading: 0, slip: 0 });
    state = drive(car, state, "p1", { throttle: 0.3 }, 5, events);
    expect(state.vehicles.p1!.wrongWay).toBe(false);
    expect(events.filter((e) => e.type === "WRONG_WAY").map((e) => e.value)).toEqual([1, 0]);
  });

  it("closes the race 45 s after the winner crosses, and places everyone", () => {
    const base = launched(started(car, 3, { trackLength: 1500, laps: 1 }));
    const L = base.track.length;
    let state = onLap(base, "p1", 0, L - 3, { speed: 30, lateral: 0 });
    state = onLap(state, "p2", 0, 400, { speed: 0, lateral: 0.6 });
    state = onLap(state, "p3", 0, 300, { speed: 0, lateral: -0.6 });
    state = run(car, state, 10);
    expect(state.vehicles.p1!.finishedAtTick).not.toBeNull();
    expect(state.closingTick).toBe(state.vehicles.p1!.finishedAtTick! + TICK_RATE * 45);
    expect(car.getPlayerView(state, "p2").closingTick).toBe(state.closingTick);
    state = run(car, state, TICK_RATE * 46);
    expect(state.isFinished).toBe(true);
    expect(Object.values(state.vehicles).map((v) => v.place).sort()).toEqual([1, 2, 3]);
    expect(state.vehicles.p2!.place).toBe(2);
  });

  it("ends as soon as every human is home, without waiting for the bots", () => {
    const humans = [...players(1), ...players(3, true).slice(1)];
    const base = car.init(humans, { randomSeed: "decisive", trackLength: 1500, laps: 1 });
    expect(base.decisive).toEqual(["p1"]);
    let state = base;
    while (state.racingPhase === "countdown") state = run(car, state, 10);
    state = onLap(launched(state), "p1", 0, state.track.length - 3, { speed: 30, lateral: 0 });
    state = run(car, state, 10);
    expect(state.isFinished).toBe(true);
    expect(state.winnerId).toBe("p1");
  });

  it("sizes the default time limit to the race", () => {
    const short = car.init(players(1), { randomSeed: "t", trackLength: 900, laps: 2 });
    const long = car.init(players(1), { randomSeed: "t", trackLength: 3000, laps: 5 });
    expect((short.hardStopTick - short.start.lightsOutTick) / TICK_RATE).toBeGreaterThanOrEqual(240);
    expect((long.hardStopTick - long.start.lightsOutTick) / TICK_RATE).toBeGreaterThan((5 * 3000) / 14);
  });

  it("stops at an explicit time limit even if nobody finishes", () => {
    let state = car.init(players(1), { randomSeed: "timeout", trackLength: 50_000, timeLimitSeconds: 30 });
    for (let i = 0; i < TICK_RATE * 40 && !state.isFinished; i += 20) state = car.applyAction(state, tickAction(20)).state;
    expect(state.isFinished).toBe(true);
    expect(state.vehicles.p1!.place).toBe(1);
  });

  it("gives every car a distinct place in a full race", () => {
    let state = car.init(players(4), { randomSeed: "places", trackLength: 900, laps: 1 });
    state = raceToEnd(car, state);
    expect(state.isFinished).toBe(true);
    expect(Object.values(state.vehicles).map((v) => v.place).sort()).toEqual([1, 2, 3, 4]);
  });

  it("collects a coin only once, even with two cars on the same line", () => {
    let state = car.init(players(2), { randomSeed: "coins-once", trackLength: 2000, laps: 1 });
    state = raceToEnd(car, state, TICK_RATE * 60);
    expect(state.vehicles.p1!.coins + state.vehicles.p2!.coins).toBe(state.collectedCoins.length);
  });

  it("reports a view with the race-level start state and every car's driving state", () => {
    const state = started(car, 3);
    const view = car.getPlayerView(state, "p2");
    expect(view.me?.playerId).toBe("p2");
    expect(view.vehicles).toHaveLength(3);
    expect(view.standings).toHaveLength(3);
    expect(view.trackSeed).toBe(state.track.seed);
    expect(buildTrack(view.trackSeed, view.trackLength)).toEqual(state.track);
    const me = view.me!;
    for (const key of [
      "heading",
      "steerAngle",
      "slip",
      "drifting",
      "miniTurbo",
      "rpm",
      "rpmMax",
      "gear",
      "throttle",
      "brake",
      "nitro",
      "offRoad",
      "modelId",
      "paint",
    ] as const) {
      expect(me[key], key).toBeDefined();
    }
    // The track geometry never rides along.
    expect(JSON.stringify(view)).not.toContain('"points"');
  });
});

describe("determinism", () => {
  function scripted(variant: number): RacingGameState {
    let state = car.init(players(3), {
      randomSeed: "replay",
      trackLength: 1200,
      laps: 3,
      vehicles: { p1: "car-gt", p2: "car-muscle", p3: "car-formula" },
    });
    for (let step = 0; step < TICK_RATE * 400 && !state.isFinished; step += 3) {
      if (state.racingPhase === "racing") {
        for (const id of state.playerOrder) {
          if (state.vehicles[id]!.finishedAtTick !== null) continue;
          const input = competent(car, state, id);
          // Something beyond a steady driver: taps of nitro and the odd handbrake.
          if (id === "p1" && step % 600 === 0) input.nitroSeq = step / 600;
          if (id === "p2" && step % 900 < 15) input.handbrake = true;
          if (variant === 1 && id === "p3" && step === 1500) input.steer = (input.steer ?? 0) + 0.05;
          state = car.applyAction(state, inputAction(id, input)).state;
        }
      }
      state = car.applyAction(state, tickAction(3)).state;
    }
    return state;
  }

  it("replays three laps to the same state hash from the same seed and inputs", () => {
    const a = scripted(0);
    const b = scripted(0);
    expect(a.isFinished).toBe(true);
    expect(Object.values(a.vehicles).every((v) => v.lapsDone >= 3 || v.place !== null)).toBe(true);
    expect(hashRacingState(a)).toBe(hashRacingState(b));
    expect(a).toEqual(b);
  });

  it("produces a different hash when an input differs", () => {
    expect(hashRacingState(scripted(0))).not.toBe(hashRacingState(scripted(1)));
  });

  it("uses trigonometry that agrees with the platform's to ~1e-10", () => {
    for (let x = -12; x <= 12; x += 0.0137) {
      expect(Math.abs(dsin(x) - Math.sin(x))).toBeLessThan(1e-10);
      expect(Math.abs(dcos(x) - Math.cos(x))).toBeLessThan(1e-10);
      if (Math.abs(Math.cos(x)) > 0.05) expect(Math.abs(dtan(x) - Math.tan(x))).toBeLessThan(1e-8);
    }
    for (let y = -3; y <= 3; y += 0.173) {
      for (let x = -3; x <= 3; x += 0.191) {
        expect(Math.abs(datan2(y, x) - Math.atan2(y, x))).toBeLessThan(1e-10);
      }
    }
  });
});

// ---------------------------------------------------------------- roster

describe("the roster", () => {
  const MODELS: CarModelId[] = ["gt", "supercar", "hatch", "muscle", "rally", "formula"];

  it("is the six cars, each with its own model", () => {
    expect(CARS.map((c) => [c.id, c.name, c.modelId])).toEqual([
      ["car-gt", "Vanta GT", "gt"],
      ["car-super", "Halcyon V12", "supercar"],
      ["car-hatch", "Kestrel RS", "hatch"],
      ["car-muscle", "Brute 5.0", "muscle"],
      ["car-rally", "Talon R4", "rally"],
      ["car-formula", "Apex FR", "formula"],
    ]);
    expect(new Set(CARS.map((c) => c.modelId))).toEqual(new Set(MODELS));
    for (const c of CARS) {
      expect(c.kind).toBe("car");
      expect(c.className.length).toBeGreaterThan(3);
      expect(isValidPaint(c.defaultPaint)).toBe(true);
      expect(c.colour).toBe(parseInt(c.defaultPaint.slice(1), 16));
    }
  });

  it("keeps the bikes, with their ids and models", () => {
    expect(BIKES.map((b) => b.id)).toEqual(["bike-balanced", "bike-speed", "bike-agile", "bike-tough"]);
    for (const b of BIKES) {
      expect(b.kind).toBe("bike");
      expect(b.modelId.startsWith("bike-")).toBe(true);
    }
  });

  it("quotes spec-sheet figures the physics actually delivers", () => {
    for (const spec of [...CARS, ...BIKES]) {
      const t = car.vehicleTuningFor(spec.id).kind === spec.kind ? car.vehicleTuningFor(spec.id) : bike.vehicleTuningFor(spec.id);
      expect(spec.specs.topSpeedKmh).toBeCloseTo(t.maxSpeed * 3.6, 6);
      expect(spec.specs.zeroTo100S).toBeCloseTo(simulateZeroTo100(t), 1);
      expect(spec.specs.massKg).toBe(t.mass);
      expect(spec.specs.wheelbaseM).toBe(t.wheelbase);
      expect(spec.specs.powerKw * 1000).toBeCloseTo(t.powerW, 3);
    }
  });

  it("has believable class figures", () => {
    for (const c of CARS) {
      const s = c.specs;
      expect(s.zeroTo100S, c.id).toBeGreaterThan(2.4);
      expect(s.zeroTo100S, c.id).toBeLessThan(5.5);
      expect(s.topSpeedKmh, c.id).toBeGreaterThan(200);
      expect(s.topSpeedKmh, c.id).toBeLessThan(360);
      expect(s.massKg / s.powerKw, c.id).toBeGreaterThan(2.5);
      expect(s.massKg / s.powerKw, c.id).toBeLessThan(6);
      if (c.modelId !== "formula") {
        // Road cars: wheelbase 54-63% of length.
        expect(s.wheelbaseM / s.lengthM, c.id).toBeGreaterThan(0.53);
        expect(s.wheelbaseM / s.lengthM, c.id).toBeLessThan(0.64);
      }
    }
  });

  it("derives the bars from the physics, and every car is best at something", () => {
    const by = (id: string) => vehicleById("car-race", id).stats;
    const best = (key: keyof VehicleSpec["stats"]) =>
      [...CARS].sort((a, b) => b.stats[key] - a.stats[key])[0]!.id;
    expect(best("speed")).toBe("car-super");
    expect(best("acceleration")).toBe("car-hatch");
    expect(best("handling")).toBe("car-formula");
    expect(best("braking")).toBe("car-formula");
    expect(by("car-muscle").handling).toBe(Math.min(...CARS.map((c) => c.stats.handling)));
    for (const c of [...CARS, ...BIKES]) {
      expect(vehicleStats(c)).toBe(c.stats);
      for (const [name, value] of Object.entries(c.stats)) {
        expect(value, `${c.id} ${name}`).toBeGreaterThanOrEqual(1);
        expect(value, `${c.id} ${name}`).toBeLessThanOrEqual(10);
      }
    }
    expect(new Set(CARS.map((c) => JSON.stringify(c.stats))).size).toBe(CARS.length);
    // Agility and grip are not the same thing: a hatchback answers the wheel quicker than a GT.
    expect(car.vehicleTuningFor("car-hatch").turnIn).toBeLessThan(car.vehicleTuningFor("car-gt").turnIn);
    expect(lateralG(car.vehicleTuningFor("car-formula"), 50)).toBeGreaterThan(lateralG(car.vehicleTuningFor("car-super"), 50));
  });

  it("translates legacy ids and falls back to the default for anything unknown", () => {
    expect(resolveVehicleId("car-race", "car-balanced")).toBe("car-gt");
    expect(resolveVehicleId("car-race", "car-speed")).toBe("car-super");
    expect(resolveVehicleId("car-race", "car-sprint")).toBe("car-hatch");
    expect(resolveVehicleId("car-race", "car-grip")).toBe("car-formula");
    expect(resolveVehicleId("car-race", "car-rally")).toBe("car-rally");
    expect(resolveVehicleId("car-race", "nonsense")).toBe("car-gt");
    expect(resolveVehicleId("car-race", null)).toBe("car-gt");
    expect(resolveVehicleId("car-race", "bike-speed")).toBe("car-gt");
    expect(resolveVehicleId("bike-race", "bike-speed")).toBe("bike-speed");
    expect(resolveVehicleId("bike-race", "car-gt")).toBe("bike-balanced");
    expect(vehicleById("car-race", "car-grip").id).toBe("car-formula");
  });

  it("offers real-world paints, every one a valid colour with a finish", () => {
    expect(PAINTS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(PAINTS.map((p) => p.id)).size).toBe(PAINTS.length);
    for (const p of PAINTS) {
      expect(isValidPaint(p.hex), p.id).toBe(true);
      expect(["solid", "metallic", "pearl", "matte"]).toContain(p.finish);
      expect(paintFinishOf(p.hex)).toBe(p.finish);
    }
    expect(paintFinishOf("#123456")).toBe("metallic");
  });

  it("accepts a player's paint only if it is a colour", () => {
    expect(resolvePaint("car-race", "car-gt", "#ABCDEF")).toBe("#abcdef");
    expect(resolvePaint("car-race", "car-gt", "red")).toBe(vehicleById("car-race", "car-gt").defaultPaint);
    expect(resolvePaint("car-race", "car-gt", "#abc")).toBe(vehicleById("car-race", "car-gt").defaultPaint);
    expect(resolvePaint("car-race", "car-gt", { hex: "#abcdef" })).toBe(vehicleById("car-race", "car-gt").defaultPaint);
  });

  it("seats each player in the car and paint they chose, legacy ids included", () => {
    const state = car.init(players(3), {
      randomSeed: "seats",
      vehicles: { p1: "car-grip", p2: "car-muscle", p3: "bike-speed" },
      paints: { p1: "#00FF00", p2: "javascript:alert(1)" },
    });
    expect(state.vehicles.p1).toMatchObject({ vehicleId: "car-formula", modelId: "formula", paint: "#00ff00" });
    expect(state.vehicles.p2).toMatchObject({ vehicleId: "car-muscle", modelId: "muscle", paint: "#0f3d2e" });
    expect(state.vehicles.p3).toMatchObject({ vehicleId: "car-gt", modelId: "gt" });
    expect(state.vehicles.p1!.rpmMax).toBe(car.vehicleTuningFor("car-formula").redlineRpm);
  });

  it("makes the supercar the fastest in a straight line and the single-seater the fastest round a corner", () => {
    const vmax = (id: string) => car.vehicleTuningFor(id).maxSpeed;
    expect(Math.max(...CARS.map((c) => vmax(c.id)))).toBe(vmax("car-super"));
    const corner = (id: string) => cornerSpeedFor(1 / 60, cornerGripOf(car.vehicleTuningFor(id)), vmax(id));
    expect(Math.max(...CARS.map((c) => corner(c.id)))).toBe(corner("car-formula"));
  });
});

describe("bikes still race", () => {
  it("runs a full bike race with every value in range", () => {
    let state = bike.init(players(2), { randomSeed: "bike-race", trackLength: 1200, laps: 2 });
    const events: RacingEvent[] = [];
    for (let i = 0; i < 400 && !state.isFinished; i++) {
      state = raceToEnd(bike, state, 30, events);
      for (const v of Object.values(state.vehicles)) {
        expect(Math.abs(v.lateral)).toBeLessThan(RUN_OFF_LIMIT);
        expect(Math.abs(v.lean)).toBeLessThanOrEqual(1.2);
        expect(Number.isFinite(v.speed)).toBe(true);
        expect(v.speed).toBeGreaterThanOrEqual(0);
      }
    }
    expect(state.isFinished).toBe(true);
    expect(state.vehicles.p1!.vehicleId.startsWith("bike-")).toBe(true);
  });

  it("leans a bike into a corner, much further than a car rolls", () => {
    const lean = (engine: RacingEngine) => {
      const base = launched(started(engine, 1, { trackLength: 2000 }));
      let state = withVehicle({ ...base, track: straightTrack(base.track) }, "p1", { speed: 25, gear: 3 });
      state = drive(engine, state, "p1", { steer: 0.6, throttle: 0.4 }, 40);
      return state.vehicles.p1!.lean;
    };
    expect(lean(bike)).toBeGreaterThan(0.5);
    expect(lean(bike)).toBeGreaterThan(lean(car));
  });

  it("is narrower and more fragile than a car", () => {
    const b = bike.vehicleTuning();
    const c = car.vehicleTuning();
    expect(b.halfWidth).toBeLessThan(c.halfWidth);
    expect(b.crashPenalty).toBeLessThan(c.crashPenalty);
    expect(b.crashStunTicks).toBeGreaterThan(c.crashStunTicks);
  });
});

// ---------------------------------------------------------------- racing line

describe("racing line: corner speed and braking", () => {
  const gt = car.vehicleTuningFor("car-gt");
  const GRIP = cornerGripOf(gt);
  const MAX = gt.maxSpeed;
  const BRAKE = gt.brakePower;

  it("puts no limit on a straight and a lower one on a tighter corner", () => {
    expect(cornerSpeedFor(0, GRIP, MAX)).toBe(MAX);
    const wide = cornerSpeedFor(1 / 60, GRIP, MAX);
    const tight = cornerSpeedFor(1 / 25, GRIP, MAX);
    expect(tight).toBeLessThan(wide);
    expect(wide).toBeLessThan(MAX);
  });

  it("matches the friction circle the engine enforces: v^2 k = mu (g + d v^2)", () => {
    const k = 1 / 40;
    const v = cornerSpeedFor(k, GRIP, MAX);
    expect(v * v * k).toBeCloseTo(GRIP.mu * (9.81 + GRIP.liftPerMass * v * v), 6);
  });

  it("lets downforce run away to flat out when the wings out-grow the corner", () => {
    const formula = cornerGripOf(car.vehicleTuningFor("car-formula"));
    expect(cornerSpeedFor(1 / 2000, formula, 70)).toBe(70);
  });

  it("computes braking distance from the kinematics, and none when already slow", () => {
    expect(brakingDistance(30, 40, BRAKE)).toBe(0);
    expect(brakingDistance(78, 43, 20)).toBeCloseTo((78 * 78 - 43 * 43) / 40, 6);
    expect(brakingDistance(78, 40, 20)).toBeGreaterThan(brakingDistance(60, 40, 20));
  });

  const track = buildTrack("plan-seed", 2000);
  const plan = (distance: number, speed: number, margin = 0.25) =>
    planCorner({ track, distance, speed, maxSpeed: MAX, grip: GRIP, brakingPower: BRAKE, lookahead: 250, margin });

  it("holds full throttle when nothing needs slowing for", () => {
    const slow = plan(0, 8);
    expect(slow.brake).toBe(0);
    expect(slow.throttle).toBe(1);
  });

  it("brakes before a hairpin, not at it", () => {
    const hairpinAt = 600;
    const withHairpin: TrackSpec = {
      ...track,
      segments: track.segments.map((s, i) => (Math.abs(i * 10 - hairpinAt) < 20 ? { ...s, curvature: 1 / 22 } : { ...s, curvature: 0 })),
    };
    const farOut = planCorner({
      track: withHairpin,
      distance: hairpinAt - 150,
      speed: 70,
      maxSpeed: MAX,
      grip: GRIP,
      brakingPower: BRAKE,
      lookahead: 250,
    });
    expect(farOut.brake).toBeGreaterThan(0);
    expect(farOut.distanceToCorner).toBeGreaterThan(20);
    expect(farOut.targetSpeed).toBeLessThan(MAX);
  });

  it("never brakes and throttles at the same time, and a cautious margin brakes no later", () => {
    for (let d = 0; d < track.length; d += 13) {
      for (const speed of [10, 40, 70]) {
        const p = plan(d, speed);
        expect(p.brake > 0 && p.throttle > 0, `d=${d} v=${speed}`).toBe(false);
        expect(plan(d, speed, 0.6).brake).toBeGreaterThanOrEqual(plan(d, speed, 0.05).brake);
      }
    }
  });

  it("steers onto a line rather than weaving about it", () => {
    const base = launched(started(car, 1, { trackLength: 3000 }));
    let state = withVehicle({ ...base, track: straightTrack(base.track) }, "p1", { speed: 30, gear: 3, lateral: 0 });
    const t = car.vehicleTuningFor("car-gt");
    for (let i = 0; i < TICK_RATE * 4; i++) {
      state = drive(car, state, "p1", { steer: steerToward(t, state.vehicles.p1!, state.track, 0.5), throttle: 0.3 }, 1);
    }
    expect(state.vehicles.p1!.lateral).toBeCloseTo(0.5, 1);
    expect(Math.abs(state.vehicles.p1!.heading)).toBeLessThan(0.03);
  });
});

// ---------------------------------------------------------------- world space

describe("track to world space", () => {
  const track = buildTrack("world", 800);
  const line = trackCenterline(track, 10);
  const at = (distance: number, lateral: number) => trackToWorld(line, distance, lateral, 8, 10)!;

  it("puts the centreline where the centreline is", () => {
    const point = at(0, 0);
    expect(point.x).toBeCloseTo(line[0]!.x, 5);
    expect(point.z).toBeCloseTo(line[0]!.z, 5);
  });

  it("maps a positive lateral offset to the driver's right, at any heading", () => {
    for (const distance of [0, 137, 421, 705]) {
      const centre = at(distance, 0);
      const right = at(distance, 1);
      const forward = { x: Math.sin(centre.heading), z: Math.cos(centre.heading) };
      const offset = { x: right.x - centre.x, z: right.z - centre.z };
      expect(forward.x * offset.z - forward.z * offset.x, `wrong side at ${distance}m`).toBeGreaterThan(0);
    }
  });

  it("offsets by exactly the road half-width at the edge", () => {
    const centre = at(0, 0);
    const edge = at(0, 1);
    expect(Math.hypot(edge.x - centre.x, edge.z - centre.z)).toBeCloseTo(8, 5);
  });

  it("wraps around the loop rather than clamping", () => {
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

// ---------------------------------------------------------------- career

describe("the racing career ladder", () => {
  const ladders = [CAR_LEVELS, BIKE_LEVELS];

  it("gets harder on every axis, never easier", () => {
    for (const levels of ladders) {
      for (let i = 1; i < levels.length; i++) {
        const previous = levels[i - 1]!;
        const level = levels[i]!;
        expect(level.trackLength * level.laps).toBeGreaterThan(previous.trackLength * previous.laps);
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
        expect(level.targetPlace).toBeLessThanOrEqual(level.opponents + 1);
      });
    }
  });

  it("picks the ladder for the game", () => {
    const ids: GameId[] = ["car-race", "bike-race"];
    expect(ids.map(levelsFor)).toEqual([CAR_LEVELS, BIKE_LEVELS]);
  });

  it("awards stars by finishing position", () => {
    const level = CAR_LEVELS[2]!;
    expect(starsFor(level, 1)).toBe(3);
    expect(starsFor(level, 2)).toBe(2);
    expect(starsFor(level, 3)).toBe(0);
    expect(isPass(level, 2)).toBe(true);
    expect(isPass(level, 3)).toBe(false);
    expect(isPass(level, 0)).toBe(false);
  });

  it("unlocks a level only once the one before it is passed", () => {
    expect(unlockedLevels(CAR_LEVELS, {})).toEqual(CAR_LEVELS.map((_, i) => i === 0));
    expect(unlockedLevels(CAR_LEVELS, { 1: 1 })[1]).toBe(true);
    expect(unlockedLevels(CAR_LEVELS, { 1: 2 })[1]).toBe(false);
    const gap = unlockedLevels(CAR_LEVELS, { 1: 1, 5: 1 });
    expect(gap[2]).toBe(false);
    expect(gap[5]).toBe(true);
    const all = Object.fromEntries(CAR_LEVELS.map((l) => [l.index, 1]));
    expect(unlockedLevels(CAR_LEVELS, all).every(Boolean)).toBe(true);
  });
});
