"use client";

import * as React from "react";
import { cn } from "@playora/ui";
import type { UnoCard } from "@playora/game-engine";

/**
 * Exact replica of Real UNO Classic and UNO No Mercy cards.
 * Uses high-fidelity SVG graphics with accurate typography, 3D shadows,
 * tilted white oval, authentic action card icons, and No Mercy grunge splatters.
 */

export type CardSize = "xs" | "sm" | "md" | "lg" | "xl";

interface CardDimensions {
  w: number;
  h: number;
  radius: number;
  fontSize: number;
  cornerSize: number;
}

const DIMENSIONS: Record<CardSize, CardDimensions> = {
  xs: { w: 38,  h: 56,  radius: 4, fontSize: 20, cornerSize: 9 },
  sm: { w: 52,  h: 76,  radius: 6, fontSize: 28, cornerSize: 12 },
  md: { w: 72,  h: 106, radius: 8, fontSize: 38, cornerSize: 15 },
  lg: { w: 96,  h: 142, radius: 10, fontSize: 52, cornerSize: 19 },
  xl: { w: 120, h: 178, radius: 12, fontSize: 64, cornerSize: 24 },
};

// Authentic UNO Classic & No Mercy colors
export const COLOR_PALETTES = {
  classic: {
    red:    { main: "#D72638", dark: "#9E1321", light: "#FF4D5E" },
    yellow: { main: "#F5B700", dark: "#B38200", light: "#FFD447" },
    green:  { main: "#2E933C", dark: "#1B6325", light: "#4BD15D" },
    blue:   { main: "#0C69D1", dark: "#074288", light: "#3B92F5" },
    wild:   { main: "#1E1E24", dark: "#121216", light: "#32323A" },
  },
  noMercy: {
    red:    { main: "#B80C09", dark: "#4A0000", light: "#E0221E" },
    yellow: { main: "#D49A00", dark: "#5C4100", light: "#F5BD26" },
    green:  { main: "#1E6B2B", dark: "#0A3311", light: "#329944" },
    blue:   { main: "#0B4F9C", dark: "#032047", light: "#1C74DB" },
    wild:   { main: "#0A0A0A", dark: "#000000", light: "#1F1F1F" },
  },
};

// Format names
const VALUE_NAMES: Record<string, string> = {
  skip: "Skip",
  skip_everyone: "Skip Everyone",
  reverse: "Reverse",
  draw2: "Draw 2",
  draw4_color: "Draw 4",
  wild: "Wild",
  wild_draw4: "Wild Draw 4",
  wild_draw6: "Wild Draw 6",
  wild_draw10: "Wild Draw 10",
  wild_reverse_draw4: "Wild Reverse Draw 4",
  wild_roulette: "Wild Roulette",
  discard_all: "Discard All",
};

export function describeCard(card: UnoCard): string {
  const v = VALUE_NAMES[card.value] ?? card.value;
  return card.color ? `${card.color.toUpperCase()} ${v}` : v;
}

// Check if value needs underline (6 and 9)
function needsUnderline(value: string): boolean {
  return value === "6" || value === "9";
}

