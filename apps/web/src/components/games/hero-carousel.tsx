"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, Info, Pause, Play, Users } from "lucide-react";
import { readReducedMotionPref } from "@playora/animation";
import {
  Button,
  Carousel,
  CarouselContent,
  CarouselDots,
  CarouselItem,
  cn,
  focusRingClass,
  useCarousel,
} from "@playora/ui";
import type { GameView } from "../../lib/games/view";
import { gameAccentStyle } from "../../lib/games/meta";
import { useFavorites, type FavoritesResult } from "../../hooks/use-favorites";
import { useRecentlyPlayed } from "../../hooks/use-recently-played";
import { useReducedMotionPref } from "../../lib/motion";
import { GameBadge } from "./game-badges";
import { ModeChips } from "./mode-chips";
import { HERO_ADVANCE_MS, detailHref, playTarget } from "./card-logic";

/**
 * The featured games, one at a time, full bleed: the first thing on the home
 * page.
 *
 * Desktop is a 21:9 stage with a list of every slide beside it; the current
 * one carries a fill that runs for `HERO_ADVANCE_MS` and then moves on. On a
 * phone the stage is 4:5 with the words at the bottom and dots below.
 *
 * Auto-advance stops while the pointer is over the hero, while keyboard focus
 * is in it, while the tab is hidden, and while the pause button is pressed
 * (WCAG 2.2.2 wants a control, not just hover). Under reduced motion it never
 * starts, and the pause button is not shown because there is nothing to pause.
 *
 * The timer is the progress fill itself, a Web Animation: pausing the one
 * pauses the other, so the bar can never disagree with when the slide changes.
 * It is a Web Animation rather than a CSS one because the global
 * reduced-motion rules squeeze CSS animations to 0.01ms, which for a timer
 * means firing at once, on every slide, forever.
 *
 * Slides that are not showing are `inert`, so Tab never lands on a Play button
 * the player cannot see.
 */

export type FavoriteSource = Pick<FavoritesResult, "isFavorite" | "toggle" | "unavailable">;

export interface HeroCarouselProps {
  /** The slides, in order: `featuredGames({ now })`. */
  games: GameView[];
  /** The favourites list, when the page already has it. Defaults to `useFavorites()`. */
  favorites?: FavoriteSource;
  className?: string;
}

