import type { WebSocket as CFWebSocket } from "@cloudflare/workers-types";
import { gameEngineRegistry } from "@playden/game-engine";
import type { AnyGameEngine, BaseGameAction, BaseGameState } from "@playden/game-engine";

import type { RoomContext } from "../durable-objects/room-context.js";
import { readAttachment } from "../durable-objects/room-state.js";
import { log, errorFields } from "../lib/logger.js";

export interface MatchResult {
  winnerId: string | null;
  scores: Array<{
    playerId: string;
    userId: string;
    rank: number;
    score: number;
    isWinner: boolean;
  }>;
  durationSeconds: number;
  reason: "normal" | "resignation" | "timeout" | "disconnect" | "draw";
}

/**
 * Starts a match. Host authority is re-checked against authoritative state here
 * rather than trusting anything captured when the socket opened.
 */
export async function startGame(
  ctx: RoomContext,
  ws: CFWebSocket,
  userId: string,
  customRules: Record<string, unknown> | undefined,
): Promise<void> {
  const { room } = ctx;

  if (room.hostUserId !== userId) {
    ctx.send(ws, {
      type: "ERROR",
      code: "FORBIDDEN",
      message: "Only the room host can start the game.",
    });
    return;
  }

  if (room.status === "in_game") {
    ctx.send(ws, {
      type: "ERROR",
      code: "INVALID_STATE",
      message: "A game is already in progress.",
    });
    return;
  }

  if (!gameEngineRegistry.has(room.gameId)) {
    ctx.send(ws, {
      type: "ERROR",
      code: "NOT_IMPLEMENTED",
      message: `Game '${room.gameId}' is not available yet.`,
    });
    return;
  }

  const engine = gameEngineRegistry.get(room.gameId);
  const players = Object.values(room.players);

  const validation = engine.validatePlayerCount(players);
  if (!validation.valid) {
    ctx.send(ws, {
      type: "ERROR",
      code: "INVALID_PLAYER_COUNT",
      message: validation.reason ?? "Not enough players to start.",
    });
    return;
  }

  room.status = "in_game";
  room.sequenceNumber = 1;
  room.currentSessionId = crypto.randomUUID();
  room.startedAt = Date.now();
  room.currentGameState = engine.init(players, {
    roomId: room.roomId,
    sessionId: room.currentSessionId,
    ...(customRules ?? {}),
  });
  await ctx.persist();

  ctx.broadcast({
    type: "GAME_STARTED",
    roomId: room.roomId,
    sessionId: room.currentSessionId,
    gameId: room.gameId,
    players,
    initialState: engine.getPlayerView(room.currentGameState, null),
    startedAt: room.startedAt,
  });

  broadcastGameState(ctx, engine);
  log.info("game.started", {
    roomId: room.roomId,
    gameId: room.gameId,
    sessionId: room.currentSessionId,
    players: players.length,
  });
}

/**
 * Validates and applies one player action.
 *
 * The acting player is taken from the verified session, so a client cannot
 * submit a move on another player's behalf.
 */
