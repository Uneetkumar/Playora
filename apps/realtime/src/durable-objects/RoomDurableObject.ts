import type {
  DurableObjectState,
  WebSocket as CFWebSocket,
  Response as CFResponse,
} from "@cloudflare/workers-types";
import type { Env, ClientConnectionAttachment } from "../types.js";
import {
  parseClientMessage,
  serializeProtocolMessage,
  type ServerMessage,
  type ProtocolPlayer,
} from "@playden/protocol";
import { gameEngineRegistry } from "@playden/game-engine";
import type { AnyGameEngine, BaseGameAction, BaseGameState } from "@playden/game-engine";
import type { GameId } from "@playden/game-types";

interface ActiveConnection {
  ws: CFWebSocket;
  meta: ClientConnectionAttachment;
}

export class RoomDurableObject {
  private state: DurableObjectState;
  protected env: Env;
  private connections = new Map<string, ActiveConnection>(); // connectionId -> ActiveConnection
  private userToConnection = new Map<string, string>(); // userId -> connectionId

  private roomId: string = "";
  private roomCode: string = "";
  private hostUserId: string = "";
  private gameId: GameId = "chess";
  private status: "waiting" | "starting" | "in_game" | "finished" | "abandoned" = "waiting";
  private players = new Map<string, ProtocolPlayer>();
  private spectators = new Map<string, ProtocolPlayer>();
  private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>(); // userId -> timer
  private sequenceNumber: number = 0;
  private currentSessionId: string | null = null;
  private currentGameState: BaseGameState | null = null;
  private createdAt: number = Date.now();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket Upgrade
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1] as unknown as CFWebSocket;

      const connectionId = crypto.randomUUID();
      const userId = url.searchParams.get("userId") || `guest_${connectionId.slice(0, 6)}`;
      const username = url.searchParams.get("username") || `Player_${connectionId.slice(0, 4)}`;
      const roomId = url.searchParams.get("roomId") || this.state.id.toString();
      const gameParam = (url.searchParams.get("gameId") as GameId) || "chess";
      const asSpectator = url.searchParams.get("spectator") === "true";

      if (!this.roomId) {
        this.roomId = roomId;
        this.roomCode = roomId.length > 8 ? roomId.slice(0, 6).toUpperCase() : roomId.toUpperCase();
        this.gameId = gameParam;
        this.createdAt = Date.now();
      }

      const isReconnect = this.players.has(userId) || this.spectators.has(userId);

      if (!this.hostUserId && !asSpectator) {
        this.hostUserId = userId;
      }

      const existingPlayer = this.players.get(userId) || this.spectators.get(userId);
      const assignedRole = existingPlayer
        ? existingPlayer.role
        : this.hostUserId === userId
        ? "host"
        : asSpectator
        ? "spectator"
        : "player";

      const meta: ClientConnectionAttachment = {
        connectionId,
        userId,
        username: existingPlayer?.username || username,
        displayName: existingPlayer?.displayName || username,
        avatarUrl: existingPlayer?.avatarUrl || null,
        role: assignedRole,
        isGuest: userId.startsWith("guest_"),
        joinedAt: existingPlayer?.joinedAt || Date.now(),
        lastPingAt: Date.now(),
      };

      this.handleWebSocket(server, meta, isReconnect);

      return new Response(null, {
        status: 101,
        webSocket: client as unknown as CFResponse["webSocket"],
      });
    }

    // HTTP Room Info endpoint
    if (url.pathname.endsWith("/status")) {
      return Response.json({
        roomId: this.roomId,
        roomCode: this.roomCode,
        gameId: this.gameId,
        status: this.status,
        playerCount: this.players.size,
        spectatorCount: this.spectators.size,
        activeConnections: this.connections.size,
        sequenceNumber: this.sequenceNumber,
        currentSessionId: this.currentSessionId,
      });
    }

    return new Response("Not Found", { status: 404 });
  }

  private handleWebSocket(ws: CFWebSocket, meta: ClientConnectionAttachment, isReconnect: boolean) {
    ws.accept();

    // Clear any disconnect grace timer if player was reconnecting
    const pendingTimer = this.disconnectTimers.get(meta.userId);
    if (pendingTimer !== undefined) {
      clearTimeout(pendingTimer);
      this.disconnectTimers.delete(meta.userId);
    }

    // Close any previous socket for this user
    const previousConnId = this.userToConnection.get(meta.userId);
    if (previousConnId && previousConnId !== meta.connectionId) {
      const prev = this.connections.get(previousConnId);
      if (prev) {
        try {
          prev.ws.close(1000, "Replaced by new connection");
        } catch (err) {
          console.warn("[room] failed to close superseded socket", { roomId: this.roomId, userId: meta.userId, err });
        }
        this.connections.delete(previousConnId);
      }
    }

    this.connections.set(meta.connectionId, { ws, meta });
    this.userToConnection.set(meta.userId, meta.connectionId);

    let playerRecord = this.players.get(meta.userId) || this.spectators.get(meta.userId);

    if (!playerRecord) {
      playerRecord = {
        id: meta.connectionId,
        userId: meta.userId,
        username: meta.username,
        displayName: meta.displayName,
        avatarUrl: meta.avatarUrl,
        role: meta.role,
        isReady: false,
        seatIndex: meta.role === "spectator" ? -1 : this.players.size,
        status: "connected",
        joinedAt: meta.joinedAt,
        lastPingAt: meta.lastPingAt,
        isGuest: meta.isGuest,
      };

      if (meta.role === "spectator") {
        this.spectators.set(meta.userId, playerRecord);
      } else {
        this.players.set(meta.userId, playerRecord);
      }
    } else {
      playerRecord.status = "connected";
      playerRecord.id = meta.connectionId;
      playerRecord.lastPingAt = Date.now();
    }

    // 1. Send CONNECTED message
    const connectedMsg: ServerMessage = {
      type: "CONNECTED",
      connectionId: meta.connectionId,
      userId: meta.userId,
      serverTimestamp: Date.now(),
    };
    ws.send(serializeProtocolMessage(connectedMsg));

    // 2. Broadcast PLAYER_JOINED or PLAYER_RECONNECTED
    if (isReconnect) {
      this.broadcast({
        type: "PLAYER_RECONNECTED",
        roomId: this.roomId,
        playerId: meta.userId,
      });
    } else {
      this.broadcast({
        type: "PLAYER_JOINED",
        roomId: this.roomId,
        player: playerRecord,
      });
    }

    // 3. Send full ROOM_STATE to the joining client
    ws.send(serializeProtocolMessage(this.buildRoomStateMessage()));

    // 4. If game is currently in progress, send current game state to client
    if (this.status === "in_game" && this.currentGameState && gameEngineRegistry.has(this.gameId)) {
      const engine = gameEngineRegistry.get(this.gameId);
      const playerView = engine.getPlayerView(this.currentGameState, meta.userId);
      const gameStateMsg: ServerMessage = {
        type: "GAME_STATE",
        roomId: this.roomId,
        sessionId: this.currentSessionId || "",
        sequenceNumber: this.sequenceNumber,
        state: playerView,
      };
      ws.send(serializeProtocolMessage(gameStateMsg));
    }

    // Listen for client messages
    ws.addEventListener("message", (event) => {
      this.handleMessage(meta.connectionId, event.data);
    });

    ws.addEventListener("close", () => {
      this.handleDisconnect(meta.connectionId);
    });

    ws.addEventListener("error", () => {
      this.handleDisconnect(meta.connectionId);
    });
  }

  private handleMessage(connectionId: string, rawData: unknown) {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    const parsed = parseClientMessage(rawData);
    if (!parsed.success) {
      const errorMsg: ServerMessage = {
        type: "ERROR",
        code: "BAD_REQUEST",
        message: parsed.error,
      };
      conn.ws.send(serializeProtocolMessage(errorMsg));
      return;
    }

    const msg = parsed.data;

    switch (msg.type) {
      case "PING": {
        conn.meta.lastPingAt = Date.now();
        const player = this.players.get(conn.meta.userId) || this.spectators.get(conn.meta.userId);
        if (player) {
          player.lastPingAt = Date.now();
        }
        break;
      }

      case "READY": {
        const player = this.players.get(conn.meta.userId);
        if (player) {
          player.isReady = true;
          this.broadcast({
            type: "PLAYER_READY",
            roomId: this.roomId,
            playerId: conn.meta.userId,
            isReady: true,
          });
        }
        break;
      }

      case "UNREADY": {
        const player = this.players.get(conn.meta.userId);
        if (player) {
          player.isReady = false;
          this.broadcast({
            type: "PLAYER_READY",
            roomId: this.roomId,
            playerId: conn.meta.userId,
            isReady: false,
          });
        }
        break;
      }

      case "START_GAME": {
        if (conn.meta.role !== "host") {
          conn.ws.send(
            serializeProtocolMessage({
              type: "ERROR",
              code: "FORBIDDEN",
              message: "Only the room host can start the game.",
            })
          );
          return;
        }

        if (!gameEngineRegistry.has(this.gameId)) {
          conn.ws.send(
            serializeProtocolMessage({
              type: "ERROR",
              code: "NOT_IMPLEMENTED",
              message: `Game engine '${this.gameId}' is not registered.`,
            })
          );
          return;
        }

        const engine = gameEngineRegistry.get(this.gameId);
        const playerList = Array.from(this.players.values());

        const validation = engine.validatePlayerCount(playerList);
        if (!validation.valid) {
          conn.ws.send(
            serializeProtocolMessage({
              type: "ERROR",
              code: "INVALID_PLAYER_COUNT",
              message: validation.reason || "Invalid player count to start game.",
            })
          );
          return;
        }

        this.status = "in_game";
        this.sequenceNumber = 1;
        this.currentSessionId = crypto.randomUUID();

        // Initialize server-authoritative game state
        this.currentGameState = engine.init(playerList, {
          roomId: this.roomId,
          sessionId: this.currentSessionId,
          ...(msg.customRules || {}),
        });

        // Broadcast GAME_STARTED
        this.broadcast({
          type: "GAME_STARTED",
          roomId: this.roomId,
          sessionId: this.currentSessionId,
          gameId: this.gameId,
          players: playerList,
          initialState: engine.getPlayerView(this.currentGameState, null),
          startedAt: Date.now(),
        });

        // Send individual tailored GAME_STATE to each player
        this.broadcastGameState(engine);
        break;
      }

      case "GAME_ACTION": {
        if (this.status !== "in_game" || !this.currentGameState) {
          conn.ws.send(
            serializeProtocolMessage({
              type: "ERROR",
              code: "INVALID_STATE",
              message: "No active game in progress.",
            })
          );
          return;
        }

        if (!gameEngineRegistry.has(this.gameId)) return;
        const engine = gameEngineRegistry.get(this.gameId);

        const action = {
          type: msg.actionType,
          playerId: conn.meta.userId,
          payload: msg.payload,
          timestamp: Date.now(),
          clientActionId: msg.clientActionId,
        };

        const validation = engine.validateAction(this.currentGameState, action);
        if (!validation.valid) {
          conn.ws.send(
            serializeProtocolMessage({
              type: "ERROR",
              code: "ILLEGAL_MOVE",
              message: validation.reason || "Illegal action",
              details: { clientActionId: msg.clientActionId },
            })
          );
          return;
        }

        try {
          const actionResult = engine.executeAction(this.currentGameState, action);
          this.currentGameState = actionResult.state;
          this.sequenceNumber = this.currentGameState.sequenceNumber;

          // Broadcast resulting state
          this.broadcastGameState(engine, action);

          // Broadcast events if any
          if (actionResult.events && actionResult.events.length > 0) {
            for (const ev of actionResult.events) {
              this.broadcast({
                type: "GAME_EVENT",
                roomId: this.roomId,
                sessionId: this.currentSessionId || "",
                eventType: (ev as { type?: string }).type ?? "EVENT",
                payload: ev,
              });
            }
          }

          // Check if game is over
          if (engine.isGameOver(this.currentGameState)) {
            const matchResult = engine.calculateResult(this.currentGameState, this.roomId);
            this.status = "finished";
            this.broadcast({
              type: "GAME_FINISHED",
              roomId: this.roomId,
              sessionId: this.currentSessionId || "",
              result: {
                winnerId: matchResult.winnerId,
                scores: matchResult.scores,
                durationSeconds: matchResult.durationSeconds,
                reason: matchResult.reason,
              },
            });
          }
        } catch (err) {
          conn.ws.send(
            serializeProtocolMessage({
              type: "ERROR",
              code: "EXECUTION_ERROR",
              message: err instanceof Error ? err.message : "Failed to execute game action.",
            })
          );
        }
        break;
      }

      case "CHAT_SEND": {
        const sanitized = msg.message.trim().slice(0, 500);
        if (!sanitized) return;

        const chatMsg: ServerMessage = {
          type: "CHAT_MESSAGE",
          chat: {
            id: crypto.randomUUID(),
            roomId: this.roomId,
            senderId: conn.meta.userId,
            senderName: conn.meta.displayName,
            senderAvatarUrl: conn.meta.avatarUrl,
            message: sanitized,
            timestamp: Date.now(),
          },
        };
        this.broadcast(chatMsg);
        break;
      }

      case "REACTION_SEND": {
        const reactionMsg: ServerMessage = {
          type: "REACTION",
          roomId: this.roomId,
          senderId: conn.meta.userId,
          emoji: msg.emoji,
          timestamp: Date.now(),
        };
        this.broadcast(reactionMsg);
        break;
      }

      case "RESYNC": {
        let gameStateView: unknown = undefined;
        if (this.currentGameState && gameEngineRegistry.has(this.gameId)) {
          const engine = gameEngineRegistry.get(this.gameId);
          gameStateView = engine.getPlayerView(this.currentGameState, conn.meta.userId);
        }

        conn.ws.send(
          serializeProtocolMessage({
            type: "RESYNC_STATE",
            roomId: this.roomId,
            room: this.buildRoomStatePayload(),
            gameState: gameStateView,
            sequenceNumber: this.sequenceNumber,
          })
        );
        break;
      }

      case "LEAVE_ROOM": {
        this.handleDisconnect(connectionId, "voluntary");
        break;
      }

      default:
        break;
    }
  }

  private broadcastGameState(engine: AnyGameEngine, lastAction?: BaseGameAction) {
    const state = this.currentGameState;
    if (!state) return;

    for (const { ws, meta } of this.connections.values()) {
      const playerView = engine.getPlayerView(state, meta.userId);
      const gameStateMsg: ServerMessage = {
        type: "GAME_STATE",
        roomId: this.roomId,
        sessionId: this.currentSessionId || "",
        sequenceNumber: this.sequenceNumber,
        state: playerView,
        lastAction: lastAction
          ? {
              type: lastAction.type,
              playerId: lastAction.playerId,
              payload: lastAction.payload,
              clientActionId: lastAction.clientActionId,
            }
          : undefined,
      };
      try {
        ws.send(serializeProtocolMessage(gameStateMsg));
      } catch (err) {
        console.warn("[room] game state send failed", { roomId: this.roomId, userId: meta.userId, err });
      }
    }
  }

  private handleDisconnect(
    connectionId: string,
    reason: "voluntary" | "disconnected" = "disconnected"
  ) {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    const userId = conn.meta.userId;
    this.connections.delete(connectionId);
    this.userToConnection.delete(userId);

    const player = this.players.get(userId);
    const spectator = this.spectators.get(userId);

    if (reason === "voluntary" || this.status === "waiting" || this.status === "finished") {
      // Direct removal
      this.players.delete(userId);
      this.spectators.delete(userId);

      // Reassign host if host left
      if (this.hostUserId === userId && this.players.size > 0) {
        const nextHost = Array.from(this.players.values())[0];
        if (nextHost) {
          this.hostUserId = nextHost.userId;
          nextHost.role = "host";
        }
      }

      this.broadcast({
        type: "PLAYER_LEFT",
        roomId: this.roomId,
        playerId: userId,
        reason,
      });
    } else {
      // During active game: Grace period for reconnect
      if (player) {
        player.status = "disconnected";
      }
      if (spectator) {
        spectator.status = "disconnected";
      }

      this.broadcast({
        type: "PLAYER_DISCONNECTED",
        roomId: this.roomId,
        playerId: userId,
        gracePeriodSeconds: 60,
      });

      // 60-second grace timer before seat forfeited
      const timer = setTimeout(() => {
        if (this.players.get(userId)?.status === "disconnected") {
          this.players.delete(userId);
          this.spectators.delete(userId);
          this.broadcast({
            type: "PLAYER_LEFT",
            roomId: this.roomId,
            playerId: userId,
            reason: "timeout",
          });

          // Check if match should end due to abandonment
          if (this.status === "in_game" && this.currentGameState && gameEngineRegistry.has(this.gameId)) {
            const remainingPlayers = Array.from(this.players.values()).filter((p) => p.status === "connected");
            if (remainingPlayers.length === 1 && remainingPlayers[0]) {
              // Award remaining player win
              const winPlayer = remainingPlayers[0];
              this.status = "finished";
              this.broadcast({
                type: "GAME_FINISHED",
                roomId: this.roomId,
                sessionId: this.currentSessionId || "",
                result: {
                  winnerId: winPlayer.userId,
                  scores: [
                    {
                      playerId: winPlayer.userId,
                      userId: winPlayer.userId,
                      rank: 1,
                      score: 1,
                      isWinner: true,
                    },
                    {
                      playerId: userId,
                      userId: userId,
                      rank: 2,
                      score: 0,
                      isWinner: false,
                    },
                  ],
                  durationSeconds: Math.floor((Date.now() - this.createdAt) / 1000),
                  reason: "disconnect",
                },
              });
            }
          }
        }
      }, 60000);

      this.disconnectTimers.set(userId, timer);
    }

    if (this.connections.size === 0 && this.status !== "in_game") {
      this.status = "abandoned";
    }
  }

  private buildRoomStatePayload() {
    const playersObj: Record<string, ProtocolPlayer> = {};
    for (const [id, player] of this.players.entries()) {
      playersObj[id] = player;
    }
    const spectatorsObj: Record<string, ProtocolPlayer> = {};
    for (const [id, spec] of this.spectators.entries()) {
      spectatorsObj[id] = spec;
    }

    return {
      id: this.roomId,
      code: this.roomCode,
      name: `Room ${this.roomCode}`,
      hostId: this.hostUserId,
      gameId: this.gameId,
      status: this.status,
      settings: {
        maxPlayers: 2,
        isPrivate: false,
        gameMode: "casual" as const,
        allowSpectators: true,
        customRules: {},
      },
      players: playersObj,
      spectators: spectatorsObj,
      currentSessionId: this.currentSessionId,
      createdAt: this.createdAt,
      updatedAt: Date.now(),
    };
  }

  private buildRoomStateMessage(): ServerMessage {
    return {
      type: "ROOM_STATE",
      room: this.buildRoomStatePayload(),
    };
  }

  private broadcast(msg: ServerMessage) {
    const serialized = serializeProtocolMessage(msg);
    for (const { ws } of this.connections.values()) {
      try {
        ws.send(serialized);
      } catch (err) {
        console.warn("[room] broadcast send failed", { roomId: this.roomId, type: msg.type, err });
      }
    }
  }
}
