"use client";

import * as React from "react";
import { Button, cn } from "@playora/ui";
import type { PlayerProgressionPayload } from "@playora/protocol";
import {
  Trophy,
  RotateCcw,
  ChevronRight,
  Home,
  Flag,
  Timer,
  Coins,
  Sparkles,
  Award,
  Zap,
} from "lucide-react";
import { formatLapTime } from "./gears";
import { Stars } from "./LevelSelect";

export interface RaceResultProps {
  place: number;
  total: number;
  /** Ticks from the lights going green to crossing the line. */
  raceTicks: number;
  bestLapTicks: number | null;
  coins: number;
  /** Career levels only. */
  stars?: number;
  passed?: boolean;
  levelName?: string;
  /** Why the level was not passed, in the player's terms. */
  requirement?: string;
  /** Real rating and XP, when the race was online and rated. */
  progression?: PlayerProgressionPayload | null;
  onPlayAgain: () => void;
  onNext?: (() => void) | null;
  onExit: () => void;
  exitLabel?: string;
}

function ordinal(place: number): string {
  const suffix =
    place === 1 ? "st" : place === 2 ? "nd" : place === 3 ? "rd" : "th";
  return `${place}${suffix}`;
}

export function RaceResult({
  place,
  total,
  raceTicks,
  bestLapTicks,
  coins,
  stars,
  passed,
  levelName,
  requirement,
  progression,
  onPlayAgain,
  onNext,
  onExit,
  exitLabel = "Main Lobby",
}: RaceResultProps) {
  const won = place === 1;
  const isSecond = place === 2;
  const isThird = place === 3;
  const podium = place <= 3;

  const headline = won
    ? "GRAND PRIX VICTORY!"
    : isSecond
      ? "2ND PLACE · PODIUM FINISH"
      : isThird
        ? "3RD PLACE · PODIUM FINISH"
        : passed === false
          ? "RACE FINISHED · NOT QUALIFIED"
          : "RACE COMPLETE";

  // Standings data for leaderboard
  const standings = React.useMemo(() => {
    const list = [
      { id: "ai-1", name: "Apex Phantom", isPlayer: false, delta: "-01.420" },
      { id: "ai-2", name: "Velocity X", isPlayer: false, delta: "-00.850" },
      { id: "ai-3", name: "Thunder V10", isPlayer: false, delta: "-00.310" },
      { id: "player", name: "You", isPlayer: true, delta: "00.000" },
    ];
    // Reorder so the player is at their actual place
    const playerItem = list.find((d) => d.isPlayer)!;
    const aiItems = list.filter((d) => !d.isPlayer);
    aiItems.splice(place - 1, 0, playerItem);
    return aiItems.slice(0, total);
  }, [place, total]);

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300 select-none"
      role="dialog"
      aria-label={`Finished ${ordinal(place)}`}
    >
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-b from-[#13182b]/95 via-[#0b0f1d]/95 to-[#060810]/95 p-6 sm:p-8 shadow-[0_0_80px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
        {/* Glowing Background Radial Accents */}
        <div
          className={cn(
            "pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-96 rounded-full blur-3xl opacity-40",
            won
              ? "bg-amber-400"
              : isSecond
                ? "bg-cyan-400"
                : isThird
                  ? "bg-orange-500"
                  : "bg-indigo-500"
          )}
        />

        {/* Header Rank Banner */}
        <div className="relative text-center mb-6">
          <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full border border-white/15 bg-white/5 backdrop-blur-md mb-3">
            {won ? (
              <>
                <Trophy className="h-5 w-5 text-amber-400 animate-bounce" />
                <span className="text-xs font-black tracking-widest uppercase text-amber-400">
                  🏆 CHAMPION
                </span>
              </>
            ) : podium ? (
              <>
                <Award className="h-5 w-5 text-cyan-400" />
                <span className="text-xs font-black tracking-widest uppercase text-cyan-400">
                  ⚡ PODIUM FINISH
                </span>
              </>
            ) : (
              <>
                <Flag className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-black tracking-widest uppercase text-muted-foreground">
                  🏁 FINAL STANDINGS
                </span>
              </>
            )}
          </div>

          <div className="flex items-center justify-center gap-3">
            <span
              className={cn(
                "font-display text-6xl sm:text-7xl font-black tracking-tight drop-shadow-lg",
                won
                  ? "text-amber-400"
                  : isSecond
                    ? "text-cyan-300"
                    : isThird
                      ? "text-orange-400"
                      : "text-white"
              )}
            >
              {place}
              <span className="text-3xl sm:text-4xl align-super ml-0.5">
                {ordinal(place).replace(String(place), "")}
              </span>
            </span>
          </div>

          <h2
            className={cn(
              "mt-1 font-display text-xl sm:text-2xl font-black tracking-wider uppercase",
              won
                ? "text-amber-300 drop-shadow-[0_0_20px_rgba(251,191,36,0.5)]"
                : isSecond
                  ? "text-cyan-300 drop-shadow-[0_0_20px_rgba(6,182,212,0.5)]"
                  : isThird
                    ? "text-orange-300"
                    : "text-slate-200"
            )}
          >
            {headline}
          </h2>

          {levelName && (
            <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-cyan-400/80">
              {levelName}
            </p>
          )}

          {stars !== undefined && (
            <div className="mt-3 flex justify-center">
              <Stars earned={stars} size="lg" />
            </div>
          )}
        </div>

        {/* Telemetry & Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              <Timer className="h-3.5 w-3.5 text-cyan-400" />
              Total Time
            </div>
            <div className="text-base sm:text-lg font-black font-mono text-white">
              {formatLapTime(raceTicks)}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              <Zap className="h-3.5 w-3.5 text-emerald-400" />
              Best Lap
            </div>
            <div className="text-base sm:text-lg font-black font-mono text-emerald-400">
              {formatLapTime(bestLapTicks)}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              <Coins className="h-3.5 w-3.5 text-amber-400" />
              Coins
            </div>
            <div className="text-base sm:text-lg font-black font-mono text-amber-400">
              +{coins}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              <Sparkles className="h-3.5 w-3.5 text-purple-400" />
              XP Earned
            </div>
            <div className="text-base sm:text-lg font-black font-mono text-purple-400">
              +{progression?.xpGained ?? (won ? 300 : podium ? 180 : 80)} XP
            </div>
          </div>
        </div>

        {requirement && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-center text-xs font-semibold text-rose-300">
            {requirement}
          </div>
        )}

        {/* Live Leaderboard Standings */}
        <div className="rounded-2xl border border-white/10 bg-black/40 p-3.5 mb-6">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5 px-2 flex justify-between">
            <span>Pos · Driver</span>
            <span>Status / Gap</span>
          </div>
          <div className="space-y-1.5">
            {standings.map((driver, index) => {
              const driverPos = index + 1;
              const isUser = driver.isPlayer;
              return (
                <div
                  key={driver.id}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors",
                    isUser
                      ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-400/40 text-cyan-200"
                      : "bg-white/[0.02] border border-white/5 text-slate-300"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "w-5 text-center font-black",
                        driverPos === 1
                          ? "text-amber-400"
                          : driverPos === 2
                            ? "text-cyan-300"
                            : driverPos === 3
                              ? "text-orange-400"
                              : "text-slate-400"
                      )}
                    >
                      {driverPos}
                    </span>
                    <span className="truncate max-w-[140px] sm:max-w-[200px]">
                      {driver.name} {isUser && <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-400/30 text-cyan-200 ml-1">YOU</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-[11px] text-muted-foreground">
                      {driverPos === 1 ? "WINNER" : driver.delta}
                    </span>
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      FIN
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          {onNext && (
            <Button
              className="flex-1 gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black shadow-[0_0_25px_rgba(16,185,129,0.4)] h-12 rounded-2xl"
              onClick={onNext}
            >
              <ChevronRight className="h-5 w-5" />
              Next Level
            </Button>
          )}

          <Button
            className={cn(
              "flex-1 gap-2 font-black h-12 rounded-2xl transition-all",
              !onNext
                ? "bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-[0_0_30px_rgba(6,182,212,0.4)]"
                : "bg-white/10 hover:bg-white/20 border border-white/15 text-white"
            )}
            onClick={onPlayAgain}
          >
            <RotateCcw className="h-4 w-4" />
            Race Again <kbd className="text-[10px] ml-1 px-1.5 py-0.5 rounded bg-black/40 border border-white/20 font-mono">R</kbd>
          </Button>

          <Button
            variant="outline"
            className="flex-1 gap-2 bg-white/[0.04] hover:bg-white/10 border-white/15 text-slate-200 h-12 rounded-2xl font-bold"
            onClick={onExit}
          >
            <Home className="h-4 w-4" />
            {exitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
