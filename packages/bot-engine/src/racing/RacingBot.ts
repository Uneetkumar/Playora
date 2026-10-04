import {
  CarRaceEngine,
  cornerGripOf,
  distanceAhead,
  planCorner,
  sampleTrack,
  steerToward,
  type RacingAction,
  type RacingEngine,
  type RacingGameState,
  type TrackObstacle,
  type VehicleState,
  type VehicleTuning,
} from "@playora/game-engine";
import type { GameId } from "@playora/game-types";

import type { AiLevel, BotEngine, RandomSource } from "../types.js";

interface LevelProfile {
  /** Metres of road the driver reads ahead. Short sight is what makes a novice. */
  /**
   * How far ahead the driver reads the track, in metres.
   *
   * These were 25-120m. Braking from 78 m/s to a 123m-radius corner takes
   * about 106m plus margin — so even the best bot could not see far enough to
   * brake in time, and every one of them arrived at corners too fast. They now
   * span a range where the top level can genuinely plan a corner and the
   * bottom genuinely cannot.
   */
  lookahead: number;
  /**
   * Safety margin on the braking point.
   *
   * This is the difficulty dial that is not "go faster" (spec section 63): a
   * beginner brakes far too early and loses time, an expert brakes near the
   * limit.
   */
  brakeMargin: number;
  /**
   * Fraction of the car's top speed this driver actually uses on a straight.
   *
   * Needed because these tracks have no corner tight enough to demand braking
   * — measured, every bend is flat for this car — so once the corner model was
   * corrected, every difficulty drove flat out and the ladder collapsed to a
   * 10% spread. This is the one dial spec section 65 explicitly permits:
   * adjusting the AI's own target speed, never the player's physics.
   */
  pace: number;
  /** How firmly it corrects back to the line, per second. */
  correction: number;
  /** Fraction of top speed it is willing to carry into a corner. */
  cornerSpeed: number;
  /** Chance per decision of doing nothing useful — a lapse, not a policy. */
  lapseChance: number;
  /** Lateral error it aims for instead of the ideal line. */
  sloppiness: number;
  /** Whether it spends nitro deliberately rather than at random. */
  usesNitroWell: boolean;
  /** Whether it steers around obstacles at all. */
  avoidsObstacles: boolean;
  /** Whether it detours for coins. */
  collectsCoins: boolean;
  thinkMs: number;
}

const PROFILES: Record<AiLevel, LevelProfile> = {
  1: { lookahead: 70, brakeMargin: 1.1, pace: 0.5, correction: 1.1, cornerSpeed: 0.55, lapseChance: 0.4, sloppiness: 0.5, usesNitroWell: false, avoidsObstacles: false, collectsCoins: false, thinkMs: 120 },
  2: { lookahead: 95, brakeMargin: 0.85, pace: 0.62, correction: 1.5, cornerSpeed: 0.65, lapseChance: 0.28, sloppiness: 0.38, usesNitroWell: false, avoidsObstacles: false, collectsCoins: false, thinkMs: 110 },
  3: { lookahead: 125, brakeMargin: 0.6, pace: 0.78, correction: 1.9, cornerSpeed: 0.74, lapseChance: 0.18, sloppiness: 0.28, usesNitroWell: false, avoidsObstacles: true, collectsCoins: false, thinkMs: 100 },
  4: { lookahead: 155, brakeMargin: 0.42, pace: 0.85, correction: 2.3, cornerSpeed: 0.82, lapseChance: 0.11, sloppiness: 0.2, usesNitroWell: true, avoidsObstacles: true, collectsCoins: true, thinkMs: 90 },
  5: { lookahead: 185, brakeMargin: 0.3, pace: 0.91, correction: 2.7, cornerSpeed: 0.88, lapseChance: 0.06, sloppiness: 0.13, usesNitroWell: true, avoidsObstacles: true, collectsCoins: true, thinkMs: 80 },
  6: { lookahead: 215, brakeMargin: 0.2, pace: 0.96, correction: 3.1, cornerSpeed: 0.94, lapseChance: 0.02, sloppiness: 0.07, usesNitroWell: true, avoidsObstacles: true, collectsCoins: true, thinkMs: 70 },
  7: { lookahead: 240, brakeMargin: 0.12, pace: 1.0, correction: 3.5, cornerSpeed: 1.0, lapseChance: 0, sloppiness: 0, usesNitroWell: true, avoidsObstacles: true, collectsCoins: true, thinkMs: 60 },
};

