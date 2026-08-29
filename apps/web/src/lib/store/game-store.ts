import { create } from "zustand";
import type { GameSession, GameResult } from "@playora/game-types";

interface GameStoreState {
  currentSession: GameSession | null;
  gameState: unknown | null;
  sequenceNumber: number;
  lastResult: GameResult | null;
  isMyTurn: boolean;
  setSession: (session: GameSession | null) => void;
  setGameState: (state: unknown, sequenceNumber: number) => void;
  setLastResult: (result: GameResult | null) => void;
  setIsMyTurn: (isMyTurn: boolean) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameStoreState>((set) => ({
  currentSession: null,
  gameState: null,
  sequenceNumber: 0,
  lastResult: null,
  isMyTurn: false,

  setSession: (session) => set({ currentSession: session }),
  setGameState: (state, sequenceNumber) => set({ gameState: state, sequenceNumber }),
  setLastResult: (result) => set({ lastResult: result }),
  setIsMyTurn: (isMyTurn) => set({ isMyTurn }),
  resetGame: () =>
    set({
      currentSession: null,
      gameState: null,
      sequenceNumber: 0,
      lastResult: null,
      isMyTurn: false,
    }),
}));
