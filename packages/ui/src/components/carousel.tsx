"use client";

import * as React from "react";
import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils.js";
import { usePrefersReducedMotion } from "../lib/motion.js";
import { Button, type ButtonProps } from "./button.js";

/**
 * Carousel on Embla: drag/swipe with momentum, snap points, and arrow-key
 * navigation while focus is inside it. The same parts serve a full-width hero
 * (`basis-full` items) and a rail of fixed-width cards (`basis-auto` items
 * with a width).
 *
 * Under reduced motion the buttons, dots and arrow keys jump straight to the
 * target slide instead of scrolling to it. Embla animates in JavaScript, which
 * the global reduced-motion CSS cannot reach. Nothing here auto-advances;
 * autoplay is an Embla plugin passed in through `plugins`, and it is the
 * caller's job to leave it out under reduced motion (`useCarousel` exposes
 * the flag).
 */

export type CarouselApi = UseEmblaCarouselType[1];
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>;
type CarouselOptions = UseCarouselParameters[0];
type CarouselPlugin = UseCarouselParameters[1];

export interface CarouselProps extends React.HTMLAttributes<HTMLDivElement> {
  opts?: CarouselOptions;
  plugins?: CarouselPlugin;
  orientation?: "horizontal" | "vertical";
  /** Receives the Embla API once it exists, for control from outside. */
  setApi?: (api: CarouselApi) => void;
}

interface CarouselContextValue {
  carouselRef: UseEmblaCarouselType[0];
  api: CarouselApi;
  orientation: "horizontal" | "vertical";
  /** Index of the snap point currently in view. */
  selectedIndex: number;
  /** One entry per snap point; its length is the number of "pages". */
  scrollSnaps: number[];
  canScrollPrev: boolean;
  canScrollNext: boolean;
  scrollPrev: () => void;
  scrollNext: () => void;
  scrollTo: (index: number) => void;
  reducedMotion: boolean;
}

const CarouselContext = React.createContext<CarouselContextValue | null>(null);

export function useCarousel(): CarouselContextValue {
  const context = React.useContext(CarouselContext);
  if (!context) throw new Error("useCarousel must be used within a <Carousel />");
  return context;
}

export const Carousel = React.forwardRef<HTMLDivElement, CarouselProps>(
  ({ orientation = "horizontal", opts, setApi, plugins, className, children, ...props }, ref) => {
    const [carouselRef, api] = useEmblaCarousel(
      { ...opts, axis: orientation === "horizontal" ? "x" : "y" },
      plugins,
    );
    const reducedMotion = usePrefersReducedMotion();
    const [selectedIndex, setSelectedIndex] = React.useState(0);
    const [scrollSnaps, setScrollSnaps] = React.useState<number[]>([]);
    const [canScrollPrev, setCanScrollPrev] = React.useState(false);
    const [canScrollNext, setCanScrollNext] = React.useState(false);

    const sync = React.useCallback((embla: CarouselApi) => {
      if (!embla) return;
      setSelectedIndex(embla.selectedScrollSnap());
      setScrollSnaps(embla.scrollSnapList());
      setCanScrollPrev(embla.canScrollPrev());
      setCanScrollNext(embla.canScrollNext());
    }, []);

    const scrollPrev = React.useCallback(() => api?.scrollPrev(reducedMotion), [api, reducedMotion]);
    const scrollNext = React.useCallback(() => api?.scrollNext(reducedMotion), [api, reducedMotion]);
    const scrollTo = React.useCallback(
      (index: number) => api?.scrollTo(index, reducedMotion),
      [api, reducedMotion],
    );

    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        const back = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
        const forward = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
        if (event.key === back) {
          event.preventDefault();
          scrollPrev();
        } else if (event.key === forward) {
          event.preventDefault();
          scrollNext();
        }
      },
      [orientation, scrollPrev, scrollNext],
    );

    React.useEffect(() => {
      if (api && setApi) setApi(api);
    }, [api, setApi]);

    React.useEffect(() => {
      if (!api) return;
      sync(api);
      api.on("select", sync);
      api.on("reInit", sync);
      return () => {
        api.off("select", sync);
        api.off("reInit", sync);
      };
    }, [api, sync]);

    const value = React.useMemo<CarouselContextValue>(
      () => ({
        carouselRef,
        api,
        orientation,
        selectedIndex,
        scrollSnaps,
        canScrollPrev,
        canScrollNext,
        scrollPrev,
        scrollNext,
        scrollTo,
        reducedMotion,
      }),
      [
        carouselRef,
        api,
        orientation,
        selectedIndex,
        scrollSnaps,
        canScrollPrev,
        canScrollNext,
        scrollPrev,
        scrollNext,
        scrollTo,
        reducedMotion,
      ],
    );

    return (
      <CarouselContext.Provider value={value}>
        <div
          ref={ref}
          onKeyDownCapture={handleKeyDown}
          className={cn("relative", className)}
          role="region"
          aria-roledescription="carousel"
          {...props}
        >
          {children}
        </div>
      </CarouselContext.Provider>
    );
  },
);
Carousel.displayName = "Carousel";

