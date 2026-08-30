import type { GameId } from "@playora/game-types";
import { RacingEngine, type VehicleTuning } from "./RacingEngine.js";

/**
 * Car Race.
 *
 * The grippy, forgiving one. A car carries speed through a corner, survives a
 * wall scrape, and recovers quickly from a hit — so the challenge is the racing
 * line and when to spend nitro, not staying upright.
 */
export class CarRaceEngine extends RacingEngine {
  override readonly gameId: GameId = "car-race";
  override readonly minPlayers = 1;
  override readonly maxPlayers = 8;

  protected tuning(): VehicleTuning {
    return {
      // 78 m/s is about 280 km/h, which reads as fast without making the road
      // arrive quicker than a player can react to it.
      maxSpeed: 78,
      acceleration: 26,
      brakePower: 46,
      engineBrake: 9,
      steerRate: 1.5,
      // Set so the tightest corner on a circuit is *just* holdable at full
      // lock and top speed. Lower than this and cornering is free: nothing
      // demands a lift, braking never pays, and grip stops being a trade-off
      // worth choosing a car for.
      centrifugal: 0.9,
      offRoadDrag: 26,
      offRoadMaxSpeed: 30,
      wallPenalty: 0.72,
      crashPenalty: 0.35,
      crashStunTicks: 30,
      nitroMultiplier: 1.35,
      nitroTicks: 150,
      halfWidth: 0.16,
      leanRate: 7,
    };
  }
}