/** Lateral positions the bot considers when looking for a way through. */
const LANES = [-0.85, -0.55, -0.28, 0, 0.28, 0.55, 0.85];

/**
 * A driver, not a waypoint follower.
 *
 * The bot decides three things every time it is asked: where across the road it
 * wants to be, whether it is going too fast for what is coming, and whether now
 * is the moment for nitro. It then expresses all of that as a SET_INPUT — the
 * same message a human's keyboard produces — so it runs through the identical
 * engine validation and cannot reach a state a player could not.
 *
 * Difficulty is how far ahead it looks and how precisely it corrects, not a
 * multiplier on its top speed. A bot that is simply faster than physics allows
 * is not a harder opponent, it is a cheat, and players can always tell.
 */
export class RacingBot implements BotEngine<RacingGameState, RacingAction> {
  readonly gameId: GameId;

  constructor(
    private readonly engine: RacingEngine = new CarRaceEngine(),
    private readonly random: RandomSource = Math.random,
  ) {
    this.gameId = engine.gameId;
  }

  thinkingTimeMs(level: AiLevel): number {
    return PROFILES[level].thinkMs;
  }

  chooseAction(state: RacingGameState, playerId: string, level: AiLevel): RacingAction | null {
    if (state.isFinished) return null;

    const vehicle = state.vehicles[playerId];
    if (!vehicle || vehicle.finishedAtTick !== null) return null;

    // Nothing to do until the lights change; holding the throttle would not
    // help anyway, because the engine ignores input during the countdown.
    if (state.racingPhase === "countdown") {
      return this.action(playerId, { steer: 0, throttle: false, brake: false });
    }

    const profile = PROFILES[level];
    // The car this seat is actually driving: the roster's cars differ in grip,
    // brakes and top speed, and a bot planning with someone else's numbers
    // brakes for corners its own car could take flat.
    const tuning = this.engine.vehicleTuningFor(vehicle.vehicleId);

    // A lapse is a moment of inattention: the driver keeps its foot in but
    // stops correcting. That drifts it wide, which is what a weak driver does.
    if (this.random() < profile.lapseChance) {
      return this.action(playerId, { steer: vehicle.input.steer * 0.5, throttle: 1, brake: 0 });
    }

    const targetLateral = this.chooseLane(state, vehicle, profile, tuning);

    /*
     * Steering sets a yaw rate in this engine, not a sideways speed, so the
     * bot aims its course at the line and takes the aim off as it arrives
     * (steerToward). A weaker driver closes the gap more lazily.
     */
    const steer = steerToward(tuning, vehicle, state.track, targetLateral, 2.6 / profile.correction);

    /*
     * Corner approach, from braking distance rather than from "am I over the
     * limit right now". `cornerSpeed` is applied as *grip* rather than as a
     * speed cap: a weaker driver behaves as though the car has less grip, so
     * it corners slower everywhere for a physical reason.
     */
    const lookahead = Math.max(profile.lookahead, vehicle.speed * 2.2);
    const plan = planCorner({
      track: state.track,
      distance: vehicle.distance,
      speed: vehicle.speed,
      maxSpeed: tuning.maxSpeed,
      grip: cornerGripOf(tuning, profile.cornerSpeed * 0.92),
      brakingPower: tuning.brakePower,
      lookahead,
      margin: profile.brakeMargin,
    });

    const worstCurve = this.sharpestCurveAhead(state, vehicle, profile.lookahead);
    const nitro = this.wantsNitro(state, vehicle, profile, worstCurve, tuning);

    // A slower driver lifts off once it reaches its own pace, rather than
    // being handed different physics.
    const paceCeiling = tuning.maxSpeed * profile.pace;
    const atPace = vehicle.speed >= paceCeiling;

    return this.action(playerId, {
      steer,
      throttle: atPace ? 0 : plan.throttle,
      brake: plan.brake,
      nitro,
    });
  }

