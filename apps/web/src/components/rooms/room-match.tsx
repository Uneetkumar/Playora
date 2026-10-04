"use client";

import * as React from "react";
import type { ChatMessage, GameId, GameResult, Room } from "@playora/game-types";
import type { PlayerProgressionPayload } from "@playora/protocol";
import { Button, ConfirmDialog, Tooltip, TooltipContent, TooltipTrigger, cn } from "@playora/ui";
import { Eye, Loader2, MessageSquare, PanelRightClose } from "lucide-react";
import { RoomGameSurface } from "../games/room-game-surface";
import { ChatColumn, ChatDrawerButton, useChatUnread, useIsDesktop } from "../chat/chat-dock";
import { getCatalogGame } from "../../lib/games/catalog";
import { gameAccentStyle } from "../../lib/games/meta";
import { formatUnread, rematchBlocker, spectatorsOf, viewerRole } from "./lobby-logic";
import { RoomTopBar, type RoomConnectionStatus } from "./room-top-bar";

/**
 * Views laid out in `h-full` and percentages, which collapse without a
 * definite height above them (r-uno: the online UNO table sat in an
 * auto-height column).
 */
const FILLS_HEIGHT: ReadonlySet<GameId> = new Set<GameId>(["uno", "uno-no-mercy"]);

export interface RoomMatchProps {
  gameId: GameId;
  code: string;
  room: Room;
  currentUserId: string;
  connection: RoomConnectionStatus;
  gameState: unknown;
  lastResult: GameResult | null;
  progression: Record<string, PlayerProgressionPayload> | null;
  rematchPending: boolean;
  messages: ChatMessage[];
  onSendGameAction: (type: string, payload: Record<string, unknown>) => void;
  onRematch: () => void;
  onLeave: () => void;
  onSendChat: (message: string) => void;
  onSendReaction: (emoji: string) => void;
}

/**
 * A room once its match is dealt: the game gets every pixel the bar and the
 * chat do not take.
 *
 * The board's container has an explicit height (the viewport less the bar),
 * and RoomGameSurface's root is stretched to it. Views such as UNO's lay out
 * in `h-full` and percentages, so in the auto-height column they used to sit
 * in they collapsed. Chat is a column on desktop that can be folded away, and
 * a drawer on a phone, so it never pushes the board down.
 *
 * Leaving while a match is live forfeits a seated player's place, so it asks
 * first. A spectator, or anyone once the match has finished, just goes.
 */
export function RoomMatch({
  gameId,
  code,
  room,
  currentUserId,
  connection,
  gameState,
  lastResult,
  progression,
  rematchPending,
  messages,
  onSendGameAction,
  onRematch,
  onLeave,
  onSendChat,
  onSendReaction,
}: RoomMatchProps) {
  const isDesktop = useIsDesktop();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [columnOpen, setColumnOpen] = React.useState(true);
  const [confirmLeave, setConfirmLeave] = React.useState(false);
  const chatVisible = isDesktop ? columnOpen : drawerOpen;
  const unread = useChatUnread(messages, chatVisible, currentUserId);

  const name = getCatalogGame(gameId)?.name ?? gameId;
  const role = viewerRole(room, currentUserId);
  const watching = spectatorsOf(room).length;
  const live = room.status === "in_game";
  const finished = room.status === "finished";
  // A result from the previous match must not sit over a rematch's board.
  const result = lastResult && (finished || lastResult.sessionId === room.currentSessionId) ? lastResult : null;
  const rematchUnavailable = rematchBlocker(room, gameId);

  const chatProps = { messages, currentUserId, onSendMessage: onSendChat, onSendReaction };

  const leave = () => {
    if (live && role !== "spectator") setConfirmLeave(true);
    else onLeave();
  };

  return (
    <div className="flex h-full flex-col bg-background" style={gameAccentStyle(gameId)}>
      <RoomTopBar
        onLeave={leave}
        connection={connection}
        title={
          <span className="flex min-w-0 items-center gap-2 text-sm">
            <span className="truncate font-semibold text-foreground">{name}</span>
            <span aria-hidden className="text-subtle">
              ·
            </span>
            <span className="font-mono-num shrink-0 tracking-widest text-muted-foreground">{code}</span>
            {live && (
              <span className="hidden shrink-0 rounded-full bg-game-accent-soft px-2 py-0.5 text-tag uppercase text-foreground sm:inline">
                Live match
              </span>
            )}
            {finished && (
              <span className="hidden shrink-0 rounded-full bg-muted px-2 py-0.5 text-tag uppercase text-muted-foreground sm:inline">
                Finished
              </span>
            )}
          </span>
        }
      >
        {watching > 0 && (
          <span
            className="numeric hidden items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground sm:inline-flex"
            aria-label={`${watching} watching`}
          >
            <Eye className="h-3.5 w-3.5" aria-hidden />
            {watching}
          </span>
        )}
        <ChatDrawerButton {...chatProps} open={drawerOpen} onOpenChange={setDrawerOpen} unread={unread} />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setColumnOpen((v) => !v)}
              aria-pressed={columnOpen}
              aria-label={columnOpen ? "Hide chat" : unread > 0 ? `Show chat, ${unread} unread` : "Show chat"}
              className="relative hidden lg:inline-flex"
            >
              {columnOpen ? (
                <PanelRightClose className="h-4 w-4" aria-hidden />
              ) : (
                <MessageSquare className="h-4 w-4" aria-hidden />
              )}
              {!columnOpen && unread > 0 && (
                <span
                  aria-hidden
                  className="numeric absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground"
                >
                  {formatUnread(unread)}
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{columnOpen ? "Hide chat" : "Show chat"}</TooltipContent>
        </Tooltip>
      </RoomTopBar>

      <div className="flex min-h-0 flex-1">
        <section
          aria-label={`${name} match`}
          className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain"
        >
          {gameState !== null && gameState !== undefined ? (
            // RoomGameSurface's root is auto-height. A view laid out in
            // percentages needs it stretched to this box to have a height to
            // fill; one that sizes itself from its content (chess) would be
            // clipped by the same stretch, so it only gets a floor.
            <div className={cn("h-full p-2 sm:p-4", FILLS_HEIGHT.has(gameId) ? "[&>*]:h-full" : "[&>*]:min-h-full")}>
              <RoomGameSurface
                gameId={gameId}
                gameState={gameState}
                players={room.players}
                currentUserId={currentUserId}
                lastResult={result}
                progression={progression}
                sendGameAction={onSendGameAction}
                onRematch={onRematch}
                rematchPending={rematchPending}
                rematchUnavailable={rematchUnavailable}
              />
            </div>
          ) : result ? (
            <div className="mx-auto max-w-3xl p-4">
              <RoomGameSurface
                gameId={gameId}
                gameState={null}
                players={room.players}
                currentUserId={currentUserId}
                lastResult={result}
                progression={progression}
                sendGameAction={onSendGameAction}
                onRematch={onRematch}
                rematchPending={rematchPending}
                rematchUnavailable={rematchUnavailable}
              />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary-accent motion-reduce:animate-none" aria-hidden />
              <p className="text-sm">Dealing the match…</p>
            </div>
          )}
        </section>

        <ChatColumn {...chatProps} className={cn(!columnOpen && "lg:hidden")} />
      </div>

      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        variant="destructive"
        title="Leave the match?"
        description="The match carries on without you, and leaving now counts as a loss."
        confirmLabel="Leave match"
        cancelLabel="Keep playing"
        onConfirm={onLeave}
      />
    </div>
  );
}
