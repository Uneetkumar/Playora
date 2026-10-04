"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import type { ChatMessage, GameId, GameResult, Player, Room } from "@playora/game-types";
import { gameEngineRegistry } from "@playora/game-engine";
import { mergeRoomOptions, readRoomOptions } from "@playora/protocol";
import { toast } from "@playora/ui";
import { isGameId } from "../../../lib/games/catalog";
import { RoomLobby } from "../../../components/rooms/room-lobby";
import { RoomMatch } from "../../../components/rooms/room-match";
import { ReactionOverlay, type FloatingReaction } from "../../../components/reactions/reaction-overlay";
import type { SeatStats } from "../../../components/rooms/seat-stats";
import type { RoomConnectionStatus } from "../../../components/rooms/room-top-bar";
import { maxPlayersFor } from "../../../components/rooms/lobby-logic";

/*
 * Fixtures. Made up, and only ever shown here: the real lobby draws nothing
 * it was not told by the server or the database.
 */
const CODE = "K7Q2XD";
const T0 = Date.UTC(2026, 9, 3, 18, 0);

function person(
  userId: string,
  displayName: string,
  seatIndex: number,
  over: Partial<Player> = {},
): Player {
  return {
    id: `conn-${userId}`,
    userId,
    username: displayName.toLowerCase(),
    displayName,
    avatarUrl: null,
    role: "player",
    isReady: false,
    seatIndex,
    status: "connected",
    joinedAt: T0 + seatIndex * 1000,
    lastPingAt: T0,
    isGuest: false,
    isBot: false,
    ...over,
  };
}

const HOST = person("u-maya", "Maya Okafor", 0, { role: "host" });
const THEO = person("u-theo", "Theo", 1, { isReady: true });
const PRIYA = person("u-priya", "Priya Raman", 2, { isGuest: true });
const BOT = person("bot-1", "AI level 3", 3, { isBot: true, botLevel: 3, isReady: true });
const SAM = person("u-sam", "Sam", -1, { role: "spectator" });

const STATS: Record<string, SeatStats> = {
  "u-maya": { level: 14, rating: 1420, rankLabel: "Gold" },
  "u-theo": { level: 6 },
};

const MESSAGES: ChatMessage[] = [
  { id: "m1", roomId: CODE, senderId: "system", senderName: "", senderAvatarUrl: null, message: "Theo joined the room", timestamp: T0 + 20_000, isSystem: true },
  { id: "m2", roomId: CODE, senderId: "u-theo", senderName: "Theo", senderAvatarUrl: null, message: "No stacking this time please", timestamp: T0 + 40_000 },
  { id: "m3", roomId: CODE, senderId: "u-maya", senderName: "Maya Okafor", senderAvatarUrl: null, message: "Ha. One more round then dinner", timestamp: T0 + 55_000 },
  { id: "m4", roomId: CODE, senderId: "u-priya", senderName: "Priya Raman", senderAvatarUrl: null, message: "brb grabbing a drink, ready in a sec", timestamp: T0 + 70_000 },
];

function seatsFor(gameId: GameId): Player[] {
  const max = maxPlayersFor(gameId);
  return [HOST, THEO, PRIYA, BOT].slice(0, Math.max(2, Math.min(max, 4)));
}

function initialRoom(gameId: GameId, status: Room["status"]): Room {
  const players = Object.fromEntries(seatsFor(gameId).map((p) => [p.userId, p]));
  return {
    id: CODE,
    code: CODE,
    name: `Room ${CODE}`,
    hostId: HOST.userId,
    gameId,
    status,
    settings: {
      maxPlayers: maxPlayersFor(gameId),
      isPrivate: true,
      gameMode: "casual",
      allowSpectators: true,
      customRules: gameId === "car-race" || gameId === "bike-race" ? { laps: 3, botLevel: 3 } : { botLevel: 3 },
    },
    players,
    spectators: { [SAM.userId]: SAM },
    currentSessionId: status === "waiting" ? null : "preview-session",
    createdAt: T0,
    updatedAt: T0,
  };
}

/** The match the `view=result` screen has just finished: the host won it. */
function resultFor(gameId: GameId): GameResult {
  return {
    sessionId: "preview-session",
    roomId: CODE,
    gameId,
    winnerId: HOST.userId,
    scores: seatsFor(gameId).map((p, i) => ({
      playerId: p.userId,
      userId: p.userId,
      rank: i + 1,
      score: Math.max(0, 120 - i * 35),
      isWinner: i === 0,
    })),
    durationSeconds: 412,
    completedAt: new Date(T0 + 412_000).toISOString(),
    reason: "normal",
  };
}

/** A real deal from the game's own engine, so the match view is laid out around real data. */
function dealFor(gameId: GameId, room: Room, viewerId: string): unknown {
  if (!gameEngineRegistry.has(gameId)) return null;
  const engine = gameEngineRegistry.get(gameId);
  const state = engine.init(Object.values(room.players), {
    roomId: room.id,
    sessionId: "preview-session",
    randomSeed: "lobby-preview",
  });
  return engine.getPlayerView(state, viewerId);
}

