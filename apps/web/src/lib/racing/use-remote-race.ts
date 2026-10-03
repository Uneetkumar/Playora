"use client";

import * as React from "react";
import type { RacingPlayerView, VehicleInput, VehicleState } from "@playora/game-engine";
import type { RaceHudState } from "../../games/racing/RaceHud";
import { gearFor } from "../../games/racing/gears";
import { topSpeedFor, CAR_BASE_TOP_SPEED } from "@playora/game-engine";
import type { GameId } from "@playora/game-types";

/** How often driving input is sent to the server. */
const INPUT_HZ = 20;

/**
 * How far behind the newest snapshot the client renders, in milliseconds.
 *
 * Interpolation needs two snapshots to sit between, so the picture is
 * deliberately held one snapshot in the past. Rendering the newest one the
 * instant it lands leaves nothing to interpolate towards, and every jittered
 * packet becomes a visible stutter. The race loop broadcasts ten times a
 * second, so a little over one interval covers normal jitter.
 */
const INTERPOLATION_DELAY_MS = 120;

interface Snapshot {
  view: RacingPlayerView;
  receivedAt: number;
}

/**
 * Renders a server-run race smoothly from infrequent snapshots.
 *
 * The server simulates at 60 Hz and broadcasts at 10. Drawing each snapshot as
 * it arrives would show ten distinct positions a second, which reads as a
 * stutter no matter how good the physics is. So two snapshots are
 * kept and the render loop draws the point between them that corresponds to
 * "now, minus one snapshot" — the standard entity-interpolation trade: a tenth
 * of a second of latency in exchange for continuous motion.
 *
 * Nothing here predicts or corrects the local vehicle. That is deliberate for a
 * first cut: prediction without reconciliation looks worse than latency, and
 * reconciliation needs the server to echo the input sequence it has consumed.
 * The engine already carries `lastInputSeq` for exactly that, so the hook can
 * be extended without changing the protocol.
 */
