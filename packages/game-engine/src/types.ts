import type { Player, GameId, GameResult } from "@playden/game-types";

export interface BaseGameState {
  sequenceNumber: number;
  phase: string;
  activePlayerId: string | null;
  turnNumber: number;
  startedAt: number;
  updatedAt: number;
  turnDeadline: number | null;
  isFinished: boolean;
}

export interface BaseGameAction<TPayload = unknown> {
  type: string;
  playerId: string;
  payload: TPayload;
  timestamp: number;
  clientActionId?: string;
}

export interface BaseGameConfig {
  /** Room this match is being played in. Set by the realtime layer. */
  roomId?: string;
  /** Session (match) identifier. Set by the realtime layer. */
  sessionId?: string;
  turnTimeSeconds?: number;
  randomSeed?: string;
  customRules?: Record<string, unknown>;
}

export interface ActionValidationResult {
  valid: boolean;
  reason?: string;
}

export interface ActionResult<TState extends BaseGameState, TEvent = unknown> {
  state: TState;
  events?: TEvent[];
}

export interface GameEngine<
  TState extends BaseGameState = BaseGameState,
  TAction extends BaseGameAction = BaseGameAction,
  TResult extends GameResult = GameResult,
  TConfig extends BaseGameConfig = BaseGameConfig,
  TEvent = unknown,
  TPlayerView = unknown,
> {
  readonly gameId: GameId;
  readonly minPlayers: number;
  readonly maxPlayers: number;

  /**
   * Helper to validate player count before starting.
   */
  validatePlayerCount(players: Player[]): ActionValidationResult;

  /**
   * Initializes a fresh game state from player list and game configuration.
   */
  init(players: Player[], config: TConfig): TState;

  /**
   * Validates whether a player's action is legal given the current state.
   */
  validateAction(state: TState, action: TAction): ActionValidationResult;

  /**
   * Applies an action to the game state deterministically, producing the next state and events.
   */
  applyAction(state: TState, action: TAction): ActionResult<TState, TEvent>;

  /**
   * Safe execution wrapper that runs validation then applies the action.
   */
  executeAction(state: TState, action: TAction): ActionResult<TState, TEvent>;

  /**
   * Obtains a filtered state view for a specific player (omits hidden info like opponents' cards).
   */
  getPlayerView(state: TState, playerId: string | null): TPlayerView;

  /**
   * Checks whether terminal conditions have been met.
   */
  isGameOver(state: TState): boolean;

  /**
   * Calculates the final match result and scores when the game terminates.
   */
  calculateResult(state: TState, roomId?: string): TResult;

  /**
   * Handles player disconnection lifecycle events.
   */
  handlePlayerDisconnect?(state: TState, playerId: string): ActionResult<TState, TEvent>;

  /**
   * Handles player reconnection lifecycle events.
   */
  handlePlayerReconnect?(state: TState, playerId: string): ActionResult<TState, TEvent>;

  /**
   * Handles turn timeout if a player exceeds their allocated turn time.
   */
  handleTimeout?(state: TState): ActionResult<TState, TEvent>;
}

/**
 * A game engine of unknown concrete shape.
 *
 * Used by the registry and the realtime layer, which route actions generically
 * without knowing which game they are handling. Constrained to the base types
 * rather than `any` so the compiler still checks the parts that are invariant
 * across every game.
 */
export type AnyGameEngine = GameEngine<
  BaseGameState,
  BaseGameAction,
  GameResult,
  BaseGameConfig,
  unknown,
  unknown
>;
