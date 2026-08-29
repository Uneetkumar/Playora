import { describe, it, expect } from "vitest";
import type { Player } from "@playora/game-types";
import { UnoEngine } from "../uno/UnoEngine.js";
import { buildDeck, createRng, seedFromString, shuffle } from "../uno/deck.js";
import type { UnoCard, UnoColor, UnoGameState, UnoValue } from "../uno/types.js";

const engine = new UnoEngine();

const players: Player[] = [
  { userId: "alice", displayName: "Alice" } as Player,
  { userId: "bob", displayName: "Bob" } as Player,
];

const card = (color: UnoColor | null, value: UnoValue, id = `${color}-${value}`): UnoCard => ({
  id,
  color,
  value,
});

/** Builds a controlled position so rules can be tested without dealing luck. */
function position(over: Partial<UnoGameState> = {}): UnoGameState {
  const base = engine.init(players, { randomSeed: "test" });
  return {
    ...base,
    hands: { alice: [], bob: [] },
    discardPile: [card("red", "5")],
    activeColor: "red",
    activePlayerId: "alice",
    pendingDraw: 0,
    hasDrawn: false,
    saidUno: [],
    ...over,
  };
}

const play = (state: UnoGameState, playerId: string, payload: object) =>
  engine.applyAction(state, {
    type: "PLAY_CARD",
    playerId,
    payload,
    timestamp: Date.now(),
  } as never);

describe("UNO deck", () => {
  it("is a standard 108-card deck", () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(108);

    const count = (v: UnoValue) => deck.filter((c) => c.value === v).length;
    expect(count("0")).toBe(4); // one zero per colour
    expect(count("7")).toBe(8); // two of each 1-9 per colour
    expect(count("skip")).toBe(8);
    expect(count("reverse")).toBe(8);
    expect(count("draw2")).toBe(8);
    expect(count("wild")).toBe(4);
    expect(count("wild_draw4")).toBe(4);
  });

  it("gives every card a unique id", () => {
    const deck = buildDeck();
    expect(new Set(deck.map((c) => c.id)).size).toBe(deck.length);
  });

  it("shuffles deterministically from a seed", () => {
    const a = shuffle(buildDeck(), createRng(seedFromString("same")));
    const b = shuffle(buildDeck(), createRng(seedFromString("same")));
    const c = shuffle(buildDeck(), createRng(seedFromString("different")));
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
    expect(a.map((x) => x.id)).not.toEqual(c.map((x) => x.id));
  });

  it("actually reorders the deck", () => {
    const original = buildDeck();
    const shuffled = shuffle(original, createRng(42));
    expect(shuffled.map((c) => c.id)).not.toEqual(original.map((c) => c.id));
    expect(new Set(shuffled.map((c) => c.id))).toEqual(new Set(original.map((c) => c.id)));
  });
});

describe("UNO setup", () => {
  it("deals seven cards to each player", () => {
    const state = engine.init(players, { randomSeed: "deal" });
    expect(state.hands.alice).toHaveLength(7);
    expect(state.hands.bob).toHaveLength(7);
  });

  it("never opens on a wild, which would leave no colour in play", () => {
    for (let i = 0; i < 60; i++) {
      const state = engine.init(players, { randomSeed: `seed-${i}` });
      const top = state.discardPile[state.discardPile.length - 1]!;
      expect(["wild", "wild_draw4"]).not.toContain(top.value);
      expect(state.activeColor).toBe(top.color);
    }
  });

  it("conserves the whole deck across hands, draw pile and discard", () => {
    const state = engine.init(players, { randomSeed: "conserve" });
    const total =
      state.drawPile.length +
      state.discardPile.length +
      state.hands.alice!.length +
      state.hands.bob!.length;
    expect(total).toBe(108);
  });

  it("is reproducible from the same seed", () => {
    const a = engine.init(players, { randomSeed: "repeat" });
    const b = engine.init(players, { randomSeed: "repeat" });
    expect(a.hands.alice!.map((c) => c.id)).toEqual(b.hands.alice!.map((c) => c.id));
  });
});

describe("UNO card matching", () => {
  it("allows a matching colour or matching value", () => {
    const state = position();
    expect(engine.isPlayable(state, card("red", "9"))).toBe(true); // colour
    expect(engine.isPlayable(state, card("blue", "5"))).toBe(true); // value
    expect(engine.isPlayable(state, card("blue", "9"))).toBe(false);
  });

  it("always allows wilds", () => {
    const state = position();
    expect(engine.isPlayable(state, card(null, "wild"))).toBe(true);
    expect(engine.isPlayable(state, card(null, "wild_draw4"))).toBe(true);
  });

  it("matches the chosen colour after a wild, not the card underneath", () => {
    const state = position({ discardPile: [card(null, "wild")], activeColor: "green" });
    expect(engine.isPlayable(state, card("green", "3"))).toBe(true);
    expect(engine.isPlayable(state, card("red", "3"))).toBe(false);
  });
});

