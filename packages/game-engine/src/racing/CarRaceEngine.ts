import type { GameId } from "@playora/game-types";
import { RacingEngine } from "./RacingEngine.js";

/**
 * Car Race.
 *
 * Everything that makes one car drive differently from another lives on its
 * garage spec sheet (mass, power, drivetrain, tyres, aero), not here: the
 * engine is the same physics for every vehicle, and this class only names the
 * roster it draws from. A per-game "car multiplier" is how the old rosters
 * drifted apart from what the garage claimed.
 */
export class CarRaceEngine extends RacingEngine {
  override readonly gameId: GameId = "car-race";
  override readonly minPlayers = 1;
  override readonly maxPlayers = 8;
}
