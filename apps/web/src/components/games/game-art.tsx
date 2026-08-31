"use client";

import * as React from "react";
import type { GameId } from "@playora/game-types";

/**
 * Premium authored cover art & thumbnails for all catalog games.
 * Authored vector SVG graphics designed specifically for each game's visual identity.
 */

export interface GameArt {
  /** Ambient background gradient for the tile container. */
  background: string;
  /** High-fidelity vector illustration in 160x120 aspect ratio. */
  Art: (props: { className?: string }) => React.ReactElement;
  /** Photorealistic 3D thumbnail image URL */
  imageUrl?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CHESS — Polished Marble Board & Majestic Golden Knight
// ─────────────────────────────────────────────────────────────────────────────
const chess: GameArt = {
  background: "radial-gradient(ellipse at 50% 35%, #3d2c1d 0%, #1c140d 60%, #0c0805 100%)",
  imageUrl: "/games/chess-hero.jpg",
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      <defs>
        {/* Board Perspective Gradient */}
        <linearGradient id="chess-board-light" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F5E4C3" />
          <stop offset="100%" stopColor="#DBC297" />
        </linearGradient>
        <linearGradient id="chess-board-dark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5C3B1E" />
          <stop offset="100%" stopColor="#3B2310" />
        </linearGradient>
        {/* Knight Gold Gradient */}
        <linearGradient id="chess-knight-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFF4D0" />
          <stop offset="35%" stopColor="#F0CA65" />
          <stop offset="75%" stopColor="#C49323" />
          <stop offset="100%" stopColor="#7A560B" />
        </linearGradient>
        <filter id="chess-shadow" x="-20%" y="-20%" width="150%" height="150%">
          <feDropShadow dx="2" dy="5" stdDeviation="4" floodColor="#000" floodOpacity="0.8" />
        </filter>
      </defs>

      {/* Ambient background glow */}
      <circle cx="80" cy="55" r="45" fill="#E6B043" opacity="0.12" filter="blur(10px)" />

      {/* Perspective Chessboard Tiles */}
      <g transform="translate(10, 35) skewX(-24) rotate(8)" opacity="0.85">
        {Array.from({ length: 4 }).map((_, r) =>
          Array.from({ length: 5 }).map((_, c) => {
            const isLight = (r + c) % 2 === 0;
            return (
              <rect
                key={`${r}-${c}`}
                x={c * 24 + 10}
                y={r * 16 + 15}
                width="24"
                height="16"
                fill={isLight ? "url(#chess-board-light)" : "url(#chess-board-dark)"}
                stroke="#2A180B"
                strokeWidth="0.75"
                opacity={0.9 - r * 0.12}
              />
            );
          })
        )}
      </g>

      {/* Majestic Knight Piece */}
      <g transform="translate(68, 20) scale(1.65)" filter="url(#chess-shadow)">
        {/* Base */}
        <ellipse cx="14" cy="46" rx="13" ry="4.5" fill="#5C3D12" />
        <ellipse cx="14" cy="45" rx="12" ry="3.5" fill="url(#chess-knight-gold)" stroke="#3D2608" strokeWidth="0.8" />
        <path d="M4,44 C4,40 8,38 10,36 L18,36 C20,38 24,40 24,44 Z" fill="url(#chess-knight-gold)" stroke="#3D2608" strokeWidth="0.8" />

        {/* Neck & Mane */}
        <path
          d="M10,36 C8,30 6,24 8,16 C10,12 14,8 18,9 C19,11 18,14 17,16 C20,13 22,14 22,17 C24,15 26,17 25,20 C27,24 26,30 20,36 Z"
          fill="url(#chess-knight-gold)"
          stroke="#3D2608"
          strokeWidth="0.8"
        />

        {/* Head & Snout */}
        <path
          d="M8,16 C6,15 3,17 2,20 C1,23 3,25 6,26 C9,27 10,29 11,32 C12,35 15,36 17,35 C17,31 16,28 14,25 C12,23 11,20 12,18 C11,17 9,17 8,16 Z"
          fill="url(#chess-knight-gold)"
          stroke="#3D2608"
          strokeWidth="0.8"
        />

        {/* Eye & Ear */}
        <polygon points="12,12 14,8 16,11" fill="url(#chess-knight-gold)" stroke="#3D2608" strokeWidth="0.8" />
        <circle cx="7.5" cy="18.5" r="1.2" fill="#241505" />
        <path d="M3.5,23 C4,24 6,24 6.5,23" stroke="#3D2608" strokeWidth="0.6" fill="none" />
      </g>
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. UNO CLASSIC — Authentic Fanned Real Cards & 3D Logo
// ─────────────────────────────────────────────────────────────────────────────
const uno: GameArt = {
  background: "radial-gradient(ellipse at 50% 35%, #8B1A1A 0%, #3D0808 65%, #180303 100%)",
  imageUrl: "/games/uno-hero.jpg",
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      <defs>
        <radialGradient id="uno-glow" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stopColor="#FF4D4D" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#FF4D4D" stopOpacity="0" />
        </radialGradient>
        <filter id="uno-card-shadow" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="2" dy="5" stdDeviation="3.5" floodColor="#000" floodOpacity="0.75" />
        </filter>
        <linearGradient id="uno-gold-text" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF77D" />
          <stop offset="40%" stopColor="#FFD200" />
          <stop offset="80%" stopColor="#E69500" />
          <stop offset="100%" stopColor="#A86200" />
        </linearGradient>
      </defs>

      {/* Ambient core glow */}
      <circle cx="80" cy="58" r="50" fill="url(#uno-glow)" />

      {/* Fanned Authentic UNO Cards */}
      {/* 1. Red 7 (Leftmost) */}
      <g transform="translate(42, 64) rotate(-24)" filter="url(#uno-card-shadow)">
        <rect x="-16" y="-24" width="32" height="48" rx="4" fill="#FFFFFF" />
        <rect x="-14" y="-22" width="28" height="44" rx="3" fill="#D72638" />
        <ellipse cx="0" cy="0" rx="12" ry="7.5" fill="#FFFFFF" transform="rotate(-28)" />
        <text x="0" y="6" textAnchor="middle" fontFamily="Impact, Arial Black" fontStyle="italic" fontWeight="900" fontSize="18" fill="#FFF" stroke="#000" strokeWidth="1.2" paintOrder="stroke fill">7</text>
      </g>

      {/* 2. Yellow +2 */}
      <g transform="translate(60, 56) rotate(-12)" filter="url(#uno-card-shadow)">
        <rect x="-16" y="-24" width="32" height="48" rx="4" fill="#FFFFFF" />
        <rect x="-14" y="-22" width="28" height="44" rx="3" fill="#F5B700" />
        <ellipse cx="0" cy="0" rx="12" ry="7.5" fill="#FFFFFF" transform="rotate(-28)" />
        <rect x="-5" y="-6" width="6" height="9" rx="1" fill="#FFF" stroke="#000" strokeWidth="0.8" />
        <rect x="-1" y="-3" width="6" height="9" rx="1" fill="#FFF" stroke="#000" strokeWidth="0.8" />
      </g>

      {/* 3. Green Reverse */}
      <g transform="translate(80, 52) rotate(0)" filter="url(#uno-card-shadow)">
        <rect x="-16" y="-24" width="32" height="48" rx="4" fill="#FFFFFF" />
        <rect x="-14" y="-22" width="28" height="44" rx="3" fill="#2E933C" />
        <ellipse cx="0" cy="0" rx="12" ry="7.5" fill="#FFFFFF" transform="rotate(-28)" />
        <path d="M-6,-2 L2,-2 M0,-5 L4,-2 L0,1" stroke="#FFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M6,2 L-2,2 M0,5 L-4,2 L0,-1" stroke="#FFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>

      {/* 4. Blue 3 */}
      <g transform="translate(100, 56) rotate(12)" filter="url(#uno-card-shadow)">
        <rect x="-16" y="-24" width="32" height="48" rx="4" fill="#FFFFFF" />
        <rect x="-14" y="-22" width="28" height="44" rx="3" fill="#0C69D1" />
        <ellipse cx="0" cy="0" rx="12" ry="7.5" fill="#FFFFFF" transform="rotate(-28)" />
        <text x="0" y="6" textAnchor="middle" fontFamily="Impact, Arial Black" fontStyle="italic" fontWeight="900" fontSize="18" fill="#FFF" stroke="#000" strokeWidth="1.2" paintOrder="stroke fill">3</text>
      </g>

      {/* 5. Wild Pinwheel Card (Rightmost) */}
      <g transform="translate(118, 64) rotate(24)" filter="url(#uno-card-shadow)">
        <rect x="-16" y="-24" width="32" height="48" rx="4" fill="#FFFFFF" />
        <rect x="-14" y="-22" width="28" height="44" rx="3" fill="#1A1A1E" />
        <g transform="rotate(-28)">
          <ellipse cx="0" cy="0" rx="12" ry="7.5" fill="none" />
          <path d="M0,0 L15,-15 L15,0 Z" fill="#F5B700" />
          <path d="M0,0 L15,0 L15,15 L0,15 Z" fill="#0C69D1" />
          <path d="M0,0 L0,15 L-15,15 L-15,0 Z" fill="#2E933C" />
          <path d="M0,0 L-15,0 L-15,-15 L0,-15 Z" fill="#D72638" />
        </g>
      </g>

      {/* 3D UNO Badge in Center Front */}
      <g transform="translate(80, 88)" filter="url(#uno-card-shadow)">
        <ellipse cx="0" cy="0" rx="28" ry="15" fill="#E61C1C" stroke="#FFEA79" strokeWidth="1.8" transform="rotate(-12)" />
        <text
          x="0"
          y="5"
          textAnchor="middle"
          fontFamily="Impact, Arial Black"
          fontStyle="italic"
          fontWeight="900"
          fontSize="20"
          letterSpacing="0.5"
          fill="url(#uno-gold-text)"
          stroke="#000"
          strokeWidth="1.8"
          paintOrder="stroke fill"
          transform="rotate(-12)"
        >
          UNO
        </text>
      </g>
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. UNO NO MERCY — Fiery Black Splatter Cards & +10 Extreme Badge
// ─────────────────────────────────────────────────────────────────────────────
const unoNoMercy: GameArt = {
  background: "radial-gradient(ellipse at 50% 35%, #400505 0%, #1C0101 65%, #050000 100%)",
  imageUrl: "/games/uno-no-mercy-hero.jpg",
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      <defs>
        <radialGradient id="nm-fire-glow" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stopColor="#FF4500" stopOpacity="0.5" />
          <stop offset="60%" stopColor="#B30000" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.2" />
        </radialGradient>
        <filter id="nm-shadow" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="2" dy="5" stdDeviation="4" floodColor="#000" floodOpacity="0.9" />
        </filter>
        <linearGradient id="nm-text-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFD400" />
          <stop offset="60%" stopColor="#FF4500" />
          <stop offset="100%" stopColor="#B30000" />
        </linearGradient>
      </defs>

      {/* Flaming Ambient Glow */}
      <circle cx="80" cy="56" r="52" fill="url(#nm-fire-glow)" />

      {/* No Mercy Black Grunge Cards */}
      <g transform="translate(42, 64) rotate(-24)" filter="url(#nm-shadow)">
        <rect x="-16" y="-24" width="32" height="48" rx="4" fill="#000" stroke="#333" strokeWidth="1" />
        <ellipse cx="0" cy="0" rx="13" ry="8" fill="#B80C09" transform="rotate(-28)" />
        <text x="0" y="5" textAnchor="middle" fontFamily="Impact, Arial Black" fontStyle="italic" fontWeight="900" fontSize="14" fill="#FFF" stroke="#000" strokeWidth="1.2" paintOrder="stroke fill">+10</text>
      </g>
      <g transform="translate(60, 56) rotate(-12)" filter="url(#nm-shadow)">
        <rect x="-16" y="-24" width="32" height="48" rx="4" fill="#000" stroke="#333" strokeWidth="1" />
        <ellipse cx="0" cy="0" rx="13" ry="8" fill="#D49A00" transform="rotate(-28)" />
        <text x="0" y="5" textAnchor="middle" fontFamily="Impact, Arial Black" fontStyle="italic" fontWeight="900" fontSize="15" fill="#FFF" stroke="#000" strokeWidth="1.2" paintOrder="stroke fill">+6</text>
      </g>
      <g transform="translate(80, 52) rotate(0)" filter="url(#nm-shadow)">
        <rect x="-16" y="-24" width="32" height="48" rx="4" fill="#000" stroke="#333" strokeWidth="1" />
        <ellipse cx="0" cy="0" rx="13" ry="8" fill="#1E6B2B" transform="rotate(-28)" />
        <path d="M-6,-2 L2,-2 M0,-5 L4,-2 L0,1" stroke="#FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M6,2 L-2,2 M0,5 L-4,2 L0,-1" stroke="#FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
      <g transform="translate(100, 56) rotate(12)" filter="url(#nm-shadow)">
        <rect x="-16" y="-24" width="32" height="48" rx="4" fill="#000" stroke="#333" strokeWidth="1" />
        <ellipse cx="0" cy="0" rx="13" ry="8" fill="#0B4F9C" transform="rotate(-28)" />
        <text x="0" y="5" textAnchor="middle" fontFamily="Impact, Arial Black" fontStyle="italic" fontWeight="900" fontSize="16" fill="#FFF" stroke="#000" strokeWidth="1.2" paintOrder="stroke fill">+4</text>
      </g>
      <g transform="translate(118, 64) rotate(24)" filter="url(#nm-shadow)">
        <rect x="-16" y="-24" width="32" height="48" rx="4" fill="#000" stroke="#333" strokeWidth="1" />
        <g transform="rotate(-28)">
          <path d="M0,0 L15,-15 L15,0 Z" fill="#D49A00" />
          <path d="M0,0 L15,0 L15,15 L0,15 Z" fill="#0B4F9C" />
          <path d="M0,0 L0,15 L-15,15 L-15,0 Z" fill="#1E6B2B" />
          <path d="M0,0 L-15,0 L-15,-15 L0,-15 Z" fill="#B80C09" />
        </g>
      </g>
      <g transform="translate(80, 88)" filter="url(#nm-shadow)">
        <ellipse cx="0" cy="0" rx="30" ry="16" fill="#111" stroke="#FF4500" strokeWidth="2" transform="rotate(-8)" />
        <text x="0" y="2" textAnchor="middle" fontFamily="Impact, Arial Black" fontStyle="italic" fontWeight="900" fontSize="16" fill="url(#nm-text-grad)" stroke="#000" strokeWidth="1.5" paintOrder="stroke fill" transform="rotate(-8)">
          UNO
        </text>
        <text x="0" y="11" textAnchor="middle" fontFamily="Impact, Arial Black" fontWeight="900" fontSize="7" letterSpacing="1" fill="#FF3B30" stroke="#000" strokeWidth="0.8" transform="rotate(-8)">
          NO MERCY
        </text>
      </g>
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. CAR RACE — Cyberpunk Nitro Supercar on Neon Circuit
// ─────────────────────────────────────────────────────────────────────────────
const carRace: GameArt = {
  background: "radial-gradient(ellipse at 50% 35%, #2a0b4d 0%, #110524 60%, #06010d 100%)",
  imageUrl: "/games/car-race-hero.jpg",
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      <polygon points="58,60 102,60 148,120 12,120" fill="#1E0A3C" />
      <g transform="translate(80, 88)">
        <path d="M-26,4 C-26,-2 -22,-6 -14,-8 L14,-8 C22,-6 26,-2 26,4 L24,8 L-24,8 Z" fill="#E61C38" />
      </g>
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. BIKE RACE — Futuristic Leaning Superbike & Cyan Speed Trails
// ─────────────────────────────────────────────────────────────────────────────
const bikeRace: GameArt = {
  background: "radial-gradient(ellipse at 50% 35%, #0b2d45 0%, #051421 60%, #02070d 100%)",
  imageUrl: "/games/bike-race-hero.jpg",
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      <polygon points="62,65 98,65 142,120 18,120" fill="#082236" />
      <g transform="translate(80, 84) rotate(-8)">
        <rect x="-6" y="2" width="12" height="18" rx="4" fill="#0A0D14" />
      </g>
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. ROPE RESCUE
// ─────────────────────────────────────────────────────────────────────────────
const ropeRescue: GameArt = {
  background: "radial-gradient(ellipse at 50% 30%, #1e1b4b 0%, #0f172a 60%, #020617 100%)",
  imageUrl: "/games/rope-rescue-thumb.jpg",
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      <circle cx="80" cy="60" r="40" fill="#38bdf8" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. ANT ATTACK
// ─────────────────────────────────────────────────────────────────────────────
const antAttack: GameArt = {
  background: "radial-gradient(ellipse at 50% 35%, #14532d 0%, #052e16 60%, #022c22 100%)",
  imageUrl: "/games/ant-attack-thumb.jpg",
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      <circle cx="80" cy="60" r="40" fill="#15803d" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 8. BOMB PASS
// ─────────────────────────────────────────────────────────────────────────────
const bombPass: GameArt = {
  background: "radial-gradient(ellipse at 50% 35%, #450a0a 0%, #1c0505 60%, #0c0202 100%)",
  imageUrl: "/games/bomb-pass-thumb.jpg",
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      <circle cx="80" cy="60" r="40" fill="#dc2626" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 9. COLOR RUSH
// ─────────────────────────────────────────────────────────────────────────────
const colorRush: GameArt = {
  background: "radial-gradient(ellipse at 50% 35%, #2e1065 0%, #17072e 60%, #0b0217 100%)",
  imageUrl: "/games/color-rush-thumb.jpg",
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      <circle cx="80" cy="60" r="40" fill="#a855f7" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 10. FALLING FLOOR
// ─────────────────────────────────────────────────────────────────────────────
const fallingFloor: GameArt = {
  background: "radial-gradient(ellipse at 50% 35%, #311042 0%, #180824 60%, #0c0412 100%)",
  imageUrl: "/games/falling-floor-thumb.jpg",
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      <circle cx="80" cy="60" r="40" fill="#7c3aed" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 11. PIN PUZZLE
// ─────────────────────────────────────────────────────────────────────────────
const pinPuzzle: GameArt = {
  background: "radial-gradient(ellipse at 50% 35%, #1e293b 0%, #0f172a 60%, #020617 100%)",
  imageUrl: "/games/pin-puzzle-thumb.jpg",
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      <circle cx="80" cy="60" r="40" fill="#d97706" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 12. TARGET RUSH
// ─────────────────────────────────────────────────────────────────────────────
const targetRush: GameArt = {
  background: "radial-gradient(ellipse at 50% 35%, #3b0764 0%, #1e053a 60%, #0f021f 100%)",
  imageUrl: "/games/target-rush-thumb.jpg",
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      <circle cx="80" cy="60" r="40" fill="#dc2626" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 13. HOT POTATO
// ─────────────────────────────────────────────────────────────────────────────
const hotPotato: GameArt = {
  background: "radial-gradient(ellipse at 50% 35%, #451a03 0%, #270d02 60%, #120501 100%)",
  imageUrl: "/games/hot-potato-thumb.jpg",
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      <circle cx="80" cy="60" r="40" fill="#ea580c" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 14. BRIDGE BUILDER
// ─────────────────────────────────────────────────────────────────────────────
const bridgeBuilder: GameArt = {
  background: "radial-gradient(ellipse at 50% 35%, #0c4a6e 0%, #082f49 60%, #031524 100%)",
  imageUrl: "/games/bridge-builder-thumb.jpg",
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      <circle cx="80" cy="60" r="40" fill="#0284c7" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 15. ICE BREAKER
// ─────────────────────────────────────────────────────────────────────────────
const iceBreaker: GameArt = {
  background: "radial-gradient(ellipse at 50% 35%, #0369a1 0%, #075985 60%, #082f49 100%)",
  imageUrl: "/games/ice-breaker-thumb.jpg",
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      <circle cx="80" cy="60" r="40" fill="#0284c7" />
    </svg>
  ),
};

const ART: Record<string, GameArt> = {
  chess,
  uno,
  "uno-no-mercy": unoNoMercy,
  "car-race": carRace,
  "bike-race": bikeRace,
  "rope-rescue": ropeRescue,
  "ant-attack": antAttack,
  "bomb-pass": bombPass,
  "color-rush": colorRush,
  "falling-floor": fallingFloor,
  "pin-puzzle": pinPuzzle,
  "target-rush": targetRush,
  "hot-potato": hotPotato,
  "bridge-builder": bridgeBuilder,
  "ice-breaker": iceBreaker,
};

export function artFor(gameId: GameId | string): GameArt {
  return ART[gameId] ?? chess;
}

