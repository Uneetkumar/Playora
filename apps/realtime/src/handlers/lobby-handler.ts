import type { WebSocket as CFWebSocket } from "@cloudflare/workers-types";
import {
  mergeRoomOptions,
  readRoomOptions,
  validateRoomOptions,
  type RoomOptions,
} from "@playora/protocol";

import type { RoomContext } from "../durable-objects/room-context.js";
import { toRoomStatePayload, type PersistedRoom } from "../durable-objects/room-state.js";
import { log } from "../lib/logger.js";

/**
 * The lobby: readiness, the host's room options, and removing people.
 *
 * Every action here is re-checked against the persisted room, never against
 * anything the client says about itself. Host authority is `room.hostUserId`
 * at the moment the message is handled, so a host who has just been replaced
 * cannot act on a stale claim.
 */

/** Close code for a socket whose player the host removed. Normal closure, so the client does not reconnect. */
const KICKED_CLOSE_CODE = 1000;

/** The options the room was last given, as far as they apply to its game. */
export function roomOptionsOf(room: PersistedRoom): RoomOptions {
  return readRoomOptions(room.gameId, room.settings.customRules);
}

/**
 * The part of the room's options an engine is told about at deal time.
 *
 * Only what an engine actually reads goes through. `botLevel` belongs to the
 * bots, and UNO house rules are stored for the lobby but not yet implemented
 * by the engines, so neither is passed on.
 */
export function engineConfigFor(room: PersistedRoom): Record<string, unknown> {
  const options = roomOptionsOf(room);
  const config: Record<string, unknown> = {};
  if (options.laps !== undefined) config["laps"] = options.laps;
  return config;
}

/**
 * Clears every human's ready flag. Bots stay ready; they never have to press
 * anything.
 *
 * Called when a match ends and when one starts, so a tick from the last game
 * never counts towards the next.
 */
export function resetReadiness(room: PersistedRoom): void {
  for (const player of Object.values(room.players)) {
    player.isReady = player.isBot === true;
  }
}

/** READY, UNREADY and SET_READY all land here. */
export async function setReady(
  ctx: RoomContext,
  ws: CFWebSocket,
  userId: string,
  ready: boolean,
): Promise<void> {
  const { room } = ctx;
  const player = room.players[userId];

  if (!player) {
    ctx.send(ws, {
      type: "ERROR",
      code: "FORBIDDEN",
      message: "Only seated players can ready up.",
    });
    return;
  }

  if (room.status === "in_game") {
    ctx.send(ws, {
      type: "ERROR",
      code: "INVALID_STATE",
      message: "The match has already started.",
    });
    return;
  }

  // Nothing changed, so nothing to tell anyone.
  if (player.isReady === ready) return;

  player.isReady = ready;
  await ctx.persist();
  ctx.broadcast({
    type: "PLAYER_READY",
    roomId: room.roomId,
    playerId: userId,
    isReady: ready,
  });
}

/**
 * Host-only: removes someone from the room.
 *
 * A seated player can only be removed between matches, because the engine's
 * state still has them in the turn order once a match is dealt. A spectator
 * has no seat to unwind and can be removed at any time.
 *
 * The person removed is barred from rejoining this room, or the reconnect
 * logic would put them straight back in the seat they were removed from.
 */
