"use client";

import { create } from "zustand";

/**
 * Gameplay preferences, per device.
 *
 * These change how a game behaves rather than how the account is configured, so
 * they live in localStorage like the board theme does: someone playing on a
 * phone genuinely may want move confirmation on there and off at a desk.
 *
 * Every one of these is read by a game. Nothing here is a switch that does
 * nothing — a settings screen full of inert toggles is worse than a short one.
 */
export interface GameplayPrefs {
  /** Chess: dots on quiet moves, rings on captures. */
  showLegalMoves: boolean;
  /** Chess: tint the squares the last move came from and went to. */
  highlightLastMove: boolean;
  /** Chess: promote to a queen without asking. */
  autoQueen: boolean;
  /** UNO: group the hand by colour instead of leaving it in deal order. */
  sortUnoHand: boolean;
}

export const DEFAULT_GAMEPLAY: GameplayPrefs = {
  showLegalMoves: true,
  highlightLastMove: true,
  autoQueen: false,
  sortUnoHand: false,
};

const STORAGE_KEY = "playora:gameplay";

function load(): GameplayPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_GAMEPLAY;
    const parsed = JSON.parse(raw) as Partial<GameplayPrefs>;
    // Only booleans, and only keys we know: stored preferences are editable in
    // practice, and a stray value here would reach a game's render path.
    const out = { ...DEFAULT_GAMEPLAY };
    for (const key of Object.keys(DEFAULT_GAMEPLAY) as Array<keyof GameplayPrefs>) {
      if (typeof parsed[key] === "boolean") out[key] = parsed[key];
    }
    return out;
  } catch {
    return DEFAULT_GAMEPLAY;
  }
}

interface GameplayStoreState {
  prefs: GameplayPrefs;
  /** False until the stored values have been read on the client. */
  hydrated: boolean;
  hydrate: () => void;
  toggle: (key: keyof GameplayPrefs) => void;
}

export const useGameplayStore = create<GameplayStoreState>((set, get) => ({
  prefs: DEFAULT_GAMEPLAY,
  hydrated: false,

  // Deliberately not read at module scope: the server has no localStorage, and
  // rendering different markup on the client than the server sent is a
  // hydration error rather than a preference.
  hydrate: () => {
    if (get().hydrated) return;
    set({ prefs: load(), hydrated: true });
  },

  toggle: (key) => {
    const next = { ...get().prefs, [key]: !get().prefs[key] };
    set({ prefs: next });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable; the choice simply will not persist */
    }
  },
}));
