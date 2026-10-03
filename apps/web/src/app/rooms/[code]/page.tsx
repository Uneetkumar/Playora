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
import { GAME_CATALOG } from "../../../lib/games/catalog";
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

  const activeGameId = ((currentRoom?.gameId || roomInfo?.gameSlug || "chess") as GameId);
  const gameMeta = GAME_CATALOG.find((g) => g.id === activeGameId);
  const gameName = gameMeta?.name || (activeGameId ? activeGameId.toUpperCase() : "Game");
  const minPlayers = gameMeta?.minPlayers || 2;
  const maxPlayers = currentRoom?.settings?.maxPlayers || gameMeta?.maxPlayers || 2;

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
    removeBot,
    requestRematch,
  } = useRoomSocket({
    roomId: roomCode,
    gameId: activeGameId,
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
  const isAllReady =
    playersList.length >= minPlayers &&
    playersList.every((p) => p.isReady || p.role === "host");

  const handleLeave = () => {
    leaveRoom();
    resetGame();
    router.push("/rooms");
  };

  const totalDisplaySlots = Math.max(minPlayers, Math.min(maxPlayers, playersList.length + 1));
  const emptySlotsCount = Math.max(0, totalDisplaySlots - playersList.length);

  return (
    <div className="h-full min-h-screen flex flex-col bg-[#080c14] text-foreground relative overflow-y-auto">
      {/* Ephemeral Reaction Overlay */}
      <ReactionOverlay reactions={floatingReactions} />

      {/* Top Navigation / Room Info Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-30 px-4 py-3 shrink-0">
        <div className="container mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="sm" onClick={handleLeave} className="h-8 gap-1 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              <span>Leave</span>
            </Button>
            <div className="h-4 w-px bg-border" />
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-foreground tracking-wide">
                  {currentRoom?.name || `Room ${roomCode}`}
                </span>
                <Badge variant="default" className="text-[10px] uppercase font-bold tracking-wider">
                  {gameName}
                </Badge>
                {/* Privacy Badge in Header */}
                {isRoomPrivate ? (
                  <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-950/40 gap-1">
                    <Lock className="h-2.5 w-2.5" /> Private
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-950/40 gap-1">
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
              <span className="px-2 text-xs font-mono font-bold text-primary-accent">
                {roomCode}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyCode}
                className="h-7 w-7 p-0 text-primary-accent hover:text-primary-accent"
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
                  gameId={activeGameId}
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
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
                        {minPlayers} {minPlayers === 1 ? "Player" : "Players"} required for {gameName}. {playersList.length < minPlayers ? "Waiting for players to join..." : "Waiting for players to ready up."}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="gap-1">
                      <Users className="h-3.5 w-3.5" />
                      <span>
                        {playersList.length}/{maxPlayers}
                      </span>
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Dynamic Players List */}
                  {playersList.map((player, index) => {
                    const isPlayerHost = player.role === "host" || player.userId === currentRoom?.hostId;
                    const isMe = player.userId === currentUserId;

                    let roleSubtitle = `Player ${index + 1}`;
                    if (activeGameId === "chess") {
                      roleSubtitle = index === 0 ? "Plays White ♔" : "Plays Black ♚";
                    } else if (isPlayerHost) {
                      roleSubtitle = "Room Host";
                    }

                    return (
                      <div
                        key={player.userId || index}
                        className="flex items-center justify-between p-4 rounded-xl bg-background/60 border border-border"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="relative">
                            <div
                              className={`w-12 h-12 rounded-xl flex items-center justify-center font-extrabold text-base ${
                                index === 0
                                  ? "bg-primary/20 border border-primary/40 text-primary-accent"
                                  : index === 1
                                  ? "bg-purple-600/20 border border-purple-500/40 text-purple-400"
                                  : "bg-blue-600/20 border border-blue-500/40 text-blue-400"
                              }`}
                            >
                              {player.isBot ? (
                                <Bot className="h-6 w-6" />
                              ) : (
                                player.displayName?.slice(0, 2).toUpperCase() || `P${index + 1}`
                              )}
                            </div>
                            {isPlayerHost && (
                              <div className="absolute -top-1.5 -right-1.5 bg-amber-500 text-background p-1 rounded-full shadow-sm">
                                <Crown className="h-3 w-3 text-amber-950" />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-foreground">
                                {player.displayName || `Player ${index + 1}`}
                              </span>
                              {isMe && (
                                <Badge variant="outline" className="text-[10px]">
                                  You
                                </Badge>
                              )}
                              {player.isBot && (
                                <Badge variant="warning" className="text-[10px] gap-1">
                                  <Bot className="h-3 w-3" />
                                  BOT
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">{roleSubtitle}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isPlayerHost ? (
                            <Badge variant="default" className="text-xs">
                              Host
                            </Badge>
                          ) : player.isReady ? (
                            <Badge variant="success" className="text-xs gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Ready
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs gap-1">
                              <Clock className="h-3 w-3" /> Not Ready
                            </Badge>
                          )}

                          {isHost && player.isBot && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeBot(player.userId)}
                              className="h-7 text-xs text-red-700 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-500/20 dark:hover:bg-red-950/30 px-2"
                              title="Remove Bot"
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Empty / Open Slots */}
                  {Array.from({ length: emptySlotsCount }).map((_, i) => (
                    <div
                      key={`empty-slot-${i}`}
                      className="flex items-center justify-between p-4 rounded-xl bg-background/40 border border-dashed border-border"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center font-extrabold text-base border border-dashed border-border text-muted-foreground">
                          ?
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-foreground/70">
                              Waiting for opponent...
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            Share room code or invite link
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="hidden sm:flex items-center space-x-1.5 text-xs text-muted-foreground font-medium">
                          <Sparkles className="h-3.5 w-3.5 text-[#A855F7]" />
                          <span>Slot Open</span>
                        </div>
                        {isHost && (
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 border-[#7C3AED]/40 bg-primary/15 hover:bg-primary/25 text-[#C084FC] h-8 text-xs font-bold shadow-sm"
                              onClick={() => addBot(3)}
                            >
                              <Bot className="h-3.5 w-3.5" />
                              <span>+ Add AI Bot (Lvl 3)</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-border bg-foreground/5 hover:bg-foreground/10 text-foreground/80 h-8 text-xs font-semibold px-2"
                              onClick={() => addBot(5)}
                              title="Add Expert AI (Level 5)"
                            >
                              <span>Lvl 5</span>
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

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
                        disabled={!isAllReady || playersList.length < minPlayers}
                        className="w-full sm:w-auto gap-2 shadow-primary/30"
                      >
                        <Play className="h-5 w-5 fill-current" />
                        <span>
                          {playersList.length < minPlayers
                            ? "Waiting for Opponent"
                            : !isAllReady
                            ? "Waiting for Ready"
                            : "Start Game"}
                        </span>
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
                className="h-full min-h-[440px]"
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
