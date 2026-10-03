"use client";

import * as React from "react";
import { cn } from "@playora/ui";
import type { AchievementDef, AchievementTier } from "@playora/progression";
import {
  Play, Trophy, Handshake, Flame, Star, TrendingUp, Crown, Layers, Skull,
  Grid3x3, Zap, Hourglass, Shield, Lock, Award,
} from "lucide-react";

/**
 * Maps the catalogue's icon names to components.
 *
 * The mapping lives here rather than in the catalogue so `@playora/progression`
 * stays free of React — it also runs inside the Worker, where a lucide import
 * would be dead weight in the bundle.
 */
const ICONS: Record<string, typeof Award> = {
  play: Play,
  trophy: Trophy,
  handshake: Handshake,
  flame: Flame,
  star: Star,
  "trending-up": TrendingUp,
  crown: Crown,
  layers: Layers,
  skull: Skull,
  grid: Grid3x3,
  zap: Zap,
  hourglass: Hourglass,
  shield: Shield,
};

export const TIER_STYLES: Record<AchievementTier, { ring: string; text: string; label: string }> = {
  bronze: { ring: "border-warning/40 bg-warning/10", text: "text-warning", label: "Bronze" },
  silver: { ring: "border-muted-foreground/40 bg-muted", text: "text-foreground", label: "Silver" },
  gold: { ring: "border-warning/60 bg-warning/20", text: "text-warning", label: "Gold" },
  platinum: { ring: "border-primary/50 bg-primary/15", text: "text-primary", label: "Platinum" },
};

export function AchievementBadge({
  achievement,
  unlocked,
  size = "md",
}: {
  achievement: AchievementDef;
  unlocked: boolean;
  size?: "sm" | "md";
}) {
  const Icon = ICONS[achievement.icon] ?? Award;
  const tier = TIER_STYLES[achievement.tier];
  // A secret achievement gives nothing away until it is earned; once it is,
  // there is nothing left to spoil.
  const hidden = achievement.secret && !unlocked;

  const box = size === "sm" ? "h-9 w-9" : "h-12 w-12";

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3",
        unlocked ? "border-border bg-card" : "border-dashed border-border/60 bg-card/40",
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg border",
          box,
          unlocked ? tier.ring : "border-border/60 bg-muted/40",
          unlocked ? tier.text : "text-muted-foreground",
        )}
        aria-hidden
      >
        {hidden ? <Lock className="h-4 w-4" /> : <Icon className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />}
      </span>

      <div className="min-w-0">
        <p
          className={cn(
            "truncate text-sm font-semibold",
            unlocked ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {hidden ? "Secret achievement" : achievement.name}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {hidden ? "Unlocks when you find it." : achievement.description}
        </p>
      </div>

      <span
        className={cn(
          "numeric ml-auto shrink-0 text-xs font-bold",
          unlocked ? tier.text : "text-muted-foreground",
        )}
      >
        {achievement.points}
      </span>
    </div>
  );
}