export interface CarouselContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Class for the clipping viewport. A rail of cards that lift on hover wants
   * vertical room here (e.g. `-my-4 py-4`) or the lift and shadow are cut off.
   */
  viewportClassName?: string;
}

export const CarouselContent = React.forwardRef<HTMLDivElement, CarouselContentProps>(
  ({ className, viewportClassName, ...props }, ref) => {
    const { carouselRef, orientation } = useCarousel();
    return (
      <div ref={carouselRef} className={cn("overflow-hidden", viewportClassName)}>
        <div
          ref={ref}
          className={cn(
            "flex",
            orientation === "horizontal" ? "-ml-3 sm:-ml-4" : "-mt-3 flex-col sm:-mt-4",
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);
CarouselContent.displayName = "CarouselContent";

export const CarouselItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { orientation } = useCarousel();
    return (
      <div
        ref={ref}
        role="group"
        aria-roledescription="slide"
        className={cn(
          "min-w-0 shrink-0 grow-0 basis-full",
          orientation === "horizontal" ? "pl-3 sm:pl-4" : "pt-3 sm:pt-4",
          className,
        )}
        {...props}
      />
    );
  },
);
CarouselItem.displayName = "CarouselItem";

/**
 * Previous/next buttons. They sit in normal flow — in a rail's header action
 * slot, typically — rather than pinned to the carousel's sides; position them
 * with `className` for an overlaid hero.
 */
export const CarouselPrevious = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "outline", size = "icon-sm", onClick, ...props }, ref) => {
    const { orientation, scrollPrev, canScrollPrev } = useCarousel();
    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        className={cn("rounded-full", orientation === "vertical" && "rotate-90", className)}
        disabled={!canScrollPrev}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) scrollPrev();
        }}
        {...props}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        <span className="sr-only">Previous</span>
      </Button>
    );
  },
);
CarouselPrevious.displayName = "CarouselPrevious";

export const CarouselNext = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "outline", size = "icon-sm", onClick, ...props }, ref) => {
    const { orientation, scrollNext, canScrollNext } = useCarousel();
    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        className={cn("rounded-full", orientation === "vertical" && "rotate-90", className)}
        disabled={!canScrollNext}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) scrollNext();
        }}
        {...props}
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
        <span className="sr-only">Next</span>
      </Button>
    );
  },
);
CarouselNext.displayName = "CarouselNext";

/**
 * One dot per snap point; the current one stretches into a pill.
 *
 * The dot is drawn small, but each button is a 24x40 target around it (32
 * wide for the pill), with no gap between them: on a phone the dots can be
 * the only way to pick a slide, and a 6px dot is not something a thumb can
 * hit. The focus ring is drawn round the dot, where the eye already is.
 */
export function CarouselDots({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { scrollSnaps, selectedIndex, scrollTo } = useCarousel();
  if (scrollSnaps.length < 2) return null;
  return (
    <div className={cn("flex items-center justify-center", className)} {...props}>
      {scrollSnaps.map((_, index) => {
        const current = index === selectedIndex;
        return (
          <button
            key={index}
            type="button"
            aria-label={`Go to slide ${index + 1} of ${scrollSnaps.length}`}
            aria-current={current || undefined}
            onClick={() => scrollTo(index)}
            className="group flex h-10 min-w-6 items-center justify-center px-1.5 focus-visible:outline-none"
          >
            <span
              aria-hidden
              className={cn(
                "block h-1.5 rounded-full transition-[width,background-color] duration-hover ease-out-expo",
                "group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background",
                current ? "w-5 bg-foreground" : "w-1.5 bg-foreground/30 group-hover:bg-foreground/50",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
