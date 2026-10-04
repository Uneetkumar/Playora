import type { GameId, Player } from "@playora/game-types";
import { AbstractGameEngine } from "../engine.js";
import type { ActionResult, ActionValidationResult } from "../types.js";
import { createRng, seedFromString } from "../lib/rng.js";
import { clamp, datan, datan2, dcos, dsin, wrapAngle } from "./dmath.js";
import {
  buildTrack,
  crossedOnLap,
  distanceAhead,
  lapDelta,
  sampleTrack,
  withinOnLap,
  wrapDistance,
} from "./track.js";
import { resolvePaint, vehicleById, vehiclesFor } from "./garage.js";
import { steerToward } from "./racing-line.js";
import {
  GRAVITY,
  deriveTuning,
  engineTorque,
  maxSteerTan,
  overallRatio,
  tractionLimit,
  wheelRpm,
  type VehicleTuning,
} from "./vehicle-physics.js";
import {
  COUNTDOWN_TICKS,
  GOOD_LAUNCH_TICKS,
  LIGHTS_FULL_TICK,
  NEUTRAL_INPUT,
  PERFECT_LAUNCH_TICKS,
  ROAD_HALF_WIDTH,
  SECTOR_COUNT,
  SERVER_PLAYER_ID,
  START_HOLD_MAX_TICKS,
  START_HOLD_MIN_TICKS,
  START_LIGHT_COUNT,
  START_LIGHT_INTERVAL_TICKS,
  START_SETTLE_TICKS,
  TICK_RATE,
  TICK_SECONDS,
  type PickupKind,
  type RacingAction,
  type RacingConfig,
  type RacingEvent,
  type RacingGameState,
  type RacingPlayerView,
  type RacingResult,
  type RacingStanding,
  type SetInputPayload,
  type TickPayload,
  type TrackSpec,
  type VehicleControls,
  type VehicleState,
  type ZoneKind,
} from "./types.js";

export type { VehicleTuning } from "./vehicle-physics.js";

const MAX_TICKS_PER_ACTION = 20;

/** Steering rack: fraction of full lock per second. Fast, but not instant. */
const STEER_RACK_RATE = 6;

/** Nitro: a full gauge burns in four seconds for +45% power. */
const NITRO_BURN_PER_SECOND = 0.25;
const NITRO_POWER = 0.45;
/** A press burns at least this long, so a tap is a usable squirt. */
const NITRO_MIN_TICKS = 40;
const NITRO_PER_CHARGE = 1 / 3;
/** Gauge earned per second at full slipstream / full drift, and per near miss. */
const DRAFT_FILL_PER_SECOND = 0.05;
const DRIFT_FILL_PER_SECOND = 0.07;
const NEAR_MISS_FILL = 0.06;

/** Slipstream: drag falls by up to a third within this window behind a car. */
const DRAFT_MAX_GAP = 30;
const DRAFT_DRAG_CUT = 0.35;

/** Mini-turbo tiers: charge (seconds of good drift) needed, boost ticks and power. */
const MINI_TURBO_CHARGE = [0, 0.9, 1.9, 3.0];
const MINI_TURBO_TICKS = [0, 45, 75, 110];
const MINI_TURBO_POWER = [0, 0.3, 0.45, 0.6];
/** How fast a drift settles to the slip angle the driver is asking for, per second. */
const DRIFT_RESPONSE = 3.2;
/** Beyond this slip angle the car has gone round. */
const SPIN_SLIP = 1.35;

/** Jump start: creeping this far before lights out is a false start. */
const JUMP_START_METRES = 0.3;
const PENALTY_TICKS = TICK_RATE * 3;
/** The "pit limiter" a jump start earns, m/s (60 km/h). */
const PENALTY_SPEED = 60 / 3.6;

/** Positions only swap when the gap is real, so side-by-side cars do not flicker. */
const POSITION_HYSTERESIS = 0.4;

/**
 * Half a vehicle's width, in lateral units (where 1 is the road edge), for
 * callers without a tuning. Cars are ~1.9 m wide on an 8 m half-width.
 */
const VEHICLE_HALF_WIDTH_LATERAL = 0.12;
/**
 * How far past the road edge the barrier sits.
 *
 * The gap between 1 (the painted line) and this is run-off: usable, but it
 * costs you.
 */
export const RUN_OFF_LIMIT = 1.35;

/** Ticks off-track that cost only grip — about three quarters of a second. */
const OFF_TRACK_GRACE_TICKS = 45;
/** Ticks after which the penalty escalates — about two seconds. */
const OFF_TRACK_PENALTY_TICKS = 120;

/** Finishing positions that decide a race. */
const PODIUM_PLACES = 3;

/** How long a coin magnet lasts, in ticks. */
const MAGNET_TICKS = TICK_RATE * 6;
/** Lateral reach while a magnet is active, against 0.28 without one. */
const MAGNET_REACH = 0.85;

/** Grid: pole sits this far behind the line, each slot this far behind the last. */
const GRID_POLE = 10;
const GRID_SLOT = 7;

/** What the vehicles share within one tick. */
interface TickContext {
  /** Slipstream strength per vehicle, from where everyone was at the start of the tick. */
  draft: Map<string, number>;
  /** Coins gone, shared so two cars on the same line cannot both take one. */
  coins: Set<string>;
  /** Boxes opened, keyed by lap. */
  pickups: Set<string>;
}

/**
 * Server-authoritative racing.
 *
 * Racing does not fit the turn-based shape of the other games, and the way it
 * is made to fit is the whole design: a client may only ever send SET_INPUT,
 * which records an intent. Time advances solely through TICK, and TICK is
 * rejected unless it comes from the server itself. So a client can say "I am
 * holding right"; it can never say where it is, how fast it is going, or that
 * it has finished.
 *
 * Everything below runs at a fixed timestep, reads no clock and uses no
 * ambient randomness — the trigonometry included (dmath) — so the same inputs
 * replay to the same result on the server, on every client and in a replay.
 *
 * The model, per vehicle, in track space (distance s along the centreline,
 * offset n across it, heading psi and slip beta relative to the tangent):
 *
 *   s' = v cos(psi - beta) / (1 - n k)      n' = v sin(psi - beta)
 *   course' = a_lat / v - k s'              (a_lat from the bicycle model,
 *                                            capped by the friction circle)
 *
 * with the friction circle mu (g cos theta + downforce) shared between
 * cornering, braking and drive, a real gearbox and torque curve behind the
 * drive, gradient as g sin theta, and a drift state for when the rear lets go.
 */
export abstract class RacingEngine extends AbstractGameEngine<
  RacingGameState,
  RacingAction,
  RacingResult,
  RacingConfig,
  RacingEvent,
  RacingPlayerView
