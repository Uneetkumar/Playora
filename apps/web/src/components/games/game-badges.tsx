import { Lock } from "lucide-react";
import { Badge, cn } from "@playora/ui";
import type { GameView } from "../../lib/games/view";
import { cardBadge, type CardBadge } from "./card-logic";

/**
 * A game's one catalogue badge (LIVE with its count, NEW, UPDATED, HOT, TOP
 * or SOON), as the card, the hero and the detail header show it.
 *
 * Which badge is never decided here: pass `cardBadge(view)` (or `topBadge`),
 * or the game itself and it is read the same way. The visible label is
 * abbreviated and uppercased, so a screen reader gets the spoken form instead
 * ("live, 1,240 playing"). Inside a card the link's own label already says it;
 * there this is simply skipped, because a link's name replaces its contents.
 */
export function GameBadge({
  badge,
  game,
  className,
  countClassName,
}: {
  badge?: CardBadge | null;
  game?: Pick<GameView, "badge" | "playable" | "onlineCount">;
  className?: string;
  /** On LIVE's count: a narrow card hides it to clear its heart. */
  countClassName?: string;
}) {
  const shown = badge !== undefined ? badge : game ? cardBadge(game) : null;
  if (!shown) return null;

  return (
    <Badge variant={shown.kind} className={cn("shadow-card", className)}>
      {shown.kind === "soon" && <Lock aria-hidden />}
      <span aria-hidden>{shown.label}</span>
      {shown.count && (
        <span aria-hidden className={cn("numeric", countClassName)}>
          {shown.count}
        </span>
      )}
      <span className="sr-only">{shown.spoken}</span>
    </Badge>
  );
}
