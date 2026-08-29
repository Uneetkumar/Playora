import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { ChessEngine } from "@playora/game-engine";
import type { ChessGameState } from "@playora/game-engine";
import type { Player } from "@playora/game-types";
import { ChessBot } from "../chess/ChessBot.js";
import { AI_LEVELS, type AiLevel } from "../types.js";

const engine = new ChessEngine();

const players: Player[] = [
  { id: "p1", userId: "white", displayName: "White", avatarUrl: null } as Player,
  { id: "p2", userId: "black", displayName: "Black", avatarUrl: null } as Player,
];

function freshGame(): ChessGameState {
  return engine.init(players, {});
}

/** Applies a bot move through the real engine, exactly as the app does. */
function botMoves(state: ChessGameState, playerId: string, level: AiLevel): ChessGameState {
  const bot = new ChessBot();
  const action = bot.chooseAction(state, playerId, level);
  expect(action, "bot returned no action").not.toBeNull();
  return engine.executeAction(state, action!).state;
}

describe("ChessBot", () => {
  it("declines to act when it is not the bot's turn", () => {
    const state = freshGame();
    const bot = new ChessBot();
    // White moves first, so Black must not produce an action.
    expect(bot.chooseAction(state, state.blackPlayerId, 3)).toBeNull();
  });

  it("returns null once the game is finished", () => {
    const state = { ...freshGame(), isFinished: true };
    expect(new ChessBot().chooseAction(state, state.whitePlayerId, 3)).toBeNull();
  });

  it.each(AI_LEVELS)("produces a legal move at level %i", (level) => {
    const state = freshGame();
    // executeAction throws on an illegal action, so reaching the next state
    // proves the bot went through full engine validation.
    const next = botMoves(state, state.whitePlayerId, level);
    expect(next.history).toHaveLength(1);
    expect(new Chess(next.fen).moves().length).toBeGreaterThan(0);
  });

  // Restricted to the fast levels: higher levels are time-budgeted at up to
  // 1.5s per move, so a long self-play game there would dominate the suite.
  it.each([1, 2, 3, 4] as AiLevel[])(
    "plays a game against itself without an illegal move at level %i",
    (level) => {
      let state = freshGame();
      for (let ply = 0; ply < 16 && !engine.isGameOver(state); ply++) {
        const mover = state.turnColor === "w" ? state.whitePlayerId : state.blackPlayerId;
        state = botMoves(state, mover, level);
      }
      expect(state.history.length).toBeGreaterThan(0);
    },
  );

  it("stays within its time budget even in a busy midgame position", () => {
    const busy = "r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 7";
    const state: ChessGameState = { ...freshGame(), fen: busy, turnColor: "w" };

    const started = Date.now();
    const action = new ChessBot().chooseAction(state, state.whitePlayerId, 7);
    const elapsed = Date.now() - started;

    expect(action).not.toBeNull();
    // The wall-clock deadline is 1.5s; allow generous headroom for slow CI.
    expect(elapsed).toBeLessThan(5000);
  });

  it("takes mate in one at every level, including the weakest", () => {
    // Black to move is irrelevant: white plays Qxf7#, the scholar's mate finish.
    const chess = new Chess("rnbqkbnr/pppp1ppp/8/4p3/5PP1/8/PPPPP2P/RNBQKBNR b KQkq - 0 2");
    const state: ChessGameState = { ...freshGame(), fen: chess.fen(), turnColor: "b" };

    for (const level of AI_LEVELS) {
      const action = new ChessBot().chooseAction(state, state.blackPlayerId, level);
      expect(action?.type).toBe("MOVE");
      const payload = action!.payload as { from: string; to: string };
      const probe = new Chess(state.fen);
      probe.move({ from: payload.from, to: payload.to });
      expect(probe.isCheckmate(), `level ${level} missed mate in one`).toBe(true);
    }
  });

  it("answers an opponent's draw offer instead of just moving", () => {
    const base = freshGame();
    const state: ChessGameState = { ...base, drawOfferFromPlayerId: base.blackPlayerId };
    const action = new ChessBot().chooseAction(state, base.whitePlayerId, 4);
    expect(["ACCEPT_DRAW", "DECLINE_DRAW"]).toContain(action?.type);
  });

  it("ignores a draw offer it made itself", () => {
    const base = freshGame();
    const state: ChessGameState = { ...base, drawOfferFromPlayerId: base.whitePlayerId };
    const action = new ChessBot().chooseAction(state, base.whitePlayerId, 4);
    expect(action?.type).toBe("MOVE");
  });

  it("scales thinking time with difficulty", () => {
    const bot = new ChessBot();
    expect(bot.thinkingTimeMs(7)).toBeGreaterThan(bot.thinkingTimeMs(1));
  });

  it("is deterministic given a fixed random source", () => {
    const fixed = () => 0.5;
    const a = new ChessBot(fixed).chooseAction(freshGame(), "white", 5);
    const b = new ChessBot(fixed).chooseAction(freshGame(), "white", 5);
    expect(a?.payload).toEqual(b?.payload);
  });
});
