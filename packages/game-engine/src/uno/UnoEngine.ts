import type { GameId, Player } from "@playora/game-types";
import { AbstractGameEngine } from "../engine.js";
import type { ActionResult, ActionValidationResult } from "../types.js";
import { buildDeck, createRng, seedFromString, shuffle } from "./deck.js";
import {
  isWild,
  UNO_COLORS,
  type UnoAction,
  type UnoCard,
  type UnoConfig,
  type UnoEvent,
  type UnoGameState,
  type UnoPlayCardPayload,
  type UnoPlayerView,
  type UnoResult,
} from "./types.js";

const DEFAULT_HAND_SIZE = 7;
const UNO_PENALTY_CARDS = 2;

/**
 * Server-authoritative UNO.
 *
 * Every rule lives here, never in the UI, so the browser can render a hand but
 * cannot decide what is legal. `getPlayerView` reduces opponents to card counts,
 * so a client is never sent cards it is not entitled to see (spec §5, §64).
 */
export class UnoEngine extends AbstractGameEngine<
  UnoGameState,
  UnoAction,
  UnoResult,
  UnoConfig,
  UnoEvent,
  UnoPlayerView
> {
  readonly gameId: GameId = "uno";
  readonly minPlayers: number = 2;
  readonly maxPlayers: number = 4;

  /** Overridden by variants that use a different deck (e.g. No Mercy). */
  protected buildDeckFor(_config: UnoConfig): UnoCard[] {
    return buildDeck();
  }

  /** Cards dealt at the start. No Mercy deals more. */
  protected defaultHandSize(): number {
    return DEFAULT_HAND_SIZE;
  }

  init(players: Player[], config: UnoConfig = {}): UnoGameState {
    const seed = seedFromString(
      config.randomSeed ?? config.sessionId ?? `uno-${players.map((p) => p.userId).join("-")}`,
    );
    const rng = createRng(seed);
    const handSize = config.handSize ?? this.defaultHandSize();

    const deck = shuffle(this.buildDeckFor(config), rng);
    const hands: Record<string, UnoCard[]> = {};
    const order = players.map((p) => p.userId);

    for (const userId of order) {
      hands[userId] = deck.splice(0, handSize);
    }

    // The opening discard must not be a wild: there would be no colour in play
    // and nobody to choose one. Bury any wild and draw again.
    let starter = deck.pop()!;
    while (isWild(starter)) {
      deck.unshift(starter);
      starter = deck.pop()!;
    }

    const now = Date.now();
    const state: UnoGameState = {
      sequenceNumber: 0,
      phase: "playing",
      activePlayerId: order[0] ?? null,
      turnNumber: 1,
      startedAt: now,
      updatedAt: now,
      turnDeadline: null,
      isFinished: false,
      drawPile: deck,
      discardPile: [starter],
      activeColor: starter.color ?? "red",
      hands,
      playerOrder: order,
      direction: 1,
      pendingDraw: 0,
      hasDrawn: false,
      saidUno: [],

      winnerId: null,
      rngSeed: seed,
    };

    // The opening card takes effect on the first player, as in the physical game.
    return this.applyOpeningCard(state, starter);
  }

  protected applyOpeningCard(state: UnoGameState, card: UnoCard): UnoGameState {
    if (card.value === "skip") return { ...state, activePlayerId: this.nextPlayer(state, 1) };
    if (card.value === "reverse") {
      const reversed: UnoGameState = { ...state, direction: -1 };
      return {
        ...reversed,
        activePlayerId:
          state.playerOrder.length === 2
            ? this.nextPlayer(reversed, 1)
            : reversed.playerOrder[reversed.playerOrder.length - 1] ?? state.activePlayerId,
      };
    }
    if (card.value === "draw2") return { ...state, pendingDraw: 2 };
    return state;
  }

  // ---------------------------------------------------------------------------
  // Rules
  // ---------------------------------------------------------------------------

  /** Whether `card` may be played on the current discard. */
  isPlayable(state: UnoGameState, card: UnoCard): boolean {
    // While a draw penalty stands, only another draw card can be stacked onto it
    // (and only when stacking is enabled by config).
    if (state.pendingDraw > 0) return false;

    if (isWild(card)) return true;
    const top = this.topCard(state);
    if (!top) return true;
    return card.color === state.activeColor || card.value === top.value;
  }

  topCard(state: UnoGameState): UnoCard | null {
    return state.discardPile[state.discardPile.length - 1] ?? null;
  }

  playableCardIds(state: UnoGameState, playerId: string): string[] {
    const hand = state.hands[playerId] ?? [];
    return hand.filter((c) => this.isPlayable(state, c)).map((c) => c.id);
  }

  validateAction(state: UnoGameState, action: UnoAction): ActionValidationResult {
    if (state.isFinished) return { valid: false, reason: "This game has already finished." };
    if (action.playerId !== state.activePlayerId) {
      return { valid: false, reason: "It's not your turn." };
    }
    const hand = state.hands[action.playerId];
    if (!hand) return { valid: false, reason: "You're not in this game." };

    switch (action.type) {
      case "PLAY_CARD": {
        const payload = action.payload as UnoPlayCardPayload;
        if (!payload?.cardId) return { valid: false, reason: "No card selected." };

        const card = hand.find((c) => c.id === payload.cardId);
        if (!card) return { valid: false, reason: "That card isn't in your hand." };

        if (state.pendingDraw > 0) {
          return {
            valid: false,
            reason: `You must draw ${state.pendingDraw} card${state.pendingDraw === 1 ? "" : "s"} first.`,
          };
        }
        if (!this.isPlayable(state, card)) {
          return { valid: false, reason: "That card doesn't match the colour or value." };
        }
        if (isWild(card) && !payload.chosenColor) {
          return { valid: false, reason: "Choose a colour for your wild card." };
        }
        if (payload.chosenColor && !UNO_COLORS.includes(payload.chosenColor)) {
          return { valid: false, reason: "That isn't a valid colour." };
        }
        return { valid: true };
      }

      case "DRAW_CARD":
        if (state.hasDrawn && state.pendingDraw === 0) {
          return { valid: false, reason: "You've already drawn this turn." };
        }
        return { valid: true };

      case "PASS":
        if (!state.hasDrawn) {
          return { valid: false, reason: "You must draw before passing." };
        }
        return { valid: true };

      case "CALL_UNO":
        if (hand.length !== 2) {
          return { valid: false, reason: "You can only call UNO as you play your second-to-last card." };
        }
        return { valid: true };

      default:
        return { valid: false, reason: `Unknown action: ${(action as { type: string }).type}` };
    }
  }

  applyAction(state: UnoGameState, action: UnoAction): ActionResult<UnoGameState, UnoEvent> {
    switch (action.type) {
      case "PLAY_CARD":
        return this.playCard(state, action.playerId, action.payload as UnoPlayCardPayload);
      case "DRAW_CARD":
        return this.drawCard(state, action.playerId);
      case "PASS":
        return this.passTurn(state, action.playerId);
      case "CALL_UNO":
        return {
          state: { ...state, saidUno: [...new Set([...state.saidUno, action.playerId])] },
          events: [{ type: "UNO_CALLED", playerId: action.playerId }],
        };
      default:
        return { state, events: [] };
    }
  }

  protected playCard(
    state: UnoGameState,
    playerId: string,
    payload: UnoPlayCardPayload,
  ): ActionResult<UnoGameState, UnoEvent> {
    const events: UnoEvent[] = [];
    const hand = [...(state.hands[playerId] ?? [])];
    const index = hand.findIndex((c) => c.id === payload.cardId);
    const card = hand[index]!;
    hand.splice(index, 1);

    const played: UnoCard = isWild(card) ? { ...card, color: payload.chosenColor! } : card;
    events.push({ type: "CARD_PLAYED", playerId, card: played });

    let next: UnoGameState = {
      ...state,
      hands: { ...state.hands, [playerId]: hand },
      discardPile: [...state.discardPile, played],
      activeColor: isWild(card) ? payload.chosenColor! : (card.color ?? state.activeColor),
      hasDrawn: false,

    };

    if (isWild(card)) {
      events.push({ type: "COLOR_CHOSEN", playerId, color: payload.chosenColor! });
    }

    // Announcing UNO: required when going down to one card, or the player is
    // penalised (see below).
    let saidUno = state.saidUno.filter((id) => id !== playerId);
    if (hand.length === 1 && payload.declareUno) {
      saidUno = [...saidUno, playerId];
      events.push({ type: "UNO_CALLED", playerId });
    }
    next = { ...next, saidUno };

    // Winning ends the game immediately, before any card effect resolves.
    if (hand.length === 0) {
      events.push({ type: "GAME_WON", playerId });
      return {
        state: {
          ...next,
          isFinished: true,
          phase: "finished",
          winnerId: playerId,
          activePlayerId: null,
        },
        events,
      };
    }

    // Forgetting to call UNO costs two cards.
    if (hand.length === 1 && !payload.declareUno) {
      const penalised = this.drawCards(next, playerId, UNO_PENALTY_CARDS);
      next = penalised.state;
      events.push({ type: "UNO_PENALTY", playerId, count: UNO_PENALTY_CARDS });
    }

    next = this.applyCardEffect(next, played, events);
    return { state: next, events };
  }

  /** Resolves skip / reverse / draw2 / wild_draw4 and advances the turn. */
  protected applyCardEffect(
    state: UnoGameState,
    card: UnoCard,
    events: UnoEvent[],
  ): UnoGameState {
    let next = state;
    let skipExtra = false;

    switch (card.value) {
      case "skip":
        skipExtra = true;
        events.push({ type: "PLAYER_SKIPPED", playerId: this.nextPlayer(next, 1) ?? undefined });
        break;

      case "reverse":
        next = { ...next, direction: (next.direction * -1) as 1 | -1 };
        events.push({ type: "DIRECTION_REVERSED" });
        // With two players a reverse acts as a skip, returning the turn.
        if (next.playerOrder.length === 2) skipExtra = true;
        break;

      case "draw2":
        next = { ...next, pendingDraw: next.pendingDraw + 2 };
        events.push({ type: "DRAW_PENALTY", count: 2 });
        break;

      case "wild_draw4":
        next = { ...next, pendingDraw: next.pendingDraw + 4 };
        events.push({ type: "DRAW_PENALTY", count: 4 });
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

  protected drawCard(state: UnoGameState, playerId: string): ActionResult<UnoGameState, UnoEvent> {
    const events: UnoEvent[] = [];

    // Serving a penalty: take the whole stack and lose the turn.
    if (state.pendingDraw > 0) {
      const count = state.pendingDraw;
      const drawn = this.drawCards(state, playerId, count, events);
      events.push({ type: "CARD_DRAWN", playerId, count });
      return {
        state: {
          ...drawn.state,
          pendingDraw: 0,
          hasDrawn: false,

          activePlayerId: this.nextPlayer(drawn.state, 1),
          turnNumber: state.turnNumber + 1,
        },
        events,
      };
    }

    // Ordinary draw: take one, then the player may play it or pass.
    const drawn = this.drawCards(state, playerId, 1, events);
    events.push({ type: "CARD_DRAWN", playerId, count: 1 });
    return {
      state: { ...drawn.state, hasDrawn: true },
      events,
    };
  }

  protected passTurn(state: UnoGameState, playerId: string): ActionResult<UnoGameState, UnoEvent> {
    void playerId;
    return {
      state: {
        ...state,
        hasDrawn: false,

        activePlayerId: this.nextPlayer(state, 1),
        turnNumber: state.turnNumber + 1,
      },
      events: [],
    };
  }

  /**
   * Moves `count` cards to a hand, reshuffling the discard pile back into the
   * draw pile when it runs out (the top card stays in play).
   */
  protected drawCards(
    state: UnoGameState,
    playerId: string,
    count: number,
    events: UnoEvent[] = [],
  ): { state: UnoGameState } {
    let drawPile = [...state.drawPile];
    let discardPile = [...state.discardPile];
    const hand = [...(state.hands[playerId] ?? [])];

    for (let i = 0; i < count; i++) {
      if (drawPile.length === 0) {
        if (discardPile.length <= 1) break; // nothing left to recycle
        const top = discardPile[discardPile.length - 1]!;
        const recycled = discardPile.slice(0, -1).map((c) =>
          // A wild returns to the deck colourless, as it does in the box.
          isWild(c) ? { ...c, color: null } : c,
        );
        drawPile = shuffle(recycled, createRng(state.rngSeed + state.sequenceNumber + i));
        discardPile = [top];
        events.push({ type: "DECK_RESHUFFLED", count: drawPile.length });
      }
      const card = drawPile.pop();
      if (!card) break;
      hand.push(card);
    }

    return {
      state: {
        ...state,
        drawPile,
        discardPile,
        hands: { ...state.hands, [playerId]: hand },
        // Holding more than one card means any prior UNO call no longer stands.
        saidUno: hand.length > 1 ? state.saidUno.filter((id) => id !== playerId) : state.saidUno,
      },
    };
  }

  /** Seat `steps` places along the current direction. */
  protected nextPlayer(state: UnoGameState, steps: number): string {
    const order = state.playerOrder;
    const current = order.indexOf(state.activePlayerId ?? order[0]!);
    const index = (((current + steps * state.direction) % order.length) + order.length) % order.length;
    return order[index]!;
  }

  // ---------------------------------------------------------------------------
  // Views and results
  // ---------------------------------------------------------------------------

  getPlayerView(state: UnoGameState, playerId: string | null): UnoPlayerView {
    const myHand = playerId ? (state.hands[playerId] ?? []) : [];
    const isMyTurn = playerId !== null && playerId === state.activePlayerId && !state.isFinished;

    return {
      phase: state.phase,
      isFinished: state.isFinished,
      myHand,
      playableCardIds: isMyTurn && playerId ? this.playableCardIds(state, playerId) : [],
      // Opponents are counts only: their cards never leave the server.
      opponents: state.playerOrder
        .filter((id) => id !== playerId)
        .map((id) => ({
          playerId: id,
          cardCount: state.hands[id]?.length ?? 0,
          hasCalledUno: state.saidUno.includes(id),
        })),
      topCard: this.topCard(state),
      activeColor: state.activeColor,
      drawPileCount: state.drawPile.length,
      discardPileCount: state.discardPile.length,
      direction: state.direction,
      activePlayerId: state.activePlayerId,
      isMyTurn,
      pendingDraw: state.pendingDraw,
      hasDrawn: state.hasDrawn,
      winnerId: state.winnerId,
      turnNumber: state.turnNumber,
      sequenceNumber: state.sequenceNumber,
      updatedAt: state.updatedAt,
    };
  }

  isGameOver(state: UnoGameState): boolean {
    return state.isFinished;
  }

  calculateResult(state: UnoGameState, roomId = "room_uno"): UnoResult {
    const finalHandSizes: Record<string, number> = {};
    for (const id of state.playerOrder) finalHandSizes[id] = state.hands[id]?.length ?? 0;

    // Fewer cards ranks higher; the winner is on zero.
    const ranked = [...state.playerOrder].sort(
      (a, b) => (finalHandSizes[a] ?? 0) - (finalHandSizes[b] ?? 0),
    );

    return {
      gameId: this.gameId,
      roomId,
      winnerId: state.winnerId,
      scores: ranked.map((userId, index) => ({
        playerId: userId,
        userId,
        rank: index + 1,
        score: Math.max(0, 20 - (finalHandSizes[userId] ?? 0)),
        isWinner: userId === state.winnerId,
      })),
      durationSeconds: Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000)),
      reason: state.winnerId ? "normal" : "draw",
      finalHandSizes,
    } as UnoResult;
  }
}
