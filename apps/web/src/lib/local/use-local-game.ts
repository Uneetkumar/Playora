"use client";

import * as React from "react";
import { ChessEngine } from "@playora/game-engine";
import type { ChessAction, ChessGameState, ChessPlayerView } from "@playora/game-engine";
import { botRegistry, type AiLevel } from "@playora/bot-engine";
import type { GameResult, Player } from "@playora/game-types";

export type LocalMode = "pass-and-play" | "vs-ai";

export const LOCAL_HUMAN_ID = "local-you";
export const LOCAL_OPPONENT_ID = "local-opponent";

export interface UseLocalGameOptions {
  mode: LocalMode;
  aiLevel?: AiLevel;
  /** Which colour the human takes in vs-ai. */
  humanColor?: "w" | "b";
}

/**
 * Runs a match entirely in the browser.
 *
 * The very same `ChessEngine` the server uses arbitrates every move, so local
 * play cannot diverge from online rules. There is no server here and no
 * authentication, which is exactly why this mode works before Supabase exists.
 *
 * Local results are intentionally not rated (spec section 13: bot and offline
 * matches must not move competitive rating).
 */
export function useLocalGame({ mode, aiLevel = 3, humanColor = "w" }: UseLocalGameOptions) {
  const engine = React.useMemo(() => new ChessEngine(), []);

  const players = React.useMemo<Record<string, Player>>(() => {
    const opponentName = mode === "vs-ai" ? `AI level ${aiLevel}` : "Player 2";
    return {
      [LOCAL_HUMAN_ID]: {
        id: LOCAL_HUMAN_ID,
        userId: LOCAL_HUMAN_ID,
        username: "You",
        displayName: mode === "vs-ai" ? "You" : "Player 1",
        avatarUrl: null,
        role: "host",
        isReady: true,
        seatIndex: 0,
        status: "connected",
        joinedAt: Date.now(),
        lastPingAt: Date.now(),
        isGuest: true,
      } as unknown as Player,
      [LOCAL_OPPONENT_ID]: {
        id: LOCAL_OPPONENT_ID,
        userId: LOCAL_OPPONENT_ID,
        username: opponentName,
        displayName: opponentName,
        avatarUrl: null,
        role: "player",
        isReady: true,
        seatIndex: 1,
        status: "connected",
        joinedAt: Date.now(),
        lastPingAt: Date.now(),
        isGuest: true,
      } as unknown as Player,
    };
  }, [mode, aiLevel]);

  const seat = React.useCallback(() => {
    // The human keeps their chosen colour; the opposite seat is the opponent.
    const white = humanColor === "w" ? LOCAL_HUMAN_ID : LOCAL_OPPONENT_ID;
    const black = humanColor === "w" ? LOCAL_OPPONENT_ID : LOCAL_HUMAN_ID;
    return [players[white]!, players[black]!];
  }, [humanColor, players]);

  const [state, setState] = React.useState<ChessGameState>(() =>
    engine.init(seat(), { initialTimeSeconds: 600 }),
  );
  const [result, setResult] = React.useState<GameResult | null>(null);
  const [isThinking, setIsThinking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const restart = React.useCallback(() => {
    setState(engine.init(seat(), { initialTimeSeconds: 600 }));
    setResult(null);
    setError(null);
    setIsThinking(false);
  }, [engine, seat]);

  /** Runs an action through full engine validation, exactly like the server. */
  const dispatch = React.useCallback(
    (action: ChessAction): ChessGameState | null => {
      const validation = engine.validateAction(state, action);
      if (!validation.valid) {
        setError(validation.reason ?? "That move is not legal.");
        return null;
      }
      setError(null);
      const next = engine.executeAction(state, action).state;
      setState(next);
      if (engine.isGameOver(next)) {
        setResult(engine.calculateResult(next, "local"));
      }
      return next;
    },
    [engine, state],
  );

  // In pass-and-play both seats are human, so "you" is whoever is on move.
  const activeSeatId =
    state.turnColor === "w" ? state.whitePlayerId : state.blackPlayerId;
  const currentUserId = mode === "pass-and-play" ? activeSeatId : LOCAL_HUMAN_ID;

  // Bot turn: think briefly so moves are readable rather than instantaneous.
  React.useEffect(() => {
    if (mode !== "vs-ai" || state.isFinished) return;
    if (activeSeatId !== LOCAL_OPPONENT_ID) return;
    if (!botRegistry.has("chess")) return;

    const bot = botRegistry.get("chess");
    let cancelled = false;
    setIsThinking(true);

    const timer = setTimeout(() => {
      if (cancelled) return;
      const action = bot.chooseAction(state, LOCAL_OPPONENT_ID, aiLevel) as ChessAction | null;
      setIsThinking(false);
      if (action) dispatch(action);
    }, bot.thinkingTimeMs(aiLevel));

    return () => {
      cancelled = true;
      clearTimeout(timer);
      setIsThinking(false);
    };
  }, [mode, state, activeSeatId, aiLevel, dispatch]);

  const view: ChessPlayerView = React.useMemo(
    () => engine.getPlayerView(state, currentUserId),
    [engine, state, currentUserId],
  );

  const act = React.useCallback(
    (type: ChessAction["type"], payload: ChessAction["payload"] = {}) => {
      dispatch({ type, playerId: currentUserId, payload, timestamp: Date.now() });
    },
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
    makeMove: (from: string, to: string, promotion?: "q" | "r" | "b" | "n") =>
      act("MOVE", promotion ? { from, to, promotion } : { from, to }),
    resign: () => act("RESIGN"),
    offerDraw: () => act("OFFER_DRAW"),
    acceptDraw: () => act("ACCEPT_DRAW"),
    declineDraw: () => act("DECLINE_DRAW"),
  };
}
