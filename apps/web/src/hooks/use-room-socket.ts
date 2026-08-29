"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  type ClientMessage,
  type ServerMessage,
  parseServerMessage,
  serializeProtocolMessage,
} from "@playora/protocol";
import { useRoomStore } from "../lib/store/room-store";
import { useGameStore } from "../lib/store/game-store";
import { useAuthStore } from "../lib/store/auth-store";
import type { PlayerReaction, GameId, Player, RoomSettings } from "@playora/game-types";

interface UseRoomSocketOptions {
  roomId: string;
  gameId?: string;
  asSpectator?: boolean;
  onReaction?: (reaction: PlayerReaction) => void;
  onError?: (error: string) => void;
}

export function useRoomSocket({
  roomId,
  gameId = "chess",
  asSpectator = false,
  onReaction,
  onError,
}: UseRoomSocketOptions) {
  // Held in refs so a caller passing inline functions cannot retrigger the
  // connection effect on every render.
  const onReactionRef = useRef(onReaction);
  const onErrorRef = useRef(onError);
  onReactionRef.current = onReaction;
  onErrorRef.current = onError;

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected" | "reconnecting"
  >("connecting");

  const {
    session,
    isLoading: authLoading,
    initialize: initAuth,
    signInAsGuest,
  } = useAuthStore();
  // A new session object each render would restart the socket; the token
  // string only changes on an actual refresh.
  const sessionToken = session?.tokens.accessToken ?? null;
  const {
    setRoom,
    setConnected,
    setConnecting,
    addMessage,
    addReaction,
    updatePlayer,
    removePlayer,
    setError,
    currentRoom,
  } = useRoomStore();

  const { setGameState, setLastResult, setSession } = useGameStore();

  // Ensure an authenticated user or guest identity exists
  useEffect(() => {
    void initAuth();
  }, [initAuth]);

  const sendMessage = useCallback((msg: ClientMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(serializeProtocolMessage(msg));
    }
  }, []);

  const connect = useCallback(async () => {
    if (!roomId) return;

    // Wait for the stored session to be restored before deciding anything.
    // Acting while auth is still loading minted a brand new anonymous user
    // on every page load, so guests silently lost their identity and history.
    if (authLoading) return;

    // Anyone can play immediately; a guest gets a real Supabase
    // anonymous session rather than a locally-minted token.
    let activeSession = session;
    if (!activeSession) {
      activeSession = await signInAsGuest();
    }
    if (!activeSession) {
      setConnectionStatus("disconnected");
      setError("Could not start a session. Check that Supabase is configured.");
      return;
    }
    const accessToken = activeSession.tokens.accessToken;

    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (e) {
        console.warn("Socket close cleanup:", e);
      }
    }

    setConnecting(true);
    setConnectionStatus("connecting");

    const realtimeHost =
      process.env.NEXT_PUBLIC_REALTIME_WS_URL || "ws://localhost:8787";
    const wsProtocol = /^(https|wss)/.test(realtimeHost) ? "wss:" : "ws:";
    const hostWithoutProtocol = realtimeHost.replace(/^(https?|wss?):\/\//, "");

    // No identity in the URL: the server establishes it from the AUTH
    // message below and treats query parameters as untrusted.
    const wsUrl = `${wsProtocol}//${hostWithoutProtocol}/rooms/${encodeURIComponent(
      roomId
    )}/ws?gameId=${encodeURIComponent(gameId)}&spectator=${asSpectator}`;

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setError(null);

        // The server rejects every other message until this is verified.
        ws.send(
          serializeProtocolMessage({
            type: "AUTH",
            token: accessToken,
            isGuest: activeSession.user.isGuest,
          })
        );

        // Start heartbeat ping
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              serializeProtocolMessage({
                type: "PING",
                clientTimestamp: Date.now(),
              })
            );
          }
        }, 15000);
      };

      ws.onmessage = (event) => {
        const parsed = parseServerMessage(event.data);
        if (!parsed.success) {
          console.warn("[WebSocket] Failed to parse message:", parsed.error);
          return;
        }

        const msg: ServerMessage = parsed.data;

        // Read the latest room from the store rather than closing over it.
        // Capturing it in this callback made `connect` change identity on
        // every ROOM_STATE, which tore the socket down and reconnected in a
        // loop until the browser ran out of sockets.
        const roomNow = useRoomStore.getState().currentRoom;

        switch (msg.type) {
          case "CONNECTED":
            setConnected(true);
            setConnectionStatus("connected");
            break;

          case "ROOM_STATE": {
            const r = msg.room;
            setRoom({
              id: r.id,
              code: r.code,
              name: r.name,
              hostId: r.hostId,
              gameId: r.gameId as GameId,
              status: r.status,
              settings: r.settings as RoomSettings,
              players: r.players as Record<string, Player>,
              spectators: r.spectators as Record<string, Player>,
              currentSessionId: r.currentSessionId,
              createdAt: r.createdAt,
              updatedAt: r.updatedAt,
            });
            break;
          }

          case "PLAYER_JOINED": {
            updatePlayer(msg.player as unknown as Player);
            break;
          }

          case "PLAYER_LEFT": {
            removePlayer(msg.playerId);
            break;
          }

          case "PLAYER_READY": {
            if (roomNow?.players[msg.playerId]) {
              updatePlayer({
                ...roomNow.players[msg.playerId]!,
                isReady: msg.isReady,
              });
            }
            break;
          }

          case "PLAYER_DISCONNECTED": {
            if (roomNow?.players[msg.playerId]) {
              updatePlayer({
                ...roomNow.players[msg.playerId]!,
                status: "disconnected",
              });
            }
            break;
          }

          case "PLAYER_RECONNECTED": {
            if (roomNow?.players[msg.playerId]) {
              updatePlayer({
                ...roomNow.players[msg.playerId]!,
                status: "connected",
              });
            }
            break;
          }

          case "GAME_STARTED": {
            setSession({
              id: msg.sessionId,
              roomId: msg.roomId,
              gameId: msg.gameId as GameId,
              status: "active",
              playerIds: msg.players.map((p) => p.userId),
              spectatorIds: [],
              sequenceNumber: 1,
              startedAt: msg.startedAt,
              endedAt: null,
              turnDeadline: null,
            });
            setGameState(msg.initialState, 1);
            if (roomNow) {
              setRoom({
                ...roomNow,
                status: "in_game",
                currentSessionId: msg.sessionId,
              });
            }
            break;
          }

          case "GAME_STATE": {
            setGameState(msg.state, msg.sequenceNumber);
            break;
          }

          case "CHAT_MESSAGE": {
            addMessage(msg.chat);
            break;
          }

          case "REACTION": {
            const reactionItem: PlayerReaction = {
              id: crypto.randomUUID(),
              roomId: msg.roomId,
              senderId: msg.senderId,
              emoji: msg.emoji,
              timestamp: msg.timestamp,
            };
            addReaction(reactionItem);
            onReactionRef.current?.(reactionItem);
            break;
          }

          case "GAME_FINISHED": {
            setLastResult({
              sessionId: msg.sessionId,
              roomId: msg.roomId,
              gameId: (roomNow?.gameId || "chess") as GameId,
              winnerId: msg.result.winnerId,
              scores: msg.result.scores,
              durationSeconds: msg.result.durationSeconds,
              completedAt: new Date().toISOString(),
              reason: msg.result.reason,
            });
            if (roomNow) {
              setRoom({
                ...roomNow,
                status: "finished",
              });
            }
            break;
          }

          case "RESYNC_STATE": {
            const r = msg.room;
            setRoom({
              id: r.id,
              code: r.code,
              name: r.name,
              hostId: r.hostId,
              gameId: r.gameId as GameId,
              status: r.status,
              settings: r.settings as RoomSettings,
              players: r.players as Record<string, Player>,
              spectators: r.spectators as Record<string, Player>,
              currentSessionId: r.currentSessionId,
              createdAt: r.createdAt,
              updatedAt: r.updatedAt,
            });
            if (msg.gameState) {
              setGameState(msg.gameState, msg.sequenceNumber ?? 1);
            }
            break;
          }

          case "ERROR": {
            setError(msg.message);
            onErrorRef.current?.(msg.message);
            break;
          }

          default:
            break;
        }
      };

      ws.onclose = () => {
        setConnected(false);
        setConnectionStatus("reconnecting");
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

        // Auto reconnect after 2 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          void connect();
        }, 2000);
      };

      ws.onerror = () => {
        setConnected(false);
        setConnectionStatus("reconnecting");
      };
    } catch (err) {
      setConnected(false);
      setConnectionStatus("disconnected");
      setError(err instanceof Error ? err.message : "Connection failed");
    }
  }, [
    roomId,
    gameId,
    asSpectator,
    authLoading,
    sessionToken,
    signInAsGuest,
    setConnecting,
    setConnected,
    setError,
    setRoom,
    updatePlayer,
    removePlayer,
    setSession,
    setGameState,
    addMessage,
    addReaction,
    setLastResult,
  ]);

  useEffect(() => {
    void connect();
    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch (e) {
          console.warn("Cleanup socket close:", e);
        }
      }
    };
  }, [connect]);

  // Actions
  const setReady = useCallback(() => {
    sendMessage({ type: "READY", roomId });
  }, [sendMessage, roomId]);

  const setUnready = useCallback(() => {
    sendMessage({ type: "UNREADY", roomId });
  }, [sendMessage, roomId]);

  const startGame = useCallback(
    (customRules?: Record<string, unknown>) => {
      sendMessage({ type: "START_GAME", roomId, customRules });
    },
    [sendMessage, roomId]
  );

  const sendGameAction = useCallback(
    (actionType: string, payload: unknown, clientActionId?: string) => {
      sendMessage({
        type: "GAME_ACTION",
        roomId,
        sessionId: currentRoom?.currentSessionId || "",
        actionType,
        payload,
        clientActionId: clientActionId || crypto.randomUUID(),
      });
    },
    [sendMessage, roomId, currentRoom?.currentSessionId]
  );

  const sendChatMessage = useCallback(
    (message: string) => {
      if (!message.trim()) return;
      sendMessage({ type: "CHAT_SEND", roomId, message });
    },
    [sendMessage, roomId]
  );

  const sendReaction = useCallback(
    (emoji: string) => {
      sendMessage({ type: "REACTION_SEND", roomId, emoji });
    },
    [sendMessage, roomId]
  );

  /** Host-only: seat a server-side AI opponent (spec section 9). */
  const addBot = useCallback(
    (level: number) => {
      sendMessage({ type: "ADD_BOT", roomId, level });
    },
    [sendMessage, roomId],
  );

  const removeBot = useCallback(
    (botId: string) => {
      sendMessage({ type: "REMOVE_BOT", roomId, botId });
    },
    [sendMessage, roomId],
  );

  const requestResync = useCallback(() => {
    sendMessage({ type: "RESYNC", roomId });
  }, [sendMessage, roomId]);

  const leaveRoom = useCallback(() => {
    sendMessage({ type: "LEAVE_ROOM", roomId });
  }, [sendMessage, roomId]);

  return {
    connectionStatus,
    setReady,
    setUnready,
    startGame,
    sendGameAction,
    sendChatMessage,
    sendReaction,
    addBot,
    removeBot,
    requestResync,
    leaveRoom,
  };
}
