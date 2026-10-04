import type { GameId } from "@playora/game-types";
import { isGameId } from "../../lib/games/catalog";

/**
 * Games recently opened from the command palette, newest first, so the
 * palette can offer them again before anything is typed.
 *
 * Separate from "recently played" on purpose: that list is what you
 * finished playing, this is what you went looking for, and someone browsing
 * the rules of three games before choosing one wants those three back.
 */

const STORAGE_KEY = "playora:palette-recent";
export const MAX_PALETTE_RECENTS = 5;

export function readPaletteRecents(): GameId[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    // Ids from an older catalog may be gone; drop them rather than render a blank row.
    return parsed.filter(isGameId).slice(0, MAX_PALETTE_RECENTS);
  } catch {
    return [];
  }
}

export function rememberPaletteGame(id: GameId): GameId[] {
  const next = [id, ...readPaletteRecents().filter((g) => g !== id)].slice(0, MAX_PALETTE_RECENTS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: the palette simply forgets */
  }
  return next;
}

export function clearPaletteRecents(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}
