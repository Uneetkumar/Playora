import type { DurableObjectState, WebSocket as CFWebSocket, Response as CFResponse } from "@cloudflare/workers-types";
import {
  parseMatchmakingClientMessage,
  type MatchmakingServerMessage,
} from "@playora/protocol";
import { SupabaseTokenVerifier, TokenVerificationError } from "@playora/auth";
import { gameEngineRegistry } from "@playora/game-engine";
import type { GameId } from "@playora/game-types";

import type { Env } from "../types.js";
import { log, errorFields } from "../lib/logger.js";
import { createRoomStore, fetchRating, type SupabaseRoomStore } from "../lib/room-store.js";
import { findExpired, findMatch, ratingWindowFor, type QueueEntry } from "../lib/matchmaking.js";

const QUEUE_KEY = "queue";
const TICK_MS = 2_000;
const QUEUE_TIMEOUT_MS = 120_000;

interface QueueAttachment {
  connectionId: string;
  userId: string | null;
  gameId: string;
}

/**
 * One matchmaking pool per game.
 *
 * Kept entirely separate from RoomDurableObject: this decides *who* plays
 * together, and hands off a room code. It never manages a match (spec §104.8).
 */
export class MatchmakingDurableObject {
  private state: DurableObjectState;
  private env: Env;
  private queue: QueueEntry[] = [];
  private verifier: SupabaseTokenVerifier | null = null;
  private roomStore: SupabaseRoomStore | null | undefined;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.state.blockConcurrencyWhile(async () => {
      this.queue = (await this.state.storage.get<QueueEntry[]>(QUEUE_KEY)) ?? [];
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const server = pair[1] as unknown as CFWebSocket;
      this.state.acceptWebSocket(server);
      server.serializeAttachment({
        connectionId: crypto.randomUUID(),
        userId: null,
        gameId: url.searchParams.get("gameId") ?? "chess",
      } satisfies QueueAttachment);
      return new Response(null, {
        status: 101,
        webSocket: pair[0] as unknown as CFResponse["webSocket"],
      });
    }

    if (url.pathname.endsWith("/status")) {
      return Response.json({ poolSize: this.queue.length, connections: this.state.getWebSockets().length });
    }
    return new Response("Not Found", { status: 404 });
  }

  async webSocketMessage(ws: CFWebSocket, raw: string | ArrayBuffer): Promise<void> {
    const meta = read(ws);
    if (!meta) return;

    const parsed = parseMatchmakingClientMessage(typeof raw === "string" ? raw : "");
    if (!parsed.success) {
      this.send(ws, { type: "MM_ERROR", code: "BAD_REQUEST", message: parsed.error });
      return;
    }
    const msg = parsed.data;

    if (msg.type === "QUEUE_PING") return;

    if (msg.type === "QUEUE_LEAVE") {
      await this.dequeue(meta.userId, "cancelled");
      return;
    }

    // QUEUE_JOIN: identity comes from the verified token, never the payload.
    let identity;
    try {
      identity = await this.getVerifier().verify(msg.token);
    } catch (err) {
      const code = err instanceof TokenVerificationError ? err.code : "VERIFIER_MISCONFIGURED";
      this.send(ws, { type: "MM_ERROR", code, message: "Please sign in again." });
      return;
    }

    if (!gameEngineRegistry.has(msg.gameId as GameId)) {
      this.send(ws, {
        type: "MM_ERROR",
        code: "NOT_IMPLEMENTED",
        message: "That game isn't available for Quick Match yet.",
      });
      return;
    }

    // One queue entry per user, even across reconnects.
    this.queue = this.queue.filter((e) => e.userId !== identity.userId);
    this.queue.push({
      userId: identity.userId,
      displayName: identity.displayName,
      rating: await fetchRating(this.env, identity.userId),
      enqueuedAt: Date.now(),
      connectionId: meta.connectionId,
    });

    meta.userId = identity.userId;
    meta.gameId = msg.gameId;
    ws.serializeAttachment(meta);
    await this.persist();

    this.send(ws, {
      type: "QUEUED",
      gameId: msg.gameId,
      mode: msg.mode,
      poolSize: this.queue.length,
    });

    await this.tryMatch(msg.gameId as GameId);
    await this.scheduleTick();
  }

