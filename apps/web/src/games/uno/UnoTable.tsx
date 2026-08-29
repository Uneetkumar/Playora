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

/** Opponent hand: fanned card backs, so their count is legible at a glance. */
export function OpponentHand({
  count,
  size = "xs",
  max = 9,
}: {
  count: number;
  size?: CardSize;
  max?: number;
}) {
  const shown = Math.min(count, max);
  const spread = 14;

  return (
    <div className="relative flex h-[52px] items-center justify-center" aria-hidden>
      {Array.from({ length: shown }, (_, i) => {
        const offset = i - (shown - 1) / 2;
        return (
          <motion.div
            key={i}
            layout
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03, duration: 0.25 }}
            className="absolute"
            style={{
              transform: `translateX(${offset * spread}px) rotate(${offset * 4}deg)`,
              zIndex: i,
            }}
          >
            <UnoCardFace faceDown size={size} />
          </motion.div>
        );
      })}
      {count > max && (
        <span className="absolute -bottom-1 right-0 numeric rounded-full bg-card px-1.5 text-[10px] text-muted-foreground">
          +{count - max}
        </span>
      )}
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
            layoutId={`card-${card.id}`}
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
