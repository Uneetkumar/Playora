"use client";

import * as React from "react";
import { Button, cn } from "@playora/ui";
import type { RacingPlayerView } from "@playora/game-engine";
import type { AiLevel } from "@playora/bot-engine";
import type { GameId } from "@playora/game-types";
import { ArrowLeft, ChevronRight, Lock } from "lucide-react";
import { useLocalRace, LOCAL_DRIVER_ID, type LocalRaceMode } from "../../lib/local/use-local-race";
import { useRaceProgress } from "../../lib/racing/use-race-progress";
import { isPass, starsFor, type RaceLevel } from "@playora/game-engine";
import { MatchResult } from "../../components/games/match-result";
import { useAudio } from "../../lib/audio/use-audio";
import { LevelSelect, Stars } from "./LevelSelect";
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

  if (mode === "vs-ai" && !level) {
    return (
      <div className="space-y-4">
        <LevelSelect gameId={gameId} onStart={setLevel} />
      </div>
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
      nextLevelLocked={
        level ? !progress.isUnlocked(progress.levels[level.index] ?? level) : false
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
  nextLevelLocked,
  onExit,
}: {
  gameId: GameId;
  mode: LocalRaceMode;
  level: RaceLevel | null;
  aiLevel: AiLevel;
  onRecord: (level: RaceLevel, place: number) => void;
  onBackToLevels: (() => void) | null;
  onNextLevel: (() => void) | null;
  nextLevelLocked: boolean;
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
    <div className="space-y-4">
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

      {race.result && level && (
        <div
          className={cn(
            "rounded-2xl border p-5 text-center",
            passed ? "border-success/50 bg-success/10" : "border-destructive/40 bg-destructive/5",
          )}
        >
          <div className="flex justify-center">
            <Stars earned={starsFor(level, place)} size="lg" />
          </div>
          <p className="mt-2 font-display text-xl font-black text-foreground">
            {passed ? `Level ${level.index} complete` : "Not quite"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {passed
              ? onNextLevel
                ? `Level ${level.index + 1} is unlocked.`
                : "That was the last level. The ladder is finished."
              : `You needed ${level.targetPlace === 1 ? "1st" : `${level.targetPlace}nd or better`} and finished ${place}${suffix(place)}.`}
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button onClick={race.restart} variant={passed ? "outline" : "default"}>
              Try again
            </Button>
            {passed && onNextLevel && (
              <Button className="gap-2" onClick={onNextLevel} disabled={nextLevelLocked}>
                {nextLevelLocked ? (
                  <Lock className="h-4 w-4" aria-hidden />
                ) : (
                  <ChevronRight className="h-4 w-4" aria-hidden />
                )}
                Next level
              </Button>
            )}
            {onBackToLevels && (
              <Button variant="outline" onClick={onBackToLevels}>
                All levels
              </Button>
            )}
          </div>
        </div>
      )}

      {race.result && !level && (
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

function suffix(place: number): string {
  if (place === 1) return "st";
  if (place === 2) return "nd";
  if (place === 3) return "rd";
  return "th";
}
