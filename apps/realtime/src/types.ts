import type { DurableObjectNamespace } from "@cloudflare/workers-types";
import type { Player, Room, GameSession } from "@playden/game-types";

export interface Env {
  ROOM_DO: DurableObjectNamespace;
  ENVIRONMENT?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export interface ClientConnectionAttachment {
  connectionId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: "host" | "player" | "spectator";
  isGuest: boolean;
  joinedAt: number;
  lastPingAt: number;
}

export interface RoomDOState {
  room: Room;
  session: GameSession | null;
  players: Map<string, Player>;
  spectators: Map<string, Player>;
  chatHistory: unknown[];
  sequenceNumber: number;
}
