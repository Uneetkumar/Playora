import type { BaseGameState, BaseGameAction, BaseGameConfig } from "../types.js";
import type { GameResult } from "@playora/game-types";

export type UnoColor = "red" | "yellow" | "green" | "blue";
export const UNO_COLORS: readonly UnoColor[] = ["red", "yellow", "green", "blue"] as const;

export type UnoValue =
  | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
  | "skip" | "reverse" | "draw2"
  | "wild" | "wild_draw4"
  // No Mercy additions. Kept in the shared union so a variant deck can be
  // dealt through the same engine rather than forking the whole type system.
  | "draw4_color" | "skip_everyone" | "discard_all"
  | "wild_draw6" | "wild_draw10" | "wild_reverse_draw4" | "wild_roulette";

export interface UnoCard {
  id: string;
  /** Null for wilds until a colour is chosen. */
  color: UnoColor | null;
  value: UnoValue;
}

const WILD_VALUES = new Set<UnoValue>([
  "wild",
  "wild_draw4",
  "wild_draw6",
  "wild_draw10",
  "wild_reverse_draw4",
  "wild_roulette",
]);

export function isWild(card: UnoCard): boolean {
  return WILD_VALUES.has(card.value);
}

/** How many cards this card forces the next player to draw, if any. */
export function drawPenaltyOf(value: UnoValue): number {
  switch (value) {
    case "draw2":
      return 2;
    case "wild_draw4":
    case "draw4_color":
    case "wild_reverse_draw4":
      return 4;
    case "wild_draw6":
      return 6;
    case "wild_draw10":
      return 10;
    default:
      return 0;
  }
}

export function isDrawCard(card: UnoCard): boolean {
  return drawPenaltyOf(card.value) > 0;
}

export function isActionCard(card: UnoCard): boolean {
  return card.value === "skip" || card.value === "reverse" || card.value === "draw2";
}

export interface UnoGameState extends BaseGameState {
  /** Face-down draw pile, top of pile last. */
  drawPile: UnoCard[];
  /** Discard pile, most recent last. */
  discardPile: UnoCard[];
  /** Colour currently in play; set explicitly after a wild. */
  activeColor: UnoColor;
  hands: Record<string, UnoCard[]>;
  /** Seat order; play moves through this array. */
  playerOrder: string[];
  /** 1 = forward through playerOrder, -1 = reversed. */
  direction: 1 | -1;
  /**
   * Cards the player on turn must draw before acting, from stacked draw
   * penalties. Zero on a normal turn.
   */
  pendingDraw: number;
  /** Players who have correctly announced UNO at one card. */
  saidUno: string[];
  /**
   * Whether the player on turn has already drawn. After drawing they may play
   * the drawn card or pass, but not draw again.
   */
  hasDrawn: boolean;
  winnerId: string | null;
  /** Seeded so a match replays identically from the same starting state. */
  rngSeed: number;
  /**
   * Players knocked out by the No Mercy 25-card rule. They keep their seat in
   * playerOrder so turn maths stays stable, but are skipped.
   */
  eliminated?: string[];
}

export interface UnoPlayCardPayload {
  cardId: string;
  /** Required when playing a wild. */
  chosenColor?: UnoColor;
  /** Set when the player announces UNO as they play their penultimate card. */
  declareUno?: boolean;
}

export type UnoActionType = "PLAY_CARD" | "DRAW_CARD" | "PASS" | "CALL_UNO" | "CHALLENGE_UNO";

export interface UnoAction extends BaseGameAction<unknown> {
  type: UnoActionType;
  payload: UnoPlayCardPayload | Record<string, never>;
}

export interface UnoConfig extends BaseGameConfig {
  /** Cards dealt to each player. Standard UNO is 7. */
  handSize?: number;
  /** Stacking +2/+4 onto the next player. Off by default (classic rules). */
  allowStacking?: boolean;
  randomSeed?: string;
}

/**
 * What one player is allowed to see.
 *
 * Opponents' hands are reduced to a count — never the cards themselves
 * (spec sections 5, 64).
 */
export interface UnoPlayerView {
  phase: string;
  isFinished: boolean;
  myHand: UnoCard[];
  /** Ids of my cards that are legal to play right now. */
  playableCardIds: string[];
  opponents: Array<{
    playerId: string;
    cardCount: number;
    hasCalledUno: boolean;
  }>;
  topCard: UnoCard | null;
  activeColor: UnoColor;
  drawPileCount: number;
  discardPileCount: number;
  direction: 1 | -1;
  activePlayerId: string | null;
  isMyTurn: boolean;
  pendingDraw: number;
  /** True once the player on turn has drawn; they may now play or pass. */
  hasDrawn: boolean;
  winnerId: string | null;
  turnNumber: number;
  sequenceNumber: number;
  updatedAt: number;
}

export type UnoEventType =
  | "CARD_PLAYED"
  | "CARD_DRAWN"
  | "COLOR_CHOSEN"
  | "DIRECTION_REVERSED"
  | "PLAYER_SKIPPED"
  | "DRAW_PENALTY"
  | "UNO_CALLED"
  | "UNO_PENALTY"
  | "DECK_RESHUFFLED"
  | "GAME_WON";

export interface UnoEvent {
  type: UnoEventType;
  playerId?: string;
  card?: UnoCard;
  color?: UnoColor;
  count?: number;
}

export interface UnoResult extends GameResult {
  finalHandSizes: Record<string, number>;
}
