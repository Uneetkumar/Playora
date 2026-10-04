"use client";

import * as React from "react";

const serverFalse = () => false;

/**
 * Whether a media query matches, kept current as the window changes.
 *
 * The server cannot know the screen, so it renders as though the query does
 * not match, and the browser corrects that straight after hydrating. Write
 * the query so that "not matching" is the phone layout: a phone then paints
 * the right thing first, and a desktop re-renders once, before anyone acts.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query]
  );
  return React.useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, serverFalse);
}
