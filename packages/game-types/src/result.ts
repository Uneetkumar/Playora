import type { GameId } from "./game.js";

export interface PlayerScore {
  playerId: string;
  userId: string;
  rank: number;
  score: number;
  isWinner: boolean;
  ratingDelta?: number;
}

export interface GameResult {
  sessionId: string;
  roomId: string;
  gameId: GameId;
  winnerId: string | null;
  scores: PlayerScore[];
  durationSeconds: number;
  completedAt: string;
  reason: "normal" | "resignation" | "timeout" | "disconnect" | "draw";
  metadata?: Record<string, unknown>;
}