  /**
   * Picks the lateral position to aim for.
   *
   * Scored rather than searched: each candidate lane is judged on whether it is
   * blocked, how far it is from the current position, whether it hugs the
   * inside of the coming corner, and whether there is anything worth collecting
   * on it. The highest score wins.
   */
  private chooseLane(
    state: RacingGameState,
    vehicle: VehicleState,
    profile: LevelProfile,
    tuning: VehicleTuning,
  ): number {
    const { curvature } = sampleTrack(state.track, vehicle.distance + 30);
    // The inside of a bend is the shorter way round, so it is where to be.
    const racingLine = clamp(curvature * 20, -0.6, 0.6);

    if (!profile.avoidsObstacles) {
      return racingLine + (this.random() - 0.5) * profile.sloppiness * 2;
    }

    // Lap-local: object positions are within one lap, the car's distance is
    // the whole race, and comparing the two raw stops working after lap one.
    const horizon = Math.max(30, profile.lookahead);
    const aheadOf = (at: number) => distanceAhead(state.track, vehicle.distance, at);
    const ahead = state.track.obstacles.filter((o) => aheadOf(o.distance) > 0 && aheadOf(o.distance) < horizon);
    const coins = profile.collectsCoins
      ? state.track.coins.filter((c) => aheadOf(c.distance) > 0 && aheadOf(c.distance) < horizon)
      : [];

    let best = racingLine;
    let bestScore = -Infinity;

    for (const lane of LANES) {
      let score = 0;

      // Blocked lanes are not merely worse, they are disqualifying — weighted
      // by how soon the obstacle arrives, so a distant one still leaves room
      // to plan rather than swerving immediately.
      const blocker = this.blockingObstacle(ahead, lane, tuning);
      if (blocker) {
        const gap = aheadOf(blocker.distance);
        score -= 220 - Math.min(180, gap * 1.6);
      }

      score -= Math.abs(lane - racingLine) * 26;
      score -= Math.abs(lane - vehicle.lateral) * 16;
      // Staying on the tarmac matters more than any line.
      score -= Math.abs(lane) > 0.9 ? 60 : 0;

      for (const coin of coins) {
        if (Math.abs(coin.lateral - lane) < 0.22) score += 9;
      }

      if (score > bestScore) {
        bestScore = score;
        best = lane;
      }
    }

    return clamp(best + (this.random() - 0.5) * profile.sloppiness, -0.95, 0.95);
  }

  private blockingObstacle(obstacles: TrackObstacle[], lane: number, tuning: VehicleTuning): TrackObstacle | null {
    for (const obstacle of obstacles) {
      if (Math.abs(obstacle.lateral - lane) < obstacle.halfWidth + tuning.halfWidth + 0.06) {
        return obstacle;
      }
    }
    return null;
  }

  /** The tightest bend within sight, as an absolute curvature. */
  private sharpestCurveAhead(
    state: RacingGameState,
    vehicle: VehicleState,
    lookahead: number,
  ): number {
    let worst = 0;
    for (let ahead = 10; ahead <= lookahead; ahead += 10) {
      const { curvature } = sampleTrack(state.track, vehicle.distance + ahead);
      worst = Math.max(worst, Math.abs(curvature));
    }
    return worst;
  }

  /**
   * Nitro is for a clear straight, not for a corner.
   *
   * Spending it into a bend wastes it — the vehicle cannot use the speed and is
   * thrown off the road — so a competent bot waits, and a poor one does not.
   */
  private wantsNitro(
    state: RacingGameState,
    vehicle: VehicleState,
    profile: LevelProfile,
    worstCurve: number,
    tuning: VehicleTuning,
  ): boolean {
    if (vehicle.nitro <= 0.05 || vehicle.crashTicks > 0) return false;
    if (!profile.usesNitroWell) return this.random() < 0.004;

    const straightAhead = worstCurve < 0.008;
    const nearFullSpeed = vehicle.speed > tuning.maxSpeed * 0.7;
    const clearRoad = !this.blockingObstacle(
      state.track.obstacles.filter((o) => distanceAhead(state.track, vehicle.distance, o.distance) < 120),
      vehicle.lateral,
      tuning,
    );
    const remaining = state.laps * state.track.length - vehicle.distance;
    const runningOutOfRoad = remaining < 400;

    return straightAhead && clearRoad && (nearFullSpeed || runningOutOfRoad);
  }

  private action(playerId: string, payload: Record<string, unknown>): RacingAction {
    return { type: "SET_INPUT", playerId, payload, timestamp: Date.now() } as RacingAction;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
