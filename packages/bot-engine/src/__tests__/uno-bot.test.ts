import { describe, expect, it } from "vitest";
import {
  UnoEngine,
  UnoNoMercyEngine,
  type UnoCard,
  type UnoGameState,
} from "@playora/game-engine";
import type { Player } from "@playora/game-types";
import type { AiLevel } from "../types.js";
import { UnoBot } from "../uno/UnoBot.js";

const seeded = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const players = (n: number): Player[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    userId: `p${i + 1}`,
    displayName: `Player ${i + 1}`,
    isBot: false,
    isGuest: false,
    seat: i,
  }));

const card = (id: string, color: UnoCard["color"], value: UnoCard["value"]): UnoCard => ({
  id,
  color,
  value,
});

describe("UnoBot", () => {
  it("plays a full game against itself without ever proposing an illegal action", () => {
    const engine = new UnoEngine();
    const bot = new UnoBot(engine, seeded(7));
    let state = engine.init(players(4), { randomSeed: "bot-fuzz" });

    let turns = 0;
    while (!engine.isGameOver(state) && turns < 4000) {
      const seat = state.activePlayerId;
      expect(seat).toBeTruthy();
      const action = bot.chooseAction(state, seat!, 5);
      expect(action).not.toBeNull();

      // The whole safety claim in one assertion: whatever the bot proposes has
      // to survive the engine's own validation, same as a human's move.
      expect(engine.validateAction(state, action!)).toEqual({ valid: true });
      state = engine.executeAction(state, action!).state;
      turns += 1;
    }

    expect(engine.isGameOver(state)).toBe(true);
    expect(state.winnerId).toBeTruthy();
    expect(state.hands[state.winnerId!]).toHaveLength(0);
  });

  it("plays a full No Mercy game without ever proposing an illegal action", () => {
    const engine = new UnoNoMercyEngine();
    const bot = new UnoBot(engine, seeded(21));
    let state = engine.init(players(4), { randomSeed: "no-mercy-fuzz" });

    let turns = 0;
    while (!engine.isGameOver(state) && turns < 6000) {
      const seat = state.activePlayerId!;
      const action = bot.chooseAction(state, seat, 6);
      expect(engine.validateAction(state, action!)).toEqual({ valid: true });
      state = engine.executeAction(state, action!).state;
      turns += 1;
    }
    expect(engine.isGameOver(state)).toBe(true);
  });

  it("declines to act when it is not the bot's turn", () => {
    const engine = new UnoEngine();
    const bot = new UnoBot(engine, seeded(1));
    const state = engine.init(players(2), { randomSeed: "turn" });
    const idle = state.playerOrder.find((p) => p !== state.activePlayerId)!;
    expect(bot.chooseAction(state, idle, 5)).toBeNull();
  });

  const base = (over: Partial<UnoGameState>): UnoGameState => {
    const engine = new UnoEngine();
    const init = engine.init(players(2), { randomSeed: "base" });
    return { ...init, ...over };
  };

  it("plays its last card rather than anything else", () => {
    const engine = new UnoEngine();
    const bot = new UnoBot(engine, seeded(3));
    const state = base({
      activePlayerId: "p1",
      activeColor: "red",
      discardPile: [card("top", "red", "5")],
      hands: { p1: [card("win", "red", "9")], p2: [card("x", "blue", "1")] },
      pendingDraw: 0,
      hasDrawn: false,
    });

    const action = bot.chooseAction(state, "p1", 1)!;
    expect(action.type).toBe("PLAY_CARD");
    expect((action.payload as { cardId: string }).cardId).toBe("win");
  });

  it("draws when nothing is playable, then passes once it has drawn", () => {
    const engine = new UnoEngine();
    const bot = new UnoBot(engine, seeded(4));
    const stuck = base({
      activePlayerId: "p1",
      activeColor: "red",
      discardPile: [card("top", "red", "5")],
      hands: { p1: [card("a", "blue", "1"), card("b", "green", "2")], p2: [card("x", "blue", "1")] },
      pendingDraw: 0,
      hasDrawn: false,
    });

    expect(bot.chooseAction(stuck, "p1", 5)!.type).toBe("DRAW_CARD");
    expect(bot.chooseAction({ ...stuck, hasDrawn: true }, "p1", 5)!.type).toBe("PASS");
  });

  it("names the colour it holds most of after a wild", () => {
    const engine = new UnoEngine();
    const bot = new UnoBot(engine, seeded(5));
    const state = base({
      activePlayerId: "p1",
      activeColor: "red",
      discardPile: [card("top", "red", "5")],
      hands: {
        p1: [
          card("w", null, "wild"),
          card("g1", "green", "1"),
          card("g2", "green", "4"),
          card("g3", "green", "7"),
          card("b1", "blue", "2"),
        ],
        p2: [card("x", "blue", "1"), card("y", "blue", "3")],
      },
      pendingDraw: 0,
      hasDrawn: false,
    });

    // Force the wild by leaving it as the only legal card.
    const wildOnly = { ...state, hands: { ...state.hands, p1: [card("w", null, "wild"), card("g1", "green", "1"), card("g2", "green", "4")] } };
    const action = bot.chooseAction({ ...wildOnly, activeColor: "yellow", discardPile: [card("top", "yellow", "5")] }, "p1", 7)!;
    if (action.type === "PLAY_CARD" && (action.payload as { cardId: string }).cardId === "w") {
      expect((action.payload as { chosenColor?: string }).chosenColor).toBe("green");
    }
  });

  it("announces UNO when playing its second-to-last card at high levels", () => {
    const engine = new UnoEngine();
    const bot = new UnoBot(engine, seeded(6));
    const state = base({
      activePlayerId: "p1",
      activeColor: "red",
      discardPile: [card("top", "red", "5")],
      hands: { p1: [card("a", "red", "3"), card("b", "red", "8")], p2: [card("x", "blue", "1")] },
      pendingDraw: 0,
      hasDrawn: false,
    });

    const action = bot.chooseAction(state, "p1", 7)!;
    expect((action.payload as { declareUno?: boolean }).declareUno).toBe(true);
  });

  it("stacks a draw card onto a pending penalty under No Mercy rules", () => {
    const engine = new UnoNoMercyEngine();
    const bot = new UnoBot(engine, seeded(8));
    const init = engine.init(players(2), { randomSeed: "stack" });
    const state: UnoGameState = {
      ...init,
      activePlayerId: "p1",
      activeColor: "red",
      discardPile: [card("top", "red", "draw2")],
      hands: {
        p1: [card("d", "blue", "draw2"), card("n", "red", "3")],
        p2: [card("x", "blue", "1")],
      },
      pendingDraw: 2,
      hasDrawn: false,
    };

    const action = bot.chooseAction(state, "p1", 6)!;
    expect(action.type).toBe("PLAY_CARD");
    expect((action.payload as { cardId: string }).cardId).toBe("d");
  });

  it("cannot see opponents' cards", () => {
    const engine = new UnoEngine();
    const hand = [card("a", "red", "3"), card("b", "blue", "8"), card("c", null, "wild")];

    const withOpponent = (opponent: UnoCard[]): UnoGameState =>
      base({
        activePlayerId: "p1",
        activeColor: "red",
        discardPile: [card("top", "red", "5")],
        hands: { p1: hand.map((c) => ({ ...c })), p2: opponent },
        pendingDraw: 0,
        hasDrawn: false,
      });

    // Same counts, wildly different contents. A bot that peeked would play
    // differently against a hand of four wilds than against four blue 1s.
    const weak = withOpponent([
      card("o1", "blue", "1"),
      card("o2", "blue", "2"),
      card("o3", "blue", "3"),
      card("o4", "blue", "4"),
    ]);
    const strong = withOpponent([
      card("o1", null, "wild_draw4"),
      card("o2", null, "wild_draw4"),
      card("o3", null, "wild"),
      card("o4", "red", "skip"),
    ]);

    const a = new UnoBot(engine, seeded(11)).chooseAction(weak, "p1", 7);
    const b = new UnoBot(engine, seeded(11)).chooseAction(strong, "p1", 7);
    expect(a).toEqual(b);
  });

  it("makes the difficulty ladder real, not cosmetic", () => {
    // Each pairing is played from both seats, because moving first in
    // heads-up UNO is worth roughly seven points on its own -- a one-sided
    // sample would credit the seat rather than the skill.
    const duel = (levelA: AiLevel, levelB: AiLevel, games = 60): number => {
      let aWins = 0;
      for (let game = 0; game < games; game++) {
        const aIsFirst = game % 2 === 0;
        const engine = new UnoEngine();
        const first = new UnoBot(engine, seeded(1000 + game));
        const second = new UnoBot(engine, seeded(9000 + game));
        let state = engine.init(players(2), { randomSeed: `ladder-${game}` });

        let turns = 0;
        while (!engine.isGameOver(state) && turns < 3000) {
          const seat = state.activePlayerId!;
          const isSeatOne = seat === "p1";
          const bot = isSeatOne ? first : second;
          const level = isSeatOne === aIsFirst ? levelA : levelB;
          state = engine.executeAction(state, bot.chooseAction(state, seat, level)!).state;
          turns += 1;
        }
        const winnerIsA = (state.winnerId === "p1") === aIsFirst;
        if (state.winnerId && winnerIsA) aWins += 1;
      }
      return aWins;
    };

    // A master should beat a beginner overwhelmingly.
    expect(duel(7, 1)).toBeGreaterThan(45);
    // And the middle of the ladder should sit in between, not alongside.
    const midWins = duel(5, 1);
    expect(midWins).toBeGreaterThan(33);
    expect(midWins).toBeLessThan(duel(7, 1) + 6);
  });

  it("scales thinking time with level", () => {
    const bot = new UnoBot(new UnoEngine(), seeded(2));
    expect(bot.thinkingTimeMs(7)).toBeGreaterThan(bot.thinkingTimeMs(1));
  });

  it("reports the game id of the engine it was given", () => {
    expect(new UnoBot(new UnoEngine()).gameId).toBe("uno");
    expect(new UnoBot(new UnoNoMercyEngine()).gameId).toBe("uno-no-mercy");
  });
});
