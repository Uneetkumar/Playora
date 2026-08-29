import { describe, it, expect, beforeEach } from "vitest";
import { AbstractGameEngine } from "../engine.js";
import { gameEngineRegistry } from "../registry.js";
import type { BaseGameState, BaseGameAction, BaseGameConfig } from "../types.js";
import type { GameId, GameResult, Player } from "@playora/game-types";

interface TestState extends BaseGameState {
  count: number;
}

interface TestAction extends BaseGameAction<{ delta: number }> {
  type: "INCREMENT";
}

class MockGameEngine extends AbstractGameEngine<TestState, TestAction, GameResult, BaseGameConfig> {
  readonly gameId: GameId = "chess";
  readonly minPlayers = 2;
  readonly maxPlayers = 2;

  init(players: Player[], _config: BaseGameConfig): TestState {
    return {
      sequenceNumber: 0,
      phase: "playing",
      activePlayerId: players[0]?.id ?? null,
      turnNumber: 1,
      startedAt: Date.now(),
      updatedAt: Date.now(),
      turnDeadline: null,
      isFinished: false,
      count: 0,
    };
  }

  validateAction(state: TestState, action: TestAction) {
    if (state.isFinished) return { valid: false, reason: "Game over" };
    if (action.payload.delta <= 0) return { valid: false, reason: "Delta must be positive" };
    return { valid: true };
  }

  applyAction(state: TestState, action: TestAction) {
    const newCount = state.count + action.payload.delta;
    const isFinished = newCount >= 10;
    return {
      state: {
        ...state,
        count: newCount,
        isFinished,
      },
      events: [{ type: "COUNT_UPDATED", count: newCount }],
    };
  }

  getPlayerView(state: TestState) {
    return state;
  }

  isGameOver(state: TestState) {
    return state.isFinished;
  }

  calculateResult(state: TestState): GameResult {
    return {
      sessionId: "test-session",
      roomId: "test-room",
      gameId: "chess",
      winnerId: state.activePlayerId,
      scores: [],
      durationSeconds: 10,
      completedAt: new Date().toISOString(),
      reason: "normal",
    };
  }
}

describe("GameEngine Abstraction", () => {
  const engine = new MockGameEngine();
  const mockPlayers: Player[] = [
    {
      id: "p1",
      userId: "u1",
      username: "Alice",
      displayName: "Alice",
      avatarUrl: null,
      role: "host",
      isReady: true,
      seatIndex: 0,
      status: "connected",
      joinedAt: Date.now(),
      lastPingAt: Date.now(),
      isGuest: false,
    },
    {
      id: "p2",
      userId: "u2",
      username: "Bob",
      displayName: "Bob",
      avatarUrl: null,
      role: "player",
      isReady: true,
      seatIndex: 1,
      status: "connected",
      joinedAt: Date.now(),
      lastPingAt: Date.now(),
      isGuest: false,
    },
  ];

  beforeEach(() => {
    gameEngineRegistry.clear();
  });

  it("validates player count properly", () => {
    expect(engine.validatePlayerCount([mockPlayers[0]!]).valid).toBe(false);
    expect(engine.validatePlayerCount(mockPlayers).valid).toBe(true);
    expect(engine.validatePlayerCount([...mockPlayers, mockPlayers[0]!]).valid).toBe(false);
  });

  it("initializes and executes actions deterministically", () => {
    const initialState = engine.init(mockPlayers, {});
    expect(initialState.count).toBe(0);
    expect(initialState.sequenceNumber).toBe(0);

    const action: TestAction = {
      type: "INCREMENT",
      playerId: "p1",
      payload: { delta: 3 },
      timestamp: Date.now(),
    };

    const next = engine.executeAction(initialState, action);
    expect(next.state.count).toBe(3);
    expect(next.state.sequenceNumber).toBe(1);
    expect(next.events).toEqual([{ type: "COUNT_UPDATED", count: 3 }]);
  });

  it("rejects invalid actions", () => {
    const state = engine.init(mockPlayers, {});
    const invalidAction: TestAction = {
      type: "INCREMENT",
      playerId: "p1",
      payload: { delta: -1 },
      timestamp: Date.now(),
    };

    expect(() => engine.executeAction(state, invalidAction)).toThrow("Delta must be positive");
  });

  it("registers and retrieves engines in registry", () => {
    gameEngineRegistry.register("chess", () => new MockGameEngine());
    expect(gameEngineRegistry.has("chess")).toBe(true);
    expect(gameEngineRegistry.has("uno")).toBe(false);
    expect(gameEngineRegistry.get("chess")).toBeInstanceOf(MockGameEngine);
    expect(gameEngineRegistry.listRegistered()).toEqual(["chess"]);
  });
});
