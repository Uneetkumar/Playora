import type { GameId } from "./game.js";

export type GameSessionStatus = "initializing" | "active" | "paused" | "completed" | "aborted";

export interface GameSession {
  id: string;
  roomId: string;
  gameId: GameId;
  status: GameSessionStatus;
  playerIds: string[];
  spectatorIds: string[];
  sequenceNumber: number;
  startedAt: number;
  endedAt: number | null;
  turnDeadline: number | null;
}
