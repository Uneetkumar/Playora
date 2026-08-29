"use client";

import * as React from "react";
import { ChessBoard } from "./ChessBoard";
import type { ChessPlayerView } from "@playora/game-engine";
import type { GameResult, Player } from "@playora/game-types";
import { Button, Card, CardHeader, CardTitle, CardContent, Badge, Dialog } from "@playora/ui";
import {
  Timer,
  Flag,
  Handshake,
  RotateCcw,
  Trophy,
  XCircle,
} from "lucide-react";

interface ChessGameViewProps {
  gameState: ChessPlayerView;
  players: Record<string, Player>;
  currentUserId: string;
  lastResult?: GameResult | null;
  onMakeMove: (from: string, to: string, promotion?: "q" | "r" | "b" | "n") => void;
  onResign: () => void;
  onOfferDraw: () => void;
  onAcceptDraw: () => void;
  onDeclineDraw: () => void;
  onRematch?: () => void;
}

function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

export function ChessGameView({
  gameState,
  players,
  currentUserId,
  onMakeMove,
  onResign,
  onOfferDraw,
  onAcceptDraw,
  onDeclineDraw,
  onRematch,
}: ChessGameViewProps) {
  const [showResignConfirm, setShowResignConfirm] = React.useState(false);

  // Local clock ticking
  const [whiteRemaining, setWhiteRemaining] = React.useState(gameState.clocks.white);
  const [blackRemaining, setBlackRemaining] = React.useState(gameState.clocks.black);

  // Synchronize when gameState updates
  React.useEffect(() => {
    setWhiteRemaining(gameState.clocks.white);
    setBlackRemaining(gameState.clocks.black);
  }, [gameState.clocks, gameState.updatedAt]);

  // Local ticker every 200ms
  React.useEffect(() => {
    if (gameState.isFinished) return;

    const interval = setInterval(() => {
      if (gameState.turnColor === "w") {
        setWhiteRemaining((prev) => Math.max(0, prev - 200));
      } else {
        setBlackRemaining((prev) => Math.max(0, prev - 200));
      }
    }, 200);

    return () => clearInterval(interval);
  }, [gameState.turnColor, gameState.isFinished]);

  const whitePlayer = players[gameState.whitePlayerId];
  const blackPlayer = players[gameState.blackPlayerId];

  const isWhite = currentUserId === gameState.whitePlayerId;
  const isBlack = currentUserId === gameState.blackPlayerId;
  const myColor = gameState.myColor;

  const topPlayer = myColor === "b" ? whitePlayer : blackPlayer;
  const bottomPlayer = myColor === "b" ? blackPlayer : whitePlayer;

  const topRemaining = myColor === "b" ? whiteRemaining : blackRemaining;
  const bottomRemaining = myColor === "b" ? blackRemaining : whiteRemaining;

  const topColor = myColor === "b" ? "White" : "Black";
  const bottomColor = myColor === "b" ? "Black" : "White";

  const isTopActive =
    (myColor === "b" && gameState.turnColor === "w") ||
    (myColor !== "b" && gameState.turnColor === "b");
  const isBottomActive =
    (myColor === "b" && gameState.turnColor === "b") ||
    (myColor !== "b" && gameState.turnColor === "w");

  const lastMove =
    gameState.history.length > 0
      ? {
          from: gameState.history[gameState.history.length - 1]!.from,
          to: gameState.history[gameState.history.length - 1]!.to,
        }
      : null;

  const hasDrawOfferFromOpponent =
    gameState.drawOfferFromPlayerId && gameState.drawOfferFromPlayerId !== currentUserId;
  const hasDrawOfferFromMe = gameState.drawOfferFromPlayerId === currentUserId;

  return (
    <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6 w-full max-w-6xl mx-auto p-2 sm:p-4">
      {/* Resign Confirm Dialog */}
      <Dialog
        isOpen={showResignConfirm}
        onClose={() => setShowResignConfirm(false)}
        title="Confirm Resignation"
        description="Are you sure you want to resign this match? Your opponent will win."
      >
        <div className="flex justify-end space-x-3 pt-4 border-t border-border">
          <Button variant="ghost" onClick={() => setShowResignConfirm(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              setShowResignConfirm(false);
              onResign();
            }}
          >
            Resign Match
          </Button>
        </div>
      </Dialog>

      {/* Main Board Column */}
      <div className="flex flex-col items-center w-full max-w-[500px] space-y-3">
        {/* Draw Offer Notification Banner */}
        {hasDrawOfferFromOpponent && !gameState.isFinished && (
          <div className="w-full bg-primary/10/80 border border-primary/50 p-3 rounded-xl flex items-center justify-between shadow-lg">
            <div className="flex items-center space-x-2">
              <Handshake className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-primary">
                Opponent offered a draw.
              </span>
            </div>
            <div className="flex space-x-2">
              <Button size="sm" onClick={onAcceptDraw} className="h-7 text-xs bg-primary">
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onDeclineDraw}
                className="h-7 text-xs"
              >
                Decline
              </Button>
            </div>
          </div>
        )}

        {hasDrawOfferFromMe && !gameState.isFinished && (
          <div className="w-full bg-card border border-border p-2.5 rounded-xl text-center text-xs text-muted-foreground">
            Draw offer sent. Waiting for opponent...
          </div>
        )}

        {/* Top Player Card */}
        <div
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all ${
            isTopActive && !gameState.isFinished
              ? "bg-card/90 border-primary/80 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
              : "bg-background/60 border-border"
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-lg bg-border border border-border flex items-center justify-center font-bold text-sm text-foreground">
                {topPlayer?.displayName?.slice(0, 2).toUpperCase() || "??"}
              </div>
              <span
                className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-card ${
                  topColor === "White" ? "bg-white" : "bg-border"
                }`}
              />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-foreground">
                  {topPlayer?.displayName || "Opponent"}
                </span>
                <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                  {topColor}
                </Badge>
              </div>
              <div className="flex gap-1 text-[10px] text-muted-foreground mt-0.5">
                {(myColor === "b" ? gameState.capturedPieces.black : gameState.capturedPieces.white)
                  .slice(-8)
                  .map((p, idx) => (
                    <span key={idx} className="uppercase font-mono">
                      {p}
                    </span>
                  ))}
              </div>
            </div>
          </div>

          <div
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-mono text-sm font-bold ${
              isTopActive && !gameState.isFinished
                ? "bg-primary text-white shadow"
                : "bg-card text-foreground border border-border"
            }`}
          >
            <Timer className="h-3.5 w-3.5" />
            <span>{formatClock(topRemaining)}</span>
          </div>
        </div>

        {/* The Chess Board */}
        <ChessBoard
          fen={gameState.fen}
          myColor={myColor}
          isMyTurn={gameState.isMyTurn}
          inCheck={gameState.inCheck}
          lastMove={lastMove}
          onMakeMove={onMakeMove}
          disabled={gameState.isFinished || myColor === "spectator"}
        />

        {/* Bottom Player Card */}
        <div
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all ${
            isBottomActive && !gameState.isFinished
              ? "bg-card/90 border-primary/80 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
              : "bg-background/60 border-border"
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-lg bg-border border border-border flex items-center justify-center font-bold text-sm text-primary">
                {bottomPlayer?.displayName?.slice(0, 2).toUpperCase() || "ME"}
              </div>
              <span
                className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-card ${
                  bottomColor === "White" ? "bg-white" : "bg-border"
                }`}
              />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-foreground">
                  {bottomPlayer?.displayName || "You"}
                </span>
                <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                  {bottomColor}
                </Badge>
              </div>
              <div className="flex gap-1 text-[10px] text-muted-foreground mt-0.5">
                {(myColor === "b" ? gameState.capturedPieces.white : gameState.capturedPieces.black)
                  .slice(-8)
                  .map((p, idx) => (
                    <span key={idx} className="uppercase font-mono">
                      {p}
                    </span>
                  ))}
              </div>
            </div>
          </div>

          <div
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-mono text-sm font-bold ${
              isBottomActive && !gameState.isFinished
                ? "bg-primary text-white shadow"
                : "bg-card text-foreground border border-border"
            }`}
          >
            <Timer className="h-3.5 w-3.5" />
            <span>{formatClock(bottomRemaining)}</span>
          </div>
        </div>

        {/* Action Controls Bar */}
        {(isWhite || isBlack) && !gameState.isFinished && (
          <div className="w-full flex items-center justify-between gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onOfferDraw}
              disabled={hasDrawOfferFromMe}
              className="flex-1 gap-1.5 text-xs text-foreground hover:text-white"
            >
              <Handshake className="h-3.5 w-3.5" />
              <span>{hasDrawOfferFromMe ? "Draw Offered" : "Offer Draw"}</span>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowResignConfirm(true)}
              className="flex-1 gap-1.5 text-xs"
            >
              <Flag className="h-3.5 w-3.5" />
              <span>Resign</span>
            </Button>
          </div>
        )}
      </div>

      {/* Move History & Match Information Sidebar */}
      <Card className="w-full lg:w-80 bg-card/60 border-border backdrop-blur-md">
        <CardHeader className="py-3 px-4 border-b border-border">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span>Move History</span>
            <Badge variant="outline" className="text-[10px]">
              Turn {gameState.history.length + 1}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="max-h-[320px] overflow-y-auto space-y-1 text-xs">
            {gameState.history.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">Game in progress. White to move.</p>
            ) : (
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono">
                {Array.from({ length: Math.ceil(gameState.history.length / 2) }).map((_, idx) => {
                  const whiteMove = gameState.history[idx * 2];
                  const blackMove = gameState.history[idx * 2 + 1];

                  return (
                    <React.Fragment key={idx}>
                      <div className="flex items-center space-x-1.5 bg-background/40 px-2 py-1 rounded">
                        <span className="text-muted-foreground text-[10px] w-4">{idx + 1}.</span>
                        <span className="text-foreground font-semibold">{whiteMove?.san}</span>
                      </div>
                      <div className="flex items-center space-x-1.5 bg-background/40 px-2 py-1 rounded">
                        {blackMove ? (
                          <>
                            <span className="text-muted-foreground text-[10px] w-4">{idx + 1}...</span>
                            <span className="text-foreground">{blackMove.san}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">...</span>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Game Over Modal */}
      {gameState.isFinished && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full text-center space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-center">
              {gameState.isDraw ? (
                <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Handshake className="h-8 w-8" />
                </div>
              ) : gameState.winnerId === currentUserId ? (
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Trophy className="h-8 w-8 animate-bounce" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <XCircle className="h-8 w-8" />
                </div>
              )}
            </div>

            <div>
              <h3 className="text-2xl font-extrabold text-white">
                {gameState.isDraw
                  ? "Match Drawn"
                  : gameState.winnerId === currentUserId
                  ? "Victory!"
                  : "Defeat"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 capitalize">
                {gameState.drawReason
                  ? `Draw by ${gameState.drawReason.replace("_", " ")}`
                  : gameState.phase === "resigned"
                  ? "Opponent resigned"
                  : gameState.phase === "timeout"
                  ? "Won on time"
                  : "Checkmate"}
              </p>
            </div>

            <div className="bg-background/60 rounded-xl p-3 text-xs text-foreground space-y-1.5 border border-border">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Moves:</span>
                <span className="font-semibold">{gameState.history.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Winner:</span>
                <span className="font-semibold text-primary">
                  {gameState.winnerId
                    ? players[gameState.winnerId]?.displayName || "Winner"
                    : "None (Draw)"}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <Button onClick={onRematch} className="w-full gap-2 shadow-primary/30">
                <RotateCcw className="h-4 w-4" />
                <span>Return to Lobby</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