> {
  abstract override readonly gameId: GameId;
  readonly minPlayers: number = 1;
  readonly maxPlayers: number = 8;

  /**
   * Tuning for one vehicle, derived from its garage spec sheet.
   *
   * Cached because this is asked for every vehicle on every tick — sixty times
   * a second times eight cars — and it is a pure function of an id.
   */
  private tuningCache = new Map<string, VehicleTuning>();

  vehicleTuningFor(vehicleId: string | null | undefined): VehicleTuning {
    const spec = vehicleById(this.gameId, vehicleId);
    const cached = this.tuningCache.get(spec.id);
    if (cached) return cached;
    const tuned = deriveTuning(spec.id, spec.physics);
    this.tuningCache.set(spec.id, tuned);
    return tuned;
  }

  /** The default vehicle's tuning, for callers that do not know the car. */
  vehicleTuning(): VehicleTuning {
    return this.vehicleTuningFor(vehiclesFor(this.gameId)[0]!.id);
  }

  /** Metres, when the config does not say. */
  protected defaultTrackLength(): number {
    return 3000;
  }

  /** Laps in a race, when the config does not say. */
  protected defaultLaps(): number {
    return 3;
  }

  init(players: Player[], config: RacingConfig = {}): RacingGameState {
    const length = Math.max(500, config.trackLength ?? this.defaultTrackLength());
    const laps = clamp(Math.round(config.laps ?? this.defaultLaps()), 1, 50);
    const order = players.map((p) => p.userId);
    /*
     * The seed. The server always passes a secret one; without it the race is
     * keyed to the session (or the field), never to the clock, so a state is a
     * pure function of its inputs.
     */
    const seedSource =
      config.randomSeed ??
      `${this.gameId}:${config.sessionId ?? config.roomId ?? order.join(",")}`;
    const track = buildTrack(seedSource, length);

    /*
     * The hold before lights out, from the secret seed string rather than the
     * public numeric track seed. Every client can rebuild the track; none can
     * rebuild this, so nobody can time a start they have not watched.
     */
    const holdSpan = START_HOLD_MAX_TICKS - START_HOLD_MIN_TICKS + 1;
    const hold = START_HOLD_MIN_TICKS + (seedFromString(`${seedSource}|lights`) % holdSpan);
    const lightsOutTick = LIGHTS_FULL_TICK + hold;

    const grid = gridOrder(order, config.grid, seedSource);
    const startGauge = clamp(
      config.nitroStart ?? (config.nitroCharges !== undefined ? config.nitroCharges * NITRO_PER_CHARGE : NITRO_PER_CHARGE),
      0,
      1,
    );

    const vehicles: Record<string, VehicleState> = {};
    for (const playerId of order) {
      const spec = vehicleById(this.gameId, config.vehicles?.[playerId]);
      const t = this.vehicleTuningFor(spec.id);
      const slot = grid.indexOf(playerId);
      vehicles[playerId] = {
        playerId,
        vehicleId: spec.id,
        modelId: spec.modelId,
        paint: resolvePaint(this.gameId, spec.id, config.paints?.[playerId]),
        distance: gridDistance(slot),
        lateral: gridLateral(slot),
        speed: 0,
        heading: 0,
        slip: 0,
        steerAngle: 0,
        steerApplied: 0,
        throttle: 0,
        brake: 0,
        accel: 0,
        latAccel: 0,
        lean: 0,
        tyreSlip: 0,
        drifting: false,
        driftDir: 0,
        driftCharge: 0,
        miniTurbo: 0,
        boostTicks: 0,
        boostPower: 0,
        gear: 1,
        rpm: t.idleRpm,
        rpmMax: t.redlineRpm,
        shiftTicks: 0,
        nitro: startGauge,
        nitroActive: false,
        nitroSeqUsed: 0,
        nitroMinTicks: 0,
        nitroCharges: chargesOf(startGauge),
        nitroUntilTick: 0,
        drafting: 0,
        coins: 0,
        crashTicks: 0,
        zone: null,
        shielded: false,
        magnetUntilTick: 0,
        offRoad: false,
        offTrackTicks: 0,
        wallContact: false,
        wrongWay: false,
        wrongWayTicks: 0,
        position: slot + 1,
        lapsDone: 0,
        // The latest possible lights-out, which is public; the real one is
        // stamped when it happens so a lap clock cannot leak it early.
        lapStartTick: COUNTDOWN_TICKS,
        lapTicks: [],
        bestLapTicks: null,
        sectorsDone: 0,
        sectorStartTick: COUNTDOWN_TICKS,
        sectorTicks: [],
        lastSectorTicks: [],
        bestSectorTicks: Array.from({ length: SECTOR_COUNT }, () => null),
        checkpoint: 0,
        jumpStart: false,
        penaltyTicks: 0,
        launchTicks: null,
        finishedAtTick: null,
        place: null,
        input: { ...NEUTRAL_INPUT },
        lastInputSeq: 0,
      };
    }

    const timeLimit = Math.max(30, config.timeLimitSeconds ?? 240);
    const decisive = (config.decisive ?? players.filter((p) => !p.isBot).map((p) => p.userId)).filter(
      (id) => order.includes(id),
    );

    return {
      sequenceNumber: 0,
      phase: "countdown",
      activePlayerId: null,
      turnNumber: 0,
      // The engine reads no clock; the realtime layer keeps wall time.
      startedAt: 0,
      updatedAt: 0,
      turnDeadline: null,
      isFinished: false,
      tick: 0,
      racingPhase: "countdown",
      laps,
      track,
      theme: typeof config.theme === "string" && /^[a-z0-9-]{1,32}$/.test(config.theme) ? config.theme : null,
      vehicles,
      playerOrder: order,
      gridOrder: grid,
      raceOrder: [...grid],
      decisive,
      start: { lightsOutTick, lightsOut: false },
      contacts: [],
      collectedCoins: [],
      collectedPickups: [],
      winnerId: null,
      hardStopTick: lightsOutTick + timeLimit * TICK_RATE,
    };
  }

  validateAction(state: RacingGameState, action: RacingAction): ActionValidationResult {
    if (state.isFinished) return { valid: false, reason: "This race has already finished." };

    switch (action.type) {
      case "TICK":
        // The single rule that makes the whole thing authoritative.
        if (action.playerId !== SERVER_PLAYER_ID) {
          return { valid: false, reason: "Only the server advances the race." };
        }
        return { valid: true };

      case "SET_INPUT": {
        if (!state.vehicles[action.playerId]) {
          return { valid: false, reason: "You're not in this race." };
        }
        const payload = (action.payload ?? {}) as SetInputPayload;
        if (payload.steer !== undefined && !Number.isFinite(payload.steer)) {
          return { valid: false, reason: "Invalid steering value." };
        }
        for (const pedal of [payload.throttle, payload.brake]) {
          if (pedal !== undefined && typeof pedal !== "boolean" && !Number.isFinite(pedal)) {
            return { valid: false, reason: "Invalid pedal value." };
          }
        }
        if (payload.nitroSeq !== undefined && !Number.isFinite(payload.nitroSeq)) {
          return { valid: false, reason: "Invalid nitro sequence." };
        }
        return { valid: true };
      }

      default:
        return { valid: false, reason: `Unknown action: ${(action as { type: string }).type}` };
    }
  }

  applyAction(state: RacingGameState, action: RacingAction): ActionResult<RacingGameState, RacingEvent> {
    if (action.type === "SET_INPUT") return this.setInput(state, action);
    return this.tick(state, (action.payload as TickPayload)?.ticks ?? 1);
  }

  /** Records a driver's intent. It takes effect on the next tick, not now. */
  protected setInput(
    state: RacingGameState,
    action: RacingAction,
  ): ActionResult<RacingGameState, RacingEvent> {
    const vehicle = state.vehicles[action.playerId];
    if (!vehicle) return { state, events: [] };

    const payload = (action.payload ?? {}) as SetInputPayload;
    const prev = vehicle.input;
    const nitroHeld = payload.nitro === true;

    /*
     * Nitro presses are latched by count. A client that sends `nitroSeq`
     * owns the count; an older client only sends a held flag, so its rising
     * edge is counted here. Either way a press survives a later "released"
     * input that lands before the next tick — which is exactly what used to
     * eat half of all online nitro taps.
     */
    let nitroSeq = prev.nitroSeq;
    if (payload.nitroSeq !== undefined) {
      nitroSeq = Math.max(prev.nitroSeq, Math.floor(Number(payload.nitroSeq) || 0));
    } else if (nitroHeld && !prev.nitro) {
      nitroSeq = prev.nitroSeq + 1;
    }

    const input: VehicleControls = {
      // Clamped rather than rejected: an out-of-range value is far more likely
      // to be a gamepad axis than an attack, and full lock is the honest reading.
      steer: clamp(Number(payload.steer ?? prev.steer) || 0, -1, 1),
      throttle: pedal(payload.throttle, prev.throttle),
      brake: pedal(payload.brake, prev.brake),
      handbrake: payload.handbrake === undefined ? prev.handbrake : payload.handbrake === true,
      // Held means held: an input that does not mention nitro has let go.
      nitro: nitroHeld,
      nitroSeq,
    };

    return {
      state: {
        ...state,
        vehicles: {
          ...state.vehicles,
          [action.playerId]: {
            ...vehicle,
            input,
            lastInputSeq: Math.max(vehicle.lastInputSeq, Number(payload.seq ?? 0) || 0),
          },
        },
      },
      events: [],
    };
  }

  /**
   * Advances the simulation.
   *
   * Always in whole ticks, and capped: a caller that has been asleep must not
   * be able to hand the engine a thousand ticks and have every vehicle teleport
   * down the road in one step, skipping every collision test on the way.
   */
  protected tick(state: RacingGameState, requested: number): ActionResult<RacingGameState, RacingEvent> {
    const count = clamp(Math.floor(requested) || 1, 1, MAX_TICKS_PER_ACTION);
    const events: RacingEvent[] = [];
    let next = state;

    for (let i = 0; i < count && !next.isFinished; i++) {
      next = this.stepOnce(next, events);
    }

    return { state: next, events };
  }

  private stepOnce(state: RacingGameState, events: RacingEvent[]): RacingGameState {
    const tick = state.tick + 1;
    let racingPhase = state.racingPhase;
    let start = state.start;

    if (racingPhase === "countdown") {
      const lit = lightsAt(tick, start.lightsOutTick);
      if (lit !== lightsAt(tick - 1, start.lightsOutTick) && lit > 0 && tick < start.lightsOutTick) {
        events.push({ type: "START_LIGHT", value: lit });
        events.push({ type: "COUNTDOWN", value: START_LIGHT_COUNT - lit });
      }
      if (tick >= start.lightsOutTick) {
        racingPhase = "racing";
        start = { ...start, lightsOut: true };
        events.push({ type: "LIGHTS_OUT" });
        events.push({ type: "RACE_STARTED" });
      }
    }

    const vehicles: Record<string, VehicleState> = {};
    const context = this.tickContext(state);
    const lightsOutNow = racingPhase === "racing" && state.racingPhase === "countdown";

    for (const playerId of state.playerOrder) {
      const vehicle = state.vehicles[playerId];
      if (!vehicle) continue;
      if (racingPhase === "countdown") {
        vehicles[playerId] = this.stepGrid(state, vehicle, tick, events);
        continue;
      }
      const ready = lightsOutNow
        ? { ...vehicle, lapStartTick: tick, sectorStartTick: tick, penaltyTicks: vehicle.jumpStart ? PENALTY_TICKS : 0 }
        : vehicle;
      vehicles[playerId] = this.stepVehicle(state, ready, tick, context, events);
    }

    const collectedCoins = context.coins.size === state.collectedCoins.length ? state.collectedCoins : [...context.coins];
    const collectedPickups =
      context.pickups.size === state.collectedPickups.length ? state.collectedPickups : [...context.pickups];

    let contacts = state.contacts;
    let raceOrder = state.raceOrder;
    if (racingPhase === "racing") {
      contacts = this.resolveContacts(state, vehicles, events);
      this.nearMisses(state, vehicles, contacts, events);
      raceOrder = this.updateRaceOrder(state, vehicles, events);
    }

    // Places are assigned in finish order, and re-derived every tick so a
    // vehicle that finishes on the same tick as another still gets a distinct
    // place rather than sharing one.
    const finishers = raceOrder
      .map((id) => vehicles[id]!)
      .filter((v) => v.finishedAtTick !== null)
      .sort((a, b) => a.finishedAtTick! - b.finishedAtTick! || b.distance - a.distance);
    finishers.forEach((v, i) => {
      vehicles[v.playerId] = { ...v, place: i + 1 };
    });

    const finishedCount = finishers.length;
    const everyoneHome = finishedCount >= state.playerOrder.length;
    /*
     * Once the podium is settled the race is decided, and watching the last
     * car trundle home decides nothing. Capped at the field size so a
     * two-player race still has to finish properly rather than ending the
     * moment nobody can reach third.
     */
    const podiumSettled = finishedCount >= Math.min(PODIUM_PLACES, state.playerOrder.length);
    /*
     * And once every human is home, nobody is left to watch. This replaces a
     * hardcoded "local-you" check: the engine knows who the bots are.
     */
    const decisiveHome =
      state.decisive.length > 0 && state.decisive.every((id) => vehicles[id]?.finishedAtTick !== null);
    const outOfTime = tick >= state.hardStopTick;
    const raceOver = racingPhase === "racing" && (everyoneHome || podiumSettled || decisiveHome || outOfTime);

    const base = {
      ...state,
      tick,
      racingPhase,
      phase: racingPhase,
      start,
      vehicles,
      contacts,
      raceOrder,
      collectedCoins,
      collectedPickups,
    };

    if (raceOver) {
      // Anyone still driving is placed by running order behind those who finished.
      const stragglers = raceOrder.map((id) => vehicles[id]!).filter((v) => v.finishedAtTick === null);
      stragglers.forEach((v, i) => {
        vehicles[v.playerId] = { ...v, place: finishers.length + i + 1 };
      });

      const winner = finishers[0] ?? stragglers[0] ?? null;
      events.push({ type: "RACE_FINISHED", playerId: winner?.playerId });

      return {
        ...base,
        vehicles,
        racingPhase: "finished",
        phase: "finished",
        isFinished: true,
        winnerId: winner?.playerId ?? null,
      };
    }

    return base;
  }

  private tickContext(state: RacingGameState): TickContext {
    const draft = new Map<string, number>();
    const context: TickContext = {
      draft,
      coins: new Set(state.collectedCoins),
      pickups: new Set(state.collectedPickups),
    };
    if (state.racingPhase !== "racing") return context;
    const list = state.playerOrder.map((id) => state.vehicles[id]!).filter((v) => v.finishedAtTick === null);
    for (const me of list) {
      let best = 0;
      for (const other of list) {
        if (other === me) continue;
        const gap = lapDelta(state.track, me.distance, other.distance);
        if (gap < 2 || gap > DRAFT_MAX_GAP) continue;
        if (Math.abs(other.lateral - me.lateral) * ROAD_HALF_WIDTH > 1.8) continue;
        // Strongest close behind, fading to nothing at the edge of the wake.
        const strength = gap < 5 ? 1 : 1 - (gap - 5) / (DRAFT_MAX_GAP - 5);
        if (strength > best) best = strength;
      }
      if (best > 0) draft.set(me.playerId, best);
    }
    return context;
  }

  /**
   * One vehicle on the grid before lights out.
   *
   * Held at its slot. Throttle revs the engine against the clutch; throttle
   * without the brake creeps the car forward, and creeping past the line of
   * the slot is a jump start — exactly as a real grid works. Holding brake and
   * throttle together builds revs for the launch without moving.
   */
  private stepGrid(state: RacingGameState, prev: VehicleState, tick: number, events: RacingEvent[]): VehicleState {
    const t = this.vehicleTuningFor(prev.vehicleId);
    const v: VehicleState = { ...prev };
    const c = prev.input;
    const armed = tick >= START_SETTLE_TICKS;

    const revTarget = t.idleRpm + c.throttle * (t.redlineRpm * 0.8 - t.idleRpm);
    const revRate = (revTarget > v.rpm ? 9000 : 6000) * TICK_SECONDS;
    v.rpm = clamp(revTarget, v.rpm - revRate, v.rpm + revRate);
    v.throttle = c.throttle;
    v.brake = c.brake;
    // Presses during the lights are spent on nothing, not banked for the launch.
    v.nitroSeqUsed = c.nitroSeq;
    v.steerApplied += clamp(c.steer - v.steerApplied, -STEER_RACK_RATE * TICK_SECONDS, STEER_RACK_RATE * TICK_SECONDS);
    v.steerAngle = v.steerApplied * t.steerLock;

    const creeping = armed && !v.jumpStart && c.throttle > 0.5 && c.brake < 0.3;
    if (creeping) {
      v.speed = Math.min(2.5, v.speed + 2 * TICK_SECONDS);
    } else {
      v.speed = Math.max(0, v.speed - 6 * TICK_SECONDS);
    }
    v.distance += v.speed * TICK_SECONDS;
    v.accel = (v.speed - prev.speed) / TICK_SECONDS;

    const slot = state.gridOrder.indexOf(v.playerId);
    if (!v.jumpStart && v.distance - gridDistance(slot) > JUMP_START_METRES) {
      v.jumpStart = true;
      events.push({ type: "JUMP_START", playerId: v.playerId });
    }
    return v;
  }

  /** One vehicle, one racing tick. */
  private stepVehicle(
    state: RacingGameState,
    prev: VehicleState,
    tick: number,
    context: TickContext,
    events: RacingEvent[],
  ): VehicleState {
    const t = this.vehicleTuningFor(prev.vehicleId);
    const track = state.track;
    const dt = TICK_SECONDS;
    const v: VehicleState = { ...prev };
    const finished = prev.finishedAtTick !== null;
    const stunned = prev.crashTicks > 0;

    // ------------------------------------------------------------ inputs
    let c: VehicleControls = prev.input;
    if (finished) {
      // A cool-down lap: roll on at a gentle pace in the middle of the road
      // instead of stopping dead on the line in front of the field.
      c = {
        ...NEUTRAL_INPUT,
        steer: steerToward(t, prev, track, 0),
        throttle: prev.speed < 18 ? 0.35 : 0,
        brake: prev.speed > 30 ? 0.3 : 0,
      };
    }
    let steerIn = stunned ? 0 : c.steer;
    let throttleIn = stunned ? 0 : c.throttle;
    let brakeIn = stunned ? 0.35 : c.brake;
    const handbrake = !stunned && !finished && c.handbrake;

    if (v.penaltyTicks > 0) {
      // The limiter: no drive above pit-lane speed, and a firm hand back down to it.
      v.penaltyTicks -= 1;
      if (prev.speed > PENALTY_SPEED) {
        throttleIn = 0;
        brakeIn = Math.max(brakeIn, prev.speed > PENALTY_SPEED + 1 ? 0.4 : 0);
      }
    }

    // The launch: reaction measured from lights out to the first committed throttle.
    if (v.launchTicks === null && throttleIn >= 0.5 && brakeIn < 0.3 && !finished) {
      const reaction = Math.max(0, tick - state.start.lightsOutTick);
      v.launchTicks = reaction;
      if (!v.jumpStart && reaction <= PERFECT_LAUNCH_TICKS) {
        v.boostTicks = 70;
        v.boostPower = 0.22;
        v.nitro = Math.min(1, v.nitro + 0.1);
        events.push({ type: "PERFECT_LAUNCH", playerId: v.playerId, value: reaction });
        events.push({ type: "LAUNCH", playerId: v.playerId, value: reaction, strength: 1 });
      } else if (!v.jumpStart && reaction <= GOOD_LAUNCH_TICKS) {
        v.boostTicks = 40;
        v.boostPower = 0.12;
        events.push({ type: "LAUNCH", playerId: v.playerId, value: reaction, strength: 0.5 });
      } else {
        events.push({ type: "LAUNCH", playerId: v.playerId, value: reaction, strength: 0 });
      }
    }

    v.steerApplied += clamp(steerIn - v.steerApplied, -STEER_RACK_RATE * dt, STEER_RACK_RATE * dt);
    steerIn = v.steerApplied;

    // ------------------------------------------------------------ surface
    const { curvature, gradient } = sampleTrack(track, prev.distance);
    // Resolved from where the vehicle is at the start of the tick, not where it
    // ends up: the surface you are standing on is what governs this tick's
    // grip and drag. Recomputed every tick and never carried over — a client
    // cannot be allowed to assert "I am in a nitro zone" (spec v2 section 58).
    const zone = finished ? null : zoneAt(track, prev.distance, prev.lateral);
    const offRoad = Math.abs(prev.lateral) > 1;
    const offTrackTicks = offRoad ? prev.offTrackTicks + 1 : 0;
    /*
     * Staged off-track penalty (spec sections 19 and 20).
     *
     * A brief excursion costs only grip — that is a driver using the width of
     * the road. Stay out and the grass starts to drag, then drags harder.
     * Punishing from the first frame outside the line turns every corner exit
     * into a coin flip.
     */
    const offStage =
      !offRoad || offTrackTicks <= OFF_TRACK_GRACE_TICKS ? 0 : offTrackTicks <= OFF_TRACK_PENALTY_TICKS ? 1 : 2;
    const loose = t.looseSurface;
    let surfaceMu = 1;
    let surfaceDrag = 0;
    if (zone === "grip") surfaceMu = 1.12;
    else if (zone === "slick") surfaceMu = 0.5 + 0.3 * loose;
    else if (zone === "slow") {
      surfaceMu = 0.8 + 0.15 * loose;
      surfaceDrag += GRAVITY * (0.1 + 0.2 * Math.min(1, prev.speed / 40)) * (1 - 0.6 * loose);
    }
    if (offRoad) {
      surfaceMu *= 0.7 + 0.2 * loose;
      if (offStage > 0) {
        surfaceDrag += GRAVITY * (0.06 + 0.22 * Math.min(1, prev.speed / 45)) * offStage * (1 - 0.5 * loose);
      }
    }

    const slope = gradient / Math.sqrt(1 + gradient * gradient);
    const slopeCos = 1 / Math.sqrt(1 + gradient * gradient);
    const speed = prev.speed;
    const normalAccel = GRAVITY * slopeCos + (t.liftK * speed * speed) / t.mass;
    const mu = t.mu * surfaceMu * (stunned ? 0.85 : 1);
    const grip = mu * normalAccel;

    // ------------------------------------------------------------ nitro & boosts
    if (c.nitroSeq > v.nitroSeqUsed) {
      v.nitroSeqUsed = c.nitroSeq;
      if (!stunned && !finished && v.nitro > 0.02) v.nitroMinTicks = NITRO_MIN_TICKS;
    }
    const nitroOn = !stunned && !finished && v.nitro > 0 && (c.nitro || v.nitroMinTicks > 0);
    if (nitroOn && !prev.nitroActive) {
      events.push({ type: "NITRO_START", playerId: v.playerId, value: v.nitro });
      events.push({ type: "NITRO_USED", playerId: v.playerId, value: v.nitro });
    } else if (!nitroOn && prev.nitroActive) {
      events.push({ type: "NITRO_END", playerId: v.playerId, value: v.nitro });
    }
    v.nitroActive = nitroOn;
    if (nitroOn) v.nitro = Math.max(0, v.nitro - NITRO_BURN_PER_SECOND * dt);
    if (v.nitroMinTicks > 0) v.nitroMinTicks -= 1;
    if (v.boostTicks > 0) v.boostTicks -= 1;
    if (v.boostTicks === 0) v.boostPower = 0;
    const boosting = nitroOn || v.boostTicks > 0;
    const powerScale = 1 + (nitroOn ? NITRO_POWER : 0) + (v.boostTicks > 0 ? v.boostPower : 0);

    // ------------------------------------------------------------ gearbox
    const gears = t.gearRatios.length;
    let gear = speed < 1 ? 1 : prev.gear;
    let shiftTicks = Math.max(0, prev.shiftTicks - 1);
    const lockedRpm = wheelRpm(t, speed, gear);
    if (shiftTicks === 0 && speed >= 1) {
      const upAt = t.redlineRpm * (throttleIn > 0.6 ? 0.97 : 0.62 + (0.35 * throttleIn) / 0.6);
      if (gear < gears && lockedRpm >= upAt && throttleIn > 0.05) {
        gear += 1;
        shiftTicks = t.shiftTicks;
        events.push({ type: "GEAR_UP", playerId: v.playerId, value: gear });
      } else if (gear > 1) {
        const downAt = t.redlineRpm * (brakeIn > 0.2 ? 0.6 : throttleIn > 0.6 ? 0.5 : 0.36);
        if (lockedRpm < downAt && wheelRpm(t, speed, gear - 1) < t.redlineRpm * 0.9) {
          gear -= 1;
          shiftTicks = Math.max(1, Math.round(t.shiftTicks * 0.6));
          events.push({ type: "GEAR_DOWN", playerId: v.playerId, value: gear });
        }
      }
    }
    v.gear = gear;
    v.shiftTicks = shiftTicks;
    const wheelLocked = wheelRpm(t, speed, gear);
    // Below the launch rpm in first the clutch slips: the engine holds its revs
    // and the car still gets torque from a standstill.
    const engineRpm =
      gear === 1 ? Math.max(wheelLocked, t.idleRpm + throttleIn * (t.launchRpm - t.idleRpm)) : Math.max(wheelLocked, t.idleRpm);

    // ------------------------------------------------------------ drive
    const limiter = t.redlineRpm * (1 + (boosting ? t.overrev : 0));
    let drive = 0;
    // Drive is cut while a shift is in progress: that interruption is what a
    // slow gearbox costs, and why the muscle car's manual box feels different.
    if (throttleIn > 0 && shiftTicks === 0 && wheelLocked < limiter) {
      const torque = engineTorque(t, Math.min(engineRpm, t.redlineRpm)) * throttleIn * powerScale;
      drive = (torque * overallRatio(t, gear) * t.drivelineEfficiency) / t.wheelRadius;
    }
    const lateralUse = Math.abs(prev.latAccel) / Math.max(0.5, grip);
    const traction = tractionLimit(t, normalAccel, mu, lateralUse);
    const driveRequested = drive;
    let wheelspin = 0;
    if (drive > traction) {
      wheelspin = clamp((drive - traction) / Math.max(1, traction), 0, 1);
      // Traction control trims the torque; without it the tyres spin and lose a little more.
      drive = traction * (1 - 0.12 * (1 - t.tractionControl) * Math.min(1, wheelspin * 2));
    }
    v.rpm = clamp(engineRpm + wheelspin * (t.redlineRpm - engineRpm) * 0.5, t.idleRpm, t.redlineRpm * (1 + t.overrev));

    // Engine braking off throttle, through the gears.
    let engineBrake = 0;
    if (throttleIn < 0.05 && speed > 1) {
      const dragTorque = 0.12 * t.peakTorque * (v.rpm / t.redlineRpm) + 10;
      engineBrake = (dragTorque * overallRatio(t, gear)) / t.wheelRadius / t.mass;
    }

    // Brakes, capped by the tyres (ABS) and, on a bike, by the rear lifting.
    let brakeDecel = brakeIn * Math.min(t.brakeDecel, t.stoppieDecel);
    if (handbrake) brakeDecel += GRAVITY * (prev.drifting ? 0.12 : 0.4);
    const lockup = brakeDecel > grip ? clamp((brakeDecel - grip) / grip, 0, 1) : 0;
    brakeDecel = Math.min(brakeDecel, grip);

    const tyreLongitudinal = Math.max(drive / t.mass, brakeDecel);
    const longUse = clamp(tyreLongitudinal / Math.max(0.5, grip), 0, 1);

    // ------------------------------------------------------------ lateral
    let drifting = prev.drifting;
    let driftDir = prev.driftDir;
    let slip = prev.slip;
    let aLat = 0;
    let scrub = 0;
    let understeer = 0;
    let driftEnded: "clean" | "lost" | null = null;

    const tanMax = maxSteerTan(t, Math.max(speed, 1), grip);

    if (!drifting && !finished) {
      // Drift entry: the handbrake, power over the limit, a slick, or a shove.
      const tanDelta = steerIn * tanMax;
      const demand = speed * speed * (tanDelta / t.wheelbase);
      const latMax = grip * Math.sqrt(Math.max(0.15, 1 - 0.85 * longUse * longUse));
      const rearLoad = driveRequested / Math.max(1, traction);
      const powerSlide =
        t.drivetrain !== "FWD" &&
        (t.drivetrain === "RWD" || t.looseness > 0.5) &&
        throttleIn > 0.7 &&
        speed > 6 &&
        speed < 55 &&
        gear <= (t.looseness > 0.8 ? 4 : 3) &&
        rearLoad > 0.9 - 0.3 * t.looseness &&
        Math.abs(demand) > latMax * (1 - 0.3 * t.looseness);
      const handbrakeTurn = handbrake && speed > 9 && Math.abs(steerIn) > 0.25;
      const slickSlide = zone === "slick" && speed > 10 && Math.abs(demand) > latMax * 0.85;
      const shoved = Math.abs(slip) > 0.25 && speed > 8;
      if (handbrakeTurn || powerSlide || slickSlide || shoved) {
        drifting = true;
        driftDir = shoved ? Math.sign(slip) : handbrakeTurn ? Math.sign(steerIn) : Math.sign(demand) || 1;
        if (!shoved) slip += driftDir * 0.06;
        v.driftCharge = 0;
        v.miniTurbo = 0;
        events.push({ type: "DRIFT_START", playerId: v.playerId, value: driftDir });
      }
    }

    if (!drifting) {
      const tanDelta = steerIn * tanMax;
      v.steerAngle = datan(tanDelta);
      const demand = speed * speed * (tanDelta / t.wheelbase);
      const latMax = grip * Math.sqrt(Math.max(0.15, 1 - 0.85 * longUse * longUse));
      aLat = clamp(demand, -latMax, latMax);
      understeer = Math.max(0, Math.abs(demand) - latMax) / Math.max(0.5, latMax);
      // Front tyres scrubbing across the road cost speed.
      scrub = Math.min(0.35, understeer * 0.3) * grip;
      // The body sits a few degrees inside its path at the limit.
      const slipTarget = 0.05 * (aLat / Math.max(1, grip)) * (0.6 + 0.6 * t.looseness);
      slip += (slipTarget - slip) * Math.min(1, 9 * dt);
    } else {
      const into = steerIn * driftDir;
      const throttleBias =
        t.drivetrain === "RWD"
          ? (throttleIn - 0.5) * 0.5 * (0.5 + t.looseness)
          : t.drivetrain === "AWD"
            ? (throttleIn - 0.6) * 0.25
            : -throttleIn * 0.4;
      let target = t.driftMaxSlip * (0.25 + 0.75 * Math.max(0, into) + 0.25 * Math.min(0, into) + throttleBias);
      if (handbrake) target += 0.3 * t.driftMaxSlip;
      target = clamp(target, 0, t.driftMaxSlip * 1.25);
      slip += (driftDir * target - slip) * Math.min(1, DRIFT_RESPONSE * dt);

      // Wheels show the driver's hands: counter-steer reads as counter-steer.
      v.steerAngle = steerIn * Math.min(t.steerLock, 0.45);
      const absSlip = Math.abs(slip);
      const slide = grip * t.slideMu;
      // Sliding tyres pull the velocity round towards where the car points,
      // and drive along the body adds a push the same way.
      aLat = driftDir * slide * clamp(absSlip / 0.22, 0.45, 1) + (drive / t.mass) * dsin(slip);
      scrub = slide * Math.abs(dsin(slip)) * 0.55;

      if (absSlip > SPIN_SLIP) {
        driftEnded = "lost";
      } else if (speed < 5 || driftDir * slip < -0.02 || (absSlip < 0.045 && target < 0.12 * t.driftMaxSlip)) {
        driftEnded = speed < 5 ? "lost" : "clean";
      }

      // Mini-turbo: charge builds while the drift is held, faster the sharper it is.
      if (speed > 12 && !offRoad && absSlip > 0.1) {
        v.driftCharge += (0.6 + 0.8 * Math.min(1, absSlip / t.driftMaxSlip)) * dt;
        v.miniTurbo = v.driftCharge >= MINI_TURBO_CHARGE[3]! ? 3 : v.driftCharge >= MINI_TURBO_CHARGE[2]! ? 2 : v.driftCharge >= MINI_TURBO_CHARGE[1]! ? 1 : 0;
        v.nitro = Math.min(1, v.nitro + DRIFT_FILL_PER_SECOND * dt * Math.min(1, absSlip / t.driftMaxSlip));
      }
    }

    // ------------------------------------------------------------ integrate
    const draft = context.draft.get(v.playerId) ?? 0;
    const dragAccel = (t.dragK * speed * speed * (1 - DRAFT_DRAG_CUT * draft)) / t.mass;
    const rolling = t.rollingResistance * GRAVITY + surfaceDrag;
    const driveAlong = drifting ? (drive / t.mass) * dcos(slip) : drive / t.mass;
    let accel = driveAlong - dragAccel - rolling - GRAVITY * slope - scrub - brakeDecel - engineBrake;
    if (zone === "boost" && speed < t.maxSpeed * 1.08) accel += 5;
    let newSpeed = Math.max(0, speed + accel * dt);

    const kappa = curvature;
    const course = prev.heading - prev.slip;
    const denom = Math.max(0.35, 1 - prev.lateral * ROAD_HALF_WIDTH * kappa);
    const sDot = (newSpeed * dcos(course)) / denom;
    const turnRate = newSpeed > 0.05 ? aLat / Math.max(newSpeed, 0.5) : 0;
    let newCourse = wrapAngle(course + (turnRate - kappa * sDot) * dt);
    let newDistance = prev.distance + sDot * dt;
    let newLateral = prev.lateral + (newSpeed * dsin(newCourse) * dt) / ROAD_HALF_WIDTH;

    // ------------------------------------------------------------ the barrier
    let crashTicks = Math.max(0, prev.crashTicks - 1);
    const wallLimit = RUN_OFF_LIMIT - t.halfWidth;
    let wallContact = false;
    if (Math.abs(newLateral) >= wallLimit) {
      const side = Math.sign(newLateral);
      newLateral = side * wallLimit;
      wallContact = true;
      const into = newSpeed * dsin(newCourse) * side;
      if (into > 0) {
        // Off the wall at a shallow angle, with the scrape taking speed along it.
        const along = Math.max(0, newSpeed * dcos(newCourse) - 0.45 * into);
        const away = -side * 0.18 * into;
        newSpeed = Math.sqrt(along * along + away * away);
        newCourse = datan2(away, along);
        slip *= 0.5;
        if (drifting && into > 3) driftEnded = "lost";
        if (!prev.wallContact && into > 0.8) {
          events.push({ type: "CRASHED", playerId: v.playerId, strength: clamp(into / 15, 0, 1), value: into });
        }
        if (into > 7) {
          crashTicks = Math.max(crashTicks, Math.round(t.crashStunTicks * clamp((into - 7) / 10, 0.3, 1)));
        }
      }
    }

    if (driftEnded) {
      if (driftEnded === "clean" && v.miniTurbo > 0 && newSpeed > 8) {
        const tier = v.miniTurbo;
        v.boostTicks = Math.max(v.boostTicks, MINI_TURBO_TICKS[tier]!);
        v.boostPower = Math.max(v.boostPower, MINI_TURBO_POWER[tier]!);
        events.push({ type: "MINI_TURBO", playerId: v.playerId, value: tier, strength: tier / 3 });
      }
      if (Math.abs(slip) > SPIN_SLIP) {
        newSpeed *= 0.45;
        slip = 0;
        crashTicks = Math.max(crashTicks, 40);
        events.push({ type: "SPIN", playerId: v.playerId });
        events.push({ type: "CRASHED", playerId: v.playerId, strength: 0.6 });
      }
      drifting = false;
      driftDir = 0;
      v.driftCharge = 0;
      v.miniTurbo = 0;
      events.push({ type: "DRIFT_END", playerId: v.playerId });
    }

    v.speed = newSpeed;
    v.slip = drifting ? slip : clamp(slip, -0.6, 0.6);
    v.heading = wrapAngle(newCourse + v.slip);
    v.distance = newDistance;
    v.lateral = newLateral;
    v.drifting = drifting;
    v.driftDir = driftDir;
    v.crashTicks = crashTicks;
    v.accel = (newSpeed - speed) / dt;
    v.latAccel = aLat;
    v.throttle = throttleIn;
    v.brake = brakeIn;
    v.drafting = draft;
    v.zone = zone;
    v.offRoad = offRoad;
    v.offTrackTicks = offTrackTicks;
    v.wallContact = wallContact;
    v.tyreSlip = clamp(
      Math.max(drifting ? 0.35 + (0.65 * Math.abs(slip)) / t.driftMaxSlip : 0, understeer * 1.5, wheelspin, lockup),
      0,
      1,
    );
    if (draft > 0 && newSpeed > 20) v.nitro = Math.min(1, v.nitro + DRAFT_FILL_PER_SECOND * draft * dt);

    // Lean: a bike banks to atan(a/g); a car rolls by a fraction of its grip used.
    const leanTarget =
      t.kind === "bike" ? clamp(datan(aLat / GRAVITY) / 0.72, -1.2, 1.2) : clamp(aLat / (GRAVITY * 1.3), -1.2, 1.2);
    v.lean += (leanTarget - v.lean) * Math.min(1, 12 * dt);

    if (!finished) {
      this.trackObjects(state, v, t, prev, tick, context, events);
      this.wrongWay(v, events);
      this.progress(state, v, tick, events);
    }

    v.nitroCharges = chargesOf(v.nitro);
    v.nitroUntilTick = v.nitroActive || v.boostTicks > 0 ? tick + Math.max(1, v.boostTicks) : 0;
    return v;
  }

  /** Pointing or travelling the wrong way for most of a second earns a warning. */
  private wrongWay(v: VehicleState, events: RacingEvent[]): void {
    const travelCos = v.speed > 3 ? dcos(v.heading - v.slip) : dcos(v.heading);
    if (travelCos < -0.25) {
      v.wrongWayTicks += 1;
      if (!v.wrongWay && v.wrongWayTicks >= 45) {
        v.wrongWay = true;
        events.push({ type: "WRONG_WAY", playerId: v.playerId, value: 1 });
      }
    } else {
      v.wrongWayTicks = 0;
      if (v.wrongWay && travelCos > 0.2) {
        v.wrongWay = false;
        events.push({ type: "WRONG_WAY", playerId: v.playerId, value: 0 });
      }
    }
  }

  /**
   * Boost pads, obstacles, pickups and coins crossed this tick.
   *
   * Every test is lap-local (crossedOnLap), including across the finish-line
   * seam. Comparing a car's total distance to an object's lap position is what
   * made every one of these stop working after the first lap.
   */
  private trackObjects(
    state: RacingGameState,
    v: VehicleState,
    t: VehicleTuning,
    prev: VehicleState,
    tick: number,
    context: TickContext,
    events: RacingEvent[],
  ): void {
    const track = state.track;
    const from = prev.distance;
    const to = v.distance;
    let speed = v.speed;
    const crashTicksIn = v.crashTicks;
    let crashTicks = crashTicksIn;

    for (const pad of track.boostPads) {
      if (!crossedOnLap(track, pad.distance, from, to)) continue;
      if (Math.abs(pad.lateral - v.lateral) > (pad.halfWidth || 0.35) + t.halfWidth) continue;
      // A shove and a burst of power, not a teleport: the car still has to
      // be able to use it, and a pad into a hairpin is a pad into the wall.
      speed = Math.min(Math.max(speed, t.maxSpeed * 1.08), speed + 4);
      v.boostTicks = Math.max(v.boostTicks, 54);
      v.boostPower = Math.max(v.boostPower, 0.6);
      events.push({ type: "BOOST_PAD", playerId: v.playerId });
      break;
    }

    const speedBeforeImpact = speed;
    for (const obstacle of track.obstacles) {
      if (!crossedOnLap(track, obstacle.distance, from, to)) continue;
      if (Math.abs(obstacle.lateral - v.lateral) > obstacle.halfWidth + t.halfWidth) continue;

      const stun = t.crashStunTicks;
      switch (obstacle.kind) {
        case "barrel":
          speed *= 0.38;
          crashTicks = Math.floor(stun * 1.2);
          break;
        case "spikes":
          speed *= 0.32;
          crashTicks = stun;
          break;
        case "laser":
          speed *= 0.48;
          crashTicks = Math.floor(stun * 0.75);
          break;
        case "cone":
          speed *= 0.82;
          crashTicks = Math.floor(stun * 0.3);
          break;
        case "barrier":
        case "block":
        default:
          speed *= t.crashPenalty;
          crashTicks = stun;
          break;
      }

      /*
       * A shield absorbs the hit outright: no speed loss, no stun, and it is
       * spent. Applied by restoring what the switch changed rather than by
       * skipping it, so the obstacle still counts as struck.
       */
      if (v.shielded) {
        v.shielded = false;
        speed = speedBeforeImpact;
        crashTicks = crashTicksIn;
        events.push({ type: "SHIELD_BROKEN", playerId: v.playerId });
        break;
      }

      // Knocked out of any drift, with no turbo for it, still travelling the
      // way it was: only the body's angle to its path is knocked straight.
      if (v.drifting) events.push({ type: "DRIFT_END", playerId: v.playerId });
      const course = v.heading - v.slip;
      v.drifting = false;
      v.driftDir = 0;
      v.driftCharge = 0;
      v.miniTurbo = 0;
      v.slip *= 0.3;
      v.heading = wrapAngle(course + v.slip);
      events.push({
        type: "CRASHED",
        playerId: v.playerId,
        strength: clamp((speedBeforeImpact - speed) / 25, 0.2, 1),
      });
      break;
    }

    const taken = context.pickups;
    for (const pickup of track.pickups) {
      if (!crossedOnLap(track, pickup.distance, from, to)) continue;
      if (Math.abs(pickup.lateral - v.lateral) > 0.3) continue;

      // Boxes come back every lap, so the key carries the lap it was opened on.
      const at = from + distanceAhead(track, from, pickup.distance);
      const key = `${Math.floor(at / track.length)}:${coinKey(pickup.distance, pickup.lateral)}`;
      if (taken.has(key)) continue;
      taken.add(key);

      const kind = pickup.kind ?? rollMysteryBox(tick, pickup.distance);
      switch (kind) {
        case "nitro":
          v.nitro = Math.min(1, v.nitro + NITRO_PER_CHARGE);
          break;
        case "perfectNitro":
          v.nitro = 1;
          break;
        case "shield":
          v.shielded = true;
          break;
        case "magnet":
          v.magnetUntilTick = tick + MAGNET_TICKS;
          break;
        case "repair":
          // Clears the stun and returns a chunk of the speed the crash took.
          // Not a full restore: a repair that undoes a crash entirely removes
          // the reason to avoid crashing.
          crashTicks = 0;
          speed = Math.min(t.maxSpeed, speed + t.maxSpeed * 0.25);
          break;
      }
      events.push({ type: "PICKUP_COLLECTED", playerId: v.playerId, value: v.nitro });
    }
    const collected = context.coins;
    for (const coin of track.coins) {
      if (!crossedOnLap(track, coin.distance, from, to)) continue;
      // A magnet reaches across the road; without one you must drive over it.
      const reach = v.magnetUntilTick > tick ? MAGNET_REACH : 0.28;
      if (Math.abs(coin.lateral - v.lateral) > reach) continue;
      const key = coinKey(coin.distance, coin.lateral);
      if (collected.has(key)) continue;
      collected.add(key);
      v.coins += 1;
      events.push({ type: "COIN_COLLECTED", playerId: v.playerId, value: v.coins });
    }
    // A nitro strip refills a third of the gauge once per crossing, never per
    // tick: parking on it must not be an unbounded supply.
    if (v.zone === "nitro" && prev.zone !== "nitro") {
      const before = v.nitro;
      v.nitro = Math.min(1, v.nitro + NITRO_PER_CHARGE);
      if (v.nitro > before) events.push({ type: "NITRO_GAINED", playerId: v.playerId, value: v.nitro });
    }

    v.speed = speed;
    v.crashTicks = crashTicks;
  }

  /** Checkpoints, sectors, laps and the finish. */
  private progress(state: RacingGameState, v: VehicleState, tick: number, events: RacingEvent[]): void {
    const track = state.track;
    const length = track.length;

    // Checkpoints reset each lap, so the progress bar measures the lap being
    // driven rather than the whole race. Nothing counts before the line.
    const alongLap = v.distance < 0 ? 0 : wrapDistance(track, v.distance);
    const reached = track.checkpoints.filter((at) => alongLap >= at).length;
    if (reached !== v.checkpoint) {
      if (reached > v.checkpoint) {
        events.push({ type: "CHECKPOINT", playerId: v.playerId, value: reached });
      }
      v.checkpoint = reached;
    }

    // Sectors count off total distance, so they are monotonic and seam-free:
    // reversing over a boundary and crossing it again does not split twice.
    const sectorLength = length / SECTOR_COUNT;
    const sectors = v.distance < 0 ? 0 : Math.floor(v.distance / sectorLength);
    while (sectors > v.sectorsDone) {
      v.sectorsDone += 1;
      const index = (v.sectorsDone - 1) % SECTOR_COUNT;
      const split = tick - v.sectorStartTick;
      v.sectorStartTick = tick;
      v.sectorTicks = [...v.sectorTicks, split];
      const best = v.bestSectorTicks[index];
      v.bestSectorTicks = v.bestSectorTicks.map((b, i) => (i === index ? (best === null || best === undefined ? split : Math.min(best, split)) : b));
      events.push({ type: "SECTOR", playerId: v.playerId, value: index, ticks: split });
      if (index === SECTOR_COUNT - 1) {
        v.lastSectorTicks = v.sectorTicks;
        v.sectorTicks = [];
      }
    }

    // Laps are counted from total distance travelled rather than by wrapping
    // it, so the standings can order a field spread across different laps by
    // comparing one number. Clamped at zero: the grid is behind the line.
    const lapsCrossed = Math.max(0, Math.floor(v.distance / length));
    if (lapsCrossed > v.lapsDone) {
      const lapTime = tick - v.lapStartTick;
      v.lapsDone = lapsCrossed;
      v.lapStartTick = tick;
      v.lapTicks = [...v.lapTicks, lapTime];
      v.bestLapTicks = v.bestLapTicks === null ? lapTime : Math.min(v.bestLapTicks, lapTime);
      events.push({ type: "LAP_COMPLETED", playerId: v.playerId, value: v.lapsDone, ticks: lapTime });
      if (state.laps > 1 && v.lapsDone === state.laps - 1) {
        events.push({ type: "FINAL_LAP", playerId: v.playerId });
      }
    }

    if (v.finishedAtTick === null && v.lapsDone >= state.laps) {
      v.finishedAtTick = tick;
      events.push({ type: "VEHICLE_FINISHED", playerId: v.playerId, value: tick });
    }
  }

  /**
   * Car-to-car contact.
   *
   * Two car-sized boxes in track space, compared lap-locally so a lapped car
   * is solid. Resolved along whichever axis overlaps least:
   *
   *   nose to tail — the car behind gives up its closing speed (and is put
   *     back where it touched); the car in front never gains any. Being hit
   *     from behind must not be a free tow, or punting becomes a tactic.
   *   side by side — momentum exchanged across the road by mass, with a
   *     little restitution, which turns into slip angle because a body is
   *     shoved sideways faster than it rotates.
   *
   * One COLLISION per car per new contact. A pair still touching (or within a
   * hand's width) next tick is the same contact, not a new one.
   */
  private resolveContacts(
    state: RacingGameState,
    vehicles: Record<string, VehicleState>,
    events: RacingEvent[],
  ): string[] {
    const track = state.track;
    const previous = new Set(state.contacts);
    const ids = state.playerOrder.filter((id) => vehicles[id] && vehicles[id]!.finishedAtTick === null);
    const next: string[] = [];

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const idA = ids[i]!;
        const idB = ids[j]!;
        const a = vehicles[idA]!;
        const b = vehicles[idB]!;
        const ta = this.vehicleTuningFor(a.vehicleId);
        const tb = this.vehicleTuningFor(b.vehicleId);
        const key = idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;

        const gap = lapDelta(track, a.distance, b.distance);
        const across = (b.lateral - a.lateral) * ROAD_HALF_WIDTH;
        const overlapLong = ta.halfLength + tb.halfLength - Math.abs(gap);
        const overlapLat = (ta.width + tb.width) / 2 - Math.abs(across);

        if (overlapLong <= 0 || overlapLat <= 0) {
          if (previous.has(key) && overlapLong > -0.3 && overlapLat > -0.3) next.push(key);
          continue;
        }
        next.push(key);

        let impact = 0;
        if (overlapLong < overlapLat) {
          const [front, rear] = gap > 0 ? [b, a] : [a, b];
          const frontAlong = front.speed * dcos(front.heading - front.slip);
          const rearAlong = rear.speed * dcos(rear.heading - rear.slip);
          rear.distance -= overlapLong;
          const closing = rearAlong - frontAlong;
          if (closing > 0) {
            rear.speed = Math.max(0, rear.speed - closing * 1.15);
            impact = closing;
          }
        } else {
          const dir = across >= 0 ? 1 : -1;
          const invA = 1 / ta.mass;
          const invB = 1 / tb.mass;
          const inv = invA + invB;
          a.lateral -= (dir * overlapLat * (invA / inv)) / ROAD_HALF_WIDTH;
          b.lateral += (dir * overlapLat * (invB / inv)) / ROAD_HALF_WIDTH;

          const courseA = a.heading - a.slip;
          const courseB = b.heading - b.slip;
          const alongA = a.speed * dcos(courseA);
          const alongB = b.speed * dcos(courseB);
          const acrossA = a.speed * dsin(courseA);
          const acrossB = b.speed * dsin(courseB);
          const closing = (acrossA - acrossB) * dir;
          if (closing > 0) {
            const impulse = (1.3 * closing) / inv;
            const newAcrossA = acrossA - (dir * impulse) / ta.mass;
            const newAcrossB = acrossB + (dir * impulse) / tb.mass;
            this.setVelocity(a, alongA, newAcrossA, (0.25 * impulse * ta.fragility) / ta.mass);
            this.setVelocity(b, alongB, newAcrossB, (0.25 * impulse * tb.fragility) / tb.mass);
            impact = closing;
          }
        }

        if (impact > 0) {
          for (const [me, other, tm] of [
            [a, b, ta],
            [b, a, tb],
          ] as const) {
            // A heavy hit is a moment out of control, sooner for a fragile car.
            if (impact * tm.fragility > 9) {
              me.crashTicks = Math.max(me.crashTicks, Math.round(10 * tm.fragility));
            }
            if (!previous.has(key) && impact > 0.5) {
              events.push({
                type: "COLLISION",
                playerId: me.playerId,
                otherId: other.playerId,
                strength: clamp(impact / 12, 0, 1),
                value: impact,
              });
            }
          }
        }
      }
    }

    return next.sort();
  }

  /** Sets a vehicle's velocity from track-space components, keeping its body where it points. */
  private setVelocity(v: VehicleState, along: number, across: number, scrub: number): void {
    const speed = Math.max(0, Math.sqrt(along * along + across * across) - scrub);
    const course = datan2(across, along);
    v.speed = speed;
    // The shove moves the velocity, not the body: the difference is slip.
    v.slip = clamp(wrapAngle(v.heading - course), -SPIN_SLIP, SPIN_SLIP);
  }

  /**
   * Overtakes that came within a hand's width without touching.
   *
   * Rewarded with nitro, because the alternative to a near miss is usually
   * contact, and the game should pay for the braver, cleaner pass.
   */
  private nearMisses(
    state: RacingGameState,
    vehicles: Record<string, VehicleState>,
    contacts: string[],
    events: RacingEvent[],
  ): void {
    const touching = new Set(contacts);
    const ids = state.playerOrder.filter((id) => vehicles[id]?.finishedAtTick === null);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = vehicles[ids[i]!]!;
        const b = vehicles[ids[j]!]!;
        const pa = state.vehicles[a.playerId]!;
        const pb = state.vehicles[b.playerId]!;
        const key = a.playerId < b.playerId ? `${a.playerId}|${b.playerId}` : `${b.playerId}|${a.playerId}`;
        if (touching.has(key)) continue;
        const before = lapDelta(state.track, pa.distance, pb.distance);
        const after = lapDelta(state.track, a.distance, b.distance);
        if (Math.abs(before) > 10 || Math.abs(after) > 10) continue;
        let passer: VehicleState | null = null;
        let passed: VehicleState | null = null;
        if (before > 0 && after <= 0) [passer, passed] = [a, b];
        else if (before < 0 && after >= 0) [passer, passed] = [b, a];
        if (!passer || !passed) continue;
        const tp = this.vehicleTuningFor(passer.vehicleId);
        const to = this.vehicleTuningFor(passed.vehicleId);
        const clearance = Math.abs(a.lateral - b.lateral) * ROAD_HALF_WIDTH - (tp.width + to.width) / 2;
        if (clearance > 0 && clearance < 1 && passer.speed - passed.speed > 3) {
          passer.nitro = Math.min(1, passer.nitro + NEAR_MISS_FILL);
          passer.nitroCharges = chargesOf(passer.nitro);
          events.push({ type: "NEAR_MISS", playerId: passer.playerId, otherId: passed.playerId, strength: 1 - clearance });
        }
      }
    }
  }

  /**
   * The running order, with hysteresis.
   *
   * Starts from last tick's order and only swaps neighbours when the car
   * behind is genuinely ahead, so two cars side by side do not trade places
   * sixty times a second — which would also mean sixty position-change events.
   */
  private updateRaceOrder(
    state: RacingGameState,
    vehicles: Record<string, VehicleState>,
    events: RacingEvent[],
  ): string[] {
    const order = state.raceOrder.filter((id) => vehicles[id]);
    for (const id of state.playerOrder) if (!order.includes(id) && vehicles[id]) order.push(id);

    const ahead = (x: VehicleState, y: VehicleState): boolean => {
      if (x.finishedAtTick !== null || y.finishedAtTick !== null) {
        if (x.finishedAtTick === null) return false;
        if (y.finishedAtTick === null) return true;
        return x.finishedAtTick < y.finishedAtTick;
      }
      return x.distance > y.distance + POSITION_HYSTERESIS;
    };

    for (let i = 1; i < order.length; i++) {
      for (let j = i; j > 0; j--) {
        const x = vehicles[order[j]!]!;
        const y = vehicles[order[j - 1]!]!;
        if (!ahead(x, y)) break;
        order[j] = y.playerId;
        order[j - 1] = x.playerId;
      }
    }

    order.forEach((id, index) => {
      const v = vehicles[id]!;
      const position = index + 1;
      if (v.position !== position) {
        events.push({ type: "POSITION_CHANGED", playerId: id, value: position, from: v.position });
        vehicles[id] = { ...v, position };
      }
    });
    return order;
  }

  getPlayerView(state: RacingGameState, playerId: string | null): RacingPlayerView {
    const vehicles = state.playerOrder
      .map((id) => state.vehicles[id])
      .filter((v): v is VehicleState => Boolean(v));

    const order = state.raceOrder.length > 0 ? state.raceOrder : state.playerOrder;
    const standings: RacingStanding[] = order
      .map((id) => state.vehicles[id])
      .filter((v): v is VehicleState => Boolean(v))
      .map((v, i) => ({
        playerId: v.playerId,
        place: v.place ?? i + 1,
        distance: v.distance,
        finished: v.finishedAtTick !== null,
        lapsDone: v.lapsDone,
        bestLapTicks: v.bestLapTicks,
      }))
      .sort((a, b) => a.place - b.place);

    const lights = state.start.lightsOut ? 0 : lightsAt(state.tick, state.start.lightsOutTick);

    return {
      phase: state.phase,
      racingPhase: state.racingPhase,
      isFinished: state.isFinished,
      tick: state.tick,
      countdown:
        state.racingPhase === "countdown"
          ? clamp(START_LIGHT_COUNT + 1 - Math.max(1, lights), 1, START_LIGHT_COUNT)
          : 0,
      start: {
        lights,
        lightsOutTick: state.start.lightsOut ? state.start.lightsOutTick : null,
      },
      trackSeed: state.track.seed,
      trackLength: state.track.length,
      theme: state.theme,
      laps: state.laps,
      raceTicks: state.start.lightsOut ? Math.max(0, state.tick - state.start.lightsOutTick) : 0,
      checkpoints: state.track.checkpoints,
      me: playerId ? (state.vehicles[playerId] ?? null) : null,
      vehicles,
      standings,
      collectedCoins: state.collectedCoins,
      winnerId: state.winnerId,
      sequenceNumber: state.sequenceNumber,
      updatedAt: state.updatedAt,
    };
  }

  isGameOver(state: RacingGameState): boolean {
    return state.isFinished;
  }

  calculateResult(state: RacingGameState, roomId = "room_racing"): RacingResult {
    const ordered = [...Object.values(state.vehicles)].sort(
      (a, b) => (a.place ?? 99) - (b.place ?? 99),
    );

    return {
      roomId,
      sessionId: state.track.seed.toString(),
      gameId: this.gameId,
      winnerId: state.winnerId,
      scores: ordered.map((v, i) => ({
        playerId: v.playerId,
        userId: v.playerId,
        rank: v.place ?? i + 1,
        // Coins are the score: distance decides the placing, and rewarding the
        // driver who also collected on the way gives the coins a purpose.
        score: v.coins,
        isWinner: v.playerId === state.winnerId,
      })),
      durationSeconds: Math.round(state.tick / TICK_RATE),
      reason: "normal",
      // Reporting metadata for the history list, outside the simulation: the
      // only wall-clock read in the engine, and nothing ever reads it back.
      completedAt: new Date().toISOString(),
      distances: Object.fromEntries(ordered.map((v) => [v.playerId, Math.round(v.distance)])),
      coins: Object.fromEntries(ordered.map((v) => [v.playerId, v.coins])),
    } as RacingResult;
  }

  /** Metres of road either side of the centreline. Shared with the renderer. */
  roadHalfWidth(): number {
    return ROAD_HALF_WIDTH;
  }

  trackOf(state: RacingGameState): TrackSpec {
    return state.track;
  }
}

