import type { GameId, Player } from "@playora/game-types";
import { AbstractGameEngine } from "../engine.js";
import type { ActionResult, ActionValidationResult } from "../types.js";
import { buildTrack, sampleTrack } from "./track.js";
import { vehicleById } from "./garage.js";
import {
  COUNTDOWN_TICKS,
  NEUTRAL_INPUT,
  ROAD_HALF_WIDTH,
  SERVER_PLAYER_ID,
  TICK_RATE,
  TICK_SECONDS,
  type RacingAction,
  type RacingConfig,
  type RacingEvent,
  type RacingGameState,
  type RacingPlayerView,
  type RacingResult,
  type SetInputPayload,
  type TickPayload,
  type TrackSpec,
  type VehicleInput,
  type VehicleState,
} from "./types.js";

/** How a vehicle behaves. The only difference between a car and a bike. */
export interface VehicleTuning {
  /** Metres per second at full throttle on tarmac. */
  maxSpeed: number;
  acceleration: number;
  brakePower: number;
  /** Deceleration when the throttle is released. */
  engineBrake: number;
  /** Lateral units per second at top speed. */
  steerRate: number;
  /** How hard a corner pushes the vehicle outward. */
  centrifugal: number;
  offRoadDrag: number;
  offRoadMaxSpeed: number;
  /** Speed retained after scraping the wall. */
  wallPenalty: number;
  /** Speed retained after hitting an obstacle. */
  crashPenalty: number;
  crashStunTicks: number;
  nitroMultiplier: number;
  nitroTicks: number;
  /** Collision half-width in lateral units. */
  halfWidth: number;
  /** How quickly the visual lean follows the steering. */
  leanRate: number;
}