export async function applyGameAction(
  ctx: RoomContext,
  ws: CFWebSocket,
  userId: string,
  actionType: string,
  payload: unknown,
  clientActionId: string | undefined,
): Promise<void> {
  const { room } = ctx;

  if (room.status !== "in_game" || !room.currentGameState) {
    ctx.send(ws, {
      type: "ERROR",
      code: "INVALID_STATE",
      message: "No game is currently in progress.",
    });
    return;
  }

  if (!room.players[userId]) {
    ctx.send(ws, {
      type: "ERROR",
      code: "FORBIDDEN",
      message: "Spectators cannot act in the game.",
    });
    return;
  }

  if (!gameEngineRegistry.has(room.gameId)) return;
  const engine = gameEngineRegistry.get(room.gameId);

  const action: BaseGameAction = {
    type: actionType,
    playerId: userId,
    payload,
    timestamp: Date.now(),
    ...(clientActionId ? { clientActionId } : {}),
  };

  const validation = engine.validateAction(room.currentGameState, action);
  if (!validation.valid) {
    log.info("action.rejected", {
      roomId: room.roomId,
      userId,
      actionType,
      reason: validation.reason,
    });
    ctx.send(ws, {
      type: "ERROR",
      code: "ILLEGAL_MOVE",
      message: validation.reason ?? "That move is not legal.",
      details: { clientActionId },
    });
    return;
  }

  try {
    const result = engine.executeAction(room.currentGameState, action);
    room.currentGameState = result.state;
    room.sequenceNumber = result.state.sequenceNumber;
    await ctx.persist();

    broadcastGameState(ctx, engine, action);

    for (const event of result.events ?? []) {
      ctx.broadcast({
        type: "GAME_EVENT",
        roomId: room.roomId,
        sessionId: room.currentSessionId ?? "",
        eventType: (event as { type?: string }).type ?? "EVENT",
        payload: event,
      });
    }

    if (engine.isGameOver(room.currentGameState)) {
      await finishGame(ctx, engine.calculateResult(room.currentGameState, room.roomId));
    }
  } catch (err) {
    log.error("action.failed", { roomId: room.roomId, userId, actionType, ...errorFields(err) });
    ctx.send(ws, {
      type: "ERROR",
      code: "EXECUTION_ERROR",
      message: "That action could not be completed.",
    });
  }
}

/**
 * Terminates the match and announces the result.
 *
 * Slice 3 hooks persistence to Supabase here; the write must not block the
 * broadcast, so players see the result immediately either way.
 */
export async function finishGame(ctx: RoomContext, result: MatchResult): Promise<void> {
  const { room } = ctx;

  room.status = "finished";
  room.endedAt = Date.now();
  await ctx.persist();

  ctx.broadcast({
    type: "GAME_FINISHED",
    roomId: room.roomId,
    sessionId: room.currentSessionId ?? "",
    result,
  });

  log.info("game.finished", {
    roomId: room.roomId,
    sessionId: room.currentSessionId,
    winnerId: result.winnerId,
    reason: result.reason,
    durationSeconds: result.durationSeconds,
  });
}

/** Sends one player their own entitled view of the current state. */
export function sendGameStateTo(
  ctx: RoomContext,
  ws: CFWebSocket,
  userId: string | null,
): void {
  const { room } = ctx;
  if (!room.currentGameState || !gameEngineRegistry.has(room.gameId)) return;
  const engine = gameEngineRegistry.get(room.gameId);
  ctx.send(ws, {
    type: "GAME_STATE",
    roomId: room.roomId,
    sessionId: room.currentSessionId ?? "",
    sequenceNumber: room.sequenceNumber,
    state: engine.getPlayerView(room.currentGameState, userId),
  });
}

/**
 * Serialises state per recipient so nobody receives another player's hidden
 * information (spec section 64).
 */
export function broadcastGameState(
  ctx: RoomContext,
  engine: AnyGameEngine,
  lastAction?: BaseGameAction,
): void {
  const { room } = ctx;
  const state: BaseGameState | null = room.currentGameState;
  if (!state) return;

  for (const ws of ctx.sockets()) {
    const meta = readAttachment(ws);
    if (!meta?.userId) continue;
    ctx.send(ws, {
      type: "GAME_STATE",
      roomId: room.roomId,
      sessionId: room.currentSessionId ?? "",
      sequenceNumber: room.sequenceNumber,
      state: engine.getPlayerView(state, meta.userId),
      ...(lastAction
        ? {
            lastAction: {
              type: lastAction.type,
              playerId: lastAction.playerId,
              payload: lastAction.payload,
              ...(lastAction.clientActionId
                ? { clientActionId: lastAction.clientActionId }
                : {}),
            },
          }
        : {}),
    });
  }
}
