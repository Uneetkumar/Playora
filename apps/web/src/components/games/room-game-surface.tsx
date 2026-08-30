"use client";

import * as React from "react";
import Link from "next/link";
import { buttonVariants, cn } from "@playora/ui";
import { gameEngineRegistry } from "@playora/game-engine";
import type { ChessPlayerView, UnoColor, UnoPlayerView } from "@playora/game-engine";
import type { GameId, GameResult, Player } from "@playora/game-types";
import type { PlayerProgressionPayload } from "@playora/protocol";
import { ChessGameView } from "../../games/chess/ChessGameView";
import { UnoGameView } from "../../games/uno/UnoGameView";
import { MatchResult } from "./match-result";

interface RoomGameSurfaceProps {
  gameId: GameId;
  gameState: unknown;
  players: Record<string, Player>;
  currentUserId: string;
  lastResult: GameResult | null;
  progression: Record<string, PlayerProgressionPayload> | null;
  sendGameAction: (type: string, payload: Record<string, unknown>) => void;
  onRematch: () => void;
  rematchPending?: boolean;
}

/**
 * Renders whichever game the room is actually running.
 *
 * The room page used to mount ChessGameView unconditionally, so an online UNO
 * room dealt real cards on the server and drew a chessboard for the players.
 * Every game a room can host has to be reachable from exactly one place, and
 * this is it.
 */
export function RoomGameSurface({
  gameId,
  gameState,
  players,
  currentUserId,
  lastResult,
  progression,
  sendGameAction,
  onRematch,
  rematchPending = false,
}: RoomGameSurfaceProps) {
  return (
    <div className="space-y-6">
      {/* The result screen owns the end of a match for every game, so no game
          view has to reimplement outcome, rating and rematch for itself. The
          final board stays visible underneath it — players want to look at the
          position they just lost. */}
      {lastResult && (
        <MatchResult
          result={lastResult}
          players={players}
          currentUserId={currentUserId}
          progression={progression}
          onRematch={onRematch}
          rematchPending={rematchPending}
          exitHref="/games"
        />
      )}
      {gameState !== null && gameState !== undefined && (
        <GameBoard
          gameId={gameId}
          gameState={gameState}
          players={players}
          currentUserId={currentUserId}
          sendGameAction={sendGameAction}
          onRematch={onRematch}
        />
      )}
    </div>
  );
}

type GameBoardProps = Pick<
  RoomGameSurfaceProps,
  "gameId" | "gameState" | "players" | "currentUserId" | "sendGameAction" | "onRematch"
>;

function GameBoard({
  gameId,
  gameState,
  players,
  currentUserId,
  sendGameAction,
  onRematch,
}: GameBoardProps) {
  switch (gameId) {
    case "chess":
      return (
        <ChessGameView
          gameState={gameState as ChessPlayerView}
          players={players}
          currentUserId={currentUserId}
          lastResult={null}
          onMakeMove={(from, to, promotion) => sendGameAction("MOVE", { from, to, promotion })}
          onResign={() => sendGameAction("RESIGN", {})}
          onOfferDraw={() => sendGameAction("OFFER_DRAW", {})}
          onAcceptDraw={() => sendGameAction("ACCEPT_DRAW", {})}
          onDeclineDraw={() => sendGameAction("DECLINE_DRAW", {})}
          onRematch={onRematch}
        />
      );

    case "uno":
    case "uno-no-mercy":
      return (
        <UnoGameView
          gameState={gameState as UnoPlayerView}
          players={players}
          currentUserId={currentUserId}
          lastResult={null}
          onPlayCard={(cardId, chosenColor?: UnoColor, declareUno?: boolean) =>
            sendGameAction("PLAY_CARD", {
              cardId,
              ...(chosenColor ? { chosenColor } : {}),
              ...(declareUno ? { declareUno } : {}),
            })
          }
          onDrawCard={() => sendGameAction("DRAW_CARD", {})}
          onPass={() => sendGameAction("PASS", {})}
          onRematch={onRematch}
        />
      );

    default:
      return <UnsupportedGame gameId={gameId} />;
  }
}

/**
 * Reached when a room exists for a game the client cannot draw yet.
 *
 * The server refuses to start a game it has no engine for, so this is the rarer
 * case of an engine existing without a board — it says so plainly rather than
 * showing an empty frame.
 */
function UnsupportedGame({ gameId }: { gameId: GameId }) {
  const hasEngine = gameEngineRegistry.has(gameId);
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border py-16 text-center">
      <p className="font-display text-lg font-bold text-foreground">
        {hasEngine ? "This board isn't built yet" : "This game isn't playable yet"}
      </p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {hasEngine
          ? `${gameId} runs on the server but has no screen to play it on. Nothing has been lost — the room is still here.`
          : `${gameId} is on the roadmap but has no rules engine yet.`}
      </p>
      <Link href="/games" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
        Browse games
      </Link>
    </div>
  );
}
