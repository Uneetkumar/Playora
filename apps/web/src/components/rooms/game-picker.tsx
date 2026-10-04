"use client";

import * as React from "react";
import Image from "next/image";
import type { GameId } from "@playora/game-types";
import { cn } from "@playora/ui";
import { Check, Users } from "lucide-react";
import { GAME_CATALOG } from "../../lib/games/catalog";
import { gameAccentStyle } from "../../lib/games/meta";
import { gameView } from "../../lib/games/view";
import { capabilitiesFor } from "../../lib/play/modes";
import { coverFor } from "../games/card-logic";

/** Games a room can host: the ones with a server engine behind them. */
export const ROOM_GAME_IDS: readonly GameId[] = GAME_CATALOG.filter((g) => capabilitiesFor(g.id)?.online).map(
  (g) => g.id,
);

/**
 * Pick the game for a new room.
 *
 * Small cards in the catalogue's anatomy (cover, scrim, title, players and
 * genre), but as a radio group rather than links: choosing one selects it
 * here instead of leaving the page, which is all `GameCard` can do. Native
 * radios underneath, so arrow keys move the choice and the group is a single
 * tab stop; the focus ring is drawn on the card.
 */
export function GamePicker({
  value,
  onChange,
  name = "room-game",
  className,
}: {
  value: GameId;
  onChange: (id: GameId) => void;
  name?: string;
  className?: string;
}) {
  // Badges are not shown here, so the clock the view-model reads only has to
  // be stable between server and client; the epoch is.
  const games = React.useMemo(() => ROOM_GAME_IDS.map((id) => gameView(id, { now: 0 })), []);

  return (
    <div role="radiogroup" aria-label="Game" className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5", className)}>
      {games.map((game) => {
        const selected = game.id === value;
        const cover = coverFor(game.covers, "landscape");
        return (
          <label
            key={game.id}
            style={gameAccentStyle(game.id)}
            className={cn(
              "group relative block cursor-pointer overflow-hidden rounded-xl bg-muted shadow-card aspect-[4/3]",
              "transition-[box-shadow,transform] duration-hover ease-out-expo",
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background",
              selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "hover:shadow-card-hover",
            )}
          >
            <input
              type="radio"
              name={name}
              value={game.id}
              checked={selected}
              onChange={() => onChange(game.id)}
              className="sr-only"
            />
            <Image
              src={cover.src}
              alt=""
              fill
              sizes="(min-width: 1024px) 14rem, (min-width: 640px) 30vw, 45vw"
              className={cn(
                "object-cover transition-[filter] duration-hover ease-out-expo",
                !selected && "saturate-[.85] group-hover:saturate-100",
              )}
              style={{ objectPosition: cover.position }}
            />
            {/* As on GameCard: the art's own dark scrim in both themes, with
                light words, deepened behind the title where it is under half
                strength. */}
            <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 scrim-art" />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-art-scrim/75 via-art-scrim/35 to-transparent"
            />
            <span aria-hidden className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-foreground/10" />
            {selected && (
              <span
                aria-hidden
                className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground shadow-raised"
              >
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
            )}
            <span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-2.5 text-halo-art">
              <span className="truncate font-display text-card-title text-art-foreground">{game.name}</span>
              <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-meta text-art-muted-foreground">
                <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="numeric">{game.playersLabel}</span>
                <span aria-hidden>·</span>
                <span className="truncate">{game.genre}</span>
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
