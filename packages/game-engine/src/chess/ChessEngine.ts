import { Chess } from "chess.js";
import type { Player, GameId } from "@playden/game-types";
import { AbstractGameEngine } from "../engine.js";
import type { ActionValidationResult, ActionResult } from "../types.js";
import type {
  ChessGameState,
  ChessAction,
  ChessConfig,
  ChessPlayerView,
  ChessResult,
  ChessColor,
  ChessMovePayload,
} from "./types.js";

export interface ChessEvent {
  type: "MOVE" | "CHECK" | "CHECKMATE" | "DRAW" | "RESIGN" | "DRAW_OFFERED" | "DRAW_DECLINED" | "TIMEOUT";
  payload?: unknown;
}

export class ChessEngine extends AbstractGameEngine<
  ChessGameState,
  ChessAction,
  ChessResult,
  ChessConfig,
  ChessEvent,
  ChessPlayerView
> {
  readonly gameId: GameId = "chess";
  readonly minPlayers = 2;
  readonly maxPlayers = 2;

  init(players: Player[], config: ChessConfig = {}): ChessGameState {
    const validation = this.validatePlayerCount(players);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const firstPlayer = players[0];
    const secondPlayer = players[1];
    if (!firstPlayer || !secondPlayer) {
      throw new Error("Two players are required to initialize chess");
    }

    const whitePlayerId = config.asymmetricColors?.whitePlayerId || firstPlayer.userId;
    const blackPlayerId =
      config.asymmetricColors?.blackPlayerId ||
      players.find((p) => p.userId !== whitePlayerId)?.userId ||
      secondPlayer.userId;

    const initialTimeMs = (config.initialTimeSeconds ?? 600) * 1000; // default 10 mins
    const incrementMs = (config.incrementSeconds ?? 0) * 1000;
    const now = Date.now();

    const chess = new Chess();

    return {
      sequenceNumber: 0,
      phase: "playing",
      activePlayerId: whitePlayerId,
      turnNumber: 1,
      startedAt: now,
      updatedAt: now,
      turnDeadline: now + initialTimeMs,
      isFinished: false,
      fen: chess.fen(),
      turnColor: "w",
      whitePlayerId,
      blackPlayerId,
      history: [],
      inCheck: false,
      isCheckmate: false,
      isDraw: false,
      winnerId: null,
      capturedPieces: {
        white: [],
        black: [],
      },
      clocks: {
        white: initialTimeMs,
        black: initialTimeMs,
      },
      incrementMs,
      lastMoveTimestamp: now,
      drawOfferFromPlayerId: null,
    };
  }

  validateAction(state: ChessGameState, action: ChessAction): ActionValidationResult {
    if (state.isFinished) {
      return { valid: false, reason: "Game is already finished." };
    }

    const isWhite = action.playerId === state.whitePlayerId;
    const isBlack = action.playerId === state.blackPlayerId;

    if (!isWhite && !isBlack) {
      return { valid: false, reason: "Player is not a participant in this match." };
    }

    switch (action.type) {
      case "MOVE": {
        const expectedPlayerId = state.turnColor === "w" ? state.whitePlayerId : state.blackPlayerId;
        if (action.playerId !== expectedPlayerId) {
          return { valid: false, reason: "It is not your turn." };
        }

        const movePayload = action.payload as ChessMovePayload;
        if (!movePayload || !movePayload.from || !movePayload.to) {
          return { valid: false, reason: "Move must include 'from' and 'to' coordinates." };
        }

        try {
          const chess = new Chess(state.fen);
          // Check if legal move in chess.js
          const legalMoves = chess.moves({ verbose: true });
          const isLegal = legalMoves.some(
            (m) =>
              m.from === movePayload.from &&
              m.to === movePayload.to &&
              (!movePayload.promotion || m.promotion === movePayload.promotion)
          );

          if (!isLegal) {
            return { valid: false, reason: `Illegal move: ${movePayload.from} to ${movePayload.to}` };
          }
          return { valid: true };
        } catch (err) {
          return { valid: false, reason: err instanceof Error ? err.message : "Invalid board position" };
        }
      }

      case "RESIGN": {
        return { valid: true };
      }

      case "OFFER_DRAW": {
        if (state.drawOfferFromPlayerId === action.playerId) {
          return { valid: false, reason: "Draw offer already pending from you." };
        }
        return { valid: true };
      }

      case "ACCEPT_DRAW": {
        if (!state.drawOfferFromPlayerId) {
          return { valid: false, reason: "No draw offer currently active." };
        }
        if (state.drawOfferFromPlayerId === action.playerId) {
          return { valid: false, reason: "Cannot accept your own draw offer." };
        }
        return { valid: true };
      }

      case "DECLINE_DRAW": {
        if (!state.drawOfferFromPlayerId) {
          return { valid: false, reason: "No draw offer currently active." };
        }
        if (state.drawOfferFromPlayerId === action.playerId) {
          return { valid: false, reason: "Cannot decline your own draw offer." };
        }
        return { valid: true };
      }

      case "TIMEOUT": {
        return { valid: true };
      }

      default:
        return { valid: false, reason: `Unknown action type: ${(action as { type: string }).type}` };
    }
  }

  applyAction(state: ChessGameState, action: ChessAction): ActionResult<ChessGameState, ChessEvent> {
    const now = action.timestamp || Date.now();
    const events: ChessEvent[] = [];

    // Calculate clock decay
    let whiteClock = state.clocks.white;
    let blackClock = state.clocks.black;
    if (state.lastMoveTimestamp && !state.isFinished) {
      const elapsed = Math.max(0, now - state.lastMoveTimestamp);
      if (state.turnColor === "w") {
        whiteClock = Math.max(0, whiteClock - elapsed);
      } else {
        blackClock = Math.max(0, blackClock - elapsed);
      }
    }

    if (action.type === "RESIGN") {
      const winnerId = action.playerId === state.whitePlayerId ? state.blackPlayerId : state.whitePlayerId;
      const nextState: ChessGameState = {
        ...state,
        phase: "resigned",
        isFinished: true,
        winnerId,
        clocks: { white: whiteClock, black: blackClock },
        updatedAt: now,
        turnDeadline: null,
      };
      events.push({ type: "RESIGN", payload: { resignedPlayerId: action.playerId, winnerId } });
      return { state: nextState, events };
    }

    if (action.type === "OFFER_DRAW") {
      events.push({ type: "DRAW_OFFERED", payload: { fromPlayerId: action.playerId } });
      return {
        state: {
          ...state,
          drawOfferFromPlayerId: action.playerId,
          updatedAt: now,
        },
        events,
      };
    }

    if (action.type === "DECLINE_DRAW") {
      events.push({ type: "DRAW_DECLINED", payload: { declinedBy: action.playerId } });
      return {
        state: {
          ...state,
          drawOfferFromPlayerId: null,
          updatedAt: now,
        },
        events,
      };
    }

    if (action.type === "ACCEPT_DRAW") {
      events.push({ type: "DRAW", payload: { reason: "agreement" } });
      return {
        state: {
          ...state,
          phase: "draw",
          isFinished: true,
          isDraw: true,
          drawReason: "agreement",
          winnerId: null,
          drawOfferFromPlayerId: null,
          updatedAt: now,
          turnDeadline: null,
        },
        events,
      };
    }

    if (action.type === "TIMEOUT") {
      const timedOutPlayerId = action.playerId;
      const winnerId = timedOutPlayerId === state.whitePlayerId ? state.blackPlayerId : state.whitePlayerId;
      events.push({ type: "TIMEOUT", payload: { timedOutPlayerId, winnerId } });
      return {
        state: {
          ...state,
          phase: "timeout",
          isFinished: true,
          winnerId,
          updatedAt: now,
          turnDeadline: null,
        },
        events,
      };
    }

    if (action.type === "MOVE") {
      const movePayload = action.payload as ChessMovePayload;
      const chess = new Chess(state.fen);

      const moveResult = chess.move({
        from: movePayload.from,
        to: movePayload.to,
        promotion: movePayload.promotion || "q",
      });

      if (!moveResult) {
        throw new Error(`Failed to execute move: ${movePayload.from} to ${movePayload.to}`);
      }

      // Add clock increment to moving player
      if (state.turnColor === "w") {
        whiteClock += state.incrementMs;
      } else {
        blackClock += state.incrementMs;
      }

      const nextTurnColor: ChessColor = chess.turn() as ChessColor;
      const nextActivePlayerId = nextTurnColor === "w" ? state.whitePlayerId : state.blackPlayerId;

      // Track captured pieces
      const capturedWhite = [...state.capturedPieces.white];
      const capturedBlack = [...state.capturedPieces.black];
      if (moveResult.captured) {
        if (moveResult.color === "w") {
          // White captured a black piece
          capturedWhite.push(moveResult.captured);
        } else {
          // Black captured a white piece
          capturedBlack.push(moveResult.captured);
        }
      }

      const inCheck = chess.inCheck();
      const isCheckmate = chess.isCheckmate();
      const isStalemate = chess.isStalemate();
      const isDraw = chess.isDraw();

      let phase = "playing";
      let isFinished = false;
      let winnerId: string | null = null;
      let drawReason: ChessGameState["drawReason"];

      if (isCheckmate) {
        phase = "checkmate";
        isFinished = true;
        winnerId = action.playerId; // player who just made the winning move
        events.push({ type: "CHECKMATE", payload: { winnerId } });
      } else if (isStalemate) {
        phase = "stalemate";
        isFinished = true;
        drawReason = "stalemate";
        events.push({ type: "DRAW", payload: { reason: "stalemate" } });
      } else if (chess.isThreefoldRepetition()) {
        phase = "draw";
        isFinished = true;
        drawReason = "threefold_repetition";
        events.push({ type: "DRAW", payload: { reason: "threefold_repetition" } });
      } else if (chess.isInsufficientMaterial()) {
        phase = "draw";
        isFinished = true;
        drawReason = "insufficient_material";
        events.push({ type: "DRAW", payload: { reason: "insufficient_material" } });
      } else if (isDraw) {
        phase = "draw";
        isFinished = true;
        drawReason = "fifty_moves";
        events.push({ type: "DRAW", payload: { reason: "fifty_moves" } });
      } else if (inCheck) {
        phase = "check";
        events.push({ type: "CHECK", payload: { inCheckPlayerId: nextActivePlayerId } });
      }

      const nextClockTime = nextTurnColor === "w" ? whiteClock : blackClock;
      const turnDeadline = isFinished ? null : now + nextClockTime;

      const moveRecord = {
        from: moveResult.from,
        to: moveResult.to,
        san: moveResult.san,
        piece: moveResult.piece,
        color: moveResult.color as ChessColor,
        captured: moveResult.captured,
        promotion: moveResult.promotion,
        timestamp: now,
      };

      events.push({ type: "MOVE", payload: moveRecord });

      const nextState: ChessGameState = {
        ...state,
        fen: chess.fen(),
        turnColor: nextTurnColor,
        activePlayerId: isFinished ? null : nextActivePlayerId,
        turnNumber: state.turnNumber + 1,
        history: [...state.history, moveRecord],
        inCheck,
        isCheckmate,
        isDraw,
        drawReason,
        winnerId,
        phase,
        isFinished,
        capturedPieces: {
          white: capturedWhite,
          black: capturedBlack,
        },
        clocks: {
          white: whiteClock,
          black: blackClock,
        },
        lastMoveTimestamp: now,
        turnDeadline,
        drawOfferFromPlayerId: null, // Clear any pending draw offer on move
        updatedAt: now,
      };

      return { state: nextState, events };
    }

    return { state, events };
  }

  getPlayerView(state: ChessGameState, playerId: string | null): ChessPlayerView {
    const myColor: ChessColor | "spectator" =
      playerId === state.whitePlayerId ? "w" : playerId === state.blackPlayerId ? "b" : "spectator";

    const isMyTurn = !state.isFinished && playerId === state.activePlayerId;

    return {
      fen: state.fen,
      turnColor: state.turnColor,
      whitePlayerId: state.whitePlayerId,
      blackPlayerId: state.blackPlayerId,
      myColor,
      isMyTurn,
      inCheck: state.inCheck,
      isCheckmate: state.isCheckmate,
      isDraw: state.isDraw,
      drawReason: state.drawReason,
      phase: state.phase,
      isFinished: state.isFinished,
      winnerId: state.winnerId,
      history: state.history,
      capturedPieces: state.capturedPieces,
      clocks: state.clocks,
      drawOfferFromPlayerId: state.drawOfferFromPlayerId,
      sequenceNumber: state.sequenceNumber,
      updatedAt: state.updatedAt,
    };
  }

  isGameOver(state: ChessGameState): boolean {
    return state.isFinished;
  }

  calculateResult(state: ChessGameState, roomId: string = "room_chess"): ChessResult {
    const isDraw = state.isDraw || state.phase === "draw" || state.phase === "stalemate";
    const winnerId = isDraw ? null : state.winnerId;
    const durationSeconds = Math.floor((state.updatedAt - state.startedAt) / 1000);

    const winnerColor = winnerId
      ? winnerId === state.whitePlayerId
        ? "w"
        : "b"
      : null;

    return {
      sessionId: `chess_session_${state.startedAt}`,
      roomId,
      gameId: "chess",
      winnerId,
      scores: [
        {
          playerId: state.whitePlayerId,
          userId: state.whitePlayerId,
          rank: winnerId === state.whitePlayerId ? 1 : isDraw ? 1 : 2,
          score: winnerId === state.whitePlayerId ? 1 : isDraw ? 0.5 : 0,
          isWinner: winnerId === state.whitePlayerId,
        },
        {
          playerId: state.blackPlayerId,
          userId: state.blackPlayerId,
          rank: winnerId === state.blackPlayerId ? 1 : isDraw ? 1 : 2,
          score: winnerId === state.blackPlayerId ? 1 : isDraw ? 0.5 : 0,
          isWinner: winnerId === state.blackPlayerId,
        },
      ],
      durationSeconds,
      completedAt: new Date(state.updatedAt).toISOString(),
      reason: state.phase === "resigned"
        ? "resignation"
        : state.phase === "timeout"
        ? "timeout"
        : isDraw
        ? "draw"
        : "normal",
      winnerColor,
      finalFen: state.fen,
      moveCount: state.history.length,
    };
  }
}
