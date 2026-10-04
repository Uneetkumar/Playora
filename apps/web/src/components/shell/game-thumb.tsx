import Image from "next/image";
import type { GameId } from "@playora/game-types";
import { cn } from "@playora/ui";
import { GAME_META } from "../../lib/games/meta";

/**
 * A game's cover at icon size, for lists where the name sits beside it: the
 * sidebar library, the command palette, the quick-play picker. Decorative
 * (`alt=""`) for that reason; the row's text is what a screen reader reads.
 *
 * Square crop where the game has one, otherwise the landscape cover cropped
 * to fit. The caller sets the size and radius; `sizes` should match the
 * rendered width so the optimiser sends a thumbnail, not the hero.
 */
export function GameThumb({
  id,
  sizes,
  className,
}: {
  id: GameId;
  /** The `sizes` attribute, e.g. "32px". */
  sizes: string;
  className?: string;
}) {
  const covers = GAME_META[id].covers;
  return (
    <span className={cn("relative block shrink-0 overflow-hidden bg-muted", className)}>
      <Image src={covers.square ?? covers.landscape} alt="" fill sizes={sizes} className="object-cover" />
    </span>
  );
}
