import type { GameId } from "@playden/game-types";
import type { BotEngine } from "./types.js";
import { ChessBot } from "./chess/ChessBot.js";

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
