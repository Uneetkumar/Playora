"use client";

import * as React from "react";
import type { RacingPlayerView } from "@playora/game-engine";
import type { AiLevel } from "@playora/bot-engine";
import type { GameId } from "@playora/game-types";
import { useLocalRace, LOCAL_DRIVER_ID, type LocalRaceMode } from "../../lib/local/use-local-race";
import { MatchResult } from "../../components/games/match-result";
import { useAudio } from "../../lib/audio/use-audio";
import { RaceStage, RACE_CONTROLS_HINT } from "./RaceStage";

interface RaceGameViewProps {
  gameId: GameId;
  mode: LocalRaceMode;
  aiLevel: AiLevel;
  onExit: () => void;
}

/**
 * A local race: the 3D view, the overlay, and the result.
 *
 * The draw callback is held in a ref and registered by the canvas, so the game
 * loop can push sixty frames a second straight at Three.js without this
 * component re-rendering once.
 */
export function RaceGameView({ gameId, mode, aiLevel, onExit }: RaceGameViewProps) {
  const drawRef = React.useRef<((view: RacingPlayerView) => void) | null>(null);
  const play = useAudio();

  const onFrame = React.useCallback((view: RacingPlayerView) => {
    drawRef.current?.(view);
  }, []);

  const race = useLocalRace({
    gameId,
    mode,
    aiLevel,
    opponents: mode === "vs-ai" ? 3 : 0,
    trackLength: 3000,
    onFrame,
  });

  const onReady = React.useCallback((draw: (view: RacingPlayerView) => void) => {
    drawRef.current = draw;
  }, []);

  // Sound follows the state the engine reports, not the key that was pressed.
  const previousPhase = React.useRef(race.hud.phase);
  React.useEffect(() => {
    if (previousPhase.current === "countdown" && race.hud.phase === "racing") {
      play("match.start");
    }
    previousPhase.current = race.hud.phase;
  }, [race.hud.phase, play]);

  const previousCoins = React.useRef(0);
  React.useEffect(() => {
    if (race.hud.coins > previousCoins.current) play("ui.notify");
    previousCoins.current = race.hud.coins;
  }, [race.hud.coins, play]);

  const previousCountdown = React.useRef(3);
  React.useEffect(() => {
    if (race.hud.phase === "countdown" && race.hud.countdown !== previousCountdown.current) {
      play("match.tick");
    }
    previousCountdown.current = race.hud.countdown;
  }, [race.hud.countdown, race.hud.phase, play]);

  return (
    <div className="space-y-4">
      <RaceStage
        track={race.track}
        isBike={race.isBike}
        followId={LOCAL_DRIVER_ID}
        hud={race.hud}
        started={race.running}
        onReady={onReady}
        setInput={race.setInput}
        onRestart={race.restart}
      />

      {race.result && (
        <MatchResult
          result={race.result}
          players={race.players}
          currentUserId={race.currentUserId}
          onRematch={race.restart}
          rematchLabel="Race again"
          onExit={onExit}
        />
      )}

      {RACE_CONTROLS_HINT}
    </div>
  );
}
