import type {
  DurableObjectState,
  WebSocket as CFWebSocket,
  Response as CFResponse,
} from "@cloudflare/workers-types";
import {
  parseClientMessage,
  serializeProtocolMessage,
  type ClientMessage,
  type ServerMessage,
} from "@playora/protocol";
import { gameEngineRegistry } from "@playora/game-engine";
import { SupabaseTokenVerifier } from "@playora/auth";
import type { GameId } from "@playora/game-types";

import type { Env } from "../types.js";
import { RateLimiter, type RateLimitKind } from "../lib/rate-limit.js";
import { log, errorFields } from "../lib/logger.js";
import { createResultStore, recordMatchSafely, type ResultStore } from "../lib/result-store.js";
import {
  applyProgressionSafely,
  createProgressionStore,
  type SupabaseProgressionStore,
} from "../lib/progression-store.js";
import { authenticateConnection } from "../handlers/auth-handler.js";
import { applyGameAction, finishGame, startGame } from "../handlers/game-handler.js";
import { addBot, removeBot, runBotTurns } from "../handlers/bot-handler.js";
import { voteRematch } from "../handlers/rematch-handler.js";
import { RaceLoop, applyRaceInput, isRealTimeGame } from "../handlers/race-handler.js";
import type { RoomContext } from "./room-context.js";
import {
  AUTH_DEADLINE_MS,
  DEFAULT_GRACE_PERIOD_SECONDS,
  createRoom,
  readAttachment,
  reassignHost,
  toRoomStatePayload,
  type ConnectionAttachment,
  type PersistedRoom,
} from "./room-state.js";

const ROOM_KEY = "room";
const CHAT_MAX_LENGTH = 500;
// Matching control characters is the point: they are stripped from chat input
// so they cannot break rendering or smuggle terminal escapes.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

/**
 * Authoritative live state for a single room.
 *
 * This class owns lifecycle only — sockets, storage, alarms and routing.
 * Authentication lives in `handlers/auth-handler.ts` and gameplay in
 * `handlers/game-handler.ts`, both reached through the narrow `RoomContext`
 * seam so neither has to know about socket or storage mechanics.
 *
 * Two invariants govern the whole module:
 *
 *  1. **Identity is never taken from the client.** A connection carries no
 *     identity until an AUTH message has been cryptographically verified.
 *     Query parameters and message bodies are untrusted input
 *     (spec sections 63, 83, 104.1).
 *
 *  2. **All state is durable.** Room and game state live in Durable Object
 *     storage and are restored on construction, and sockets use the hibernation
 *     API. Eviction is routine and must never destroy a match (spec section 61).
 */
export class RoomDurableObject {
  private state: DurableObjectState;
  protected env: Env;
  private room: PersistedRoom | null = null;
  private rateLimiter = new RateLimiter();
  private verifier: SupabaseTokenVerifier | null = null;
  private resultStore: ResultStore | null | undefined;
  private progressionStore: SupabaseProgressionStore | null | undefined;
  /**
   * The clock for a real-time game. Null for turn-based ones, which advance
   * only when somebody moves.
   */
  private raceLoop: RaceLoop | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;

