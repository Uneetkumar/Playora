import type { GameId, GameResult, Player } from "@playden/game-types";
import type {
  ActionValidationResult,
  ActionResult,
  BaseGameAction,
  BaseGameConfig,
  BaseGameState,
  GameEngine,
} from "./types.js";

export abstract class AbstractGameEngine<
  TState extends BaseGameState = BaseGameState,
  TAction extends BaseGameAction = BaseGameAction,
  TResult extends GameResult = GameResult,
  TConfig extends BaseGameConfig = BaseGameConfig,
  TEvent = unknown,
  TPlayerView = unknown,
> implements GameEngine<TState, TAction, TResult, TConfig, TEvent, TPlayerView> {
  abstract readonly gameId: GameId;
  abstract readonly minPlayers: number;
  abstract readonly maxPlayers: number;

  abstract init(players: Player[], config: TConfig): TState;
  abstract validateAction(state: TState, action: TAction): ActionValidationResult;
  abstract applyAction(state: TState, action: TAction): ActionResult<TState, TEvent>;
  abstract getPlayerView(state: TState, playerId: string | null): TPlayerView;
  abstract isGameOver(state: TState): boolean;
  abstract calculateResult(state: TState): TResult;

  /**
   * Helper to validate player count before starting.
   */
  validatePlayerCount(players: Player[]): ActionValidationResult {
    if (players.length < this.minPlayers) {
      return {
        valid: false,
        reason: `Insufficient players. Minimum required: ${this.minPlayers}, got: ${players.length}`,
      };
    }
    if (players.length > this.maxPlayers) {
      return {
        valid: false,
        reason: `Exceeded maximum players. Maximum allowed: ${this.maxPlayers}, got: ${players.length}`,
      };
    }
    return { valid: true };
  }

  /**
   * Safe execution wrapper that runs validation then applies the action.
   */
  executeAction(state: TState, action: TAction): ActionResult<TState, TEvent> {
    const validation = this.validateAction(state, action);
    if (!validation.valid) {
      throw new Error(`Invalid action: ${validation.reason ?? "Illegal move"}`);
    }
    const result = this.applyAction(state, action);
    return {
      state: {
        ...result.state,
        sequenceNumber: state.sequenceNumber + 1,
        updatedAt: Date.now(),
      },
      events: result.events,
    };
  }
}
