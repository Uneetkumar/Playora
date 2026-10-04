"use client";

import * as React from "react";
import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { cn, focusRingClass } from "@playora/ui";
import { useEdgeFade } from "../../hooks/use-edge-fade";
import { GENRE_NAV, NAV } from "../shell/nav";

/**
 * A row of genre shortcuts into Browse: "All games" first, then one chip per
 * genre, from the same `GENRE_NAV` the sidebar lists, so the two can never
 * offer different genres. The counts stay in the sidebar and on Browse; here
 * they would push the last chips off a desktop row.
 *
 * Links, not toggles: on the home page a chip takes you somewhere, and Browse
 * owns the filtering. The row is one line at every width, so it never changes
 * height when the player status appears beside it; where it runs out of room
 * it scrolls sideways, with a fade on the edge that has more behind it.
 */

const chipClassName = cn(
  "group inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-card",
  "transition-colors duration-hover ease-out-expo hover:border-foreground/20 hover:bg-foreground/[0.04]",
  focusRingClass
);

export function GenreChips({ className }: { className?: string }) {
  const scroller = React.useRef<HTMLUListElement>(null);
  const fade = useEdgeFade(scroller);

  return (
    <nav aria-label="Genres" className={cn("min-w-0", className)}>
      <ul
        ref={scroller}
        role="list"
        style={fade}
        // The padding is room for the focus ring, which a scroller clips;
        // the negative margin keeps the chips on the page's left edge.
        className="scrollbar-none -m-1 flex gap-2 overflow-x-auto p-1"
      >
        <li>
          <Link href={NAV.browse.href} className={chipClassName}>
            <LayoutGrid aria-hidden className="h-4 w-4 text-primary-accent" />
            All games
          </Link>
        </li>
        {GENRE_NAV.map(({ id, href, label, icon: Icon }) => (
          <li key={id}>
            <Link href={href} className={chipClassName}>
              <Icon
                aria-hidden
                className="h-4 w-4 text-muted-foreground transition-colors duration-hover ease-out-expo group-hover:text-primary-accent"
              />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
