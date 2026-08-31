"use client";

import * as React from "react";
import { Button } from "@playora/ui";
import type { RacingPlayerView } from "@playora/game-engine";
import type { AiLevel } from "@playora/bot-engine";
import type { GameId } from "@playora/game-types";
import { ArrowLeft } from "lucide-react";
import { useLocalRace, LOCAL_DRIVER_ID, type LocalRaceMode } from "../../lib/local/use-local-race";
import { useRaceProgress } from "../../lib/racing/use-race-progress";
import { isPass, starsFor, type RaceLevel } from "@playora/game-engine";
import { useAudio } from "../../lib/audio/use-audio";
import { LevelSelect } from "./LevelSelect";
import { useRacingRenderer } from "./unity/use-racing-renderer";
import { UnityRaceRun } from "./unity/UnityRaceRun";
import { RaceResult } from "./RaceResult";
import { RaceStage, RACE_CONTROLS_HINT } from "./RaceStage";

interface RaceGameViewProps {
  gameId: GameId;
  mode: LocalRaceMode;
  aiLevel: AiLevel;
  onExit: () => void;
}

/**
 * Offline racing: the career ladder, and a race.
 *
 * A time trial goes straight to the track. Racing against AI goes through the
 * ladder first, because a level you have not unlocked is the whole point of
 * having levels — the difficulty selector on the mode card is what a time trial
 * uses, and the ladder sets its own.
 */
export function RaceGameView({ gameId, mode, aiLevel, onExit }: RaceGameViewProps) {
  const progress = useRaceProgress(gameId);
  const [level, setLevel] = React.useState<RaceLevel | null>(null);
  // Unity when a build is installed, the web build otherwise. See
  // useRacingRenderer for why both exist at once.
  const renderer = useRacingRenderer(gameId);

  if (mode === "career" && !level) {
    return <LevelSelect gameId={gameId} onStart={setLevel} />;
  }

  if (renderer === "unity" && level) {
    return (
      <UnityRaceRun
        key={`unity-${level.index}`}
        gameId={gameId}
        level={level}
        onRecord={progress.record}
        onBackToLevels={() => setLevel(null)}
      />
    );
  }

  return (
    <RaceRun
      key={level?.index ?? "time-trial"}
      gameId={gameId}
      mode={mode}
      level={level}
      aiLevel={aiLevel}
      onRecord={progress.record}
      onBackToLevels={level ? () => setLevel(null) : null}
      onNextLevel={
        level && progress.levels[level.index]
          ? () => setLevel(progress.levels[level.index] ?? null)
          : null
      }
      onExit={onExit}
    />
  );
}

function RaceRun({
  gameId,
  mode,
  level,
  aiLevel,
  onRecord,
  onBackToLevels,
  onNextLevel,
  onExit,
}: {
  gameId: GameId;
  mode: LocalRaceMode;
  level: RaceLevel | null;
  aiLevel: AiLevel;
  onRecord: (level: RaceLevel, place: number) => void;
  onBackToLevels: (() => void) | null;
  onNextLevel: (() => void) | null;
  onExit: () => void;
}) {
  const drawRef = React.useRef<((view: RacingPlayerView) => void) | null>(null);
  const play = useAudio();

  const onFrame = React.useCallback((view: RacingPlayerView) => {
    drawRef.current?.(view);
  }, []);

  const race = useLocalRace({
    gameId,
    mode,
    aiLevel: level ? level.aiLevel : aiLevel,
    opponents: level ? level.opponents : mode === "vs-ai" ? 3 : 0,
    trackLength: level ? level.trackLength : 3000,
    nitroCharges: level ? level.nitroCharges : 2,
    onFrame,
  });

  const onReady = React.useCallback((draw: (view: RacingPlayerView) => void) => {
    drawRef.current = draw;
  }, []);

  // Where the player actually finished, from the result the engine produced.
  const place = React.useMemo(() => {
    if (!race.result) return 0;
    return race.result.scores.find((s) => s.userId === LOCAL_DRIVER_ID)?.rank ?? 0;
  }, [race.result]);

  // Recorded once per finished race, not on every render.
  const recorded = React.useRef(false);
  React.useEffect(() => {
    if (!level || !race.result || place === 0 || recorded.current) return;
    recorded.current = true;
    onRecord(level, place);
  }, [level, race.result, place, onRecord]);

  const previousPhase = React.useRef(race.hud.phase);
  React.useEffect(() => {
    if (previousPhase.current === "countdown" && race.hud.phase === "racing") play("match.start");
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

  const passed = level && place > 0 ? isPass(level, place) : false;

  return (
    <div className="flex flex-col flex-1 h-full w-full items-center justify-between gap-2 overflow-hidden py-1">
      {level && (
        <div className="flex items-center justify-between gap-3">
          {onBackToLevels && (
            <Button variant="outline" size="sm" className="gap-2" onClick={onBackToLevels}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Levels
            </Button>
          )}
          <div className="text-right">
            <p className="font-display text-sm font-bold text-foreground">
              Level {level.index} · {level.name}
            </p>
            <p className="text-xs text-muted-foreground">
              Finish {level.targetPlace === 1 ? "1st" : `${level.targetPlace}nd or better`} to
              unlock the next
            </p>
          </div>
        </div>
      )}

      <div className="relative w-full max-w-[1400px] flex-1 min-h-0 sm:aspect-video flex flex-col items-center justify-center">
        <RaceStage
          track={race.track}
          isBike={race.isBike}
          followId={LOCAL_DRIVER_ID}
          hud={race.hud}
          started={race.running}
          onReady={onReady}
          setInput={race.setInput}
          onRestart={race.restart}
          players={race.players}
          currentUserId={race.currentUserId}
          onPauseChange={race.setPaused}
          onLeave={onBackToLevels ?? onExit}
        />

        {race.result && (
          <RaceResult
            place={place || race.hud.place}
            total={race.hud.total}
            raceTicks={race.hud.raceTicks}
            bestLapTicks={race.hud.bestLapTicks}
            coins={race.hud.coins}
            {...(level
              ? {
                  stars: starsFor(level, place),
                  passed,
                  levelName: `Level ${level.index} · ${level.name}`,
                  requirement: passed
                    ? undefined
                    : `You needed ${level.targetPlace === 1 ? "1st" : `${level.targetPlace}nd or better`} to unlock the next level.`,
                }
              : {})}
            onPlayAgain={race.restart}
            onNext={passed ? onNextLevel : null}
            onExit={onBackToLevels ?? onExit}
            exitLabel={onBackToLevels ? "All levels" : "Back"}
          />
        )}
      </div>

      <div className="hidden sm:block">
        {RACE_CONTROLS_HINT}
      </div>
    </div>
  );
}

