import { Bot, Gamepad2, Globe, Trophy, User, type LucideIcon } from "lucide-react";
import { cn } from "@playora/ui";
import type { PlayModeChip, PlayModeChipId } from "../../lib/play/modes";

/**
 * The ways a game can be played (Online, vs Bot, Local, Solo, Career), from
 * `gameView(id).modes`, which reads the capability table: a chip here is
 * always something that can actually be started.
 *
 * Three densities:
 * - `icons`: the icons alone, for a card's meta row. The labels go to screen
 *   readers as one sentence.
 * - `inline`: icon and word, separated by spacing, for a meta line such as the
 *   hero's.
 * - `chips`: pills, for the detail header or a filter summary.
 */
export const MODE_ICON: Readonly<Record<PlayModeChipId, LucideIcon>> = {
  online: Globe,
  ai: Bot,
  // Two people on one device: the couch, not the network.
  local: Gamepad2,
  solo: User,
  career: Trophy,
};

export type ModeChipsVariant = "icons" | "inline" | "chips";

export function ModeChips({
  modes,
  variant = "chips",
  className,
}: {
  modes: readonly PlayModeChip[];
  variant?: ModeChipsVariant;
  className?: string;
}) {
  if (modes.length === 0) return null;

  if (variant === "icons") {
    return (
      <span className={cn("inline-flex shrink-0 items-center gap-1", className)}>
        {modes.map(({ id }) => {
          const Icon = MODE_ICON[id];
          return <Icon key={id} aria-hidden className="h-3.5 w-3.5" />;
        })}
        <span className="sr-only">{modes.map((m) => m.label).join(", ")}</span>
      </span>
    );
  }

  return (
    <ul
      role="list"
      aria-label="Ways to play"
      className={cn("flex flex-wrap items-center", variant === "chips" ? "gap-1.5" : "gap-x-3 gap-y-1", className)}
    >
      {modes.map(({ id, label }) => {
        const Icon = MODE_ICON[id];
        return (
          <li
            key={id}
            className={cn(
              "inline-flex items-center gap-1.5",
              variant === "chips" &&
                "rounded-full border border-border bg-foreground/[0.06] px-2.5 py-1 text-xs font-semibold text-foreground",
            )}
          >
            <Icon
              aria-hidden
              className={cn("h-3.5 w-3.5 shrink-0", variant === "chips" && "text-muted-foreground")}
            />
            {label}
          </li>
        );
      })}
    </ul>
  );
}
