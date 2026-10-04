"use client";

import * as React from "react";
import type { GameId } from "@playora/game-types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn } from "@playora/ui";
import { LayoutGrid } from "lucide-react";
import { getCatalogGame } from "../../lib/games/catalog";
import { GameThumb } from "../shell/game-thumb";

/** The value an "every game" option carries; a GameId can never be this. */
export const ALL_GAMES = "all";

/**
 * Pick one game, each shown with its cover thumbnail.
 *
 * The leaderboard used to draw a chip per game, thirty-one of them wrapping
 * over five lines on a phone before the board itself began, and most led to
 * boards that can never fill. A select is one line however many games there
 * are, and its list is type-ahead searchable.
 */
export function GameSelect({
  games,
  value,
  onValueChange,
  allLabel,
  label,
  className,
}: {
  games: readonly GameId[];
  value: GameId | typeof ALL_GAMES;
  onValueChange: (value: GameId | typeof ALL_GAMES) => void;
  /** Offer an "every game" option with this label. */
  allLabel?: string;
  /** Accessible name for the trigger. */
  label: string;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onValueChange(v as GameId | typeof ALL_GAMES)}>
      <SelectTrigger aria-label={label} className={cn("h-11 w-full sm:w-72", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {allLabel && (
          <SelectItem value={ALL_GAMES}>
            <span className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
              </span>
              {allLabel}
            </span>
          </SelectItem>
        )}
        {games.map((id) => (
          <SelectItem key={id} value={id}>
            <span className="flex items-center gap-2.5">
              <GameThumb id={id} sizes="24px" className="h-6 w-6 rounded-md" />
              {getCatalogGame(id)?.name ?? id}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
