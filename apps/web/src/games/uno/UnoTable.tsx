"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@playora/ui";
import type { UnoCard } from "@playora/game-engine";
import { UnoCardFace } from "./UnoCardFace";

// ─────────────────────────────────────────────────────────────────────────────
// 3D DECK PILE (Draw Pile with Realistic Stack Thickness)
// ─────────────────────────────────────────────────────────────────────────────
export function DrawDeck3D({
  count: _count,
  onDraw,
  disabled,
  pendingDraw,
  noMercy = false,
}: {
  count: number;
  onDraw: () => void;
  disabled?: boolean;
  pendingDraw: number;
  noMercy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onDraw}
      disabled={disabled}
      aria-label={pendingDraw > 0 ? `Draw ${pendingDraw} cards` : "Draw a card from deck"}
      className={cn(
        "group relative flex flex-col items-center select-none transition-transform duration-200",
        disabled ? "cursor-not-allowed opacity-80" : "cursor-pointer hover:scale-105 active:scale-95"
      )}
      style={{
        transform: "rotate(-6deg)",
      }}
    >
      {/* 3D Stack Base Shadows & Layers */}
      <div className="relative">
        {/* Layer 3 */}
        <div
          className="absolute inset-0 rounded-[10px] bg-black/80"
          style={{ transform: "translate(6px, 8px)" }}
        />
        {/* Layer 2 (White card edges) */}
        <div
          className="absolute inset-0 rounded-[10px] bg-neutral-300 border border-neutral-400"
          style={{ transform: "translate(3px, 4px)" }}
        />
        {/* Layer 1 (Top Card) */}
        <div className="relative">
          <UnoCardFace faceDown size="lg" noMercy={noMercy} />
        </div>
      </div>

      {/* Pending draw badge if +2 or +4 stacked */}
      {pendingDraw > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ repeat: Infinity, duration: 1.2 }}
          className="absolute -top-3 -right-3 z-30 rounded-full bg-rose-600 px-2.5 py-1 text-xs font-black text-white shadow-[0_0_12px_rgba(225,29,72,0.9)]"
        >
          +{pendingDraw}
        </motion.span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D DISCARD PILE (With Card Rotation, Stack Layering, and Active Color Badge)
// ─────────────────────────────────────────────────────────────────────────────
const COLOR_MAP: Record<string, { name: string; bg: string; text: string; glow: string; border: string }> = {
  red: { name: "RED", bg: "#D72638", text: "#FFFFFF", glow: "rgba(215, 38, 56, 0.9)", border: "#FF4D5E" },
  yellow: { name: "YELLOW", bg: "#F5B700", text: "#000000", glow: "rgba(245, 183, 0, 0.95)", border: "#FFD447" },
  green: { name: "GREEN", bg: "#2E933C", text: "#FFFFFF", glow: "rgba(46, 147, 60, 0.9)", border: "#4BD15D" },
  blue: { name: "BLUE", bg: "#0C69D1", text: "#FFFFFF", glow: "rgba(12, 105, 209, 0.9)", border: "#3B92F5" },
};

