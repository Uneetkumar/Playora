"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useRoomSocket } from "../../../hooks/use-room-socket";
import { useRoomStore } from "../../../lib/store/room-store";
import { useGameStore } from "../../../lib/store/game-store";
import { useAuthStore } from "../../../lib/store/auth-store";
import { useRoomInfo } from "../../../hooks/use-rooms";
import { RoomChat } from "../../../components/chat/room-chat";
import { ReactionOverlay, type FloatingReaction } from "../../../components/reactions/reaction-overlay";
import { RoomGameSurface } from "../../../components/games/room-game-surface";
import type { GameId, PlayerReaction } from "@playora/game-types";
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@playora/ui";
import {
  Users,
  Copy,
  Check,
  Crown,
  Play,
  Share2,
  ArrowLeft,
  Wifi,
  WifiOff,
  CheckCircle2,
  Clock,
  Sparkles,
  Lock,
  Globe2,
  Bot,
} from "lucide-react";

function RoomDetailsContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomCode = (params?.code as string) || "";
  const isPrivateQuery = searchParams?.get("private") === "true";

  const [copiedCode, setCopiedCode] = React.useState(false);
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [floatingReactions, setFloatingReactions] = React.useState<FloatingReaction[]>([]);

  const { user } = useAuthStore();
  const { currentRoom, messages, error } = useRoomStore();
  const { gameState, lastResult, progression, rematch, resetGame } = useGameStore();

  const handleIncomingReaction = React.useCallback(
    (reactionItem: PlayerReaction) => {
      const senderName = currentRoom?.players[reactionItem.senderId]?.displayName;
      const leftPercent = 15 + Math.random() * 70; // 15% to 85%
      const newFloating: FloatingReaction = {
        id: crypto.randomUUID(),
        emoji: reactionItem.emoji,
        senderName,
        leftPercent,
      };

      setFloatingReactions((prev) => [...prev, newFloating]);

      setTimeout(() => {
        setFloatingReactions((prev) => prev.filter((r) => r.id !== newFloating.id));
      }, 2500);
    },
    [currentRoom?.players]
  );

  const { info: roomInfo, isResolving: roomResolving } = useRoomInfo(roomCode);

  const {
    connectionStatus,
    setReady,
    setUnready,
    startGame,
    sendGameAction,
    sendChatMessage,
    sendReaction,
    leaveRoom,
    addBot,
    requestRematch,
  } = useRoomSocket({
    roomId: roomCode,
    // Resolved from the server before connecting. Deliberately does NOT fall
    // back to currentRoom: that arrives after ROOM_STATE, so including it made
    // gameId change mid-session and tore the socket down.
    gameId: roomInfo?.gameSlug ?? "chess",
    ready: !roomResolving,
    onReaction: handleIncomingReaction,
  });

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const isRoomPrivate = isPrivateQuery || currentRoom?.settings?.isPrivate || false;
  const currentUserId = user?.id || "";
  const playersList = currentRoom ? Object.values(currentRoom.players) : [];
  const myPlayerRecord = currentRoom?.players[currentUserId];
  const isHost = currentRoom?.hostId === currentUserId;
  const isAllReady = playersList.length >= 2 && playersList.every((p) => p.isReady || p.role === "host");

  const player1 = playersList[0];
  const player2 = playersList[1];

  const handleLeave = () => {
    leaveRoom();
    resetGame();
    router.push("/rooms");
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-[#080c14] text-foreground relative pb-12">
      {/* Ephemeral Reaction Overlay */}
      <ReactionOverlay reactions={floatingReactions} />

      {/* Top Navigation / Room Info Header */}
      <header className="border-b border-border bg-background/70 backdrop-blur-md sticky top-16 z-30 px-4 py-3">
        <div className="container mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="sm" onClick={handleLeave} className="h-8 gap-1 text-muted-foreground">
              <ArrowLeft className="h-4 w-4" />
              <span>Leave</span>
            </Button>
            <div className="h-4 w-px bg-border" />
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-white tracking-wide">
                  {currentRoom?.name || `Room ${roomCode}`}
                </span>
                <Badge variant="default" className="text-[10px] uppercase">
                  {currentRoom?.gameId || "Chess"}
                </Badge>
                {/* Privacy Badge in Header */}
                {isRoomPrivate ? (
                  <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400 bg-amber-950/40 gap-1">
                    <Lock className="h-2.5 w-2.5" /> Private
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400 bg-emerald-950/40 gap-1">
                    <Globe2 className="h-2.5 w-2.5" /> Public
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Connection Status Badge */}
            <div className="flex items-center space-x-1.5 text-xs bg-card border border-border px-2.5 py-1 rounded-full">
              {connectionStatus === "connected" ? (
                <>
                  <Wifi className="h-3 w-3 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 text-amber-400 animate-pulse" />
                  <span className="text-amber-400 font-medium capitalize">{connectionStatus}</span>
                </>
              )}
            </div>

            {/* Room Code Badge with Copy */}
            <div className="flex items-center bg-card border border-primary/40 rounded-lg p-0.5 shadow-sm">
              <span className="px-2 text-xs font-mono font-bold text-primary">
                {roomCode}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyCode}
                className="h-7 w-7 p-0 text-primary hover:text-primary"
                title="Copy Room Code"
              >
                {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>

            {/* Share Link Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="h-8 gap-1.5 text-xs hidden sm:flex"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>{copiedLink ? "Link Copied!" : "Invite"}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="container mx-auto max-w-7xl px-4 py-6 flex-1">
        {/* Error Alert if any */}
        {error && (
          <div className="mb-6 p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-xs text-red-200 flex items-center justify-between">
            <span>{error}</span>
          </div>
        )}

        {/* 1. In-Game Mode: whichever game this room is running */}
        {currentRoom?.status === "in_game" || currentRoom?.status === "finished" ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              {gameState || lastResult ? (
                <RoomGameSurface
                  gameId={(currentRoom.gameId ?? "chess") as GameId}
                  gameState={gameState}
                  players={currentRoom.players}
                  currentUserId={currentUserId}
                  lastResult={lastResult}
                  progression={progression}
                  sendGameAction={(type, payload) => sendGameAction(type, payload)}
                  onRematch={() => requestRematch(true)}
                  rematchPending={rematch !== null && rematch.votes.includes(currentUserId)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-80 space-y-3">
                  <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-muted-foreground">Loading live board state...</p>
                </div>
              )}
            </div>

            {/* Chat & Reactions Column in Gameplay */}
            <div className="lg:col-span-1">
              <RoomChat
                messages={messages}
                currentUserId={currentUserId}
                onSendMessage={sendChatMessage}
                onSendReaction={sendReaction}
                className="h-full min-h-[480px]"
              />
            </div>
          </div>
        ) : (
          /* 2. Lobby Mode: Player Slots, Ready status, Host start controls */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Player Slots & Lobby Controls */}
            <div className="lg:col-span-2 space-y-6">
              {/* Privacy Notice & Invite Card */}
              {isRoomPrivate ? (
                <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-amber-950/20">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 mt-0.5 sm:mt-0">
                      <Lock className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-amber-200">Private Match</h4>
                      <p className="text-xs text-amber-400/80 mt-0.5">
                        This match is hidden from public view. Share this code or link with your opponent to let them join.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                    <Button size="sm" onClick={handleCopyCode} variant="outline" className="flex-1 sm:flex-initial h-8 text-xs border-amber-500/50 text-amber-300 hover:bg-amber-500/10 gap-1.5">
                      {copiedCode ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedCode ? "Copied" : "Copy Code"}</span>
                    </Button>
                    <Button size="sm" onClick={handleCopyLink} className="flex-1 sm:flex-initial h-8 text-xs bg-amber-600 hover:bg-amber-500 text-white gap-1.5">
                      <Share2 className="h-3.5 w-3.5" />
                      <span>{copiedLink ? "Copied" : "Invite Link"}</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-3 px-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <Globe2 className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs text-emerald-300 font-medium">
                      Public Match — Open in room directory for anyone to join.
                    </span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={handleCopyLink} className="h-7 text-xs text-emerald-400 hover:text-emerald-200">
                    {copiedLink ? "Link Copied!" : "Copy Link"}
                  </Button>
                </div>
              )}

              <Card className="bg-card/60 border-border backdrop-blur-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Match Lobby</CardTitle>
                      <CardDescription>
                        2 Players required for Chess. Waiting for players to ready up.
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="gap-1">
                      <Users className="h-3.5 w-3.5" />
                      <span>
                        {playersList.length}/{currentRoom?.settings.maxPlayers || 2}
                      </span>
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Player 1 Slot (White / Host) */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-background/60 border border-border">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/40 text-primary flex items-center justify-center font-extrabold text-base">
                          {player1?.displayName?.slice(0, 2).toUpperCase() || "P1"}
                        </div>
                        {player1?.role === "host" && (
                          <div className="absolute -top-1.5 -right-1.5 bg-amber-500 text-background p-1 rounded-full">
                            <Crown className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-foreground">
                            {player1?.displayName || "Player 1"}
                          </span>
                          {player1?.userId === currentUserId && (
                            <Badge variant="outline" className="text-[10px]">
                              You
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">Plays White ♔</span>
                      </div>
                    </div>

                    <div>
                      {player1 ? (
                        player1.role === "host" ? (
                          <Badge variant="default" className="text-xs">
                            Host
                          </Badge>
                        ) : player1.isReady ? (
                          <Badge variant="success" className="text-xs gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Ready
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Clock className="h-3 w-3" /> Not Ready
                          </Badge>
                        )
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Open Slot
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Player 2 Slot (Black / Challenger) */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-background/60 border border-border">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center font-extrabold text-base ${
                            player2
                              ? "bg-purple-600/20 border border-purple-500/40 text-purple-400"
                              : "border border-dashed border-border text-muted-foreground"
                          }`}
                        >
                          {player2?.displayName?.slice(0, 2).toUpperCase() || "?"}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-foreground">
                            {player2?.displayName || "Waiting for opponent..."}
                          </span>
                          {player2?.userId === currentUserId && (
                            <Badge variant="outline" className="text-[10px]">
                              You
                            </Badge>
                          )}
                          {player2?.isBot && (
                            <Badge variant="warning" className="text-[10px] gap-1">
                              <Bot className="h-3 w-3" />
                              BOT
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {player2 ? "Plays Black ♚" : "Share room code or invite link"}
                        </span>
                      </div>
                    </div>

                    <div>
                      {player2 ? (
                        player2.isReady ? (
                          <Badge variant="success" className="text-xs gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Ready
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Clock className="h-3 w-3" /> Not Ready
                          </Badge>
                        )
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="hidden sm:flex items-center space-x-2 text-xs text-primary font-medium">
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>Slot Open</span>
                          </div>
                          {isHost && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              onClick={() => addBot(3)}
                            >
                              <Bot className="h-3.5 w-3.5" />
                              <span>Play vs AI</span>
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
                    {/* Non-host Ready Toggle */}
                    {!isHost && myPlayerRecord && (
                      <Button
                        variant={myPlayerRecord.isReady ? "outline" : "default"}
                        onClick={myPlayerRecord.isReady ? setUnready : setReady}
                        className="gap-2"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{myPlayerRecord.isReady ? "Cancel Ready" : "I'm Ready"}</span>
                      </Button>
                    )}

                    {/* Host Start Game Button */}
                    {isHost && (
                      <Button
                        size="lg"
                        onClick={() => startGame()}
                        disabled={!isAllReady || playersList.length < 2}
                        className="w-full sm:w-auto gap-2 shadow-primary/30"
                      >
                        <Play className="h-5 w-5 fill-current" />
                        <span>{playersList.length < 2 ? "Waiting for Opponent" : !isAllReady ? "Waiting for Ready" : "Start Game"}</span>
                      </Button>
                    )}

                    {!isHost && !myPlayerRecord && (
                      <p className="text-xs text-muted-foreground">You are spectating this match.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Room Chat & Reactions */}
            <div className="lg:col-span-1">
              <RoomChat
                messages={messages}
                currentUserId={currentUserId}
                onSendMessage={sendChatMessage}
                onSendReaction={sendReaction}
                className="h-full min-h-[420px]"
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function RoomDetailsPage() {
  return (
    <React.Suspense fallback={<div className="container mx-auto p-10 text-muted-foreground">Loading room...</div>}>
      <RoomDetailsContent />
    </React.Suspense>
  );
}
