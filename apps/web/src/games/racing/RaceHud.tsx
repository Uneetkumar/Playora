"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@playora/ui";
import { Zap, MousePointer2, MoveHorizontal, Pause, Disc } from "lucide-react";
import { formatLapTime } from "./gears";
import type { TrackSpec } from "@playora/game-engine";
import type { Player } from "@playora/game-types";
import {
  MAP_COLOURS,
  RaceMiniMap,
  RaceStandings,
  type MapVehicle,
  type StandingRow,
} from "./RaceMiniMap";

export interface RaceHudState {
  speed: number;
  speedKph: number;
  coins: number;
  nitroCharges: number;
  boosting: boolean;
  countdown: number;
  phase: "countdown" | "racing" | "finished";
  place: number;
  total: number;
  progress: number;
  checkpoint: number;
  checkpoints: number;
  finished: boolean;
  /** Metres the player has covered, so gaps can be shown against it. */
  distance: number;
  /** Lap being driven, and how many there are. */
  lap: number;
  laps: number;
  /** Ticks since the lights went green. */
  raceTicks: number;
  currentLapTicks: number;
  bestLapTicks: number | null;
  lastLapTicks: number | null;
  gear: number;
  /** Live order. `seat` indexes the colour list, matching the 3D scene. */
  standings: Array<{
    playerId: string;
    place: number;
    distance: number;
    finished: boolean;
    seat: number;
  }>;
}

interface RaceHudProps {
  hud: RaceHudState;
  /** Top speed in m/s, so the gauge is scaled to the vehicle. */
  maxSpeed: number;
  started: boolean;
  onPause: () => void;
  onBrake: (held: boolean) => void;
  /** Drives the map. */
  track: TrackSpec;
  /** Names for the standings list. */
  players: Record<string, Player>;
  currentUserId: string;
  onNitro: () => void;
}

/**
 * The overlay.
 *
 * Everything here is absolutely positioned over the canvas rather than drawn
 * inside it: text rendered in WebGL is either blurry or expensive, and a DOM
 * overlay is readable by a screen reader, which a canvas is not.
 */
