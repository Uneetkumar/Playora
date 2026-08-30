import type { GameId } from "@playora/game-types";
import { RacingEngine, type VehicleTuning } from "./RacingEngine.js";

/**
 * Bike Race.
 *
 * The same road, a different contract with it. A bike out-accelerates a car and
 * changes direction faster, but it is thrown further by a corner, punished
 * harder for a mistake, and takes longer to get going again. It is narrower,
 * so gaps a car cannot take are open to it — which is the reason to ride one.
 */
export class BikeRaceEngine extends RacingEngine {
  override readonly gameId: GameId = "bike-race";
  override readonly minPlayers = 1;
  override readonly maxPlayers = 8;

  protected tuning(): VehicleTuning {
    return {
      maxSpeed: 72,
      // Quicker off the line than the car, and quicker to recover a lost run.
      acceleration: 32,
      brakePower: 40,
      engineBrake: 11,
      // Flicks between lanes; the cost is that it keeps going when you stop asking.
      steerRate: 2.1,
      // Higher than the car's, and it has more steering authority to answer
      // with. A bike is thrown further and turns harder.
      centrifugal: 1.3,
      offRoadDrag: 34,
      offRoadMaxSpeed: 24,
      // No bodywork to scrape: touching the wall costs far more than in a car.
      wallPenalty: 0.5,
      crashPenalty: 0.18,
      crashStunTicks: 48,
      nitroMultiplier: 1.45,
      nitroTicks: 140,
      // Half the width of a car, so it fits through gaps a car has to avoid.
      halfWidth: 0.08,
      leanRate: 11,
    };
  }
}