  async webSocketClose(ws: CFWebSocket): Promise<void> {
    const meta = read(ws);
    if (meta?.userId) await this.dequeue(meta.userId, "cancelled", ws);
  }

  async webSocketError(ws: CFWebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  /** Retries matching as windows widen, and drops players who waited too long. */
  async alarm(): Promise<void> {
    const gameIds = new Set(this.state.getWebSockets().map((ws) => read(ws)?.gameId ?? "chess"));
    for (const gameId of gameIds) {
      if (gameEngineRegistry.has(gameId as GameId)) await this.tryMatch(gameId as GameId);
    }

    for (const stale of findExpired(this.queue, Date.now(), QUEUE_TIMEOUT_MS)) {
      await this.dequeue(stale.userId, "timeout");
    }

    this.broadcastStatus();
    if (this.queue.length > 0) await this.scheduleTick();
  }

  private async tryMatch(gameId: GameId): Promise<void> {
    const engine = gameEngineRegistry.get(gameId);
    const needed = engine.minPlayers;

    const group = findMatch(this.queue, Date.now(), needed);
    if (!group) return;

    this.roomStore ??= createRoomStore(this.env);
    const host = group[0];
    if (!host) return;

    const room = await this.roomStore?.createMatchRoom({
      gameSlug: gameId,
      hostId: host.userId,
      maxPlayers: engine.maxPlayers,
    });

    if (!room) {
      log.error("match.room_creation_failed", { gameId, players: group.length });
      return; // players stay queued and are retried on the next tick
    }

    const matched = new Set(group.map((g) => g.userId));
    this.queue = this.queue.filter((e) => !matched.has(e.userId));
    await this.persist();

    for (const player of group) {
      const ws = this.socketFor(player.userId);
      if (!ws) continue;
      this.send(ws, {
        type: "MATCH_FOUND",
        roomCode: room.code,
        gameId,
        opponents: group
          .filter((p) => p.userId !== player.userId)
          .map((p) => ({ userId: p.userId, displayName: p.displayName, rating: p.rating })),
      });
    }

    log.info("match.found", {
      gameId,
      roomCode: room.code,
      players: group.map((p) => p.userId),
      ratings: group.map((p) => p.rating),
    });
  }

  private async dequeue(
    userId: string | null,
    reason: "cancelled" | "timeout" | "error",
    ws?: CFWebSocket,
  ): Promise<void> {
    if (!userId) return;
    const before = this.queue.length;
    this.queue = this.queue.filter((e) => e.userId !== userId);
    if (this.queue.length !== before) await this.persist();

    const socket = ws ?? this.socketFor(userId);
    if (socket) this.send(socket, { type: "QUEUE_LEFT", reason });
  }

  private broadcastStatus(): void {
    const now = Date.now();
    for (const entry of this.queue) {
      const ws = this.socketFor(entry.userId);
      if (!ws) continue;
      const waited = now - entry.enqueuedAt;
      this.send(ws, {
        type: "QUEUE_STATUS",
        waitingSeconds: Math.floor(waited / 1000),
        poolSize: this.queue.length,
        ratingWindow: Number.isFinite(ratingWindowFor(waited)) ? ratingWindowFor(waited) : 9999,
      });
    }
  }

  private socketFor(userId: string): CFWebSocket | undefined {
    return this.state.getWebSockets().find((ws) => read(ws)?.userId === userId);
  }

  private getVerifier(): SupabaseTokenVerifier {
    this.verifier ??= new SupabaseTokenVerifier({
      supabaseUrl: this.env.SUPABASE_URL,
      jwtSecret: this.env.SUPABASE_JWT_SECRET,
    });
    return this.verifier;
  }

  private async scheduleTick(): Promise<void> {
    const existing = await this.state.storage.getAlarm();
    if (existing === null) await this.state.storage.setAlarm(Date.now() + TICK_MS);
  }

  private async persist(): Promise<void> {
    await this.state.storage.put(QUEUE_KEY, this.queue);
  }

  private send(ws: CFWebSocket, msg: MatchmakingServerMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch (err) {
      log.warn("mm.send_failed", { type: msg.type, ...errorFields(err) });
    }
  }
}

function read(ws: CFWebSocket): QueueAttachment | null {
  try {
    return (ws.deserializeAttachment() as QueueAttachment | null) ?? null;
  } catch {
    return null;
  }
}
