import { describe, it, expect } from "vitest";
import { ChessEngine } from "../chess/ChessEngine.js";
import { gameEngineRegistry } from "../registry.js";
import type { Player } from "@playden/game-types";
import type { ChessAction } from "../chess/types.js";

describe("ChessEngine Server-Authoritative Rules", () => {
  const engine = new ChessEngine();

  const playerWhite: Player = {
    id: "conn-1",
    userId: "user_white",
    username: "Magnus",
    displayName: "Magnus",
    avatarUrl: null,
    role: "host",
    isReady: true,
    seatIndex: 0,
    status: "connected",
    joinedAt: Date.now(),
    lastPingAt: Date.now(),
    isGuest: false,
  };

  const playerBlack: Player = {
    id: "conn-2",
    userId: "user_black",
    username: "Hikaru",
    displayName: "Hikaru",
    avatarUrl: null,
    role: "player",
    isReady: true,
    seatIndex: 1,
    status: "connected",
    joinedAt: Date.now(),
    lastPingAt: Date.now(),
    isGuest: false,
  };

  const players = [playerWhite, playerBlack];

  it("registers in global gameEngineRegistry by default", () => {
    expect(gameEngineRegistry.has("chess")).toBe(true);
    const fetched = gameEngineRegistry.get("chess");
    expect(fetched.gameId).toBe("chess");
  });

  it("initializes standard chessboard and clocks", () => {
    const state = engine.init(players, { initialTimeSeconds: 300, incrementSeconds: 5 });
    expect(state.turnColor).toBe("w");
    expect(state.whitePlayerId).toBe("user_white");
    expect(state.blackPlayerId).toBe("user_black");
    expect(state.activePlayerId).toBe("user_white");
    expect(state.clocks.white).toBe(300000);
    expect(state.clocks.black).toBe(300000);
    expect(state.incrementMs).toBe(5000);
    expect(state.isFinished).toBe(false);
    expect(state.inCheck).toBe(false);
    expect(state.history).toHaveLength(0);
  });

  it("validates and applies legal moves and rejects illegal moves", () => {
    let state = engine.init(players, { initialTimeSeconds: 600 });

    // 1. e2 -> e4 by White (legal)
    const whiteMove1: ChessAction = {
      type: "MOVE",
      playerId: "user_white",
      payload: { from: "e2", to: "e4" },
      timestamp: Date.now(),
    };

    const val1 = engine.validateAction(state, whiteMove1);
    expect(val1.valid).toBe(true);

    const step1 = engine.executeAction(state, whiteMove1);
    state = step1.state;
    expect(state.turnColor).toBe("b");
    expect(state.activePlayerId).toBe("user_black");
    expect(state.history).toHaveLength(1);
    expect(state.history[0]?.san).toBe("e4");

    // 2. White tries to move again out of turn (illegal)
    const whiteMoveOutOfTurn: ChessAction = {
      type: "MOVE",
      playerId: "user_white",
      payload: { from: "d2", to: "d4" },
      timestamp: Date.now(),
    };
    const valOutOfTurn = engine.validateAction(state, whiteMoveOutOfTurn);
    expect(valOutOfTurn.valid).toBe(false);
    expect(valOutOfTurn.reason).toContain("not your turn");

    // 3. Black tries an illegal move e7 -> e2 (illegal)
    const blackIllegalMove: ChessAction = {
      type: "MOVE",
      playerId: "user_black",
      payload: { from: "e7", to: "e2" },
      timestamp: Date.now(),
    };
    const valIllegal = engine.validateAction(state, blackIllegalMove);
    expect(valIllegal.valid).toBe(false);
    expect(valIllegal.reason).toContain("Illegal move");

    // 4. Black plays e7 -> e5 (legal)
    const blackMove1: ChessAction = {
      type: "MOVE",
      playerId: "user_black",
      payload: { from: "e7", to: "e5" },
      timestamp: Date.now(),
    };
    const step2 = engine.executeAction(state, blackMove1);
    state = step2.state;
    expect(state.turnColor).toBe("w");
    expect(state.history).toHaveLength(2);
  });

  it("handles Scholar's Mate checkmate correctly", () => {
    let state = engine.init(players, { initialTimeSeconds: 600 });

    const moves: Array<{ player: "user_white" | "user_black"; from: string; to: string }> = [
      { player: "user_white", from: "e2", to: "e4" },
      { player: "user_black", from: "e7", to: "e5" },
      { player: "user_white", from: "d1", to: "h5" },
      { player: "user_black", from: "b8", to: "c6" },
      { player: "user_white", from: "f1", to: "c4" },
      { player: "user_black", from: "g8", to: "f6" },
      { player: "user_white", from: "h5", to: "f7" }, // Qxf7#
    ];

    for (const m of moves) {
      const step = engine.executeAction(state, {
        type: "MOVE",
        playerId: m.player,
        payload: { from: m.from, to: m.to },
        timestamp: Date.now(),
      });
      state = step.state;
    }

    expect(state.isCheckmate).toBe(true);
    expect(state.isFinished).toBe(true);
    expect(state.winnerId).toBe("user_white");
    expect(state.phase).toBe("checkmate");

    const result = engine.calculateResult(state, "test-room");
    expect(result.winnerId).toBe("user_white");
    expect(result.winnerColor).toBe("w");
    expect(result.reason).toBe("normal");
  });

  it("handles resignation cleanly", () => {
    const state = engine.init(players, { initialTimeSeconds: 600 });
    const resignAction: ChessAction = {
      type: "RESIGN",
      playerId: "user_white",
      payload: {},
      timestamp: Date.now(),
    };

    const res = engine.executeAction(state, resignAction);
    expect(res.state.isFinished).toBe(true);
    expect(res.state.winnerId).toBe("user_black");
    expect(res.state.phase).toBe("resigned");

    const matchResult = engine.calculateResult(res.state, "test-room");
    expect(matchResult.winnerId).toBe("user_black");
    expect(matchResult.reason).toBe("resignation");
  });

  it("handles draw offers and mutual agreement", () => {
    let state = engine.init(players, { initialTimeSeconds: 600 });

    // White offers draw
    const offerRes = engine.executeAction(state, {
      type: "OFFER_DRAW",
      playerId: "user_white",
      payload: {},
      timestamp: Date.now(),
    });
    state = offerRes.state;
    expect(state.drawOfferFromPlayerId).toBe("user_white");

    // Black accepts draw
    const acceptRes = engine.executeAction(state, {
      type: "ACCEPT_DRAW",
      playerId: "user_black",
      payload: {},
      timestamp: Date.now(),
    });
    state = acceptRes.state;
    expect(state.isFinished).toBe(true);
    expect(state.isDraw).toBe(true);
    expect(state.winnerId).toBeNull();
    expect(state.drawReason).toBe("agreement");
  });

  it("serializes appropriate player views", () => {
    const state = engine.init(players, { initialTimeSeconds: 600 });
    const whiteView = engine.getPlayerView(state, "user_white");
    expect(whiteView.myColor).toBe("w");
    expect(whiteView.isMyTurn).toBe(true);

    const blackView = engine.getPlayerView(state, "user_black");
    expect(blackView.myColor).toBe("b");
    expect(blackView.isMyTurn).toBe(false);

    const spectatorView = engine.getPlayerView(state, "some_random_user");
    expect(spectatorView.myColor).toBe("spectator");
    expect(spectatorView.isMyTurn).toBe(false);
  });
});