export function coinKey(distance: number, lateral: number): string {
  return `${distance}:${lateral}`;
}

/** Red lights lit at a tick, 0..5. */
export function lightsAt(tick: number, lightsOutTick: number): number {
  if (tick >= lightsOutTick || tick < START_SETTLE_TICKS) return 0;
  return Math.min(START_LIGHT_COUNT, Math.floor((tick - START_SETTLE_TICKS) / START_LIGHT_INTERVAL_TICKS) + 1);
}

/** Total distance of a grid slot, pole first. */
export function gridDistance(slot: number): number {
  return -(GRID_POLE + Math.max(0, slot) * GRID_SLOT);
}

/** Lateral position of a grid slot: a staggered two-wide grid. */
export function gridLateral(slot: number): number {
  return slot % 2 === 0 ? -0.32 : 0.32;
}

/**
 * Grid order: any explicit order first (a level, a qualifying result), then
 * everyone else shuffled from the race seed. Seeded, so the player is not
 * always last and a replay still starts from the same grid.
 */
function gridOrder(order: string[], explicit: string[] | undefined, seedSource: string): string[] {
  const listed = (explicit ?? []).filter((id, i, all) => order.includes(id) && all.indexOf(id) === i);
  const rest = order.filter((id) => !listed.includes(id));
  const rng = createRng(seedFromString(`${seedSource}|grid`));
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const swap = rest[i]!;
    rest[i] = rest[j]!;
    rest[j] = swap;
  }
  return [...listed, ...rest];
}

