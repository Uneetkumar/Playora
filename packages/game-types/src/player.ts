export type PlayerRole = "host" | "player" | "spectator";

export type PlayerConnectionStatus = "connected" | "disconnected" | "reconnecting";

export interface Player {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: PlayerRole;
  isReady: boolean;
  seatIndex: number;
  status: PlayerConnectionStatus;
  joinedAt: number;
  lastPingAt: number;
  isGuest: boolean;
}
