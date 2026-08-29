import type { GameId, GameMode } from "./game.js";
import type { Player } from "./player.js";

export type RoomStatus = "waiting" | "starting" | "in_game" | "finished" | "abandoned";

export interface RoomSettings {
  maxPlayers: number;
  isPrivate: boolean;
  passcode?: string;
  gameMode: GameMode;
  allowSpectators: boolean;
  turnTimeSeconds?: number;
  customRules: Record<string, unknown>;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  hostId: string;
  gameId: GameId;
  status: RoomStatus;
  settings: RoomSettings;
  players: Record<string, Player>;
  spectators: Record<string, Player>;
  currentSessionId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface RoomSummary {
  id: string;
  code: string;
  name: string;
  hostUsername: string;
  gameId: GameId;
  status: RoomStatus;
  playerCount: number;
  maxPlayers: number;
  isPrivate: boolean;
  createdAt: number;
}