/** A pedal value: analog 0..1, or a boolean from an older client. */
function pedal(value: number | boolean | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value === "boolean") return value ? 1 : 0;
  return clamp(Number(value) || 0, 0, 1);
}

function chargesOf(gauge: number): number {
  return gauge <= 0.001 ? 0 : Math.ceil(gauge * 3 - 1e-6);
}

/**
 * Decides what a mystery box contains, at the moment it is opened.
 *
 * Deterministic in the tick and the box's position, so a replay of the same
 * race produces the same contents and two clients simulating the same state
 * agree — but not knowable from the track seed alone, which is what would
 * happen if the contents were fixed at generation time.
 */
function rollMysteryBox(tick: number, distance: number): PickupKind {
  const table: PickupKind[] = ["nitro", "shield", "magnet", "repair", "perfectNitro"];
  // A cheap integer hash; the inputs are small and adjacent boxes must not
  // produce a run of the same prize.
  const mixed = Math.imul(tick + 1, 2654435761) ^ Math.imul(distance + 1, 40503);
  return table[Math.abs(mixed) % table.length]!;
}

/**
 * The zone covering a point on the track, or null.
 *
 * Lap-local, and a zone may run across the finish line. Returns the first
 * match rather than blending overlaps: two zones on the same patch of tarmac
 * is a track-generation mistake, and quietly averaging their effects would
 * hide it.
 */
