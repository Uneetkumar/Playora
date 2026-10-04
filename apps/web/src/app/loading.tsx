"use client";

import { usePathname } from "next/navigation";
import { Skeleton, Spinner } from "@playora/ui";
import { isImmersiveRoute } from "../components/shell/nav";

/**
 * Route-level loading state, shown while a page's code and data resolve.
 *
 * Platform pages are a heading over a grid of cards far more often than not,
 * so the placeholder has that shape and the page fills in where it already
 * stood, instead of a spinner giving way to a layout. On a game route there
 * is no grid to stand in for, and the game takes the whole screen, so a
 * centred ring is the honest answer there.
 */
export default function Loading() {
  const pathname = usePathname();

  if (isImmersiveRoute(pathname)) {
    return (
      <div className="flex h-full min-h-[100dvh] items-center justify-center">
        <Spinner size="lg" label="Loading the game" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8" role="status" aria-live="polite">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-8 w-56 max-w-[60%]" />
      <Skeleton className="mt-3 h-4 w-80 max-w-[80%]" />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4 2xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="space-y-2.5">
            <Skeleton className="aspect-video w-full rounded-xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
