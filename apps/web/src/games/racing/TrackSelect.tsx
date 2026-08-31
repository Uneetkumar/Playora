"use client";

import { cn } from "@playora/ui";
import {
  Check,
  Zap,
  MapPin,
  Clock,
  Compass,
} from "lucide-react";

export interface TrackOption {
  id: string;
  themeKey: "cityNight" | "sunsetHighway" | "futuristicArena" | "volcanicRidge";
  name: string;
  subtitle: string;
  environment: string;
  lengthMeters: number;
  corners: number;
  surface: string;
  difficulty: "Beginner" | "Intermediate" | "Expert" | "Master";
  bestLap: string;
  gradient: string;
  borderGlow: string;
  svgPath: string;
}

export const TRACK_PRESETS: TrackOption[] = [
  {
    id: "track-city-night",
    themeKey: "cityNight",
    name: "Cyber Metropolis",
    subtitle: "Downtown high-speed straights through glowing skyscrapers",
    environment: "Night City • Wet Asphalt",
    lengthMeters: 1840,
    corners: 12,
    surface: "Wet Asphalt",
    difficulty: "Beginner",
    bestLap: "00:48.240",
    gradient: "from-[#1a103c] via-[#0d0924] to-[#070514]",
    borderGlow: "border-[#7c3aed]/50 group-hover:border-[#7c3aed]",
    svgPath: "M20 50 C20 20, 60 20, 70 35 C80 50, 110 20, 120 50 C130 80, 80 80, 50 75 C30 70, 20 80, 20 50 Z",
  },
  {
    id: "track-sunset-highway",
    themeKey: "sunsetHighway",
    name: "Sunset Coastal",
    subtitle: "Scenic cliffside boulevard against a golden twilight horizon",
    environment: "Coastal Highway • Warm Asphalt",
    lengthMeters: 2200,
    corners: 16,
    surface: "Smooth Highway",
    difficulty: "Intermediate",
    bestLap: "00:56.810",
    gradient: "from-[#2e1022] via-[#1a0b18] to-[#0c050c]",
    borderGlow: "border-[#f97316]/50 group-hover:border-[#f97316]",
    svgPath: "M30 30 C50 15, 90 20, 110 30 C130 40, 125 70, 95 75 C70 80, 45 70, 25 60 C10 50, 15 35, 30 30 Z",
  },
  {
    id: "track-neon-arena",
    themeKey: "futuristicArena",
    name: "Neon Arena",
    subtitle: "Overhead LED gantry tunnel engineered for ultra-fast drafting",
    environment: "Cyber Arena • Tech Grid",
    lengthMeters: 1620,
    corners: 10,
    surface: "Laser Grid",
    difficulty: "Expert",
    bestLap: "00:42.150",
    gradient: "from-[#08182b] via-[#050f1d] to-[#02060e]",
    borderGlow: "border-[#06b6d4]/50 group-hover:border-[#06b6d4]",
    svgPath: "M30 45 C30 25, 70 15, 100 25 C120 35, 125 60, 105 75 C85 85, 45 80, 25 65 C15 55, 30 50, 30 45 Z",
  },
  {
    id: "track-volcanic-ridge",
    themeKey: "volcanicRidge",
    name: "Volcanic Ridge",
    subtitle: "Technical hairpin chicanes over molten basalt rock spires",
    environment: "Volcanic Pass • Basalt Spires",
    lengthMeters: 2480,
    corners: 20,
    surface: "Basalt Rock",
    difficulty: "Master",
    bestLap: "01:04.320",
    gradient: "from-[#2c080d] via-[#1a0508] to-[#0c0204]",
    borderGlow: "border-[#ef4444]/50 group-hover:border-[#ef4444]",
    svgPath: "M25 40 C35 15, 65 30, 85 20 C105 10, 125 35, 115 60 C105 85, 65 75, 45 80 C25 85, 15 65, 25 40 Z",
  },
];

/**
 * AAA-Grade Track & Environment Selection Component.
 */
export function TrackSelect({
  selectedTrackId,
  onSelectTrack,
}: {
  selectedTrackId: string;
  onSelectTrack: (track: TrackOption) => void;
}) {
  return (
    <div className="w-full space-y-4 rounded-3xl border border-white/20 bg-[#0b0d18]/95 p-6 shadow-2xl backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#06b6d4]/20 text-[#06b6d4] border border-[#06b6d4]/40 shadow-inner">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-black text-white flex items-center gap-2">
              CIRCUIT SELECTION
              <span className="rounded-full bg-cyan-500/20 border border-cyan-500/40 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                4 THEMES
              </span>
            </h2>
            <p className="text-xs text-white/50">
              Select environmental conditions, length, and track difficulty
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Tracks */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TRACK_PRESETS.map((track) => {
          const isSelected = track.id === selectedTrackId;
          return (
            <button
              key={track.id}
              type="button"
              onClick={() => onSelectTrack(track)}
              className={cn(
                "group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 text-left transition-all duration-300 bg-gradient-to-b",
                track.gradient,
                isSelected
                  ? "border-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.35)] scale-[1.02]"
                  : "border-white/15 hover:border-white/30 hover:scale-[1.01]"
              )}
            >
              {/* Top ambient theme glow */}
              <div className="pointer-events-none absolute -top-10 -right-10 h-24 w-24 rounded-full bg-white/5 blur-xl group-hover:bg-white/10" />

              <div>
                {/* Difficulty & Status Pill */}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border",
                      track.difficulty === "Beginner"
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                        : track.difficulty === "Intermediate"
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                        : track.difficulty === "Expert"
                        ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                        : "bg-rose-500/20 text-rose-400 border-rose-500/40"
                    )}
                  >
                    {track.difficulty}
                  </span>

                  {isSelected && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-400 text-[#090b14] shadow-md">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </span>
                  )}
                </div>

                {/* Track Circuit Mini Vector Silhouette */}
                <div className="my-3 flex h-24 w-full items-center justify-center rounded-xl bg-black/40 border border-white/5 p-2">
                  <svg viewBox="0 0 140 90" className="h-full w-full drop-shadow-md">
                    <path
                      d={track.svgPath}
                      fill="none"
                      stroke="rgba(255,255,255,0.15)"
                      strokeWidth={10}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d={track.svgPath}
                      fill="none"
                      stroke={isSelected ? "#00f0ff" : "#94a3b8"}
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Start marker dot */}
                    <circle cx="25" cy="45" r="4" fill="#f43f5e" />
                  </svg>
                </div>

                {/* Name & Subtitle */}
                <h3 className="font-display text-base font-black text-white group-hover:text-cyan-300 transition-colors">
                  {track.name}
                </h3>
                <p className="text-[11px] text-white/60 leading-tight mt-1">
                  {track.subtitle}
                </p>
              </div>

              {/* Bottom Specs Pill */}
              <div className="mt-4 border-t border-white/10 pt-3 grid grid-cols-2 gap-2 text-[11px] text-white/70">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-cyan-400" />
                  <span>{track.lengthMeters}m</span>
                </div>
                <div className="flex items-center gap-1.5 justify-end">
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                  <span>{track.corners} Turns</span>
                </div>
                <div className="flex items-center gap-1.5 col-span-2 text-[10px] text-white/50">
                  <Clock className="h-3 w-3 text-[#c084fc]" />
                  <span>Best Record: <strong className="text-white/80">{track.bestLap}</strong></span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
