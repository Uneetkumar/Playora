import type { WebSocket as CFWebSocket } from "@cloudflare/workers-types";
import type { ProtocolPlayer } from "@playden/protocol";
import { SupabaseTokenVerifier, TokenVerificationError } from "@playden/auth";
import type { VerifiedIdentity } from "@playden/auth";

import type { RoomContext } from "../durable-objects/room-context.js";
import {
  nextSeatIndex,
  playerCount,
  toRoomStatePayload,
  type ConnectionAttachment,
  type PersistedRoom,
} from "../durable-objects/room-state.js";
import { log } from "../lib/logger.js";
import { sendGameStateTo } from "./game-handler.js";

/**
 * Establishes identity for a connection from a verified access token.
 *
 * This is the only place a socket gains an identity. Nothing supplied by the
 * client — query parameters, message fields — is consulted; every field on the
 * seated player comes from verified JWT claims (spec sections 63, 83, 104.1).
 */
export async function authenticateConnection(
  ctx: RoomContext,
  verifier: SupabaseTokenVerifier,
  ws: CFWebSocket,
  attachment: ConnectionAttachment,
  token: string,
): Promise<void> {
  const { room } = ctx;

  if (attachment.userId) {
    ctx.send(ws, {
      type: "ERROR",
      code: "ALREADY_AUTHENTICATED",
      message: "This connection is already authenticated.",
    });
    return;
  }

  let identity: VerifiedIdentity;
  try {
    identity = await verifier.verify(token);
  } catch (err) {
    const code = err instanceof TokenVerificationError ? err.code : "VERIFIER_MISCONFIGURED";
    log.warn("auth.rejected", { roomId: room.roomId, code });
    ctx.send(ws, {
      type: "ERROR",
      code,
      message: "Authentication failed. Please sign in again.",
    });
    ctx.closeSocket(ws, 1008, "Authentication failed");
    return;
  }

  // A newer connection for the same user supersedes any older one.
  closeOtherConnectionsFor(ctx, identity.userId, attachment.connectionId);

  const isReconnect =
    room.players[identity.userId] !== undefined ||
    room.spectators[identity.userId] !== undefined;

  if (!isReconnect && !admit(room, identity, attachment)) {
    ctx.send(ws, { type: "ERROR", code: "ROOM_FULL", message: "This room is full." });
    ctx.closeSocket(ws, 1008, "Room full");
    return;
  }

  attachment.userId = identity.userId;
  attachment.displayName = identity.displayName;
  attachment.avatarUrl = identity.avatarUrl;
  attachment.isGuest = identity.isGuest;
  ws.serializeAttachment(attachment);

  // Reclaiming a seat cancels the forfeiture countdown.
  delete room.disconnectDeadlines[identity.userId];

  const record = room.players[identity.userId] ?? room.spectators[identity.userId];
  if (record) {
    record.status = "connected";
    record.id = attachment.connectionId;
    record.lastPingAt = Date.now();
    record.displayName = identity.displayName;
    record.avatarUrl = identity.avatarUrl;
  }

  await ctx.persist();

  ctx.send(ws, {
    type: "CONNECTED",
    connectionId: attachment.connectionId,
    userId: identity.userId,
    serverTimestamp: Date.now(),
  });

  if (isReconnect) {
    ctx.broadcast({
      type: "PLAYER_RECONNECTED",
      roomId: room.roomId,
      playerId: identity.userId,
    });
  } else if (record) {
    ctx.broadcast({ type: "PLAYER_JOINED", roomId: room.roomId, player: record });
  }

  ctx.send(ws, { type: "ROOM_STATE", room: toRoomStatePayload(room) });

  if (room.status === "in_game" && room.currentGameState) {
    sendGameStateTo(ctx, ws, identity.userId);
  }

  log.info("auth.accepted", {
    roomId: room.roomId,
    userId: identity.userId,
    isGuest: identity.isGuest,
    isReconnect,
  });
}

/**
 * Seats a newly-arrived user.
 *
 * Falls back to spectating when the room is full or a match is already running;
 * returns false only when spectating is disallowed too.
 */
export function admit(
  room: PersistedRoom,
  identity: VerifiedIdentity,
  attachment: ConnectionAttachment,
): boolean {
  const roomFull = playerCount(room) >= room.settings.maxPlayers;
  const gameUnderway = room.status === "in_game" || room.status === "finished";
  const mustSpectate = attachment.asSpectator || roomFull || gameUnderway;

  if (mustSpectate && !room.settings.allowSpectators) return false;

  if (!room.hostUserId && !mustSpectate) {
    room.hostUserId = identity.userId;
  }

  const player: ProtocolPlayer = {
    id: attachment.connectionId,
    userId: identity.userId,
    username: identity.displayName,
    displayName: identity.displayName,
    avatarUrl: identity.avatarUrl,
    role: mustSpectate ? "spectator" : room.hostUserId === identity.userId ? "host" : "player",
    isReady: false,
    seatIndex: mustSpectate ? -1 : nextSeatIndex(room),
    status: "connected",
    joinedAt: Date.now(),
    lastPingAt: Date.now(),
    isGuest: identity.isGuest,
  };

  if (mustSpectate) room.spectators[identity.userId] = player;
  else room.players[identity.userId] = player;

  return true;
}

function closeOtherConnectionsFor(
  ctx: RoomContext,
  userId: string,
  keepConnectionId: string,
): void {
  for (const other of ctx.sockets()) {
    const meta = ctx.attachmentOf(other);
    if (!meta || meta.userId !== userId || meta.connectionId === keepConnectionId) continue;
    ctx.closeSocket(other, 1000, "Replaced by a newer connection");
  }
}
