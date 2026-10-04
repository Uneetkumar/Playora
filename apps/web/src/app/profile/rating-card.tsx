import * as React from "react";
import { ratingToNextRank } from "@playora/progression";
import { Card } from "@playora/ui";
import { Gamepad2 } from "lucide-react";
import type { GameRating } from "../../hooks/use-progression";
import { isGameId } from "../../lib/games/catalog";
import { ProgressBar } from "../../components/page/stat";
import { RankBadge } from "../../components/progression/rank-badge";
import { GameThumb } from "../../components/shell/game-thumb";

/** One game's rating: tier, number, peak, and the way to the next tier. */
export function RatingCard({ rating }: { rating: GameRating }) {
  const next = ratingToNextRank(rating.rating);
  // Progress through the current tier, so the bar fills towards the next one.
  const span = next ? next.tier.minRating - rating.rank.minRating : 1;
  const into = next ? (rating.rating - rating.rank.minRating) / span : 1;

  return (
    <Card className="h-full p-5">
      <div className="flex items-start gap-3">
        {isGameId(rating.gameSlug) ? (
          <GameThumb id={rating.gameSlug} sizes="40px" className="h-10 w-10 rounded-lg" />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Gamepad2 className="h-5 w-5" aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base font-bold text-foreground">
            {rating.gameName}
          </h3>
          <RankBadge tier={rating.rank} size="sm" className="mt-1" />
        </div>
        <div className="text-right">
          <div className="font-mono-num text-2xl font-bold leading-none text-foreground">
            {rating.rating}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Peak <span className="font-mono-num">{rating.peakRating}</span>
          </div>
        </div>
      </div>

      <ProgressBar
        value={into}
        label={next ? `Progress to ${next.tier.label}` : "Top tier reached"}
        size="sm"
        className="mt-4"
      />
      <p className="mt-2 text-xs text-muted-foreground">
        {next ? (
          <>
            <span className="font-mono-num font-bold text-foreground">{next.needed}</span> to{" "}
            {next.tier.label}
          </>
        ) : (
          "Top tier"
        )}
      </p>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        {(
          [
            ["Won", rating.wins],
            ["Lost", rating.losses],
            ["Drawn", rating.draws],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-lg bg-muted px-2 py-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </dt>
            <dd className="numeric text-base font-bold text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
