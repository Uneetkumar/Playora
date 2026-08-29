import type { WebSocket as CFWebSocket } from "@cloudflare/workers-types";
import type { ProtocolPlayer } from "@playora/protocol";
import { botRegistry, type AiLevel } from "@playora/bot-engine";
import type { BaseGameAction, BaseGameState } from "@playora/game-engine";

import type { RoomContext } from "../durable-objects/room-context.js";
import { nextSeatIndex, playerCount, toRoomStatePayload } from "../durable-objects/room-state.js";
import { log } from "../lib/logger.js";
import { executeAction } from "./game-handler.js";

/** Guards against a malformed engine state driving an endless bot loop. */
const MAX_CONSECUTIVE_BOT_TURNS = 64;

/**
 * Seats an AI opponent. Host only.
 *
 * The bot occupies a normal player seat and is flagged `isBot`, so every client
 * can label it plainly — a bot is never presented as a human (spec section 8).
 */
export async function addBot(
  ctx: RoomContext,
  ws: CFWebSocket,
  requesterId: string,
  level: AiLevel,
): Promise<void> {
  const { room } = ctx;

  if (room.hostUserId !== requesterId) {
    ctx.send(ws, {
      type: "ERROR",
      code: "FORBIDDEN",
      message: "Only the room host can add an AI opponent.",
    });
    return;
  }

  if (room.status !== "waiting") {
    ctx.send(ws, {
      type: "ERROR",
      code: "INVALID_STATE",
      message: "AI opponents can only be added before the game starts.",
    });
    return;
  }

  if (!botRegistry.has(room.gameId)) {
    ctx.send(ws, {
      type: "ERROR",
      code: "NOT_IMPLEMENTED",
      message: "There is no AI opponent for this game yet.",
    });
    return;
  }

  if (playerCount(room) >= room.settings.maxPlayers) {
    ctx.send(ws, { type: "ERROR", code: "ROOM_FULL", message: "This room is full." });
    return;
  }

  const botId = `bot-${crypto.randomUUID()}`;
  const name = `AI level ${level}`;
  const bot: ProtocolPlayer = {
    id: botId,
    userId: botId,
    username: name,
    displayName: name,
    avatarUrl: null,
    role: "player",
    // A bot is always ready; it never has to press anything.
    isReady: true,
    seatIndex: nextSeatIndex(room),
    status: "connected",
    joinedAt: Date.now(),
    lastPingAt: Date.now(),
    isGuest: false,
    isBot: true,
    botLevel: level,
  };

  room.players[botId] = bot;
  await ctx.persist();

  ctx.broadcast({ type: "PLAYER_JOINED", roomId: room.roomId, player: bot });
  ctx.broadcast({ type: "ROOM_STATE", room: toRoomStatePayload(room) });
  log.info("bot.added", { roomId: room.roomId, botId, level });
}

export async function removeBot(
  ctx: RoomContext,
  ws: CFWebSocket,
  requesterId: string,
  botId: string,
): Promise<void> {
  const { room } = ctx;

  if (room.hostUserId !== requesterId) {
    ctx.send(ws, {
      type: "ERROR",
      code: "FORBIDDEN",
      message: "Only the room host can remove an AI opponent.",
    });
    return;
  }

  const bot = room.players[botId];
  if (!bot?.isBot) {
    ctx.send(ws, { type: "ERROR", code: "NOT_FOUND", message: "No such AI opponent." });
    return;
  }

  delete room.players[botId];
  await ctx.persist();
  ctx.broadcast({ type: "PLAYER_LEFT", roomId: room.roomId, playerId: botId, reason: "kicked" });
  log.info("bot.removed", { roomId: room.roomId, botId });
}

export function isBotSeat(state: BaseGameState | null, ctx: RoomContext): boolean {
  const active = state?.activePlayerId;
  return active !== null && active !== undefined && ctx.room.players[active]?.isBot === true;
}

/**
 * Plays out every consecutive bot turn.
 *
 * Called after the game starts and after each human action, so a bot moves as
 * soon as the turn reaches it. Actions go through `executeAction`, the same
 * path a human move takes — bots get no shortcut around validation.
 */
export async function runBotTurns(ctx: RoomContext): Promise<void> {
  const { room } = ctx;

  for (let turn = 0; turn < MAX_CONSECUTIVE_BOT_TURNS; turn++) {
    const state = room.currentGameState;
    if (!state || room.status !== "in_game" || state.isFinished) return;

    const activeId = state.activePlayerId;
    if (!activeId) return;

    const seat = room.players[activeId];
    if (!seat?.isBot) return; // a human is on move

    if (!botRegistry.has(room.gameId)) return;
    const bot = botRegistry.get(room.gameId);
    const level = (seat.botLevel ?? 3) as AiLevel;

    const started = Date.now();
    const action = bot.chooseAction(state, activeId, level) as BaseGameAction | null;
    if (!action) {
      log.warn("bot.no_action", { roomId: room.roomId, botId: activeId, level });
      return;
    }

    const outcome = await executeAction(ctx, action);
    log.info("bot.moved", {
      roomId: room.roomId,
      botId: activeId,
      level,
      actionType: action.type,
      thinkMs: Date.now() - started,
      ok: outcome.ok,
    });

    // A rejected bot action means the bot and engine disagree. Stop rather than
    // spin: the humans keep a playable board and the log flags the bug.
    if (!outcome.ok) {
      log.error("bot.action_rejected", {
        roomId: room.roomId,
        botId: activeId,
        reason: outcome.message,
      });
      return;
    }
  }

  log.warn("bot.turn_limit_reached", { roomId: ctx.room.roomId });
}
