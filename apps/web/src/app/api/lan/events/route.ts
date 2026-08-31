import { NextResponse, type NextRequest } from "next/server";
import type { GameId, PlayerRole } from "@playora/game-types";

interface LanPlayerState {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isGuest: boolean;
  role: PlayerRole;
  isReady: boolean;
  seatIndex: number;
  status: "connected" | "disconnected";
  joinedAt: number;
  lastPingAt: number;
  pingMs: number;
}

interface LanRoom {
  code: string;
  gameId: GameId;
  status: "lobby" | "started" | "finished";
  hostId: string;
  players: Record<string, LanPlayerState>;
  gameState: unknown | null;
  playerViews?: Record<string, unknown>;
  lastResult: unknown | null;
  version: number;
  events: Array<{
    id: string;
    type: string;
    senderId: string;
    payload?: any;
    timestamp: number;
  }>;
  createdAt: number;
  updatedAt: number;
}

// In-memory rooms cache on the active Next.js process
const globalRooms = new Map<string, LanRoom>();

// Clean up dead rooms older than 2 hours periodically
function sweepDeadRooms() {
  const now = Date.now();
  for (const [code, room] of globalRooms.entries()) {
    if (now - room.updatedAt > 2 * 60 * 60 * 1000) {
      globalRooms.delete(code);
    }
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.toUpperCase();
  const userId = url.searchParams.get("userId");
  const since = parseInt(url.searchParams.get("since") || "0", 10);

  if (!code) {
    return NextResponse.json({ error: "Missing room code" }, { status: 400 });
  }

  const room = globalRooms.get(code);
  if (!room) {
    return NextResponse.json({ exists: false, players: {}, version: 0 });
  }

  // Update ping for requesting player
  const now = Date.now();
  if (userId && room.players[userId]) {
    room.players[userId] = {
      ...room.players[userId],
      lastPingAt: now,
      status: "connected",
    };
    room.updatedAt = now;
  }

  // Remove players inactive for > 20 seconds (except host)
  for (const [pId, p] of Object.entries(room.players)) {
    if (pId !== room.hostId && now - p.lastPingAt > 20000) {
      delete room.players[pId];
      room.version += 1;
    }
  }

  const newEvents = room.events.filter((e) => {
    return e.timestamp > since;
  });

  const effectiveGameState = (userId && room.playerViews?.[userId]) ? room.playerViews[userId] : room.gameState;

  return NextResponse.json({
    exists: true,
    code: room.code,
    gameId: room.gameId,
    status: room.status,
    hostId: room.hostId,
    players: room.players,
    gameState: effectiveGameState,
    lastResult: room.lastResult,
    version: room.version,
    events: newEvents,
    serverTime: now,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, type, player, gameId, gameState, playerViews, result, action, userId } = body;

    if (!code) {
      return NextResponse.json({ error: "Missing room code" }, { status: 400 });
    }

    const roomCode = String(code).toUpperCase();
    sweepDeadRooms();

    const now = Date.now();
    let room = globalRooms.get(roomCode);

    if (!room) {
      room = {
        code: roomCode,
        gameId: gameId || "uno-no-mercy",
        status: "lobby",
        hostId: player?.userId || userId || "",
        players: {},
        gameState: null,
        playerViews: {},
        lastResult: null,
        version: 1,
        events: [],
        createdAt: now,
        updatedAt: now,
      };
      globalRooms.set(roomCode, room);
    }

    room.updatedAt = now;

    if (type === "JOIN" && player) {
      const existing = room.players[player.userId];
      const isHost = player.role === "host" || (!room.hostId && Object.keys(room.players).length === 0);
      if (isHost && !room.hostId) {
        room.hostId = player.userId;
      }

      const assignedSeat = existing?.seatIndex ?? Object.keys(room.players).length;

      room.players[player.userId] = {
        id: player.userId,
        userId: player.userId,
        username: player.displayName || player.username || "Player",
        displayName: player.displayName || player.username || "Player",
        avatarUrl: player.avatarUrl || null,
        isGuest: Boolean(player.isGuest),
        role: isHost ? "host" : "player",
        isReady: true,
        seatIndex: assignedSeat,
        status: "connected",
        joinedAt: existing?.joinedAt || now,
        lastPingAt: now,
        pingMs: player.pingMs || 1,
      };

      room.version += 1;
      room.events.push({
        id: `ev-${now}-${Math.random().toString(36).slice(2, 6)}`,
        type: "PLAYER_JOINED",
        senderId: player.userId,
        payload: room.players[player.userId],
        timestamp: now,
      });
    } else if (type === "HEARTBEAT" && userId) {
      if (room.players[userId]) {
        room.players[userId].lastPingAt = now;
      }
    } else if (type === "START_GAME") {
      room.status = "started";
      if (playerViews) room.playerViews = playerViews;
      if (gameState) room.gameState = gameState;
      room.version += 1;
      room.events.push({
        id: `ev-${now}-${Math.random().toString(36).slice(2, 6)}`,
        type: "START_GAME",
        senderId: userId || room.hostId,
        payload: { gameState, playerViews },
        timestamp: now,
      });
    } else if (type === "STATE_UPDATE") {
      if (playerViews) room.playerViews = playerViews;
      if (gameState) room.gameState = gameState;
      if (result) room.lastResult = result;
      room.version += 1;
      room.events.push({
        id: `ev-${now}-${Math.random().toString(36).slice(2, 6)}`,
        type: "STATE_UPDATE",
        senderId: userId || "",
        payload: { gameState, playerViews, result },
        timestamp: now,
      });
    } else if (type === "GAME_ACTION") {
      room.events.push({
        id: `ev-${now}-${Math.random().toString(36).slice(2, 6)}`,
        type: "GAME_ACTION",
        senderId: userId || "",
        payload: action,
        timestamp: now,
      });
    } else if (type === "LEAVE" && userId) {
      delete room.players[userId];
      room.version += 1;
    }

    // Keep events array bounded to last 50 events
    if (room.events.length > 50) {
      room.events = room.events.slice(-50);
    }

    return NextResponse.json({
      success: true,
      code: room.code,
      status: room.status,
      players: room.players,
      gameState: room.gameState,
      lastResult: room.lastResult,
      version: room.version,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process event" }, { status: 500 });
  }
}
