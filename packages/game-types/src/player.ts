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
  /**
   * Bots share the player model but are always distinguishable
   * (spec section 8: never pretend a bot is a human).
   */
  isBot?: boolean;
  /** AI difficulty 1-7. Present only for bots. */
  botLevel?: number;
}
