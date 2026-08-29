export type PresenceStatus = "online" | "in_lobby" | "in_game" | "away" | "offline";

export interface UserPresence {
  userId: string;
  username: string;
  status: PresenceStatus;
  currentRoomId?: string | null;
  currentGameId?: string | null;
  lastActiveAt: number;
}
