import type { BaseGameState, BaseGameAction, BaseGameConfig } from "../types.js";
import type { GameResult } from "@playora/game-types";

export type ChessColor = "w" | "b";

export interface ChessMoveRecord {
  from: string;
  to: string;
  san: string;
  piece: string;
  color: ChessColor;
  captured?: string;
  promotion?: string;
  timestamp: number;
}

export interface ChessGameState extends BaseGameState {
  fen: string;
  turnColor: ChessColor;
  whitePlayerId: string;
  blackPlayerId: string;
  history: ChessMoveRecord[];
  inCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  drawReason?: "stalemate" | "threefold_repetition" | "insufficient_material" | "fifty_moves" | "agreement";
  winnerId: string | null;
  capturedPieces: {
    white: string[]; // pieces captured by white (i.e. black's lost pieces)
    black: string[]; // pieces captured by black (i.e. white's lost pieces)
  };
  clocks: {
    white: number; // Remaining time in ms
    black: number; // Remaining time in ms
  };
  incrementMs: number;
  lastMoveTimestamp: number | null;
  drawOfferFromPlayerId: string | null;
}

export interface ChessMovePayload {
  from: string;
  to: string;
  promotion?: "q" | "r" | "b" | "n";
}

export type ChessActionType =
  | "MOVE"
  | "RESIGN"
  | "OFFER_DRAW"
  | "ACCEPT_DRAW"
  | "DECLINE_DRAW"
  | "TIMEOUT";

export interface ChessAction extends BaseGameAction<unknown> {
  type: ChessActionType;
  payload: ChessMovePayload | Record<string, never>;
}

export interface ChessConfig extends BaseGameConfig {
  initialTimeSeconds?: number; // e.g. 600 for 10 min
  incrementSeconds?: number;   // e.g. 0 or 5 sec
  asymmetricColors?: {
    whitePlayerId?: string;
    blackPlayerId?: string;
  };
}

export interface ChessPlayerView {
  fen: string;
  turnColor: ChessColor;
  whitePlayerId: string;
  blackPlayerId: string;
  myColor: ChessColor | "spectator";
  isMyTurn: boolean;
  inCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  drawReason?: string;
  phase: string;
  isFinished: boolean;
  winnerId: string | null;
  history: ChessMoveRecord[];
  capturedPieces: {
    white: string[];
    black: string[];
  };
  clocks: {
    white: number;
    black: number;
  };
  drawOfferFromPlayerId: string | null;
  sequenceNumber: number;
  updatedAt: number;
}

export interface ChessResult extends GameResult {
  winnerColor?: ChessColor | null;
  finalFen: string;
  moveCount: number;
}
