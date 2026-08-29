"use client";

import * as React from "react";
import { UnoEngine } from "@playora/game-engine";
import type { UnoAction, UnoColor, UnoGameState, UnoPlayerView } from "@playora/game-engine";
import type { GameResult, Player } from "@playora/game-types";

export const LOCAL_SEATS = ["local-p1", "local-p2", "local-p3", "local-p4"] as const;

/**
 * Local UNO, played on one device.
 *
 * The same UnoEngine the server runs arbitrates every move, so local play cannot
 * diverge from online rules. Because all hands live on this device, the view is
 * rebuilt for whoever is on turn — the player passes the device along.
 */
export function useLocalUno(playerCount = 2) {
  const engine = React.useMemo(() => new UnoEngine(), []);

  const seats = React.useMemo(() => LOCAL_SEATS.slice(0, playerCount), [playerCount]);

  const players = React.useMemo<Record<string, Player>>(() => {
    const map: Record<string, Player> = {};
    seats.forEach((id, i) => {
      map[id] = {
        id,
        userId: id,
        username: `Player ${i + 1}`,
        displayName: `Player ${i + 1}`,
        avatarUrl: null,
        role: i === 0 ? "host" : "player",
        isReady: true,
        seatIndex: i,
        status: "connected",
        joinedAt: Date.now(),
        lastPingAt: Date.now(),
        isGuest: true,
      } as unknown as Player;
    });
    return map;
  }, [seats]);

  const newGame = React.useCallback(
    () =>
      engine.init(
        seats.map((id) => players[id]!),
        { randomSeed: `local-${Date.now()}` },
      ),
    [engine, seats, players],
  );

  const [state, setState] = React.useState<UnoGameState>(newGame);
  const [result, setResult] = React.useState<GameResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const restart = React.useCallback(() => {
    setState(newGame());
    setResult(null);
    setError(null);
  }, [newGame]);

  /** Runs through full engine validation, exactly as the server would. */
  const dispatch = React.useCallback(
    (action: UnoAction) => {
      const validation = engine.validateAction(state, action);
      if (!validation.valid) {
        setError(validation.reason ?? "That move isn't allowed.");
        return;
      }
      setError(null);
      const next = engine.executeAction(state, action).state;
      setState(next);
      if (engine.isGameOver(next)) setResult(engine.calculateResult(next, "local"));
    },
    [engine, state],
  );

  // Pass-and-play: "you" is always whoever is on turn.
  const currentUserId = state.activePlayerId ?? seats[0]!;
  const view: UnoPlayerView = React.useMemo(
    () => engine.getPlayerView(state, currentUserId),
    [engine, state, currentUserId],
  );

  const act = React.useCallback(
    (type: UnoAction["type"], payload: UnoAction["payload"] = {}) =>
      dispatch({ type, playerId: currentUserId, payload, timestamp: Date.now() } as UnoAction),
    [dispatch, currentUserId],
  );

  return {
    view,
    players,
    currentUserId,
    result,
    error,
    restart,
    playCard: (cardId: string, chosenColor?: UnoColor, declareUno?: boolean) =>
      act("PLAY_CARD", { cardId, ...(chosenColor ? { chosenColor } : {}), ...(declareUno ? { declareUno } : {}) }),
    drawCard: () => act("DRAW_CARD"),
    pass: () => act("PASS"),
  };
}
