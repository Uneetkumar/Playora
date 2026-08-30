"use client";

import * as React from "react";
import { LoadingState } from "@playora/ui";
import type { UnityEvent, UnitySessionConfig } from "@playora/protocol";
import { useUnityBridge } from "./use-unity-bridge";

/**
 * The platform's frame around a Unity WebGL race.
 *
 * Spec v2 section 40: the shell belongs to React and surrounds the canvas —
 * navigation, social, settings and results stay on the platform side. Unity
 * owns everything inside the canvas, including the in-race HUD, so nothing
 * here draws over the game.
 */
export function UnityRaceShell({
  gameId,
  session,
  onEvent,
  onLeave,
}: {
  gameId: "car-race" | "bike-race";
  session: UnitySessionConfig;
  onEvent: (event: UnityEvent) => void;
  onLeave: () => void;
}) {
  const { canvasRef, status, send } = useUnityBridge(gameId, (event) => {
    // The session is handed over the moment Unity says it is listening, not on
    // a timer: a fixed delay is a race that fails on a slow device.
    if (event.type === "READY") send({ type: "INIT", session });
    onEvent(event);
  });

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-[#0b0718] shadow-2xl">
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        // Unity draws its own HUD, so the canvas is the whole game surface.
        aria-label={`${gameId} game`}
      />

      {status.phase === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0b0718]">
          <p className="font-display text-2xl font-black tracking-widest text-white">PLAYORA</p>
          <div className="h-1.5 w-56 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-[width] duration-200"
              style={{ width: `${Math.round(status.progress * 100)}%` }}
            />
          </div>
          <p className="text-xs text-white/60">{status.label}</p>
        </div>
      )}

      {status.phase === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0b0718] p-6 text-center">
          <p className="font-display text-lg font-bold text-white">{status.message}</p>
          <button
            type="button"
            onClick={onLeave}
            className="rounded-lg border border-white/25 px-4 py-2 text-sm text-white transition-colors hover:bg-white/10"
          >
            Back
          </button>
        </div>
      )}

      {status.phase === "idle" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <LoadingState title="Starting" />
        </div>
      )}
    </div>
  );
}
