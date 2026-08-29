"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button, Badge, cn } from "@playora/ui";
import { Trophy, RotateCcw, ArrowRight } from "lucide-react";
import type { UnoCard, UnoColor, UnoPlayerView } from "@playora/game-engine";
import type { GameResult, Player } from "@playora/game-types";
import { UnoCardFace, describeCard } from "./UnoCardFace";
import { DiscardPile, DrawPile, OpponentHand, RuleAlert } from "./UnoTable";

const COLOR_SWATCH: Record<UnoColor, string> = {
  red: "bg-[#E4483B]",
  yellow: "bg-[#E8B02E]",
  green: "bg-[#3FA55A]",
  blue: "bg-[#2C7BE5]",
};
const COLORS: UnoColor[] = ["red", "yellow", "green", "blue"];

interface UnoGameViewProps {
  gameState: UnoPlayerView;
  players: Record<string, Player>;
  currentUserId: string;
  lastResult?: GameResult | null;
  onPlayCard: (cardId: string, chosenColor?: UnoColor, declareUno?: boolean) => void;
  onDrawCard: () => void;
  onPass: () => void;
  onRematch?: () => void;
}

export function UnoGameView({
  gameState,
  players,
  currentUserId,
  onPlayCard,
  onDrawCard,
  onPass,
  onRematch,
}: UnoGameViewProps) {
  const reduced = useReducedMotion();
  const [pendingWild, setPendingWild] = React.useState<UnoCard | null>(null);
  const [dealt, setDealt] = React.useState(false);

  // Deal on mount: cards arrive rather than appearing, which reads as a game
  // starting instead of a page rendering.
  React.useEffect(() => {
    const t = setTimeout(() => setDealt(true), reduced ? 0 : 120);
    return () => clearTimeout(t);
  }, [reduced]);

  const playable = new Set(gameState.playableCardIds);
  const willBeUno = gameState.myHand.length === 2;
  const top = gameState.topCard;

  const commit = (cardId: string, color?: UnoColor) => {
    onPlayCard(cardId, color, willBeUno);
    setPendingWild(null);
  };

  const handleCardClick = (card: UnoCard) => {
    if (!gameState.isMyTurn || !playable.has(card.id)) return;
    if (card.color === null) {
      setPendingWild(card);
      return;
    }
    commit(card.id);
  };

  const hand = gameState.myHand;
  // Fan tightens as the hand grows so twelve cards still fit on a phone.
  const spread = Math.max(26, Math.min(52, 420 / Math.max(hand.length, 1)));

  return (
    <div className="space-y-5">
      {/* Opponents */}
      <div className="flex flex-wrap items-start justify-center gap-6">
        {gameState.opponents.map((opponent) => {
          const isActive = opponent.playerId === gameState.activePlayerId;
          return (
            <div key={opponent.playerId} className="flex flex-col items-center gap-1.5">
              <OpponentHand count={opponent.cardCount} />
              <div
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1 transition-colors",
                  isActive ? "border-primary bg-primary/15" : "border-border bg-card",
                )}
              >
                <span className="text-sm font-semibold text-foreground">
                  {players[opponent.playerId]?.displayName ?? "Player"}
                </span>
                <span className="numeric text-xs text-muted-foreground">
                  {opponent.cardCount}
                </span>
                {opponent.hasCalledUno && (
                  <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                    UNO!
                  </Badge>
                )}
              </div>
              {/* Turn is named, not just glowing (spec section 32). */}
              {isActive && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  Their turn
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="relative flex items-center justify-center gap-10 rounded-2xl border border-border bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.10),transparent_65%)] py-8">
        <RuleAlert card={top} />

        <DrawPile
          count={gameState.drawPileCount}
          pendingDraw={gameState.pendingDraw}
          onDraw={onDrawCard}
          disabled={!gameState.isMyTurn}
        />

        <div className="flex flex-col items-center gap-2">
          <DiscardPile cards={top ? [top] : []} />
          <div className="flex items-center gap-2 text-xs">
            <span className={cn("h-3 w-3 rounded-full", COLOR_SWATCH[gameState.activeColor])} aria-hidden />
            <span className="capitalize text-muted-foreground">{gameState.activeColor}</span>
          </div>
        </div>
      </div>

      {/* Turn banner */}
      <div className="text-center" aria-live="polite">
        {gameState.isFinished ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-success/15 px-4 py-2 text-success">
            <Trophy className="h-4 w-4" aria-hidden />
            <span className="font-display font-bold">
              {gameState.winnerId === currentUserId
                ? "You win!"
                : `${players[gameState.winnerId ?? ""]?.displayName ?? "Opponent"} wins`}
            </span>
          </div>
        ) : gameState.isMyTurn ? (
          <p className="font-display text-lg font-black tracking-wide text-primary">
            YOUR TURN
            {gameState.pendingDraw > 0 && (
              <span className="ml-2 text-sm font-normal text-warning">
                — draw {gameState.pendingDraw} first
              </span>
            )}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Waiting for opponent…</p>
        )}
      </div>

      {/* Your hand, fanned */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Your hand · <span className="numeric">{hand.length}</span>
          </span>
          {gameState.isMyTurn && gameState.hasDrawn && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onPass}>
              Pass <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Button>
          )}
        </div>

        <div className="overflow-x-auto pb-6 pt-8">
          <div
            className="relative mx-auto flex h-[130px] items-end justify-center"
            style={{ minWidth: hand.length * spread + 90 }}
          >
            <AnimatePresence mode="popLayout">
              {hand.map((card, i) => {
                const canPlay = gameState.isMyTurn && playable.has(card.id);
                const offset = i - (hand.length - 1) / 2;
                return (
                  <motion.button
                    key={card.id}
                    layoutId={`card-${card.id}`}
                    type="button"
                    onClick={() => handleCardClick(card)}
                    disabled={!canPlay}
                    aria-label={`${describeCard(card)}${canPlay ? ", playable" : ", not playable"}`}
                    initial={reduced ? { opacity: 0 } : { opacity: 0, y: -140, rotate: 0 }}
                    animate={{
                      opacity: dealt ? 1 : 0,
                      y: 0,
                      x: offset * spread,
                      rotate: offset * 3.2,
                    }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, y: -60, scale: 0.85 }}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 26,
                      delay: dealt ? 0 : i * 0.055,
                    }}
                    whileHover={canPlay && !reduced ? { y: -22, scale: 1.06, zIndex: 50 } : undefined}
                    whileTap={canPlay && !reduced ? { scale: 0.97 } : undefined}
                    className={cn(
                      "absolute origin-bottom rounded-[12%] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      canPlay ? "cursor-pointer" : "cursor-not-allowed",
                    )}
                    style={{ zIndex: i }}
                  >
                    <UnoCardFace card={card} playable={canPlay} dimmed={!canPlay} />
                  </motion.button>
                );
              })}
            </AnimatePresence>

            {hand.length === 0 && (
              <p className="text-sm text-muted-foreground">No cards left.</p>
            )}
          </div>
        </div>
      </div>

      {/* Wild colour picker */}
      <AnimatePresence>
        {pendingWild && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            role="dialog"
            aria-label="Choose a colour"
            className="rounded-xl border border-border bg-card p-6 text-center"
          >
            <h3 className="font-display font-bold text-foreground">Choose a colour</h3>
            <div className="mt-4 flex justify-center gap-3">
              {COLORS.map((color) => (
                <motion.button
                  key={color}
                  type="button"
                  onClick={() => commit(pendingWild.id, color)}
                  aria-label={color}
                  whileHover={{ scale: 1.12 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    "h-14 w-14 rounded-xl shadow-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground",
                    COLOR_SWATCH[color],
                  )}
                >
                  <span className="sr-only">{color}</span>
                </motion.button>
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setPendingWild(null)}>
              Cancel
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {gameState.isFinished && onRematch && (
        <div className="text-center">
          <Button className="gap-2" onClick={onRematch}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            Play again
          </Button>
        </div>
      )}
    </div>
  );
}
