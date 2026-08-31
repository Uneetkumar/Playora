"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Chess, type Square } from "chess.js";
import { cn } from "@playora/ui";
import { ChessPiece, describePiece, type PieceSetId, type PieceType } from "./pieces";
import { themeById, type BoardTheme } from "./board-themes";

export type ChessPieceColor = "w" | "b";
export type ChessPieceType = PieceType;

interface ChessBoardProps {
  fen: string;
  myColor: "w" | "b" | "spectator";
  isMyTurn: boolean;
  inCheck: boolean;
  lastMove?: { from: string; to: string } | null;
  onMakeMove: (from: string, to: string, promotion?: "q" | "r" | "b" | "n") => void;
  disabled?: boolean;
  themeId?: string;
  /** Gameplay preferences that change what the board shows or asks. */
  showLegalMoves?: boolean;
  highlightLastMove?: boolean;
  autoQueen?: boolean;
  pieceSet?: PieceSetId;
  /** Force orientation regardless of colour, for pass-and-play or spectating. */
  flipped?: boolean;
}

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;

/**
 * The board.
 *
 * Three things make a chess board readable, and all three are easy to omit:
 * you must be able to see the move that was just played, the moves you can
 * make, and whether your king is in trouble. Everything below serves those.
 */
export function ChessBoard({
  fen,
  myColor,
  isMyTurn,
  inCheck,
  lastMove,
  onMakeMove,
  disabled,
  themeId,
  pieceSet = "classic",
  flipped,
  showLegalMoves = true,
  highlightLastMove = true,
  autoQueen = false,
}: ChessBoardProps) {
  const theme: BoardTheme = themeById(themeId ?? "midnight");
  const [selected, setSelected] = React.useState<Square | null>(null);
  const [promotion, setPromotion] = React.useState<{ from: Square; to: Square } | null>(null);

  const chess = React.useMemo(() => new Chess(fen), [fen]);
  const board = chess.board();

  // Black sees the board from their own side, as at a real table.
  const orientBlack = flipped ?? myColor === "b";
  const files = orientBlack ? [...FILES].reverse() : FILES;
  const ranks = orientBlack ? [...RANKS].reverse() : RANKS;

  const canInteract = !disabled && isMyTurn && myColor !== "spectator";

  // Destinations for the selected piece, split so captures can be marked
  // differently — a dot and a ring mean different things to a player.
  const targets = React.useMemo(() => {
    if (!selected) return { moves: new Set<string>(), captures: new Set<string>() };
    const moves = new Set<string>();
    const captures = new Set<string>();
    for (const m of chess.moves({ square: selected, verbose: true })) {
      if (m.captured) captures.add(m.to);
      else moves.add(m.to);
    }
    return { moves, captures };
  }, [chess, selected]);

  const kingSquare = React.useMemo(() => {
    if (!inCheck) return null;
    const turn = chess.turn();
    for (const row of board) {
      for (const sq of row) {
        if (sq && sq.type === "k" && sq.color === turn) return sq.square;
      }
    }
    return null;
  }, [board, chess, inCheck]);

  const attempt = (from: Square, to: Square) => {
    const move = chess
      .moves({ square: from, verbose: true })
      .find((m) => m.to === to);
    if (!move) return;

    // Promotion is a decision, not a default — ask rather than assuming a queen.
    if (move.promotion) {
      // With auto-queen on, the picker is skipped entirely: it is the choice
      // in well over ninety per cent of promotions and the dialog is friction.
      if (autoQueen) {
        onMakeMove(from, to, "q");
        setSelected(null);
        return;
      }
      setPromotion({ from, to });
      return;
    }
    onMakeMove(from, to);
    setSelected(null);
  };

  const onSquare = (square: Square) => {
    if (!canInteract) return;
    const piece = chess.get(square);

    if (selected) {
      if (square === selected) {
        setSelected(null);
        return;
      }
      if (targets.moves.has(square) || targets.captures.has(square)) {
        attempt(selected, square);
        return;
      }
    }
    // Selecting is only meaningful for your own pieces.
    if (piece && piece.color === myColor) setSelected(square);
    else setSelected(null);
  };

  return (
    <div className="w-full flex justify-center">
      <div
        className="relative mx-auto aspect-square w-[min(94vw,calc(100dvh-270px),620px)] overflow-hidden rounded-2xl shadow-2xl border-2 sm:border-4 border-[#1E2333]"
        role="grid"
        aria-label="Chess board"
      >
        <div className="grid h-full w-full grid-cols-8 grid-rows-8">
          {ranks.map((rank, r) =>
            files.map((file, f) => {
              const square = `${file}${rank}` as Square;
              const isLight = (r + f) % 2 === 0;
              const piece = chess.get(square);

              const isSelected = selected === square;
              const isLast =
                highlightLastMove && (lastMove?.from === square || lastMove?.to === square);
              const isTarget = showLegalMoves && targets.moves.has(square);
              const isCapture = showLegalMoves && targets.captures.has(square);
              const isCheck = kingSquare === square;

              // Coordinates only on the outer edge, as on a real board.
              const showFile = r === 7;
              const showRank = f === 0;

              return (
                <button
                  key={square}
                  type="button"
                  role="gridcell"
                  onClick={() => onSquare(square)}
                  disabled={!canInteract}
                  aria-label={
                    piece
                      ? `${square}, ${describePiece(piece.type, piece.color)}`
                      : `${square}, empty`
                  }
                  className={cn(
                    "relative flex items-center justify-center focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white",
                    canInteract ? "cursor-pointer" : "cursor-default",
                  )}
                  style={{ background: isLight ? theme.light : theme.dark }}
                >
                  {/* Last move, so you can always see what just happened. */}
                  {isLast && (
                    <span className="absolute inset-0" style={{ background: theme.lastMove }} aria-hidden />
                  )}
                  {isSelected && (
                    <span className="absolute inset-0" style={{ background: theme.selected }} aria-hidden />
                  )}
                  {isCheck && (
                    <span
                      className="absolute inset-0"
                      style={{ background: `radial-gradient(circle, ${theme.check} 10%, transparent 72%)` }}
                      aria-hidden
                    />
                  )}

                  {showFile && (
                    <span
                      className="pointer-events-none absolute bottom-0.5 right-1 text-[9px] font-bold sm:text-[10px]"
                      style={{ color: isLight ? theme.coordLight : theme.coordDark }}
                      aria-hidden
                    >
                      {file}
                    </span>
                  )}
                  {showRank && (
                    <span
                      className="pointer-events-none absolute left-1 top-0.5 text-[9px] font-bold sm:text-[10px]"
                      style={{ color: isLight ? theme.coordLight : theme.coordDark }}
                      aria-hidden
                    >
                      {rank}
                    </span>
                  )}

                  {piece && (
                    <motion.span
                      // Keyed by square so a moving piece slides rather than
                      // vanishing and reappearing.
                      layoutId={`piece-${piece.color}${piece.type}-${square}`}
                      initial={false}
                      animate={{ scale: 1 }}
                      whileTap={canInteract && piece.color === myColor ? { scale: 0.92 } : undefined}
                      transition={{ type: "spring", stiffness: 500, damping: 34 }}
                      className="relative z-[1] flex h-[86%] w-[86%] items-center justify-center"
                    >
                      <ChessPiece type={piece.type} color={piece.color} set={pieceSet} />
                    </motion.span>
                  )}

                  {/* A dot for a quiet move, a ring for a capture. */}
                  {isTarget && !piece && (
                    <span
                      className="pointer-events-none absolute h-[28%] w-[28%] rounded-full"
                      style={{ background: theme.legal }}
                      aria-hidden
                    />
                  )}
                  {isCapture && (
                    <span
                      className="pointer-events-none absolute inset-[6%] rounded-full border-[3px]"
                      style={{ borderColor: theme.capture }}
                      aria-hidden
                    />
                  )}
                </button>
              );
            }),
          )}
        </div>
      </div>

      {/* Promotion picker */}
      {promotion && (
        <div
          role="dialog"
          aria-label="Choose a promotion piece"
          className="mx-auto mt-3 max-w-xs rounded-xl border border-border bg-card p-4 text-center"
        >
          <p className="font-display text-sm font-bold text-foreground">Promote to</p>
          <div className="mt-3 flex justify-center gap-2">
            {(["q", "r", "b", "n"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  onMakeMove(promotion.from, promotion.to, t);
                  setPromotion(null);
                  setSelected(null);
                }}
                aria-label={describePiece(t, myColor === "b" ? "b" : "w")}
                className="flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-muted/40 transition-colors hover:border-primary"
                style={{ background: theme.dark }}
              >
                <ChessPiece type={t} color={myColor === "b" ? "b" : "w"} set={pieceSet} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
