import {
  UnoEngine,
  drawPenaltyOf,
  isWild,
  UNO_COLORS,
  type UnoAction,
  type UnoCard,
  type UnoColor,
  type UnoGameState,
  type UnoPlayCardPayload,
} from "@playora/game-engine";
import type { GameId } from "@playora/game-types";
import type { AiLevel, BotEngine, RandomSource } from "../types.js";

interface LevelProfile {
  /** Chance of ignoring the ranking and playing a random legal card. */
  blunderChance: number;
  /** Chance of remembering to announce UNO on the penultimate card. */
  unoReliability: number;
  /**
   * Whether the bot reads how close the next player is to going out. Low
   * levels play their own hand and nothing else, which is what makes them
   * feel like a beginner rather than merely a slow expert.
   */
  readsOpponents: boolean;
  /** Whether the bot hoards wilds for when it is genuinely stuck. */
  savesWilds: boolean;
  thinkMs: number;
}

/**
 * Measured, not guessed. Every value here was set by playing the ladder against
 * itself over hundreds of hands (see the strength test), and the numbers say
 * something worth recording: the blunder rate is the only lever the win rate
 * really responds to. A one-ply lookahead that maximised the bot's future
 * playable cards was tried here and *lost* games at every level, because UNO
 * rewards tempo over keeping a flexible hand. Levels 6 and 7 therefore play
 * near-identically; separating them needs the bot to remember the discard
 * history across turns, which this stateless interface does not allow.
 */
const PROFILES: Record<AiLevel, LevelProfile> = {
  1: { blunderChance: 0.85, unoReliability: 0.2, readsOpponents: false, savesWilds: false, thinkMs: 500 },
  2: { blunderChance: 0.62, unoReliability: 0.4, readsOpponents: false, savesWilds: false, thinkMs: 600 },
  3: { blunderChance: 0.42, unoReliability: 0.65, readsOpponents: false, savesWilds: true, thinkMs: 700 },
  4: { blunderChance: 0.26, unoReliability: 0.8, readsOpponents: true, savesWilds: true, thinkMs: 800 },
  5: { blunderChance: 0.14, unoReliability: 0.92, readsOpponents: true, savesWilds: true, thinkMs: 900 },
  6: { blunderChance: 0.05, unoReliability: 1, readsOpponents: true, savesWilds: true, thinkMs: 1000 },
  7: { blunderChance: 0, unoReliability: 1, readsOpponents: true, savesWilds: true, thinkMs: 1100 },
};

/**
 * What the bot is allowed to know.
 *
 * The bot runs on the server and is handed the full authoritative state, which
 * contains every hand. Reading an opponent's cards would make it unbeatable and
 * indistinguishable from cheating, so the bot first reduces the state to the
 * same information a human at the table has: its own hand, and everyone else's
 * card *counts*.
 */
interface TableKnowledge {
  myHand: UnoCard[];
  /** Card counts by seat, in turn order, excluding me. */
  opponentCounts: Record<string, number>;
  /** How many cards the player who acts next is holding. */
  nextPlayerCount: number;
  colorCounts: Record<UnoColor, number>;
}

/**
 * Heuristic UNO AI, shared by classic UNO and No Mercy.
 *
 * There is no search here, and deliberately so: UNO is a hidden-information
 * game, so a deep tree over unknown hands buys far less than good card-shedding
 * policy does. The bot ranks its legal cards and plays the best one, with a
 * level-scaled chance of doing something worse on purpose.
 *
 * Like every bot on the platform it returns an *action*, which the caller runs
 * through the engine's own validation — it never touches state directly.
 */
export class UnoBot implements BotEngine<UnoGameState, UnoAction> {
  readonly gameId: GameId;

  /**
   * The engine is injected because playability differs between variants: No
   * Mercy lets you stack a draw card onto a pending penalty, classic does not.
   * Asking the engine keeps the bot honest about the rules actually in force.
   */
  constructor(
    private readonly engine: UnoEngine = new UnoEngine(),
    private readonly random: RandomSource = Math.random,
  ) {
    this.gameId = engine.gameId;
  }

  thinkingTimeMs(level: AiLevel): number {
    return PROFILES[level].thinkMs;
  }

  chooseAction(state: UnoGameState, playerId: string, level: AiLevel): UnoAction | null {
    if (state.isFinished) return null;
    if (state.activePlayerId !== playerId) return null;

    const hand = state.hands[playerId];
    if (!hand) return null;

    const profile = PROFILES[level];
    const knowledge = this.observe(state, playerId);
    const playable = hand.filter((card) => this.engine.isPlayable(state, card));

    if (playable.length === 0) {
      // Nothing legal. Draw once, then pass if the drawn card did not help.
      if (state.pendingDraw > 0 || !state.hasDrawn) {
        return { type: "DRAW_CARD", playerId, payload: {}, timestamp: Date.now() };
      }
      return { type: "PASS", playerId, payload: {}, timestamp: Date.now() };
    }

    const card = this.pick(playable, state, knowledge, profile);
    const payload: UnoPlayCardPayload = { cardId: card.id };

    if (isWild(card)) {
      payload.chosenColor = this.chooseColor(knowledge, card);
    }
    // Announcing UNO is a separate obligation from playing the card. Playing
    // the second-to-last card is the moment it has to happen.
    if (hand.length === 2 && this.random() < profile.unoReliability) {
      payload.declareUno = true;
    }

    return { type: "PLAY_CARD", playerId, payload, timestamp: Date.now() };
  }