    // Restore before any request is served, so a revived object never serves
    // an empty room to a reconnecting player.
    this.state.blockConcurrencyWhile(async () => {
      this.room = (await this.state.storage.get<PersistedRoom>(ROOM_KEY)) ?? null;
    });
  }

  // ---------------------------------------------------------------------------
  // HTTP
  // ---------------------------------------------------------------------------

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleUpgrade(url);
    }

    if (url.pathname.endsWith("/status")) {
      const room = this.room;
      return Response.json({
        exists: room !== null,
        roomId: room?.roomId ?? null,
        roomCode: room?.roomCode ?? null,
        gameId: room?.gameId ?? null,
        status: room?.status ?? null,
        playerCount: room ? Object.keys(room.players).length : 0,
        spectatorCount: room ? Object.keys(room.spectators).length : 0,
        activeConnections: this.state.getWebSockets().length,
        sequenceNumber: room?.sequenceNumber ?? 0,
        currentSessionId: room?.currentSessionId ?? null,
      });
    }

    return new Response("Not Found", { status: 404 });
  }

  private async handleUpgrade(url: URL): Promise<Response> {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1] as unknown as CFWebSocket;

    const roomId = url.searchParams.get("roomId") || this.state.id.toString();
    const gameId = (url.searchParams.get("gameId") as GameId | null) ?? "chess";

    if (!this.room) {
      const maxPlayers = gameEngineRegistry.has(gameId)
        ? gameEngineRegistry.get(gameId).maxPlayers
        : 2;
      this.room = createRoom({
        roomId,
        roomCode: deriveRoomCode(roomId),
        gameId,
        maxPlayers,
        isPrivate: url.searchParams.get("private") === "true",
        now: Date.now(),
      });
      await this.persist();
    }

    // Hibernation: the runtime, not this object, owns the socket lifecycle.
    this.state.acceptWebSocket(server);

    const attachment: ConnectionAttachment = {
      connectionId: crypto.randomUUID(),
      userId: null, // established only by a verified AUTH message
      displayName: "",
      avatarUrl: null,
      isGuest: false,
      asSpectator: url.searchParams.get("spectator") === "true",
      connectedAt: Date.now(),
      lastSeenAt: Date.now(),
    };
    server.serializeAttachment(attachment);

    // Unauthenticated sockets are swept by the alarm if AUTH never arrives.
    await this.scheduleAlarm();

    return new Response(null, {
      status: 101,
      webSocket: client as unknown as CFResponse["webSocket"],
    });
  }

  // ---------------------------------------------------------------------------
  // WebSocket lifecycle (hibernation API)
  // ---------------------------------------------------------------------------

  async webSocketMessage(ws: CFWebSocket, raw: string | ArrayBuffer): Promise<void> {
    const attachment = readAttachment(ws);
    if (!attachment || !this.room) return;

    const parsed = parseClientMessage(typeof raw === "string" ? raw : "");
    if (!parsed.success) {
      this.send(ws, { type: "ERROR", code: "BAD_REQUEST", message: parsed.error });
      return;
    }

    const msg = parsed.data;
    attachment.lastSeenAt = Date.now();

    // PING is the only traffic permitted before authentication.
    if (msg.type === "PING") {
      this.touch(ws, attachment);
      return;
    }

    if (msg.type === "AUTH") {
      await authenticateConnection(this.context(), this.getVerifier(), ws, attachment, msg.token);
      return;
    }

    if (!attachment.userId) {
      this.send(ws, {
        type: "ERROR",
        code: "UNAUTHENTICATED",
        message: "Send an AUTH message with a valid access token before any other action.",
      });
      return;
    }

    ws.serializeAttachment(attachment);
    await this.route(ws, attachment.userId, attachment, msg);
  }

  async webSocketClose(ws: CFWebSocket): Promise<void> {
    await this.handleDisconnect(ws, "disconnected");
  }

  async webSocketError(ws: CFWebSocket, error: unknown): Promise<void> {
    log.warn("socket.error", { roomId: this.room?.roomId, ...errorFields(error) });
    await this.handleDisconnect(ws, "disconnected");
  }

  // ---------------------------------------------------------------------------
  // Message routing
  // ---------------------------------------------------------------------------

  private async route(
    ws: CFWebSocket,
    userId: string,
    attachment: ConnectionAttachment,
    msg: ClientMessage,
  ): Promise<void> {
    const room = this.room;
    if (!room) return;
    const ctx = this.context();

    switch (msg.type) {
      case "READY":
      case "UNREADY": {
        const player = room.players[userId];
        if (!player) return;
        player.isReady = msg.type === "READY";
        await this.persist();
        ctx.broadcast({
          type: "PLAYER_READY",
          roomId: room.roomId,
          playerId: userId,
          isReady: player.isReady,
        });
        return;
      }

      case "START_GAME":
        await startGame(ctx, ws, userId, msg.customRules);
        await runBotTurns(ctx);
        this.syncRaceLoop();
        return;

      case "REMATCH": {
        const outcome = await voteRematch(ctx, ws, userId, msg.accept);
        // A rematch can hand the first move to a bot, exactly as a fresh start can.
        if (outcome.started) {
          await runBotTurns(ctx);
          this.syncRaceLoop();
        }
        return;
      }

      case "ADD_BOT":
        await addBot(ctx, ws, userId, msg.level as Parameters<typeof addBot>[3]);
        return;

      case "REMOVE_BOT":
        await removeBot(ctx, ws, userId, msg.botId);
        return;

      case "GAME_ACTION": {
        if (!this.allow(ws, attachment.connectionId, "gameAction")) return;

        // Driving input takes a different path: it arrives many times a second
        // and must not be broadcast, because the race loop's own snapshot is
        // what tells everyone where the cars are.
        if (isRealTimeGame(room.gameId) && msg.actionType === "SET_INPUT") {
          const outcome = applyRaceInput(ctx, userId, msg.payload);
          if (!outcome.ok) {
            ctx.send(ws, {
              type: "ERROR",
              code: "ILLEGAL_MOVE",
              message: outcome.reason ?? "That input was rejected.",
            });
          }
          return;
        }

        await applyGameAction(ctx, ws, userId, msg.actionType, msg.payload, msg.clientActionId);
        await runBotTurns(ctx);
        return;
      }

      case "CHAT_SEND": {
        if (!this.allow(ws, attachment.connectionId, "chat")) return;
        const message = sanitizeChat(msg.message);
        if (!message) return;
        ctx.broadcast({
          type: "CHAT_MESSAGE",
          chat: {
            id: crypto.randomUUID(),
            roomId: room.roomId,
            senderId: userId,
            senderName: attachment.displayName,
            senderAvatarUrl: attachment.avatarUrl,
            message,
            timestamp: Date.now(),
          },
        });
        return;
      }

      case "REACTION_SEND":
        if (!this.allow(ws, attachment.connectionId, "reaction")) return;
        ctx.broadcast({
          type: "REACTION",
          roomId: room.roomId,
          senderId: userId,
          emoji: msg.emoji,
          timestamp: Date.now(),
        });
        return;

      case "RESYNC": {
        let gameState: unknown;
        if (room.currentGameState && gameEngineRegistry.has(room.gameId)) {
          gameState = gameEngineRegistry
            .get(room.gameId)
            .getPlayerView(room.currentGameState, userId);
        }
        this.send(ws, {
          type: "RESYNC_STATE",
          roomId: room.roomId,
          room: toRoomStatePayload(room),
          gameState,
          sequenceNumber: room.sequenceNumber,
        });
        return;
      }

      case "LEAVE_ROOM":
        await this.handleDisconnect(ws, "voluntary");
        this.closeSocket(ws, 1000, "Left room");
        return;

      default:
        return;
    }
  }

  // ---------------------------------------------------------------------------
  // Disconnect, grace period and alarms
  // ---------------------------------------------------------------------------

  private async handleDisconnect(
    ws: CFWebSocket,
    reason: "voluntary" | "disconnected",
  ): Promise<void> {
    const attachment = readAttachment(ws);
    const room = this.room;
    if (!attachment || !room) return;

    this.rateLimiter.forget(attachment.connectionId);

    const userId = attachment.userId;
    if (!userId) return; // never authenticated; nothing to preserve

    // A superseded socket must not evict the session that replaced it.
    const stillConnected = this.state.getWebSockets().some((other) => {
      if (other === ws) return false;
      return readAttachment(other)?.userId === userId;
    });
    if (stillConnected) return;

    const record = room.players[userId] ?? room.spectators[userId];
    if (!record) return;

    if (reason !== "voluntary" && room.status === "in_game") {
      record.status = "disconnected";
      room.disconnectDeadlines[userId] = Date.now() + DEFAULT_GRACE_PERIOD_SECONDS * 1000;
      await this.persist();
      await this.scheduleAlarm();

      this.context().broadcast({
        type: "PLAYER_DISCONNECTED",
        roomId: room.roomId,
        playerId: userId,
        gracePeriodSeconds: DEFAULT_GRACE_PERIOD_SECONDS,
      });
      log.info("player.disconnected", { roomId: room.roomId, userId, grace: true });
      return;
    }

    await this.removePlayer(userId, reason);
  }

  private async removePlayer(
    userId: string,
    reason: "voluntary" | "kicked" | "timeout" | "disconnected",
  ): Promise<void> {
    const room = this.room;
    if (!room) return;

    delete room.players[userId];
    delete room.spectators[userId];
    delete room.disconnectDeadlines[userId];

    if (room.hostUserId === userId) reassignHost(room);
    await this.persist();

    this.context().broadcast({
      type: "PLAYER_LEFT",
      roomId: room.roomId,
      playerId: userId,
      reason,
    });
    log.info("player.left", { roomId: room.roomId, userId, reason });

    await this.checkAbandonment(userId);
    // A race whose room has emptied or been abandoned must not keep a timer
    // ticking: nothing is watching, and the Durable Object cannot hibernate
    // while an interval is pending.
    this.syncRaceLoop();
  }

  /** Awards the match when everyone but one player has forfeited their seat. */
  private async checkAbandonment(departedUserId: string): Promise<void> {
    const room = this.room;
    if (!room || room.status !== "in_game") return;

    const remaining = Object.values(room.players).filter((p) => p.status === "connected");
    const survivor = remaining[0];
    if (remaining.length !== 1 || !survivor) return;

    await finishGame(this.context(), {
      winnerId: survivor.userId,
      scores: [
        { playerId: survivor.userId, userId: survivor.userId, rank: 1, score: 1, isWinner: true },
        { playerId: departedUserId, userId: departedUserId, rank: 2, score: 0, isWinner: false },
      ],
      durationSeconds: Math.floor((Date.now() - (room.startedAt ?? room.createdAt)) / 1000),
      reason: "disconnect",
    });
  }

  /**
   * Sweeps expired grace periods and unauthenticated sockets.
   *
   * Alarms survive eviction; the setTimeout this replaced did not.
   */
  async alarm(): Promise<void> {
    const room = this.room;
    if (!room) return;
    const now = Date.now();

    for (const [userId, deadline] of Object.entries(room.disconnectDeadlines)) {
      if (deadline <= now) {
        log.info("player.grace_expired", { roomId: room.roomId, userId });
        await this.removePlayer(userId, "timeout");
      }
    }

    for (const ws of this.state.getWebSockets()) {
      const meta = readAttachment(ws);
      if (meta && !meta.userId && now - meta.connectedAt > AUTH_DEADLINE_MS) {
        this.closeSocket(ws, 1008, "Authentication timeout");
      }
    }

    await this.scheduleAlarm();
  }

  private async scheduleAlarm(): Promise<void> {
    const room = this.room;
    if (!room) return;

    const deadlines = Object.values(room.disconnectDeadlines);
    for (const ws of this.state.getWebSockets()) {
      const meta = readAttachment(ws);
      if (meta && !meta.userId) deadlines.push(meta.connectedAt + AUTH_DEADLINE_MS);
    }
    if (deadlines.length === 0) return;

    const next = Math.min(...deadlines);
    const existing = await this.state.storage.getAlarm();
    if (existing === null || existing > next) {
      await this.state.storage.setAlarm(next);
    }
  }

  // ---------------------------------------------------------------------------
  // RoomContext implementation
  // ---------------------------------------------------------------------------

  private context(): RoomContext {
    const room = this.room;
    if (!room) throw new Error("Room accessed before initialisation.");
    return {
      room,
      sockets: () => this.state.getWebSockets(),
      attachmentOf: (ws) => readAttachment(ws),
      send: (ws, msg) => this.send(ws, msg),
      broadcast: (msg) => this.broadcast(msg),
      closeSocket: (ws, code, reason) => this.closeSocket(ws, code, reason),
      persist: () => this.persist(),
      recordResult: async (record) => {
        // Built lazily: an unconfigured Worker simply does not record.
        this.resultStore ??= createResultStore(this.env);
        const outcome = await recordMatchSafely(this.resultStore, {
          roomCode: room.roomCode,
          ...record,
        });

        // Rating and XP only apply once the match itself is on record.
        if (!outcome.ok || !outcome.gameId) return;
        this.progressionStore ??= createProgressionStore(this.env);
        const progression = await applyProgressionSafely(this.progressionStore, {
          gameId: outcome.gameId,
          gameSlug: room.gameId,
          sessionId: record.sessionId,
          result: record.result,
          botIds: Object.values(room.players)
            .filter((p) => p.isBot)
            .map((p) => p.userId),
        });

        // The result screen is already on-screen by now; this fills in the
        // numbers. Nothing downstream depends on it arriving.
        if (progression.length > 0) {
          this.broadcast({
            type: "MATCH_PROGRESSION",
            roomId: room.roomId,
            sessionId: record.sessionId,
            players: progression,
          });
        }
      },
    };
  }

  /**
   * Starts or stops the race clock to match the room.
   *
   * Called after anything that can change whether a race is running. Keeping it
   * in one place means there is no path that starts a race without a clock, or
   * leaves a timer running on a room that has finished.
   */
  private syncRaceLoop(): void {
    const room = this.room;
    if (!room) return;

    const shouldRun = room.status === "in_game" && isRealTimeGame(room.gameId);

    if (!shouldRun) {
      this.raceLoop?.stop();
      return;
    }

    this.raceLoop ??= new RaceLoop(this.context(), async (result) => {
      await finishGame(this.context(), result);
    });
    this.raceLoop.start();
  }

  private getVerifier(): SupabaseTokenVerifier {
    this.verifier ??= new SupabaseTokenVerifier({
      supabaseUrl: this.env.SUPABASE_URL,
      jwtSecret: this.env.SUPABASE_JWT_SECRET,
    });
    return this.verifier;
  }

  private allow(ws: CFWebSocket, connectionId: string, kind: RateLimitKind): boolean {
    if (this.rateLimiter.consume(connectionId, kind)) return true;
    this.send(ws, {
      type: "ERROR",
      code: "RATE_LIMITED",
      message: "You are doing that too quickly. Please slow down.",
    });
    return false;
  }

  private touch(ws: CFWebSocket, attachment: ConnectionAttachment): void {
    const room = this.room;
    if (room && attachment.userId) {
      const record = room.players[attachment.userId] ?? room.spectators[attachment.userId];
      if (record) record.lastPingAt = attachment.lastSeenAt;
    }
    ws.serializeAttachment(attachment);
  }

  private closeSocket(ws: CFWebSocket, code: number, reason: string): void {
    try {
      ws.close(code, reason);
    } catch (err) {
      log.warn("socket.close_failed", errorFields(err));
    }
  }

  private send(ws: CFWebSocket, msg: ServerMessage): void {
    try {
      ws.send(serializeProtocolMessage(msg));
    } catch (err) {
      log.warn("socket.send_failed", { type: msg.type, ...errorFields(err) });
    }
  }

  private broadcast(msg: ServerMessage): void {
    const payload = serializeProtocolMessage(msg);
    for (const ws of this.state.getWebSockets()) {
      // Never leak room data to a socket that has not authenticated.
      if (!readAttachment(ws)?.userId) continue;
      try {
        ws.send(payload);
      } catch (err) {
        log.warn("socket.broadcast_failed", { type: msg.type, ...errorFields(err) });
      }
    }
  }

  private async persist(): Promise<void> {
    if (this.room) await this.state.storage.put(ROOM_KEY, this.room);
  }
}

function deriveRoomCode(roomId: string): string {
  return roomId.length > 8 ? roomId.slice(0, 6).toUpperCase() : roomId.toUpperCase();
}

function sanitizeChat(input: string): string {
  return input.replace(CONTROL_CHARS, "").trim().slice(0, CHAT_MAX_LENGTH);
}