describe("UNO validation", () => {
  it("refuses a move out of turn", () => {
    const state = position({ hands: { alice: [card("red", "3")], bob: [card("red", "4")] } });
    const result = engine.validateAction(state, {
      type: "PLAY_CARD",
      playerId: "bob",
      payload: { cardId: "red-4" },
      timestamp: Date.now(),
    } as never);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/not your turn/i);
  });

  it("refuses a card the player does not hold", () => {
    const state = position({ hands: { alice: [card("red", "3")], bob: [] } });
    const result = engine.validateAction(state, {
      type: "PLAY_CARD",
      playerId: "alice",
      payload: { cardId: "blue-9" },
      timestamp: Date.now(),
    } as never);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/isn't in your hand/i);
  });

  it("refuses a non-matching card", () => {
    const state = position({ hands: { alice: [card("blue", "9")], bob: [] } });
    const result = engine.validateAction(state, {
      type: "PLAY_CARD",
      playerId: "alice",
      payload: { cardId: "blue-9" },
      timestamp: Date.now(),
    } as never);
    expect(result.valid).toBe(false);
  });

  it("requires a colour when playing a wild", () => {
    const state = position({ hands: { alice: [card(null, "wild")], bob: [] } });
    const result = engine.validateAction(state, {
      type: "PLAY_CARD",
      playerId: "alice",
      payload: { cardId: "null-wild" },
      timestamp: Date.now(),
    } as never);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/colour/i);
  });

  it("requires the draw penalty to be served before playing", () => {
    const state = position({ hands: { alice: [card("red", "3")], bob: [] }, pendingDraw: 2 });
    const result = engine.validateAction(state, {
      type: "PLAY_CARD",
      playerId: "alice",
      payload: { cardId: "red-3" },
      timestamp: Date.now(),
    } as never);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/must draw/i);
  });

  it("refuses passing before drawing", () => {
    const state = position({ hands: { alice: [card("red", "3")], bob: [] } });
    const result = engine.validateAction(state, {
      type: "PASS",
      playerId: "alice",
      payload: {},
      timestamp: Date.now(),
    } as never);
    expect(result.valid).toBe(false);
  });
});

describe("UNO card effects", () => {
  it("skip returns the turn in a two-player game", () => {
    const state = position({ hands: { alice: [card("red", "skip"), card("red", "1")], bob: [] } });
    const next = play(state, "alice", { cardId: "red-skip" }).state;
    expect(next.activePlayerId).toBe("alice");
  });

  it("reverse acts as a skip with two players", () => {
    const state = position({ hands: { alice: [card("red", "reverse"), card("red", "1")], bob: [] } });
    const next = play(state, "alice", { cardId: "red-reverse" }).state;
    expect(next.direction).toBe(-1);
    expect(next.activePlayerId).toBe("alice");
  });

  it("draw2 stacks a penalty on the next player", () => {
    const state = position({ hands: { alice: [card("red", "draw2"), card("red", "1")], bob: [] } });
    const next = play(state, "alice", { cardId: "red-draw2" }).state;
    expect(next.pendingDraw).toBe(2);
    expect(next.activePlayerId).toBe("bob");
  });

  it("wild_draw4 stacks four", () => {
    const state = position({
      hands: { alice: [card(null, "wild_draw4", "w4"), card("red", "1")], bob: [] },
    });
    const next = play(state, "alice", { cardId: "w4", chosenColor: "blue" }).state;
    expect(next.pendingDraw).toBe(4);
    expect(next.activeColor).toBe("blue");
  });

  it("serving a penalty takes the whole stack and loses the turn", () => {
    const state = position({ hands: { alice: [], bob: [] }, pendingDraw: 4, activePlayerId: "bob" });
    const next = engine.applyAction(state, {
      type: "DRAW_CARD",
      playerId: "bob",
      payload: {},
      timestamp: Date.now(),
    } as never).state;
    expect(next.hands.bob).toHaveLength(4);
    expect(next.pendingDraw).toBe(0);
    expect(next.activePlayerId).toBe("alice");
  });

  it("a wild sets the active colour", () => {
    const state = position({ hands: { alice: [card(null, "wild", "w"), card("red", "1")], bob: [] } });
    const next = play(state, "alice", { cardId: "w", chosenColor: "green" }).state;
    expect(next.activeColor).toBe("green");
  });
});

describe("UNO calling", () => {
  it("penalises going to one card without calling UNO", () => {
    const state = position({ hands: { alice: [card("red", "3"), card("red", "4")], bob: [] } });
    const result = play(state, "alice", { cardId: "red-3" });
    // One card left, no declaration -> draw two as a penalty.
    expect(result.state.hands.alice).toHaveLength(3);
    expect(result.events?.some((e) => e.type === "UNO_PENALTY")).toBe(true);
  });

  it("does not penalise when UNO is declared", () => {
    const state = position({ hands: { alice: [card("red", "3"), card("red", "4")], bob: [] } });
    const result = play(state, "alice", { cardId: "red-3", declareUno: true });
    expect(result.state.hands.alice).toHaveLength(1);
    expect(result.state.saidUno).toContain("alice");
    expect(result.events?.some((e) => e.type === "UNO_PENALTY")).toBe(false);
  });

  it("clears a stale UNO call once the player draws back up", () => {
    const state = position({ hands: { alice: [card("red", "3")], bob: [] }, saidUno: ["alice"] });
    const next = engine.applyAction(state, {
      type: "DRAW_CARD",
      playerId: "alice",
      payload: {},
      timestamp: Date.now(),
    } as never).state;
    expect(next.saidUno).not.toContain("alice");
  });
});

