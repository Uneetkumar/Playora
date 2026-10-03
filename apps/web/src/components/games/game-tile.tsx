"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@playora/ui";
import { Play, Lock, Users, Clock, Zap } from "lucide-react";
import { isPlayable, type CatalogGame } from "../../lib/games/catalog";
import { artFor } from "./game-art";

const GAME_ACCENT: Record<string, { from: string; to: string; glow: string; tag: string }> = {
  chess: { from: "#7C3AED", to: "#4F46E5", glow: "rgba(124,58,237,0.55)", tag: "Strategy" },
  uno: { from: "#EF4444", to: "#DC2626", glow: "rgba(239,68,68,0.55)", tag: "Card Game" },
  "uno-no-mercy": { from: "#F97316", to: "#EA580C", glow: "rgba(249,115,22,0.55)", tag: "Hardcore" },
  "car-race": { from: "#06B6D4", to: "#0284C7", glow: "rgba(6,182,212,0.55)", tag: "Racing" },
  "bike-race": { from: "#10B981", to: "#059669", glow: "rgba(16,185,129,0.55)", tag: "Racing" },
  "rope-rescue": { from: "#8B5CF6", to: "#6D28D9", glow: "rgba(139,92,246,0.55)", tag: "Action" },
  "ant-attack": { from: "#EF4444", to: "#B91C1C", glow: "rgba(239,68,68,0.55)", tag: "Action" },
  "bomb-pass": { from: "#F97316", to: "#C2410C", glow: "rgba(249,115,22,0.55)", tag: "Party" },
  "color-rush": { from: "#EC4899", to: "#BE185D", glow: "rgba(236,72,153,0.55)", tag: "Arcade" },
  "falling-floor": { from: "#F59E0B", to: "#B45309", glow: "rgba(245,158,11,0.55)", tag: "Survival" },
  "pin-puzzle": { from: "#3B82F6", to: "#1D4ED8", glow: "rgba(59,130,246,0.55)", tag: "Puzzle" },
  "target-rush": { from: "#14B8A6", to: "#0F766E", glow: "rgba(20,184,166,0.55)", tag: "Aim" },
  "hot-potato": { from: "#EA580C", to: "#9A3412", glow: "rgba(234,88,12,0.55)", tag: "Party" },
  "bridge-builder": { from: "#6366F1", to: "#4338CA", glow: "rgba(99,102,241,0.55)", tag: "Physics" },
  "ice-breaker": { from: "#06B6D4", to: "#0E7490", glow: "rgba(6,182,212,0.55)", tag: "Arcade" },
  "tic-tac-toe": { from: "#3B82F6", to: "#1D4ED8", glow: "rgba(59,130,246,0.55)", tag: "Classic" },
  "connect-four": { from: "#EAB308", to: "#A16207", glow: "rgba(234,179,8,0.55)", tag: "Strategy" },
  ludo: { from: "#10B981", to: "#047857", glow: "rgba(16,185,129,0.55)", tag: "Board" },
  "snake-ladder": { from: "#8B5CF6", to: "#6D28D9", glow: "rgba(139,92,246,0.55)", tag: "Board" },
  checkers: { from: "#EF4444", to: "#B91C1C", glow: "rgba(239,68,68,0.55)", tag: "Strategy" },
  battleship: { from: "#0284C7", to: "#0369A1", glow: "rgba(2,132,199,0.55)", tag: "Tactics" },
  pong: { from: "#06B6D4", to: "#0891B2", glow: "rgba(6,182,212,0.55)", tag: "Retro" },
  "memory-match": { from: "#EC4899", to: "#BE185D", glow: "rgba(236,72,153,0.55)", tag: "Memory" },
  "game-2048": { from: "#F59E0B", to: "#B45309", glow: "rgba(245,158,11,0.55)", tag: "Puzzle" },
  minesweeper: { from: "#64748B", to: "#334155", glow: "rgba(100,116,139,0.55)", tag: "Logic" },
  "word-guess": { from: "#10B981", to: "#047857", glow: "rgba(16,185,129,0.55)", tag: "Word" },
  "flappy-bird": { from: "#FBBF24", to: "#B45309", glow: "rgba(251,191,36,0.55)", tag: "Arcade" },
  "retro-snake": { from: "#22C55E", to: "#15803D", glow: "rgba(34,197,94,0.55)", tag: "Arcade" },
  "brick-breaker": { from: "#F43F5E", to: "#BE123C", glow: "rgba(244,63,94,0.55)", tag: "Arcade" },
  "whack-a-mole": { from: "#A855F7", to: "#7E22CE", glow: "rgba(168,85,247,0.55)", tag: "Arcade" },
  "simon-says": { from: "#3B82F6", to: "#1D4ED8", glow: "rgba(59,130,246,0.55)", tag: "Memory" },
};

