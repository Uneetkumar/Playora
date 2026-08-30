import type { GameId } from "@playora/game-types";
import type { ActionResult } from "../types.js";
import { UnoEngine } from "./UnoEngine.js";
import { buildNoMercyDeck } from "./deck.js";
import {
  drawPenaltyOf,
  isDrawCard,
  isWild,
  type UnoAction,
  type UnoCard,
  type UnoConfig,
  type UnoEvent,
  type UnoGameState,
} from "./types.js";

/** Hold this many cards and you are out. The rule that gives the game its name. */
export const ELIMINATION_THRESHOLD = 25;

const NO_MERCY_HAND_SIZE = 7;

/**
 * UNO No Mercy.
 *
 * A rule set on top of `UnoEngine`, not a second engine (spec section 17). The
 * room system, turn handling, hidden-information view and result calculation
 * are all inherited; only the deck and the card effects differ.
 *
 * What actually changes:
 *  - a 168-card deck with Draw Four/Six/Ten and colour-specific action cards
 *  - draw penalties **stack**, so a +2 can be answered with another draw card
 *  - 0 passes every hand around; 7 swaps two hands
 *  - Discard All dumps every card of the played colour
 *  - Skip Everyone returns the turn to you
 *  - reaching 25 cards eliminates you
 */
export class UnoNoMercyEngine extends UnoEngine {
  override readonly gameId: GameId = "uno-no-mercy";
  override readonly minPlayers = 2;
  override readonly maxPlayers = 6;

  protected override buildDeckFor(_config: UnoConfig): UnoCard[] {
    return buildNoMercyDeck();
  }

  protected override defaultHandSize(): number {
    return NO_MERCY_HAND_SIZE;
  }

  /**
   * Stacking is the defining difference: a pending penalty can be passed on by
   * playing another draw card, rather than simply being served.
   */
  override isPlayable(state: UnoGameState, card: UnoCard): boolean {
    if (state.pendingDraw > 0) return isDrawCard(card);
    if (isWild(card)) return true;

    const top = this.topCard(state);
    if (!top) return true;
    return card.color === state.activeColor || card.value === top.value;
  }

  /**
   * Applies a card's effect, then advances the turn.
   *
   * Overridden rather than extended because No Mercy changes what several
   * shared values mean — a 0 and a 7 are ordinary numbers in classic UNO and
   * hand-manipulating actions here.
   */
  protected override applyCardEffect(
    state: UnoGameState,
    card: UnoCard,
    events: UnoEvent[],
  ): UnoGameState {
    let next = state;
    let skipExtra = false;

    const penalty = drawPenaltyOf(card.value);
    if (penalty > 0) {
      next = { ...next, pendingDraw: next.pendingDraw + penalty };
      events.push({ type: "DRAW_PENALTY", count: penalty });
    }

    switch (card.value) {
      case "skip":
        skipExtra = true;
        events.push({ type: "PLAYER_SKIPPED" });
        break;

      case "skip_everyone":
        // The turn comes straight back: everyone else is skipped.
        events.push({ type: "PLAYER_SKIPPED" });
        return {
          ...next,
          turnNumber: next.turnNumber + 1,
        };

      case "reverse":
      case "wild_reverse_draw4":
        next = { ...next, direction: (next.direction * -1) as 1 | -1 };
        events.push({ type: "DIRECTION_REVERSED" });
        if (next.playerOrder.length === 2 && card.value === "reverse") skipExtra = true;
        break;

      case "discard_all":
        next = this.discardAllOfColor(next, events);
        break;

      case "0":
        next = this.passHandsAround(next, events);
        break;

      default:
        break;
    }

    return {
      ...next,
      activePlayerId: this.nextPlayer(next, skipExtra ? 2 : 1),
      turnNumber: next.turnNumber + 1,
    };
  }

