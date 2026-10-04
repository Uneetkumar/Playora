"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { GameId, PlayerReaction } from "@playora/game-types";
import { toast } from "@playora/ui";
import { useRoomSocket } from "../../../hooks/use-room-socket";
import { useRoomStore } from "../../../lib/store/room-store";
import { useGameStore } from "../../../lib/store/game-store";
import { useAuthStore } from "../../../lib/store/auth-store";
import { useRoomInfo } from "../../../hooks/use-rooms";
import { ReactionOverlay, type FloatingReaction } from "../../../components/reactions/reaction-overlay";
import { RoomLobby } from "../../../components/rooms/room-lobby";
import { RoomMatch } from "../../../components/rooms/room-match";
import { rememberRoom } from "../../../components/rooms/recent-rooms";

/** How long a reaction floats before it is removed. Matches `animate-float-fade`. */
const REACTION_LIFETIME_MS = 2500;

/**
 * Server errors that are the player's own doing and worth a word, but not a
 * banner: an illegal move, a Start that raced someone unreadying. They go to
 * a toast near the action. `id` is the error code, so a burst of the same
 * error (racing input over the limit) is one toast that updates, not a stack.
 */
function toastServerError(message: string, code?: string) {
  toast.error(message, { id: code ?? message });
}

function isSameRoom(serverCode: string, urlCode: string): boolean {
  const code = serverCode.toUpperCase();
  return code === urlCode || (urlCode.length > 8 && code === urlCode.slice(0, 6));
}

function RoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomCode = String(params?.code ?? "").toUpperCase();
  const isPrivateQuery = searchParams?.get("private") === "true";

  const [floatingReactions, setFloatingReactions] = React.useState<FloatingReaction[]>([]);

  const { user } = useAuthStore();
  const { currentRoom, messages } = useRoomStore();
  const { gameState, lastResult, progression, rematch, resetGame } = useGameStore();

  // A new code is a new room. Without this, the previous room's state,
  // result and chat carried over on client-side navigation, and its game id
  // was used to open the next room.
  React.useEffect(() => {
    useRoomStore.getState().reset();
    useGameStore.getState().resetGame();
  }, [roomCode]);

  // Only trust the stored room once it is this room. The server derives the
  // code from the room id, shortening anything past eight characters.
  const room = currentRoom && isSameRoom(currentRoom.code, roomCode) ? currentRoom : null;

  const { info: roomInfo, isResolving: roomResolving } = useRoomInfo(roomCode);
  const gameId = (room?.gameId ?? roomInfo?.gameSlug ?? "chess") as GameId;

  // Once the server has let us in, this is a room worth offering back on the
  // rooms page.
  const admitted = room !== null;
  React.useEffect(() => {
    if (admitted) rememberRoom(roomCode, gameId);
  }, [admitted, roomCode, gameId]);

  const handleIncomingReaction = React.useCallback((reaction: PlayerReaction) => {
    const players = useRoomStore.getState().currentRoom?.players;
    const floating: FloatingReaction = {
      id: crypto.randomUUID(),
      emoji: reaction.emoji,
      senderName: players?.[reaction.senderId]?.displayName,
      leftPercent: 15 + Math.random() * 70,
    };
    setFloatingReactions((prev) => [...prev, floating]);
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== floating.id));
    }, REACTION_LIFETIME_MS);
  }, []);

  const handleServerError = React.useCallback(
    (message: string, code?: string) => {
      if (code === "KICKED") {
        toast.error("You were removed from the room", { description: "The host removed you." });
        useRoomStore.getState().reset();
        useGameStore.getState().resetGame();
        router.push("/rooms");
        return;
      }
      toastServerError(message, code);
    },
    [router],
  );

  const {
    connectionStatus,
    setReadyState,
    kickPlayer,
    updateRoomSettings,
    startGame,
    sendGameAction,
    sendChatMessage,
    sendReaction,
    leaveRoom,
    addBot,
    requestRematch,
  } = useRoomSocket({
    roomId: roomCode,
    gameId,
    ready: !roomResolving,
    onReaction: handleIncomingReaction,
    onError: handleServerError,
  });

  const currentUserId = user?.id ?? "";

  const handleLeave = () => {
    leaveRoom();
    resetGame();
    useRoomStore.getState().reset();
    router.push("/rooms");
  };

  const inMatch = room?.status === "in_game" || room?.status === "finished";

  return (
    <>
      <ReactionOverlay reactions={floatingReactions} />
      {inMatch && room ? (
        <RoomMatch
          gameId={gameId}
          code={roomCode}
          room={room}
          currentUserId={currentUserId}
          connection={connectionStatus}
          gameState={gameState}
          lastResult={lastResult}
          progression={progression}
          rematchPending={rematch !== null && rematch.votes.includes(currentUserId)}
          messages={messages}
          onSendGameAction={(type, payload) => sendGameAction(type, payload)}
          onRematch={() => requestRematch(true)}
          onLeave={handleLeave}
          onSendChat={sendChatMessage}
          onSendReaction={sendReaction}
        />
      ) : (
        <RoomLobby
          gameId={gameId}
          code={roomCode}
          room={room}
          currentUserId={currentUserId}
          connection={roomResolving ? "connecting" : connectionStatus}
          isPrivate={isPrivateQuery}
          messages={messages}
          actions={{
            onLeave: handleLeave,
            onSetReady: setReadyState,
            onStart: () => startGame(),
            onAddBot: addBot,
            onKick: kickPlayer,
            onUpdateSettings: updateRoomSettings,
            onSendChat: sendChatMessage,
            onSendReaction: sendReaction,
            onRetry: () => window.location.reload(),
          }}
        />
      )}
    </>
  );
}

export default function RoomDetailsPage() {
  return (
    <React.Suspense fallback={<div className="h-full bg-background" />}>
      <RoomPage />
    </React.Suspense>
  );
}
