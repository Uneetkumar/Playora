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
  themeKey:
    | "cityNight"
    | "sunsetHighway"
    | "futuristicArena"
    | "volcanicRidge"
    | "mountainPass"
    | "desertDunes"
    | "jungleRuins"
    | "snowPeak"
    | "industrialZone"
    | "forestTrail"
    | "canyonRush"
    | "coastalHighway";
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
  {
    id: "track-mountain-pass",
    themeKey: "mountainPass",
    name: "Mountain Pass",
    subtitle: "Twisting alpine switchbacks with sheer drops on the outside line",
    environment: "Alpine Pass • Cold Tarmac",
    lengthMeters: 2760,
    corners: 22,
    surface: "Cold Tarmac",
    difficulty: "Expert",
    bestLap: "01:12.400",
    gradient: "from-[#12243a] via-[#0c1728] to-[#050b14]",
    borderGlow: "border-[#60a5fa]/50 group-hover:border-[#60a5fa]",
    svgPath: "M25 60 C15 35, 45 15, 70 25 C95 35, 85 55, 105 60 C130 66, 120 85, 90 80 C60 76, 40 82, 25 60 Z",
  },
  {
    id: "track-desert-run",
    themeKey: "desertDunes",
    name: "Desert Run",
    subtitle: "Long open straights across shimmering dunes and dry riverbeds",
    environment: "Open Desert • Sand-Dusted",
    lengthMeters: 3100,
    corners: 8,
    surface: "Sand-Dusted",
    difficulty: "Beginner",
    bestLap: "01:04.930",
    gradient: "from-[#3a2a12] via-[#241a0c] to-[#120d05]",
    borderGlow: "border-[#f59e0b]/50 group-hover:border-[#f59e0b]",
    svgPath: "M20 55 C20 30, 60 22, 95 28 C125 33, 130 62, 105 74 C75 88, 35 80, 20 55 Z",
  },
  {
    id: "track-jungle-ruins",
    themeKey: "jungleRuins",
    name: "Jungle Ruins",
    subtitle: "Blind corners through collapsed stonework and hanging canopy",
    environment: "Overgrown Ruins • Damp Stone",
    lengthMeters: 1980,
    corners: 18,
    surface: "Damp Stone",
    difficulty: "Expert",
    bestLap: "00:58.720",
    gradient: "from-[#122a1c] via-[#0b1a12] to-[#050d08]",
    borderGlow: "border-[#4ade80]/50 group-hover:border-[#4ade80]",
    svgPath: "M35 35 C55 18, 95 22, 112 42 C126 58, 108 78, 82 78 C58 78, 42 68, 30 58 C20 50, 24 44, 35 35 Z",
  },
  {
    id: "track-frozen-summit",
    themeKey: "snowPeak",
    name: "Frozen Summit",
    subtitle: "Low-grip ice and packed snow where every apex is a negotiation",
    environment: "Glacier Road • Ice",
    lengthMeters: 2340,
    corners: 15,
    surface: "Ice",
    difficulty: "Master",
    bestLap: "01:18.660",
    gradient: "from-[#1b2f42] via-[#101d2a] to-[#070e15]",
    borderGlow: "border-[#7dd3fc]/50 group-hover:border-[#7dd3fc]",
    svgPath: "M28 48 C24 26, 62 16, 88 28 C112 39, 122 62, 100 76 C76 90, 44 78, 28 48 Z",
  },
  {
    id: "track-industrial-zone",
    themeKey: "industrialZone",
    name: "Industrial Zone",
    subtitle: "Tight concrete canyons between gantries, pipework and loading bays",
    environment: "Refinery District • Oil-Slicked",
    lengthMeters: 1760,
    corners: 20,
    surface: "Oil-Slicked",
    difficulty: "Intermediate",
    bestLap: "00:51.480",
    gradient: "from-[#2a2418] via-[#1a1610] to-[#0c0a07]",
    borderGlow: "border-[#fbbf24]/50 group-hover:border-[#fbbf24]",
    svgPath: "M25 30 L105 30 L120 50 L105 72 L45 72 L25 55 Z",
  },
  {
    id: "track-forest-trail",
    themeKey: "forestTrail",
    name: "Forest Trail",
    subtitle: "Rutted mud and root-broken tarmac beneath a closed-in canopy",
    environment: "Deep Forest • Loose Mud",
    lengthMeters: 2120,
    corners: 17,
    surface: "Loose Mud",
    difficulty: "Intermediate",
    bestLap: "01:06.310",
    gradient: "from-[#1c2a16] via-[#111a0e] to-[#080d06]",
    borderGlow: "border-[#a3e635]/50 group-hover:border-[#a3e635]",
    svgPath: "M30 52 C22 30, 58 18, 84 30 C104 39, 96 54, 114 60 C132 67, 112 84, 84 80 C56 76, 38 72, 30 52 Z",
  },
  {
    id: "track-canyon-rush",
    themeKey: "canyonRush",
    name: "Canyon Rush",
    subtitle: "A single-lane ribbon between vertical red rock with nowhere to go wide",
    environment: "Slot Canyon • Dusty Rock",
    lengthMeters: 2640,
    corners: 24,
    surface: "Dusty Rock",
    difficulty: "Master",
    bestLap: "01:15.040",
    gradient: "from-[#33190f] via-[#1f0f09] to-[#100704]",
    borderGlow: "border-[#f97316]/50 group-hover:border-[#f97316]",
    svgPath: "M22 45 C34 22, 64 30, 78 20 C96 8, 122 30, 112 52 C104 72, 74 66, 58 76 C38 88, 14 68, 22 45 Z",
  },
  {
    id: "track-coastal-highway",
    themeKey: "coastalHighway",
    name: "Coastal Highway",
    subtitle: "Fast sweeping curves along a sunlit sea wall, spray across the racing line",
    environment: "Sea Wall • Salt-Damp",
    lengthMeters: 2880,
    corners: 11,
    surface: "Salt-Damp",
    difficulty: "Beginner",
    bestLap: "01:02.170",
    gradient: "from-[#0e2a33] via-[#081a20] to-[#040d10]",
    borderGlow: "border-[#22d3ee]/50 group-hover:border-[#22d3ee]",
    svgPath: "M20 58 C18 34, 52 20, 82 26 C110 32, 128 48, 116 66 C102 86, 62 82, 40 74 C28 70, 21 66, 20 58 Z",
  }
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
                {TRACK_PRESETS.length} THEMES
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

                {/*
                  * The circuit, drawn as a track rather than a line.
                  *
                  * It was a single 3px stroke with one dot on it, which tells a
                  * player nothing: not where the start is, not which way round
                  * it goes, not whether it is fast or technical. Four stacked
                  * strokes give it asphalt, a kerbed edge and a dashed racing
                  * line, and the markers say where you start and which
                  * direction you travel.
                  */}
                <div className="relative my-3 flex h-24 w-full items-center justify-center overflow-hidden rounded-xl border border-white/5 bg-black/40 p-2">
                  {/* Faint grid, so the map reads as a plan view. */}
                  <svg viewBox="0 0 140 90" className="absolute inset-0 h-full w-full opacity-[0.13]" aria-hidden>
                    <defs>
                      <pattern id={`grid-${track.id}`} width="10" height="10" patternUnits="userSpaceOnUse">
                        <path d="M10 0 L0 0 0 10" fill="none" stroke="#94a3b8" strokeWidth="0.4" />
                      </pattern>
                    </defs>
                    <rect width="140" height="90" fill={`url(#grid-${track.id})`} />
                  </svg>

                  <svg
                    viewBox="0 0 140 90"
                    className="relative h-full w-full drop-shadow-md"
                    role="img"
                    aria-label={`${track.name} circuit layout, ${track.corners} corners`}
                  >
                    {/* Run-off, widest and dimmest. */}
                    <path d={track.svgPath} fill="none" stroke="rgba(148,163,184,0.10)" strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" />
                    {/* Kerb. */}
                    <path d={track.svgPath} fill="none" stroke={isSelected ? "#00f0ff" : "#64748b"} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" opacity={0.45} />
                    {/* Asphalt. */}
                    <path d={track.svgPath} fill="none" stroke="#0b0f19" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
                    {/* Racing line, dashed down the middle. */}
                    <path
                      d={track.svgPath}
                      fill="none"
                      stroke={isSelected ? "#7dd3fc" : "#94a3b8"}
                      strokeWidth={1.4}
                      strokeDasharray="5 5"
                      strokeLinecap="round"
                      opacity={0.85}
                    />

                    {/* Start/finish: a chequered bar across the track, not a dot. */}
                    <g transform="translate(25 45)">
                      <rect x="-1.6" y="-7" width="3.2" height="14" fill="#f8fafc" rx="0.6" />
                      <rect x="-1.6" y="-7" width="3.2" height="3.5" fill="#0b0f19" />
                      <rect x="-1.6" y="0" width="3.2" height="3.5" fill="#0b0f19" />
                    </g>

                    {/* Direction of travel. */}
                    <path d="M40 30 l7 4 -7 4 z" fill={isSelected ? "#00f0ff" : "#94a3b8"} opacity="0.9" />
                  </svg>

                  {/* Corner count, read straight off the card. */}
                  <span className="absolute bottom-1.5 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white/70">
                    {track.corners} turns
                  </span>
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
