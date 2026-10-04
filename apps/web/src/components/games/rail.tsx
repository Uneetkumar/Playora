"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, SectionHeader, cn } from "@playora/ui";
import { useReducedMotionPref } from "../../lib/motion";
import { GameCardSkeleton } from "./game-card";
import { railKeyTarget, type GameCardVariant } from "./card-logic";

/**
 * A titled, horizontally scrolling row: the shape every browse shelf takes
 * (Continue playing, Trending, one per genre).
 *
 * The row is native overflow scrolling with CSS scroll-snap, not a carousel
 * library: touch, trackpad and wheel already work, and the browser keeps
 * focus and scroll in step. On top of that it adds:
 * - prev/next buttons from md up, each moving about one viewport of cards;
 * - arrow keys, Home and End to move focus between cards (Tab still visits
 *   each one in order, and either way the focused card is scrolled fully
 *   into view);
 * - a fade on whichever edge has more cards behind it;
 * - a skeleton row while loading, and an `empty` slot for when there is
 *   nothing to show. With no `empty`, an empty rail renders nothing, so a
 *   page never shows a heading over a gap.
 *
 * Children are the items, each placed in a `shrink-0` cell that snaps to the
 * start. A `GameCard` with `layout="rail"` brings its own fixed width.
 */

export interface RailProps {
  title: React.ReactNode;
  /** `title` as plain text, for button labels, when `title` is not a string. */
  label?: string;
  description?: React.ReactNode;
  /** Shown beside the title, e.g. how many games a "See all" leads to. */
  count?: number;
  /** A small lucide icon before the title. */
  icon?: React.ReactNode;
  seeAllHref?: string;
  loading?: boolean;
  /** The skeleton row's card shape and length. */
  skeleton?: { variant?: GameCardVariant; count?: number };
  /** Rendered under the header when there are no items and nothing is loading. */
  empty?: React.ReactNode;
  /**
   * Let the row run to the page edges, under the standard gutters
   * (`px-4 sm:px-6 lg:px-8`), so cards slide off-screen instead of being
   * clipped at the content column.
   */
  bleed?: boolean;
  /** Heading level; a rail under a page's h1 is an h2. */
  as?: "h2" | "h3";
  className?: string;
  children?: React.ReactNode;
}

/** How far the fade reaches into the row on an edge that has more behind it. */
const FADE = "48px";