export function HeroCarousel({ games, favorites, className }: HeroCarouselProps) {
  const ownFavorites = useFavorites();
  const source = favorites ?? ownFavorites;
  const reduced = useReducedMotionPref();
  const autoplay = !reduced && games.length > 1;

  const [hovered, setHovered] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [tabHidden, setTabHidden] = React.useState(false);
  const [userPaused, setUserPaused] = React.useState(false);
  const paused = hovered || focused || tabHidden || userPaused;

  React.useEffect(() => {
    const sync = () => setTabHidden(document.hidden);
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  if (games.length === 0) return null;

  return (
    <Carousel
      aria-label="Featured games"
      opts={{ loop: games.length > 1 }}
      className={cn("grid gap-3 lg:grid-cols-[minmax(0,1fr)_17rem] xl:grid-cols-[minmax(0,1fr)_19rem]", className)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={(event) => {
        // Keyboard focus only. A mouse click on a thumbnail leaves focus on
        // it, and pausing for that would stop the rotation until the player
        // happened to click somewhere else.
        if ((event.target as HTMLElement).matches(":focus-visible")) setFocused(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <HeroStage
        games={games}
        favorites={source}
        autoplay={autoplay}
        paused={paused}
        userPaused={userPaused}
        onTogglePause={() => setUserPaused((p) => !p)}
      />
    </Carousel>
  );
}

function HeroStage({
  games,
  favorites,
  autoplay,
  paused,
  userPaused,
  onTogglePause,
}: {
  games: GameView[];
  favorites: FavoriteSource;
  autoplay: boolean;
  paused: boolean;
  userPaused: boolean;
  onTogglePause: () => void;
}) {
  const { selectedIndex, scrollNext, scrollTo } = useCarousel();
  const { record } = useRecentlyPlayed();
  const fills = React.useRef<(HTMLSpanElement | null)[]>([]);
  const timer = React.useRef<Animation | null>(null);
  const frame = React.useRef<HTMLDivElement>(null);

  /*
   * Arrow keys change the slide from anywhere in the hero, including from the
   * Play button of the slide that is leaving. That slide turns inert in this
   * commit, and the browser would then drop focus to <body>. Before it gets
   * the chance, hand focus to the same control on the slide arriving.
   * `preventScroll`, because Embla positions slides with transforms and a
   * focus scroll would shift its viewport under it.
   */
  React.useLayoutEffect(() => {
    const active = document.activeElement as HTMLElement | null;
    const action = active?.dataset.heroAction;
    if (!action || !frame.current?.contains(active) || !active?.closest("[inert]")) return;
    const slides = frame.current.querySelectorAll<HTMLElement>('[aria-roledescription="slide"]');
    slides[selectedIndex]?.querySelector<HTMLElement>(`[data-hero-action="${action}"]`)?.focus({ preventScroll: true });
  }, [selectedIndex]);

  // One run of the fill per slide shown. Declared before the pause effect
  // below so a new run exists by the time that effect decides its state.
  React.useEffect(() => {
    if (!autoplay) return;
    const fill = fills.current[selectedIndex];
    if (!fill || typeof fill.animate !== "function") return;
    const run = fill.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
      duration: HERO_ADVANCE_MS,
      easing: "linear",
      fill: "forwards",
    });
    run.onfinish = () => {
      // Asked fresh: the preference can change between renders.
      if (!readReducedMotionPref()) scrollNext();
    };
    timer.current = run;
    return () => {
      run.onfinish = null;
      run.cancel();
      timer.current = null;
    };
  }, [autoplay, selectedIndex, scrollNext]);

  React.useEffect(() => {
    const run = timer.current;
    if (!run) return;
    if (paused) run.pause();
    else if (run.playState === "paused") run.play();
  }, [paused, selectedIndex, autoplay]);

  return (
    <>
      <div ref={frame} className="relative overflow-hidden rounded-3xl bg-card shadow-card">
        <CarouselContent
          viewportClassName="h-full"
          className="ml-0 aspect-[4/5] sm:ml-0 sm:aspect-video sm:min-h-[22rem] lg:aspect-[21/9] lg:max-h-[560px] lg:min-h-[420px]"
        >
          {games.map((game, i) => (
            <HeroSlide
              key={game.id}
              game={game}
              index={i}
              count={games.length}
              active={i === selectedIndex}
              favorites={favorites}
              onPlay={() => record(game.id)}
            />
          ))}
        </CarouselContent>

        {/* An inner edge, so the frame still reads as one on a phone, where
            the slide's lower half is the page colour. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 rounded-3xl ring-1 ring-inset ring-foreground/10"
        />

        {autoplay && (
          <Button
            variant="secondary"
            size="icon"
            // A 40px target on a phone; the compact 32px from `sm`.
            className="absolute right-3 top-3 z-20 rounded-full sm:h-8 sm:w-8 lg:bottom-4 lg:right-4 lg:top-auto"
            aria-pressed={userPaused}
            aria-label="Pause featured games"
            onClick={onTogglePause}
          >
            {userPaused ? <Play aria-hidden className="h-4 w-4" /> : <Pause aria-hidden className="h-4 w-4" />}
          </Button>
        )}
      </div>

      <ol aria-label="Choose a featured game" className="hidden min-h-0 flex-col gap-1.5 lg:flex">
        {games.map((game, i) => {
          const active = i === selectedIndex;
          return (
            <li key={game.id} className="flex min-h-0 flex-1">
              <button
                type="button"
                onClick={() => scrollTo(i)}
                aria-current={active || undefined}
                aria-label={`Show ${game.name}`}
                style={gameAccentStyle(game.id)}
                className={cn(
                  "relative flex min-h-0 w-full items-center gap-3 overflow-hidden rounded-xl p-2 text-left",
                  "transition-colors duration-hover ease-out-expo",
                  focusRingClass,
                  active ? "bg-card shadow-card" : "hover:bg-foreground/[0.06]",
                )}
              >
                <span className="relative aspect-video h-full max-h-16 shrink-0 overflow-hidden rounded-md bg-muted">
                  <Image src={game.covers.landscape} alt="" fill sizes="112px" className="object-cover" />
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block truncate text-sm font-semibold",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {game.name}
                  </span>
                  <span className="block truncate text-meta text-muted-foreground">
                    {game.genre} · {game.playersLabel}
                  </span>
                </span>
                {/* The timer's track and fill. The fill rests at zero; only
                    the current slide's runs. */}
                <span aria-hidden className={cn("absolute inset-x-2 bottom-0 h-0.5 rounded-full", active && "bg-foreground/10")}>
                  <span
                    ref={(el) => {
                      fills.current[i] = el;
                    }}
                    className={cn(
                      "block h-full origin-left scale-x-0 rounded-full bg-game-accent",
                      !autoplay && active && "scale-x-100",
                    )}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* The dots' 40px targets overhang the grid gap, so the dots
          themselves still sit close under the frame. */}
      <CarouselDots className="-my-2.5 lg:hidden" />
    </>
  );
}

function HeroSlide({
  game,
  index,
  count,
  active,
  favorites,
  onPlay,
}: {
  game: GameView;
  index: number;
  count: number;
  active: boolean;
  favorites: FavoriteSource;
  onPlay: () => void;
}) {
  const target = playTarget(game);
  const favourite = favorites.isFavorite(game.id);

  return (
    <CarouselItem
      // On a phone the art fills the top of the slide and fades into the page
      // colour, and the words sit below it on that colour: over a 4:5 crop,
      // a scrim strong enough for the tagline would black out the subject.
      className="relative bg-background pl-0 sm:bg-transparent sm:pl-0"
      aria-label={`${index + 1} of ${count}: ${game.name}`}
      aria-hidden={!active || undefined}
      inert={!active}
      style={gameAccentStyle(game.id)}
    >
      <div className="absolute inset-x-0 top-0 h-[62%] sm:inset-0 sm:h-auto">
        {/* The first slide is the page's largest paint, so it loads first; the
            rest load eagerly too, because a lazy image off to the side of an
            overflow-hidden track is not "near the viewport" and would arrive
            blank as it slides in.
            A fetch priority rather than `priority`, and inside a <picture>:
            React's server render preloads the first eager <img> it meets in
            an HTTP Link header, with the srcset's commas escaped as %2C, which
            the browser cannot read, so it fetched the 3840w fallback `src` on
            every screen. React does not preload an <img> inside <picture>; the
            browser still finds it in the HTML at once, and picks one width. */}
        <picture className="absolute inset-0">
          <Image
            src={game.covers.landscape}
            alt=""
            fill
            loading="eager"
            fetchPriority={index === 0 ? "high" : undefined}
            sizes="(min-width: 1280px) 70vw, (min-width: 1024px) 75vw, 100vw"
            className="object-cover object-[50%_40%]"
          />
        </picture>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background to-transparent sm:hidden"
        />
      </div>
      <span aria-hidden className="pointer-events-none absolute inset-0 hidden scrim-left sm:block" />
      <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-1/3 scrim-bottom opacity-60 sm:block" />

      <div className="relative z-10 flex h-full flex-col justify-end gap-2.5 p-5 sm:w-[62%] sm:justify-center sm:gap-3 sm:p-10 lg:w-[56%] lg:p-12">
        <GameBadge game={game} className="self-start" />
        <h2 className="text-balance font-display text-display text-foreground">{game.name}</h2>
        {/* Full ink from `sm`, where the words sit on the art behind the
            scrim rather than on the page: muted grey on light theme's haze
            measured near 3.3:1 for the tagline, and under 3:1 for the meta
            line where it runs out over the art. Size alone ranks them. */}
        <p className="line-clamp-2 max-w-md text-base text-muted-foreground sm:text-lg sm:text-foreground">
          {game.heroTagline}
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-muted-foreground sm:text-foreground">
          <span>{game.genre}</span>
          <span aria-hidden className="text-subtle">
            ·
          </span>
          <span className="numeric inline-flex items-center gap-1">
            <Users aria-hidden className="h-3.5 w-3.5" />
            {game.playersLabel}
          </span>
          {/* Two lines on a phone; the detail page lists them anyway. */}
          <span aria-hidden className="hidden text-subtle sm:inline">
            ·
          </span>
          <ModeChips modes={game.modes} variant="inline" className="hidden sm:flex" />
        </div>

        <div className="mt-2 flex items-center gap-2 sm:gap-3">
          <Button asChild variant="play" size="xl" className="flex-1 sm:flex-none">
            <Link
              href={target.href}
              prefetch={false}
              data-hero-action="play"
              onClick={target.direct ? onPlay : undefined}
            >
              <Play aria-hidden className="h-5 w-5 fill-current" />
              Play now
            </Link>
          </Button>
          {/* Icon-only on a phone, where Play needs the width. */}
          <Button asChild variant="ghost" size="xl" className="w-14 px-0 sm:w-auto sm:px-5">
            <Link href={detailHref(game.id)} data-hero-action="details">
              <Info aria-hidden className="h-5 w-5" />
              <span className="sr-only sm:not-sr-only">Details</span>
            </Link>
          </Button>
          {!favorites.unavailable && (
            <Button
              variant="ghost"
              size="icon-lg"
              className={cn("h-14 w-14 rounded-xl", favourite && "text-primary-accent")}
              aria-pressed={favourite}
              aria-label={`Favourite ${game.name}`}
              data-hero-action="favourite"
              onClick={() => favorites.toggle(game.id)}
            >
              <Heart aria-hidden className={cn("h-5 w-5", favourite && "fill-current")} />
            </Button>
          )}
        </div>
      </div>
    </CarouselItem>
  );
}
