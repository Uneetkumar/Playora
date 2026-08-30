"use client";

import * as React from "react";
import { botRegistry, RECOMMENDED_AI_LEVEL, type AiLevel } from "@playora/bot-engine";
import { UnoEngine, UnoNoMercyEngine } from "@playora/game-engine";
import type { UnoAction, UnoColor, UnoGameState, UnoPlayerView } from "@playora/game-engine";
import type { GameId, GameResult, Player } from "@playora/game-types";

export const LOCAL_SEATS = ["local-p1", "local-p2", "local-p3", "local-p4"] as const;

export type LocalUnoMode = "pass-and-play" | "vs-ai";

/** In a game against AI, seat one is always the person holding the device. */
const HUMAN_SEAT = LOCAL_SEATS[0];

export interface LocalUnoOptions {
  playerCount?: number;
  gameId?: GameId;
  mode?: LocalUnoMode;
  aiLevel?: AiLevel;
}

/**
 * Local UNO, played on one device.
 *
 * The same UnoEngine the server runs arbitrates every move, so local play cannot
 * diverge from online rules. Because all hands live on this device, the view is
 * rebuilt for whoever is on turn — the player passes the device along.
 */
export function useLocalUno({
  playerCount = 2,
  gameId = "uno",
  mode = "pass-and-play",
  aiLevel = RECOMMENDED_AI_LEVEL,
}: LocalUnoOptions = {}) {
  // No Mercy is a rule set on the same engine, so the view and actions are
  // identical -- only the rules and deck differ.
  const engine = React.useMemo(
    () => (gameId === "uno-no-mercy" ? new UnoNoMercyEngine() : new UnoEngine()),
    [gameId],
  );

  const seats = React.useMemo(() => LOCAL_SEATS.slice(0, playerCount), [playerCount]);

  const players = React.useMemo<Record<string, Player>>(() => {
    const map: Record<string, Player> = {};
    seats.forEach((id, i) => {
      map[id] = {
        id,
        userId: id,
        username: mode === "vs-ai" && i > 0 ? `AI ${i}` : `Player ${i + 1}`,
        displayName: mode === "vs-ai" && i > 0 ? `AI ${i}` : `Player ${i + 1}`,
        avatarUrl: null,
        role: i === 0 ? "host" : "player",
        isReady: true,
        seatIndex: i,
        status: "connected",
        joinedAt: Date.now(),
        lastPingAt: Date.now(),
        isGuest: true,
        isBot: mode === "vs-ai" && i > 0,
      } as unknown as Player;
    });
    return map;
  }, [seats, mode]);

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
  const [isThinking, setIsThinking] = React.useState(false);

  const restart = React.useCallback(() => {
    setState(newGame());
    setResult(null);
    setError(null);
    setIsThinking(false);
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

  // Pass-and-play shows whoever is on turn, because the device changes hands.
  // Against AI the view stays pinned to the human, or the bots' hands would be
  // rendered face-up on their turn.
  const currentUserId =
    mode === "vs-ai" ? HUMAN_SEAT : (state.activePlayerId ?? seats[0]!);

  // Bot turn. The delay is presentation only -- the move is already decided --
  // but an instant reply reads as a glitch rather than an opponent.
  React.useEffect(() => {
    if (mode !== "vs-ai" || state.isFinished) return;
    const seat = state.activePlayerId;
    if (!seat || seat === HUMAN_SEAT) return;
    if (!botRegistry.has(gameId)) return;

    const bot = botRegistry.get(gameId);
    let cancelled = false;
    setIsThinking(true);

    const timer = setTimeout(() => {
      if (cancelled) return;
      setIsThinking(false);
      const action = bot.chooseAction(state, seat, aiLevel) as UnoAction | null;
      if (action) dispatch(action);
    }, bot.thinkingTimeMs(aiLevel));

    return () => {
      cancelled = true;
      clearTimeout(timer);
      setIsThinking(false);
    };
  }, [mode, gameId, state, aiLevel, dispatch]);
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
    isThinking,
    restart,
    playCard: (cardId: string, chosenColor?: UnoColor, declareUno?: boolean) =>
      act("PLAY_CARD", { cardId, ...(chosenColor ? { chosenColor } : {}), ...(declareUno ? { declareUno } : {}) }),
    drawCard: () => act("DRAW_CARD"),
    pass: () => act("PASS"),
  };
}
