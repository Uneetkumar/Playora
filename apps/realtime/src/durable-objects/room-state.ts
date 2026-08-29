import type { ProtocolPlayer, ProtocolRoomStatePayload, ProtocolRoomSettings } from "@playora/protocol";
import type { BaseGameState } from "@playora/game-engine";
import type { GameId } from "@playora/game-types";

export type RoomStatus = ProtocolRoomStatePayload["status"];

/**
 * The room's authoritative state, persisted to Durable Object storage.
 *
 * Everything a room needs to be reconstructed after eviction lives here.
 * Nothing derived from a live socket belongs in this shape.
 */
export interface PersistedRoom {
  roomId: string;
  roomCode: string;
  hostUserId: string;
  gameId: GameId;
  status: RoomStatus;
  settings: ProtocolRoomSettings;
  players: Record<string, ProtocolPlayer>;
  spectators: Record<string, ProtocolPlayer>;
  sequenceNumber: number;
  currentSessionId: string | null;
  currentGameState: BaseGameState | null;
  /** userId -> epoch ms at which an unclaimed seat is forfeited. */
  disconnectDeadlines: Record<string, number>;
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
}

/**
 * Per-connection state, stored on the socket itself via serializeAttachment so
 * it survives hibernation.
 *
 * `userId` is null until an AUTH message has been cryptographically verified.
 * No other field may be treated as identity.
 */
export interface ConnectionAttachment {
  connectionId: string;
  userId: string | null;
  displayName: string;
  avatarUrl: string | null;
  isGuest: boolean;
  asSpectator: boolean;
  connectedAt: number;
  lastSeenAt: number;
}

export const DEFAULT_GRACE_PERIOD_SECONDS = 60;
export const AUTH_DEADLINE_MS = 10_000;

export function createRoom(params: {
  roomId: string;
  roomCode: string;
  gameId: GameId;
  maxPlayers: number;
  isPrivate: boolean;
  now: number;
}): PersistedRoom {
  return {
    roomId: params.roomId,
    roomCode: params.roomCode,
    hostUserId: "",
    gameId: params.gameId,
    status: "waiting",
    settings: {
      maxPlayers: params.maxPlayers,
      isPrivate: params.isPrivate,
      gameMode: "casual",
      allowSpectators: true,
      customRules: {},
    },
    players: {},
    spectators: {},
    sequenceNumber: 0,
    currentSessionId: null,
    currentGameState: null,
    disconnectDeadlines: {},
    createdAt: params.now,
    startedAt: null,
    endedAt: null,
  };
}

export function toRoomStatePayload(room: PersistedRoom): ProtocolRoomStatePayload {
  return {
    id: room.roomId,
    code: room.roomCode,
    name: `Room ${room.roomCode}`,
    hostId: room.hostUserId,
    gameId: room.gameId,
    status: room.status,
    settings: room.settings,
    players: room.players,
    spectators: room.spectators,
    currentSessionId: room.currentSessionId,
    createdAt: room.createdAt,
    updatedAt: Date.now(),
  };
}

export function playerCount(room: PersistedRoom): number {
  return Object.keys(room.players).length;
}

export function nextSeatIndex(room: PersistedRoom): number {
  const taken = new Set(Object.values(room.players).map((p) => p.seatIndex));
  let seat = 0;
  while (taken.has(seat)) seat += 1;
  return seat;
}

/** Promotes the longest-seated connected player when the host leaves. */
export function reassignHost(room: PersistedRoom): string | null {
  const candidates = Object.values(room.players)
    .filter((p) => p.userId !== room.hostUserId)
    .sort((a, b) => a.joinedAt - b.joinedAt);

  const next = candidates[0];
  if (!next) {
    room.hostUserId = "";
    return null;
  }

  for (const player of Object.values(room.players)) {
    if (player.role === "host") player.role = "player";
  }
  next.role = "host";
  room.hostUserId = next.userId;
  return next.userId;
}

/** Reads the per-connection attachment, tolerating sockets with none set. */
export function readAttachment(ws: {
  deserializeAttachment(): unknown;
}): ConnectionAttachment | null {
  try {
    return (ws.deserializeAttachment() as ConnectionAttachment | null) ?? null;
  } catch {
    return null;
  }
}
