"use client";

import * as React from "react";
import {
  ChessEngine,
  UnoEngine,
  UnoNoMercyEngine,
  CarRaceEngine,
  BikeRaceEngine,
} from "@playora/game-engine";
import type { GameId, Player, GameResult, PlayerRole } from "@playora/game-types";

export interface LanPlayer extends Player {
  pingMs: number;
}

export interface UseLanSocketOptions {
  roomCode: string;
  gameId: GameId;
  role: "host" | "guest";
  userId: string;
  displayName: string;
  onGameStart?: () => void;
}

export function useLanSocket({
  roomCode,
  gameId,
  role,
  userId,
  displayName,
  onGameStart,
}: UseLanSocketOptions) {
  const [players, setPlayers] = React.useState<Record<string, LanPlayer>>({});
  const [gameState, setGameState] = React.useState<unknown>(null);
  const [lastResult, setLastResult] = React.useState<GameResult | null>(null);
  const [isStarted, setIsStarted] = React.useState(false);
  const [connected, setConnected] = React.useState(false);

  // Authoritative host engine & raw full state
  const engineRef = React.useRef<ChessEngine | UnoEngine | UnoNoMercyEngine | CarRaceEngine | BikeRaceEngine | null>(null);
  const rawStateRef = React.useRef<any>(null);
  const channelRef = React.useRef<BroadcastChannel | null>(null);
  const lastEventTimeRef = React.useRef<number>(0);
  const isStartedRef = React.useRef(isStarted);
  isStartedRef.current = isStarted;

  const playersRef = React.useRef<Record<string, LanPlayer>>({});
  playersRef.current = players;

  // Initialize Channel, Local Engine & Network Sync
  React.useEffect(() => {
    if (!roomCode) return;

    let isMounted = true;
    const now = Date.now();
    const playerRole: PlayerRole = role === "host" ? "host" : "player";

    const me: LanPlayer = {
      id: userId,
      userId,
      username: displayName,
      displayName,
      avatarUrl: null,
      isGuest: false,
      role: playerRole,
      isReady: true,
      seatIndex: role === "host" ? 0 : 1,
      status: "connected",
      joinedAt: now,
      lastPingAt: now,
      pingMs: 1,
    };

    setPlayers((prev) => ({ ...prev, [userId]: me }));
    setConnected(true);

    if (role === "host") {
      if (gameId === "chess") {
        engineRef.current = new ChessEngine();
      } else if (gameId === "uno-no-mercy") {
        engineRef.current = new UnoNoMercyEngine();
      } else if (gameId === "uno") {
        engineRef.current = new UnoEngine();
      } else if (gameId === "car-race") {
        engineRef.current = new CarRaceEngine();
      } else if (gameId === "bike-race") {
        engineRef.current = new BikeRaceEngine();
      }
    }

    // 1. Local Same-Tab / Same-Browser BroadcastChannel
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(`playora-lan-${roomCode}`);
      channelRef.current = channel;

      channel.onmessage = (event) => {
        const msg = event.data;
        if (!msg || !msg.type || !isMounted) return;

        if (msg.type === "PEER_JOIN") {
          if (role === "host") {
            setPlayers((prev) => {
              const next = {
                ...prev,
                [msg.player.userId]: { ...msg.player, pingMs: 1 },
              };
              channel?.postMessage({
                type: "ROOM_STATE",
                players: next,
              });
              return next;
            });
          }
        } else if (msg.type === "ROOM_STATE") {
          setPlayers(msg.players);
        } else if (msg.type === "START_GAME") {
          setIsStarted(true);
          if (role === "guest") {
            const myView = (msg.playerViews && msg.playerViews[userId]) || msg.gameState;
            if (myView) setGameState(myView);
          }
          onGameStart?.();
        } else if (msg.type === "STATE_UPDATE" && role === "guest") {
          const myView = (msg.playerViews && msg.playerViews[userId]) || msg.gameState;
          if (myView) setGameState(myView);
          if (msg.result) setLastResult(msg.result);
        }
      };

      if (role === "guest") {
        channel.postMessage({
          type: "PEER_JOIN",
          player: me,
        });
      }
    } catch {
      // BroadcastChannel not available in environment
    }

    // 2. Cross-Device Wi-Fi Network Sync (POST Join then Poll)
    const joinPayload = {
      code: roomCode,
      gameId,
      type: "JOIN",
      player: me,
      userId,
    };

    void fetch("/api/lan/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(joinPayload),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.players && isMounted) {
          setPlayers(data.players);
          if (data.status === "started") {
            setIsStarted(true);
            if (role === "guest" && data.gameState) setGameState(data.gameState);
          }
        }
      })
      .catch((err) => console.warn("LAN API join err", err));

    // High-frequency polling loop for 0-lag cross-device Wi-Fi response
    const interval = setInterval(async () => {
      if (!isMounted) return;
      try {
        const url = `/api/lan/events?code=${roomCode}&userId=${encodeURIComponent(userId)}&since=${lastEventTimeRef.current}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (!data || !isMounted) return;

        if (data.players) {
          setPlayers(data.players);
        }

        if (data.status === "started") {
          if (!isStartedRef.current) {
            setIsStarted(true);
            onGameStart?.();
          }
          if (role === "guest" && data.gameState) {
            setGameState(data.gameState);
          }
        }

        if (data.lastResult) {
          setLastResult(data.lastResult);
        }

        // Process incoming events
        if (Array.isArray(data.events) && data.events.length > 0) {
          for (const ev of data.events) {
            if (ev.timestamp > lastEventTimeRef.current) {
              lastEventTimeRef.current = ev.timestamp;
            }

            if (ev.type === "START_GAME") {
              setIsStarted(true);
              if (role === "guest") {
                const myView = (ev.payload?.playerViews && ev.payload.playerViews[userId]) || ev.payload?.gameState;
                if (myView) setGameState(myView);
              }
              onGameStart?.();
            }

            // If host received a guest action over Wi-Fi
            if (ev.type === "GAME_ACTION" && role === "host" && ev.senderId !== userId) {
              if (engineRef.current && rawStateRef.current) {
                const engine = engineRef.current as any;
                try {
                  const validation = engine.validateAction(rawStateRef.current, ev.payload);
                  if (validation.valid) {
                    const exec = engine.executeAction(rawStateRef.current, ev.payload);
                    rawStateRef.current = exec.state;
                    const isOver = engine.isGameOver(exec.state);
                    const result = isOver ? engine.calculateResult(exec.state, `lan-${roomCode}`) : null;
                    if (result) setLastResult(result);

                    const pViews: Record<string, unknown> = {};
                    for (const p of Object.values(playersRef.current)) {
                      try {
                        pViews[p.userId] = engine.getPlayerView(exec.state, p.userId);
                      } catch {}
                    }
                    const hostView = pViews[userId] || engine.getPlayerView(exec.state, userId);
                    setGameState(hostView);

                    // Sync updated game state back to all guests over Wi-Fi
                    void fetch("/api/lan/events", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        code: roomCode,
                        type: "STATE_UPDATE",
                        playerViews: pViews,
                        gameState: hostView,
                        result,
                        userId,
                      }),
                    });
                  }
                } catch (actErr) {
                  console.error("Host Action execute error", actErr);
                }
              }
            } else if (ev.type === "STATE_UPDATE" && ev.senderId !== userId) {
              const myView = (ev.payload?.playerViews && ev.payload.playerViews[userId]) || ev.payload?.gameState;
              if (myView) setGameState(myView);
              if (ev.payload?.result) setLastResult(ev.payload.result);
            }
          }
        }
      } catch (pollErr) {
        // Network heartbeat transient error
      }
    }, 200);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (channel) channel.close();
    };
  }, [roomCode, gameId, role, userId, displayName, onGameStart]);

  // Host Racing Physics Tick Interval for Car and Bike race over LAN
  const tickCountRef = React.useRef(0);
  React.useEffect(() => {
    if (role !== "host" || !isStarted || (gameId !== "car-race" && gameId !== "bike-race")) return;

    let lastTickTime = performance.now();

    const tickTimer = setInterval(() => {
      if (!engineRef.current || !rawStateRef.current) return;
      const now = performance.now();
      const elapsedMs = Math.min(200, now - lastTickTime);
      lastTickTime = now;

      const ticksToAdvance = Math.max(1, Math.round((elapsedMs / 1000) * 60));
      const engine = engineRef.current as any;

      try {
        const exec = engine.executeAction(rawStateRef.current, {
          type: "TICK",
          playerId: "__server__",
          payload: { ticks: ticksToAdvance },
        });
        rawStateRef.current = exec.state;
        const isOver = engine.isGameOver(exec.state);
        const result = isOver ? engine.calculateResult(exec.state, `lan-${roomCode}`) : null;
        if (result) setLastResult(result);

        const pViews: Record<string, unknown> = {};
        for (const p of Object.values(playersRef.current)) {
          try {
            pViews[p.userId] = engine.getPlayerView(exec.state, p.userId);
          } catch {}
        }
        const hostView = pViews[userId] || engine.getPlayerView(exec.state, userId);
        setGameState(hostView);

        // Immediate broadcast to local same-browser tabs
        channelRef.current?.postMessage({
          type: "STATE_UPDATE",
          playerViews: pViews,
          gameState: hostView,
          result,
        });

        // Throttled Wi-Fi relay sync (every 66ms)
        tickCountRef.current += 1;
        if (tickCountRef.current % 2 === 0 || isOver) {
          void fetch("/api/lan/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: roomCode,
              type: "STATE_UPDATE",
              playerViews: pViews,
              gameState: hostView,
              result,
              userId,
            }),
          });
        }
      } catch (tickErr) {
        console.error("LAN Racing tick error", tickErr);
      }
    }, 33);

    return () => clearInterval(tickTimer);
  }, [role, isStarted, gameId, roomCode, userId]);

  const sendAction = React.useCallback(
    (actionType: string, payload: Record<string, unknown> = {}) => {
      const action = {
        type: actionType,
        playerId: userId,
        payload,
        ...payload,
      };

      if (role === "host" && engineRef.current && rawStateRef.current) {
        const engine = engineRef.current as any;
        try {
          const validation = engine.validateAction(rawStateRef.current, action);
          if (validation.valid) {
            const exec = engine.executeAction(rawStateRef.current, action);
            rawStateRef.current = exec.state;
            const isOver = engine.isGameOver(exec.state);
            const result = isOver ? engine.calculateResult(exec.state, `lan-${roomCode}`) : null;
            if (result) setLastResult(result);

            const pViews: Record<string, unknown> = {};
            for (const p of Object.values(players)) {
              try {
                pViews[p.userId] = engine.getPlayerView(exec.state, p.userId);
              } catch {}
            }
            const nextView = pViews[userId] || engine.getPlayerView(exec.state, userId);
            setGameState(nextView);

            channelRef.current?.postMessage({
              type: "STATE_UPDATE",
              playerViews: pViews,
              gameState: nextView,
              result,
            });

            // Post to Wi-Fi server relay
            void fetch("/api/lan/events", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                code: roomCode,
                type: "STATE_UPDATE",
                playerViews: pViews,
                gameState: nextView,
                result,
                userId,
              }),
            });
          }
        } catch (err) {
          console.error("Host LAN Action Error", err);
        }
      } else {
        channelRef.current?.postMessage({
          type: "GAME_ACTION",
          action,
        });

        // Send to host over Wi-Fi relay
        void fetch("/api/lan/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: roomCode,
            type: "GAME_ACTION",
            action,
            userId,
          }),
        });
      }
    },
    [role, userId, roomCode, players]
  );

  const startMatch = React.useCallback(() => {
    if (role !== "host") {
      // Guest or peer triggering rematch
      void fetch("/api/lan/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: roomCode,
          type: "GAME_ACTION",
          action: { type: "RESTART_MATCH", playerId: userId },
          userId,
        }),
      });
      return;
    }

    if (!engineRef.current) return;
    const engine = engineRef.current as any;
    let playerList: Player[] = Object.values(players);

    // If game needs at least 2 players (Chess, UNO) and only host is in lobby, add opponent slot
    if (playerList.length < engine.minPlayers) {
      for (let i = playerList.length; i < engine.minPlayers; i++) {
        const aiId = `peer-slot-${i + 1}`;
        playerList.push({
          id: aiId,
          userId: aiId,
          username: `Player ${i + 1}`,
          displayName: `Player ${i + 1}`,
          avatarUrl: null,
          role: "player",
          isReady: true,
          seatIndex: i,
          status: "connected",
          joinedAt: Date.now(),
          lastPingAt: Date.now(),
          isGuest: true,
        });
      }
    }

    try {
      const initialState = engine.init(playerList, {});
      rawStateRef.current = initialState;

      const pViews: Record<string, unknown> = {};
      for (const p of playerList) {
        try {
          pViews[p.userId] = engine.getPlayerView(initialState, p.userId);
        } catch {}
      }

      const initialView = pViews[userId] || engine.getPlayerView(initialState, userId);

      setGameState(initialView);
      setIsStarted(true);

      channelRef.current?.postMessage({
        type: "START_GAME",
        playerViews: pViews,
        gameState: initialView,
      });

      // Post START_GAME to all Wi-Fi connected devices
      void fetch("/api/lan/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: roomCode,
          type: "START_GAME",
          playerViews: pViews,
          gameState: initialView,
          userId,
        }),
      });
    } catch (err) {
      console.error("Failed to start LAN match", err);
    }
  }, [role, players, userId, roomCode]);

  return {
    connected,
    players,
    gameState,
    lastResult,
    isStarted,
    sendAction,
    startMatch,
  };
}
