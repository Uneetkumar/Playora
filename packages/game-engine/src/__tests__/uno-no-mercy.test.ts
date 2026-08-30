import { describe, it, expect } from "vitest";
import type { Player } from "@playora/game-types";
import { UnoNoMercyEngine, ELIMINATION_THRESHOLD } from "../uno/UnoNoMercyEngine.js";
import { buildNoMercyDeck } from "../uno/deck.js";
import { drawPenaltyOf } from "../uno/types.js";
import type { UnoCard, UnoColor, UnoGameState, UnoValue } from "../uno/types.js";

const engine = new UnoNoMercyEngine();
const players: Player[] = [
  { userId: "alice", displayName: "Alice" } as Player,
  { userId: "bob", displayName: "Bob" } as Player,
];

const card = (color: UnoColor | null, value: UnoValue, id = `${color}-${value}`): UnoCard => ({
  id,
  color,
  value,
});

function position(over: Partial<UnoGameState> = {}): UnoGameState {
  const base = engine.init(players, { randomSeed: "nm" });
  return {
    ...base,
    hands: { alice: [], bob: [] },
    discardPile: [card("red", "5")],
    activeColor: "red",
    activePlayerId: "alice",
    pendingDraw: 0,
    hasDrawn: false,
    saidUno: [],
    eliminated: [],
    ...over,
  };
}

const play = (state: UnoGameState, playerId: string, payload: object) =>
  engine.applyAction(state, { type: "PLAY_CARD", playerId, payload, timestamp: Date.now() } as never);

describe("No Mercy deck", () => {
  it("is the 168-card deck", () => {
    expect(buildNoMercyDeck()).toHaveLength(168);
  });

  it("includes the bigger draw cards that classic UNO lacks", () => {
    const values = new Set(buildNoMercyDeck().map((c) => c.value));
    for (const v of ["draw4_color", "wild_draw6", "wild_draw10", "skip_everyone", "discard_all"]) {
      expect(values).toContain(v);
    }
  });

  it("gives every card a unique id", () => {
    const deck = buildNoMercyDeck();
    expect(new Set(deck.map((c) => c.id)).size).toBe(deck.length);
  });
});

describe("draw penalties", () => {
  it.each([
    ["draw2", 2],
    ["draw4_color", 4],
    ["wild_draw4", 4],
    ["wild_draw6", 6],
    ["wild_draw10", 10],
    ["reverse", 0],
  ])("%s forces %i cards", (value, expected) => {
    expect(drawPenaltyOf(value as UnoValue)).toBe(expected);
  });
});

describe("No Mercy stacking", () => {
  it("lets a pending penalty be answered with another draw card", () => {
    const state = position({
      hands: { alice: [card("blue", "draw2"), card("red", "3")], bob: [] },
      pendingDraw: 2,
    });
    // Classic UNO forbids playing while a penalty stands; No Mercy allows stacking.
    expect(engine.isPlayable(state, card("blue", "draw2"))).toBe(true);
    expect(engine.isPlayable(state, card("red", "3"))).toBe(false);
  });

  it("accumulates the stack rather than replacing it", () => {
    const state = position({
      hands: { alice: [card("red", "draw2", "d2"), card("red", "1")], bob: [] },
      pendingDraw: 4,
    });
    const next = play(state, "alice", { cardId: "d2" }).state;
    expect(next.pendingDraw).toBe(6);
  });

  it("still requires a matching card outside a penalty", () => {
    const state = position();
    expect(engine.isPlayable(state, card("blue", "9"))).toBe(false);
    expect(engine.isPlayable(state, card("red", "9"))).toBe(true);
  });
});

describe("No Mercy card effects", () => {
  it("skip everyone returns the turn to the player", () => {
    const state = position({
      hands: { alice: [card("red", "skip_everyone", "se"), card("red", "1")], bob: [] },
    });
    const next = play(state, "alice", { cardId: "se" }).state;
    expect(next.activePlayerId).toBe("alice");
  });

  it("discard all sheds every card of the played colour", () => {
    const state = position({
      hands: {
        alice: [
          card("red", "discard_all", "da"),
          card("red", "3", "r3"),
          card("red", "7", "r7"),
          card("blue", "2", "b2"),
        ],
        bob: [],
      },
    });
    const next = play(state, "alice", { cardId: "da" }).state;
    // Only the blue card survives.
    expect(next.hands.alice).toHaveLength(1);
    expect(next.hands.alice![0]!.color).toBe("blue");
  });

  it("a zero passes hands around", () => {
    const state = position({
      hands: {
        alice: [card("red", "0", "r0"), card("blue", "1", "a1")],
        bob: [card("green", "2", "b1"), card("green", "3", "b2")],
      },
    });
    const next = play(state, "alice", { cardId: "r0" }).state;
    // Alice played her zero, then hands moved: she should now hold Bob's cards.
    expect(next.hands.alice!.map((c) => c.id).sort()).toEqual(["b1", "b2"]);
  });

  it("wild draw ten stacks ten", () => {
    const state = position({
      hands: { alice: [card(null, "wild_draw10", "w10"), card("red", "1")], bob: [] },
    });
    const next = play(state, "alice", { cardId: "w10", chosenColor: "green" }).state;
    expect(next.pendingDraw).toBe(10);
    expect(next.activeColor).toBe("green");
  });
});