/**
 * Large showcase game card with rich artwork, glowing accent border,
 * player badges, and a play button on hover.
 */
export function GameTile({
  game,
  size = "md",
}: {
  game: CatalogGame;
  size?: "sm" | "md" | "lg";
}) {
  const [imgFailed, setImgFailed] = React.useState(false);
  const playable = isPlayable(game);
  const art = artFor(game.id);
  const accent = GAME_ACCENT[game.id] ?? { from: "#7C3AED", to: "#9333EA", glow: "rgba(124,58,237,0.5)", tag: game.category };

  return (
    <Link
      href={`/games/${game.id}`}
      prefetch={false}
      className="group block w-full"
      aria-label={`${game.name}${playable ? "" : ` — ${game.phase}`}`}
    >
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-2xl border transition-all duration-300",
          "group-hover:-translate-y-1.5 group-hover:border-opacity-100",
          size === "lg" ? "aspect-[16/9]" : "aspect-[4/3]",
          playable
            ? "border-white/15 group-hover:shadow-[0_0_30px_var(--glow)]"
            : "border-white/8"
        )}
        style={
          {
            background: art.background ?? `linear-gradient(135deg, ${accent.from}22, ${accent.to}11)`,
            "--glow": accent.glow,
          } as React.CSSProperties
        }
      >
        {/* ─── Artwork: Photorealistic 3D Image Thumbnail or Vector Fallback ─── */}
        {art.imageUrl && !imgFailed ? (
          <img
            src={art.imageUrl}
            alt={game.name}
            onError={() => setImgFailed(true)}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <art.Art className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.08]" />
        )}

        {/* ─── Dark gradient scrims ─── */}
        <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" aria-hidden />
        <span
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: `radial-gradient(ellipse at 50% 110%, ${accent.from}33 0%, transparent 70%)` }}
          aria-hidden
        />

        {/* ─── Accent glow line at top ─── */}
        {playable && (
          <span
            className="absolute inset-x-0 top-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: `linear-gradient(90deg, transparent, ${accent.from}, transparent)` }}
            aria-hidden
          />
        )}

        {/* ─── Status badge (top-left) ─── */}
        <span className="absolute left-3 top-3 z-10">
          {playable ? (
            <span
              className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-md backdrop-blur-sm"
              style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
            >
              <Zap className="h-2.5 w-2.5 fill-white" aria-hidden />
              {accent.tag}
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-white/10 border border-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/70 backdrop-blur-sm">
              <Lock className="h-2.5 w-2.5" aria-hidden />
              Soon
            </span>
          )}
        </span>

        {/* ─── Hover Play Button (center) ─── */}
        {playable && (
          <span
            className="absolute inset-0 z-10 flex items-center justify-center opacity-0 transition-all duration-300 group-hover:opacity-100"
            aria-hidden
          >
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-transform duration-200 group-hover:scale-110"
              style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`, boxShadow: `0 0 30px ${accent.glow}` }}
            >
              <Play className="ml-1 h-6 w-6 fill-white text-white" />
            </span>
          </span>
        )}

        {/* ─── Bottom info panel (Clean & unblocked) ─── */}
        <span className="absolute inset-x-0 bottom-0 z-10 p-3 sm:p-4">
          <span className="block truncate font-display text-base sm:text-lg font-black text-white drop-shadow-md leading-tight">
            {game.name}
          </span>

          <span className="mt-1 flex items-center gap-3 text-[11px] text-white/75 font-medium drop-shadow-sm">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {game.minPlayers === game.maxPlayers
                ? `${game.minPlayers}p`
                : `${game.minPlayers}–${game.maxPlayers}p`}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {game.duration}
            </span>
          </span>
        </span>
      </div>
    </Link>
  );
}

/** A horizontally scrolling row of tiles, as game platforms lay them out. */
export function GameRow({
  title,
  games,
  href,
  size = "md",
  emptyNote,
  wrap = false,
}: {
  title: string;
  games: CatalogGame[];
  href?: string;
  size?: "sm" | "md" | "lg";
  emptyNote?: string;
  wrap?: boolean;
}) {
  if (games.length === 0 && !emptyNote) return null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-display text-xl font-extrabold text-foreground">{title}</h2>
        {href && (
          <Link href={href} className="text-primary transition-transform hover:translate-x-0.5" aria-label={`See all ${title}`}>
            ›
          </Link>
        )}
      </div>

      {games.length > 0 ? (
        <div
          className={
            wrap
              ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
              : "-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]"
          }
        >
          {games.map((g) => (
            <GameTile key={g.id} game={g} size={size} />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          {emptyNote}
        </p>
      )}
    </section>
  );
}
