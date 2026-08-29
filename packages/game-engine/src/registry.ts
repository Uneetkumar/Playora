import type { GameId } from "@playora/game-types";
import type { AnyGameEngine } from "./types.js";
import { ChessEngine } from "./chess/ChessEngine.js";
import { UnoEngine } from "./uno/UnoEngine.js";
import { UnoNoMercyEngine } from "./uno/UnoNoMercyEngine.js";

export type GameEngineFactory = () => AnyGameEngine;

class GameEngineRegistry {
  private engines = new Map<GameId, GameEngineFactory>();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.engines.set("chess", () => new ChessEngine());
    this.engines.set("uno", () => new UnoEngine());
    this.engines.set("uno-no-mercy", () => new UnoNoMercyEngine());
  }

  register(gameId: GameId, factory: GameEngineFactory): void {
    if (this.engines.has(gameId)) {
      throw new Error(`Game engine for '${gameId}' is already registered.`);
    }
    this.engines.set(gameId, factory);
  }

  get(gameId: GameId): AnyGameEngine {
    const factory = this.engines.get(gameId);
    if (!factory) {
      throw new Error(`No game engine registered for game id: '${gameId}'.`);
    }
    return factory();
  }

  has(gameId: GameId): boolean {
    return this.engines.has(gameId);
  }

  listRegistered(): GameId[] {
    return Array.from(this.engines.keys());
  }

  clear(): void {
    this.engines.clear();
  }

  reset(): void {
    this.engines.clear();
    this.registerDefaults();
  }
}

export const gameEngineRegistry = new GameEngineRegistry();
