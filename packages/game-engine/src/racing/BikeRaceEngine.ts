import type { GameId } from "@playora/game-types";
import { RacingEngine } from "./RacingEngine.js";

/**
 * Bike Race.
 *
 * The same road and the same physics as Car Race, driven by the bike roster:
 * a superbike's power-to-weight, narrow track and lean come from its spec
 * sheet. What a bike cannot do — launch past the wheelie point, stop past the
 * stoppie point, shrug off contact — falls out of that geometry rather than
 * out of numbers written here.
 */
export class BikeRaceEngine extends RacingEngine {
  override readonly gameId: GameId = "bike-race";
  override readonly minPlayers = 1;
  override readonly maxPlayers = 8;
}
