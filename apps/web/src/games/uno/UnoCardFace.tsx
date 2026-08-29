"use client";

import * as React from "react";
import { cn } from "@playora/ui";
import type { UnoCard } from "@playora/game-engine";

/**
 * A real UNO card has a specific anatomy: a coloured body inside a thick white
 * border, a white ellipse rotated across the middle, a large glyph inside that
 * ellipse, and small glyphs in opposite corners. Reproducing that is what makes
 * it read as a card rather than a coloured rectangle with a number on it.
 */

const BODY: Record<string, { base: string; deep: string }> = {
  red: { base: "#E4483B", deep: "#B32E23" },
  yellow: { base: "#E8B02E", deep: "#B8871A" },
  green: { base: "#3FA55A", deep: "#2A7B41" },
  blue: { base: "#2C7BE5", deep: "#1B5AB0" },
};

const SIZES = {
  xs: { w: 34, h: 50, glyph: 15, corner: 8 },
  sm: { w: 46, h: 68, glyph: 20, corner: 9 },
  md: { w: 66, h: 98, glyph: 30, corner: 12 },
  lg: { w: 84, h: 124, glyph: 38, corner: 14 },
} as const;

export type CardSize = keyof typeof SIZES;

/** Symbols carry the meaning that colour alone must not (spec §32). */
function glyphFor(value: string): string {
  switch (value) {
    case "skip":
      return "🚫";
    case "skip_everyone":
      return "⊘";
    case "reverse":
    case "wild_reverse_draw4":
      return "⇄";
    case "draw2":
      return "+2";
    case "draw4_color":
    case "wild_draw4":
      return "+4";
    case "wild_draw6":
      return "+6";
    case "wild_draw10":
      return "+10";
    case "discard_all":
      return "✦";
    case "wild":
      return "W";
    case "wild_roulette":
      return "?";
    default:
      return value;
  }
}

const VALUE_NAMES: Partial<Record<UnoCard["value"], string>> = {
  skip: "Skip",
  reverse: "Reverse",
  draw2: "Draw Two",
  wild: "Wild",
  wild_draw4: "Wild Draw Four",
  draw4_color: "Draw Four",
  skip_everyone: "Skip Everyone",
  discard_all: "Discard All",
  wild_draw6: "Wild Draw Six",
  wild_draw10: "Wild Draw Ten",
  wild_reverse_draw4: "Wild Reverse Draw Four",
  wild_roulette: "Colour Roulette",
};

export function describeCard(card: UnoCard): string {
  const value = VALUE_NAMES[card.value] ?? card.value;
  return card.color ? `${card.color} ${value}` : value;
}

const WILD_VALUES = new Set([
  "wild",
  "wild_draw4",
  "wild_draw6",
  "wild_draw10",
  "wild_reverse_draw4",
  "wild_roulette",
]);

export function UnoCardFace({
  card,
  size = "md",
  playable,
  dimmed,
  faceDown,
  className,
}: {
  card?: UnoCard;
  size?: CardSize;
  playable?: boolean;
  dimmed?: boolean;
  faceDown?: boolean;
  className?: string;
}) {
  const s = SIZES[size];

  if (faceDown || !card) {
    return (
      <div
        aria-hidden
        className={cn("relative shrink-0 select-none rounded-[12%] shadow-raised", className)}
        style={{ width: s.w, height: s.h, background: "#1A1A22", padding: s.w * 0.07 }}
      >
        <div
          className="flex h-full w-full items-center justify-center rounded-[10%]"
          style={{ background: "linear-gradient(145deg,#2A2A38,#14141C)" }}
        >
          {/* The signature red oval on the back of the deck. */}
          <div
            className="flex items-center justify-center rounded-[50%] font-display font-black italic text-white"
            style={{
              width: "78%",
              height: "48%",
              transform: "rotate(-20deg)",
              background: "#E4483B",
              fontSize: s.glyph * 0.42,
              letterSpacing: "0.02em",
            }}
          >
            UNO
          </div>
        </div>
      </div>
    );
  }

  const isWild = WILD_VALUES.has(card.value);
  const body = BODY[card.color ?? ""] ?? BODY.red!;
  const glyph = glyphFor(card.value);
  const isEmoji = /\p{Emoji}/u.test(glyph);

  return (
    <div
      className={cn(
        "relative shrink-0 select-none rounded-[12%] transition-[filter,box-shadow]",
        dimmed && "brightness-[0.45] saturate-[0.6]",
        playable && "shadow-[0_0_0_3px_rgba(255,255,255,0.9),0_10px_28px_-6px_rgba(0,0,0,0.7)]",
        !playable && "shadow-raised",
        className,
      )}
      style={{ width: s.w, height: s.h, background: "#FFFFFF", padding: s.w * 0.07 }}
    >
      <div
        className="relative h-full w-full overflow-hidden rounded-[10%]"
        style={{
          background: isWild
            ? "conic-gradient(from 45deg,#E4483B 0deg 90deg,#E8B02E 90deg 180deg,#3FA55A 180deg 270deg,#2C7BE5 270deg 360deg)"
            : `linear-gradient(150deg, ${body.base}, ${body.deep})`,
        }}
      >
        {/* The white ellipse the value sits in. */}
        <div
          className="absolute left-1/2 top-1/2 rounded-[50%] bg-white"
          style={{
            width: "128%",
            height: "58%",
            transform: "translate(-50%,-50%) rotate(-22deg)",
            boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
          }}
        />

        <span
          className="absolute left-1/2 top-1/2 font-display font-black leading-none"
          style={{
            transform: "translate(-50%,-50%)",
            fontSize: isEmoji ? s.glyph * 0.8 : s.glyph,
            color: isWild ? "#1A1A22" : body.deep,
            textShadow: isWild ? "none" : "0 1px 0 rgba(255,255,255,0.35)",
          }}
        >
          {glyph}
        </span>

        {/* Corner marks, mirrored, as on a real card. */}
        <span
          className="absolute font-display font-black leading-none text-white"
          style={{ top: "5%", left: "7%", fontSize: s.corner }}
        >
          {glyph}
        </span>
        <span
          className="absolute font-display font-black leading-none text-white"
          style={{ bottom: "5%", right: "7%", fontSize: s.corner, transform: "rotate(180deg)" }}
        >
          {glyph}
        </span>
      </div>
    </div>
  );
}
