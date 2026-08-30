"use client";

import * as React from "react";
import { buildTrack } from "@playora/game-engine";
import type { RacingPlayerView, TrackSpec, VehicleInput } from "@playora/game-engine";
import type { GameId, Player } from "@playora/game-types";
import { useRemoteRace } from "../../lib/racing/use-remote-race";
import { RaceStage, RACE_CONTROLS_HINT } from "./RaceStage";

interface OnlineRaceViewProps {
  gameId: GameId;
  /** The latest GAME_STATE from the room socket. */
  gameState: RacingPlayerView | null;
  currentUserId: string;
  /** Names for the standings list. */
  players: Record<string, Player>;
  /** Leaves the race from the pause menu. */
  onLeave: () => void;
  sendGameAction: (type: string, payload: Record<string, unknown>) => void;
}

/**
 * A race the server is running.
 *
 * The only things sent from here are steering, throttle, brake and nitro. The
 * client never advances the clock, never reports a position, and never decides
 * who won — the engine rejects a TICK from anyone but the server, so it could
 * not if it tried.
 */
export function OnlineRaceView({
  gameId,
  gameState,
  currentUserId,
  players,
  onLeave,
  sendGameAction,
}: OnlineRaceViewProps) {
  const sendInput = React.useCallback(
    (input: Partial<VehicleInput> & { seq: number }) => {
      sendGameAction("SET_INPUT", input as unknown as Record<string, unknown>);
    },
    [sendGameAction],
  );

  const { hud, onReady, setInput } = useRemoteRace(gameState, sendInput, currentUserId);

  // The road is rebuilt locally from the seed the server sent, not received.
  // Track generation is deterministic, so this is the identical road the server
  // is simulating — and it keeps 17 KB of unchanging geometry off every single
  // snapshot. Held in state so the mesh is only rebuilt when the seed changes.
  const [track, setTrack] = React.useState<TrackSpec | null>(null);
  const seed = gameState?.trackSeed ?? null;
  const length = gameState?.trackLength ?? null;
  React.useEffect(() => {
    if (seed === null || length === null) return;
    if (track?.seed === seed && track?.length === length) return;
    setTrack(buildTrack(seed, length));
  }, [seed, length, track?.seed, track?.length]);

  if (!track) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-border bg-[#140a2e] text-sm text-muted-foreground">
        Waiting for the server to build the track…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <RaceStage
        track={track}
        isBike={gameId === "bike-race"}
        followId={currentUserId}
        hud={hud}
        // There is no "press to start" online: the countdown runs on the
        // server's clock and the race begins whether you are ready or not.
        started
        onReady={onReady}
        setInput={setInput}
        players={players}
        currentUserId={currentUserId}
        // No onPauseChange: the server's clock keeps running, so the menu can
        // only offer to leave rather than pretending to freeze the race.
        onLeave={onLeave}
        onRestart={() => {
          /* Restarting an online race is the rematch vote, offered by the
             result screen rather than by a button on the track. */
        }}
      />
      {RACE_CONTROLS_HINT}
    </div>
  );
}
