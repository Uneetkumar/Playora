"use client";

import * as React from "react";
import type { GameId } from "@playora/game-types";
import {
  isValidPaint,
  paintFinishOf,
  resolveVehicleId,
  vehicleById,
  type PaintFinish,
} from "@playora/game-engine";

/**
 * The player's race loadout: which vehicle they drive and what colour it is.
 *
 * One source for every screen that shows or uses the choice — the garage, the
 * race, the lobby — so picking a car in one place is the car you race in the
 * other. The old `useChosenVehicle` kept its own copy per component, against
 * its own roster, and none of it reached the engine.
 *
 * Stored per device, per game. Every read goes back through the engine's own
 * validation (`resolveVehicleId`, the paint regex): storage is user-editable,
 * survives roster changes, and anything it holds is a suggestion, never a fact.
 */

export interface RaceLoadoutValue {
  /** A current roster id for the game; legacy ids are already translated. */
  vehicleId: string;
  /** '#rrggbb', lower case: the paint chosen for this vehicle, else its factory paint. */
  paint: string;
}

export interface RaceLoadout extends RaceLoadoutValue {
  /** The finish of `paint`: the configurator's for a listed paint, metallic for a custom one. */
  finish: PaintFinish;
  setVehicleId: (id: string) => void;
  /** Paints the current vehicle. Anything that is not '#rrggbb' is ignored. */
  setPaint: (hex: string) => void;
}

interface Stored {
  vehicleId: string;
  /**
   * Paint per vehicle. Each car remembers its own colour, the way a garage
   * does: switching to the rally car and back should not repaint the GT.
   */
  paints: Record<string, string>;
}

export function loadoutStorageKey(gameId: GameId): string {
  return `playora:race-loadout:v1:${gameId}`;
}

/** Where `useChosenVehicle` kept a bare vehicle id before there was a loadout. */
function legacyStorageKey(gameId: GameId): string {
  return `playora:vehicle:${gameId}`;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    // Some privacy modes throw on the property access itself.
    return null;
  }
}

function defaults(gameId: GameId): Stored {
  return { vehicleId: resolveVehicleId(gameId, null), paints: {} };
}

/** Keeps only what the engine would accept. */
function sanitise(gameId: GameId, raw: unknown): Stored {
  const out = defaults(gameId);
  if (!raw || typeof raw !== "object") return out;
  const value = raw as { vehicleId?: unknown; paints?: unknown };
  if (typeof value.vehicleId === "string") out.vehicleId = resolveVehicleId(gameId, value.vehicleId);
  if (value.paints && typeof value.paints === "object") {
    for (const [id, hex] of Object.entries(value.paints as Record<string, unknown>)) {
      // Keyed by current ids only: a paint filed under an id the roster no
      // longer has would otherwise follow whichever car it now maps to.
      if (resolveVehicleId(gameId, id) !== id) continue;
      if (typeof hex === "string" && isValidPaint(hex.toLowerCase())) out.paints[id] = hex.toLowerCase();
    }
  }
  return out;
}

function read(gameId: GameId): Stored {
  const store = storage();
  if (!store) return defaults(gameId);
  try {
    const raw = store.getItem(loadoutStorageKey(gameId));
    if (raw) return sanitise(gameId, JSON.parse(raw));

    // First run with a loadout: carry over the car chosen under the old key,
    // translated to the current roster, and file it under the new one.
    const legacy = store.getItem(legacyStorageKey(gameId));
    if (legacy) {
      const migrated: Stored = { vehicleId: resolveVehicleId(gameId, legacy), paints: {} };
      write(gameId, migrated);
      return migrated;
    }
  } catch {
    /* unreadable or corrupt storage: fall back to the defaults below */
  }
  return defaults(gameId);
}

function write(gameId: GameId, value: Stored): void {
  try {
    storage()?.setItem(loadoutStorageKey(gameId), JSON.stringify(value));
  } catch {
    /* quota or privacy mode: the choice lasts for this page only */
  }
}

