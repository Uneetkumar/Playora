"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { buttonVariants, cn } from "@playora/ui";
import { rankForRating } from "@playora/progression";
import { AI_LEVELS, AI_LEVEL_LABELS, RECOMMENDED_AI_LEVEL, type AiLevel } from "@playora/bot-engine";
import type { GameId } from "@playora/game-types";
import {
  ArrowLeft, Users, Clock, Trophy, Bot, Swords, Zap, WifiOff, Wifi,
  ChevronRight, Shield,
} from "lucide-react";
import { GAME_CATALOG } from "../../../lib/games/catalog";
import { getPlayModes, isGameImplemented, type PlayMode } from "../../../lib/play/modes";
import { usePlayerProgression } from "../../../hooks/use-progression";
import { useMatchHistory, type MatchRecord } from "../../../hooks/use-match-history";
import { useAuthStore } from "../../../lib/store/auth-store";
import { artFor } from "../../../components/games/game-art";
import { VehicleSelect, useChosenVehicle } from "../../../games/racing/VehicleSelect";
import { TrackSelect, TRACK_PRESETS, type TrackOption } from "../../../games/racing/TrackSelect";

const MODE_ICON: Record<string, typeof Bot> = {
  "offline-ai": Bot,
  "offline-career": Trophy,
  "offline-local": Users,
  "online-friends": Swords,
  "online-random": Zap,
  lan: Wifi,
};

const MODE_BUTTON_LABEL: Record<string, string> = {
  "offline-ai": "Play vs AI",
  "offline-career": "Start Career",
  "offline-local": "Pass & Play",
  "online-friends": "Play with a friend",
  "online-random": "Quick Match",
  lan: "Local Match",
};