export function UnoCardFace({
  card,
  size = "md",
  playable,
  dimmed,
  faceDown,
  noMercy = false,
  className,
}: {
  card?: UnoCard;
  size?: CardSize;
  playable?: boolean;
  dimmed?: boolean;
  faceDown?: boolean;
  noMercy?: boolean;
  className?: string;
}) {
  const dim = DIMENSIONS[size];
  const palette = noMercy ? COLOR_PALETTES.noMercy : COLOR_PALETTES.classic;

  if (faceDown || !card) {
    return (
      <div
        className={cn(
          "relative select-none transition-transform duration-200",
          dimmed && "brightness-[0.4] grayscale-[0.3]",
          className
        )}
        style={{
          width: dim.w,
          height: dim.h,
          filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.6))",
        }}
      >
        <CardBackSvg dim={dim} noMercy={noMercy} />
      </div>
    );
  }

  const isWild = !card.color || card.value.startsWith("wild");
  const colorKey = (card.color ?? "wild") as keyof typeof palette;
  const col = palette[colorKey] ?? palette.red;

  return (
    <div
      className={cn(
        "relative select-none transition-all duration-200",
        dimmed && "brightness-[0.45] saturate-[0.6]",
        playable && "cursor-pointer filter hover:brightness-110",
        className
      )}
      style={{
        width: dim.w,
        height: dim.h,
        filter: playable
          ? "drop-shadow(0 0 10px rgba(255,255,255,0.85)) drop-shadow(0 8px 16px rgba(0,0,0,0.7))"
          : "drop-shadow(0 6px 12px rgba(0,0,0,0.6))",
      }}
    >
      <CardFrontSvg
        card={card}
        dim={dim}
        col={col}
        isWild={isWild}
        noMercy={noMercy}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CARD BACK SVG
// ─────────────────────────────────────────────────────────────────────────────
function CardBackSvg({ dim, noMercy }: { dim: CardDimensions; noMercy: boolean }) {
  const { w, h, radius } = dim;
  const id = React.useId();

  return (
    <svg width={w} height={h} viewBox="0 0 100 148" className="overflow-visible block">
      <defs>
        {/* Border gradient */}
        <linearGradient id={`back-border-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={noMercy ? "#222" : "#FFFFFF"} />
          <stop offset="100%" stopColor={noMercy ? "#111" : "#E5E5E5"} />
        </linearGradient>

        {/* Black body */}
        <radialGradient id={`back-body-${id}`} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={noMercy ? "#1A0505" : "#1A1A1F"} />
          <stop offset="100%" stopColor={noMercy ? "#050000" : "#0A0A0D"} />
        </radialGradient>

        {/* Red oval */}
        <linearGradient id={`back-oval-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={noMercy ? "#C41414" : "#E62626"} />
          <stop offset="50%" stopColor={noMercy ? "#8F0909" : "#C41313"} />
          <stop offset="100%" stopColor={noMercy ? "#5C0000" : "#8A0B0B"} />
        </linearGradient>

        {/* UNO Text Gradient */}
        <linearGradient id={`uno-gold-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF275" />
          <stop offset="35%" stopColor="#FFD000" />
          <stop offset="70%" stopColor="#E6A100" />
          <stop offset="100%" stopColor="#B37400" />
        </linearGradient>

        <filter id={`back-shadow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="1" dy="3" stdDeviation="2" floodColor="#000" floodOpacity="0.8" />
        </filter>
      </defs>

      {/* Card Outer Border */}
      <rect x="0" y="0" width="100" height="148" rx={radius * (100 / w)} fill={`url(#back-border-${id})`} />
      
      {/* Inner Black Card Body */}
      <rect x="4" y="4" width="92" height="140" rx={Math.max(2, radius * (100 / w) - 3)} fill={`url(#back-body-${id})`} />

      {/* Big Tilted Red Oval */}
      <g transform="translate(50, 74) rotate(-28)">
        <ellipse cx="0" cy="0" rx="42" ry="24" fill={`url(#back-oval-${id})`} stroke="#FFEA79" strokeWidth={noMercy ? "1.5" : "2"} />
        
        {/* UNO Logo in 3D Italic Typography */}
        <g filter={`url(#back-shadow-${id})`}>
          <text
            x="0"
            y="7"
            textAnchor="middle"
            fontFamily="Impact, 'Arial Black', sans-serif"
            fontStyle="italic"
            fontWeight="900"
            fontSize="28"
            letterSpacing="1"
            fill={`url(#uno-gold-${id})`}
            stroke="#000"
            strokeWidth="2.5"
            paintOrder="stroke fill"
          >
            UNO
          </text>
        </g>
      </g>

      {noMercy && (
        <text
          x="50"
          y="122"
          textAnchor="middle"
          fontFamily="Impact, 'Arial Black', sans-serif"
          fontWeight="900"
          fontSize="9"
          letterSpacing="1.5"
          fill="#FF3B30"
          stroke="#000"
          strokeWidth="1"
        >
          NO MERCY
        </text>
      )}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CARD FRONT SVG
// ─────────────────────────────────────────────────────────────────────────────
function CardFrontSvg({
  card,
  dim,
  col,
  isWild,
  noMercy,
}: {
  card: UnoCard;
  dim: CardDimensions;
  col: { main: string; dark: string; light: string };
  isWild: boolean;
  noMercy: boolean;
}) {
  const { w, h, radius } = dim;
  const id = React.useId();
  const val = card.value;

  return (
    <svg width={w} height={h} viewBox="0 0 100 148" className="overflow-visible block">
      <defs>
        {/* Outer border gradient */}
        <linearGradient id={`front-border-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={noMercy ? "#2A2A2A" : "#FFFFFF"} />
          <stop offset="100%" stopColor={noMercy ? "#111111" : "#E8E8E8"} />
        </linearGradient>

        {/* Card Body Gradient */}
        <radialGradient id={`front-body-${id}`} cx="45%" cy="40%" r="70%">
          <stop offset="0%" stopColor={noMercy ? col.main : col.light} />
          <stop offset="60%" stopColor={col.main} />
          <stop offset="100%" stopColor={col.dark} />
        </radialGradient>

        {/* Center Oval Gradient */}
        <linearGradient id={`center-oval-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#EDEDED" />
        </linearGradient>

        {/* Text Drop Shadow */}
        <filter id={`glyph-shadow-${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="1.5" dy="3" stdDeviation="1.5" floodColor="#000" floodOpacity="0.75" />
        </filter>

        {/* Wild 4-Quadrant Gradients */}
        <clipPath id={`oval-clip-${id}`}>
          <ellipse cx="0" cy="0" rx="38" ry="24" />
        </clipPath>
      </defs>

      {/* 1. Outer White/Black Border */}
      <rect
        x="0"
        y="0"
        width="100"
        height="148"
        rx={radius * (100 / w)}
        fill={noMercy ? "#050505" : `url(#front-border-${id})`}
        stroke={noMercy ? "#1C1C1C" : "none"}
        strokeWidth={noMercy ? "1" : "0"}
      />

      {/* 2. Inner Card Body: Solid Black for No Mercy, Vibrant Gradient for Classic */}
      <rect
        x="4"
        y="4"
        width="92"
        height="140"
        rx={Math.max(2, radius * (100 / w) - 3)}
        fill={
          isWild
            ? (noMercy ? "#000000" : "#1A1A1E")
            : noMercy
            ? "#0A0A0C"
            : `url(#front-body-${id})`
        }
      />

      {/* 3. Central Tilted Oval: Colored Grunge/Splatter for No Mercy, Crisp White for Classic */}
      <g transform="translate(50, 74) rotate(-28)">
        {isWild ? (
          /* Wild 4-color pinwheel inside oval */
          <g clipPath={`url(#oval-clip-${id})`}>
            {/* Top-Right: Yellow */}
            <path d="M0,0 L50,-50 L50,0 Z" fill="#F5B700" />
            <path d="M0,0 L50,0 L50,50 L0,50 Z" fill="#0C69D1" />
            {/* Bottom-Left: Green */}
            <path d="M0,0 L0,50 L-50,50 L-50,0 Z" fill="#2E933C" />
            {/* Top-Left: Red */}
            <path d="M0,0 L-50,0 L-50,-50 L0,-50 Z" fill="#D72638" />
            <ellipse cx="0" cy="0" rx="38" ry="24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" />
          </g>
        ) : noMercy ? (
          /* No Mercy Colored Grunge Splatter Center Oval */
          <g>
            <ellipse
              cx="0"
              cy="0"
              rx="40"
              ry="26"
              fill={`url(#front-body-${id})`}
              stroke="#000"
              strokeWidth="2"
            />
            {/* Distressed ink splash texture */}
            <ellipse
              cx="0"
              cy="0"
              rx="34"
              ry="20"
              fill="#0A0A0C"
              opacity="0.25"
            />
          </g>
        ) : (
          /* Classic Solid White Oval */
          <ellipse
            cx="0"
            cy="0"
            rx="38"
            ry="24"
            fill={`url(#center-oval-${id})`}
            stroke="#FFF"
            strokeWidth="1"
          />
        )}
      </g>

      {/* 4. Center Glyph / Number / Symbol */}
      <CenterGlyph val={val} shadowId={`glyph-shadow-${id}`} />

      {/* 5. Top-Left Corner Marking */}
      <CornerGlyph x={11} y={18} val={val} isWild={isWild} rotate={0} />

      {/* 6. Bottom-Right Corner Marking (Rotated 180) */}
      <CornerGlyph x={89} y={130} val={val} isWild={isWild} rotate={180} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CENTER GLYPH RENDERER
// ─────────────────────────────────────────────────────────────────────────────
function CenterGlyph({
  val,
  shadowId,
}: {
  val: string;
  shadowId: string;
}) {
  const isNum = /^[0-9]$/.test(val);
  const underline = needsUnderline(val);

  if (isNum) {
    return (
      <g filter={`url(#${shadowId})`}>
        <text
          x="50"
          y="93"
          textAnchor="middle"
          fontFamily="Impact, 'Arial Black', sans-serif"
          fontStyle="italic"
          fontWeight="900"
          fontSize="56"
          fill="#FFFFFF"
          stroke="#000000"
          strokeWidth="3.5"
          paintOrder="stroke fill"
        >
          {val}
        </text>
        {underline && (
          <line
            x1="36"
            y1="98"
            x2="64"
            y2="98"
            stroke="#000000"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
        )}
      </g>
    );
  }

  // Draw 2 (+2): Two overlapping cards or "+2" text
  if (val === "draw2") {
    return (
      <g filter={`url(#${shadowId})`}>
        {/* Mini overlapping cards */}
        <rect x="36" y="55" width="18" height="26" rx="2" fill="#FFF" stroke="#000" strokeWidth="1.8" />
        <rect x="44" y="63" width="18" height="26" rx="2" fill="#FFF" stroke="#000" strokeWidth="1.8" />
      </g>
    );
  }

  // Reverse (⇄): Classic curved double arrows
  if (val === "reverse" || val === "wild_reverse_draw4") {
    return (
      <g filter={`url(#${shadowId})`} transform="translate(50, 74)">
        {/* Top arrow pointing right */}
        <path
          d="M-18,-8 L6,-8 M2,-15 L14,-8 L2,-1"
          stroke="#FFFFFF"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Bottom arrow pointing left */}
        <path
          d="M18,8 L-6,8 M-2,15 L-14,8 L-2,1"
          stroke="#FFFFFF"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    );
  }

  // Skip (⊘): Prohibitory circle with slash
  if (val === "skip" || val === "skip_everyone") {
    return (
      <g filter={`url(#${shadowId})`} transform="translate(50, 74)">
        <circle cx="0" cy="0" r="19" fill="none" stroke="#FFFFFF" strokeWidth="6" />
        <line x1="-13" y1="-13" x2="13" y2="13" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
      </g>
    );
  }

  // Wild Draw 4 (+4): 4 colored overlapping mini cards
  if (val === "wild_draw4" || val === "draw4_color") {
    return (
      <g filter={`url(#${shadowId})`} transform="translate(50, 74)">
        {/* 4 Fan Cards */}
        <rect x="-18" y="-22" width="15" height="22" rx="2" fill="#D72638" stroke="#FFF" strokeWidth="1.5" transform="rotate(-15)" />
        <rect x="-6" y="-25" width="15" height="22" rx="2" fill="#0C69D1" stroke="#FFF" strokeWidth="1.5" transform="rotate(0)" />
        <rect x="6" y="-22" width="15" height="22" rx="2" fill="#F5B700" stroke="#FFF" strokeWidth="1.5" transform="rotate(15)" />
        <rect x="-3" y="-14" width="15" height="22" rx="2" fill="#2E933C" stroke="#FFF" strokeWidth="1.5" transform="rotate(5)" />
      </g>
    );
  }

  // Wild Draw 6 & 10 (No Mercy special cards)
  if (val === "wild_draw6" || val === "wild_draw10") {
    const textVal = val === "wild_draw6" ? "+6" : "+10";
    return (
      <g filter={`url(#${shadowId})`}>
        <text
          x="50"
          y="88"
          textAnchor="middle"
          fontFamily="Impact, 'Arial Black', sans-serif"
          fontStyle="italic"
          fontWeight="900"
          fontSize={val === "wild_draw10" ? "34" : "42"}
          fill="#FFFFFF"
          stroke="#000000"
          strokeWidth="3"
          paintOrder="stroke fill"
        >
          {textVal}
        </text>
      </g>
    );
  }

  // Discard All or Wild Roulette
  if (val === "discard_all") {
    return (
      <g filter={`url(#${shadowId})`} transform="translate(50, 74)">
        <text
          x="0"
          y="10"
          textAnchor="middle"
          fontFamily="Impact, 'Arial Black', sans-serif"
          fontWeight="900"
          fontSize="24"
          fill="#FFF"
          stroke="#000"
          strokeWidth="2"
        >
          DISCARD
        </text>
      </g>
    );
  }

  // Pure Wild card: Pinwheel is already rendered in the oval
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORNER GLYPH RENDERER (Top-Left & Bottom-Right)
// ─────────────────────────────────────────────────────────────────────────────
function CornerGlyph({
  x,
  y,
  val,
  isWild,
  rotate,
}: {
  x: number;
  y: number;
  val: string;
  isWild: boolean;
  rotate: number;
}) {
  const isNum = /^[0-9]$/.test(val);
  const underline = needsUnderline(val);

  let label = val;
  if (val === "skip" || val === "skip_everyone") label = "⊘";
  else if (val === "reverse" || val === "wild_reverse_draw4") label = "⇄";
  else if (val === "draw2") label = "+2";
  else if (val === "wild_draw4" || val === "draw4_color") label = "+4";
  else if (val === "wild_draw6") label = "+6";
  else if (val === "wild_draw10") label = "+10";
  else if (val === "discard_all") label = "✦";
  else if (isWild) label = "✦";

  return (
    <g transform={`translate(${x}, ${y}) rotate(${rotate})`}>
      <text
        x="0"
        y="0"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Impact, 'Arial Black', sans-serif"
        fontStyle="italic"
        fontWeight="900"
        fontSize={label.length > 2 ? "11" : "15"}
        fill="#FFFFFF"
        stroke="#000000"
        strokeWidth="2"
        paintOrder="stroke fill"
      >
        {label}
      </text>
      {underline && isNum && (
        <line
          x1="-4"
          y1="6"
          x2="4"
          y2="6"
          stroke="#000000"
          strokeWidth="1.8"
        />
      )}
    </g>
  );
}
