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
  type PickupKind,
  type SetInputPayload,
  type TrackZone,
  type ZoneKind,
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
        zone: null,
        shielded: false,
        magnetUntilTick: 0,
        offTrackTicks: 0,
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
      collectedPickups: [],
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
    const takenPickups = new Set(state.collectedPickups);
    const vehicles: Record<string, VehicleState> = {};
    let finishedCount = 0;

    for (const playerId of state.playerOrder) {
      const vehicle = state.vehicles[playerId];
      if (!vehicle) continue;

      vehicles[playerId] =
        vehicle.finishedAtTick !== null
          ? vehicle
          : this.stepVehicle(state, vehicle, tick, collected, takenPickups, events);

      if (vehicles[playerId]!.finishedAtTick !== null) finishedCount += 1;
    }

    // Vehicle-to-Vehicle Physical Collision & Contact Response
    this.resolveVehicleCollisions(vehicles, tick, events);

    // Places are assigned in finish order, and re-derived every tick so a
    // vehicle that finishes on the same tick as another still gets a distinct
    // place rather than sharing one.
    const finishers = Object.values(vehicles)
      .filter((v) => v.finishedAtTick !== null)
      .sort((a, b) => a.finishedAtTick! - b.finishedAtTick! || b.distance - a.distance);
    finishers.forEach((v, i) => {
      vehicles[v.playerId] = { ...v, place: i + 1 };
    });

    const localHumanFinished = Boolean(vehicles["local-you"] && vehicles["local-you"].finishedAtTick !== null);
    const everyoneHome = finishedCount >= state.playerOrder.length;
    /*
     * Once the podium is settled the race is decided, and watching the last
     * car trundle home decides nothing. Capped at the field size so a
     * two-player race still has to finish properly rather than ending the
     * moment nobody can reach third.
     */
    const podiumSize = Math.min(PODIUM_PLACES, state.playerOrder.length);
    const podiumSettled = finishedCount >= podiumSize;
    const outOfTime = tick >= state.hardStopTick;
    const raceOver = everyoneHome || podiumSettled || localHumanFinished || outOfTime;

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
        collectedPickups: [...takenPickups],
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
      collectedPickups: [...takenPickups],
      updatedAt: Date.now(),
    };
  }

  /** One vehicle, one tick. */
  private stepVehicle(
    state: RacingGameState,
    vehicle: VehicleState,
    tick: number,
    collected: Set<string>,
    /** Power-ups already taken, kept apart from the coins. */
    takenPickups: Set<string>,
    events: RacingEvent[],
  ): VehicleState {
    const t = this.vehicleTuningFor(vehicle.vehicleId);
    const stunned = vehicle.crashTicks > 0;
    const input = stunned ? NEUTRAL_INPUT : vehicle.input;

    let { speed, lateral, lean, nitroCharges, nitroUntilTick, coins, checkpoint } = vehicle;
    let shielded = vehicle.shielded;
    let magnetUntilTick = vehicle.magnetUntilTick;

    // Nitro. A charge is spent on the rising edge only, so holding the key does
    // not empty the bottle.
    if (input.nitro && nitroCharges > 0 && nitroUntilTick <= tick && !stunned) {
      nitroCharges -= 1;
      nitroUntilTick = tick + t.nitroTicks;
      events.push({ type: "NITRO_USED", playerId: vehicle.playerId, value: nitroCharges });
    }
    const boosting = nitroUntilTick > tick;

    const offRoad = Math.abs(lateral) > 1;

    /*
     * Staged off-track penalty (spec sections 19 and 20).
     *
     * A brief excursion costs nothing — that is a driver using the width of
     * the road. Stay out and grip goes first, then speed. Being punished from
     * the first frame outside the line turns every corner exit into a coin
     * flip, which is the opposite of the "punishable but not frustrating" the
     * spec asks for.
     */
    const offTrackTicks = offRoad ? vehicle.offTrackTicks + 1 : 0;
    const offTrackStage =
      !offRoad || offTrackTicks <= OFF_TRACK_GRACE_TICKS
        ? 0
        : offTrackTicks <= OFF_TRACK_PENALTY_TICKS
          ? 1
          : 2;
    const baseCeiling = boosting
      ? t.maxSpeed * t.nitroMultiplier
      : offTrackStage === 2
        ? t.offRoadMaxSpeed
        : t.maxSpeed;

    // Aerodynamic Slipstream / Drafting
    let isDrafting = false;
    for (const other of Object.values(state.vehicles)) {
      if (other.playerId === vehicle.playerId || other.finishedAtTick !== null) continue;
      const gap = other.distance - vehicle.distance;
      if (gap > 1.5 && gap < 28 && Math.abs(other.lateral - lateral) < 0.5) {
        isDrafting = true;
        break;
      }
    }

    const effectiveCeiling = isDrafting && !offRoad ? baseCeiling * 1.06 : baseCeiling;

    if (stunned) {
      speed -= t.brakePower * 0.6 * TICK_SECONDS;
    } else if (input.brake) {
      speed -= t.brakePower * TICK_SECONDS;
    } else if (input.throttle) {
      // Acceleration tails off near the ceiling instead of stopping dead, which
      // is what makes a top-speed run feel like effort rather than a wall.
      const headroom = Math.max(0, 1 - speed / Math.max(1, effectiveCeiling));
      const draftBonus = isDrafting ? 0.35 : 0;
      speed += t.acceleration * (0.42 + 0.58 * headroom + draftBonus) * TICK_SECONDS * (boosting ? 1.65 : 1);
    } else {
      speed -= t.engineBrake * TICK_SECONDS;
    }

    if (offTrackStage > 0) {
      // Stage 2 drags twice as hard as stage 1.
      const bite = offTrackStage === 1 ? 1 : 2;
      speed -= t.offRoadDrag * bite * (0.25 + (0.75 * speed) / t.maxSpeed) * TICK_SECONDS;
    }
    speed = clamp(speed, 0, effectiveCeiling);

    /*
     * Which painted zone the vehicle is standing in.
     *
     * Recomputed from position every tick and never carried over. A client
     * cannot be allowed to assert "I am in a nitro zone" (spec v2 section 58),
     * and a remembered flag is exactly the kind of state that survives a
     * teleport or a rewind and hands out free speed.
     */
    // Resolved from where the vehicle is at the start of the tick, not where it
    // ends up: the surface you are standing on is what governs this tick's
    // grip and drag. Using the post-move position would let a car pick up the
    // grip of tarmac it has not reached yet.
    const zone = zoneAt(state.track.zones, vehicle.distance, lateral);
    const zoneGrip = zone === "grip" ? 1.35 : zone === "slick" ? 0.55 : 1;

    /*
     * A nitro strip refills the bar, but only up to the vehicle's own capacity
     * and only one charge per crossing. Awarding per tick would hand a driver
     * who parks on the strip an unbounded supply, which is the kind of thing
     * that is obvious in hindsight and invisible until someone does it.
     */
    if (zone === "nitro" && vehicle.zone !== "nitro") {
      const capacity = this.defaultNitroCharges();
      if (nitroCharges < capacity) {
        nitroCharges += 1;
        events.push({ type: "NITRO_USED", playerId: vehicle.playerId, value: nitroCharges });
      }
    }

    if (zone === "slow") {
      speed -= t.offRoadDrag * 0.7 * (0.25 + (0.75 * speed) / t.maxSpeed) * TICK_SECONDS;
    } else if (zone === "boost") {
      // Additive rather than a multiplier, so a boost strip helps a slow car
      // more than a fast one and cannot push anything past its ceiling.
      speed = Math.min(effectiveCeiling, speed + t.acceleration * 0.9 * TICK_SECONDS);
    }
    speed = clamp(speed, 0, effectiveCeiling);

    // High-Speed Aerodynamic Downforce & Grip
    const speedRatio = speed / Math.max(1, t.maxSpeed);
    const speedFactor = Math.min(1, speed / (t.maxSpeed * 0.35));
    const downforceGrip = 1.0 + Math.min(0.55, speedRatio * speedRatio * 0.55);
    const { curvature } = sampleTrack(state.track, vehicle.distance);

    // Dynamic Lateral Drift & Steering
    const isDrifting = Math.abs(input.steer) > 0.45 && speed > t.maxSpeed * 0.45 && !offRoad;
    const effectiveSteerRate = isDrifting ? t.steerRate * 1.25 : t.steerRate;
    // Grip scales both halves of cornering together: a slick surface makes the
    // vehicle both slower to turn in and worse at resisting being pushed wide,
    // which is what actually feels like losing grip. Scaling only one produces
    // a car that understeers but never slides, or slides but still turns.
    lateral += input.steer * effectiveSteerRate * zoneGrip * speedFactor * TICK_SECONDS;
    lateral -= (curvature * speed * t.centrifugal * TICK_SECONDS) / (downforceGrip * zoneGrip);

    // Leaning with dynamic suspension roll response
    const targetLean = isDrifting ? input.steer * 1.35 : input.steer;
    lean += (targetLean - lean) * t.leanRate * TICK_SECONDS;
    lean = clamp(lean, -1.2, 1.2);

    let crashTicks = Math.max(0, vehicle.crashTicks - 1);

    // The wall. Scrape it and you lose speed and are pushed back onto the road.
    /*
     * Where the barrier actually is.
     *
     * This was 1.25 — a quarter of the road's half-width *past* the painted
     * edge, which is two metres of drivable space outside the track. That is
     * why a car could sit on top of the kerb and keep going: the wall was
     * nowhere near the line the player can see.
     *
     * A car is about 1.9m wide against a half-width of 8m, so its own edge is
     * roughly 0.12 in lateral units. Stopping the centre at 1 - 0.12 puts the
     * bodywork against the barrier with nothing hanging over it.
     */
    /*
     * The barrier sits beyond the run-off, not on the painted line.
     *
     * This was briefly `1 - VEHICLE_HALF_WIDTH_LATERAL`, which put the wall
     * *inside* the road edge — and since off-track is defined as `|lateral| > 1`,
     * that made the entire off-track system unreachable. There was nowhere to
     * run wide to, which on a circuit with 20m hairpins is unplayable.
     *
     * The complaint it was fixing was real, though: you could sit on the kerb
     * indefinitely at no cost. The fix is a penalty for being out there, not
     * the removal of the space.
     */
    const wallLimit = RUN_OFF_LIMIT - VEHICLE_HALF_WIDTH_LATERAL;
    if (Math.abs(lateral) > wallLimit) {
      lateral = Math.sign(lateral) * (wallLimit - 0.005);
      speed *= t.wallPenalty;
      if (crashTicks === 0) events.push({ type: "CRASHED", playerId: vehicle.playerId });
      crashTicks = Math.max(crashTicks, Math.floor(t.crashStunTicks / 2));
    }

    const previousDistance = vehicle.distance;
    const distance = previousDistance + speed * TICK_SECONDS;

    // 1. Ground Boost Pads Interaction
    if (state.track.boostPads) {
      for (const pad of state.track.boostPads) {
        if (pad.distance <= previousDistance || pad.distance > distance) continue;
        if (Math.abs(pad.lateral - lateral) <= (pad.halfWidth || 0.35) + t.halfWidth) {
          // Instant high-speed booster push
          speed = Math.max(speed * 1.32, t.maxSpeed * 1.25);
          nitroUntilTick = Math.max(nitroUntilTick, tick + 42);
          events.push({ type: "NITRO_USED", playerId: vehicle.playerId, value: nitroCharges });
          break;
        }
      }
    }

    // 2. Obstacles & Hazards Collision
    const speedBeforeImpact = speed;
    for (const obstacle of state.track.obstacles) {
      if (obstacle.distance <= previousDistance || obstacle.distance > distance) continue;
      if (Math.abs(obstacle.lateral - lateral) > obstacle.halfWidth + t.halfWidth) continue;

      switch (obstacle.kind) {
        case "barrel":
          speed *= 0.38;
          crashTicks = Math.floor(t.crashStunTicks * 1.2);
          break;
        case "spikes":
          speed *= 0.32;
          crashTicks = t.crashStunTicks;
          break;
        case "laser":
          speed *= 0.48;
          crashTicks = Math.floor(t.crashStunTicks * 0.75);
          break;
        case "cone":
          speed *= 0.82;
          crashTicks = Math.floor(t.crashStunTicks * 0.3);
          break;
        case "barrier":
        case "block":
        default:
          speed *= t.crashPenalty;
          crashTicks = t.crashStunTicks;
          break;
      }

      /*
       * A shield absorbs the hit outright: no speed loss, no stun, and it is
       * spent. Checked after the switch so the damage numbers above stay in one
       * place, and applied by restoring what they changed rather than by
       * skipping them — the obstacle still counts as struck, which matters for
       * the barrel that would otherwise be hit again next tick.
       */
      if (shielded) {
        shielded = false;
        speed = speedBeforeImpact;
        crashTicks = 0;
        events.push({ type: "SHIELD_BROKEN", playerId: vehicle.playerId });
        break;
      }

      events.push({ type: "CRASHED", playerId: vehicle.playerId });
      break;
    }

    // 2b. Power-up pickups
    for (const pickup of state.track.pickups ?? []) {
      if (pickup.distance <= previousDistance || pickup.distance > distance) continue;
      if (Math.abs(pickup.lateral - lateral) > 0.3) continue;

      /*
       * Namespaced away from the coins.
       *
       * `collectedCoins` is the record of which coins are gone, and the coin
       * count is asserted against its length. Filing a pickup under a bare
       * `coinKey` broke that invariant — the set grew without any coin being
       * credited — and would also have made a pickup sitting at the same spot
       * as a coin swallow the coin.
       */
      const key = coinKey(pickup.distance, pickup.lateral);
      if (takenPickups.has(key)) continue;
      takenPickups.add(key);

      const kind = pickup.kind ?? rollMysteryBox(tick, pickup.distance);
      const capacity = this.defaultNitroCharges();

      switch (kind) {
        case "nitro":
          nitroCharges = Math.min(capacity, nitroCharges + 1);
          break;
        case "perfectNitro":
          nitroCharges = capacity;
          break;
        case "shield":
          shielded = true;
          break;
        case "magnet":
          magnetUntilTick = tick + MAGNET_TICKS;
          break;
        case "repair":
          // Clears the stun and returns a chunk of the speed the crash took.
          // Not a full restore: a repair that undoes a crash entirely removes
          // the reason to avoid crashing.
          crashTicks = 0;
          speed = Math.min(effectiveCeiling, speed + t.maxSpeed * 0.25);
          break;
      }

      events.push({ type: "PICKUP_COLLECTED", playerId: vehicle.playerId, value: nitroCharges });
    }

    // 3. Coin Pickups
    for (const coin of state.track.coins) {
      if (coin.distance <= previousDistance || coin.distance > distance) continue;
      // A magnet reaches across the road; without one you must actually drive
      // over the coin.
      const reach = magnetUntilTick > tick ? MAGNET_REACH : 0.28;
      if (Math.abs(coin.lateral - lateral) > reach) continue;

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
      zone,
      shielded,
      magnetUntilTick,
      offTrackTicks,
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

  /**
   * Resolves physical bumping, lateral deflection, and tactile contact between vehicles.
   */
  private resolveVehicleCollisions(
    vehicles: Record<string, VehicleState>,
    _tick: number,
    events: RacingEvent[],
  ): void {
    const list = Object.values(vehicles);
    const count = list.length;
    if (count < 2) return;

    for (let i = 0; i < count; i++) {
      const vA = list[i]!;
      if (vA.finishedAtTick !== null) continue;
      const tA = this.vehicleTuningFor(vA.vehicleId);

      for (let j = i + 1; j < count; j++) {
        const vB = list[j]!;
        if (vB.finishedAtTick !== null) continue;
        const tB = this.vehicleTuningFor(vB.vehicleId);

        // Check longitudinal distance overlap (along track)
        const distDiff = Math.abs(vA.distance - vB.distance);
        const contactLength = 4.0; // Bumper-to-bumper collision threshold in meters

        if (distDiff < contactLength) {
          // Check lateral overlap across track width
          const latDiff = vA.lateral - vB.lateral; // positive if A is to the right of B
          const minLatGap = tA.halfWidth + tB.halfWidth + 0.12; // Total collision width

          if (Math.abs(latDiff) < minLatGap) {
            // VEHICLES ARE PHYSICALLY TOUCHING / COLLIDING!
            const overlap = minLatGap - Math.abs(latDiff);
            const pushDir = latDiff === 0 ? (i % 2 === 0 ? 1 : -1) : Math.sign(latDiff);

            // 1. Lateral Repulsion (Push bodies apart so they bump & touch without phasing through)
            const pushAmount = Math.max(0.045, overlap * 0.55);
            vA.lateral = clamp(vA.lateral + pushDir * pushAmount, -1.22, 1.22);
            vB.lateral = clamp(vB.lateral - pushDir * pushAmount, -1.22, 1.22);

            // 2. Physical chassis contact tilt / Body shock
            vA.lean = clamp(vA.lean - pushDir * 0.45, -1, 1);
            vB.lean = clamp(vB.lean + pushDir * 0.45, -1, 1);

            // 3. Longitudinal Momentum / Drafting Bumper Bump
            if (distDiff < 2.8) {
              const speedDiff = vA.speed - vB.speed;
              if (Math.abs(speedDiff) > 1.5) {
                if (vA.distance < vB.distance) {
                  // A bumped B from behind
                  vA.speed = Math.max(0, vA.speed - 3.8);
                  vB.speed = Math.min(tB.maxSpeed * 1.12, vB.speed + 2.4);
                } else {
                  // B bumped A from behind
                  vB.speed = Math.max(0, vB.speed - 3.8);
                  vA.speed = Math.min(tA.maxSpeed * 1.12, vA.speed + 2.4);
                }
              }
            }

            // 4. Contact friction sparks & tactile feedback
            vA.crashTicks = Math.max(vA.crashTicks, 3);
            vB.crashTicks = Math.max(vB.crashTicks, 3);

            events.push({
              type: "CRASHED",
              playerId: vA.playerId,
            });
            events.push({
              type: "CRASHED",
              playerId: vB.playerId,
            });
          }
        }
      }
    }
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

/**
 * The zone covering a point on the track, or null.
 *
 * Returns the first match rather than blending overlaps: two zones on the same
 * patch of tarmac is a track-generation mistake, and quietly averaging their
 * effects would hide it. Generation already refuses to place a zone inside an
 * obstacle for the same reason.
 */
/**
 * Half a vehicle's width, in lateral units (where 1 is the road edge).
 *
 * Cars are ~1.9m wide and the road half-width is 8m.
 */
const VEHICLE_HALF_WIDTH_LATERAL = 0.12;

/**
 * How far past the road edge the barrier sits.
 *
 * The gap between 1 (the painted line) and this is run-off: usable, but it
 * costs you.
 */
const RUN_OFF_LIMIT = 1.35;

/** Ticks off-track that cost nothing — about three quarters of a second. */
const OFF_TRACK_GRACE_TICKS = 45;

/** Ticks after which the penalty escalates — about two seconds. */
const OFF_TRACK_PENALTY_TICKS = 120;

/** Finishing positions that decide a race. */
const PODIUM_PLACES = 3;

/** How long a coin magnet lasts, in ticks. */
const MAGNET_TICKS = TICK_RATE * 6;
/** Lateral reach while a magnet is active, against 0.28 without one. */
const MAGNET_REACH = 0.85;

/**
 * Decides what a mystery box contains, at the moment it is opened.
 *
 * Deterministic in the tick and the box's position, so a replay of the same
 * race produces the same contents and two clients simulating the same state
 * agree — but not knowable from the track seed alone, which is what would
 * happen if the contents were fixed at generation time. Every client rebuilds
 * the track from the seed, so anything decided there is readable in advance.
 */
function rollMysteryBox(tick: number, distance: number): PickupKind {
  const table: PickupKind[] = ["nitro", "shield", "magnet", "repair", "perfectNitro"];
  // A cheap integer hash; the inputs are small and adjacent boxes must not
  // produce a run of the same prize.
  const mixed = Math.imul(tick + 1, 2654435761) ^ Math.imul(distance + 1, 40503);
  return table[Math.abs(mixed) % table.length]!;
}

function zoneAt(zones: TrackZone[], distance: number, lateral: number): ZoneKind | null {
  for (const zone of zones) {
    if (distance < zone.distance || distance > zone.distance + zone.length) continue;
    if (Math.abs(lateral - zone.lateral) > zone.halfWidth) continue;
    return zone.kind;
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