describe("No Mercy elimination", () => {
  it("knocks a player out at 25 cards", () => {
    const bigHand = Array.from({ length: ELIMINATION_THRESHOLD }, (_, i) =>
      card("red", "5", `x${i}`),
    );
    const state = position({ hands: { alice: [card("red", "1")], bob: bigHand } });
    const result = engine.applyElimination(state);
    expect(result.state.eliminated).toContain("bob");
  });

  it("does not eliminate below the threshold", () => {
    const hand = Array.from({ length: ELIMINATION_THRESHOLD - 1 }, (_, i) =>
      card("red", "5", `x${i}`),
    );
    const result = engine.applyElimination(position({ hands: { alice: [], bob: hand } }));
    expect(result.state.eliminated ?? []).toHaveLength(0);
  });

  it("awards the win to the last player standing", () => {
    const bigHand = Array.from({ length: ELIMINATION_THRESHOLD }, (_, i) =>
      card("red", "5", `x${i}`),
    );
    const result = engine.applyElimination(
      position({ hands: { alice: [card("red", "1")], bob: bigHand } }),
    );
    expect(result.state.isFinished).toBe(true);
    expect(result.state.winnerId).toBe("alice");
  });
});

describe("No Mercy elimination through real play", () => {
  // Every test above calls applyElimination directly, which is exactly how the
  // rule shipped unreachable: it was correct, tested, and never called by
  // applyAction. These go through the action pipeline instead.
  it("eliminates a player who serves a penalty past the threshold", () => {
    const nearly = Array.from({ length: ELIMINATION_THRESHOLD - 3 }, (_, i) =>
      card("red", "5", `x${i}`),
    );
    const state = position({
      hands: { alice: [card("red", "1")], bob: nearly },
      activePlayerId: "bob",
      pendingDraw: 4,
    });

    const after = engine.applyAction(state, {
      type: "DRAW_CARD",
      playerId: "bob",
      payload: {},
      timestamp: Date.now(),
    } as never).state;

    expect(after.hands.bob!.length).toBeGreaterThanOrEqual(ELIMINATION_THRESHOLD);
    expect(after.eliminated).toContain("bob");
    expect(after.isFinished).toBe(true);
    expect(after.winnerId).toBe("alice");
  });

  it("never leaves an eliminated player holding the turn", () => {
    const nearly = Array.from({ length: ELIMINATION_THRESHOLD - 3 }, (_, i) =>
      card("red", "5", `x${i}`),
    );
    const threePlayers = [
      { userId: "alice", displayName: "Alice" } as Player,
      { userId: "bob", displayName: "Bob" } as Player,
      { userId: "carol", displayName: "Carol" } as Player,
    ];
    const base = engine.init(threePlayers, { randomSeed: "nm3" });
    const state: UnoGameState = {
      ...base,
      hands: { alice: [card("red", "1")], bob: nearly, carol: [card("blue", "2")] },
      discardPile: [card("red", "5")],
      activeColor: "red",
      activePlayerId: "bob",
      pendingDraw: 4,
      hasDrawn: false,
      eliminated: [],
    };

    const after = engine.applyAction(state, {
      type: "DRAW_CARD",
      playerId: "bob",
      payload: {},
      timestamp: Date.now(),
    } as never).state;

    expect(after.eliminated).toContain("bob");
    expect(after.isFinished).toBe(false);
    expect(after.activePlayerId).not.toBe("bob");
  });
});

describe("No Mercy stacking is actually reachable", () => {
  it("accepts a draw card played onto a live penalty", () => {
    const state = position({
      hands: { alice: [card("blue", "draw2", "d2")], bob: [] },
      activePlayerId: "alice",
      discardPile: [card("red", "draw2")],
      pendingDraw: 2,
    });
    expect(engine.validateAction(state, {
      type: "PLAY_CARD",
      playerId: "alice",
      payload: { cardId: "d2" },
      timestamp: Date.now(),
    } as never)).toEqual({ valid: true });
  });

  it("still refuses a non-draw card while a penalty stands", () => {
    const state = position({
      hands: { alice: [card("red", "5", "n5")], bob: [] },
      activePlayerId: "alice",
      discardPile: [card("red", "draw2")],
      pendingDraw: 2,
    });
    const result = engine.validateAction(state, {
      type: "PLAY_CARD",
      playerId: "alice",
      payload: { cardId: "n5" },
      timestamp: Date.now(),
    } as never);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("draw 2");
  });
});

describe("No Mercy inherits the base engine", () => {
  it("still hides opponent hands", () => {
    const state = engine.init(players, { randomSeed: "hide" });
    const view = engine.getPlayerView(state, "alice");
    expect(view.opponents[0]?.cardCount).toBe(7);
    expect(JSON.stringify(view)).not.toContain(state.hands.bob![0]!.id);
  });

  it("seats up to six players", () => {
    expect(engine.maxPlayers).toBe(6);
    expect(engine.gameId).toBe("uno-no-mercy");
  });

  it("conserves the deck at deal time", () => {
    const state = engine.init(players, { randomSeed: "conserve" });
    const total =
      state.drawPile.length +
      state.discardPile.length +
      state.hands.alice!.length +
      state.hands.bob!.length;
    expect(total).toBe(168);
  });
});
