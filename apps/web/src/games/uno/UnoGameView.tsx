"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button, Badge, cn } from "@playora/ui";
import { Trophy, RotateCcw, ArrowRight } from "lucide-react";
import type { UnoCard, UnoColor, UnoPlayerView } from "@playora/game-engine";
import type { GameResult, Player } from "@playora/game-types";
import { UnoCardFace, describeCard } from "./UnoCardFace";
import { useAudio } from "../../lib/audio/use-audio";
import { useGameplayStore } from "../../lib/store/gameplay-store";
import {
  CardFlight,
  DiscardPile,
  DrawPile,
  OpponentHand,
  RuleAlert,
  ColorDiamond,
  DirectionMark,
  stackOffset,
  stackWidth,
  flightOrigin,
} from "./UnoTable";

const COLOR_SWATCH: Record<UnoColor, string> = {
  red: "bg-[#E4483B]",
  yellow: "bg-[#E8B02E]",
  green: "bg-[#3FA55A]",
  blue: "bg-[#2C7BE5]",
};

const COLOR_HEX: Record<UnoColor, string> = {
  red: "#E4483B",
  yellow: "#E8B02E",
  green: "#3FA55A",
  blue: "#2C7BE5",
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
  /** An AI opponent is deciding. Purely a pacing cue; the move is already made. */
  isOpponentThinking?: boolean;
}

