"use client";

import * as React from "react";
import Link from "next/link";
import type { ChatMessage, GameId, Player, Room } from "@playora/game-types";
import { botRegistry } from "@playora/bot-engine";
import { DEFAULT_BOT_LEVEL, readRoomOptions, type RoomOptions } from "@playora/protocol";
import { Button, ConfirmDialog, Skeleton } from "@playora/ui";
import { RefreshCw, Users, WifiOff } from "lucide-react";
import { ChatColumn, ChatDrawerButton, useChatUnread, useIsDesktop } from "../chat/chat-dock";
import { getCatalogGame } from "../../lib/games/catalog";
import { RoomHeader } from "./room-header";
import { RoomTopBar, type RoomConnectionStatus } from "./room-top-bar";
import { SeatGrid } from "./seat-grid";
import { LobbySettings } from "./lobby-settings";
import { SpectatorList } from "./spectator-list";
import { LobbyActionBar } from "./lobby-action-bar";
import { copyInviteLink } from "./invite";
import {
  arrangeSeats,
  lobbyReadiness,
  maxPlayersFor,
  minPlayersFor,
  seatCountFor,
  seatedPlayers,
  spectatorsOf,
  viewerRole,
} from "./lobby-logic";
import type { SeatStats } from "./seat-stats";

export interface RoomLobbyActions {
  onLeave: () => void;
  onSetReady: (ready: boolean) => void;
  onStart: () => void;
  onAddBot: (level: number) => void;
  /** Already confirmed: the lobby asks before removing a person. */
  onKick: (userId: string) => void;
  onUpdateSettings: (options: RoomOptions) => void;
  onSendChat: (message: string) => void;
  onSendReaction: (emoji: string) => void;
  /** Shown when the connection has given up. */
  onRetry: () => void;
}

export interface RoomLobbyProps {
  gameId: GameId;
  code: string;
  /** Null until the server's first ROOM_STATE arrives. */
  room: Room | null;
  currentUserId: string;
  connection: RoomConnectionStatus;
  isPrivate: boolean;
  messages: ChatMessage[];
  actions: RoomLobbyActions;
  /** The dev preview's stand-in for each player's progression. */
  statsOverride?: Record<string, SeatStats>;
  /** The dev preview opens the mobile chat drawer for its screenshot. */
  defaultChatOpen?: boolean;
}

/**
 * The waiting room, before a match: who is here, who is ready, how to get
 * more people in, and the host's controls.
 *
 * Purely presentational: the room page feeds it the socket's state and
 * actions, and the dev preview feeds it fixtures, so both render the same
 * component. The ready rule is the server's own (`lobbyReadiness` wraps the
 * protocol's `startBlocker`), so Start is never enabled for a start the
 * server would refuse.
 */
