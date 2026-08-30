"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@playora/ui";
import type { UnoCard } from "@playora/game-engine";
import { UnoCardFace, type CardSize } from "./UnoCardFace";

/**
 * Table furniture: the draw pile, the discard pile, opponent hands, and the
 * rule alerts that fire when a special card lands.
 *
 * Motion here is doing a job, not decorating. A card that visibly travels from
 * a hand to the discard pile tells you *who* played *what* without you reading
 * anything — which matters in a game where four things can change on one turn.
 */

/** A short, loud banner when a card changes the rules of the next turn. */
export function RuleAlert({ card }: { card: UnoCard | null }) {
  const reduced = useReducedMotion();

  const message = React.useMemo(() => {
    if (!card) return null;
    switch (card.value) {
      case "skip":
        return { text: "SKIPPED", tone: "warning" as const };
      case "skip_everyone":
        return { text: "EVERYONE SKIPPED", tone: "warning" as const };
      case "reverse":
      case "wild_reverse_draw4":
        return { text: "REVERSE", tone: "info" as const };
      case "draw2":
        return { text: "+2 CARDS", tone: "danger" as const };
      case "draw4_color":
      case "wild_draw4":
        return { text: "+4 CARDS", tone: "danger" as const };
      case "wild_draw6":
        return { text: "+6 CARDS", tone: "danger" as const };
      case "wild_draw10":
        return { text: "+10 CARDS", tone: "danger" as const };
      case "discard_all":
        return { text: "DISCARD ALL", tone: "info" as const };
      case "wild":
      case "wild_roulette":
        return { text: "WILD", tone: "info" as const };
      case "0":
        return { text: "HANDS PASSED", tone: "info" as const };
      case "7":
        return { text: "HANDS SWAPPED", tone: "info" as const };
      default:
        return null;
    }
  }, [card]);

  const tones = {
    warning: "bg-warning text-black",
    danger: "bg-destructive text-white",
    info: "bg-secondary text-black",
  };

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          // Keyed by card id so replaying the same value re-fires the alert.
          key={card!.id}
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.7, y: 10 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.15 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
          role="status"
          aria-live="assertive"
        >
          <span
            className={cn(
              "rounded-xl px-5 py-2 font-display text-xl font-black tracking-wide shadow-raised",
              tones[message.tone],
            )}
          >
            {message.text}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Geometry for a held hand.
 *
 * Cards sit upright and overlap heavily, each showing roughly its left third —
 * the way a hand of cards actually looks when you hold it squared up. An arced
 * fan was the wrong reference: it spreads the cards out and reads as a row of
 * tiles rather than a hand.
 */
export function stackOffset(
  index: number,
  total: number,
  cardWidth: number,
  maxWidth = 620,
): { x: number; zIndex: number } {
  // Show ~40% of each card, tightening as the hand grows so it still fits.
  const ideal = cardWidth * 0.42;
  const step = total > 1 ? Math.min(ideal, (maxWidth - cardWidth) / (total - 1)) : 0;
  const totalWidth = (total - 1) * step + cardWidth;
  return { x: index * step - totalWidth / 2 + cardWidth / 2, zIndex: index };
}

export function stackWidth(total: number, cardWidth: number, maxWidth = 620): number {
  const ideal = cardWidth * 0.42;
  const step = total > 1 ? Math.min(ideal, (maxWidth - cardWidth) / (total - 1)) : 0;
  return (total - 1) * step + cardWidth;
}

/**
 * An opponent's hand: face-down cards in the same squared-up stack.
 *
 * The count is public information and the faces are not — the engine only sends
 * a number for other players (spec sections 5, 64), so nothing here could leak
 * even if the markup were inspected.
 */
export function OpponentHand({
  count,
  size = "sm",
  max = 12,
}: {
  count: number;
  size?: CardSize;
  max?: number;
}) {
  const shown = Math.min(count, max);
  const width = { xs: 34, sm: 46, md: 66, lg: 84 }[size];
  const height = { xs: 50, sm: 68, md: 98, lg: 124 }[size];

  return (
    <div
      className="relative"
      style={{ width: stackWidth(shown, width, 300), height }}
      aria-hidden
    >
      {Array.from({ length: shown }, (_, i) => {
        const { x, zIndex } = stackOffset(i, shown, width, 300);
        return (
          <motion.div
            key={i}
            className="absolute left-1/2 top-0"
            style={{ zIndex }}
            initial={{ opacity: 0, x: 0, y: -70, scale: 0.8 }}
            animate={{ opacity: 1, x, y: 0, scale: 1 }}
            transition={{
              delay: Math.min(i, 12) * 0.06,
              type: "spring",
              stiffness: 280,
              damping: 24,
            }}
          >
            <div style={{ marginLeft: -width / 2 }}>
              <UnoCardFace faceDown size={size} />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/** Current colour, shown as a diamond the way the physical game marks it. */
export function ColorDiamond({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="block h-9 w-9 rotate-45 rounded-[6px] shadow-raised"
        style={{ background: color }}
        aria-hidden
      />
      {/* Named as well as coloured (spec section 32). */}
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

/** Play direction, so a Reverse is legible after the banner clears. */
export function DirectionMark({ direction }: { direction: 1 | -1 }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <motion.span
        key={direction}
        initial={{ rotate: direction === 1 ? -90 : 90, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="flex h-9 w-9 rotate-45 items-center justify-center rounded-[6px] bg-primary shadow-raised"
      >
        <span className="-rotate-45 text-lg font-black leading-none text-white">
          {direction === 1 ? "›" : "‹"}
        </span>
      </motion.span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {direction === 1 ? "Forward" : "Reversed"}
      </span>
    </div>
  );
}

/** Discard pile: a settled stack, each card landing at a slight angle. */
export function DiscardPile({ cards, size = "lg" }: { cards: UnoCard[]; size?: CardSize }) {
  // Only the last few matter visually; rendering the whole pile is wasted work.
  const visible = cards.slice(-4);

  return (
    <div className="relative flex items-center justify-center">
      {visible.map((card, i) => {
        const isTop = i === visible.length - 1;
        // Deterministic tilt from the card id, so it doesn't reshuffle on render.
        const tilt = ((card.id.charCodeAt(card.id.length - 1) % 11) - 5) * 2.2;
        return (
          <motion.div
            key={card.id}
            initial={isTop ? { scale: 1.15, y: -30, opacity: 0.85 } : false}
            animate={{ scale: 1, y: 0, opacity: 1, rotate: tilt }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className={i === 0 ? "" : "absolute"}
            style={{ zIndex: i }}
          >
            <UnoCardFace card={card} size={size} />
          </motion.div>
        );
      })}
    </div>
  );
}

/** Draw pile: a shallow stack that lifts when it can be tapped. */
export function DrawPile({
  count,
  onDraw,
  disabled,
  pendingDraw,
  size = "lg",
}: {
  count: number;
  onDraw: () => void;
  disabled?: boolean;
  pendingDraw: number;
  size?: CardSize;
}) {
  const layers = Math.min(3, Math.max(1, Math.ceil(count / 20)));

  return (
    <button
      type="button"
      onClick={onDraw}
      disabled={disabled}
      aria-label={pendingDraw > 0 ? `Draw ${pendingDraw} cards` : "Draw a card"}
      className="group relative flex flex-col items-center gap-2 disabled:cursor-not-allowed disabled:opacity-55"
    >
      <span className="relative block">
        {Array.from({ length: layers }, (_, i) => (
          <span
            key={i}
            className={i === 0 ? "block" : "absolute left-0 top-0"}
            style={{ transform: `translate(${i * 2}px, ${-i * 2}px)`, zIndex: -i }}
          >
            <UnoCardFace faceDown size={size} />
          </span>
        ))}
        <motion.span
          className="absolute inset-0 rounded-[12%]"
          whileHover={disabled ? undefined : { y: -6 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        />
      </span>

      <span className="text-xs text-muted-foreground">
        {pendingDraw > 0 ? (
          <span className="numeric font-bold text-destructive">Draw +{pendingDraw}</span>
        ) : (
          <>
            Draw · <span className="numeric">{count}</span>
          </>
        )}
      </span>
    </button>
  );
}

/**
 * A card in flight from a player to the discard pile.
 *
 * Rendered as an overlay rather than relying on a shared `layoutId`: the card
 * leaves one component (a hand) and arrives in another (the pile), and across
 * that boundary an explicit flight is far more reliable — and it is the only
 * way to show an *opponent* throwing, since their cards were never in the DOM.
 */
export function CardFlight({
  card,
  from,
  onDone,
}: {
  card: UnoCard | null;
  /** Start offset from the pile, in pixels. */
  from: { x: number; y: number } | null;
  onDone: () => void;
}) {
  const reduced = useReducedMotion();

  return (
    <AnimatePresence onExitComplete={onDone}>
      {card && from && (
        <motion.div
          key={card.id}
          className="pointer-events-none absolute left-1/2 top-1/2 z-30"
          initial={
            reduced
              ? { opacity: 0 }
              : { x: from.x - 42, y: from.y - 62, scale: 0.85, rotate: from.x > 0 ? 18 : -18, opacity: 0 }
          }
          animate={
            reduced
              ? { opacity: 0 }
              : { x: -42, y: -62, scale: 1, rotate: 0, opacity: 1 }
          }
          exit={{ opacity: 0 }}
          transition={{ type: "spring", stiffness: 210, damping: 24, mass: 0.7 }}
          onAnimationComplete={() => {
            // Hand off to the settled pile card once it lands.
            if (!reduced) setTimeout(onDone, 60);
          }}
        >
          <UnoCardFace card={card} size="lg" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Where a player's cards fly from, relative to the centre of the table.
 * Opponents are spread along the top; the local player throws from below.
 */
export function flightOrigin(
  seatIndex: number | null,
  opponentCount: number,
): { x: number; y: number } {
  if (seatIndex === null) return { x: 0, y: 300 }; // the local player
  const spread = 170;
  const offset = seatIndex - (opponentCount - 1) / 2;
  return { x: offset * spread, y: -230 };
}
