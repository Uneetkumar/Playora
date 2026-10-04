import * as React from "react";
import type { RankTier } from "@playora/progression";
import { cn } from "@playora/ui";
import { Crown, Gem, Medal, Shield, type LucideIcon } from "lucide-react";

/**
 * How each rating tier looks.
 *
 * `RankTier.color` in @playora/progression names a token loosely ("cyan",
 * "pink") and two tiers shared one, so Bronze and Gold were the same amber
 * chip. This is the one mapping from tier to classes, on the reward / streak
 * / primary tokens that read in both themes. The tier is always written out
 * as well: rank is never told by colour alone.
 */
const TIER_STYLE: Record<string, { chip: string; icon: LucideIcon }> = {
  bronze: { chip: "border-streak/30 bg-streak/10 text-streak", icon: Shield },
  silver: { chip: "border-foreground/20 bg-foreground/[0.06] text-foreground", icon: Shield },
  gold: { chip: "border-reward/40 bg-reward/15 text-reward", icon: Medal },
  platinum: { chip: "border-secondary/30 bg-secondary/15 text-secondary", icon: Medal },
  diamond: { chip: "border-primary/30 bg-primary/15 text-primary-accent", icon: Gem },
  master: { chip: "border-transparent bg-primary text-primary-foreground", icon: Crown },
  grandmaster: { chip: "border-transparent bg-badge-top text-badge-foreground", icon: Crown },
};

const FALLBACK = { chip: "border-border bg-muted text-foreground", icon: Shield };

export function tierStyle(tier: Pick<RankTier, "id">) {
  return TIER_STYLE[tier.id] ?? FALLBACK;
}

export function RankBadge({
  tier,
  size = "md",
  className,
}: {
  tier: Pick<RankTier, "id" | "label">;
  size?: "sm" | "md";
  className?: string;
}) {
  const style = tierStyle(tier);
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border font-semibold",
        size === "sm" ? "px-2 py-0.5 text-[11px] leading-4" : "px-2.5 py-0.5 text-xs leading-5",
        style.chip,
        className
      )}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
      {tier.label}
    </span>
  );
}
