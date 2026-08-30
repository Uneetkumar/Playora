"use client";

import * as React from "react";

/**
 * Chess piece sets.
 *
 * Three genuinely different silhouettes rather than one set recoloured — a
 * "piece set" that only changes tint is not worth offering. All artwork here is
 * authored for this project, so there is no third-party licence attached.
 *
 * Pieces are drawn in a 0 0 45 45 box, the conventional chess piece viewport,
 * so a set can be swapped without touching board geometry.
 */

export type PieceType = "k" | "q" | "r" | "b" | "n" | "p";
export type PieceColor = "w" | "b";

export const PIECE_SETS = [
  { id: "classic", label: "Classic", hint: "Traditional silhouettes" },
  { id: "modern", label: "Modern", hint: "Clean geometric shapes" },
  { id: "minimal", label: "Minimal", hint: "Letters, maximum clarity" },
] as const;

export type PieceSetId = (typeof PIECE_SETS)[number]["id"];

const GLYPH: Record<PieceType, string> = {
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
};

const LETTER: Record<PieceType, string> = {
  k: "K",
  q: "Q",
  r: "R",
  b: "B",
  n: "N",
  p: "P",
};

/** Geometric silhouettes for the modern set. */
const MODERN_PATHS: Record<PieceType, string> = {
  p: "M22.5 11a4.6 4.6 0 1 1 0 9.2 4.6 4.6 0 0 1 0-9.2Zm-4 9.6h8l1.6 6.6h-11.2ZM13 29h19l2 6H11Z",
  r: "M11 11h4v3h4v-3h5v3h4v-3h4v7l-3 3v9l3 4v3H11v-3l3-4v-9l-3-3Z",
  n: "M13 35c0-8 3-11 6-13-2-1-3-3-2-5 1-3 4-6 8-6 6 0 10 5 10 12 0 6-2 9-2 12Z",
  b: "M22.5 8a3 3 0 0 1 3 3c0 1.2-.7 2-1.4 2.6 3.6 1.8 6 5.4 6 9.4 0 3-1.4 5.4-3.4 7h-8.4c-2-1.6-3.4-4-3.4-7 0-4 2.4-7.6 6-9.4-.7-.6-1.4-1.4-1.4-2.6a3 3 0 0 1 3-3ZM13 32h19v3H13Z",
  q: "M9 14a2.5 2.5 0 1 1 3.4 2.3L15 22l3.6-6.6a2.5 2.5 0 1 1 3.9 0L22.5 15l1 .4a2.5 2.5 0 1 1 3.9 0L30 22l2.6-5.7A2.5 2.5 0 1 1 36 14l-3 14H12ZM12 30h21v4H12Z",
  k: "M22.5 6v5m-2.5-2.5h5M14 21c0-5 3.8-8 8.5-8s8.5 3 8.5 8c0 4-2 6.5-4 8.5h-9C16 27.5 14 25 14 21ZM13 32h19v3H13Z",
};

export function ChessPiece({
  type,
  color,
  set = "classic",
  className,
}: {
  type: PieceType;
  color: PieceColor;
  set?: PieceSetId;
  className?: string;
}) {
  const light = color === "w";
  // High contrast in both directions, so a piece reads on any board theme.
  const fill = light ? "#F7F5F0" : "#26262E";
  const stroke = light ? "#25252C" : "#0A0A0E";

  if (set === "minimal") {
    return (
      <span
        className={className}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          fontFamily: "var(--font-display), system-ui, sans-serif",
          fontWeight: 800,
          fontSize: "52%",
          color: fill,
          background: light ? "transparent" : "transparent",
          textShadow: light
            ? "0 1px 2px rgba(0,0,0,0.45)"
            : "0 1px 1px rgba(255,255,255,0.14)",
          WebkitTextStroke: `1.2px ${stroke}`,
        }}
        aria-hidden
      >
        {LETTER[type]}
      </span>
    );
  }

  if (set === "modern") {
    return (
      <svg
        viewBox="0 0 45 45"
        className={className}
        style={{ width: "100%", height: "100%" }}
        aria-hidden
      >
        <path
          d={MODERN_PATHS[type]}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // Classic: the Unicode chess glyphs, which are well-drawn in system fonts.
  // Always the *solid* glyph, coloured — outline glyphs vanish on light squares.
  return (
    <span
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        fontSize: "82%",
        lineHeight: 1,
        color: fill,
        WebkitTextStroke: `1.1px ${stroke}`,
        paintOrder: "stroke fill",
        filter: light
          ? "drop-shadow(0 2px 2px rgba(0,0,0,0.5))"
          : "drop-shadow(0 2px 2px rgba(0,0,0,0.4))",
      }}
      aria-hidden
    >
      {GLYPH[type]}
    </span>
  );
}

export const PIECE_NAMES: Record<PieceType, string> = {
  k: "King",
  q: "Queen",
  r: "Rook",
  b: "Bishop",
  n: "Knight",
  p: "Pawn",
};

/** Accessible name for a square's occupant. */
export function describePiece(type: PieceType, color: PieceColor): string {
  return `${color === "w" ? "White" : "Black"} ${PIECE_NAMES[type]}`;
}
