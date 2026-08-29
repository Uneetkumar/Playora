"use client";

import { cn } from "@playora/ui";
import type { UnoCard } from "@playora/game-engine";

/** Colour styling per suit. Kept in one place so cards can never drift apart. */
const COLOR_CLASS: Record<string, string> = {
  red: "bg-[#E4483B] border-[#F2695C]",
  yellow: "bg-[#E2A93B] border-[#F0C25C]",
  green: "bg-[#3FA55A] border-[#5FC079]",
  blue: "bg-[#2C7BE5] border-[#5296EE]",
};

const WILD_CLASS =
  "bg-[conic-gradient(at_50%_50%,#E4483B_0deg_90deg,#E2A93B_90deg_180deg,#3FA55A_180deg_270deg,#2C7BE5_270deg_360deg)] border-foreground/30";

/** Symbols carry meaning that colour alone must not (spec section 32). */
const SYMBOL: Record<string, string> = {
  skip: "⃠",
  reverse: "⇄",
  draw2: "+2",
  wild: "★",
  wild_draw4: "+4",
};

export function UnoCardFace({
  card,
  size = "md",
  playable,
  selected,
  faceDown,
  className,
}: {
  card?: UnoCard;
  size?: "sm" | "md" | "lg";
  playable?: boolean;
  selected?: boolean;
  faceDown?: boolean;
  className?: string;
}) {
  const dims = {
    sm: "h-14 w-10 text-sm",
    md: "h-24 w-16 text-xl",
    lg: "h-32 w-22 text-2xl",
  }[size];

  if (faceDown || !card) {
    return (
      <div
        aria-hidden
        className={cn(
          "flex items-center justify-center rounded-lg border-2 border-border bg-card",
          "bg-[radial-gradient(circle_at_30%_30%,hsl(var(--primary)/0.35),transparent_60%)]",
          dims,
          className,
        )}
      >
        <span className="font-display text-xs font-bold text-muted-foreground">UNO</span>
      </div>
    );
  }

  const isWild = card.value === "wild" || card.value === "wild_draw4";
  const label = SYMBOL[card.value] ?? card.value;
  const colorClass = isWild ? WILD_CLASS : (COLOR_CLASS[card.color ?? "red"] ?? COLOR_CLASS.red!);

  return (
    <div
      className={cn(
        "relative flex select-none items-center justify-center rounded-lg border-2 font-display font-extrabold text-white shadow-raised transition-transform",
        colorClass,
        dims,
        playable && "ring-2 ring-foreground/70 ring-offset-2 ring-offset-background",
        selected && "-translate-y-3",
        className,
      )}
    >
      <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{label}</span>
      {/* Small corner marks, as on a real card. */}
      <span className="absolute left-1 top-0.5 text-[9px] opacity-90">{label}</span>
      <span className="absolute bottom-0.5 right-1 rotate-180 text-[9px] opacity-90">{label}</span>
    </div>
  );
}

/** Accessible name for a card. Number cards fall through to their own value. */
const VALUE_NAMES: Partial<Record<UnoCard["value"], string>> = {
  skip: "Skip",
  reverse: "Reverse",
  draw2: "Draw Two",
  wild: "Wild",
  wild_draw4: "Wild Draw Four",
};

export function describeCard(card: UnoCard): string {
  const value = VALUE_NAMES[card.value] ?? card.value;
  return card.color ? `${card.color} ${value}` : value;
}
