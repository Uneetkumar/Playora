"use client";

import * as React from "react";
import { Chess, type Square } from "chess.js";

export type ChessPieceColor = "w" | "b";
export type ChessPieceType = "p" | "r" | "n" | "b" | "q" | "k";

export interface ChessPiece {
  type: ChessPieceType;
  color: ChessPieceColor;
}

interface ChessBoardProps {
  fen: string;
  myColor: "w" | "b" | "spectator";
  isMyTurn: boolean;
  inCheck: boolean;
  lastMove?: { from: string; to: string } | null;
  onMakeMove: (from: string, to: string, promotion?: "q" | "r" | "b" | "n") => void;
  disabled?: boolean;
}

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

// Clean SVG chess pieces for supreme visual quality across all devices
function renderPieceIcon(piece: ChessPiece) {
  const isWhite = piece.color === "w";
  const fill = isWhite ? "#ffffff" : "#1e293b";
  const stroke = isWhite ? "#334155" : "#94a3b8";

  switch (piece.type) {
    case "p":
      return (
        <svg viewBox="0 0 45 45" className="w-4/5 h-4/5 drop-shadow-md">
          <path
            d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "r":
      return (
        <svg viewBox="0 0 45 45" className="w-4/5 h-4/5 drop-shadow-md">
          <g fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 39h27v-3H9v3zm3-3v-4h21v4H12zm2-4V14h17v18H14z" />
            <path d="M14 14l3.5-4.5h10L31 14H14z" />
            <path d="M12 9.5h21v4.5H12V9.5z" />
            <path d="M11 9h3v3h-3V9zm7 0h3v3h-3V9zm7 0h3v3h-3V9zm7 0h3v3h-3V9z" />
          </g>
        </svg>
      );
    case "n":
      return (
        <svg viewBox="0 0 45 45" className="w-4/5 h-4/5 drop-shadow-md">
          <g fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" />
            <path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-4.04 2-5 2.1-3.4 8-4.5 11-8z" />
            <path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0z" />
            <path d="M15 15.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0z" />
          </g>
        </svg>
      );
    case "b":
      return (
        <svg viewBox="0 0 45 45" className="w-4/5 h-4/5 drop-shadow-md">
          <g fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z" />
            <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z" />
            <path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z" />
          </g>
        </svg>
      );
    case "q":
      return (
        <svg viewBox="0 0 45 45" className="w-4/5 h-4/5 drop-shadow-md">
          <g fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11-6-15-6 15-7-11 2 12z" />
            <path d="M9 26c0 2 1.5 2 2.5 4 2.5 5 1 5.5 11 5.5s8.5-.5 11-5.5c1-2 2.5-2 2.5-4H9z" />
            <path d="M11 38.5h23v-3H11v3z" />
            <circle cx="6" cy="12" r="2" />
            <circle cx="14" cy="9" r="2" />
            <circle cx="22.5" cy="8" r="2" />
            <circle cx="31" cy="9" r="2" />
            <circle cx="39" cy="12" r="2" />
          </g>
        </svg>
      );
    case "k":
      return (
        <svg viewBox="0 0 45 45" className="w-4/5 h-4/5 drop-shadow-md">
          <g fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22.5 11.63V6M20 8h5" />
            <path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" />
            <path d="M11.5 37c5.5 3.5 16.5 3.5 22 0V32H11.5v5z" />
            <path d="M11.5 30c5.5-3 16.5-3 22 0l2-8.5c-5.5-3-18.5-3-26 0l2 8.5z" />
          </g>
        </svg>
      );
  }
}

export function ChessBoard({
  fen,
  myColor,
  isMyTurn,
  inCheck,
  lastMove,
  onMakeMove,
  disabled = false,
}: ChessBoardProps) {
  const [selectedSquare, setSelectedSquare] = React.useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = React.useState<{ from: string; to: string } | null>(
    null
  );

  // Parse FEN into 8x8 Board representation
  const boardMatrix = React.useMemo(() => {
    const matrix: (ChessPiece | null)[][] = Array.from({ length: 8 }, () =>
      Array.from({ length: 8 }, () => null)
    );
    try {
      const parts = fen.split(" ");
      const rows = parts[0]?.split("/");
      if (rows && rows.length === 8) {
        for (let r = 0; r < 8; r++) {
          const rowStr = rows[r]!;
          let col = 0;
          for (let c = 0; c < rowStr.length; c++) {
            const char = rowStr[c]!;
            if (char >= "1" && char <= "8") {
              col += parseInt(char, 10);
            } else {
              const color: ChessPieceColor = char === char.toUpperCase() ? "w" : "b";
              const type: ChessPieceType = char.toLowerCase() as ChessPieceType;
              if (col < 8) {
                matrix[r]![col] = { type, color };
              }
              col++;
            }
          }
        }
      }
    } catch (err) {
      console.warn("Error parsing FEN:", err);
    }
    return matrix;
  }, [fen]);

  // Compute legal moves from current selected square using chess.js client preview
  const legalDestinations = React.useMemo(() => {
    if (!selectedSquare || !isMyTurn || disabled) return new Set<string>();
    try {
      const chess = new Chess(fen);
      const moves = chess.moves({ square: selectedSquare as Square, verbose: true });
      return new Set(moves.map((m) => m.to));
    } catch {
      return new Set<string>();
    }
  }, [selectedSquare, fen, isMyTurn, disabled]);

  const displayedRanks = myColor === "b" ? [...RANKS].reverse() : RANKS;
  const displayedFiles = myColor === "b" ? [...FILES].reverse() : FILES;

  const handleSquareClick = (square: string, piece: ChessPiece | null) => {
    if (disabled) return;

    // 1. If we clicked a legal target destination for an already selected piece:
    if (selectedSquare && legalDestinations.has(square)) {
      const fromPiece = getPieceAtSquare(selectedSquare);
      // Check if pawn promotion
      const isPawn = fromPiece?.type === "p";
      const isPromotionRank = square.endsWith("8") || square.endsWith("1");

      if (isPawn && isPromotionRank) {
        setPendingPromotion({ from: selectedSquare, to: square });
      } else {
        onMakeMove(selectedSquare, square);
        setSelectedSquare(null);
      }
      return;
    }

    // 2. If clicking a piece of our color on our turn:
    if (isMyTurn && piece && piece.color === myColor) {
      if (selectedSquare === square) {
        setSelectedSquare(null); // toggle off
      } else {
        setSelectedSquare(square);
      }
      return;
    }

    // 3. Otherwise deselect
    setSelectedSquare(null);
  };

  const getPieceAtSquare = (sq: string): ChessPiece | null => {
    const fileIndex = FILES.indexOf(sq[0]!);
    const rankIndex = 8 - parseInt(sq[1]!, 10);
    return boardMatrix[rankIndex]?.[fileIndex] ?? null;
  };

  const executePromotion = (pieceType: "q" | "r" | "b" | "n") => {
    if (pendingPromotion) {
      onMakeMove(pendingPromotion.from, pendingPromotion.to, pieceType);
      setPendingPromotion(null);
      setSelectedSquare(null);
    }
  };

  return (
    <div className="relative flex flex-col items-center select-none">
      {/* Promotion Picker Modal */}
      {pendingPromotion && (
        <div className="absolute inset-0 z-30 bg-slate-950/80 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-2xl text-center space-y-4 max-w-xs">
            <h4 className="text-sm font-bold text-slate-100">Promote Pawn</h4>
            <p className="text-xs text-slate-400">Choose a piece to promote your pawn into:</p>
            <div className="grid grid-cols-4 gap-2">
              {(["q", "r", "b", "n"] as const).map((pType) => (
                <button
                  key={pType}
                  type="button"
                  onClick={() => executePromotion(pType)}
                  className="h-14 rounded-lg bg-slate-800 hover:bg-indigo-600/40 border border-slate-700 hover:border-indigo-500 flex items-center justify-center p-2 transition-all transform hover:scale-105"
                >
                  {renderPieceIcon({ type: pType, color: myColor === "b" ? "b" : "w" })}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main 8x8 Board Grid */}
      <div className="relative w-full max-w-[500px] aspect-square rounded-xl overflow-hidden shadow-2xl border-4 border-slate-800 bg-[#0f172a]">
        <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
          {displayedRanks.map((rank, rankIdx) =>
            displayedFiles.map((file, fileIdx) => {
              const square = `${file}${rank}`;
              const origFileIdx = FILES.indexOf(file);
              const origRankIdx = 8 - parseInt(rank, 10);
              const piece = boardMatrix[origRankIdx]?.[origFileIdx] ?? null;

              const isLight = (origFileIdx + origRankIdx) % 2 === 0;
              const isSelected = selectedSquare === square;
              const isLegalTarget = legalDestinations.has(square);
              const isLastMoveSquare =
                lastMove && (lastMove.from === square || lastMove.to === square);
              const isKingInCheck =
                inCheck && piece?.type === "k" && piece.color === (myColor === "spectator" ? "w" : myColor);

              return (
                <div
                  key={square}
                  onClick={() => handleSquareClick(square, piece)}
                  className={`relative flex items-center justify-center cursor-pointer transition-all duration-150 ${
                    isLight ? "bg-[#2a374a]" : "bg-[#182333]"
                  } ${
                    isSelected
                      ? "ring-4 ring-indigo-500 ring-inset z-10 bg-indigo-900/40"
                      : isLastMoveSquare
                      ? "bg-amber-500/20"
                      : ""
                  } ${isKingInCheck ? "ring-4 ring-red-500 ring-inset bg-red-900/40" : ""}`}
                >
                  {/* File & Rank Coordinates for corner squares */}
                  {fileIdx === 0 && (
                    <span className="absolute top-0.5 left-1 text-[9px] font-bold opacity-40 text-slate-300">
                      {rank}
                    </span>
                  )}
                  {rankIdx === 7 && (
                    <span className="absolute bottom-0.5 right-1 text-[9px] font-bold opacity-40 text-slate-300">
                      {file}
                    </span>
                  )}

                  {/* Piece Graphic */}
                  {piece && (
                    <div className="w-full h-full flex items-center justify-center transform transition-transform hover:scale-105 pointer-events-none">
                      {renderPieceIcon(piece)}
                    </div>
                  )}

                  {/* Legal Move Indicators */}
                  {isLegalTarget && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                      {piece ? (
                        <div className="w-4/5 h-4/5 rounded-full border-4 border-indigo-400/80 animate-pulse" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full bg-indigo-400/80 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