export function RoomLobby({
  gameId,
  code,
  room,
  currentUserId,
  connection,
  isPrivate,
  messages,
  actions,
  statsOverride,
  defaultChatOpen = false,
}: RoomLobbyProps) {
  const isDesktop = useIsDesktop();
  const [chatOpen, setChatOpen] = React.useState(defaultChatOpen);
  const unread = useChatUnread(messages, isDesktop || chatOpen, currentUserId);
  const [kickTarget, setKickTarget] = React.useState<Player | null>(null);

  const game = getCatalogGame(gameId);
  const gameName = game?.name ?? gameId;
  const seated = seatedPlayers(room);
  const spectators = spectatorsOf(room);
  const role = viewerRole(room, currentUserId);
  const me = room?.players[currentUserId];
  const hostId = room?.hostId ?? "";
  const seatCount = seatCountFor(maxPlayersFor(gameId, room?.settings.maxPlayers));
  const seats = arrangeSeats(seated, seatCount);
  const readiness = lobbyReadiness({ seated, hostId, minPlayers: minPlayersFor(gameId) });
  const options = readRoomOptions(gameId, room?.settings.customRules);
  const botLevel = options.botLevel ?? DEFAULT_BOT_LEVEL;
  const connected = connection === "connected" && room !== null;
  const editable = role === "host" && connected;
  const canAddBots = botRegistry.has(gameId) && room?.status === "waiting";

  const chatProps = {
    messages,
    currentUserId,
    onSendMessage: actions.onSendChat,
    onSendReaction: actions.onSendReaction,
  };

  const requestKick = (player: Player) => {
    // A bot has no feelings and no account to bar; remove it straight away.
    if (player.isBot) actions.onKick(player.userId);
    else setKickTarget(player);
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <RoomTopBar
        onLeave={actions.onLeave}
        connection={connection}
        title={
          <span className="flex min-w-0 items-center gap-2 text-sm">
            <span className="hidden font-semibold text-foreground sm:inline">Lobby</span>
            <span aria-hidden className="hidden text-subtle sm:inline">
              ·
            </span>
            <span className="truncate text-muted-foreground">{gameName}</span>
          </span>
        }
      >
        <ChatDrawerButton {...chatProps} open={chatOpen} onOpenChange={setChatOpen} unread={unread} />
      </RoomTopBar>

      <div className="flex min-h-0 flex-1">
        <div className="relative flex min-w-0 flex-1 flex-col overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <RoomHeader gameId={gameId} code={code} isPrivate={isPrivate || Boolean(room?.settings.isPrivate)} />

            {connection === "disconnected" && room === null ? (
              <ConnectionLost onRetry={actions.onRetry} />
            ) : (
              <>
                <section aria-labelledby="seats-title" className="space-y-4">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <h2 id="seats-title" className="flex items-center gap-2 font-display text-rail text-foreground">
                        <Users className="h-5 w-5 text-primary-accent" aria-hidden />
                        Players
                        <span className="numeric text-muted-foreground">
                          {seated.length}/{seatCount}
                        </span>
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {role === "host"
                          ? "Invite friends or fill seats with bots, then start when everyone is ready."
                          : "Ready up when you're set. The host starts the match."}
                      </p>
                    </div>
                  </div>

                  {room ? (
                    <SeatGrid
                      gameId={gameId}
                      seats={seats}
                      hostId={hostId}
                      currentUserId={currentUserId}
                      viewerIsHost={editable}
                      canAddBots={canAddBots}
                      botLevel={botLevel}
                      onBotLevelChange={(level) => actions.onUpdateSettings({ botLevel: level })}
                      onAddBot={() => actions.onAddBot(botLevel)}
                      onKick={requestKick}
                      onInvite={() => void copyInviteLink(code)}
                      {...(statsOverride ? { statsOverride } : {})}
                    />
                  ) : (
                    <SeatSkeletons count={seatCount} />
                  )}
                </section>

                {room && (
                  <LobbySettings
                    gameId={gameId}
                    options={options}
                    editable={editable}
                    hasBots={seated.some((p) => p.isBot)}
                    onChange={actions.onUpdateSettings}
                  />
                )}

                <SpectatorList
                  spectators={spectators}
                  currentUserId={currentUserId}
                  {...(editable ? { onKick: (p: Player) => setKickTarget(p) } : {})}
                />
              </>
            )}
          </div>

          <LobbyActionBar
            role={role}
            readiness={readiness}
            meReady={Boolean(me?.isReady)}
            connected={connected}
            onToggleReady={actions.onSetReady}
            onStart={actions.onStart}
          />
        </div>

        <ChatColumn {...chatProps} />
      </div>

      <ConfirmDialog
        open={kickTarget !== null}
        onOpenChange={(open) => {
          if (!open) setKickTarget(null);
        }}
        variant="destructive"
        title={`Remove ${kickTarget?.displayName || "this player"}?`}
        description="They leave the room straight away and can't rejoin it. Anyone else can still use the code."
        confirmLabel="Remove"
        onConfirm={() => {
          if (kickTarget) actions.onKick(kickTarget.userId);
          setKickTarget(null);
        }}
      />
    </div>
  );
}

function SeatSkeletons({ count }: { count: number }) {
  return (
    <div aria-busy="true" aria-label="Loading seats" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
      {Array.from({ length: Math.min(count, 4) }, (_, i) => (
        <Skeleton key={i} className="h-52 rounded-xl" />
      ))}
    </div>
  );
}

function ConnectionLost({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card px-6 py-12 text-center shadow-card">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-destructive/15 text-destructive-ink">
        <WifiOff className="h-6 w-6" aria-hidden />
      </span>
      <div className="max-w-sm space-y-1">
        <h2 className="font-display text-h2 text-foreground">Couldn't reach the room</h2>
        <p className="text-sm text-muted-foreground">
          The game server isn't answering. Check your connection and try again, or go back and pick another room.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={onRetry}>
          <RefreshCw className="h-4 w-4" aria-hidden />
          Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/rooms">Back to rooms</Link>
        </Button>
      </div>
    </div>
  );
}
