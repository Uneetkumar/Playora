"use client";

import * as React from "react";
import type { GameId } from "@playora/game-types";

export interface LocalMatchRecord {
  id: string;
  gameId: GameId;
  gameName: string;
  mode: "vs-ai" | "local" | "career" | "lan";
  outcome: "win" | "loss" | "draw";
  durationSeconds: number;
  playedAt: string;
  aiLevel?: number;
  opponentName?: string;
  score?: number;
  source: "local";
}

const STORAGE_KEY = "playora_local_history";
const MAX_ENTRIES = 200;

function loadHistory(): LocalMatchRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(records: LocalMatchRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_ENTRIES)));
  } catch {
    // Quota exceeded or private browsing — fail silently
  }
}

/**
 * Appends a finished local/offline match to the persistent history store.
 *
 * Call this when a local game ends (win, loss, draw), passing the result
 * details. The record will appear on the History page alongside online games.
 */
export function saveLocalMatch(record: Omit<LocalMatchRecord, "id" | "source">): LocalMatchRecord {
  const entry: LocalMatchRecord = {
    ...record,
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    source: "local",
  };
  const history = loadHistory();
  saveHistory([entry, ...history]);
  // Notify other tabs/hooks
  try {
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  } catch {
    /* noop */
  }
  return entry;
}

/** React hook — reads local match history and re-renders when it changes. */
export function useLocalHistory(options?: {
  gameId?: GameId | null;
  limit?: number;
}): LocalMatchRecord[] {
  const { gameId, limit = 50 } = options ?? {};
  const [records, setRecords] = React.useState<LocalMatchRecord[]>(() => loadHistory());

  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === STORAGE_KEY) {
        setRecords(loadHistory());
      }
    };
    window.addEventListener("storage", onStorage);
    setRecords(loadHistory());
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return React.useMemo(() => {
    let result = records;
    if (gameId) result = result.filter((r) => r.gameId === gameId);
    return result.slice(0, limit);
  }, [records, gameId, limit]);
}

/** Clears all stored local match history. */
export function clearLocalHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  try {
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  } catch {
    /* noop */
  }
}
