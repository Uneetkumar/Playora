import type { WebSocket as CFWebSocket } from "@cloudflare/workers-types";
import { gameEngineRegistry } from "@playora/game-engine";
import type { AnyGameEngine, BaseGameAction, BaseGameState } from "@playora/game-engine";

import { RoomOptionsSchema, playersNotReady, validateRoomOptions } from "@playora/protocol";

import type { RoomContext } from "../durable-objects/room-context.js";
import { readAttachment, toRoomStatePayload } from "../durable-objects/room-state.js";
import { log, errorFields } from "../lib/logger.js";
import { engineConfigFor, resetReadiness, updateRoomSettings } from "./lobby-handler.js";

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
 *
 * The ready check is enforced here, not only in the lobby UI: every seated
 * human other than the host has to have readied up. Bots are always ready,
 * and the host's Start is the host's ready (`playersNotReady`).
 *
 * `customRules` is the room's options under its older name. It is held to the
 * same whitelist as UPDATE_ROOM_SETTINGS and saved to the room, so a client
 * can no longer hand the engine a deck seed or a hand size of its choosing.
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

  // Settings before the ready check: changing them clears everyone's ready
  // (updateRoomSettings), so a Start that changes them waits for the guests
  // to agree to the new ones rather than dealing on the old agreement.
  if (customRules && Object.keys(customRules).length > 0) {
    const parsed = RoomOptionsSchema.safeParse(customRules);
    const allowed = parsed.success ? validateRoomOptions(room.gameId, parsed.data) : null;
    if (!parsed.success || !allowed?.ok) {
      ctx.send(ws, {
        type: "ERROR",
        code: "INVALID_SETTINGS",
        message: allowed && !allowed.ok ? allowed.reason : "Those game settings are not valid.",
      });
      return;
    }
    // The same path the lobby's settings take, so the change is saved and
    // everyone sees it before the deal.
    await updateRoomSettings(ctx, ws, userId, parsed.data);
  }

  const waitingOn = playersNotReady(Object.values(room.players), room.hostUserId);
  if (waitingOn.length > 0) {
    ctx.send(ws, {
      type: "ERROR",
      code: "PLAYERS_NOT_READY",
      message:
        waitingOn.length === 1
          ? "Waiting for 1 player to ready up."
          : `Waiting for ${waitingOn.length} players to ready up.`,
      details: { waitingOn },
    });
    return;
  }

  if (!(await beginSession(ctx))) {
    ctx.send(ws, {
      type: "ERROR",
      code: "EXECUTION_ERROR",
      message: "The game could not be dealt. The room is still open; try starting again.",
    });
  }
}

/**
 * Deals a new session into the room.
 *
 * Split out from startGame because a rematch is the same act performed by a
 * different authority: nobody is the host of a rematch, both players agreed to
 * it. The permission and validation checks stay in the callers, so this is
 * never reachable without one of them having run.
 *
 * The engine deals first and the room is only touched once it has. An engine
 * that refuses the deal (too few players, say) used to throw after the room
 * was already marked `in_game`, which left it stuck there: Start refused as
 * "already in progress", and anyone joining became a spectator. Returns false
 * when the deal is refused, with the room exactly as it was.
 */
export async function beginSession(ctx: RoomContext): Promise<boolean> {
  const { room } = ctx;
  const engine = gameEngineRegistry.get(room.gameId);
  const players = Object.values(room.players);

  const sessionId = crypto.randomUUID();
  let initialState: BaseGameState;
  try {
    initialState = engine.init(players, {
      ...engineConfigFor(room),
      roomId: room.roomId,
      sessionId,
      // Its own secret, never the session id. The session id is broadcast to
      // every client, and a deck shuffled from it can be dealt again by anyone
      // holding the open-source engine.
      randomSeed: crypto.randomUUID(),
    });
  } catch (err) {
    log.error("game.deal_failed", {
      roomId: room.roomId,
      gameId: room.gameId,
      players: players.length,
      ...errorFields(err),
    });
    return false;
  }

  room.status = "in_game";
  room.sequenceNumber = 1;
  room.currentSessionId = sessionId;
  room.startedAt = Date.now();
  room.endedAt = null;
  // Readiness was for this deal; the next one asks again.
  resetReadiness(room);
  room.currentGameState = initialState;
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
  return true;
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

  const action: BaseGameAction = {
    type: actionType,
    playerId: userId,
    payload,
    timestamp: Date.now(),
    ...(clientActionId ? { clientActionId } : {}),
  };

  const outcome = await executeAction(ctx, action);
  if (!outcome.ok) {
    ctx.send(ws, {
      type: "ERROR",
      code: outcome.code,
      message: outcome.message,
      details: { clientActionId },
    });
  }
}

export type ActionOutcome =
  | { ok: true }
  | { ok: false; code: "ILLEGAL_MOVE" | "EXECUTION_ERROR"; message: string };

/**
 * The single path every action takes -- human or bot.
 *
 * Bots call this with an action they generated, so they are subject to exactly
 * the same validation as a player at a keyboard and can never reach a state a
 * human could not (spec section 104.5).
 */
export async function executeAction(
  ctx: RoomContext,
  action: BaseGameAction,
): Promise<ActionOutcome> {
  const { room } = ctx;
  if (!room.currentGameState || !gameEngineRegistry.has(room.gameId)) {
    return { ok: false, code: "EXECUTION_ERROR", message: "No game in progress." };
  }
  const engine = gameEngineRegistry.get(room.gameId);

  const validation = engine.validateAction(room.currentGameState, action);
  if (!validation.valid) {
    log.info("action.rejected", {
      roomId: room.roomId,
      userId: action.playerId,
      actionType: action.type,
      reason: validation.reason,
    });
    return {
      ok: false,
      code: "ILLEGAL_MOVE",
      message: validation.reason ?? "That move is not legal.",
    };
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
    return { ok: true };
  } catch (err) {
    log.error("action.failed", {
      roomId: room.roomId,
      userId: action.playerId,
      actionType: action.type,
      ...errorFields(err),
    });
    return { ok: false, code: "EXECUTION_ERROR", message: "That action could not be completed." };
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
  // A vote cast after the previous match must not carry into this one.
  room.rematchVotes = [];
  // Nor a ready tick: the next match is a new decision.
  resetReadiness(room);
  await ctx.persist();

  ctx.broadcast({
    type: "GAME_FINISHED",
    roomId: room.roomId,
    sessionId: room.currentSessionId ?? "",
    result,
  });
  // After the result, so a client that applies ROOM_STATE wholesale already
  // knows the match is over.
  ctx.broadcast({ type: "ROOM_STATE", room: toRoomStatePayload(room) });

  log.info("game.finished", {
    roomId: room.roomId,
    sessionId: room.currentSessionId,
    winnerId: result.winnerId,
    reason: result.reason,
    durationSeconds: result.durationSeconds,
  });

  // Broadcast first, persist second: players see the result immediately whether
  // or not the write succeeds.
  await ctx.recordResult({
    sessionId: room.currentSessionId ?? "",
    startedAt: room.startedAt ?? room.createdAt,
    endedAt: room.endedAt ?? Date.now(),
    result,
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
