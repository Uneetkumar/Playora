"use client";

import * as React from "react";
import { Badge, Card, LoadingState, cn } from "@playora/ui";
import type { GameId } from "@playora/game-types";
import { Lock, Star, Trophy, Users, Flag, Zap, Sparkles, Play } from "lucide-react";
import { useRaceProgress } from "../../lib/racing/use-race-progress";
import type { RaceLevel } from "@playora/game-engine";

interface LevelSelectProps {
  gameId: GameId;
  onStart: (level: RaceLevel) => void;
}

export function LevelSelect({ gameId, onStart }: LevelSelectProps) {
  const { levels, hydrated, isUnlocked, stars, totalStars } = useRaceProgress(gameId);

  if (!hydrated) {
    return <LoadingState title="Loading your career progress..." />;
  }

  const maxStars = levels.length * 3;
  const isBike = gameId === "bike-race";

  return (
    <div className="w-full h-full flex flex-col overflow-y-auto px-4 sm:px-8 py-6 max-w-[1800px] mx-auto">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* CAREER HEADER BANNER */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="relative mb-8 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-[#1E0E38] via-[#140D28] to-[#0A0B14] p-6 sm:p-8 shadow-2xl shrink-0">
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-[#7C3AED]/20 blur-3xl"
          aria-hidden
        />
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex items-center gap-1 rounded-full bg-[#7C3AED]/30 border border-[#7C3AED]/50 px-3 py-1 text-xs font-bold text-[#C084FC]">
                <Sparkles className="h-3.5 w-3.5" />
                {isBike ? "Superbike World Championship" : "Apex GT Championship"}
              </span>
              <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 text-xs font-bold text-emerald-400">
                ● 8 Circuits Available
              </span>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl font-black text-white tracking-tight">
              Racing Career
            </h1>
            <p className="mt-1.5 text-sm sm:text-base text-white/60 max-w-xl leading-relaxed">
              Conquer challenging city tracks, master nitro boosts, and beat AI rivals to unlock the Grand Final.
            </p>
          </div>

          {/* Star Progress Pill */}
          <div className="flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-3 shadow-lg shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 shadow-inner">
              <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-amber-300/70">
                Career Stars
              </p>
              <div className="font-display text-xl font-black text-white">
                {totalStars} <span className="text-white/40 text-sm font-normal">/ {maxStars} ★</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* CIRCUITS / TRACKS 4-COLUMN RESPONSIVE GRID */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 pb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <span>Championship Circuits</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">
              {levels.length} Tracks
            </span>
          </h2>
        </div>

        <ul className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {levels.map((level) => {
            const unlocked = isUnlocked(level);
            const earned = stars(level);
            const previous = levels[level.index - 2];

            return (
              <li key={level.index} className="flex">
                <Card
                  className={cn(
                    "relative flex w-full flex-col justify-between overflow-hidden rounded-2xl border p-5 transition-all duration-200 shadow-xl",
                    unlocked
                      ? "border-white/10 bg-[#0F111E]/90 hover:border-[#7C3AED]/60 hover:shadow-[0_0_25px_rgba(124,58,237,0.25)] hover:scale-[1.02]"
                      : "border-white/5 bg-[#0A0B14]/70 opacity-60"
                  )}
                >
                  {/* Top Bar: Number + Name + Stars/Lock */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#7C3AED] to-[#9333EA] text-xs font-black text-white shadow-md">
                          {level.index < 10 ? `0${level.index}` : level.index}
                        </span>
                        <h3 className="font-display text-base font-black text-white truncate max-w-[150px]">
                          {level.name}
                        </h3>
                      </div>

                      {unlocked ? (
                        <Stars earned={earned} />
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-white/40">
                          <Lock className="h-3.5 w-3.5" aria-hidden />
                        </div>
                      )}
                    </div>

                    {/* Blurb or Lock Requirement */}
                    <p className="text-xs text-white/60 min-h-[36px] line-clamp-2 leading-relaxed mb-4">
                      {unlocked
                        ? level.blurb
                        : previous
                        ? `Finish ${ordinal(previous.targetPlace)} or better in ${previous.name} to unlock.`
                        : "Locked circuit."}
                    </p>

                    {/* Track Stats Chips */}
                    <div className="flex flex-wrap gap-1.5 mb-5">
                      <Badge variant="outline" className="gap-1 text-[10px] border-white/10 text-white/80 bg-white/5 py-1">
                        <Flag className="h-3 w-3 text-cyan-400" />
                        {(level.trackLength / 1000).toFixed(1)} km
                      </Badge>
                      <Badge variant="outline" className="gap-1 text-[10px] border-white/10 text-white/80 bg-white/5 py-1">
                        <Users className="h-3 w-3 text-purple-400" />
                        {level.opponents} {level.opponents === 1 ? "Rival" : "Rivals"}
                      </Badge>
                      <Badge variant="outline" className="gap-1 text-[10px] border-white/10 text-white/80 bg-white/5 py-1">
                        <Zap className="h-3 w-3 text-amber-400" />
                        {level.nitroCharges}× Nitro
                      </Badge>
                      <Badge variant="outline" className="gap-1 text-[10px] border-white/10 text-white/80 bg-white/5 py-1">
                        <Trophy className="h-3 w-3 text-emerald-400" />
                        Target: {ordinal(level.targetPlace)}
                      </Badge>
                    </div>
                  </div>

                  {/* Start / Action Button */}
                  <button
                    type="button"
                    disabled={!unlocked}
                    onClick={() => onStart(level)}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold transition-all shadow-md active:scale-95",
                      unlocked
                        ? "bg-[#7C3AED] hover:bg-[#6D28D9] text-white hover:shadow-[0_0_20px_rgba(124,58,237,0.5)]"
                        : "cursor-not-allowed bg-white/5 text-white/30 border border-white/5"
                    )}
                  >
                    {!unlocked ? (
                      <>
                        <Lock className="h-3.5 w-3.5" />
                        <span>Locked</span>
                      </>
                    ) : earned > 0 ? (
                      <>
                        <Play className="h-3.5 w-3.5 fill-current" />
                        <span>Race Again ({earned}★)</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5 fill-current" />
                        <span>Start Race</span>
                      </>
                    )}
                  </button>
                </Card>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function Stars({ earned, size = "sm" }: { earned: number; size?: "sm" | "lg" }) {
  const box = size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5";
  return (
    <div className="flex shrink-0 gap-1 rounded-full bg-black/40 border border-white/10 px-2 py-1">
      {[1, 2, 3].map((n) => (
        <Star
          key={n}
          className={cn(
            box,
            n <= earned ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]" : "text-white/20"
          )}
          aria-hidden
        />
      ))}
    </div>
  );
}

function ordinal(place: number): string {
  if (place === 1) return "1st";
  if (place === 2) return "2nd";
  if (place === 3) return "3rd";
  return `${place}th`;
}
