"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, Card, cn } from "@playora/ui";
import {
  Sparkles,
  Play,
  ChevronRight,
  Flame,
  LayoutGrid,
  Zap,
  Wifi,
  Swords,
  Trophy,
  Camera,
} from "lucide-react";
import { GAME_CATALOG, isPlayable } from "../lib/games/catalog";
import { GameTile } from "../components/games/game-tile";
import { useAuthStore } from "../lib/store/auth-store";
import { usePlayerProgression } from "../hooks/use-progression";
import { ContinuePlaying } from "../components/games/continue-playing";

const CATEGORY_ICONS: Record<string, string> = {
  Strategy: "♟️",
  Card: "🃏",
  Racing: "🏎️",
  Board: "🎲",
  Party: "🎉",
};

function FilterChip({
  active,
  onClick,
  icon,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex shrink-0 items-center gap-2 whitespace-nowrap rounded-2xl px-4 py-2.5 text-xs font-bold transition-all duration-300 select-none overflow-hidden",
        active
          ? "bg-gradient-to-r from-[#7C3AED] via-[#9333EA] to-[#C084FC] text-white shadow-[0_0_25px_rgba(124,58,237,0.5)] scale-105 ring-1 ring-white/30"
          : "bg-card/80 text-muted-foreground hover:bg-foreground/10 hover:text-foreground border border-border hover:border-foreground/20 hover:scale-102"
      )}
    >
      {/* Active Sheen */}
      {active && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
      )}
      {icon && <span className="text-sm leading-none transition-transform group-hover:scale-110">{icon}</span>}
      <span className="relative z-10">{children}</span>
      {count !== undefined && (
        <span
          className={cn(
            "relative z-10 rounded-full px-2 py-0.5 text-[10px] font-black transition-colors",
            active ? "bg-white/25 text-white shadow-sm" : "bg-foreground/10 text-muted-foreground group-hover:text-foreground/80"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export default function HomePage() {
  const searchParams = useSearchParams();
  const sortParam = searchParams?.get("sort");

  const { user, initialize } = useAuthStore();
  const { data: progression } = usePlayerProgression(user?.id);

  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);

  React.useEffect(() => {
    void initialize();
  }, [initialize]);

  const categories = React.useMemo(
    () => [...new Set(GAME_CATALOG.map((g) => g.category))],
    []
  );

  // Filter games based on category and sort parameter
  const filteredGames = React.useMemo(() => {
    let list = GAME_CATALOG.filter((game) => {
      if (selectedCategory && game.category !== selectedCategory) return false;
      return true;
    });

    if (sortParam === "popular" || sortParam === "top") {
      list = [...list].sort((a, b) => (isPlayable(b) ? 1 : 0) - (isPlayable(a) ? 1 : 0));
    }
    return list;
  }, [selectedCategory, sortParam]);

  const playableGames = filteredGames.filter(isPlayable);
  const upcomingGames = filteredGames.filter((g) => !isPlayable(g));

  return (
    <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-8 space-y-8">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* ANIMATED CINEMATIC HERO BANNER */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-[#7C3AED]/30 bg-gradient-to-r from-[#170B2C] via-[#0E0C22] to-[#0A0C18] p-6 sm:p-10 shadow-[0_0_50px_rgba(124,58,237,0.15)]">
        {/* Glowing Aurora Blooms */}
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-80 w-80 rounded-full bg-gradient-to-br from-[#7C3AED]/30 to-[#06B6D4]/20 blur-3xl animate-pulse"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-[#EC4899]/15 blur-3xl"
          aria-hidden
        />

        {/* Ambient Top Light Line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#C084FC] to-transparent" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            {/* Live Indicator Badges */}
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex items-center gap-1.5 rounded-full bg-[#7C3AED]/30 border border-[#7C3AED]/50 px-3.5 py-1 text-xs font-bold text-[#D8B4FE] shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-[#C084FC] animate-spin" style={{ animationDuration: '6s' }} />
                <span>Next-Gen Gaming Platform</span>
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                <span>{GAME_CATALOG.filter(isPlayable).length} Games Live · 0ms P2P Sync</span>
              </span>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              {user
                ? `Welcome back, ${(user.displayName ?? "Player").split(" ")[0]}!`
                : "Play Together. Compete Instantly."}
            </h1>
            <p className="max-w-2xl text-sm sm:text-base text-white/70 leading-relaxed">
              Experience instant zero-download gaming. Challenge smart AI bots, connect with friends online, or play on the same Wi-Fi network with 0ms lag.
            </p>

            {/* Quick Feature Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Link href="/lan">
                <span className="flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-950/40 px-3 py-1.5 text-xs font-bold text-cyan-300 hover:bg-cyan-900/60 hover:scale-105 transition-all">
                  <Wifi className="h-3.5 w-3.5" />
                  Same Wi-Fi Direct (Scan QR)
                </span>
              </Link>
              <Link href="/play?game=car-race&mode=vs-ai&level=3">
                <span className="flex items-center gap-1.5 rounded-xl border border-[#EC4899]/30 bg-[#831843]/40 px-3 py-1.5 text-xs font-bold text-[#F9A8D4] hover:bg-[#9D174D]/60 hover:scale-105 transition-all">
                  <Zap className="h-3.5 w-3.5" />
                  3D Apex GT Racing
                </span>
              </Link>
              <Link href="/play?game=uno-no-mercy&mode=vs-ai&level=3">
                <span className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-950/40 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-900/60 hover:scale-105 transition-all">
                  <Flame className="h-3.5 w-3.5" />
                  UNO No Mercy (Draw 10)
                </span>
              </Link>
            </div>
          </div>

          {/* Quick Play CTA */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <Link href="/lan?scan=true">
              <Button
                size="lg"
                variant="outline"
                className="gap-2 border-cyan-500/40 bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 font-bold py-6 px-5 rounded-2xl backdrop-blur-md shadow-[0_0_20px_rgba(6,182,212,0.2)]"
              >
                <Camera className="h-5 w-5 text-cyan-400" />
                <span>Scan QR</span>
              </Button>
            </Link>
            <Link href="/rooms">
              <Button
                size="lg"
                variant="outline"
                className="gap-2 border-white/20 bg-white/5 hover:bg-white/10 text-white font-bold py-6 px-6 rounded-2xl backdrop-blur-md"
              >
                <Swords className="h-5 w-5" />
                <span>Join Rooms</span>
              </Button>
            </Link>
            <Link href="/games/chess">
              <Button
                size="lg"
                className="gap-2.5 bg-gradient-to-r from-[#7C3AED] via-[#9333EA] to-[#C084FC] hover:opacity-90 text-white font-black py-6 px-8 rounded-2xl shadow-[0_0_30px_rgba(124,58,237,0.5)] transition-all hover:scale-105"
              >
                <Play className="h-5 w-5 fill-current" />
                <span>Play Now</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* JUMP BACK IN — renders nothing on a first visit */}
      {/* ───────────────────────────────────────────────────────────── */}
      <ContinuePlaying />

      {/* ───────────────────────────────────────────────────────────── */}
      {/* CATEGORY FILTER CHIPS (Swipeable on Mobile) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap scrollbar-none">
        <FilterChip
          active={selectedCategory === null}
          onClick={() => setSelectedCategory(null)}
          icon={<LayoutGrid className="h-4 w-4" />}
          count={GAME_CATALOG.length}
        >
          All Games
        </FilterChip>
        {categories.map((cat) => {
          const count = GAME_CATALOG.filter((g) => g.category === cat).length;
          return (
            <FilterChip
              key={cat}
              active={selectedCategory === cat}
              onClick={() => setSelectedCategory(cat)}
              icon={CATEGORY_ICONS[cat] || "🎯"}
              count={count}
            >
              {cat}
            </FilterChip>
          );
        })}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MAIN GAMES GRID + CONTEXT SIDEBAR */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="grid gap-8 xl:grid-cols-[1fr_320px]">
        {/* Games Catalog */}
        <div className="min-w-0">
          {filteredGames.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card/40 py-16 text-center">
              <p className="font-display text-lg font-bold text-foreground">No games in this category</p>
              <p className="mt-1 text-sm text-muted-foreground">Select another category or view all games.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 border-border text-foreground"
                onClick={() => setSelectedCategory(null)}
              >
                Show All Games
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Playable Games */}
              {playableGames.length > 0 && (
                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <h2 className="font-display text-xl font-black text-foreground">
                        {selectedCategory ? `${selectedCategory} Games` : "Featured Games"}
                      </h2>
                      <span className="rounded-full bg-foreground/10 px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
                        {playableGames.length}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {playableGames.map((game) => (
                      <GameTile key={game.id} game={game} size="lg" />
                    ))}
                  </div>
                </section>
              )}

              {/* Upcoming Games */}
              {upcomingGames.length > 0 && (
                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <h2 className="font-display text-lg font-bold text-foreground/80">Coming Soon</h2>
                      <span className="rounded-full bg-foreground/10 px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
                        {upcomingGames.length}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {upcomingGames.map((game) => (
                      <GameTile key={game.id} game={game} size="md" />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {/* Right Sidebar: Progress & Community Feed */}
        <aside className="space-y-6">
          {/* Your Level / XP Card */}
          <Card className="overflow-hidden border-border bg-card/90 backdrop-blur-md p-5 shadow-xl relative group">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#C084FC] to-transparent" />
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-amber-400" />
                Player Status
              </span>
              <span className="rounded-full bg-[#7C3AED]/20 border border-[#7C3AED]/40 px-2 py-0.5 text-[10px] font-bold text-primary-accent dark:text-[#C084FC]">
                Level {progression?.level?.level ?? 1}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-foreground">
                <span>Total XP</span>
                <span className="text-primary-accent dark:text-[#C084FC] font-mono">{progression?.level?.xpIntoLevel ?? 150} / {progression?.level?.xpForNextLevel ?? 500} XP</span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round((progression?.level?.progress ?? 0.3) * 100))}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground pt-1">
                Win matches against players or bots to earn XP and level up!
              </p>
            </div>
          </Card>

          {/* Quick LAN Action Card */}
          <Card className="overflow-hidden border-cyan-500/20 bg-card/90 bg-gradient-to-b from-cyan-500/10 to-transparent p-5 shadow-xl">
            <div className="flex items-center gap-2 mb-2 text-cyan-400 text-xs font-black uppercase tracking-wider">
              <Wifi className="h-4 w-4" />
              <span>Same Wi-Fi Play</span>
            </div>
            <h3 className="font-display text-sm font-bold text-foreground">
              Playing on the same local network?
            </h3>
            <p className="text-xs text-muted-foreground mt-1 mb-3">
              Connect phone to laptop or friends on Wi-Fi with instant QR code scanning.
            </p>
            <Link href="/lan">
              <Button size="sm" className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs gap-1.5 shadow-md">
                <span>Open Wi-Fi Lobby</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </Card>
        </aside>
      </div>
    </div>
  );
}
