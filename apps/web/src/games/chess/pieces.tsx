"use client";

import * as React from "react";

/**
 * World-Class Vector SVG Chess Piece Sets.
 * High-precision vector graphics designed for crisp rendering at all sizes.
 */

export type PieceType = "k" | "q" | "r" | "b" | "n" | "p";
export type PieceColor = "w" | "b";

export const PIECE_SETS = [
  { id: "staunton", label: "Staunton", hint: "Official tournament standard" },
  { id: "neo", label: "Neo Pro", hint: "Crisp modern tournament set" },
  { id: "woodcraft", label: "Woodcraft 3D", hint: "Rich shaded wood & ivory" },
  { id: "neon", label: "Cyber Neon", hint: "Futuristic glowing glass" },
  { id: "classic", label: "Master", hint: "Clean FIDE style silhouettes" },
  { id: "minimal", label: "Minimalist", hint: "Modern geometric typography" },
] as const;

export type PieceSetId = (typeof PIECE_SETS)[number]["id"];

export const PIECE_NAMES: Record<PieceType, string> = {
  k: "King",
  q: "Queen",
  r: "Rook",
  b: "Bishop",
  n: "Knight",
  p: "Pawn",
};

export function describePiece(type: PieceType, color: PieceColor): string {
  return `${color === "w" ? "White" : "Black"} ${PIECE_NAMES[type]}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. STAUNTON / NEO SVG VECTOR PIECES (Tournament Standard 45x45)
// ─────────────────────────────────────────────────────────────────────────────
function StauntonPiece({ type, color }: { type: PieceType; color: PieceColor }) {
  const isWhite = color === "w";
  const body = isWhite ? "#FFFFFF" : "#1B1B22";
  const stroke = isWhite ? "#1A1A24" : "#000000";
  const line = isWhite ? "#1A1A24" : "#FFFFFF";
  const shade = isWhite ? "#E2E5EB" : "#111116";

  switch (type) {
    case "p":
      return (
        <svg viewBox="0 0 45 45" className="w-full h-full drop-shadow-md">
          {/* Base */}
          <path d="M 11,39 L 34,39 L 33,36 L 12,36 Z" fill={shade} stroke={stroke} strokeWidth="1.5" />
          <path d="M 12,36 C 12,36 15,31 17,27 L 28,27 C 30,31 33,36 33,36 Z" fill={body} stroke={stroke} strokeWidth="1.5" />
          {/* Ring */}
          <path d="M 17,27 L 28,27 L 27.5,25 L 17.5,25 Z" fill={shade} stroke={stroke} strokeWidth="1.5" />
          {/* Body */}
          <path d="M 17.5,25 C 17.5,21 19,19 19,17 L 26,17 C 26,19 27.5,21 27.5,25 Z" fill={body} stroke={stroke} strokeWidth="1.5" />
          {/* Head */}
          <circle cx="22.5" cy="11.5" r="5.5" fill={body} stroke={stroke} strokeWidth="1.5" />
          {isWhite && <circle cx="20.5" cy="9.5" r="1.5" fill="#FFF" opacity="0.8" />}
        </svg>
      );

    case "r":
      return (
        <svg viewBox="0 0 45 45" className="w-full h-full drop-shadow-md">
          {/* Base */}
          <path d="M 9,39 L 36,39 L 34,35 L 11,35 Z" fill={shade} stroke={stroke} strokeWidth="1.5" />
          <path d="M 12,35 L 33,35 L 31,31 L 14,31 Z" fill={body} stroke={stroke} strokeWidth="1.5" />
          {/* Stem */}
          <path d="M 14,31 L 31,31 L 29,17 L 16,17 Z" fill={body} stroke={stroke} strokeWidth="1.5" />
          {/* Capital */}
          <path d="M 13,17 L 32,17 L 32,13 L 13,13 Z" fill={shade} stroke={stroke} strokeWidth="1.5" />
          {/* Battlements */}
          <path d="M 11,13 L 11,8 L 15,8 L 15,11 L 19,11 L 19,8 L 26,8 L 26,11 L 30,11 L 30,8 L 34,8 L 34,13 Z" fill={body} stroke={stroke} strokeWidth="1.5" />
          {/* Inner details */}
          <line x1="16" y1="21" x2="29" y2="21" stroke={line} strokeWidth="1.2" opacity="0.6" />
        </svg>
      );

    case "n":
      return (
        <svg viewBox="0 0 45 45" className="w-full h-full drop-shadow-md">
          {/* Base */}
          <path d="M 9,39 L 36,39 L 34,35 L 11,35 Z" fill={shade} stroke={stroke} strokeWidth="1.5" />
          {/* Knight Body & Mane */}
          <path
            d="M 11,35 C 11,35 14,29 16,25 C 13.5,23.5 10,21 9,18 C 8,15 10.5,13.5 12,13 C 13,11 15,8 19,8 C 22,8 24,10 24,12 C 26,10 29,10.5 30,13 C 32,16 31,20 29.5,24 C 31,27 33,31 34,35 Z"
            fill={body}
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Snout & Chin */}
          <path d="M 12,13 C 10,15 9,17.5 10,19 C 11,20.5 13,21 14.5,20 C 16,19 18,17 19,17" fill={shade} stroke={stroke} strokeWidth="1.2" />
          {/* Eye */}
          <circle cx="16" cy="13.5" r="1.5" fill={stroke} />
          {/* Mane Highlights */}
          <path d="M 22,11 C 24,14 24,18 23,21" stroke={line} strokeWidth="1.2" fill="none" opacity="0.7" />
          <path d="M 27,14 C 29,18 28,23 27,26" stroke={line} strokeWidth="1.2" fill="none" opacity="0.7" />
        </svg>
      );

    case "b":
      return (
        <svg viewBox="0 0 45 45" className="w-full h-full drop-shadow-md">
          {/* Base */}
          <path d="M 10,39 L 35,39 L 33,35 L 12,35 Z" fill={shade} stroke={stroke} strokeWidth="1.5" />
          <path d="M 13,35 L 32,35 L 30,30 L 15,30 Z" fill={body} stroke={stroke} strokeWidth="1.5" />
          {/* Collar */}
          <path d="M 15,30 C 15,26 18,24 18,22 L 27,22 C 27,24 30,26 30,30 Z" fill={shade} stroke={stroke} strokeWidth="1.5" />
          {/* Mitre Body */}
          <path d="M 18,22 C 16,19 15,16 16.5,13 C 18,10 22.5,7 22.5,7 C 22.5,7 27,10 28.5,13 C 30,16 29,19 27,22 Z" fill={body} stroke={stroke} strokeWidth="1.5" />
          {/* Mitre Cross Slit */}
          <path d="M 19,15 L 26,11 M 21,12 L 24,17" stroke={line} strokeWidth="1.5" strokeLinecap="round" />
          {/* Top Sphere */}
          <circle cx="22.5" cy="5.5" r="2" fill={shade} stroke={stroke} strokeWidth="1.2" />
        </svg>
      );

    case "q":
      return (
        <svg viewBox="0 0 45 45" className="w-full h-full drop-shadow-md">
          {/* Base */}
          <path d="M 8,39 L 37,39 L 35,35 L 10,35 Z" fill={shade} stroke={stroke} strokeWidth="1.5" />
          <path d="M 11,35 L 34,35 L 32,31 L 13,31 Z" fill={body} stroke={stroke} strokeWidth="1.5" />
          {/* Waist */}
          <path d="M 13,31 C 13,27 16,25 17,23 L 28,23 C 29,25 32,27 32,31 Z" fill={shade} stroke={stroke} strokeWidth="1.5" />
          {/* Coronet / 5 Points */}
          <path
            d="M 17,23 L 9,13 L 15,17 L 22.5,10 L 30,17 L 36,13 L 28,23 Z"
            fill={body}
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Coronet Jewels */}
          <circle cx="9" cy="12" r="1.8" fill={shade} stroke={stroke} strokeWidth="1" />
          <circle cx="15" cy="16" r="1.8" fill={shade} stroke={stroke} strokeWidth="1" />
          <circle cx="22.5" cy="9" r="2.2" fill={shade} stroke={stroke} strokeWidth="1" />
          <circle cx="30" cy="16" r="1.8" fill={shade} stroke={stroke} strokeWidth="1" />
          <circle cx="36" cy="12" r="1.8" fill={shade} stroke={stroke} strokeWidth="1" />
        </svg>
      );

    case "k":
      return (
        <svg viewBox="0 0 45 45" className="w-full h-full drop-shadow-md">
          {/* Base */}
          <path d="M 8,39 L 37,39 L 35,35 L 10,35 Z" fill={shade} stroke={stroke} strokeWidth="1.5" />
          <path d="M 11,35 L 34,35 L 32,31 L 13,31 Z" fill={body} stroke={stroke} strokeWidth="1.5" />
          {/* Robe */}
          <path d="M 13,31 C 13,26 16,24 17,22 L 28,22 C 29,24 32,26 32,31 Z" fill={shade} stroke={stroke} strokeWidth="1.5" />
          {/* Crown */}
          <path
            d="M 17,22 C 14,19 13,15 15,12 C 17,9 22.5,9 22.5,9 C 22.5,9 28,9 30,12 C 32,15 31,19 28,22 Z"
            fill={body}
            stroke={stroke}
            strokeWidth="1.5"
          />
          {/* Crown Filigree Arch */}
          <path d="M 16,14 C 20,17 25,17 29,14" stroke={line} strokeWidth="1.3" fill="none" opacity="0.7" />
          {/* Royal Cross */}
          <path d="M 22.5,4 L 22.5,9 M 20,6.5 L 25,6.5" stroke={stroke} strokeWidth="1.8" strokeLinecap="square" />
        </svg>
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. WOODCRAFT 3D / ROYAL SHADED PIECES
// ─────────────────────────────────────────────────────────────────────────────
function WoodcraftPiece({ type, color }: { type: PieceType; color: PieceColor }) {
  const isWhite = color === "w";
  const gradId = `wood-${color}-${type}`;

  return (
    <svg viewBox="0 0 45 45" className="w-full h-full drop-shadow-xl">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          {isWhite ? (
            <>
              <stop offset="0%" stopColor="#FFF9E6" />
              <stop offset="45%" stopColor="#F5E4BE" />
              <stop offset="85%" stopColor="#DEBA85" />
              <stop offset="100%" stopColor="#B3864C" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#5E381C" />
              <stop offset="40%" stopColor="#3B200C" />
              <stop offset="80%" stopColor="#241306" />
              <stop offset="100%" stopColor="#140A02" />
            </>
          )}
        </linearGradient>
      </defs>
      <g fill={`url(#${gradId})`} stroke={isWhite ? "#7A4E1B" : "#0A0502"} strokeWidth="1.2">
        <StauntonPiece type={type} color={color} />
      </g>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CYBER NEON GLOW PIECES
// ─────────────────────────────────────────────────────────────────────────────
function NeonPiece({ type, color }: { type: PieceType; color: PieceColor }) {
  const isWhite = color === "w";
  const neonColor = isWhite ? "#00F0FF" : "#FF007F";
  const coreFill = isWhite ? "rgba(0, 240, 255, 0.25)" : "rgba(255, 0, 127, 0.25)";

  return (
    <div className="w-full h-full relative flex items-center justify-center">
      <svg
        viewBox="0 0 45 45"
        className="w-full h-full"
        style={{
          filter: `drop-shadow(0 0 6px ${neonColor})`,
        }}
      >
        <g stroke={neonColor} strokeWidth="1.8" fill={coreFill}>
          <StauntonPiece type={type} color={color} />
        </g>
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. MAIN EXPORT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export function ChessPiece({
  type,
  color,
  set = "staunton",
  className,
}: {
  type: PieceType;
  color: PieceColor;
  set?: PieceSetId;
  className?: string;
}) {
  return (
    <div
      className={`relative w-full h-full flex items-center justify-center select-none transition-transform duration-150 ${
        className ?? ""
      }`}
      aria-hidden="true"
    >
      {set === "woodcraft" && <WoodcraftPiece type={type} color={color} />}
      {set === "neon" && <NeonPiece type={type} color={color} />}
      {set === "minimal" && (
        <span
          className="font-display font-black text-xl flex items-center justify-center drop-shadow"
          style={{
            color: color === "w" ? "#FFF" : "#1E1E24",
            WebkitTextStroke: color === "w" ? "1.5px #111" : "1.5px #FFF",
          }}
        >
          {type.toUpperCase()}
        </span>
      )}
      {(set === "staunton" || set === "neo" || set === "classic") && (
        <StauntonPiece type={type} color={color} />
      )}
    </div>
  );
}
