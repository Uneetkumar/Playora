"use client";

import * as React from "react";
import { DEFAULT_THEME_ID } from "./board-themes";
import type { PieceSetId } from "./pieces";

/**
 * Board appearance, remembered per browser.
 *
 * Kept in localStorage rather than the account: it is a per-device display
 * preference, and a player on a phone may genuinely want a different set than
 * on a large screen. Every access is guarded — storage throws in private mode
 * and in some embedded contexts.
 */
const THEME_KEY = "playora:chess:theme";
const SET_KEY = "playora:chess:pieces";

function read(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable; the choice simply will not persist */
  }
}

export function useBoardPrefs() {
  const [themeId, setThemeId] = React.useState(DEFAULT_THEME_ID);
  const [pieceSet, setPieceSet] = React.useState<PieceSetId>("classic");
  const [flipped, setFlipped] = React.useState(false);

  // Read after mount so the server and first client render agree.
  React.useEffect(() => {
    setThemeId(read(THEME_KEY, DEFAULT_THEME_ID));
    setPieceSet(read(SET_KEY, "classic") as PieceSetId);
  }, []);

  const chooseTheme = React.useCallback((id: string) => {
    setThemeId(id);
    write(THEME_KEY, id);
  }, []);

  const choosePieceSet = React.useCallback((id: PieceSetId) => {
    setPieceSet(id);
    write(SET_KEY, id);
  }, []);

  return {
    themeId,
    pieceSet,
    flipped,
    chooseTheme,
    choosePieceSet,
    toggleFlip: () => setFlipped((f) => !f),
  };
}
