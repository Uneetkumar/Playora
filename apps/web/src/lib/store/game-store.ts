import { create } from "zustand";
import type { PlayerProgressionPayload } from "@playora/protocol";
import type { GameSession, GameResult } from "@playora/game-types";

interface GameStoreState {
  currentSession: GameSession | null;
  gameState: unknown | null;
  sequenceNumber: number;
  lastResult: GameResult | null;
  /**
   * Rating and XP from the match just finished, keyed by user id.
   *
   * Arrives after lastResult and may never arrive at all — progression is
   * written asynchronously and is allowed to fail without breaking the match —
   * so the result screen has to render without it.
   */
  progression: Record<string, PlayerProgressionPayload> | null;
  /** Who has agreed to play again, and who still has to. */
  rematch: { votes: string[]; needed: string[] } | null;
  isMyTurn: boolean;
  setSession: (session: GameSession | null) => void;
  setGameState: (state: unknown, sequenceNumber: number) => void;
  setLastResult: (result: GameResult | null) => void;
  setProgression: (players: PlayerProgressionPayload[]) => void;
  setRematch: (state: { votes: string[]; needed: string[] } | null) => void;
  setIsMyTurn: (isMyTurn: boolean) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameStoreState>((set) => ({
  currentSession: null,
  gameState: null,
  sequenceNumber: 0,
  lastResult: null,
  progression: null,
  rematch: null,
  isMyTurn: false,

  setSession: (session) => set({ currentSession: session }),
  setGameState: (state, sequenceNumber) => set({ gameState: state, sequenceNumber }),
  setLastResult: (result) => set({ lastResult: result, progression: null, rematch: null }),
  setProgression: (players) =>
    set({ progression: Object.fromEntries(players.map((p) => [p.userId, p])) }),
  setRematch: (state) => set({ rematch: state }),
  setIsMyTurn: (isMyTurn) => set({ isMyTurn }),
  resetGame: () =>
    set({
      currentSession: null,
      gameState: null,
      sequenceNumber: 0,
      lastResult: null,
      progression: null,
      rematch: null,
      isMyTurn: false,
    }),
}));