export function UnoGameView({
  gameState,
  players,
  currentUserId,
  onPlayCard,
  onDrawCard,
  onPass,
  onRematch,
  isOpponentThinking = false,
}: UnoGameViewProps) {
  const reduced = useReducedMotion();
  const [pendingWild, setPendingWild] = React.useState<UnoCard | null>(null);

  // Sound follows the authoritative state rather than the click, so a card the
  // server rejected makes no noise and an opponent's card makes the same noise
  // as your own.
  const play = useAudio();
  const sortHand = useGameplayStore((s) => s.prefs.sortUnoHand);
  const hydrateGameplay = useGameplayStore((s) => s.hydrate);
  React.useEffect(() => {
    hydrateGameplay();
  }, [hydrateGameplay]);

  const prevDiscardCount = React.useRef(gameState.discardPileCount);
  const prevHandCount = React.useRef(gameState.myHand.length);
  const prevTurn = React.useRef(gameState.isMyTurn);

  React.useEffect(() => {
    const discarded = gameState.discardPileCount;
    const held = gameState.myHand.length;

    if (discarded > prevDiscardCount.current) play("card.play");
    else if (held > prevHandCount.current) play("card.draw");

    // One card left, announced: the moment the table is supposed to notice.
    if (held === 1 && prevHandCount.current > 1) play("card.uno");

    if (gameState.isMyTurn && !prevTurn.current) play("match.turn");

    prevDiscardCount.current = discarded;
    prevHandCount.current = held;
    prevTurn.current = gameState.isMyTurn;
  }, [gameState.discardPileCount, gameState.myHand.length, gameState.isMyTurn, play]);

  // Track who was on turn *before* the discard changed: that is who threw the
  // card, and it decides where the flight starts from.
  const prevTopId = React.useRef<string | null>(null);
  const prevActive = React.useRef<string | null>(null);
  const [flight, setFlight] = React.useState<{
    card: UnoCard;
    from: { x: number; y: number };
  } | null>(null);

  const top = gameState.topCard;
  const opponents = gameState.opponents;

  React.useEffect(() => {
    const thrower = prevActive.current;
    prevActive.current = gameState.activePlayerId;

    if (!top) return;
    if (prevTopId.current === null) {
      // First render: the opening card is already on the pile, nothing flew.
      prevTopId.current = top.id;
      return;
    }
    if (prevTopId.current === top.id) return;
    prevTopId.current = top.id;

    if (reduced || !thrower) return;
    const seat = opponents.findIndex((o) => o.playerId === thrower);
    setFlight({
      card: top,
      from: flightOrigin(seat >= 0 ? seat : null, opponents.length),
    });
  }, [top, gameState.activePlayerId, opponents, reduced]);

  const playable = new Set(gameState.playableCardIds);
  const willBeUno = gameState.myHand.length === 2;

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

  // Sorting is presentation only — the server never sees this order, and the
  // card ids it validates against are unchanged.
  const hand = React.useMemo(() => {
    if (!sortHand) return gameState.myHand;
    const order: Record<string, number> = { red: 0, yellow: 1, green: 2, blue: 3 };
    return [...gameState.myHand].sort((a, b) => {
      // Wilds have no colour, so they collect at the end where they are easy
      // to find when nothing else is playable.
      const colorA = a.color === null ? 4 : (order[a.color] ?? 4);
      const colorB = b.color === null ? 4 : (order[b.color] ?? 4);
      if (colorA !== colorB) return colorA - colorB;
      return a.value.localeCompare(b.value);
    });
  }, [gameState.myHand, sortHand]);
  const cardWidth = 66;
  const handWidth = stackWidth(hand.length, cardWidth);

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
                {/* Count is public; the faces never leave the server. */}
                <span className="numeric rounded-full bg-muted px-1.5 text-xs text-foreground">
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
      <div className="relative flex items-center justify-center gap-8 rounded-2xl border border-border py-10"
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, #12305C 0%, #0B1F3D 45%, #070F1F 100%)",
        }}>
        <RuleAlert card={flight ? null : top} />
        <CardFlight
          card={flight?.card ?? null}
          from={flight?.from ?? null}
          onDone={() => setFlight(null)}
        />

        <ColorDiamond
          color={COLOR_HEX[gameState.activeColor]}
          label={gameState.activeColor}
        />

        <div className="flex items-center gap-5 rounded-2xl border border-border/70 bg-background/40 p-4">
          <DrawPile
            count={gameState.drawPileCount}
            pendingDraw={gameState.pendingDraw}
            onDraw={onDrawCard}
            disabled={!gameState.isMyTurn}
          />
          <DiscardPile cards={top && !flight ? [top] : []} />
        </div>

        <DirectionMark direction={gameState.direction} />
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
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            {isOpponentThinking && (
              <span className="flex gap-1" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
                    animate={reduced ? undefined : { opacity: [0.25, 1, 0.25] }}
                    transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
                  />
                ))}
              </span>
            )}
            {isOpponentThinking ? "Opponent is thinking…" : "Waiting for opponent…"}
          </p>
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
            className="relative mx-auto h-[130px]"
            style={{ width: Math.max(handWidth, 220) }}
          >
            <AnimatePresence mode="popLayout">
              {hand.map((card, i) => {
                const canPlay = gameState.isMyTurn && playable.has(card.id);
                const { x, zIndex } = stackOffset(i, hand.length, cardWidth);
                return (
                  <motion.button
                    key={card.id}
                    type="button"
                    onClick={() => handleCardClick(card)}
                    disabled={!canPlay}
                    aria-label={`${describeCard(card)}${canPlay ? ", playable" : ", not playable"}`}
                    // Dealt from the draw pile: cards arrive one after another
                    // from above, which is what makes a hand feel dealt rather
                    // than rendered.
                    // Dealt from the draw pile above: each card flies down into
                    // its slot in turn, which is what makes a hand feel dealt.
                    initial={reduced ? { opacity: 0 } : { opacity: 0, x: 0, y: -240, scale: 0.8 }}
                    animate={{ opacity: 1, x, y: 0, scale: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.12 } }}
                    transition={{
                      type: "spring",
                      stiffness: 260,
                      damping: 24,
                      delay: reduced ? 0 : Math.min(i, 12) * 0.07,
                    }}
                    // Lift the card clear of the fan so it can be read before playing.
                    whileHover={canPlay && !reduced ? { y: -30, scale: 1.1, zIndex: 60 } : undefined}
                    whileTap={canPlay && !reduced ? { scale: 0.97 } : undefined}
                    className={cn(
                      "absolute left-1/2 top-0 rounded-[12%] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      canPlay ? "cursor-pointer" : "cursor-not-allowed",
                    )}
                    style={{ zIndex, marginLeft: -cardWidth / 2 }}
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
