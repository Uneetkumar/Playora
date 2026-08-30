"use client";

import * as React from "react";
import { unityBuildExists } from "./use-unity-bridge";

export type RacingRenderer = "checking" | "unity" | "web";

/**
 * Which engine renders a race.
 *
 * Spec v2 section 44 makes Unity the target for the racing games. A Unity
 * WebGL build is produced by the Editor and installed separately from this
 * code, so the platform asks whether one is actually present rather than
 * assuming: if it is, Unity runs; if it is not, the existing web build runs and
 * the game stays playable.
 *
 * That is deliberate rather than temporary politeness. Deleting a working game
 * before its replacement runs would leave the whole racing flow — lobby,
 * countdown, race, result, rating, XP, history — with nothing to exercise it.
 */
export function useRacingRenderer(gameId: string): RacingRenderer {
  const [renderer, setRenderer] = React.useState<RacingRenderer>("checking");

  React.useEffect(() => {
    let cancelled = false;

    // Only ever consulted once per game per page load: a HEAD request per race
    // start is wasteful, and the answer cannot change while the tab is open.
    void unityBuildExists(gameId).then((exists) => {
      if (!cancelled) setRenderer(exists ? "unity" : "web");
    });

    return () => {
      cancelled = true;
    };
  }, [gameId]);

  return renderer;
}
