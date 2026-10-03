"use client";

import * as React from "react";

/**
 * Authored artwork for the things you actually interact with.
 *
 * These were emoji — 🎯 for a target, 💣 for a bomb, 😎 for a player. Emoji are
 * the wrong tool for game entities on three counts: they are drawn by the
 * operating system, so the game looks different on a Mac, a Pixel and a
 * Windows laptop and none of those looks are ours; they cannot be styled, so a
 * target cannot flash when hit or dim when it is about to expire; and they
 * carry a text baseline, so they never sit quite where you place them.
 *
 * Everything here is inline SVG that scales cleanly, takes a size, and can be
 * driven by state.
 */

interface SpriteProps {
  size?: number;
  className?: string;
}

/** A shooting-range target. `gold` is the bonus, `tnt` is the one to avoid. */
export function TargetSprite({
  kind = "bullseye",
  size = 48,
  className,
}: SpriteProps & { kind?: "bullseye" | "gold" | "tnt" }) {
  if (kind === "tnt") {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden>
        <defs>
          <radialGradient id="tntBody" cx="35%" cy="30%">
            <stop offset="0%" stopColor="#4b5563" />
            <stop offset="100%" stopColor="#111827" />
          </radialGradient>
        </defs>
        <circle cx="24" cy="27" r="17" fill="url(#tntBody)" stroke="#0b0f19" strokeWidth="2" />
        {/* Fuse, lit — the only warm colour on the sprite, so the eye finds it. */}
        <path d="M31 12 q6 -4 9 2" stroke="#a16207" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <circle cx="40" cy="14" r="3.5" fill="#fb923c" />
        <circle cx="40" cy="14" r="1.8" fill="#fef3c7" />
        {/* Specular highlight: without it the body reads as a flat hole. */}
        <ellipse cx="18" cy="21" rx="5" ry="3.5" fill="#ffffff" opacity="0.22" />
      </svg>
    );
  }

  const gold = kind === "gold";
  const rings = gold
    ? ["#fbbf24", "#f59e0b", "#fde68a", "#f59e0b"]
    : ["#f8fafc", "#ef4444", "#f8fafc", "#ef4444"];

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden>
      <defs>
        <radialGradient id={gold ? "goldSheen" : "targetSheen"} cx="35%" cy="30%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="70%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {[22, 16.5, 11, 5.5].map((r, i) => (
        <circle key={r} cx="24" cy="24" r={r} fill={rings[i]} stroke="#0b0f19" strokeWidth="1.2" />
      ))}
      {gold && (
        // A star in the middle so the bonus is legible in peripheral vision,
        // not only by its colour.
        <path
          d="M24 14 l2.6 5.6 6.1 .8 -4.5 4.2 1.2 6 -5.4 -2.9 -5.4 2.9 1.2 -6 -4.5 -4.2 6.1 -.8 z"
          fill="#78350f"
        />
      )}
      <circle cx="24" cy="24" r="22" fill={`url(#${gold ? "goldSheen" : "targetSheen"})`} />
    </svg>
  );
}

/** The bomb in Bomb Pass. `armed` makes the fuse burn. */
export function BombSprite({ size = 56, armed = false, className }: SpriteProps & { armed?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" className={className} aria-hidden>
      <defs>
        <radialGradient id="bombBody" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#475569" />
          <stop offset="100%" stopColor="#0b0f19" />
        </radialGradient>
      </defs>
      <circle cx="26" cy="34" r="19" fill="url(#bombBody)" stroke="#000" strokeWidth="2" />
      <rect x="30" y="12" width="8" height="7" rx="2" fill="#334155" transform="rotate(28 34 15)" />
      <path d="M37 13 q8 -6 12 1" stroke="#a16207" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="49" cy="14" r={armed ? 5 : 3.5} fill="#fb923c" className={armed ? "animate-pulse" : undefined} />
      <circle cx="49" cy="14" r={armed ? 2.4 : 1.6} fill="#fef9c3" />
      <ellipse cx="19" cy="27" rx="5.5" ry="4" fill="#ffffff" opacity="0.2" />
    </svg>
  );
}

/**
 * A player token.
 *
 * Six distinguishable hues rather than six emoji faces: they read at any size,
 * stay legible when the token is dimmed for an eliminated player, and never
 * depend on a font.
 */
const TOKEN_COLOURS = [
  { body: "#38bdf8", trim: "#0369a1" },
  { body: "#f472b6", trim: "#9d174d" },
  { body: "#4ade80", trim: "#166534" },
  { body: "#fbbf24", trim: "#92400e" },
  { body: "#a78bfa", trim: "#5b21b6" },
  { body: "#fb7185", trim: "#9f1239" },
] as const;

export function PlayerToken({
  seat,
  size = 44,
  eliminated = false,
  className,
}: SpriteProps & { seat: number; eliminated?: boolean }) {
  const colour = TOKEN_COLOURS[seat % TOKEN_COLOURS.length]!;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      className={className}
      style={eliminated ? { filter: "grayscale(1)", opacity: 0.4 } : undefined}
      aria-hidden
    >
      <circle cx="22" cy="22" r="20" fill={colour.trim} />
      <circle cx="22" cy="22" r="17" fill={colour.body} />
      {/* Head and shoulders, so a token reads as a person at 20px. */}
      <circle cx="22" cy="17" r="6" fill={colour.trim} opacity="0.85" />
      <path d="M11 34 q11 -10 22 0 z" fill={colour.trim} opacity="0.85" />
      {eliminated && (
        <path d="M12 12 L32 32 M32 12 L12 32" stroke="#0b0f19" strokeWidth="3" strokeLinecap="round" />
      )}
    </svg>
  );
}