export default function GameDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = (params?.slug as string) ?? "";
  const { user } = useAuthStore();
  const [aiLevel, setAiLevel] = React.useState<AiLevel>(RECOMMENDED_AI_LEVEL);

  const game = GAME_CATALOG.find((g) => g.id === slug);
  const playable = game ? isGameImplemented(game.id) : false;

  const { data: progression } = usePlayerProgression(user?.id);
  const { matches } = useMatchHistory(user?.id, { gameSlug: slug, limit: 3 });

  if (!game) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <h1 className="font-display text-2xl font-bold text-foreground">No such game</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          &ldquo;{slug}&rdquo; is not in the catalog.
        </p>
        <Link href="/games" className={cn(buttonVariants({ variant: "outline" }), "mt-6")}>
          Browse games
        </Link>
      </div>
    );
  }

  const mine = progression?.ratings.find((r) => r.gameSlug === game.id) ?? null;
  const modes = getPlayModes(game.id as GameId);
  const art = artFor(game.id);

  // Fallback rating display if no rated matches yet
  const displayRating = mine?.rating ?? 1200;
  const peakRating = mine?.peakRating ?? 1200;
  const wins = mine?.wins ?? 0;
  const losses = mine?.losses ?? 0;
  const draws = mine?.draws ?? 0;
  const currentRank = rankForRating(displayRating);

  const isRacing = game.id === "car-race" || game.id === "bike-race";
  const { vehicleId, chooseVehicle } = useChosenVehicle(game.id as GameId);
  const [selectedTrack, setSelectedTrack] = React.useState<TrackOption>(TRACK_PRESETS[0]!);

  return (
    <div className="container mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* ───────────────────────────────────────────────────────────────── */}
      {/* BACK BUTTON */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <div>
        <Link
          href="/games"
          className="inline-flex items-center gap-2 rounded-full bg-[#161926]/90 border border-white/10 px-4 py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/15 hover:text-white transition-all shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to all games
        </Link>
      </div>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* HERO BANNER (Cinematic 3D Backdrop on Right, Dark Gradient Left) */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <header className="group relative min-h-[300px] overflow-hidden rounded-3xl border border-white/15 bg-[#0B0D17] shadow-[0_0_50px_rgba(124,58,237,0.15)] flex items-center p-6 sm:p-10 lg:p-12">
        {/* Top Specular Light Line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#C084FC] to-transparent z-20" />

        {/* Ambient Game Theme Glow */}
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-gradient-to-br from-[#7C3AED]/40 to-[#06B6D4]/30 blur-3xl group-hover:scale-110 transition-transform duration-700"
          aria-hidden
        />

        {/* Background Image Layer */}
        <div
          className="absolute inset-0 bg-right bg-cover bg-no-repeat opacity-90 transition-transform duration-700 group-hover:scale-105"
          style={{
            backgroundImage: `url('/games/${game.id}-hero.jpg')`,
            backgroundPosition: "right 30%",
          }}
          aria-hidden
        />

        {/* Cinematic Dark Left Scrim */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-[#0B0D17] via-[#0B0D17]/85 sm:via-[#0B0D17]/75 to-transparent"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-[#0B0D17]/90 via-transparent to-transparent sm:hidden"
          aria-hidden
        />

        {/* Hero Content */}
        <div className="relative z-10 max-w-xl space-y-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#381E72]/80 border border-[#7C3AED]/40 px-3 py-1 text-xs font-semibold text-[#D0BCFF]">
              {game.category}
            </span>
            {playable ? (
              <span className="rounded-full bg-[#0B3A2C]/80 border border-[#10B981]/40 px-3 py-1 text-xs font-semibold text-[#4ADE80]">
                Playable now
              </span>
            ) : (
              <span className="rounded-full bg-white/10 border border-white/20 px-3 py-1 text-xs font-semibold text-white/80">
                {game.phase}
              </span>
            )}
          </div>

          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white drop-shadow-md">
            {game.name}
          </h1>

          <p className="text-sm sm:text-base text-white/80 leading-relaxed max-w-lg">
            {game.description}
          </p>

          <div className="flex flex-wrap items-center gap-5 pt-1 text-xs sm:text-sm text-white/70">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Users className="h-4 w-4 text-white/90" aria-hidden />
              {game.minPlayers === game.maxPlayers
                ? `${game.minPlayers} Players`
                : `${game.minPlayers}–${game.maxPlayers} Players`}
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Clock className="h-4 w-4 text-white/90" aria-hidden />
              {game.duration}
            </span>
          </div>
        </div>
      </header>

      {/* Vehicle Garage Customizer & Track Selector for Racing Games */}
      {isRacing && (
        <div className="w-full space-y-6">
          <VehicleSelect
            gameId={game.id as GameId}
            selectedId={vehicleId}
            onSelect={chooseVehicle}
          />
          <TrackSelect
            selectedTrackId={selectedTrack.id}
            onSelectTrack={setSelectedTrack}
          />
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* MAIN 2-COLUMN DASHBOARD (Ways to Play on Left, Record on Right) */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* LEFT SECTION (Col Span 7 / 8) — Ways to Play */}
        <section className="lg:col-span-8 space-y-4">
          <h2 className="font-display text-xl font-bold text-white tracking-tight">
            Ways to play
          </h2>

          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {modes.map((mode) => (
              <ModeCard
                key={mode.id}
                mode={mode}
                gameId={game.id}
                aiLevel={aiLevel}
                onAiLevel={setAiLevel}
                onStart={() => router.push(routeFor(mode, game.id, aiLevel, isRacing ? selectedTrack.themeKey : undefined))}
              />
            ))}
          </div>
        </section>

        {/* RIGHT SECTION (Col Span 5 / 4) — Your Record & Recent Matches */}
        <aside className="lg:col-span-4 space-y-6">
          {/* Your Record */}
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-white tracking-tight">
              Your record
            </h2>

            {/* Glowing Record Card */}
            <div className="relative overflow-hidden rounded-2xl border border-[#7C3AED]/30 bg-gradient-to-b from-[#2A144E]/90 to-[#120D24]/95 p-5 shadow-xl backdrop-blur-md">
              {/* Top Specular Glow Line */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#A855F7] to-transparent" />

              {/* Rating & Tier Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#7C3AED]/20 text-[#A855F7] shadow-inner">
                    <Trophy className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="font-display text-3xl font-black text-white leading-none">
                      {displayRating}
                    </div>
                    <div className="text-xs text-white/60 font-medium mt-1">
                      Peak {peakRating}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white">
                  <Shield className="h-3.5 w-3.5 text-[#A855F7]" />
                  {currentRank.label}
                </div>
              </div>

              {/* 3 Stats Grid */}
              <div className="my-4 grid grid-cols-3 rounded-xl border border-white/5 bg-[#0B0817]/90 p-3 text-center">
                <div>
                  <div className="font-display text-base font-black text-white">{wins}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/50 mt-0.5">
                    WON
                  </div>
                </div>
                <div className="border-x border-white/10">
                  <div className="font-display text-base font-black text-white">{losses}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/50 mt-0.5">
                    LOST
                  </div>
                </div>
                <div>
                  <div className="font-display text-base font-black text-white">{draws}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/50 mt-0.5">
                    DRAWN
                  </div>
                </div>
              </div>

              {/* Tier Progress */}
              <div>
                <p className="text-xs text-white/70 font-medium mb-1.5">
                  {mine?.toNextRank
                    ? `${mine.toNextRank.needed} more rating to reach ${mine.toNextRank.tier.label}.`
                    : "100 more rating to reach Gold."}
                </p>
                <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#7C3AED] transition-all duration-500"
                    style={{ width: "75%" }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Recent Matches */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-white tracking-tight">
                Recent matches
              </h2>
              <Link
                href="/history"
                className="text-xs font-semibold text-[#A855F7] hover:text-[#C084FC] transition-colors"
              >
                All matches
              </Link>
            </div>

            {matches.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/3 py-8 text-center">
                <p className="text-xs text-white/40">No matches played yet.</p>
                <p className="text-[11px] text-white/25 mt-1">Play a game — your results will appear here.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {matches.map((m: MatchRecord) => (
                  <div
                    key={m.sessionId}
                    className="flex items-center justify-between rounded-xl border border-white/5 bg-[#11131F]/90 p-3.5 hover:border-white/15 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg overflow-hidden flex items-center justify-center bg-white/5">
                        <art.Art className="h-6 w-6 object-contain" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-[10px] font-black uppercase px-1.5 py-0.5 rounded",
                              m.outcome === "win"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : m.outcome === "loss"
                                ? "bg-rose-500/20 text-rose-400"
                                : "bg-amber-500/20 text-amber-300"
                            )}
                          >
                            {m.outcome.toUpperCase()}
                          </span>
                          <span className="text-xs font-bold text-white">{game.name}</span>
                        </div>
                        <p className="text-[11px] text-white/50 mt-0.5">
                          vs AI opponent • {m.durationSeconds}s
                        </p>
                      </div>
                    </div>

                    <Link
                      href={`/history/${m.sessionId}`}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-white/60 hover:bg-white/15 hover:text-white transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

/**
 * Route resolution for different play modes.
 */
function routeFor(mode: PlayMode, gameId: string, aiLevel: AiLevel, themeKey?: string): string {
  const themeParam = themeKey ? `&theme=${themeKey}` : "";
  switch (mode.id) {
    case "offline-ai":
      return `/play?game=${gameId}&mode=vs-ai&level=${aiLevel}${themeParam}`;
    case "offline-career":
      return `/play?game=${gameId}&mode=career${themeParam}`;
    case "offline-local":
      return `/play?game=${gameId}&mode=pass-and-play${themeParam}`;
    case "online-friends":
      return `/rooms?game=${gameId}`;
    case "online-random":
      return `/play?game=${gameId}&quick=1${themeParam}`;
    case "lan":
      return `/lan?game=${gameId}&role=host`;
    default:
      return `/games`;
  }
}

function ModeCard({
  mode,
  gameId,
  aiLevel,
  onAiLevel,
  onStart,
}: {
  mode: PlayMode;
  gameId: string;
  aiLevel: AiLevel;
  onAiLevel: (level: AiLevel) => void;
  onStart: () => void;
}) {
  const Icon = MODE_ICON[mode.id] ?? Zap;
  const ready = mode.status === "ready";
  const btnLabel = MODE_BUTTON_LABEL[mode.id] ?? mode.label;

  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-xl border p-4 transition-all duration-200 min-h-[190px]",
        ready
          ? "border-[#7C3AED]/40 bg-gradient-to-b from-[#1a1035]/95 to-[#0f0c1f]/90 hover:border-[#7C3AED]/70 hover:shadow-[0_0_18px_rgba(124,58,237,0.2)] shadow-sm"
          : "border-white/8 bg-[#11131F]/70 opacity-55"
      )}
    >
      <div className="space-y-1.5">
        {/* Header Row: Icon + Title + Wifi Icon */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#7C3AED]/20 text-[#A78BFA]">
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold text-white">{mode.label}</span>
          </div>
          {mode.needsInternet ? (
            <Wifi className="h-3.5 w-3.5 text-white/40" aria-label="Online Match" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-white/40" aria-label="Works offline" />
          )}
        </div>

        {/* Tagline Description */}
        <p className="text-xs text-white/60 leading-snug pt-0.5">{mode.tagline}</p>
      </div>

      {/* Bot Difficulty Selector (Only for Offline AI) */}
      {ready && mode.id === "offline-ai" && (
        <div className="my-2 pt-1.5">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/50">
            DIFFICULTY
          </div>
          <div className="flex items-center gap-1">
            {AI_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => onAiLevel(level)}
                aria-pressed={level === aiLevel}
                className={cn(
                  "numeric h-6 w-6 rounded-md text-xs font-bold transition-all flex items-center justify-center",
                  level === aiLevel
                    ? "bg-[#7C3AED] text-white shadow-md scale-105"
                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                )}
              >
                {level}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-white/50 font-medium">
            {AI_LEVEL_LABELS[aiLevel]}
            {aiLevel === RECOMMENDED_AI_LEVEL && (
              <span className="ml-1 text-[#4ADE80] font-semibold">Recommended</span>
            )}
          </p>
        </div>
      )}

      {/* Button */}
      <div className="mt-3">
        {ready ? (
          <button
            type="button"
            onClick={onStart}
            className="w-full rounded-lg bg-[#6D28D9] hover:bg-[#7C3AED] text-white font-semibold text-xs py-2.5 transition-colors shadow-md flex items-center justify-center gap-1.5 active:scale-[0.98]"
          >
            {mode.id === "offline-ai" ? `Play level ${aiLevel}` : btnLabel}
          </button>
        ) : (
          <div className="w-full rounded-lg bg-white/5 text-white/40 text-xs py-2 text-center font-medium">
            {mode.note ?? "Coming soon"}
          </div>
        )}
      </div>
      <span className="sr-only">{gameId}</span>
    </div>
  );
}