export function useRemoteRace(
  latest: RacingPlayerView | null,
  sendInput: (input: Partial<VehicleInput> & { seq: number }) => void,
  currentUserId: string,
  /** Which racing game this is, so the speedometer can be scaled to the car. */
  gameId: GameId = "car-race",
) {
  const bufferRef = React.useRef<Snapshot[]>([]);
  const inputRef = React.useRef<VehicleInput>({
    steer: 0,
    throttle: false,
    brake: false,
    nitro: false,
  });
  const seqRef = React.useRef(0);
  const drawRef = React.useRef<((view: RacingPlayerView) => void) | null>(null);
  const sendRef = React.useRef(sendInput);
  sendRef.current = sendInput;

  const [hud, setHud] = React.useState<RaceHudState>({
    speed: 0,
    speedKph: 0,
    coins: 0,
    nitroCharges: 0,
    boosting: false,
    countdown: 3,
    phase: "countdown",
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
    bestLapTicks: null,
    lastLapTicks: null,
    gear: 1,
    topSpeed: CAR_BASE_TOP_SPEED,
    standings: [],
  });

  // Buffer every snapshot the socket delivers.
  React.useEffect(() => {
    if (!latest) return;
    const buffer = bufferRef.current;
    buffer.push({ view: latest, receivedAt: performance.now() });
    // Two is all interpolation needs; a third would only add latency.
    while (buffer.length > 3) buffer.shift();
  }, [latest]);

  const onReady = React.useCallback((draw: (view: RacingPlayerView) => void) => {
    drawRef.current = draw;
  }, []);

  const setInput = React.useCallback((patch: Partial<VehicleInput>) => {
    inputRef.current = { ...inputRef.current, ...patch };
    // Nitro is a one-shot: send it immediately rather than waiting for the
    // next scheduled input, or a tap can be swallowed between sends.
    if (patch.nitro) {
      seqRef.current += 1;
      sendRef.current({ ...inputRef.current, nitro: true, seq: seqRef.current });
      inputRef.current = { ...inputRef.current, nitro: false };
    }
  }, []);

  // Render loop and input sender.
  React.useEffect(() => {
    let raf = 0;
    let lastSend = 0;
    let sinceHud = 0;
    let last = performance.now();
    let cancelled = false;

    const frame = (now: number) => {
      if (cancelled) return;
      raf = requestAnimationFrame(frame);

      const delta = (now - last) / 1000;
      last = now;

      if (now - lastSend >= 1000 / INPUT_HZ) {
        lastSend = now;
        seqRef.current += 1;
        const { steer, throttle, brake } = inputRef.current;
        sendRef.current({ steer, throttle, brake, seq: seqRef.current });
      }

      const view = interpolated(bufferRef.current, now);
      if (!view) return;
      drawRef.current?.(view);

      sinceHud += delta;
      if (sinceHud >= 1 / 12) {
        sinceHud = 0;
        const me = view.me ?? view.vehicles.find((v) => v.playerId === currentUserId) ?? null;
        const standing = view.standings.find((s) => s.playerId === currentUserId);
        setHud({
          speed: me?.speed ?? 0,
          speedKph: Math.round((me?.speed ?? 0) * 3.6),
          coins: me?.coins ?? 0,
          nitroCharges: me?.nitroCharges ?? 0,
          boosting: (me?.nitroUntilTick ?? 0) > view.tick,
          countdown: view.countdown,
          phase: view.racingPhase,
          place: standing?.place ?? 1,
          total: view.vehicles.length,
          progress: Math.min(1, (me?.distance ?? 0) / Math.max(1, view.trackLength)),
          checkpoint: me?.checkpoint ?? 0,
          checkpoints: view.checkpoints.length,
          finished: view.isFinished,
          lap: Math.min(view.laps, (me?.lapsDone ?? 0) + 1),
          laps: view.laps,
          raceTicks: view.raceTicks,
          currentLapTicks: Math.max(0, view.tick - (me?.lapStartTick ?? 0)),
          bestLapTicks: me?.bestLapTicks ?? null,
          lastLapTicks: me?.lapTicks.at(-1) ?? null,
          gear: gearFor(me?.speed ?? 0, topSpeedFor(gameId, me?.vehicleId)),
          topSpeed: topSpeedFor(gameId, me?.vehicleId),
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
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [currentUserId, gameId]);

  return { hud, onReady, setInput };
}

/**
 * The view to draw right now: the two most recent snapshots, blended.
 *
 * Falls back to the newest snapshot when there is only one, or when the buffer
 * has fallen so far behind that blending would be a guess rather than an
 * interpolation.
 */
function interpolated(buffer: Snapshot[], now: number): RacingPlayerView | null {
  if (buffer.length === 0) return null;
  const newest = buffer[buffer.length - 1]!;
  if (buffer.length === 1) return newest.view;

  const previous = buffer[buffer.length - 2]!;
  const renderAt = now - INTERPOLATION_DELAY_MS;
  const span = newest.receivedAt - previous.receivedAt;
  if (span <= 0) return newest.view;

  const t = (renderAt - previous.receivedAt) / span;
  // Outside the pair, there is nothing to interpolate between: showing the
  // newest snapshot is honest, extrapolating past it is invention.
  if (t <= 0) return previous.view;
  if (t >= 1) return newest.view;

  const byId = new Map(newest.view.vehicles.map((v) => [v.playerId, v]));

  return {
    ...newest.view,
    vehicles: previous.view.vehicles.map((before) => {
      const after = byId.get(before.playerId);
      return after ? blend(before, after, t) : before;
    }),
    me: newest.view.me,
  };
}

function blend(a: VehicleState, b: VehicleState, t: number): VehicleState {
  return {
    ...b,
    distance: a.distance + (b.distance - a.distance) * t,
    lateral: a.lateral + (b.lateral - a.lateral) * t,
    speed: a.speed + (b.speed - a.speed) * t,
    lean: a.lean + (b.lean - a.lean) * t,
  };
}