  /** Discard All: the player sheds every card matching the active colour. */
  private discardAllOfColor(state: UnoGameState, events: UnoEvent[]): UnoGameState {
    const playerId = state.activePlayerId;
    if (!playerId) return state;

    const hand = state.hands[playerId] ?? [];
    const kept = hand.filter((c) => c.color !== state.activeColor);
    const shed = hand.filter((c) => c.color === state.activeColor);
    if (shed.length === 0) return state;

    events.push({ type: "CARD_PLAYED", playerId, count: shed.length });
    return {
      ...state,
      hands: { ...state.hands, [playerId]: kept },
      discardPile: [...state.discardPile, ...shed],
    };
  }

  /** A zero sends every hand one seat along, in the current direction. */
  private passHandsAround(state: UnoGameState, events: UnoEvent[]): UnoGameState {
    const order = state.playerOrder.filter((id) => !this.isEliminated(state, id));
    if (order.length < 2) return state;

    const hands = { ...state.hands };
    const shifted: Record<string, UnoCard[]> = {};
    order.forEach((id, i) => {
      const from = order[(i - state.direction + order.length * 2) % order.length]!;
      shifted[id] = hands[from] ?? [];
    });

    events.push({ type: "CARD_DRAWN", count: 0 });
    return { ...state, hands: { ...hands, ...shifted } };
  }

  /**
   * Runs the base action, then enforces the 25-card rule.
   *
   * Elimination has to hang off applyAction rather than off drawing, because a
   * hand can cross the threshold several ways: serving a stacked penalty, being
   * handed someone else's hand by a 0, or a Discard All that misses. Checking
   * once, after any action, covers all of them.
   */
  override applyAction(
    state: UnoGameState,
    action: UnoAction,
  ): ActionResult<UnoGameState, UnoEvent> {
    const result = super.applyAction(state, action);
    if (result.state.isFinished) return result;

    const after = this.applyElimination(result.state);
    let next = after.state;

    // The action already advanced the turn, but the player it advanced *to* may
    // be the one this very action knocked out. Step past them.
    if (
      !next.isFinished &&
      next.activePlayerId &&
      this.isEliminated(next, next.activePlayerId)
    ) {
      next = { ...next, activePlayerId: this.nextPlayer(next, 1) };
    }

    return { state: next, events: [...(result.events ?? []), ...after.events] };
  }

  private isEliminated(state: UnoGameState, playerId: string): boolean {
    return (state.eliminated ?? []).includes(playerId);
  }

  /**
   * Applies the 25-card rule after any state change.
   *
   * Eliminated players keep their seat in `playerOrder` so turn arithmetic stays
   * stable; they are simply skipped. If one player remains, they win.
   */
  applyElimination(state: UnoGameState): { state: UnoGameState; events: UnoEvent[] } {
    const events: UnoEvent[] = [];
    const eliminated = new Set(state.eliminated ?? []);

    for (const [playerId, hand] of Object.entries(state.hands)) {
      if (!eliminated.has(playerId) && hand.length >= ELIMINATION_THRESHOLD) {
        eliminated.add(playerId);
        events.push({ type: "UNO_PENALTY", playerId, count: hand.length });
      }
    }

    const survivors = state.playerOrder.filter((id) => !eliminated.has(id));
    const next: UnoGameState = { ...state, eliminated: [...eliminated] };

    // Two players can cross the threshold on the same action -- a 0 passes
    // whole hands around -- so this has to cope with nobody being left.
    if (survivors.length <= 1) {
      const winner = survivors[0] ?? null;
      if (winner) events.push({ type: "GAME_WON", playerId: winner });
      return {
        state: { ...next, isFinished: true, phase: "finished", winnerId: winner, activePlayerId: null },
        events,
      };
    }

    return { state: next, events };
  }

  /** Turn order skips anyone knocked out. */
  protected override nextPlayer(state: UnoGameState, steps: number): string {
    const order = state.playerOrder;
    let index = order.indexOf(state.activePlayerId ?? order[0]!);

    for (let moved = 0; moved < steps; moved++) {
      do {
        index = (((index + state.direction) % order.length) + order.length) % order.length;
      } while (this.isEliminated(state, order[index]!) && (state.eliminated ?? []).length < order.length);
    }
    return order[index]!;
  }
}