const MAX_TICKS_PER_ACTION = 20;

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
 * Everything below runs at a fixed timestep and uses no ambient randomness, so
 * the same inputs replay to the same result on the server and on every client.
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

  protected abstract tuning(): VehicleTuning;

  /**
   * Tuning for one vehicle: the class baseline with its garage modifiers.
   *
   * Cached because this is asked for every vehicle on every tick — sixty times
   * a second times eight cars — and it is a pure function of an id.
   */
  private tuningCache = new Map<string, VehicleTuning>();

  vehicleTuningFor(vehicleId: string): VehicleTuning {
    const cached = this.tuningCache.get(vehicleId);
    if (cached) return cached;

    const base = this.tuning();
    const m = vehicleById(this.gameId, vehicleId).modifiers;
    const tuned: VehicleTuning = {
      ...base,
      maxSpeed: base.maxSpeed * m.maxSpeed,
      acceleration: base.acceleration * m.acceleration,
      steerRate: base.steerRate * m.steerRate,
      centrifugal: base.centrifugal * m.centrifugal,
      nitroMultiplier: base.nitroMultiplier * m.nitroMultiplier,
      // A modifier above one is more forgiving, and crashPenalty is the speed
      // *kept* — so it moves towards 1 rather than past it.
      crashPenalty: Math.min(0.85, base.crashPenalty * m.crashPenalty),
    };

    this.tuningCache.set(vehicleId, tuned);
    return tuned;
  }

  /** Metres, when the config does not say. */
  protected defaultTrackLength(): number {
    return 3000;
  }

  protected defaultNitroCharges(): number {
    return 2;
  }

  /** Laps in a race, when the config does not say. */
  protected defaultLaps(): number {
    return 3;
  }

  init(players: Player[], config: RacingConfig = {}): RacingGameState {
    const length = Math.max(500, config.trackLength ?? this.defaultTrackLength());
    const laps = Math.max(1, Math.round(config.laps ?? this.defaultLaps()));
    const track = buildTrack(config.randomSeed ?? `${this.gameId}-${Date.now()}`, length);

    const order = players.map((p) => p.userId);
    const vehicles: Record<string, VehicleState> = {};

    order.forEach((playerId, index) => {
      vehicles[playerId] = {
        playerId,
        vehicleId: vehicleById(this.gameId, config.vehicles?.[playerId]).id,
        // The grid sits *behind* the start line, which is where a grid
        // belongs on a circuit: the cars cross the line to begin lap one and
        // cross it again to complete it. Starting on the line would put the
        // start gate directly over the camera on the first frame.
        //
        // Rows run forward from seat one, because the chase camera sits behind
        // the player and any car further back would be between the lens and the
        // car it is following.
        distance: -34 + Math.floor(index / 2) * 6,
        lateral: index % 2 === 0 ? -0.35 : 0.35,
        speed: 0,
        lean: 0,
        nitroCharges: config.nitroCharges ?? this.defaultNitroCharges(),
        nitroUntilTick: 0,
        coins: 0,
        crashTicks: 0,
        lapsDone: 0,
        lapStartTick: COUNTDOWN_TICKS,
        lapTicks: [],
        bestLapTicks: null,
        checkpoint: 0,
        finishedAtTick: null,
        place: null,
        input: { ...NEUTRAL_INPUT },
        lastInputSeq: 0,
      };
    });

    const timeLimit = Math.max(30, config.timeLimitSeconds ?? 240);

    return {
      sequenceNumber: 0,
      phase: "countdown",
      activePlayerId: null,
      turnNumber: 0,
      startedAt: Date.now(),
      updatedAt: Date.now(),
      turnDeadline: null,
      isFinished: false,
      tick: 0,
      racingPhase: "countdown",
      laps,
      track,
      vehicles,
      playerOrder: order,
      collectedCoins: [],
      winnerId: null,
      hardStopTick: COUNTDOWN_TICKS + timeLimit * TICK_RATE,
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
        const payload = action.payload as SetInputPayload;
        if (payload?.steer !== undefined && !Number.isFinite(payload.steer)) {
          return { valid: false, reason: "Invalid steering value." };
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
    const input: VehicleInput = {
      // Clamped rather than rejected: an out-of-range value is far more likely
      // to be a gamepad axis than an attack, and full lock is the honest reading.
      steer: clamp(Number(payload.steer ?? vehicle.input.steer) || 0, -1, 1),
      throttle: payload.throttle ?? vehicle.input.throttle,
      brake: payload.brake ?? vehicle.input.brake,
      nitro: payload.nitro ?? false,
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

    if (state.racingPhase === "countdown") {
      if (tick < COUNTDOWN_TICKS) {
        // One event per second, so the client can count down without a timer
        // of its own drifting away from the server's.
        if (tick % TICK_RATE === 0) {
          events.push({ type: "COUNTDOWN", value: (COUNTDOWN_TICKS - tick) / TICK_RATE });
        }
        return { ...state, tick, updatedAt: Date.now() };
      }
      events.push({ type: "RACE_STARTED" });
      return { ...state, tick, racingPhase: "racing", phase: "racing", updatedAt: Date.now() };
    }

    const collected = new Set(state.collectedCoins);
    const vehicles: Record<string, VehicleState> = {};
    let finishedCount = 0;

    for (const playerId of state.playerOrder) {
      const vehicle = state.vehicles[playerId];
      if (!vehicle) continue;

      vehicles[playerId] =
        vehicle.finishedAtTick !== null
          ? vehicle
          : this.stepVehicle(state, vehicle, tick, collected, events);

      if (vehicles[playerId]!.finishedAtTick !== null) finishedCount += 1;
    }

    // Places are assigned in finish order, and re-derived every tick so a
    // vehicle that finishes on the same tick as another still gets a distinct
    // place rather than sharing one.
    const finishers = Object.values(vehicles)
      .filter((v) => v.finishedAtTick !== null)
      .sort((a, b) => a.finishedAtTick! - b.finishedAtTick! || b.distance - a.distance);
    finishers.forEach((v, i) => {
      vehicles[v.playerId] = { ...v, place: i + 1 };
    });

    const everyoneHome = finishedCount >= state.playerOrder.length;
    const outOfTime = tick >= state.hardStopTick;
    const raceOver = everyoneHome || outOfTime;

    if (raceOver) {
      // Anyone still driving is placed by distance behind those who finished.
      const stragglers = Object.values(vehicles)
        .filter((v) => v.finishedAtTick === null)
        .sort((a, b) => b.distance - a.distance);
      stragglers.forEach((v, i) => {
        vehicles[v.playerId] = { ...v, place: finishers.length + i + 1 };
      });

      const winner = vehicles[finishers[0]?.playerId ?? stragglers[0]?.playerId ?? ""] ?? null;
      events.push({ type: "RACE_FINISHED", playerId: winner?.playerId });

      return {
        ...state,
        tick,
        vehicles,
        collectedCoins: [...collected],
        racingPhase: "finished",
        phase: "finished",
        isFinished: true,
        winnerId: winner?.playerId ?? null,
        updatedAt: Date.now(),
      };
    }

    return {
      ...state,
      tick,
      vehicles,
      collectedCoins: [...collected],
      updatedAt: Date.now(),
    };
  }

  /** One vehicle, one tick. */
  private stepVehicle(
    state: RacingGameState,
    vehicle: VehicleState,
    tick: number,
    collected: Set<string>,
    events: RacingEvent[],
  ): VehicleState {
    const t = this.vehicleTuningFor(vehicle.vehicleId);
    const stunned = vehicle.crashTicks > 0;
    const input = stunned ? NEUTRAL_INPUT : vehicle.input;

    let { speed, lateral, lean, nitroCharges, nitroUntilTick, coins, checkpoint } = vehicle;

    // Nitro. A charge is spent on the rising edge only, so holding the key does
    // not empty the bottle.
    if (input.nitro && nitroCharges > 0 && nitroUntilTick <= tick && !stunned) {
      nitroCharges -= 1;
      nitroUntilTick = tick + t.nitroTicks;
      events.push({ type: "NITRO_USED", playerId: vehicle.playerId, value: nitroCharges });
    }
    const boosting = nitroUntilTick > tick;

    const offRoad = Math.abs(lateral) > 1;
    const ceiling = boosting
      ? t.maxSpeed * t.nitroMultiplier
      : offRoad
        ? t.offRoadMaxSpeed
        : t.maxSpeed;

    if (stunned) {
      speed -= t.brakePower * 0.6 * TICK_SECONDS;
    } else if (input.brake) {
      speed -= t.brakePower * TICK_SECONDS;
    } else if (input.throttle) {
      // Acceleration tails off near the ceiling instead of stopping dead, which
      // is what makes a top-speed run feel like effort rather than a wall.
      const headroom = Math.max(0, 1 - speed / Math.max(1, ceiling));
      speed += t.acceleration * (0.35 + 0.65 * headroom) * TICK_SECONDS * (boosting ? 1.6 : 1);
    } else {
      speed -= t.engineBrake * TICK_SECONDS;
    }

    if (offRoad) {
      // Drag scales with speed rather than being a flat subtraction. A constant
      // was a trap: with offRoadDrag equal to acceleration, a vehicle that
      // stopped on the runoff had exactly as much drag as thrust and could
      // never move again. Proportional drag always loses to the engine at low
      // speed, so there is a way back onto the road from anywhere.
      speed -= t.offRoadDrag * (0.25 + (0.75 * speed) / t.maxSpeed) * TICK_SECONDS;
    }
    speed = clamp(speed, 0, ceiling);

    // Steering authority scales with speed: a stationary vehicle cannot change
    // lane, which is both true and what stops a stopped car sliding sideways.
    const speedFactor = Math.min(1, speed / (t.maxSpeed * 0.35));
    const { curvature } = sampleTrack(state.track, vehicle.distance);

    lateral += input.steer * t.steerRate * speedFactor * TICK_SECONDS;
    // A corner throws the vehicle towards its outside edge, harder the faster
    // it is going. This is what makes braking for a bend matter.
    lateral -= curvature * speed * t.centrifugal * TICK_SECONDS;

    lean += (input.steer - lean) * t.leanRate * TICK_SECONDS;
    lean = clamp(lean, -1, 1);

    let crashTicks = Math.max(0, vehicle.crashTicks - 1);

    // The wall. Scrape it and you lose speed and are pushed back onto the road.
    const wallLimit = 1.25;
    if (Math.abs(lateral) > wallLimit) {
      // Nudged back inside the wall, not parked exactly on it: a vehicle left
      // touching the limit grinds along it, re-triggering the hit every tick.
      lateral = Math.sign(lateral) * (wallLimit - 0.02);
      speed *= t.wallPenalty;
      if (crashTicks === 0) events.push({ type: "CRASHED", playerId: vehicle.playerId });
      crashTicks = Math.max(crashTicks, Math.floor(t.crashStunTicks / 2));
    }

    const previousDistance = vehicle.distance;
    const distance = previousDistance + speed * TICK_SECONDS;

    // Collisions are tested against the span travelled this tick, not against
    // the end position. At 90 m/s a vehicle covers 1.5 m per tick and would
    // otherwise drive straight through anything narrower than that.
    for (const obstacle of state.track.obstacles) {
      if (obstacle.distance <= previousDistance || obstacle.distance > distance) continue;
      if (Math.abs(obstacle.lateral - lateral) > obstacle.halfWidth + t.halfWidth) continue;

      speed *= t.crashPenalty;
      crashTicks = t.crashStunTicks;
      events.push({ type: "CRASHED", playerId: vehicle.playerId });
      break;
    }

    for (const coin of state.track.coins) {
      if (coin.distance <= previousDistance || coin.distance > distance) continue;
      if (Math.abs(coin.lateral - lateral) > 0.28) continue;

      const key = coinKey(coin.distance, coin.lateral);
      if (collected.has(key)) continue;
      collected.add(key);
      coins += 1;
      events.push({ type: "COIN_COLLECTED", playerId: vehicle.playerId, value: coins });
    }

    // Checkpoints reset each lap, so the progress bar measures the lap being
    // driven rather than the whole race.
    const alongLap = ((distance % state.track.length) + state.track.length) % state.track.length;
    const reached = state.track.checkpoints.filter((at) => alongLap >= at).length;
    if (reached !== checkpoint) {
      if (reached > checkpoint) {
        events.push({ type: "CHECKPOINT", playerId: vehicle.playerId, value: reached });
      }
      checkpoint = reached;
    }

    // Laps are counted from total distance travelled rather than by wrapping
    // it, so the standings can order a field spread across different laps by
    // comparing one number.
    let lapsDone = vehicle.lapsDone;
    let lapStartTick = vehicle.lapStartTick;
    let lapTicks = vehicle.lapTicks;
    let bestLapTicks = vehicle.bestLapTicks;

    // Clamped at zero: the grid is behind the line, so distance starts
    // negative and would otherwise report a lap count of minus one.
    const lapsCrossed = Math.max(0, Math.floor(distance / state.track.length));
    if (lapsCrossed > lapsDone) {
      const lapTime = tick - lapStartTick;
      lapsDone = lapsCrossed;
      lapStartTick = tick;
      lapTicks = [...lapTicks, lapTime];
      bestLapTicks = bestLapTicks === null ? lapTime : Math.min(bestLapTicks, lapTime);
      events.push({ type: "LAP_COMPLETED", playerId: vehicle.playerId, value: lapsDone });
    }

    let finishedAtTick = vehicle.finishedAtTick;
    if (finishedAtTick === null && lapsDone >= state.laps) {
      finishedAtTick = tick;
      events.push({ type: "VEHICLE_FINISHED", playerId: vehicle.playerId, value: tick });
    }

    return {
      ...vehicle,
      distance,
      lateral: clamp(lateral, -wallLimit, wallLimit),
      speed,
      lean,
      nitroCharges,
      nitroUntilTick,
      coins,
      crashTicks,
      checkpoint,
      lapsDone,
      lapStartTick,
      lapTicks,
      bestLapTicks,
      finishedAtTick,
      // Nitro is edge-triggered, so the request is consumed once it is read.
      input: { ...vehicle.input, nitro: false },
    };
  }

  getPlayerView(state: RacingGameState, playerId: string | null): RacingPlayerView {
    const vehicles = state.playerOrder
      .map((id) => state.vehicles[id])
      .filter((v): v is VehicleState => Boolean(v));

    const standings = [...vehicles]
      .sort((a, b) => {
        if (a.finishedAtTick !== null || b.finishedAtTick !== null) {
          if (a.finishedAtTick === null) return 1;
          if (b.finishedAtTick === null) return -1;
          return a.finishedAtTick - b.finishedAtTick;
        }
        return b.distance - a.distance;
      })
      .map((v, i) => ({
        playerId: v.playerId,
        place: v.place ?? i + 1,
        distance: v.distance,
        finished: v.finishedAtTick !== null,
        lapsDone: v.lapsDone,
        bestLapTicks: v.bestLapTicks,
      }));

    return {
      phase: state.phase,
      racingPhase: state.racingPhase,
      isFinished: state.isFinished,
      tick: state.tick,
      countdown:
        state.racingPhase === "countdown"
          ? Math.ceil((COUNTDOWN_TICKS - state.tick) / TICK_RATE)
          : 0,
      trackSeed: state.track.seed,
      trackLength: state.track.length,
      laps: state.laps,
      raceTicks: Math.max(0, state.tick - COUNTDOWN_TICKS),
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
      completedAt: new Date().toISOString(),
      distances: Object.fromEntries(ordered.map((v) => [v.playerId, Math.round(v.distance)])),
      coins: Object.fromEntries(ordered.map((v) => [v.playerId, v.coins])),
    } as RacingResult;
  }

  /** Metres of road either side of the centreline. Shared with the renderer. */
  roadHalfWidth(): number {
    return ROAD_HALF_WIDTH;
  }

  /** Exposed so bots and the client can reason with the same numbers. */
  vehicleTuning(): VehicleTuning {
    return this.tuning();
  }

  trackOf(state: RacingGameState): TrackSpec {
    return state.track;
  }
}

export function coinKey(distance: number, lateral: number): string {
  return `${distance}:${lateral}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
