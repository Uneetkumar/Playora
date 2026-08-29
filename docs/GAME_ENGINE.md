# Game Engine Contract & Extensibility

`@playora/game-engine` provides a generic, decoupled abstraction for implementing multiplayer games.

## Design Philosophy

- **Zero Coupling to WebSockets**: Game engines are pure state machines. They do not know about network sockets, HTTP, or UI rendering.
- **Deterministic Transitions**: Given `(CurrentState, Action)`, the engine deterministically returns `NextState`.
- **Hidden Information Masking**: Engines provide `getPlayerView(state, playerId)` so private information (e.g. UNO cards, hidden tiles) is never transmitted to opponents.
- **Plug-and-Play Extensibility**: Adding new games (Chess, UNO, UNO No Mercy, Car Race, Bike Race) requires implementing the `GameEngine` interface and registering it in `gameEngineRegistry` without modifying the core room or protocol infrastructure.

---

## The `GameEngine` Interface

```typescript
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

  init(players: Player[], config: TConfig): TState;
  validateAction(state: TState, action: TAction): ActionValidationResult;
  applyAction(state: TState, action: TAction): ActionResult<TState, TEvent>;
  getPlayerView(state: TState, playerId: string | null): TPlayerView;
  isGameOver(state: TState): boolean;
  calculateResult(state: TState): TResult;
  handlePlayerDisconnect?(state: TState, playerId: string): ActionResult<TState, TEvent>;
  handlePlayerReconnect?(state: TState, playerId: string): ActionResult<TState, TEvent>;
  handleTimeout?(state: TState): ActionResult<TState, TEvent>;
}
```

---

## Registering a New Game

```typescript
import { gameEngineRegistry } from "@playora/game-engine";
import { ChessGameEngine } from "./ChessGameEngine";

// Register engine factory
gameEngineRegistry.register("chess", () => new ChessGameEngine());
```
