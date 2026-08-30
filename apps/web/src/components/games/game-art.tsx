import type { GameId } from "@playora/game-types";

/**
 * Cover art, drawn rather than borrowed.
 *
 * The tiles previously used emoji — ♞, 🎴, 🏎️ — on a gradient. Emoji are a
 * font, not artwork: they render differently on every platform, sit on their
 * own baseline, and cannot be composed or scaled with the rest of the tile.
 * That is what made the catalogue look unfinished.
 *
 * Each cover is authored SVG in the game's own visual language, so a racing
 * tile promises the neon circuit the game actually opens with. No third-party
 * assets are involved (spec section 114).
 */

export interface GameArt {
  /** Behind the illustration. */
  background: string;
  /** The illustration itself, drawn into a 160x120 viewBox. */
  Art: (props: { className?: string }) => React.ReactElement;
}

const chess: GameArt = {
  background: "linear-gradient(155deg,#2a2118 0%,#4a381f 45%,#7a5c33 100%)",
  Art: ({ className }) => (
    <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
      {/* A corner of a board, in perspective, so it reads as a game not a pattern. */}
      <g opacity="0.5">
        {Array.from({ length: 4 }).map((_, row) =>
          Array.from({ length: 4 }).map((_, col) =>
            (row + col) % 2 === 0 ? (
              <rect
                key={`${row}-${col}`}
                x={78 + col * 20}
                y={54 + row * 15}
                width="20"
                height="15"
                fill="#f0d9a7"
                opacity={0.85 - row * 0.14}
              />
            ) : null,
          ),
        )}
      </g>

      {/* Knight, in the same authored style as the in-game piece set. */}
      <g transform="translate(30 22) scale(1.5)">
        <path
          d="M14 6c-4 0-7 2-9 6l-3 6 4 2 2-3 2 1-3 8h18c1-8-1-14-5-17-2-2-4-3-6-3z"
          fill="#f5e6c8"
          stroke="#3a2a15"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <circle cx="10" cy="12" r="1.3" fill="#3a2a15" />
        <path d="M1 30h24v4H1z" fill="#f5e6c8" stroke="#3a2a15" strokeWidth="1.4" />
      </g>
    </svg>
  ),
};

/** A fan of cards, in the UNO palette. */
function cardFan(colours: string[], accent: string) {
  return function Art({ className }: { className?: string }) {
    return (
      <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
        {colours.map((colour, i) => {
          const angle = -26 + i * 17;
          return (
            <g key={colour + i} transform={`translate(80 78) rotate(${angle}) translate(-16 -52)`}>
              <rect
                width="32"
                height="48"
                rx="4"
                fill={colour}
                stroke="#ffffff"
                strokeWidth="2.5"
              />
              <ellipse cx="16" cy="24" rx="11" ry="16" fill="#ffffff" opacity="0.9" />
              <ellipse cx="16" cy="24" rx="8" ry="12" fill={colour} opacity="0.55" />
            </g>
          );
        })}
        <circle cx="80" cy="30" r="13" fill={accent} opacity="0.95" />
        <path
          d="M74 25h3v7a2 2 0 004 0v-7h3v7a6 6 0 01-10 0z"
          fill="#ffffff"
        />
      </svg>
    );
  };
}

const uno: GameArt = {
  background: "linear-gradient(155deg,#6d1210 0%,#c3312a 45%,#e8933a 100%)",
  Art: cardFan(["#d63b30", "#e8b53a", "#3aa655", "#3a7ad6"], "#1a1030"),
};

const unoNoMercy: GameArt = {
  background: "linear-gradient(155deg,#16091f 0%,#4a0f36 45%,#9c1246 100%)",
  Art: cardFan(["#8b1030", "#1a1030", "#b3184f", "#2a0f3a"], "#ff2d6f"),
};

/** The neon circuit, so the tile promises what the game opens with. */
function circuit(vehicle: "car" | "bike") {
  return function Art({ className }: { className?: string }) {
    return (
      <svg viewBox="0 0 160 120" className={className} aria-hidden focusable="false">
        {/* Road converging to a vanishing point. */}
        <path d="M52 120 L74 44 L86 44 L108 120 Z" fill="#3a1f63" />
        <path d="M52 120 L74 44 L70 44 L36 120 Z" fill="#ff2fd0" opacity="0.75" />
        <path d="M108 120 L86 44 L90 44 L124 120 Z" fill="#c026d3" opacity="0.75" />

        {/* Centre dashes. */}
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x={79 - i * 0.4}
            y={52 + i * 15}
            width={1.6 + i * 0.9}
            height={6 + i * 3}
            fill="#a78bfa"
            opacity={0.35 + i * 0.15}
          />
        ))}

        {/* Skyline. */}
        <g fill="#1b0d38" opacity="0.9">
          <rect x="6" y="26" width="16" height="40" />
          <rect x="26" y="14" width="12" height="52" />
          <rect x="122" y="20" width="14" height="46" />
          <rect x="140" y="32" width="14" height="34" />
        </g>

        {vehicle === "car" ? (
          <g transform="translate(80 96)">
            <rect x="-19" y="-12" width="38" height="15" rx="3" fill="#ff2b3d" />
            <rect x="-13" y="-20" width="26" height="9" rx="3" fill="#e01e30" />
            <rect x="-11" y="-18" width="22" height="6" rx="2" fill="#0d0a1c" />
            <rect x="-22" y="-2" width="9" height="9" rx="3" fill="#14101f" />
            <rect x="13" y="-2" width="9" height="9" rx="3" fill="#14101f" />
            <rect x="-15" y="-6" width="7" height="4" rx="1.5" fill="#ff6b7a" />
            <rect x="8" y="-6" width="7" height="4" rx="1.5" fill="#ff6b7a" />
          </g>
        ) : (
          <g transform="translate(80 96)">
            <circle cx="0" cy="0" r="8" fill="none" stroke="#14101f" strokeWidth="3.5" />
            <circle cx="0" cy="-20" r="6" fill="none" stroke="#14101f" strokeWidth="3" />
            <path d="M0 0 L2 -14 L-2 -20" fill="none" stroke="#22d3ee" strokeWidth="4" strokeLinecap="round" />
            <ellipse cx="0" cy="-24" rx="6" ry="7" fill="#1a1030" />
            <rect x="-4" y="-5" width="8" height="4" rx="1.5" fill="#ff6b7a" />
          </g>
        )}
      </svg>
    );
  };
}

const carRace: GameArt = {
  background: "linear-gradient(155deg,#140a2e 0%,#2a1152 45%,#3d1b6b 100%)",
  Art: circuit("car"),
};

const bikeRace: GameArt = {
  background: "linear-gradient(155deg,#0d1a2e 0%,#123a52 45%,#1b5f6b 100%)",
  Art: circuit("bike"),
};

const ART: Record<string, GameArt> = {
  chess,
  uno,
  "uno-no-mercy": unoNoMercy,
  "car-race": carRace,
  "bike-race": bikeRace,
};

export function artFor(gameId: GameId | string): GameArt {
  return ART[gameId] ?? chess;
}