export function DiscardPile3D({
  cards,
  activeColor,
  noMercy = false,
}: {
  cards: UnoCard[];
  activeColor?: string | null;
  noMercy?: boolean;
}) {
  const topCard = cards[cards.length - 1];
  const isWildCard = topCard ? (topCard.color === null || topCard.value.startsWith("wild")) : false;
  const chosenColorInfo = activeColor ? COLOR_MAP[activeColor.toLowerCase()] : null;

  return (
    <div
      className="relative flex items-center justify-center select-none"
      style={{
        transform: "rotate(4deg)",
      }}
    >
      {/* Under-card shadow stack */}
      <div
        className="absolute inset-0 rounded-[10px] bg-black/60"
        style={{ transform: "translate(4px, 6px)" }}
      />
      {cards.length > 1 && (
        <div
          className="absolute inset-0 rounded-[10px] bg-neutral-200 border border-neutral-400"
          style={{ transform: "translate(-3px, 3px) rotate(-8deg)" }}
        />
      )}

      {/* Glowing active-color halo if a wild card declared a color */}
      {isWildCard && chosenColorInfo && (
        <motion.div
          animate={{
            scale: [1, 1.08, 1],
            opacity: [0.75, 1, 0.75],
          }}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          className="absolute -inset-2 rounded-2xl pointer-events-none"
          style={{
            boxShadow: `0 0 25px ${chosenColorInfo.glow}, inset 0 0 15px ${chosenColorInfo.glow}`,
            border: `2px solid ${chosenColorInfo.border}`,
          }}
        />
      )}

      {topCard ? (
        <div className="relative">
          <motion.div
            key={topCard.id}
            initial={{ scale: 1.25, y: -20, opacity: 0.8 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
          >
            <UnoCardFace card={topCard} size="lg" noMercy={noMercy} />
          </motion.div>

          {/* Active Chosen Color Badge */}
          {isWildCard && chosenColorInfo && (
            <motion.div
              initial={{ scale: 0, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black shadow-2xl border border-white/80 whitespace-nowrap select-none"
              style={{
                background: chosenColorInfo.bg,
                color: chosenColorInfo.text,
                boxShadow: `0 4px 15px ${chosenColorInfo.glow}`,
              }}
            >
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              <span>{chosenColorInfo.name}</span>
            </motion.div>
          )}
        </div>
      ) : (
        <div className="h-[142px] w-[96px] rounded-[10px] border-2 border-dashed border-white/20 bg-white/5" />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GLOWING DIRECTION ARROW RING
// ─────────────────────────────────────────────────────────────────────────────
export function DirectionRing({
  direction,
  noMercy = false,
}: {
  direction: 1 | -1;
  noMercy?: boolean;
}) {
  const isClockwise = direction === 1;
  const glowColor = noMercy ? "#FF4500" : "#4F46E5";

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <motion.svg
        animate={{ rotate: isClockwise ? 360 : -360 }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        viewBox="0 0 400 400"
        className="h-[340px] w-[340px] opacity-75"
        style={{ filter: `drop-shadow(0 0 16px ${glowColor})` }}
      >
        <defs>
          <linearGradient id="dir-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={noMercy ? "#FF8C00" : "#A78BFA"} stopOpacity="0.8" />
            <stop offset="50%" stopColor={noMercy ? "#FF2200" : "#6366F1"} stopOpacity="0.5" />
            <stop offset="100%" stopColor={noMercy ? "#FF7700" : "#38BDF8"} stopOpacity="0.8" />
          </linearGradient>
        </defs>

        {/* Circular Dashed Arc */}
        <circle
          cx="200"
          cy="200"
          r="150"
          fill="none"
          stroke="url(#dir-grad)"
          strokeWidth="3"
          strokeDasharray="14 10"
          opacity="0.6"
        />

        {/* Curved Flow Arrows */}
        {isClockwise ? (
          <>
            {/* Top Right Arrow */}
            <path
              d="M200 40 A160 160 0 0 1 360 200"
              fill="none"
              stroke="url(#dir-grad)"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <polygon points="360,200 348,180 372,180" fill={noMercy ? "#FF8C00" : "#38BDF8"} />

            {/* Bottom Left Arrow */}
            <path
              d="M200 360 A160 160 0 0 1 40 200"
              fill="none"
              stroke="url(#dir-grad)"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <polygon points="40,200 52,220 28,220" fill={noMercy ? "#FF8C00" : "#38BDF8"} />
          </>
        ) : (
          <>
            {/* Counter-Clockwise Top Left */}
            <path
              d="M200 40 A160 160 0 0 0 40 200"
              fill="none"
              stroke="url(#dir-grad)"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <polygon points="40,200 28,180 52,180" fill={noMercy ? "#FF8C00" : "#38BDF8"} />

            {/* Counter-Clockwise Bottom Right */}
            <path
              d="M200 360 A160 160 0 0 0 360 200"
              fill="none"
              stroke="url(#dir-grad)"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <polygon points="360,200 372,220 348,220" fill={noMercy ? "#FF8C00" : "#38BDF8"} />
          </>
        )}
      </motion.svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SPATIAL SEAT POD (For Up to 7 Opponents Around Oval Table)
// ─────────────────────────────────────────────────────────────────────────────
export function SpatialPlayerPod({
  name,
  avatar,
  cardCount,
  isActive,
  hasCalledUno,
  noMercy = false,
  position: _position = "top",
}: {
  name: string;
  avatar?: string;
  cardCount: number;
  isActive: boolean;
  hasCalledUno: boolean;
  noMercy?: boolean;
  position?: "top" | "top-left" | "top-right" | "mid-left" | "mid-right" | "bot-left" | "bot-right";
}) {
  const visibleCards = Math.min(cardCount, 8);

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      {/* Player Header with Avatar & Name */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <div
            className={cn(
              "h-11 w-11 rounded-full p-0.5 transition-all duration-300",
              isActive
                ? noMercy
                  ? "bg-gradient-to-r from-orange-500 to-red-500 shadow-[0_0_16px_rgba(249,115,22,0.9)] scale-110"
                  : "bg-gradient-to-r from-blue-400 to-indigo-500 shadow-[0_0_16px_rgba(99,102,241,0.9)] scale-110"
                : "bg-white/20"
            )}
          >
            <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-900 overflow-hidden font-display text-sm font-bold text-white">
              {avatar ? (
                <img src={avatar} alt={name} className="h-full w-full object-cover" />
              ) : (
                name.slice(0, 2).toUpperCase()
              )}
            </div>
          </div>

          {/* Active Turn Pulse Indicator */}
          {isActive && (
            <motion.span
              animate={{ scale: [1, 1.4, 1], opacity: [1, 0.4, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-400 border-2 border-slate-900"
            />
          )}
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-xs text-white max-w-[80px] truncate">{name}</span>
            {hasCalledUno && (
              <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[9px] font-black text-white animate-pulse">
                UNO!
              </span>
            )}
          </div>
          {isActive && (
            <div
              className={cn(
                "h-1 rounded-full",
                noMercy ? "bg-orange-500" : "bg-indigo-400"
              )}
              style={{ width: "100%" }}
            />
          )}
        </div>
      </div>

      {/* Opponent's Fanned Face-down Cards */}
      <div className="relative flex items-center justify-center h-[62px] px-2">
        <div
          className="relative flex items-center"
          style={{ width: Math.max(48, (visibleCards - 1) * 12 + 38) }}
        >
          {Array.from({ length: visibleCards }).map((_, i) => (
            <div
              key={i}
              className="absolute top-0"
              style={{
                left: i * 12,
                zIndex: i,
                transform: `rotate(${(i - visibleCards / 2) * 3}deg)`,
              }}
            >
              <UnoCardFace faceDown size="xs" noMercy={noMercy} />
            </div>
          ))}
        </div>

        {/* Card Count Pill */}
        <span
          className={cn(
            "ml-2 rounded-full px-2 py-0.5 text-[11px] font-black tabular-nums border",
            isActive
              ? "border-white/40 bg-white/20 text-white shadow-md"
              : "border-white/10 bg-black/40 text-white/70"
          )}
        >
          {cardCount}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CURVED FAN OF PLAYER'S CARDS IN HAND (Authentic Curved Physical Fan)
// ─────────────────────────────────────────────────────────────────────────────
export function CurvedPlayerHand({
  cards,
  playableIds,
  onCardClick,
  isMyTurn,
  noMercy = false,
}: {
  cards: UnoCard[];
  playableIds: Set<string>;
  onCardClick: (card: UnoCard) => void;
  isMyTurn: boolean;
  noMercy?: boolean;
}) {
  const total = cards.length;
  if (total === 0) {
    return <div className="text-sm font-semibold text-white/40">No cards remaining</div>;
  }

  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const maxHandWidth = isMobile ? Math.min(350, typeof window !== "undefined" ? window.innerWidth - 32 : 350) : 720;
  const cardWidth = isMobile ? 54 : 84;
  const stepX = total > 1 ? Math.min(isMobile ? 26 : 46, (maxHandWidth - cardWidth) / (total - 1)) : 0;
  const totalWidth = (total - 1) * stepX + cardWidth;
  const midIndex = (total - 1) / 2;

  return (
    <div
      className="relative mx-auto select-none"
      style={{
        width: Math.max(totalWidth, 100),
        height: isMobile ? 120 : 160,
      }}
    >
      <AnimatePresence mode="popLayout">
        {cards.map((card, i) => {
          const isPlayable = isMyTurn && playableIds.has(card.id);
          const offsetFromMid = i - midIndex;
          
          // Realistic Fan Arc: angle & vertical y-arch
          const rot = offsetFromMid * Math.min(5.5, 36 / Math.max(1, total));
          const archY = Math.pow(offsetFromMid, 2) * Math.min(isMobile ? 1.4 : 2.5, 20 / Math.max(1, total));
          const posX = i * stepX - totalWidth / 2 + cardWidth / 2;

          return (
            <motion.div
              key={card.id}
              onClick={() => isPlayable && onCardClick(card)}
              initial={{ y: -80, opacity: 0, scale: 0.8 }}
              animate={{
                x: posX,
                y: archY - (isMobile ? 4 : 10),
                rotate: rot,
                opacity: 1,
                scale: 1,
              }}
              exit={{ y: 60, opacity: 0, scale: 0.7, transition: { duration: 0.15 } }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 24,
                delay: Math.min(i, 10) * 0.03,
              }}
              whileHover={
                isPlayable
                  ? {
                      y: archY - (isMobile ? 24 : 44),
                      rotate: 0,
                      scale: 1.12,
                      zIndex: 80,
                      transition: { duration: 0.15 },
                    }
                  : undefined
              }
              whileTap={isPlayable ? { scale: 0.98 } : undefined}
              className={cn(
                "absolute left-1/2 top-1 -translate-x-1/2",
                isPlayable ? "cursor-pointer z-10" : "cursor-not-allowed z-0"
              )}
              style={{
                zIndex: i + 5,
              }}
            >
              <UnoCardFace
                card={card}
                size={isMobile ? "sm" : "md"}
                playable={isPlayable}
                dimmed={!isPlayable && isMyTurn}
                noMercy={noMercy}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
