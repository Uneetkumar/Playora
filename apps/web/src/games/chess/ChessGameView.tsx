"use client";

import * as React from "react";
import { ChessBoard } from "./ChessBoard";
import { BoardSettings } from "./BoardSettings";
import { useBoardPrefs } from "./use-board-prefs";
import type { ChessPlayerView } from "@playora/game-engine";
import { useAudio } from "../../lib/audio/use-audio";
import { useGameplayStore } from "../../lib/store/gameplay-store";
import type { GameResult, Player } from "@playora/game-types";
import { Button, Card, CardHeader, CardTitle, CardContent, Badge, Dialog } from "@playora/ui";
import {
  Timer,
  Flag,
  Handshake,
  RotateCcw,
  Trophy,
  XCircle,
  Bot,
  User,
} from "lucide-react";
import { ChessPiece, type PieceType } from "./pieces";
import { PIECE_VALUE } from "./board-themes";

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
  const boardPrefs = useBoardPrefs();
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
  const topColorCode = myColor === "b" ? "w" : "b";
  const bottomColorCode = myColor === "b" ? "b" : "w";

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

  const play = useAudio();
  const gameplay = useGameplayStore((s) => s.prefs);
  const hydrateGameplay = useGameplayStore((s) => s.hydrate);
  React.useEffect(() => {
    hydrateGameplay();
  }, [hydrateGameplay]);

  const previousMoveCount = React.useRef(gameState.history.length);
  React.useEffect(() => {
    const current = gameState.history.length;
    if (current > previousMoveCount.current) {
      if (gameState.inCheck) {
        play("chess.check");
      } else {
        play("chess.move");
      }
    }
    previousMoveCount.current = current;
  }, [gameState.history.length, gameState.inCheck, play]);

  // Calculate material advantages
  const capturedByWhite = gameState.capturedPieces.black;
  const capturedByBlack = gameState.capturedPieces.white;

  const whiteMaterial = capturedByWhite.reduce((sum, p) => sum + (PIECE_VALUE[p.toLowerCase()] || 0), 0);
  const blackMaterial = capturedByBlack.reduce((sum, p) => sum + (PIECE_VALUE[p.toLowerCase()] || 0), 0);

  const whiteAdvantage = Math.max(0, whiteMaterial - blackMaterial);
  const blackAdvantage = Math.max(0, blackMaterial - whiteMaterial);

  const topCaptured = myColor === "b" ? capturedByWhite : capturedByBlack;
  const bottomCaptured = myColor === "b" ? capturedByBlack : capturedByWhite;
  const topAdvantage = myColor === "b" ? whiteAdvantage : blackAdvantage;
  const bottomAdvantage = myColor === "b" ? blackAdvantage : whiteAdvantage;

  const hasDrawOfferFromOpponent =
    (isWhite && gameState.drawOfferFromPlayerId === gameState.blackPlayerId) ||
    (isBlack && gameState.drawOfferFromPlayerId === gameState.whitePlayerId);

  const hasDrawOfferFromMe =
    (isWhite && gameState.drawOfferFromPlayerId === gameState.whitePlayerId) ||
    (isBlack && gameState.drawOfferFromPlayerId === gameState.blackPlayerId);

  return (
    <div className="relative flex flex-1 w-full h-full flex-col lg:flex-row items-center justify-center p-3 sm:p-5 gap-4 lg:gap-8 overflow-y-auto lg:overflow-hidden">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* LEFT / CENTER ARENA (Player Pods & Board) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center w-full max-w-[min(92vw,calc(100vh-190px),660px)] gap-2 shrink-0">
        {/* Draw Offer Notification Banner */}
        {hasDrawOfferFromOpponent && !gameState.isFinished && (
          <div className="w-full flex items-center justify-between rounded-xl border border-primary/40 bg-[#16132A] p-3 shadow-lg animate-pulse">
            <div className="flex items-center gap-2">
              <Handshake className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold text-white">
                Opponent offered a draw
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={onAcceptDraw} className="h-7 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500">
                Accept Draw
              </Button>
              <Button size="sm" variant="outline" onClick={onDeclineDraw} className="h-7 text-xs">
                Decline
              </Button>
            </div>
          </div>
        )}

        {/* Top Player Pod */}
        <div
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl border transition-all ${
            isTopActive && !gameState.isFinished
              ? "bg-[#16192E] border-[#7C3AED]/70 shadow-[0_0_20px_rgba(124,58,237,0.25)] ring-1 ring-[#7C3AED]/40"
              : "bg-[#0F111E]/90 border-white/5 shadow-sm"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center font-bold text-sm text-white shadow-inner">
                {topPlayer?.isBot ? (
                  <Bot className="h-4 w-4 text-[#A855F7]" />
                ) : (
                  <User className="h-4 w-4 text-white/80" />
                )}
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0F111E] ${
                  topColor === "White" ? "bg-white" : "bg-[#1E1E24]"
                }`}
              />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-black text-white">
                  {topPlayer?.displayName || "Opponent"}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-0.2 text-[9px] font-bold text-white/70">
                  {topColor}
                </span>
                {topAdvantage > 0 && (
                  <span className="rounded-md bg-yellow-400/20 px-1.5 py-0.2 text-[9px] font-black text-yellow-300">
                    +{topAdvantage}
                  </span>
                )}
              </div>

              {/* Captured piece tray */}
              <div className="flex items-center gap-0.5 mt-0.5 min-h-[16px]">
                {topCaptured.map((p, idx) => (
                  <span key={idx} className="h-3.5 w-3.5 inline-block opacity-80">
                    <ChessPiece
                      type={p.toLowerCase() as PieceType}
                      color={topColorCode === "w" ? "b" : "w"}
                      set={boardPrefs.pieceSet}
                    />
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Clock */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs sm:text-sm font-black tracking-wider transition-colors ${
              isTopActive && !gameState.isFinished
                ? "bg-[#6D28D9] text-white shadow-lg scale-105"
                : "bg-white/5 text-white/70 border border-white/5"
            }`}
          >
            <Timer className="h-3.5 w-3.5" />
            <span>{formatClock(topRemaining)}</span>
          </div>
        </div>

        {/* Board Bar: Settings & Controls */}
        <div className="flex w-full items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider font-mono">
              Turn {Math.floor(gameState.history.length / 2) + 1}
            </span>
            {gameState.inCheck && (
              <span className="rounded-md bg-rose-500/20 px-2 py-0.5 text-[9px] font-black text-rose-400 border border-rose-500/40 animate-pulse">
                CHECK
              </span>
            )}
          </div>

          <BoardSettings
            themeId={boardPrefs.themeId}
            pieceSet={boardPrefs.pieceSet}
            onChooseTheme={boardPrefs.chooseTheme}
            onChoosePieceSet={boardPrefs.choosePieceSet}
            onFlip={boardPrefs.toggleFlip}
          />
        </div>

        {/* The Chess Board */}
        <div className="w-full flex justify-center">
          <ChessBoard
            fen={gameState.fen}
            myColor={myColor}
            isMyTurn={gameState.isMyTurn}
            inCheck={gameState.inCheck}
            lastMove={lastMove}
            onMakeMove={onMakeMove}
            disabled={gameState.isFinished || myColor === "spectator"}
            themeId={boardPrefs.themeId}
            pieceSet={boardPrefs.pieceSet}
            flipped={boardPrefs.flipped}
            showLegalMoves={gameplay.showLegalMoves}
            highlightLastMove={gameplay.highlightLastMove}
            autoQueen={gameplay.autoQueen}
          />
        </div>

        {/* Bottom Player Pod */}
        <div
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl border transition-all ${
            isBottomActive && !gameState.isFinished
              ? "bg-[#16192E] border-[#7C3AED]/70 shadow-[0_0_20px_rgba(124,58,237,0.25)] ring-1 ring-[#7C3AED]/40"
              : "bg-[#0F111E]/90 border-white/5 shadow-sm"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-[#7C3AED]/20 border border-[#7C3AED]/30 flex items-center justify-center font-bold text-sm text-[#A855F7] shadow-inner">
                {bottomPlayer?.isBot ? (
                  <Bot className="h-4 w-4" />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0F111E] ${
                  bottomColor === "White" ? "bg-white" : "bg-[#1E1E24]"
                }`}
              />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-black text-white">
                  {bottomPlayer?.displayName || "You"}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-0.2 text-[9px] font-bold text-white/70">
                  {bottomColor}
                </span>
                {bottomAdvantage > 0 && (
                  <span className="rounded-md bg-yellow-400/20 px-1.5 py-0.2 text-[9px] font-black text-yellow-300">
                    +{bottomAdvantage}
                  </span>
                )}
              </div>

              {/* Captured piece tray */}
              <div className="flex items-center gap-0.5 mt-0.5 min-h-[16px]">
                {bottomCaptured.map((p, idx) => (
                  <span key={idx} className="h-3.5 w-3.5 inline-block opacity-80">
                    <ChessPiece
                      type={p.toLowerCase() as PieceType}
                      color={bottomColorCode === "w" ? "b" : "w"}
                      set={boardPrefs.pieceSet}
                    />
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Clock */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs sm:text-sm font-black tracking-wider transition-colors ${
              isBottomActive && !gameState.isFinished
                ? "bg-[#6D28D9] text-white shadow-lg scale-105"
                : "bg-white/5 text-white/70 border border-white/5"
            }`}
          >
            <Timer className="h-3.5 w-3.5" />
            <span>{formatClock(bottomRemaining)}</span>
          </div>
        </div>

        {/* Action Controls Bar */}
        {(isWhite || isBlack) && !gameState.isFinished && (
          <div className="w-full flex items-center justify-between gap-2.5 pt-0.5">
            <Button
              variant="outline"
              size="sm"
              onClick={onOfferDraw}
              disabled={hasDrawOfferFromMe}
              className="flex-1 gap-1 text-xs font-semibold border-white/10 bg-white/5 text-white hover:bg-white/10 h-8"
            >
              <Handshake className="h-3.5 w-3.5 text-[#A855F7]" />
              <span>{hasDrawOfferFromMe ? "Draw Offered" : "Offer Draw"}</span>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowResignConfirm(true)}
              className="flex-1 gap-1 text-xs font-semibold h-8"
            >
              <Flag className="h-3.5 w-3.5" />
              <span>Resign</span>
            </Button>
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* RIGHT SIDEBAR (Move History & Match Summary) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="w-full max-w-[min(92vw,calc(100vh-190px),660px)] lg:w-80 xl:w-96 flex flex-col gap-3 shrink-0">
        <Card className="border-white/10 bg-[#0F111E]/90 backdrop-blur-md shadow-xl">
          <CardHeader className="py-2.5 px-4 border-b border-white/5 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
              Move History
            </CardTitle>
            <Badge variant="outline" className="text-[10px] border-white/10 text-white/60">
              {gameState.history.length} moves
            </Badge>
          </CardHeader>

          <CardContent className="p-3">
            {gameState.history.length === 0 ? (
              <p className="text-xs text-white/40 text-center py-6">
                Game in progress. White to move.
              </p>
            ) : (
              <div className="max-h-64 sm:max-h-80 overflow-y-auto space-y-1 pr-1 font-mono text-xs">
                {Array.from({ length: Math.ceil(gameState.history.length / 2) }).map((_, i) => {
                  const whiteMove = gameState.history[i * 2];
                  const blackMove = gameState.history[i * 2 + 1];
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between py-1 px-2 rounded hover:bg-white/5"
                    >
                      <span className="text-white/40 w-6 font-semibold">{i + 1}.</span>
                      <span className="text-white font-medium flex-1 text-center">
                        {whiteMove ? `${whiteMove.from} → ${whiteMove.to}` : ""}
                      </span>
                      <span className="text-white/80 font-medium flex-1 text-center">
                        {blackMove ? `${blackMove.from} → ${blackMove.to}` : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Finished State Summary */}
        {gameState.isFinished && (
          <Card className="border-primary/40 bg-[#16132A] p-4 text-center shadow-xl space-y-2.5">
            <Trophy className="h-7 w-7 text-yellow-400 mx-auto" />
            <div>
              <h3 className="font-display text-base font-black text-white">Game Over</h3>
              <p className="text-xs text-white/70 mt-0.5">
                {gameState.isCheckmate
                  ? `Checkmate! Winner: ${gameState.winnerId === gameState.whitePlayerId ? "White" : "Black"}`
                  : gameState.isDraw
                  ? `Draw (${gameState.drawReason || "agreement"})`
                  : "Match finished"}
              </p>
            </div>
            {onRematch && (
              <Button onClick={onRematch} className="w-full gap-2 font-bold bg-[#7C3AED] hover:bg-[#6D28D9] h-9 text-xs">
                <RotateCcw className="h-4 w-4" /> Rematch
              </Button>
            )}
          </Card>
        )}
      </div>

      {/* Resign Dialog */}
      <Dialog
        isOpen={showResignConfirm}
        onClose={() => setShowResignConfirm(false)}
        title="Resign Match?"
        description="Are you sure you want to resign this match? This will count as a defeat."
      >
        <div className="flex justify-end gap-2 pt-3">
          <Button variant="outline" size="sm" onClick={() => setShowResignConfirm(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              setShowResignConfirm(false);
              onResign();
            }}
          >
            <XCircle className="h-4 w-4 mr-1.5" />
            Confirm Resign
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
