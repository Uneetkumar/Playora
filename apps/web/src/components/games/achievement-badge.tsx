"use client";

import * as React from "react";
import { cn } from "@playora/ui";
import type { AchievementDef, AchievementTier } from "@playora/progression";
import {
  Play,
  Trophy,
  Handshake,
  Flame,
  Star,
  TrendingUp,
  Crown,
  Layers,
  Skull,
  Grid3x3,
  Zap,
  Hourglass,
  Shield,
  Lock,
  Award,
  Check,
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

/**
 * Tier colours, on the page-surface tokens: `streak` for bronze and `reward`
 * for gold read in both themes, where the old `warning` made bronze and gold
 * the same amber. `dot` is the solid swatch the achievements summary uses.
 */
export const TIER_STYLES: Record<
  AchievementTier,
  { ring: string; text: string; dot: string; label: string }
> = {
  bronze: {
    ring: "border-streak/30 bg-streak/10",
    text: "text-streak",
    dot: "bg-streak",
    label: "Bronze",
  },
  silver: {
    ring: "border-foreground/20 bg-foreground/[0.06]",
    text: "text-foreground",
    dot: "bg-muted-foreground",
    label: "Silver",
  },
  gold: {
    ring: "border-reward/40 bg-reward/15",
    text: "text-reward",
    dot: "bg-reward",
    label: "Gold",
  },
  platinum: {
    ring: "border-primary/40 bg-primary/15",
    text: "text-primary-accent",
    dot: "bg-primary",
    label: "Platinum",
  },
};

export function AchievementBadge({
  achievement,
  unlocked,
  size = "md",
  unlockedAt,
}: {
  achievement: AchievementDef;
  unlocked: boolean;
  size?: "sm" | "md";
  /** ISO date it was earned, shown under the description when given. */
  unlockedAt?: string;
}) {
  const Icon = ICONS[achievement.icon] ?? Award;
  const tier = TIER_STYLES[achievement.tier];
  // A secret achievement gives nothing away until it is earned; once it is,
  // there is nothing left to spoil.
  const hidden = achievement.secret && !unlocked;

  const box = size === "sm" ? "h-9 w-9 rounded-lg" : "h-12 w-12 rounded-xl";

  return (
    <div
      className={cn(
        "flex h-full items-center gap-3 rounded-xl border p-3",
        unlocked ? "border-border bg-card shadow-card" : "border-dashed border-border bg-card/50",
        size === "md" && "sm:p-4"
      )}
    >
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center border",
          box,
          unlocked ? cn(tier.ring, tier.text) : "border-border bg-muted text-muted-foreground"
        )}
        aria-hidden
      >
        {hidden ? (
          <Lock className="h-4 w-4" />
        ) : (
          <Icon className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
        )}
        {unlocked && size === "md" && (
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-success text-success-foreground ring-2 ring-card">
            <Check className="h-2.5 w-2.5" strokeWidth={3} />
          </span>
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-semibold",
            unlocked ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {hidden ? "Secret achievement" : achievement.name}
        </p>
        <p
          className={cn(
            "text-xs text-muted-foreground",
            size === "sm" ? "truncate" : "line-clamp-2"
          )}
        >
          {hidden ? "Unlocks when you find it." : achievement.description}
        </p>
        {unlockedAt && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Earned {new Date(unlockedAt).toLocaleDateString()}
          </p>
        )}
      </div>

      <span className="flex shrink-0 flex-col items-end gap-0.5 self-start">
        <span
          className={cn(
            "font-mono-num text-sm font-bold",
            unlocked ? tier.text : "text-muted-foreground"
          )}
        >
          {achievement.points}
          <span className="sr-only"> points</span>
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {tier.label}
        </span>
      </span>
      {!unlocked && <span className="sr-only">Locked</span>}
    </div>
  );
}
