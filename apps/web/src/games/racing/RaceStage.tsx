"use client";

import * as React from "react";
import type { RacingPlayerView, TrackSpec, VehicleInput } from "@playora/game-engine";
import { RaceCanvas } from "./RaceCanvas";
import { RaceHud, type RaceHudState } from "./RaceHud";

interface RaceStageProps {
  track: TrackSpec;
  isBike: boolean;
  followId: string;
  hud: RaceHudState;
  started: boolean;
  onReady: (draw: (view: RacingPlayerView) => void) => void;
  setInput: (patch: Partial<VehicleInput>) => void;
  onRestart: () => void;
  restartLabel?: string;
}

/**
 * The race, as a picture and an overlay.
 *
 * Purely presentational, and shared by the offline and online games. Where the
 * frames come from — a local simulation or interpolated server snapshots — is
 * the caller's problem, which is what stops the two modes drifting into two
 * different-looking games.
 */
export function RaceStage({
  track,
  isBike,
  followId,
  hud,
  started,
  onReady,
  setInput,
  onRestart,
}: RaceStageProps) {
  const maxSpeed = isBike ? 72 : 78;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-[#140a2e] shadow-2xl">
      <RaceCanvas
        track={track}
        isBike={isBike}
        followId={followId}
        onReady={onReady}
        setInput={setInput}
        interactive={!hud.finished}
      />
      <RaceHud
        hud={hud}
        maxSpeed={maxSpeed}
        started={started}
        onRestart={onRestart}
        onNitro={() => setInput({ nitro: true })}
      />
    </div>
  );
}

export const RACE_CONTROLS_HINT = (
  <p className="text-center text-xs text-muted-foreground">
    <kbd className="rounded bg-muted px-1.5 py-0.5">W</kbd> or hold the mouse to accelerate ·{" "}
    <kbd className="rounded bg-muted px-1.5 py-0.5">A</kbd>
    <kbd className="ml-1 rounded bg-muted px-1.5 py-0.5">D</kbd> or move the mouse to steer ·{" "}
    <kbd className="rounded bg-muted px-1.5 py-0.5">S</kbd> to brake ·{" "}
    <kbd className="rounded bg-muted px-1.5 py-0.5">N</kbd> for nitro
  </p>
);
