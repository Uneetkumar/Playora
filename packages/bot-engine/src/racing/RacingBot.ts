import {
  CarRaceEngine,
  sampleTrack,
  type RacingAction,
  type RacingEngine,
  type RacingGameState,
  type TrackObstacle,
  type VehicleState,
} from "@playora/game-engine";
import type { GameId } from "@playora/game-types";
import type { AiLevel, BotEngine, RandomSource } from "../types.js";

interface LevelProfile {
  /** Metres of road the driver reads ahead. Short sight is what makes a novice. */
  lookahead: number;
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
  1: { lookahead: 25, correction: 1.1, cornerSpeed: 0.55, lapseChance: 0.4, sloppiness: 0.5, usesNitroWell: false, avoidsObstacles: false, collectsCoins: false, thinkMs: 120 },
  2: { lookahead: 40, correction: 1.5, cornerSpeed: 0.65, lapseChance: 0.28, sloppiness: 0.38, usesNitroWell: false, avoidsObstacles: false, collectsCoins: false, thinkMs: 110 },
  3: { lookahead: 55, correction: 1.9, cornerSpeed: 0.74, lapseChance: 0.18, sloppiness: 0.28, usesNitroWell: false, avoidsObstacles: true, collectsCoins: false, thinkMs: 100 },
  4: { lookahead: 70, correction: 2.3, cornerSpeed: 0.82, lapseChance: 0.11, sloppiness: 0.2, usesNitroWell: true, avoidsObstacles: true, collectsCoins: true, thinkMs: 90 },
  5: { lookahead: 85, correction: 2.7, cornerSpeed: 0.88, lapseChance: 0.06, sloppiness: 0.13, usesNitroWell: true, avoidsObstacles: true, collectsCoins: true, thinkMs: 80 },
  6: { lookahead: 100, correction: 3.1, cornerSpeed: 0.94, lapseChance: 0.02, sloppiness: 0.07, usesNitroWell: true, avoidsObstacles: true, collectsCoins: true, thinkMs: 70 },
  7: { lookahead: 120, correction: 3.5, cornerSpeed: 1.0, lapseChance: 0, sloppiness: 0, usesNitroWell: true, avoidsObstacles: true, collectsCoins: true, thinkMs: 60 },
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
    const tuning = this.engine.vehicleTuning();

    // A lapse is a moment of inattention: the driver keeps its foot in but
    // stops correcting. That drifts it wide, which is what a weak driver does.
    if (this.random() < profile.lapseChance) {
      return this.action(playerId, { steer: vehicle.input.steer * 0.5, throttle: true, brake: false });
    }

    const targetLateral = this.chooseLane(state, vehicle, profile);
    const { curvature } = sampleTrack(state.track, vehicle.distance);

    // Steering has two jobs: hold the line against the corner, and close the
    // gap to where it wants to be.
    const holdCorner = curvature * 26;
    const closeGap = (targetLateral - vehicle.lateral) * profile.correction;
    const steer = clamp(holdCorner + closeGap, -1, 1);

    // Corner speed. The tightest curvature within the lookahead decides whether
    // it should already be braking, which is why lookahead is the skill dial.
    const worstCurve = this.sharpestCurveAhead(state, vehicle, profile.lookahead);
    const cornerCeiling = tuning.maxSpeed * profile.cornerSpeed * (1 - Math.min(0.55, worstCurve * 14));
    const tooFast = vehicle.speed > cornerCeiling;

    const nitro = this.wantsNitro(state, vehicle, profile, worstCurve);

    return this.action(playerId, {
      steer,
      throttle: !tooFast,
      brake: tooFast && vehicle.speed > cornerCeiling * 1.15,
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
  ): number {
    const { curvature } = sampleTrack(state.track, vehicle.distance + 30);
    // The inside of a bend is the shorter way round, so it is where to be.
    const racingLine = clamp(curvature * 20, -0.6, 0.6);

    if (!profile.avoidsObstacles) {
      return racingLine + (this.random() - 0.5) * profile.sloppiness * 2;
    }

    const horizon = vehicle.distance + Math.max(30, profile.lookahead);
    const ahead = state.track.obstacles.filter(
      (o) => o.distance > vehicle.distance && o.distance < horizon,
    );
    const coins = profile.collectsCoins
      ? state.track.coins.filter((c) => c.distance > vehicle.distance && c.distance < horizon)
      : [];

    let best = racingLine;
    let bestScore = -Infinity;

    for (const lane of LANES) {
      let score = 0;

      // Blocked lanes are not merely worse, they are disqualifying — weighted
      // by how soon the obstacle arrives, so a distant one still leaves room
      // to plan rather than swerving immediately.
      const blocker = this.blockingObstacle(ahead, lane);
      if (blocker) {
        const gap = blocker.distance - vehicle.distance;
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

  private blockingObstacle(obstacles: TrackObstacle[], lane: number): TrackObstacle | null {
    const tuning = this.engine.vehicleTuning();
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
  ): boolean {
    if (vehicle.nitroCharges <= 0 || vehicle.crashTicks > 0) return false;
    if (!profile.usesNitroWell) return this.random() < 0.004;

    const straightAhead = worstCurve < 0.008;
    const nearFullSpeed = vehicle.speed > this.engine.vehicleTuning().maxSpeed * 0.7;
    const clearRoad = !this.blockingObstacle(
      state.track.obstacles.filter(
        (o) => o.distance > vehicle.distance && o.distance < vehicle.distance + 120,
      ),
      vehicle.lateral,
    );
    const runningOutOfRoad = state.track.length - vehicle.distance < 400;

    return straightAhead && clearRoad && (nearFullSpeed || runningOutOfRoad);
  }

  private action(playerId: string, payload: Record<string, unknown>): RacingAction {
    return { type: "SET_INPUT", playerId, payload, timestamp: Date.now() } as RacingAction;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
