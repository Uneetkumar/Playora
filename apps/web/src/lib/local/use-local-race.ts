"use client";

import * as React from "react";
import { botRegistry, RECOMMENDED_AI_LEVEL, type AiLevel } from "@playora/bot-engine";
import {
  BikeRaceEngine,
  CarRaceEngine,
  SERVER_PLAYER_ID,
  TICK_RATE,
  type RacingAction,
  type RacingEngine,
  type RacingGameState,
  type RacingPlayerView,
  type VehicleInput,
} from "@playora/game-engine";
import type { GameId, GameResult, Player } from "@playora/game-types";
import { gearFor } from "../../games/racing/gears";

export const LOCAL_DRIVER_ID = "local-you";

export type LocalRaceMode = "time-trial" | "vs-ai";

export interface LocalRaceOptions {
  gameId?: GameId;
  mode?: LocalRaceMode;
  aiLevel?: AiLevel;
  /** AI cars on the grid. Ignored in a time trial. */
  opponents?: number;
  trackLength?: number;
  /** Nitro charges each vehicle starts with. */
  nitroCharges?: number;
  /** Called every simulation frame, outside React. */
  onFrame?: (view: RacingPlayerView) => void;
}

/** How often the HUD is refreshed. */
const HUD_HZ = 12;

/** Only used to spread the gear display across the rev range. */
const MAX_SPEED_FOR_GEARS = 78;

/**
 * A race running locally, on the same engine the server runs.
 *
 * The important structural point is what is *not* React state. The simulation
 * advances sixty times a second; putting that in `useState` would re-render the
 * whole tree sixty times a second and turn a race into a slideshow. So the
 * authoritative state lives in a ref, the renderer is handed each frame
 * directly through `onFrame`, and React is only told about the handful of
 * numbers the HUD shows, twelve times a second.
 *
 * Bots are asked for an action on a slower cadence than the physics runs at,
 * because a driver making twelve decisions a second is already superhuman and
 * asking sixty times costs five times as much for nothing.
 */
