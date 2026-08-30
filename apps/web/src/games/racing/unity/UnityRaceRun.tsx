"use client";

import * as React from "react";
import { Button } from "@playora/ui";
import type { GameId } from "@playora/game-types";
import type { UnityEvent, UnitySessionConfig } from "@playora/protocol";
import { isPass, starsFor, type RaceLevel } from "@playora/game-engine";
import { ArrowLeft } from "lucide-react";
import { useChosenVehicle } from "../VehicleSelect";
import { RaceResult } from "../RaceResult";
import { UnityRaceShell } from "./UnityRaceShell";

/**
 * A career race rendered by Unity.
 *
 * The platform still owns the level, the result screen and the progression;
 * Unity owns the race. The two meet only at the bridge, which is why this file
 * is short — everything it does is hand a session over and receive a report.
 */
export function UnityRaceRun({
  gameId,
  level,
  onRecord,
  onBackToLevels,
}: {
  gameId: GameId;
  level: RaceLevel;
  onRecord: (level: RaceLevel, place: number) => void;
  onBackToLevels: () => void;
}) {
  const { vehicleId } = useChosenVehicle(gameId);
  const [finished, setFinished] = React.useState<{
    place: number;
    raceTimeMs: number;
    bestLapMs: number | null;
  } | null>(null);

  const session: UnitySessionConfig = React.useMemo(
    () => ({
      sessionId: `career-${gameId}-${level.index}`,
      gameId: gameId as "car-race" | "bike-race",
      // The same seed the web build uses, so a level is the same circuit in
      // either engine and a lap time means the same thing.
      trackSeed: level.index * 7919,
      trackLength: level.trackLength,
      laps: level.laps,
      vehicleId,
      localPlayerId: "local-you",
      players: [
        { playerId: "local-you", displayName: "You", vehicleId, isBot: false },
        ...Array.from({ length: level.opponents }, (_, i) => ({
          playerId: `ai-${i + 1}`,
          displayName: `AI ${i + 1}`,
          vehicleId,
          isBot: true,
          aiLevel: level.aiLevel,
        })),
      ],
      quality: "medium" as const,
      controls: "keyboard" as const,
    }),
    [gameId, level, vehicleId],
  );

  const recorded = React.useRef(false);

  const onEvent = React.useCallback(
    (event: UnityEvent) => {
      if (event.type !== "RACE_FINISHED") return;

      const mine = event.report.reportedPlacings.find((p) => p.playerId === "local-you");
      if (!mine) return;

      setFinished({
        place: mine.place,
        raceTimeMs: mine.raceTimeMs,
        bestLapMs: mine.bestLapMs,
      });

      // An offline career race has nobody to cheat, so the client's own report
      // is enough to unlock a level. A rated online race must not take this
      // path — spec v2 section 58 requires the outcome to be arbitrated before
      // any rating is written.
      if (!recorded.current && event.report.authority === "local") {
        recorded.current = true;
        onRecord(level, mine.place);
      }
    },
    [level, onRecord],
  );

  const passed = finished ? isPass(level, finished.place) : false;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" size="sm" className="gap-2" onClick={onBackToLevels}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Levels
        </Button>
        <div className="text-right">
          <p className="font-display text-sm font-bold text-foreground">
            Level {level.index} · {level.name}
          </p>
          <p className="text-xs text-muted-foreground">Running on Unity</p>
        </div>
      </div>

      <UnityRaceShell
        gameId={gameId as "car-race" | "bike-race"}
        session={session}
        onEvent={onEvent}
        onLeave={onBackToLevels}
      />

      {finished && (
        <RaceResult
          place={finished.place}
          total={level.opponents + 1}
          // The bridge reports milliseconds; the result screen counts ticks.
          raceTicks={Math.round((finished.raceTimeMs / 1000) * 60)}
          bestLapTicks={
            finished.bestLapMs === null || finished.bestLapMs < 0
              ? null
              : Math.round((finished.bestLapMs / 1000) * 60)
          }
          coins={0}
          stars={starsFor(level, finished.place)}
          passed={passed}
          levelName={`Level ${level.index} · ${level.name}`}
          requirement={
            passed
              ? undefined
              : `You needed ${level.targetPlace === 1 ? "1st" : `${level.targetPlace}nd or better`} to unlock the next level.`
          }
          onPlayAgain={() => {
            recorded.current = false;
            setFinished(null);
          }}
          onExit={onBackToLevels}
          exitLabel="All levels"
        />
      )}
    </div>
  );
}
