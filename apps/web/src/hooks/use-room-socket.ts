"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  type ClientMessage,
  type ServerMessage,
  parseServerMessage,
  serializeProtocolMessage,
} from "@playden/protocol";
import { useRoomStore } from "../lib/store/room-store";
import { useGameStore } from "../lib/store/game-store";
import { useAuthStore } from "../lib/store/auth-store";
import type { PlayerReaction, GameId, Player, RoomSettings } from "@playden/game-types";

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
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected" | "reconnecting"
  >("connecting");

  const { user, initialize: initAuth, signInAsGuest } = useAuthStore();
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
    initAuth();
  }, [initAuth]);

  const sendMessage = useCallback((msg: ClientMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(serializeProtocolMessage(msg));
    }
  }, []);

  const connect = useCallback(() => {
    if (!roomId) return;

    let activeUser = user;
    if (!activeUser) {
      const guestSession = signInAsGuest();
      activeUser = guestSession.user;
    }

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
      process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:8787";
    const wsProtocol = realtimeHost.startsWith("https") ? "wss:" : "ws:";
    const hostWithoutProtocol = realtimeHost.replace(/^https?:\/\//, "");

    const wsUrl = `${wsProtocol}//${hostWithoutProtocol}/rooms/${encodeURIComponent(
      roomId
    )}/ws?userId=${encodeURIComponent(activeUser.id)}&username=${encodeURIComponent(
      activeUser.displayName || activeUser.username
    )}&gameId=${encodeURIComponent(gameId)}&spectator=${asSpectator}`;

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setConnectionStatus("connected");
        setError(null);

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

        switch (msg.type) {
          case "CONNECTED":
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
            if (currentRoom?.players[msg.playerId]) {
              updatePlayer({
                ...currentRoom.players[msg.playerId]!,
                isReady: msg.isReady,
              });
            }
            break;
          }

          case "PLAYER_DISCONNECTED": {
            if (currentRoom?.players[msg.playerId]) {
              updatePlayer({
                ...currentRoom.players[msg.playerId]!,
                status: "disconnected",
              });
            }
            break;
          }

          case "PLAYER_RECONNECTED": {
            if (currentRoom?.players[msg.playerId]) {
              updatePlayer({
                ...currentRoom.players[msg.playerId]!,
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
            if (currentRoom) {
              setRoom({
                ...currentRoom,
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
            onReaction?.(reactionItem);
            break;
          }

          case "GAME_FINISHED": {
            setLastResult({
              sessionId: msg.sessionId,
              roomId: msg.roomId,
              gameId: (currentRoom?.gameId || "chess") as GameId,
              winnerId: msg.result.winnerId,
              scores: msg.result.scores,
              durationSeconds: msg.result.durationSeconds,
              completedAt: new Date().toISOString(),
              reason: msg.result.reason,
            });
            if (currentRoom) {
              setRoom({
                ...currentRoom,
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
            onError?.(msg.message);
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
          connect();
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
    user,
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
    currentRoom,
    onReaction,
    onError,
  ]);

  useEffect(() => {
    connect();
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
    requestResync,
    leaveRoom,
  };
}