export function LobbyPreview() {
  const params = useSearchParams();
  const gameParam = params?.get("game");
  const gameId: GameId = isGameId(gameParam) ? gameParam : "uno";
  const as = params?.get("as") ?? "host";
  const viewParam = params?.get("view");
  const view = viewParam === "match" || viewParam === "result" ? viewParam : "lobby";
  // `left=1` on the result: everyone else has gone, so a rematch is a seat short.
  const othersLeft = params?.get("left") === "1";
  const chatOpen = params?.get("chat") === "open";
  const connection = (params?.get("connection") as RoomConnectionStatus | null) ?? "connected";
  const viewerId = as === "guest" ? PRIYA.userId : as === "spectator" ? SAM.userId : HOST.userId;

  const [room, setRoom] = React.useState<Room>(() => {
    const r = initialRoom(gameId, view === "match" ? "in_game" : view === "result" ? "finished" : "waiting");
    return othersLeft ? { ...r, players: { [HOST.userId]: HOST } } : r;
  });
  const result = React.useMemo(() => (view === "result" ? resultFor(gameId) : null), [gameId, view]);
  const [messages, setMessages] = React.useState<ChatMessage[]>(MESSAGES);
  const [reactions, setReactions] = React.useState<FloatingReaction[]>([]);
  const gameState = React.useMemo(
    () => (view === "match" ? dealFor(gameId, initialRoom(gameId, "in_game"), viewerId) : null),
    [gameId, view, viewerId],
  );

  const updatePlayers = (fn: (players: Record<string, Player>) => Record<string, Player>) =>
    setRoom((r) => ({ ...r, players: fn(r.players) }));

  const sendChat = (message: string) =>
    setMessages((m) => [
      ...m,
      {
        id: crypto.randomUUID(),
        roomId: CODE,
        senderId: viewerId,
        senderName: "You",
        senderAvatarUrl: null,
        message,
        timestamp: Date.now(),
      },
    ]);

  const sendReaction = (emoji: string) => {
    const r = { id: crypto.randomUUID(), emoji, senderName: "You", leftPercent: 15 + Math.random() * 70 };
    setReactions((prev) => [...prev, r]);
    setTimeout(() => setReactions((prev) => prev.filter((x) => x.id !== r.id)), 2500);
  };

  return (
    // Over the app shell, the way an immersive route has the viewport to itself.
    <div className="fixed inset-0 z-drawer bg-background">
      <ReactionOverlay reactions={reactions} />
      {view !== "lobby" ? (
        <RoomMatch
          gameId={gameId}
          code={CODE}
          room={room}
          currentUserId={viewerId}
          connection={connection}
          gameState={gameState}
          lastResult={result}
          progression={null}
          rematchPending={false}
          messages={messages}
          onSendGameAction={(type) => toast.error("That card can't be played on a red 7", { id: `preview-${type}` })}
          onRematch={() => toast("Preview: rematch vote")}
          onLeave={() => toast("Preview: would leave the room")}
          onSendChat={sendChat}
          onSendReaction={sendReaction}
        />
      ) : (
        <RoomLobby
          gameId={gameId}
          code={CODE}
          room={connection === "connecting" || connection === "disconnected" ? null : room}
          currentUserId={viewerId}
          connection={connection}
          isPrivate
          messages={messages}
          statsOverride={STATS}
          defaultChatOpen={chatOpen}
          actions={{
            onLeave: () => toast("Preview: would leave the room"),
            onSetReady: (ready) =>
              updatePlayers((p) => {
                const me = p[viewerId];
                return me ? { ...p, [viewerId]: { ...me, isReady: ready } } : p;
              }),
            onStart: () => toast.success("Preview: the server would deal now"),
            onAddBot: (level) =>
              updatePlayers((p) => {
                const taken = new Set(Object.values(p).map((x) => x.seatIndex));
                let seat = 0;
                while (taken.has(seat)) seat++;
                const bot = person(`bot-${crypto.randomUUID()}`, `AI level ${level}`, seat, {
                  isBot: true,
                  botLevel: level,
                  isReady: true,
                });
                return { ...p, [bot.userId]: bot };
              }),
            onKick: (userId) => {
              updatePlayers((p) => {
                const { [userId]: _gone, ...rest } = p;
                return rest;
              });
              setRoom((r) => {
                const { [userId]: _gone, ...rest } = r.spectators;
                return { ...r, spectators: rest };
              });
            },
            onUpdateSettings: (patch) =>
              setRoom((r) => {
                const next = mergeRoomOptions(readRoomOptions(gameId, r.settings.customRules), patch);
                const players =
                  patch.botLevel === undefined
                    ? r.players
                    : Object.fromEntries(
                        Object.entries(r.players).map(([id, p]) => [
                          id,
                          p.isBot ? { ...p, botLevel: patch.botLevel, displayName: `AI level ${patch.botLevel}` } : p,
                        ]),
                      );
                return { ...r, players, settings: { ...r.settings, customRules: { ...next } } };
              }),
            onSendChat: sendChat,
            onSendReaction: sendReaction,
            onRetry: () => toast("Preview: would reload"),
          }}
        />
      )}
    </div>
  );
}
