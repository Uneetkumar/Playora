"use client";

import * as React from "react";

/**
 * A mask for a sideways-scrolling row that fades whichever edge has more
 * behind it, so a row cut off at the screen edge reads as "scroll for more"
 * rather than as a clipped layout.
 *
 * Both ends count as reached until measured, so a server render has no fade.
 * Returns a style to spread on the scroller; only the mask's alpha matters,
 * the colour words in it are never painted.
 */
export function useEdgeFade(
  ref: React.RefObject<HTMLElement | null>,
  fade = "32px"
): React.CSSProperties | undefined {
  const [edges, setEdges] = React.useState({ start: true, end: true });

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const max = el.scrollWidth - el.clientWidth;
      const next = { start: el.scrollLeft <= 1, end: el.scrollLeft >= max - 1 };
      setEdges((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [ref]);

  if (edges.start && edges.end) return undefined;
  const mask = `linear-gradient(to right, transparent 0, black ${edges.start ? "0px" : fade}, black calc(100% - ${edges.end ? "0px" : fade}), transparent 100%)`;
  return { maskImage: mask, WebkitMaskImage: mask };
}