  /** Reduce authoritative state to what a player at the table could observe. */
  private observe(state: UnoGameState, playerId: string): TableKnowledge {
    const myHand = state.hands[playerId] ?? [];
    const opponentCounts: Record<string, number> = {};
    for (const seat of state.playerOrder) {
      if (seat === playerId) continue;
      opponentCounts[seat] = state.hands[seat]?.length ?? 0;
    }

    const colorCounts = { red: 0, yellow: 0, green: 0, blue: 0 } satisfies Record<UnoColor, number>;
    for (const card of myHand) {
      if (card.color) colorCounts[card.color] += 1;
    }

    const nextSeat = this.seatAfter(state, playerId);
    return {
      myHand,
      opponentCounts,
      nextPlayerCount: nextSeat ? (opponentCounts[nextSeat] ?? 0) : 0,
      colorCounts,
    };
  }

  /**
   * Who acts after me, skipping eliminated seats.
   *
   * Duplicated from the engine rather than shared, because the engine's version
   * is a rules primitive and this one is a *guess* the bot makes before its own
   * card has been played — the two must be free to disagree.
   */
  private seatAfter(state: UnoGameState, playerId: string): string | null {
    const order = state.playerOrder;
    const start = order.indexOf(playerId);
    if (start < 0 || order.length < 2) return null;

    const eliminated = new Set(state.eliminated ?? []);
    for (let step = 1; step <= order.length; step++) {
      const idx = (start + step * state.direction + order.length * order.length) % order.length;
      const seat = order[idx];
      if (seat && seat !== playerId && !eliminated.has(seat)) return seat;
    }
    return null;
  }

  private pick(
    playable: UnoCard[],
    state: UnoGameState,
    knowledge: TableKnowledge,
    profile: LevelProfile,
  ): UnoCard {
    // Going out ends the game — never pass that up, at any level.
    if (knowledge.myHand.length === 1) return playable[0]!;

    if (this.random() < profile.blunderChance) {
      return playable[Math.floor(this.random() * playable.length)] ?? playable[0]!;
    }

    let best = playable[0]!;
    let bestScore = -Infinity;
    for (const card of playable) {
      const score = this.score(card, state, knowledge, profile);
      if (score > bestScore) {
        bestScore = score;
        best = card;
      }
    }
    return best;
  }

  private score(
    card: UnoCard,
    state: UnoGameState,
    knowledge: TableKnowledge,
    profile: LevelProfile,
  ): number {
    const penalty = drawPenaltyOf(card.value);
    const nextCount = knowledge.nextPlayerCount;
    const threatened = profile.readsOpponents && nextCount > 0 && nextCount <= 2;

    let score: number;

    if (isWild(card)) {
      // A wild is the only card guaranteed to be playable later, so it is worth
      // more in hand than on the table — unless it also carries a penalty.
      score = profile.savesWilds ? -30 : 10;
      score += penalty * 3;
    } else {
      score = 40;
      // Shedding a colour you are short of consolidates the hand; playing from
      // your longest colour keeps the active colour one you can follow.
      score += (knowledge.colorCounts[card.color as UnoColor] ?? 0) * 4;
      if (card.value === "skip" || card.value === "reverse") score += 6;
      if (card.value === "skip_everyone") score += 25;
      if (card.value === "discard_all") {
        // Discard All sheds every card of the active colour at once.
        score += (knowledge.colorCounts[card.color as UnoColor] ?? 1) * 12;
      }
      score += penalty * 4;
    }

    // Pressure the player about to go out: penalties and skips are worth far
    // more when the next seat is one card from winning.
    if (threatened) {
      score += penalty * 12;
      if (card.value === "skip" || card.value === "skip_everyone") score += 45;
      if (card.value === "reverse" && state.playerOrder.length === 2) score += 45;
    }

    // Stacking onto a live penalty is strictly better than eating it.
    if (state.pendingDraw > 0 && penalty > 0) score += 200 + penalty * 5;

    return score;
  }

  /** The colour this bot holds most of. Ties break toward the first colour. */
  private bestColor(knowledge: TableKnowledge): UnoColor {
    let best: UnoColor = UNO_COLORS[0]!;
    let bestCount = -1;
    for (const color of UNO_COLORS) {
      if (knowledge.colorCounts[color] > bestCount) {
        bestCount = knowledge.colorCounts[color];
        best = color;
      }
    }
    return best;
  }

  /** After a wild, name the colour you hold most of; ties broken deterministically. */
  private chooseColor(knowledge: TableKnowledge, played: UnoCard): UnoColor {
    const best = this.bestColor(knowledge);
    if (knowledge.colorCounts[best] > 0) return best;

    // A hand of nothing but wilds: any colour is equally good, so pick one at
    // random rather than always naming red and becoming predictable.
    void played;
    return UNO_COLORS[Math.floor(this.random() * UNO_COLORS.length)] ?? best;
  }
}
