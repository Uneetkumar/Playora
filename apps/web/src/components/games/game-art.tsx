"use client";

import * as React from "react";
import type { GameId } from "@playora/game-types";
import { GAME_META } from "../../lib/games/meta";

/**
 * Premium authored cover art & thumbnails for all catalog games.
 * Authored vector SVG graphics designed specifically for each game's visual identity.
 */

export interface GameArt {
  /** Ambient background gradient for the tile container. */
  background: string;
  /** High-fidelity vector illustration in 160x120 aspect ratio. */
  Art: (props: { className?: string }) => React.ReactElement;
  /**
   * Cover image URL. Read from `GAME_META[id].covers` rather than written out
   * here, so the card, the share image and the hero all use the same file.
   */
  imageUrl?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CHESS — Polished Marble Board & Majestic Golden Knight
// ─────────────────────────────────────────────────────────────────────────────
const chess: GameArt = {
  background: "radial-gradient(ellipse at 50% 35%, #3d2c1d 0%, #1c140d 60%, #0c0805 100%)",
  imageUrl: GAME_META.chess.covers.landscape,
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
  imageUrl: GAME_META.uno.covers.landscape,
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
  imageUrl: GAME_META["uno-no-mercy"].covers.landscape,
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
  imageUrl: GAME_META["car-race"].covers.landscape,
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
  imageUrl: GAME_META["bike-race"].covers.landscape,
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
  imageUrl: GAME_META["rope-rescue"].covers.landscape,
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
  imageUrl: GAME_META["ant-attack"].covers.landscape,
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
  imageUrl: GAME_META["bomb-pass"].covers.landscape,
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
  imageUrl: GAME_META["color-rush"].covers.landscape,
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
  imageUrl: GAME_META["falling-floor"].covers.landscape,
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
  imageUrl: GAME_META["pin-puzzle"].covers.landscape,
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
  imageUrl: GAME_META["target-rush"].covers.landscape,
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
  imageUrl: GAME_META["hot-potato"].covers.landscape,
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
  imageUrl: GAME_META["bridge-builder"].covers.landscape,
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
  imageUrl: GAME_META["ice-breaker"].covers.landscape,
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      <circle cx="80" cy="60" r="40" fill="#0284c7" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 16. TIC-TAC-TOE — Neon Duel
// ─────────────────────────────────────────────────────────────────────────────
const ticTacToe: GameArt = {
  background: "radial-gradient(ellipse at 50% 35%, #2a0845 0%, #17072b 60%, #0d021a 100%)",
  imageUrl: GAME_META["tic-tac-toe"].covers.landscape,
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      <defs>
        <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Grid Lines */}
      <line x1="60" y1="20" x2="60" y2="100" stroke="#3b1d60" strokeWidth="4" strokeLinecap="round" />
      <line x1="100" y1="20" x2="100" y2="100" stroke="#3b1d60" strokeWidth="4" strokeLinecap="round" />
      <line x1="20" y1="46" x2="140" y2="46" stroke="#3b1d60" strokeWidth="4" strokeLinecap="round" />
      <line x1="20" y1="74" x2="140" y2="74" stroke="#3b1d60" strokeWidth="4" strokeLinecap="round" />
      {/* Glowing X */}
      <path d="M32,26 L48,40 M48,26 L32,40" stroke="#00f2fe" strokeWidth="5" strokeLinecap="round" filter="url(#neon-glow)" />
      <path d="M72,52 L88,68 M88,52 L72,68" stroke="#00f2fe" strokeWidth="5" strokeLinecap="round" filter="url(#neon-glow)" />
      <path d="M112,80 L128,94 M128,80 L112,94" stroke="#00f2fe" strokeWidth="5" strokeLinecap="round" filter="url(#neon-glow)" />
      {/* Glowing O */}
      <circle cx="120" cy="33" r="9" fill="none" stroke="#ff0844" strokeWidth="4.5" filter="url(#neon-glow)" />
      <circle cx="40" cy="87" r="9" fill="none" stroke="#ff0844" strokeWidth="4.5" filter="url(#neon-glow)" />
      {/* Winning Strike Line */}
      <line x1="24" y1="18" x2="136" y2="102" stroke="#4facfe" strokeWidth="3" strokeDasharray="4 2" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 17. CONNECT FOUR — Gravity Disc Matrix
// ─────────────────────────────────────────────────────────────────────────────
const connectFour: GameArt = {
  background: "radial-gradient(ellipse at 50% 35%, #0f2b5c 0%, #071530 60%, #030814 100%)",
  imageUrl: GAME_META["connect-four"].covers.landscape,
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      <rect x="25" y="25" width="110" height="75" rx="10" fill="#1e40af" stroke="#3b82f6" strokeWidth="2.5" />
      {/* Grid Holes */}
      {[0, 1, 2, 3, 4].map((col) =>
        [0, 1, 2, 3].map((row) => {
          const cx = 40 + col * 20;
          const cy = 37 + row * 17;
          let discFill = "#0b162c";
          if ((col === 1 && row === 3) || (col === 2 && row === 2) || (col === 3 && row === 1)) discFill = "#ef4444";
          if ((col === 2 && row === 3) || (col === 3 && row === 2) || (col === 4 && row === 3)) discFill = "#eab308";
          return <circle key={`${col}-${row}`} cx={cx} cy={cy} r="6.5" fill={discFill} stroke="#172554" strokeWidth="1.5" />;
        })
      )}
      {/* Falling Disc */}
      <circle cx="100" cy="16" r="7" fill="#ef4444" stroke="#fca5a5" strokeWidth="1.5" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 18. LUDO — The Royal Cross & Dice
// ─────────────────────────────────────────────────────────────────────────────
const ludo: GameArt = {
  background: "radial-gradient(ellipse at 50% 35%, #3b1443 0%, #1f0b24 60%, #0f0512 100%)",
  imageUrl: GAME_META.ludo.covers.landscape,
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      {/* Quadrants */}
      <rect x="35" y="15" width="36" height="36" rx="4" fill="#ef4444" stroke="#991b1b" strokeWidth="1.5" />
      <rect x="89" y="15" width="36" height="36" rx="4" fill="#22c55e" stroke="#166534" strokeWidth="1.5" />
      <rect x="35" y="69" width="36" height="36" rx="4" fill="#3b82f6" stroke="#1e40af" strokeWidth="1.5" />
      <rect x="89" y="69" width="36" height="36" rx="4" fill="#eab308" stroke="#854d0e" strokeWidth="1.5" />
      {/* Center Home */}
      <polygon points="80,51 71,60 80,69 89,60" fill="#f8fafc" stroke="#64748b" strokeWidth="1.5" />
      {/* 3D Dice in Foreground */}
      <g transform="translate(68, 48)">
        <rect x="0" y="0" width="24" height="24" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
        <circle cx="6" cy="6" r="2" fill="#ef4444" />
        <circle cx="18" cy="6" r="2" fill="#ef4444" />
        <circle cx="12" cy="12" r="2.5" fill="#ef4444" />
        <circle cx="6" cy="18" r="2" fill="#ef4444" />
        <circle cx="18" cy="18" r="2" fill="#ef4444" />
      </g>
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 19. SNAKES & LADDERS — Ascent & Serpentine Slide
// ─────────────────────────────────────────────────────────────────────────────
const snakeLadder: GameArt = {
  background: "radial-gradient(ellipse at 50% 35%, #064e3b 0%, #022c22 60%, #01140f 100%)",
  imageUrl: GAME_META["snake-ladder"].covers.landscape,
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      {/* Board squares */}
      <rect x="30" y="15" width="100" height="90" rx="6" fill="#0f172a" stroke="#10b981" strokeWidth="2" />
      {/* Golden Ladder */}
      <line x1="50" y1="90" x2="68" y2="30" stroke="#f59e0b" strokeWidth="3" />
      <line x1="60" y1="92" x2="78" y2="32" stroke="#f59e0b" strokeWidth="3" />
      <line x1="53" y1="80" x2="63" y2="82" stroke="#f59e0b" strokeWidth="2" />
      <line x1="57" y1="65" x2="67" y2="67" stroke="#f59e0b" strokeWidth="2" />
      <line x1="61" y1="50" x2="71" y2="52" stroke="#f59e0b" strokeWidth="2" />
      <line x1="65" y1="35" x2="75" y2="37" stroke="#f59e0b" strokeWidth="2" />
      {/* Serpentine Snake */}
      <path d="M110,25 Q80,45 105,60 T90,95" fill="none" stroke="#ef4444" strokeWidth="6" strokeLinecap="round" />
      <circle cx="112" cy="24" r="4.5" fill="#dc2626" />
      <circle cx="113" cy="23" r="1.2" fill="#ffffff" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 20. CHECKERS — King Draughts
// ─────────────────────────────────────────────────────────────────────────────
const checkers: GameArt = {
  background: "radial-gradient(ellipse at 50% 35%, #422006 0%, #1c0d02 60%, #0d0501 100%)",
  imageUrl: GAME_META.checkers.covers.landscape,
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      {/* Board Skew */}
      <g transform="translate(15, 20) skewX(-15)">
        <rect x="10" y="10" width="110" height="70" fill="#1c1917" stroke="#78350f" strokeWidth="2" />
        <rect x="25" y="10" width="18" height="18" fill="#78350f" />
        <rect x="61" y="10" width="18" height="18" fill="#78350f" />
        <rect x="97" y="10" width="18" height="18" fill="#78350f" />
        <rect x="10" y="28" width="18" height="18" fill="#78350f" />
        <rect x="43" y="28" width="18" height="18" fill="#78350f" />
        <rect x="79" y="28" width="18" height="18" fill="#78350f" />
      </g>
      {/* Red Crowned King Piece */}
      <ellipse cx="65" cy="55" rx="18" ry="10" fill="#dc2626" stroke="#fca5a5" strokeWidth="1.5" />
      <ellipse cx="65" cy="52" rx="14" ry="7" fill="#b91c1c" />
      {/* Crown */}
      <polygon points="60,52 62,45 65,49 68,45 70,52" fill="#fbbf24" stroke="#78350f" strokeWidth="0.8" />
      {/* Black Piece */}
      <ellipse cx="105" cy="72" rx="18" ry="10" fill="#27272a" stroke="#71717a" strokeWidth="1.5" />
      <ellipse cx="105" cy="69" rx="14" ry="7" fill="#18181b" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 21. BATTLESHIP — Naval Radar & Torpedo Strike
// ─────────────────────────────────────────────────────────────────────────────
const battleship: GameArt = {
  background: "radial-gradient(ellipse at 50% 35%, #083344 0%, #031c26 60%, #010a0e 100%)",
  imageUrl: GAME_META.battleship.covers.landscape,
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      {/* Radar Circles */}
      <circle cx="80" cy="60" r="45" fill="none" stroke="#06b6d4" strokeWidth="1.5" opacity="0.4" />
      <circle cx="80" cy="60" r="30" fill="none" stroke="#06b6d4" strokeWidth="1.5" opacity="0.6" />
      <circle cx="80" cy="60" r="15" fill="none" stroke="#06b6d4" strokeWidth="1.5" opacity="0.8" />
      <line x1="80" y1="15" x2="80" y2="105" stroke="#06b6d4" strokeWidth="1" opacity="0.5" />
      <line x1="35" y1="60" x2="125" y2="60" stroke="#06b6d4" strokeWidth="1" opacity="0.5" />
      {/* Naval Destroyer Silhouette */}
      <path d="M45,62 L75,56 L115,56 L120,62 L105,68 L55,68 Z" fill="#334155" stroke="#38bdf8" strokeWidth="1.5" />
      {/* Hit Blast Explosion */}
      <circle cx="95" cy="58" r="7" fill="#f97316" opacity="0.9" />
      <circle cx="95" cy="58" r="4" fill="#fde047" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 22. MEMORY MATCH — Holographic Dual Cards
// ─────────────────────────────────────────────────────────────────────────────
const memoryMatch: GameArt = {
  background: "radial-gradient(ellipse at 50% 35%, #4c1d95 0%, #2e1065 60%, #170738 100%)",
  imageUrl: GAME_META["memory-match"].covers.landscape,
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      {/* Card 1 */}
      <rect x="35" y="25" width="40" height="60" rx="6" fill="#1e1b4b" stroke="#818cf8" strokeWidth="2" transform="rotate(-8 55 55)" />
      <circle cx="53" cy="53" r="10" fill="#a855f7" />
      <polygon points="53,46 56,52 62,53 58,57 59,63 53,60 47,63 48,57 44,53 50,52" fill="#fde047" transform="rotate(-8 55 55)" />
      {/* Card 2 */}
      <rect x="85" y="25" width="40" height="60" rx="6" fill="#1e1b4b" stroke="#818cf8" strokeWidth="2" transform="rotate(8 105 55)" />
      <circle cx="107" cy="57" r="10" fill="#a855f7" />
      <polygon points="107,50 110,56 116,57 112,61 113,67 107,64 101,67 102,61 98,57 104,56" fill="#fde047" transform="rotate(8 105 55)" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 23. 2048 — Golden Synthesis
// ─────────────────────────────────────────────────────────────────────────────
const game2048: GameArt = {
  background: "radial-gradient(ellipse at 50% 35%, #713f12 0%, #422006 60%, #1a0c02 100%)",
  imageUrl: GAME_META["game-2048"].covers.landscape,
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      <rect x="25" y="15" width="110" height="90" rx="8" fill="#1e1b18" stroke="#854d0e" strokeWidth="2" />
      {/* 2048 Golden Tile */}
      <rect x="52" y="28" width="56" height="56" rx="8" fill="#eab308" stroke="#fef08a" strokeWidth="2" />
      <text x="80" y="63" fontSize="18" fontWeight="bold" fontFamily="sans-serif" fill="#ffffff" textAnchor="middle">2048</text>
      {/* Neighbor Tiles */}
      <rect x="32" y="28" width="16" height="16" rx="3" fill="#fed7aa" />
      <rect x="112" y="28" width="16" height="16" rx="3" fill="#fdba74" />
      <rect x="32" y="48" width="16" height="16" rx="3" fill="#fb923c" />
      <rect x="112" y="48" width="16" height="16" rx="3" fill="#f97316" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 24. MINESWEEPER — Digital Detonator
// ─────────────────────────────────────────────────────────────────────────────
const minesweeper: GameArt = {
  background: "radial-gradient(ellipse at 50% 35%, #334155 0%, #1e293b 60%, #0f172a 100%)",
  imageUrl: GAME_META.minesweeper.covers.landscape,
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      {/* Grid cells */}
      <rect x="30" y="20" width="100" height="80" rx="4" fill="#0f172a" stroke="#475569" strokeWidth="2" />
      {/* Revealed Cell with 3 */}
      <rect x="36" y="26" width="24" height="24" fill="#1e293b" />
      <text x="48" y="44" fontSize="16" fontWeight="bold" fontFamily="monospace" fill="#ef4444" textAnchor="middle">3</text>
      {/* Flagged Cell */}
      <rect x="68" y="26" width="24" height="24" fill="#334155" stroke="#475569" strokeWidth="1" />
      <polygon points="76,32 86,36 76,40" fill="#dc2626" />
      <line x1="76" y1="32" x2="76" y2="44" stroke="#f8fafc" strokeWidth="1.5" />
      {/* Spiky Naval Mine */}
      <rect x="100" y="26" width="24" height="24" fill="#1e293b" />
      <circle cx="112" cy="38" r="6" fill="#000000" stroke="#64748b" strokeWidth="1" />
      <line x1="112" y1="30" x2="112" y2="46" stroke="#000000" strokeWidth="2" />
      <line x1="104" y1="38" x2="120" y2="38" stroke="#000000" strokeWidth="2" />
      <line x1="106" y1="32" x2="118" y2="44" stroke="#000000" strokeWidth="2" />
      <line x1="118" y1="32" x2="106" y2="44" stroke="#000000" strokeWidth="2" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 25. WORD GUESS — Lexical Flip
// ─────────────────────────────────────────────────────────────────────────────
const wordGuess: GameArt = {
  background: "radial-gradient(ellipse at 50% 35%, #14532d 0%, #052e16 60%, #021a0c 100%)",
  imageUrl: GAME_META["word-guess"].covers.landscape,
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      {/* Row 1 */}
      {["P", "L", "A", "Y", "S"].map((letter, i) => {
        let bg = "#15803d";
        if (i === 1) bg = "#a16207";
        if (i === 4) bg = "#334155";
        return (
          <g key={letter} transform={`translate(${25 + i * 22}, 45)`}>
            <rect x="0" y="0" width="20" height="26" rx="3" fill={bg} stroke="#ffffff" strokeWidth="1" opacity="0.95" />
            <text x="10" y="19" fontSize="13" fontWeight="bold" fontFamily="sans-serif" fill="#ffffff" textAnchor="middle">{letter}</text>
          </g>
        );
      })}
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 26. CYBER BIRD — Neon Flap
// ─────────────────────────────────────────────────────────────────────────────
const flappyBird: GameArt = {
  background: "radial-gradient(ellipse at 50% 35%, #042f2e 0%, #082020 60%, #031010 100%)",
  imageUrl: GAME_META["flappy-bird"].covers.landscape,
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      {/* Neon Pipes */}
      <rect x="105" y="0" width="22" height="42" fill="#15803d" stroke="#4ade80" strokeWidth="2" />
      <rect x="102" y="36" width="28" height="8" rx="2" fill="#22c55e" stroke="#86efac" strokeWidth="1" />
      <rect x="105" y="75" width="22" height="45" fill="#15803d" stroke="#4ade80" strokeWidth="2" />
      <rect x="102" y="72" width="28" height="8" rx="2" fill="#22c55e" stroke="#86efac" strokeWidth="1" />
      {/* Cyber Bird */}
      <circle cx="55" cy="58" r="12" fill="#facc15" stroke="#fde047" strokeWidth="1.5" />
      <polygon points="65,58 72,61 65,65" fill="#f97316" />
      <circle cx="60" cy="54" r="2.5" fill="#000" />
      <circle cx="61" cy="53" r="0.8" fill="#fff" />
      <ellipse cx="48" cy="60" rx="6" ry="4" fill="#fbbf24" stroke="#d97706" strokeWidth="1" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 27. RETRO SNAKE — Neon Slither
// ─────────────────────────────────────────────────────────────────────────────
const retroSnake: GameArt = {
  background: "radial-gradient(ellipse at 50% 35%, #064e3b 0%, #022c22 60%, #01140f 100%)",
  imageUrl: GAME_META["retro-snake"].covers.landscape,
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      {/* Grid dots */}
      <circle cx="120" cy="60" r="5" fill="#ef4444" filter="drop-shadow(0 0 4px #ef4444)" />
      {/* Snake segments */}
      <rect x="90" y="55" width="10" height="10" rx="2" fill="#4ade80" />
      <rect x="78" y="55" width="10" height="10" rx="2" fill="#22c55e" />
      <rect x="66" y="55" width="10" height="10" rx="2" fill="#22c55e" />
      <rect x="66" y="67" width="10" height="10" rx="2" fill="#16a34a" />
      <rect x="54" y="67" width="10" height="10" rx="2" fill="#16a34a" />
      <rect x="42" y="67" width="10" height="10" rx="2" fill="#15803d" />
      {/* Head Eyes */}
      <circle cx="97" cy="57" r="1.2" fill="#000" />
      <circle cx="97" cy="62" r="1.2" fill="#000" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 28. CYBER PONG — Vector Rally
// ─────────────────────────────────────────────────────────────────────────────
const pong: GameArt = {
  background: "radial-gradient(ellipse at 50% 35%, #1e1b4b 0%, #0f0d2b 60%, #060514 100%)",
  imageUrl: GAME_META.pong.covers.landscape,
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      {/* Center Dotted Divider */}
      <line x1="80" y1="10" x2="80" y2="110" stroke="#475569" strokeWidth="2" strokeDasharray="5 5" />
      {/* Left Paddle */}
      <rect x="25" y="40" width="6" height="35" rx="3" fill="#38bdf8" filter="drop-shadow(0 0 6px #38bdf8)" />
      {/* Right Paddle */}
      <rect x="129" y="55" width="6" height="35" rx="3" fill="#f43f5e" filter="drop-shadow(0 0 6px #f43f5e)" />
      {/* Energy Ball with trail */}
      <line x1="50" y1="48" x2="72" y2="58" stroke="#38bdf8" strokeWidth="2" opacity="0.4" strokeDasharray="2 2" />
      <circle cx="72" cy="58" r="4.5" fill="#ffffff" filter="drop-shadow(0 0 5px #ffffff)" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 29. BRICK BREAKER — Arcade Breakout
// ─────────────────────────────────────────────────────────────────────────────
const brickBreaker: GameArt = {
  background: "radial-gradient(ellipse at 50% 35%, #3b0764 0%, #1e0338 60%, #0d011a 100%)",
  imageUrl: GAME_META["brick-breaker"].covers.landscape,
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      {/* Bricks */}
      {[0, 1, 2, 3].map((row) =>
        [0, 1, 2, 3, 4].map((col) => {
          const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e"];
          return (
            <rect
              key={`${row}-${col}`}
              x={28 + col * 21}
              y={20 + row * 11}
              width="19"
              height="8"
              rx="2"
              fill={colors[row]}
              opacity={col === 2 && row === 3 ? 0 : 0.9}
            />
          );
        })
      )}
      {/* Bouncing Ball */}
      <circle cx="75" cy="75" r="4" fill="#ffffff" filter="drop-shadow(0 0 4px #a855f7)" />
      {/* Sliding Paddle */}
      <rect x="55" y="100" width="40" height="7" rx="3.5" fill="#38bdf8" stroke="#bae6fd" strokeWidth="1.5" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 30. CYBER WHACK — Arcade Hammer Frenzy
// ─────────────────────────────────────────────────────────────────────────────
const whackAMole: GameArt = {
  background: "radial-gradient(ellipse at 50% 35%, #701a75 0%, #4a044e 60%, #240226 100%)",
  imageUrl: GAME_META["whack-a-mole"].covers.landscape,
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      {/* Holes */}
      <ellipse cx="45" cy="45" rx="18" ry="8" fill="#18181b" stroke="#3f3f46" strokeWidth="1.5" />
      <ellipse cx="115" cy="45" rx="18" ry="8" fill="#18181b" stroke="#3f3f46" strokeWidth="1.5" />
      <ellipse cx="80" cy="85" rx="22" ry="10" fill="#18181b" stroke="#3f3f46" strokeWidth="2" />
      {/* Popping Cyber Mole */}
      <g transform="translate(66, 52)">
        <rect x="0" y="0" width="28" height="26" rx="14" fill="#a16207" stroke="#ca8a04" strokeWidth="1.5" />
        <ellipse cx="14" cy="14" rx="6" ry="4" fill="#fde047" />
        <circle cx="10" cy="10" r="1.5" fill="#000" />
        <circle cx="18" cy="10" r="1.5" fill="#000" />
      </g>
      {/* Floating Hammer */}
      <g transform="translate(100, 48) rotate(-35)">
        <rect x="0" y="0" width="14" height="22" rx="3" fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" />
        <line x1="7" y1="22" x2="7" y2="40" stroke="#92400e" strokeWidth="3.5" strokeLinecap="round" />
      </g>
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 31. SIMON SAYS — Hypnotic Memory Core
// ─────────────────────────────────────────────────────────────────────────────
const simonSays: GameArt = {
  background: "radial-gradient(ellipse at 50% 35%, #1e293b 0%, #0f172a 60%, #020617 100%)",
  imageUrl: GAME_META["simon-says"].covers.landscape,
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      {/* 4 Quadrants Circle */}
      <g transform="translate(80, 60)">
        {/* Top-Left Green */}
        <path d="M-5,-42 A40,40 0 0,0 -42,-5 L-12,-5 A12,12 0 0,1 -5,-12 Z" fill="#22c55e" stroke="#4ade80" strokeWidth="1.5" />
        {/* Top-Right Red */}
        <path d="M5,-42 A40,40 0 0,1 42,-5 L12,-5 A12,12 0 0,0 5,-12 Z" fill="#ef4444" stroke="#f87171" strokeWidth="1.5" />
        {/* Bottom-Left Yellow */}
        <path d="M-5,42 A40,40 0 0,1 -42,5 L-12,5 A12,12 0 0,0 -5,12 Z" fill="#eab308" stroke="#facc15" strokeWidth="1.5" />
        {/* Bottom-Right Blue */}
        <path d="M5,42 A40,40 0 0,0 42,5 L12,5 A12,12 0 0,1 5,12 Z" fill="#3b82f6" stroke="#60a5fa" strokeWidth="1.5" />
        {/* Center Black Disc */}
        <circle cx="0" cy="0" r="10" fill="#090d16" stroke="#334155" strokeWidth="1.5" />
      </g>
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
  "tic-tac-toe": ticTacToe,
  "connect-four": connectFour,
  ludo,
  "snake-ladder": snakeLadder,
  checkers,
  battleship,
  "memory-match": memoryMatch,
  "game-2048": game2048,
  minesweeper,
  "word-guess": wordGuess,
  "flappy-bird": flappyBird,
  "retro-snake": retroSnake,
  pong,
  "brick-breaker": brickBreaker,
  "whack-a-mole": whackAMole,
  "simon-says": simonSays,
};

export function artFor(gameId: GameId | string): GameArt {
  return ART[gameId] ?? chess;
}

