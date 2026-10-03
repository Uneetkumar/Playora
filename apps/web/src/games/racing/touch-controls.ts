"use client";

import * as React from "react";

/**
 * Whether this device is driven by a finger rather than a mouse.
 *
 * `pointer: coarse` and not a width breakpoint. A narrow desktop window still
 * has a mouse and a keyboard, and taking its drag-steering away would be wrong;
 * a large tablet has neither, and leaving drag-steering on would let a stray
 * thumb on the canvas override the on-screen controls.
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const query = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarse(query.matches);
    update();

    // A tablet with a keyboard case attached and removed changes this at
    // runtime, so it is watched rather than read once.
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return coarse;
}
