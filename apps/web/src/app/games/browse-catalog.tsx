"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  parseBrowseParams,
  serializeBrowseState,
  type BrowseState,
} from "../../lib/games/browse-url";
import { BrowseView, type BrowseChangeOptions } from "./browse-view";

/**
 * Browse, kept in step with the address bar.
 *
 * The URL is where the filters live, so a filtered page can be shared,
 * bookmarked and reached from a link (the sidebar's genres, the home page's
 * shelves, the site search). But a click answers from local state at once
 * and the URL follows: waiting for the router to commit each change before
 * the grid moved would make every toggle lag, and typing would wait on it per
 * keystroke. The search box writes the URL once typing pauses.
 *
 * `router.replace` with `scroll: false`, so refining a search neither stacks
 * a history entry per keystroke nor jumps the page back to the top.
 */
export function BrowseCatalog({ now }: { now: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const fromUrl = React.useMemo(() => parseBrowseParams(searchParams), [searchParams]);
  const urlKey = serializeBrowseState(fromUrl);

  const [state, setState] = React.useState<BrowseState>(fromUrl);
  // The query this page last wrote. When it comes back through
  // `useSearchParams` it is not news; anything else is a navigation from
  // outside (back and forward, a sidebar genre) and replaces local state.
  const written = React.useRef(urlKey);
  const pending = React.useRef<{ timer: number; state: BrowseState } | null>(null);

  React.useEffect(() => {
    if (urlKey === written.current) return;
    written.current = urlKey;
    if (pending.current) window.clearTimeout(pending.current.timer);
    pending.current = null;
    setState(fromUrl);
  }, [urlKey, fromUrl]);

  const write = React.useCallback(
    (next: BrowseState) => {
      const query = serializeBrowseState(next);
      if (query === written.current) return;
      written.current = query;
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname]
  );

  const flush = React.useCallback(() => {
    const waiting = pending.current;
    if (!waiting) return;
    window.clearTimeout(waiting.timer);
    pending.current = null;
    write(waiting.state);
  }, [write]);

  // Leaving mid-debounce drops the write. Flushing here would be worse: the
  // router has already moved on, and a replace now would drag it back.
  React.useEffect(
    () => () => {
      if (pending.current) window.clearTimeout(pending.current.timer);
    },
    []
  );

  const onChange = (patch: Partial<BrowseState>, { debounceMs = 0 }: BrowseChangeOptions = {}) => {
    const next = { ...state, ...patch };
    setState(next);
    if (pending.current) window.clearTimeout(pending.current.timer);
    pending.current = null;
    if (debounceMs > 0) {
      pending.current = {
        state: next,
        timer: window.setTimeout(() => {
          pending.current = null;
          write(next);
        }, debounceMs),
      };
    } else {
      write(next);
    }
  };

  return <BrowseView state={state} now={now} onChange={onChange} onFlush={flush} />;
}