export function Rail({
  title,
  label,
  description,
  count,
  icon,
  seeAllHref,
  loading = false,
  skeleton,
  empty,
  bleed = false,
  as = "h2",
  className,
  children,
}: RailProps) {
  const headingId = React.useId();
  const listId = React.useId();
  const scrollerRef = React.useRef<HTMLUListElement>(null);
  const reduced = useReducedMotionPref();
  const items = React.Children.toArray(children);
  const hasRow = loading || items.length > 0;
  const name = label ?? (typeof title === "string" ? title : "this row");

  // Which ends the row is scrolled to. Both true until measured, so a server
  // render shows no fades and disabled arrows rather than guessing.
  const [edges, setEdges] = React.useState({ start: true, end: true });

  const measure = React.useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const next = { start: el.scrollLeft <= 1, end: el.scrollLeft >= max - 1 };
    setEdges((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
  }, []);

  React.useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [measure, hasRow, items.length]);

  const page = (direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    // A little under a full width, so the card cut off at the edge is the
    // first one fully shown after the move, and snap settles the rest.
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: reduced ? "auto" : "smooth" });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const item = (event.target as HTMLElement).closest<HTMLElement>("[data-rail-item]");
    if (!item || item.parentElement !== event.currentTarget) return;
    const cells = Array.from(event.currentTarget.children) as HTMLElement[];
    const next = railKeyTarget(event.key, cells.indexOf(item), cells.length);
    if (next === null) return;
    event.preventDefault();
    const cell = cells[next];
    if (!cell || cell === item) return;
    // The cell's first link or button: the card itself, not its heart.
    cell.querySelector<HTMLElement>("a[href], button:not([disabled])")?.focus({ preventScroll: true });
    cell.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest", inline: "nearest" });
  };

  // Tab moves focus along the row too, and the browser does not scroll a
  // card that is only partly in view: the fourth card at 1440 was left half
  // off the edge, its ring under the fade. Keyboard focus only, so a click on
  // a half-shown card's heart does not slide the row under the pointer.
  const onFocus = (event: React.FocusEvent<HTMLUListElement>) => {
    const target = event.target as HTMLElement;
    if (!target.matches(":focus-visible")) return;
    target
      .closest<HTMLElement>("[data-rail-item]")
      ?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest", inline: "nearest" });
  };

  if (!hasRow && !empty) return null;

  const overflowing = !(edges.start && edges.end);
  // Only the alpha of a mask counts; the colour words are not painted.
  const mask = overflowing
    ? `linear-gradient(to right, transparent 0, black ${edges.start ? "0px" : FADE}, black calc(100% - ${edges.end ? "0px" : FADE}), transparent 100%)`
    : undefined;

  return (
    <section aria-labelledby={headingId} aria-busy={loading || undefined} className={className}>
      <SectionHeader
        as={as}
        headingId={headingId}
        icon={icon}
        description={description}
        title={
          <>
            {title}
            {/* Drawn as a bare number, read as words: without the separator
                the heading (and the section it names) was "Racing2". */}
            {typeof count === "number" && (
              <>
                <span
                  aria-hidden
                  className="numeric ml-2 rounded-full bg-foreground/[0.08] px-2 py-0.5 align-middle text-xs font-bold text-muted-foreground"
                >
                  {count}
                </span>
                <span className="sr-only">{`, ${count} ${count === 1 ? "game" : "games"}`}</span>
              </>
            )}
          </>
        }
        action={
          <>
            {seeAllHref && (
              // A 40px target on a phone; the compact size from `sm`.
              <Button
                asChild
                variant="ghost"
                className="text-muted-foreground hover:text-foreground sm:h-8 sm:rounded-md sm:px-3 sm:text-xs"
              >
                <Link href={seeAllHref}>
                  See all<span className="sr-only"> {name}</span>
                  <ChevronRight aria-hidden className="h-4 w-4" />
                </Link>
              </Button>
            )}
            {hasRow && overflowing && (
              <span className="hidden items-center gap-1.5 md:flex">
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="rounded-full"
                  aria-controls={listId}
                  aria-label={`Scroll ${name} back`}
                  disabled={edges.start}
                  onClick={() => page(-1)}
                >
                  <ChevronLeft aria-hidden className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="rounded-full"
                  aria-controls={listId}
                  aria-label={`Scroll ${name} forward`}
                  disabled={edges.end}
                  onClick={() => page(1)}
                >
                  <ChevronRight aria-hidden className="h-4 w-4" />
                </Button>
              </span>
            )}
          </>
        }
      />

      {hasRow ? (
        <ul
          ref={scrollerRef}
          id={listId}
          role="list"
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          style={{ maskImage: mask, WebkitMaskImage: mask }}
          className={cn(
            "scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain lg:gap-4",
            // Room above and below for the hover lift, ring and glow, which a
            // scroller would otherwise clip; the bottom is pulled back so the
            // page's spacing is unchanged.
            "-mb-6 pb-6 pt-4",
            bleed
              ? "-mx-4 scroll-px-4 px-4 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:-mx-8 lg:scroll-px-8 lg:px-8"
              : "-mx-2 scroll-px-2 px-2",
          )}
        >
          {loading
            ? Array.from({ length: skeleton?.count ?? 6 }, (_, i) => (
                <li key={i} className="shrink-0">
                  <GameCardSkeleton variant={skeleton?.variant ?? "landscape"} layout="rail" />
                </li>
              ))
            : items.map((child, i) => (
                <li
                  key={React.isValidElement(child) && child.key !== null ? child.key : i}
                  data-rail-item=""
                  className="shrink-0 snap-start"
                >
                  {child}
                </li>
              ))}
        </ul>
      ) : (
        <div className="pt-4">{empty}</div>
      )}
    </section>
  );
}
