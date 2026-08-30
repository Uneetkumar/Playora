import type { GameId } from "@playora/game-types";
import type { BotEngine } from "./types.js";
import { BikeRaceEngine, CarRaceEngine, UnoEngine, UnoNoMercyEngine } from "@playora/game-engine";
import { ChessBot } from "./chess/ChessBot.js";
import { UnoBot } from "./uno/UnoBot.js";
import { RacingBot } from "./racing/RacingBot.js";

/**
 * Which games can be played against AI.
 *
 * The UI reads this to decide whether to offer "Play with AI" at all, rather
 * than advertising a mode that does not exist yet.
 */
class BotRegistry {
  private bots = new Map<GameId, () => BotEngine>();

  constructor() {
    this.bots.set("chess", () => new ChessBot());
    // Both UNO variants share one bot; it asks the engine it was given what
    // is playable, so the No Mercy stacking rules come along for free.
    this.bots.set("uno", () => new UnoBot(new UnoEngine()));
    this.bots.set("uno-no-mercy", () => new UnoBot(new UnoNoMercyEngine()));
    // Racing bots drive; they do not follow a script. Both share one
    // implementation because the difference between a car and a bike is
    // entirely in the engine tuning it is handed.
    this.bots.set("car-race", () => new RacingBot(new CarRaceEngine()));
    this.bots.set("bike-race", () => new RacingBot(new BikeRaceEngine()));
  }

  has(gameId: GameId): boolean {
    return this.bots.has(gameId);
  }

  get(gameId: GameId): BotEngine {
    const factory = this.bots.get(gameId);
    if (!factory) throw new Error(`No bot available for game '${gameId}'.`);
    return factory();
  }

  supportedGames(): GameId[] {
    return [...this.bots.keys()];
  }
}

export const botRegistry = new BotRegistry();