/*
 * A tiny external store per game, so every component using the hook sees the
 * same choice at once — the garage and the race preview on one page must not
 * disagree. Snapshots are cached because useSyncExternalStore compares them
 * by reference.
 */
const stored = new Map<GameId, Stored>();
const snapshots = new Map<GameId, RaceLoadoutValue>();
const serverSnapshots = new Map<GameId, RaceLoadoutValue>();
const listeners = new Map<GameId, Set<() => void>>();

function toValue(gameId: GameId, value: Stored): RaceLoadoutValue {
  return {
    vehicleId: value.vehicleId,
    paint: value.paints[value.vehicleId] ?? vehicleById(gameId, value.vehicleId).defaultPaint,
  };
}

function current(gameId: GameId): Stored {
  let value = stored.get(gameId);
  if (!value) {
    value = read(gameId);
    stored.set(gameId, value);
  }
  return value;
}

function getSnapshot(gameId: GameId): RaceLoadoutValue {
  let snapshot = snapshots.get(gameId);
  if (!snapshot) {
    snapshot = toValue(gameId, current(gameId));
    snapshots.set(gameId, snapshot);
  }
  return snapshot;
}

/** What the server renders: the factory car, since it cannot see storage. */
function getServerSnapshot(gameId: GameId): RaceLoadoutValue {
  let snapshot = serverSnapshots.get(gameId);
  if (!snapshot) {
    snapshot = toValue(gameId, defaults(gameId));
    serverSnapshots.set(gameId, snapshot);
  }
  return snapshot;
}

function update(gameId: GameId, next: Stored, persist: boolean): void {
  stored.set(gameId, next);
  snapshots.delete(gameId);
  if (persist) write(gameId, next);
  listeners.get(gameId)?.forEach((listener) => listener());
}

function subscribe(gameId: GameId, listener: () => void): () => void {
  let set = listeners.get(gameId);
  if (!set) {
    set = new Set();
    listeners.set(gameId, set);
  }
  set.add(listener);

  // Another tab changed it: re-read rather than trust the event's payload.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== loadoutStorageKey(gameId)) return;
    update(gameId, read(gameId), false);
  };
  window.addEventListener("storage", onStorage);

  return () => {
    set?.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The loadout outside React, e.g. when building a race config. */
export function readRaceLoadout(gameId: GameId): RaceLoadoutValue {
  return getSnapshot(gameId);
}

export function setRaceVehicle(gameId: GameId, id: string): void {
  const value = current(gameId);
  const vehicleId = resolveVehicleId(gameId, id);
  if (vehicleId === value.vehicleId) return;
  update(gameId, { ...value, vehicleId }, true);
}

export function setRacePaint(gameId: GameId, hex: string): void {
  if (typeof hex !== "string") return;
  const paint = hex.toLowerCase();
  if (!isValidPaint(paint)) return;
  const value = current(gameId);
  if (value.paints[value.vehicleId] === paint) return;
  update(gameId, { ...value, paints: { ...value.paints, [value.vehicleId]: paint } }, true);
}

export function useRaceLoadout(gameId: GameId): RaceLoadout {
  const subscribeToGame = React.useCallback((listener: () => void) => subscribe(gameId, listener), [gameId]);
  const snapshot = React.useSyncExternalStore(
    subscribeToGame,
    () => getSnapshot(gameId),
    () => getServerSnapshot(gameId),
  );

  const setVehicleId = React.useCallback((id: string) => setRaceVehicle(gameId, id), [gameId]);
  const setPaint = React.useCallback((hex: string) => setRacePaint(gameId, hex), [gameId]);

  return React.useMemo(
    () => ({
      vehicleId: snapshot.vehicleId,
      paint: snapshot.paint,
      finish: paintFinishOf(snapshot.paint),
      setVehicleId,
      setPaint,
    }),
    [snapshot, setVehicleId, setPaint],
  );
}