export function useLocalRace({
  gameId = "car-race",
  mode = "vs-ai",
  aiLevel = RECOMMENDED_AI_LEVEL,
  opponents = 3,
  trackLength = 3000,
  nitroCharges = 2,
  onFrame,
}: LocalRaceOptions = {}) {
  const engine = React.useMemo<RacingEngine>(
    () => (gameId === "bike-race" ? new BikeRaceEngine() : new CarRaceEngine()),
    [gameId],
  );

  const seats = React.useMemo(() => {
    const ids = [LOCAL_DRIVER_ID];
    if (mode === "vs-ai") {
      for (let i = 0; i < opponents; i++) ids.push(`ai-${i + 1}`);
    }
    return ids;
  }, [mode, opponents]);

  const players = React.useMemo<Record<string, Player>>(() => {
    const map: Record<string, Player> = {};
    seats.forEach((id, i) => {
      const isBot = id !== LOCAL_DRIVER_ID;
      map[id] = {
        id,
        userId: id,
        username: isBot ? `AI ${i}` : "You",
        displayName: isBot ? `AI ${i}` : "You",
        avatarUrl: null,
        role: i === 0 ? "host" : "player",
        isReady: true,
        seatIndex: i,
        status: "connected",
        joinedAt: Date.now(),
        lastPingAt: Date.now(),
        isGuest: true,
        isBot,
      } as unknown as Player;
    });
    return map;
  }, [seats]);

  const [seed, setSeed] = React.useState(() => `race-${Date.now()}`);
  // Read by the loop each frame rather than being a dependency of it: a paused
  // race must stop advancing without tearing down and rebuilding the whole
  // simulation, which would reset the track.
  const pausedRef = React.useRef(false);
  const [result, setResult] = React.useState<GameResult | null>(null);
  const [running, setRunning] = React.useState(false);

  // Everything the loop touches lives in refs. Nothing here triggers a render.
  const stateRef = React.useRef<RacingGameState | null>(null);
  const inputRef = React.useRef<VehicleInput>({ steer: 0, throttle: false, brake: false, nitro: false });
  const frameRef = React.useRef<((view: RacingPlayerView) => void) | undefined>(onFrame);
  frameRef.current = onFrame;

  /** The small slice of state the HUD actually shows. */
  const [hud, setHud] = React.useState({
    speed: 0,
    speedKph: 0,
    coins: 0,
    nitroCharges: 0,
    boosting: false,
    countdown: 3,
    phase: "countdown" as RacingPlayerView["racingPhase"],
    place: 1,
    total: 1,
    progress: 0,
    checkpoint: 0,
    checkpoints: 4,
    finished: false,
    distance: 0,
    lap: 1,
    laps: 3,
    raceTicks: 0,
    currentLapTicks: 0,
    bestLapTicks: null as number | null,
    lastLapTicks: null as number | null,
    gear: 1,
    standings: [] as Array<{
      playerId: string;
      place: number;
      distance: number;
      finished: boolean;
      seat: number;
    }>,
  });

  const initial = React.useCallback(() => {
    return engine.init(
      seats.map((id) => players[id]!),
      { randomSeed: seed, trackLength, nitroCharges },
    );
  }, [engine, seats, players, seed, trackLength, nitroCharges]);

  const [track, setTrack] = React.useState(() => initial().track);

  const restart = React.useCallback(() => {
    setSeed(`race-${Date.now()}`);
    setResult(null);
    setRunning(false);
    inputRef.current = { steer: 0, throttle: false, brake: false, nitro: false };
  }, []);

  /** Called by the input layer. Never causes a render. */
  const setPaused = React.useCallback((paused: boolean) => {
    pausedRef.current = paused;
  }, []);

  const setInput = React.useCallback((patch: Partial<VehicleInput>) => {
    inputRef.current = { ...inputRef.current, ...patch };
    if (patch.throttle) setRunning((was) => was || true);
  }, []);

  // The simulation. Restarted whenever the race is rebuilt.
  React.useEffect(() => {
    const fresh = initial();
    stateRef.current = fresh;
    setTrack(fresh.track);
    setResult(null);

    const bots = botRegistry.has(gameId)
      ? seats.filter((id) => id !== LOCAL_DRIVER_ID).map(() => botRegistry.get(gameId))
      : [];

    let raf = 0;
    let last = performance.now();
    let accumulator = 0;
    let sinceBotDecision = 0;
    let sinceHud = 0;
    let cancelled = false;

    const step = (now: number) => {
      if (cancelled) return;
      raf = requestAnimationFrame(step);

      const state = stateRef.current;
      if (!state) return;

      // Clamped: a backgrounded tab hands back a delta of many seconds, and
      // simulating all of it at once would run the race while nobody watched.
      const delta = Math.min(0.25, (now - last) / 1000);
      last = now;

      if (!state.isFinished && !pausedRef.current) {
        accumulator += delta;
        sinceBotDecision += delta;

        if (sinceBotDecision >= 1 / 12) {
          sinceBotDecision = 0;
          let next = state;
          bots.forEach((bot, i) => {
            const seat = seats[i + 1];
            if (!seat || next.vehicles[seat]?.finishedAtTick !== null) return;
            const action = bot.chooseAction(next, seat, aiLevel) as RacingAction | null;
            // executeAction, not applyAction: a bot goes through validation
            // exactly as a human does, so it can never reach a state a player
            // could not.
            if (action) next = engine.executeAction(next, action).state;
          });
          stateRef.current = next;
        }

        // The human's input is applied every frame, so steering feels immediate
        // even though the physics runs on its own fixed clock.
        stateRef.current = engine.applyAction(stateRef.current!, {
          type: "SET_INPUT",
          playerId: LOCAL_DRIVER_ID,
          payload: { ...inputRef.current },
          timestamp: Date.now(),
        } as RacingAction).state;
        // Nitro is edge-triggered; releasing it here stops one press boosting twice.
        inputRef.current = { ...inputRef.current, nitro: false };

        let ticks = 0;
        while (accumulator >= 1 / TICK_RATE && ticks < 12) {
          accumulator -= 1 / TICK_RATE;
          ticks += 1;
        }
        if (ticks > 0) {
          stateRef.current = engine.applyAction(stateRef.current!, {
            type: "TICK",
            playerId: SERVER_PLAYER_ID,
            payload: { ticks },
            timestamp: Date.now(),
          } as RacingAction).state;
        }
      }

      const current = stateRef.current!;
      const view = engine.getPlayerView(current, LOCAL_DRIVER_ID);
      frameRef.current?.(view);

      sinceHud += delta;
      if (sinceHud >= 1 / HUD_HZ) {
        sinceHud = 0;
        const me = view.me;
        const standing = view.standings.find((s) => s.playerId === LOCAL_DRIVER_ID);
        setHud({
          speed: me?.speed ?? 0,
          speedKph: Math.round((me?.speed ?? 0) * 3.6),
          coins: me?.coins ?? 0,
          nitroCharges: me?.nitroCharges ?? 0,
          boosting: (me?.nitroUntilTick ?? 0) > current.tick,
          countdown: view.countdown,
          phase: view.racingPhase,
          place: standing?.place ?? 1,
          total: view.vehicles.length,
          progress: Math.min(1, (me?.distance ?? 0) / current.track.length),
          checkpoint: me?.checkpoint ?? 0,
          checkpoints: current.track.checkpoints.length,
          finished: current.isFinished,
          lap: Math.min(current.laps, (me?.lapsDone ?? 0) + 1),
          laps: current.laps,
          raceTicks: view.raceTicks,
          currentLapTicks: Math.max(0, current.tick - (me?.lapStartTick ?? 0)),
          bestLapTicks: me?.bestLapTicks ?? null,
          lastLapTicks: me?.lapTicks.at(-1) ?? null,
          gear: gearFor(me?.speed ?? 0, MAX_SPEED_FOR_GEARS),
          distance: me?.distance ?? 0,
          standings: view.standings.map((row) => ({
            playerId: row.playerId,
            place: row.place,
            distance: row.distance,
            finished: row.finished,
            // Seat order is the order vehicles were added to the scene, so the
            // colour on the map matches the car on the track.
            seat: view.vehicles.findIndex((v) => v.playerId === row.playerId),
          })),
        });
      }

      if (current.isFinished && !cancelled) {
        setResult((existing) => existing ?? engine.calculateResult(current, "local"));
      }
    };

    raf = requestAnimationFrame(step);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [engine, initial, seats, gameId, aiLevel]);

  return {
    track,
    hud,
    result,
    running,
    players,
    currentUserId: LOCAL_DRIVER_ID,
    isBike: gameId === "bike-race",
    setInput,
    setPaused,
    restart,
  };
}
