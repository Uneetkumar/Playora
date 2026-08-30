"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@playora/ui";
import { RotateCcw, Zap, MousePointer2, MoveHorizontal } from "lucide-react";

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
}

interface RaceHudProps {
  hud: RaceHudState;
  /** Top speed in m/s, so the gauge is scaled to the vehicle. */
  maxSpeed: number;
  started: boolean;
  onRestart: () => void;
  onNitro: () => void;
}

/**
 * The overlay.
 *
 * Everything here is absolutely positioned over the canvas rather than drawn
 * inside it: text rendered in WebGL is either blurry or expensive, and a DOM
 * overlay is readable by a screen reader, which a canvas is not.
 */
export function RaceHud({ hud, maxSpeed, started, onRestart, onNitro }: RaceHudProps) {
  const reduced = useReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {/* Speedometer */}
      <div className="absolute left-4 top-4">
        <Speedometer speed={hud.speed} maxSpeed={maxSpeed} boosting={hud.boosting} />
      </div>

      {/* Checkpoint progress */}
      <div className="absolute left-1/2 top-5 -translate-x-1/2">
        <CheckpointBar
          progress={hud.progress}
          reached={hud.checkpoint}
          total={hud.checkpoints}
        />
      </div>

      {/* Coins */}
      <div className="absolute right-4 top-4 flex items-center gap-2 rounded-full border border-warning/40 bg-black/45 px-3 py-1.5 backdrop-blur-sm">
        <span className="numeric text-lg font-black tabular-nums text-white">{hud.coins}</span>
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-[11px] font-black text-amber-900"
          aria-hidden
        >
          ¤
        </span>
        <span className="sr-only">coins collected</span>
      </div>

      {/* Position */}
      {hud.total > 1 && (
        <div className="absolute right-4 top-16 rounded-lg border border-white/15 bg-black/45 px-3 py-1.5 backdrop-blur-sm">
          <span className="numeric text-sm font-black text-white">
            {hud.place}
            <span className="text-white/50">/{hud.total}</span>
          </span>
          <span className="sr-only">current position</span>
        </div>
      )}

      {/* Right rail: restart and nitro, as in the reference layout */}
      <div className="pointer-events-auto absolute right-4 top-1/2 flex -translate-y-1/2 flex-col items-center gap-6">
        <button
          type="button"
          onClick={onRestart}
          className="group flex flex-col items-center gap-1 text-white transition-transform hover:scale-105"
        >
          <RotateCcw className="h-9 w-9 drop-shadow-lg" aria-hidden />
          <span className="font-display text-lg font-black tracking-wide drop-shadow-lg">
            <span className="text-warning">R</span>estart
          </span>
        </button>

        <button
          type="button"
          onClick={onNitro}
          disabled={hud.nitroCharges === 0}
          className="group flex flex-col items-center gap-1 text-white transition-transform enabled:hover:scale-105 disabled:opacity-40"
          aria-label={`Nitro, ${hud.nitroCharges} charges left`}
        >
          <span className="relative">
            <span
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-full border-2 shadow-lg",
                hud.boosting
                  ? "animate-pulse border-white bg-gradient-to-br from-rose-400 to-red-600"
                  : "border-white/70 bg-gradient-to-br from-rose-500 to-red-700",
              )}
            >
              <Zap className="h-7 w-7" aria-hidden />
            </span>
            <span className="numeric absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/80 text-xs font-black text-white">
              {hud.nitroCharges}×
            </span>
          </span>
          <span className="font-display text-lg font-black tracking-wide drop-shadow-lg">
            <span className="text-warning">N</span>itro
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

/** Arc gauge. Needle sweeps 240 degrees, red from three quarters on. */
function Speedometer({
  speed,
  maxSpeed,
  boosting,
}: {
  speed: number;
  maxSpeed: number;
  boosting: boolean;
}) {
  const fraction = Math.max(0, Math.min(1, speed / Math.max(1, maxSpeed)));
  const angle = -120 + fraction * 240;

  return (
    <div className="relative h-24 w-24">
      <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-lg">
        <circle cx="50" cy="50" r="46" fill="rgba(6,4,16,0.72)" stroke="rgba(255,255,255,0.22)" strokeWidth="3" />
        {/* Track arc, drawn as three bands so the top end reads as danger. */}
        <path d="M 18 76 A 40 40 0 0 1 24 30" fill="none" stroke="#4ade80" strokeWidth="7" strokeLinecap="round" />
        <path d="M 24 30 A 40 40 0 0 1 76 30" fill="none" stroke="#fbbf24" strokeWidth="7" strokeLinecap="round" />
        <path d="M 76 30 A 40 40 0 0 1 82 76" fill="none" stroke="#ef4444" strokeWidth="7" strokeLinecap="round" />
        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: "50px 50px" }}>
          <line x1="50" y1="50" x2="50" y2="18" stroke={boosting ? "#ff5c8a" : "#ffffff"} strokeWidth="4" strokeLinecap="round" />
        </g>
        <circle cx="50" cy="50" r="6" fill={boosting ? "#ff5c8a" : "#ffffff"} />
      </svg>
      <span className="sr-only">{Math.round(speed * 3.6)} kilometres per hour</span>
    </div>
  );
}

/** Checkpoint pips either side of a fill bar, as in the reference. */
function CheckpointBar({
  progress,
  reached,
  total,
}: {
  progress: number;
  reached: number;
  total: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <Pip label={Math.max(1, reached)} done />
      <div className="h-6 w-40 overflow-hidden rounded-full border-2 border-white/25 bg-indigo-900/70 sm:w-56">
        <div
          className="h-full bg-[repeating-linear-gradient(115deg,#a3e635_0_8px,#84cc16_8px_16px)] transition-[width] duration-200"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      <Pip label={Math.min(total, reached + 1)} done={reached >= total} />
      <span className="sr-only">
        {Math.round(progress * 100)} per cent of the track completed
      </span>
    </div>
  );
}

function Pip({ label, done }: { label: number; done: boolean }) {
  return (
    <span
      className={cn(
        "numeric flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-black",
        done
          ? "border-lime-200 bg-lime-400 text-lime-950"
          : "border-white/30 bg-indigo-900/70 text-white/70",
      )}
      aria-hidden
    >
      {label}
    </span>
  );
}