export function RaceHud({
  hud,
  maxSpeed,
  started,
  track,
  players,
  currentUserId,
  onPause,
  onBrake,
  onNitro,
}: RaceHudProps) {
  const reduced = useReducedMotion();

  const mapVehicles: MapVehicle[] = hud.standings.map((row) => ({
    playerId: row.playerId,
    distance: row.distance,
    isMe: row.playerId === currentUserId,
    colour: MAP_COLOURS[row.seat % MAP_COLOURS.length]!,
    finished: row.finished,
  }));

  const standings: StandingRow[] = hud.standings.map((row) => ({
    playerId: row.playerId,
    place: row.place,
    name: players[row.playerId]?.displayName ?? "Driver",
    colour: MAP_COLOURS[row.seat % MAP_COLOURS.length]!,
    isMe: row.playerId === currentUserId,
    finished: row.finished,
    gap: row.distance - hud.distance,
  }));

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {/* Top left: position, lap, and the running order. */}
      <div className="absolute left-3 top-3 flex flex-col gap-2 sm:left-4 sm:top-4">
        <div className="flex gap-2">
          <Stat label="POS" value={`${hud.place}/${Math.max(hud.total, 1)}`} accent />
          <Stat label="LAP" value={`${hud.lap}/${hud.laps}`} />
        </div>
        <RaceStandings rows={standings} />
      </div>

      {/* Top centre: race clock, with the best lap under it. */}
      <div className="absolute left-1/2 top-3 -translate-x-1/2 sm:top-4">
        <div className="rounded-xl border border-white/15 bg-black/55 px-4 py-1.5 text-center backdrop-blur-sm">
          <div className="numeric text-lg font-black leading-none tracking-tight text-white tabular-nums sm:text-2xl">
            {formatLapTime(hud.raceTicks)}
          </div>
          <div className="numeric mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/55">
            Best {formatLapTime(hud.bestLapTicks)}
          </div>
        </div>
      </div>

      {/* Top right: pause, and the map under it. */}
      <div className="absolute right-3 top-3 flex flex-col items-end gap-2 sm:right-4 sm:top-4">
        <button
          type="button"
          onClick={onPause}
          aria-label="Pause race"
          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
        >
          <Pause className="h-4 w-4" aria-hidden />
        </button>

        <RaceMiniMap track={track} vehicles={mapVehicles} />

        <div className="rounded-lg border border-white/15 bg-black/55 px-2.5 py-1.5 text-right backdrop-blur-sm">
          <TimeRow label="Current" value={formatLapTime(hud.currentLapTicks)} />
          <TimeRow label="Last" value={formatLapTime(hud.lastLapTicks)} />
        </div>
      </div>

      {/* Coins, above the speedometer so the bottom corners stay clear. */}
      <div className="absolute bottom-28 left-3 flex items-center gap-2 rounded-full border border-warning/40 bg-black/50 px-3 py-1.5 backdrop-blur-sm sm:left-4">
        <span className="numeric text-base font-black tabular-nums text-white">{hud.coins}</span>
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-[10px] font-black text-amber-900"
          aria-hidden
        >
          ¤
        </span>
        <span className="sr-only">coins collected</span>
      </div>

      {/* Bottom centre: the dial, as in every racing game ever made. */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 sm:bottom-4">
        <Speedometer
          speed={hud.speed}
          maxSpeed={maxSpeed}
          boosting={hud.boosting}
          gear={hud.gear}
        />
      </div>

      {/* Bottom right: nitro and brake. */}
      <div className="pointer-events-auto absolute bottom-4 right-3 flex items-end gap-3 sm:right-4">
        <button
          type="button"
          onPointerDown={() => onBrake(true)}
          onPointerUp={() => onBrake(false)}
          onPointerLeave={() => onBrake(false)}
          aria-label="Brake"
          className="flex flex-col items-center gap-1 text-white transition-transform active:scale-95"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-white/50 bg-gradient-to-br from-slate-600 to-slate-800 shadow-lg">
            <Disc className="h-6 w-6" aria-hidden />
          </span>
          <span className="font-display text-xs font-black tracking-wide">BRAKE</span>
          <KeyCap>S</KeyCap>
        </button>

        <button
          type="button"
          onClick={onNitro}
          disabled={hud.nitroCharges === 0}
          className="flex flex-col items-center gap-1 text-white transition-transform enabled:active:scale-95 disabled:opacity-40"
          aria-label={`Nitro, ${hud.nitroCharges} charges left`}
        >
          <span className="relative">
            <span
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-full border-2 shadow-lg",
                hud.boosting
                  ? "animate-pulse border-white bg-gradient-to-br from-cyan-300 to-blue-500"
                  : "border-white/70 bg-gradient-to-br from-blue-500 to-indigo-700",
              )}
            >
              <Zap className="h-7 w-7" aria-hidden />
            </span>
            <span className="numeric absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/80 text-xs font-black text-white">
              {hud.nitroCharges}
            </span>
          </span>
          <span className="font-display text-xs font-black tracking-wide">NITRO</span>
          <span className="flex gap-1">
            <KeyCap>N</KeyCap>
            <KeyCap>Space</KeyCap>
          </span>
        </button>
      </div>

      {/* Countdown */}
      <AnimatePresence>
        {hud.phase === "countdown" && hud.countdown > 0 && (
          <motion.div
            key={hud.countdown}
            initial={reduced ? false : { scale: 1.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={reduced ? undefined : { scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="font-display text-[8rem] font-black text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.6)]">
              {hud.countdown}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Start prompt, exactly the moment before the player takes over */}
      <AnimatePresence>
        {hud.phase === "racing" && !started && (
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-0 bottom-16 flex flex-col items-center gap-3"
          >
            <MousePointer2 className="h-9 w-9 text-white drop-shadow-lg" aria-hidden />
            <MoveHorizontal className="h-6 w-16 text-white drop-shadow-lg" aria-hidden />
            <p className="font-display text-3xl font-black tracking-wide text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] sm:text-4xl">
              W / CLICK TO START
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * The key that triggers a control, shown on the control itself.
 *
 * A highlighted letter in the word ("**R**estart") is a convention players
 * often miss, and it cannot express a key whose name is not in the label —
 * Space, for one. An explicit cap says exactly what to press.
 */
function KeyCap({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-white/25 bg-black/50 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase leading-none text-white/90 backdrop-blur-sm">
      {children}
    </kbd>
  );
}

/** A small labelled plate, for position and lap. */
function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-1.5 backdrop-blur-sm",
        accent ? "border-primary/60 bg-primary/25" : "border-white/15 bg-black/55",
      )}
    >
      <div className="text-[9px] font-bold uppercase tracking-widest text-white/60">{label}</div>
      <div className="numeric text-lg font-black leading-none text-white tabular-nums">{value}</div>
    </div>
  );
}

function TimeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-end gap-2">
      <span className="text-[9px] font-semibold uppercase tracking-wider text-white/45">
        {label}
      </span>
      <span className="numeric text-[11px] font-bold tabular-nums text-white/85">{value}</span>
    </div>
  );
}

/** Arc gauge with a gear box, as in the reference. */
function Speedometer({
  speed,
  maxSpeed,
  boosting,
  gear,
}: {
  speed: number;
  maxSpeed: number;
  boosting: boolean;
  gear: number;
}) {
  const fraction = Math.max(0, Math.min(1, speed / Math.max(1, maxSpeed)));
  const angle = -120 + fraction * 240;

  return (
    <div className="flex items-end gap-2">
      <div className="relative h-28 w-28">
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end pb-4">
          <span className="numeric text-3xl font-black leading-none text-white tabular-nums drop-shadow-lg">
            {Math.round(speed * 3.6)}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-white/60">km/h</span>
        </div>
        <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-lg">
        <circle cx="50" cy="50" r="46" fill="rgba(6,4,16,0.72)" stroke="rgba(255,255,255,0.22)" strokeWidth="3" />
        {/* Track arc, drawn as three bands so the top end reads as danger. */}
        <path d="M 18 76 A 40 40 0 0 1 24 30" fill="none" stroke="#4ade80" strokeWidth="7" strokeLinecap="round" />
        <path d="M 24 30 A 40 40 0 0 1 76 30" fill="none" stroke="#fbbf24" strokeWidth="7" strokeLinecap="round" />
        <path d="M 76 30 A 40 40 0 0 1 82 76" fill="none" stroke="#ef4444" strokeWidth="7" strokeLinecap="round" />
        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: "50px 50px" }}>
          <line x1="50" y1="50" x2="50" y2="18" stroke={boosting ? "#ff5c8a" : "#ffffff"} strokeWidth="4" strokeLinecap="round" />
        </g>
        <circle cx="50" cy="50" r="5" fill={boosting ? "#66e0ff" : "#ffffff"} />
        </svg>
        <span className="sr-only">{Math.round(speed * 3.6)} kilometres per hour</span>
      </div>

      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-white/25 bg-black/60 backdrop-blur-sm">
        <span className="numeric text-xl font-black text-white tabular-nums">{gear}</span>
        <span className="sr-only">gear</span>
      </div>
    </div>
  );
}

