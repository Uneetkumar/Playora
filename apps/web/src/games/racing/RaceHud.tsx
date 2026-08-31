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
  distance: number;
  lap: number;
  laps: number;
  raceTicks: number;
  currentLapTicks: number;
  bestLapTicks: number | null;
  lastLapTicks: number | null;
  gear: number;
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
  maxSpeed: number;
  started: boolean;
  onPause: () => void;
  onAccelerate?: (held: boolean) => void;
  onSteer?: (steer: number) => void;
  onBrake: (held: boolean) => void;
  track: TrackSpec;
  players: Record<string, Player>;
  currentUserId: string;
  onNitro: () => void;
}

/**
 * AAA-Grade Arcade Racing HUD Overlay.
 */
export function RaceHud({
  hud,
  maxSpeed,
  started,
  track,
  players,
  currentUserId,
  onPause,
  onAccelerate,
  onSteer,
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
    <div className="pointer-events-none absolute inset-0 select-none overflow-hidden">
      {/* Top Left: Position, Lap, and Live Running Order */}
      <div className="absolute left-3 top-3 flex flex-col gap-2.5 sm:left-5 sm:top-5">
        <div className="flex gap-2">
          <Stat label="POS" value={`${hud.place}/${Math.max(hud.total, 1)}`} accent />
          <Stat label="LAP" value={`${hud.lap}/${hud.laps}`} />
        </div>
        <div className="hidden sm:block">
          <RaceStandings rows={standings} />
        </div>
      </div>

      {/* Top Center: Race Clock & Best Lap */}
      <div className="absolute left-1/2 top-3 -translate-x-1/2 sm:top-5">
        <div className="rounded-2xl border border-white/20 bg-[#090b14]/85 px-5 py-2 text-center shadow-xl backdrop-blur-md">
          <div className="numeric text-xl font-black leading-none tracking-tight text-white tabular-nums sm:text-2xl drop-shadow-md">
            {formatLapTime(hud.raceTicks)}
          </div>
          <div className="numeric mt-1 text-[10px] font-bold uppercase tracking-wider text-white/60">
            Best {formatLapTime(hud.bestLapTicks)}
          </div>
        </div>
      </div>

      {/* Top Right: Pause, Radar Minimap & Lap Times */}
      <div className="absolute right-3 top-3 flex flex-col items-end gap-2.5 sm:right-5 sm:top-5">
        <button
          type="button"
          onClick={onPause}
          aria-label="Pause race"
          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-[#090b14]/85 text-white shadow-lg backdrop-blur-md transition-colors hover:bg-white/15 active:scale-95"
        >
          <Pause className="h-4 w-4" aria-hidden />
        </button>

        <div className="hidden sm:block">
          <RaceMiniMap track={track} vehicles={mapVehicles} />
        </div>

        <div className="hidden sm:block rounded-xl border border-white/15 bg-[#090b14]/85 px-3 py-1.5 text-right shadow-lg backdrop-blur-md">
          <TimeRow label="Current" value={formatLapTime(hud.currentLapTicks)} />
          <TimeRow label="Last" value={formatLapTime(hud.lastLapTicks)} />
        </div>
      </div>

      {/* Bottom Left: Nitro Circular Button & Steer D-Pad */}
      <div className="pointer-events-auto absolute bottom-4 sm:bottom-6 left-3 sm:left-6 flex items-end gap-2.5 sm:gap-3">
        {/* Nitro Circular Button */}
        <button
          type="button"
          onClick={onNitro}
          disabled={hud.nitroCharges === 0}
          className="flex flex-col items-center gap-1 text-white transition-transform enabled:active:scale-95 disabled:opacity-40"
          aria-label={`Nitro, ${hud.nitroCharges} charges left`}
        >
          <div
            className={cn(
              "flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full border-2 shadow-2xl transition-all",
              hud.boosting
                ? "border-cyan-300 bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_0_25px_rgba(6,182,212,0.9)] animate-pulse scale-105"
                : "border-blue-400/60 bg-gradient-to-br from-blue-600 to-indigo-800 shadow-lg"
            )}
          >
            <Zap className="h-7 w-7 sm:h-8 sm:w-8 fill-white text-white drop-shadow-md" />
          </div>

          {/* 3 Nitro Charge Indicator Dots */}
          <div className="flex items-center gap-1.5 mt-0.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full border transition-all",
                  i < hud.nitroCharges
                    ? "border-cyan-300 bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]"
                    : "border-white/20 bg-black/40"
                )}
              />
            ))}
          </div>
        </button>

        {/* Mobile Touch Steer Arrows (Shown on touch screens) */}
        <div className="flex items-center gap-1.5 sm:gap-2 mb-1 lg:hidden">
          <button
            type="button"
            onPointerDown={() => onSteer?.(-1)}
            onPointerUp={() => onSteer?.(0)}
            onPointerLeave={() => onSteer?.(0)}
            aria-label="Steer Left"
            className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border border-cyan-400/50 bg-black/80 active:bg-cyan-500/50 active:scale-95 shadow-2xl text-cyan-300 font-black text-2xl select-none touch-none backdrop-blur-md"
          >
            ◀
          </button>
          <button
            type="button"
            onPointerDown={() => onSteer?.(1)}
            onPointerUp={() => onSteer?.(0)}
            onPointerLeave={() => onSteer?.(0)}
            aria-label="Steer Right"
            className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border border-cyan-400/50 bg-black/80 active:bg-cyan-500/50 active:scale-95 shadow-2xl text-cyan-300 font-black text-2xl select-none touch-none backdrop-blur-md"
          >
            ▶
          </button>
        </div>
      </div>

      {/* Bottom Right: Gas / Brake Pedals & Speedometer */}
      <div className="pointer-events-auto absolute bottom-4 sm:bottom-6 right-3 sm:right-6 flex items-end gap-2 sm:gap-3">
        {/* Mobile Accelerate / Gas Button */}
        <button
          type="button"
          onPointerDown={() => onAccelerate?.(true)}
          onPointerUp={() => onAccelerate?.(false)}
          onPointerLeave={() => onAccelerate?.(false)}
          aria-label="Accelerate"
          className="flex flex-col items-center gap-1 text-white transition-transform active:scale-95 mb-1 lg:hidden select-none touch-none"
        >
          <span className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border-2 border-emerald-400/80 bg-gradient-to-br from-emerald-500 to-teal-600 shadow-2xl backdrop-blur-md">
            <Zap className="h-7 w-7 fill-white text-white drop-shadow-md" />
          </span>
          <span className="font-display text-[10px] font-black tracking-wide text-emerald-300">GAS</span>
        </button>

        <button
          type="button"
          onPointerDown={() => onBrake(true)}
          onPointerUp={() => onBrake(false)}
          onPointerLeave={() => onBrake(false)}
          aria-label="Brake"
          className="flex flex-col items-center gap-1 text-white transition-transform active:scale-95 mb-1 select-none touch-none"
        >
          <span className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl border border-white/30 bg-gradient-to-br from-slate-700 to-slate-900 shadow-xl backdrop-blur-sm">
            <Disc className="h-5 w-5 sm:h-6 sm:w-6 text-slate-300" aria-hidden />
          </span>
          <span className="font-display text-[9px] font-black tracking-wide text-white/80">BRAKE</span>
          <span className="hidden sm:inline"><KeyCap>S</KeyCap></span>
        </button>

        <div className="hidden md:block">
          <Speedometer
            speed={hud.speed}
            maxSpeed={maxSpeed}
            boosting={hud.boosting}
            gear={hud.gear}
          />
        </div>
      </div>


      {/* Countdown 3-2-1 */}
      <AnimatePresence>
        {hud.phase === "countdown" && hud.countdown > 0 && (
          <motion.div
            key={hud.countdown}
            initial={reduced ? false : { scale: 1.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={reduced ? undefined : { scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <span className="font-display text-[9rem] font-black text-white drop-shadow-[0_0_40px_rgba(124,58,237,0.8)]">
              {hud.countdown}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Start prompt */}
      <AnimatePresence>
        {hud.phase === "racing" && !started && (
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-0 bottom-44 sm:bottom-48 flex flex-col items-center gap-3 pointer-events-none"
          >
            <MousePointer2 className="h-8 w-8 text-white drop-shadow-lg" aria-hidden />
            <MoveHorizontal className="h-6 w-14 text-white drop-shadow-lg" aria-hidden />
            <p className="font-display text-2xl font-black tracking-wide text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] sm:text-3xl">
              W / CLICK TO ACCELERATE
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function KeyCap({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-white/20 bg-black/60 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase leading-none text-white/90 backdrop-blur-sm shadow-sm">
      {children}
    </kbd>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-3.5 py-1.5 shadow-xl backdrop-blur-md",
        accent
          ? "border-[#7c3aed]/60 bg-[#7c3aed]/30 text-white"
          : "border-white/20 bg-[#090b14]/85 text-white"
      )}
    >
      <div className="text-[10px] font-bold uppercase tracking-widest text-white/60">{label}</div>
      <div className="numeric text-lg font-black leading-none text-white tabular-nums drop-shadow-sm">{value}</div>
    </div>
  );
}

function TimeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-end gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
        {label}
      </span>
      <span className="numeric text-xs font-bold tabular-nums text-white/90">{value}</span>
    </div>
  );
}

/** High-Resolution Tachometer & Speedometer Dial */
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
    <div className="flex items-end gap-3 rounded-2xl border border-white/20 bg-[#090b14]/90 p-2.5 shadow-2xl backdrop-blur-md">
      {/* Speedometer Radial Gauge */}
      <div className="relative h-28 w-28">
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-2">
          <span className="numeric text-3xl font-black leading-none text-white tabular-nums drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
            {Math.round(speed * 3.6)}
          </span>
          <span className="text-[9px] font-extrabold uppercase tracking-widest text-cyan-400 mt-0.5">
            KM/H
          </span>
        </div>

        <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-lg">
          <circle cx="50" cy="50" r="45" fill="rgba(11,14,24,0.85)" stroke="rgba(255,255,255,0.18)" strokeWidth="2.5" />
          {/* Radial Track Arcs: Cyan -> Amber -> Crimson Redline */}
          <path d="M 18 76 A 40 40 0 0 1 24 30" fill="none" stroke="#06b6d4" strokeWidth="6" strokeLinecap="round" />
          <path d="M 24 30 A 40 40 0 0 1 76 30" fill="none" stroke="#f59e0b" strokeWidth="6" strokeLinecap="round" />
          <path d="M 76 30 A 40 40 0 0 1 82 76" fill="none" stroke="#ef4444" strokeWidth="6" strokeLinecap="round" />

          {/* Glowing Needle */}
          <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: "50px 50px" }}>
            <line
              x1="50"
              y1="50"
              x2="50"
              y2="16"
              stroke={boosting ? "#00f0ff" : "#f43f5e"}
              strokeWidth="4"
              strokeLinecap="round"
            />
          </g>
          <circle cx="50" cy="50" r="5" fill={boosting ? "#00f0ff" : "#ffffff"} />
        </svg>
      </div>

      {/* Gear Indicator Badge */}
      <div className="flex h-12 w-11 flex-col items-center justify-center rounded-xl border border-white/20 bg-[#161928] shadow-inner">
        <span className="text-[9px] font-bold uppercase tracking-wider text-white/50">GEAR</span>
        <span className="numeric text-xl font-black text-white tabular-nums leading-none">{gear}</span>
      </div>
    </div>
  );
}