export async function kickPlayer(
  ctx: RoomContext,
  ws: CFWebSocket,
  requesterId: string,
  targetId: string,
): Promise<void> {
  const { room } = ctx;

  if (room.hostUserId !== requesterId) {
    ctx.send(ws, {
      type: "ERROR",
      code: "FORBIDDEN",
      message: "Only the room host can remove players.",
    });
    return;
  }

  if (targetId === requesterId) {
    ctx.send(ws, {
      type: "ERROR",
      code: "INVALID_REQUEST",
      message: "Leave the room instead of removing yourself.",
    });
    return;
  }

  const seated = room.players[targetId];
  const watching = room.spectators[targetId];
  if (!seated && !watching) {
    ctx.send(ws, { type: "ERROR", code: "NOT_FOUND", message: "That player is not in this room." });
    return;
  }

  if (seated && room.status === "in_game") {
    ctx.send(ws, {
      type: "ERROR",
      code: "INVALID_STATE",
      message: "Players can only be removed between matches.",
    });
    return;
  }

  delete room.players[targetId];
  delete room.spectators[targetId];
  delete room.disconnectDeadlines[targetId];
  if (room.rematchVotes) room.rematchVotes = room.rematchVotes.filter((id) => id !== targetId);
  // A bot has no account to bar, and a host may well want it back later.
  if (!seated?.isBot) {
    room.kickedUserIds = [...new Set([...(room.kickedUserIds ?? []), targetId])];
  }
  await ctx.persist();

  ctx.broadcast({ type: "PLAYER_LEFT", roomId: room.roomId, playerId: targetId, reason: "kicked" });
  ctx.broadcast({ type: "ROOM_STATE", room: toRoomStatePayload(room) });

  // Told before the socket closes, so the client can say why it left.
  for (const socket of ctx.sockets()) {
    if (ctx.attachmentOf(socket)?.userId !== targetId) continue;
    ctx.send(socket, {
      type: "ERROR",
      code: "KICKED",
      message: "The host removed you from this room.",
    });
    ctx.closeSocket(socket, KICKED_CLOSE_CODE, "Removed by the host");
  }

  log.info("player.kicked", { roomId: room.roomId, targetId, bot: seated?.isBot === true });
}

/**
 * Host-only: changes the room's options between matches.
 *
 * The message schema has already bounded every value; this checks which keys
 * apply to the room's game, so laps cannot be set on a chess room. Changing
 * the bot level re-levels the bots already seated, because the lobby shows
 * one level for the room, not one per bot. Any real change clears the
 * guests' ready flags.
 */
export async function updateRoomSettings(
  ctx: RoomContext,
  ws: CFWebSocket,
  requesterId: string,
  patch: RoomOptions,
): Promise<void> {
  const { room } = ctx;

  if (room.hostUserId !== requesterId) {
    ctx.send(ws, {
      type: "ERROR",
      code: "FORBIDDEN",
      message: "Only the room host can change the room's settings.",
    });
    return;
  }

  if (room.status === "in_game") {
    ctx.send(ws, {
      type: "ERROR",
      code: "INVALID_STATE",
      message: "Settings can only be changed between matches.",
    });
    return;
  }

  const validation = validateRoomOptions(room.gameId, patch);
  if (!validation.ok) {
    ctx.send(ws, {
      type: "ERROR",
      code: "INVALID_SETTINGS",
      message: validation.reason,
      details: { rejected: validation.rejected },
    });
    return;
  }

  const previous = roomOptionsOf(room);
  const next = mergeRoomOptions(previous, validation.options);
  room.settings.customRules = { ...next };

  if (validation.options.botLevel !== undefined) {
    relevelBots(room, validation.options.botLevel);
  }

  // A guest readied up for the match as it was set. Ten laps or a level 7 bot
  // is a different match, so they are asked again; otherwise a host could
  // change the settings after everyone was ready and start at once. The
  // ROOM_STATE below carries the cleared flags.
  if (!sameOptions(previous, next)) resetReadiness(room);

  await ctx.persist();
  ctx.broadcast({ type: "ROOM_STATE", room: toRoomStatePayload(room) });
  log.info("room.settings_updated", { roomId: room.roomId, keys: Object.keys(patch) });
}

/** Whether two option sets describe the same match, whatever order their keys were written in. */
function sameOptions(a: RoomOptions, b: RoomOptions): boolean {
  const canonical = (options: RoomOptions) =>
    JSON.stringify(options, (_key, value: unknown) =>
      value && typeof value === "object" && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)))
        : value,
    );
  return canonical(a) === canonical(b);
}

/** The name a bot is shown under. Says what it is and how strong, never a human name. */
export function botDisplayName(level: number): string {
  return `AI level ${level}`;
}

function relevelBots(room: PersistedRoom, level: number): void {
  for (const player of Object.values(room.players)) {
    if (!player.isBot) continue;
    player.botLevel = level;
    player.displayName = botDisplayName(level);
    player.username = botDisplayName(level);
  }
}