describe("UNO winning", () => {
  it("ends the game when the last card is played", () => {
    const state = position({ hands: { alice: [card("red", "3")], bob: [card("blue", "1")] } });
    const result = play(state, "alice", { cardId: "red-3" });
    expect(result.state.isFinished).toBe(true);
    expect(result.state.winnerId).toBe("alice");
    expect(engine.isGameOver(result.state)).toBe(true);
    expect(result.events?.some((e) => e.type === "GAME_WON")).toBe(true);
  });

  it("does not apply the last card's effect after the game ends", () => {
    const state = position({ hands: { alice: [card("red", "draw2")], bob: [card("blue", "1")] } });
    const result = play(state, "alice", { cardId: "red-draw2" });
    expect(result.state.isFinished).toBe(true);
    // Bob is not punished by a card played to win.
    expect(result.state.pendingDraw).toBe(0);
  });

  it("ranks by remaining cards and marks the winner", () => {
    const state = position({
      hands: { alice: [], bob: [card("blue", "1"), card("blue", "2")] },
      winnerId: "alice",
      isFinished: true,
    });
    const result = engine.calculateResult(state);
    expect(result.winnerId).toBe("alice");
    expect(result.scores[0]?.userId).toBe("alice");
    expect(result.scores[0]?.isWinner).toBe(true);
    expect(result.scores[1]?.userId).toBe("bob");
    expect(result.finalHandSizes.bob).toBe(2);
  });

  it("refuses any action once finished", () => {
    const state = position({ isFinished: true, hands: { alice: [card("red", "3")], bob: [] } });
    const result = engine.validateAction(state, {
      type: "PLAY_CARD",
      playerId: "alice",
      payload: { cardId: "red-3" },
      timestamp: Date.now(),
    } as never);
    expect(result.valid).toBe(false);
  });
});

describe("UNO hidden information", () => {
  it("never sends an opponent's cards to a player", () => {
    const state = engine.init(players, { randomSeed: "hidden" });
    const view = engine.getPlayerView(state, "alice");

    expect(view.myHand).toHaveLength(7);
    expect(view.opponents).toHaveLength(1);
    expect(view.opponents[0]?.cardCount).toBe(7);
    // The only thing exposed about Bob is a count.
    expect(JSON.stringify(view)).not.toContain(state.hands.bob![0]!.id);
  });

  it("gives a spectator nobody's hand", () => {
    const state = engine.init(players, { randomSeed: "spectator" });
    const view = engine.getPlayerView(state, null);
    expect(view.myHand).toEqual([]);
    expect(view.opponents).toHaveLength(2);
    expect(view.isMyTurn).toBe(false);
  });

  it("only lists playable cards on the player's own turn", () => {
    const state = position({
      hands: { alice: [card("red", "3"), card("blue", "9")], bob: [card("red", "1")] },
      activePlayerId: "alice",
    });
    expect(engine.getPlayerView(state, "alice").playableCardIds).toEqual(["red-3"]);
    expect(engine.getPlayerView(state, "bob").playableCardIds).toEqual([]);
  });
});

describe("UNO draw pile", () => {
  it("reshuffles the discard pile when the draw pile runs out", () => {
    const discard = [card("red", "5", "top"), ...Array.from({ length: 10 }, (_, i) => card("blue", "1", `d${i}`))];
    const state = position({ drawPile: [], discardPile: discard, hands: { alice: [], bob: [] } });

    const next = engine.applyAction(state, {
      type: "DRAW_CARD",
      playerId: "alice",
      payload: {},
      timestamp: Date.now(),
    } as never);

    expect(next.state.hands.alice).toHaveLength(1);
    expect(next.state.discardPile).toHaveLength(1); // only the top card stays
    expect(next.events?.some((e) => e.type === "DECK_RESHUFFLED")).toBe(true);
  });

  it("does not lose cards when reshuffling", () => {
    const discard = [card("red", "5", "top"), ...Array.from({ length: 6 }, (_, i) => card("blue", "1", `d${i}`))];
    const state = position({ drawPile: [], discardPile: discard, hands: { alice: [], bob: [] } });
    const next = engine.applyAction(state, {
      type: "DRAW_CARD",
      playerId: "alice",
      payload: {},
      timestamp: Date.now(),
    } as never).state;

    const total = next.drawPile.length + next.discardPile.length + next.hands.alice!.length;
    expect(total).toBe(discard.length);
  });
});
