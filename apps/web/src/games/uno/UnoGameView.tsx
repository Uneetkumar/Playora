"use client";

import * as React from "react";
import { Button, Badge, Card, cn } from "@playora/ui";
import { Trophy, RotateCcw, Hand, ArrowRight } from "lucide-react";
import type { UnoCard, UnoColor, UnoPlayerView } from "@playora/game-engine";
import type { GameResult, Player } from "@playora/game-types";
import { UnoCardFace, describeCard } from "./UnoCardFace";

const COLOR_SWATCH: Record<UnoColor, string> = {
  red: "bg-[#E4483B]",
  yellow: "bg-[#E2A93B]",
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
  // A wild needs a colour before it can be played, so the choice is a step.
  const [pendingWild, setPendingWild] = React.useState<UnoCard | null>(null);

  const playable = new Set(gameState.playableCardIds);
  const willBeUno = gameState.myHand.length === 2;

  const commit = (cardId: string, color?: UnoColor) => {
    // Declaring UNO is automatic when the play leaves one card: the rule exists
    // to be remembered at a table, not to punish a mis-click.
    onPlayCard(cardId, color, willBeUno);
    setPendingWild(null);
  };

  const handleCardClick = (card: UnoCard) => {
    if (!gameState.isMyTurn || !playable.has(card.id)) return;
    if (card.value === "wild" || card.value === "wild_draw4") {
      setPendingWild(card);
      return;
    }
    commit(card.id);
  };

  return (
    <div className="space-y-6">
      {/* Opponents: counts only -- their cards never reach this client. */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        {gameState.opponents.map((opponent) => {
          const isActive = opponent.playerId === gameState.activePlayerId;
          return (
            <Card
              key={opponent.playerId}
              className={cn(
                "flex items-center gap-3 border-border bg-card px-4 py-3",
                isActive && "border-primary shadow-glow-primary",
              )}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted font-display text-xs font-bold text-foreground">
                {(players[opponent.playerId]?.displayName ?? "??").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {players[opponent.playerId]?.displayName ?? "Player"}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="numeric">{opponent.cardCount}</span> cards
                  {opponent.hasCalledUno && (
                    <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                      UNO!
                    </Badge>
                  )}
                </div>
              </div>
              {/* Turn is stated, not just coloured (spec section 32). */}
              {isActive && (
                <Badge variant="default" className="text-[10px]">
                  Their turn
                </Badge>
              )}
            </Card>
          );
        })}
      </div>

      {/* Table: draw pile, discard, active colour */}
      <div className="flex items-center justify-center gap-8">
        <button
          type="button"
          onClick={onDrawCard}
          disabled={!gameState.isMyTurn}
          aria-label={
            gameState.pendingDraw > 0
              ? `Draw ${gameState.pendingDraw} cards`
              : "Draw a card"
          }
          className="group flex flex-col items-center gap-2 disabled:opacity-50"
        >
          <UnoCardFace faceDown size="lg" className="transition-transform group-enabled:group-hover:-translate-y-1" />
          <span className="text-xs text-muted-foreground">
            Draw{gameState.pendingDraw > 0 ? ` +${gameState.pendingDraw}` : ""} ·{" "}
            <span className="numeric">{gameState.drawPileCount}</span>
          </span>
        </button>

        <div className="flex flex-col items-center gap-2">
          {gameState.topCard && <UnoCardFace card={gameState.topCard} size="lg" />}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className={cn("h-3 w-3 rounded-full", COLOR_SWATCH[gameState.activeColor])}
              aria-hidden
            />
            {/* Colour named in text as well as shown. */}
            <span className="capitalize">{gameState.activeColor}</span>
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
          <p className="font-display text-lg font-bold text-primary">
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

      {/* Your hand */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Hand className="h-3.5 w-3.5" aria-hidden />
            Your hand · <span className="numeric">{gameState.myHand.length}</span>
          </span>
          {gameState.isMyTurn && gameState.hasDrawn && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onPass}>
              Pass <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Button>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-2 rounded-xl border border-border bg-card/50 p-4">
          {gameState.myHand.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">No cards left.</p>
          ) : (
            gameState.myHand.map((card) => {
              const canPlay = gameState.isMyTurn && playable.has(card.id);
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => handleCardClick(card)}
                  disabled={!canPlay}
                  aria-label={`${describeCard(card)}${canPlay ? ", playable" : ""}`}
                  className={cn(
                    "transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    canPlay ? "cursor-pointer hover:-translate-y-2" : "cursor-not-allowed opacity-45",
                  )}
                >
                  <UnoCardFace card={card} playable={canPlay} />
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Wild colour picker */}
      {pendingWild && (
        <div
          role="dialog"
          aria-label="Choose a colour"
          className="rounded-xl border border-border bg-card p-6 text-center"
        >
          <h3 className="font-display font-bold text-foreground">Choose a colour</h3>
          <div className="mt-4 flex justify-center gap-3">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => commit(pendingWild.id, color)}
                aria-label={color}
                className={cn(
                  "h-14 w-14 rounded-xl border-2 border-transparent transition-transform hover:scale-110",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground",
                  COLOR_SWATCH[color],
                )}
              >
                <span className="sr-only">{color}</span>
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setPendingWild(null)}>
            Cancel
          </Button>
        </div>
      )}

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
