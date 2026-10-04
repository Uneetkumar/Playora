"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutGrid, Shuffle } from "lucide-react";
import { Button, cn } from "@playora/ui";
import { GAME_CATALOG, isPlayable } from "../../lib/games/catalog";
import { NAV } from "../shell/nav";
import { detailHref } from "../games/card-logic";

/**
 * The end of the home page: one line for someone who scrolled past every
 * shelf without picking, and two ways forward. "Surprise me" is chosen on
 * click rather than at render, so the server and the browser never disagree
 * about which game it is.
 */

const PLAYABLE = GAME_CATALOG.filter(isPlayable);

export function HomeCta({ className }: { className?: string }) {
  const router = useRouter();
  const headingId = React.useId();

  const surprise = () => {
    const game = PLAYABLE[Math.floor(Math.random() * PLAYABLE.length)];
    if (game) router.push(detailHref(game.id));
  };

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "relative isolate overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6 lg:p-8",
        className
      )}
    >
      {/* A faint brand wash from one corner, the same family as the page's
          own background, so the panel reads as an ending, not another card. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-primary/15 via-transparent to-transparent"
      />
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <h2 id={headingId} className="text-balance font-display text-h2 text-foreground">
            Still deciding?
          </h2>
          <p className="mt-1.5 text-muted-foreground">
            {PLAYABLE.length} games, all free in your browser. Browse them all, or let us pick one
            for you.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <Button asChild size="lg">
            <Link href={NAV.browse.href}>
              <LayoutGrid aria-hidden className="h-5 w-5" />
              Browse all games
            </Link>
          </Button>
          <Button variant="outline" size="lg" onClick={surprise}>
            <Shuffle aria-hidden className="h-5 w-5" />
            Surprise me
          </Button>
        </div>
      </div>
    </section>
  );
}
