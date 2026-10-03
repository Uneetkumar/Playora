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
  /**
   * Hold the connection until the caller knows which game this room is for.
   * Connecting with a placeholder and correcting it later restarts the socket.
   */
  ready?: boolean;
  asSpectator?: boolean;
  onReaction?: (reaction: PlayerReaction) => void;
  onError?: (error: string) => void;
}

/** First retry delay; doubles each attempt. */
const RECONNECT_BASE_DELAY_MS = 1000;
/** Never wait longer than this between attempts. */
const MAX_RECONNECT_DELAY_MS = 15000;
/** After this many consecutive failures, stop and tell the player. */
const MAX_RECONNECT_ATTEMPTS = 6;

export function useRoomSocket({
  roomId,
  gameId = "chess",
  ready = true,
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
  /*
   * Set before any close this hook performs itself.
   *
   * `onclose` fires for *every* close, including the ones we ask for — so
   * tearing the socket down scheduled a fresh reconnect two seconds later.
   * The cleanup cleared the pending timer and then called `close()`, in that
   * order, so the timer it cleared was never the one that mattered: closing
   * created a new one immediately afterwards and nothing cancelled it.
   *
   * Every re-render that changed a dependency therefore left a phantom socket
   * opening two seconds later, to a room the player may already have left.
   * Navigating between rooms a few times stacks them up, which is what the
   * repeated reconnects were.
   */
  const intentionalCloseRef = useRef(false);
  /** Consecutive failed attempts, for backoff. */
  const attemptsRef = useRef(0);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected" | "reconnecting"
  >("connecting");

  const {
    isLoading: authLoading,
    initialize: initAuth,
    signInAsGuest,
  } = useAuthStore();
  // The session itself is deliberately not read here. It is a new object on
  // every render, so anything derived from it in this scope becomes a reason
  // to tear down and rebuild the socket. connect() reads the live value from
  // the store instead, and only `authLoading` gates when it may run.
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

  const { setGameState, setLastResult, setProgression, setRematch, setSession } = useGameStore();

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

    // Nothing to connect to until the caller says the room is resolved.
    if (!ready) return;

    // Wait for the stored session to be restored before deciding anything.
    // Acting while auth is still loading minted a brand new anonymous user
    // on every page load, so guests silently lost their identity and history.
    if (authLoading) return;

    // Anyone can play immediately; a guest gets a real Supabase
    // anonymous session rather than a locally-minted token.
    //
    // Read from the store rather than from the closure. `session` is a fresh
    // object every render, so depending on it here would reconnect the socket
    // on every render — the exact loop this hook has already shipped twice.
    // The token is still a dependency below, so a genuinely new session does
    // reconnect; a re-render with the same token does not.
    let activeSession = useAuthStore.getState().session;
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
        intentionalCloseRef.current = true;
        socketRef.current.close();
      } catch (e) {
        console.warn("Socket close cleanup:", e);
      }
    }
    // Cleared for the socket about to be opened.
    intentionalCloseRef.current = false;

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
        // A successful connection clears the backoff.
        attemptsRef.current = 0;
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

          case "REMATCH_STATE": {
            setRematch({ votes: msg.votes, needed: msg.needed });
            break;
          }

          case "MATCH_PROGRESSION": {
            setProgression(msg.players);
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

      ws.onclose = (event) => {
        setConnected(false);
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

        // A close we asked for is not a dropped connection.
        if (intentionalCloseRef.current) {
          intentionalCloseRef.current = false;
          setConnectionStatus("disconnected");
          return;
        }

        // 1000 is a normal closure — the server said goodbye, so retrying it
        // is not reconnecting, it is arguing.
        if (event.code === 1000) {
          setConnectionStatus("disconnected");
          return;
        }

        attemptsRef.current += 1;
        if (attemptsRef.current > MAX_RECONNECT_ATTEMPTS) {
          setConnectionStatus("disconnected");
          setError("Lost connection to the room. Reload to try again.");
          return;
        }

        /*
         * Exponential backoff, capped.
         *
         * A flat two-second retry hammers a Worker that is down at the same
         * rate for as long as the tab is open, and the player sees the same
         * "reconnecting" message for ever with no signal that it is hopeless.
         */
        setConnectionStatus("reconnecting");
        const delay = Math.min(
          MAX_RECONNECT_DELAY_MS,
          RECONNECT_BASE_DELAY_MS * 2 ** (attemptsRef.current - 1),
        );
        reconnectTimeoutRef.current = setTimeout(() => {
          void connect();
        }, delay);
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
    ready,
    asSpectator,
    // The gate that matters: once the stored session has finished loading,
    // connect() reads whatever session the store holds. The access token is
    // deliberately NOT a dependency — connect no longer closes over it, and
    // making a rotating string restart the socket is how this hook shipped a
    // reconnect loop before.
    authLoading,
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
    setProgression,
    setRematch,
  ]);

  useEffect(() => {
    void connect();
    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (socketRef.current) {
        try {
          // Flagged *before* closing, so `onclose` knows not to reconnect.
          intentionalCloseRef.current = true;
          socketRef.current.close();
        } catch (e) {
          console.warn("Cleanup socket close:", e);
        }
      }
      // Cleared last: closing the socket above may have scheduled one.
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
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

  /**
   * Ask to play again. A rematch needs every remaining human to agree, so this
   * casts a vote rather than restarting anything on its own.
   */
  const requestRematch = useCallback(
    (accept = true) => {
      sendMessage({ type: "REMATCH", roomId, accept });
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
    requestRematch,
    requestResync,
    leaveRoom,
  };
}