export function zoneAt(track: TrackSpec, distance: number, lateral: number): ZoneKind | null {
  for (const zone of track.zones) {
    if (!withinOnLap(track, zone.distance, zone.length, distance)) continue;
    if (Math.abs(lateral - zone.lateral) > zone.halfWidth) continue;
    return zone.kind;
  }
  return null;
}

/**
 * A stable fingerprint of everything the simulation evolves.
 *
 * For determinism tests, replays and desync checks: two states with the same
 * hash will produce the same future from the same inputs. Wall-clock fields
 * are excluded because the engine never reads them.
 */
export function hashRacingState(state: RacingGameState): string {
  const parts: Array<string | number | boolean | null> = [
    state.tick,
    state.racingPhase,
    state.start.lightsOutTick,
    state.contacts.join(","),
    state.raceOrder.join(","),
    state.collectedCoins.length,
    state.collectedPickups.join(","),
  ];
  for (const id of state.playerOrder) {
    const v = state.vehicles[id];
    if (!v) continue;
    parts.push(
      id, v.distance, v.lateral, v.speed, v.heading, v.slip, v.steerApplied, v.gear, v.rpm, v.shiftTicks,
      v.nitro, v.nitroActive, v.boostTicks, v.boostPower, v.driftCharge, v.drifting, v.coins, v.crashTicks,
      v.lapsDone, v.sectorsDone, v.finishedAtTick, v.position, v.latAccel, v.lean,
    );
  }
  let hash = 2166136261;
  const text = parts.map((p) => (typeof p === "number" ? p.toString(36) : String(p))).join("|");
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

// Kept for callers that measured against the old constant.
export const VEHICLE_HALF_WIDTH = VEHICLE_HALF_WIDTH_LATERAL;
