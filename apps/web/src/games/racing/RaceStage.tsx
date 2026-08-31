"use client";

import * as React from "react";
import type { RacingPlayerView, TrackSpec, VehicleInput } from "@playora/game-engine";
import type { Player } from "@playora/game-types";
import { RaceCanvas } from "./RaceCanvas";
import { RaceHud, type RaceHudState } from "./RaceHud";
import { RacePauseMenu } from "./RacePauseMenu";

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
  /**
   * Pausing actually stops the simulation. Absent for an online race, where the
   * server's clock keeps running and the menu can only offer to leave.
   */
  onPauseChange?: (paused: boolean) => void;
  onLeave: () => void;
  onSettings?: () => void;
  /** Names for the standings list. */
  players: Record<string, Player>;
  currentUserId: string;
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
  players,
  currentUserId,
  onPauseChange,
  onLeave,
  onSettings,
}: RaceStageProps) {
  const maxSpeed = isBike ? 72 : 78;
  const [paused, setPaused] = React.useState(false);

  const setPausedAndReport = React.useCallback(
    (next: boolean) => {
      setPaused(next);
      onPauseChange?.(next);
    },
    [onPauseChange],
  );

  // Escape is the key everyone reaches for, so it both opens and closes.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setPausedAndReport(!paused);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paused, setPausedAndReport]);

  return (
    <div className="relative h-full w-full max-w-[1400px] flex-1 overflow-hidden rounded-2xl sm:rounded-3xl border border-white/15 bg-[#090b14] shadow-[0_0_50px_rgba(0,0,0,0.8)]">
      <RaceCanvas
        track={track}
        isBike={isBike}
        followId={followId}
        onReady={onReady}
        setInput={setInput}
        interactive={!hud.finished && !paused}
        onRestart={onRestart}
      />
      <RaceHud
        hud={hud}
        maxSpeed={maxSpeed}
        started={started}
        track={track}
        players={players}
        currentUserId={currentUserId}
        onPause={() => setPausedAndReport(true)}
        onAccelerate={(held) => setInput({ throttle: held })}
        onSteer={(steer) => setInput({ steer })}
        onBrake={(held) => setInput({ brake: held })}
        onNitro={() => setInput({ nitro: true })}
      />

      {paused && (
        <RacePauseMenu
          canRestart={Boolean(onPauseChange)}
          onResume={() => setPausedAndReport(false)}
          onRestart={() => {
            setPausedAndReport(false);
            onRestart();
          }}
          onSettings={() => onSettings?.()}
          onLeave={onLeave}
        />
      )}
    </div>
  );
}

const Key = ({ children }: { children: React.ReactNode }) => (
  <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground">
    {children}
  </kbd>
);

export const RACE_CONTROLS_HINT = (
  <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-center text-xs text-muted-foreground">
    <span>
      <Key>W</Key> <span className="mx-0.5">or</span> hold mouse — accelerate
    </span>
    <span>
      <Key>A</Key> <Key>D</Key> <span className="mx-0.5">or</span> move mouse — steer
    </span>
    <span>
      <Key>S</Key> — brake
    </span>
    <span>
      <Key>N</Key> <Key>Space</Key> — nitro
    </span>
    <span>
      <Key>R</Key> — restart
    </span>
  </p>
);
