"use client";

import * as React from "react";
import { Button } from "@playora/ui";
import { Trophy, RotateCcw, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";
import { useArcadeRun } from "./use-arcade-run";
import { ArcadeHud } from "./ArcadeHud";
import { useJuice } from "./use-juice";
import { waveAt } from "./juice";
import { useGameRuntime } from "../runtime/use-game-runtime";
import {
  createIceState,
  stepIce,
  moveRacer,
  type IceState,
  type IceRacer,
} from "./ice-breaker";

interface IceSnapshot {
  racers: IceRacer[];
  radius: number;
  winner: string | null;
}

export function IceBreakerView({ onExit }: { onExit?: () => void }) {
  // Every shrink of the iceberg you survive is worth points; outlasting the
  // bots is what the run is measured on.
  const run = useArcadeRun("ice-breaker");
  const juice = useJuice();
  const juiceRef = React.useRef(juice);
  juiceRef.current = juice;
  const runRef = React.useRef(run);
  runRef.current = run;

  /*
   * One simulation, replacing a shrink interval, an AI interval and a physics
   * effect that looped forever.
   *
   * That effect depended on `racers` and called `setRacers(curr.map(...))` on
   * every run — `map` returns a new array whether or not anything changed, and
   * a new reference is never `Object.is`-equal, so React re-ran the effect,
   * which set state again, until "Maximum update depth exceeded". The
   * simulation only writes when something actually sank.
   *
   * The extraction also caught bots that did not play: their comment claimed a
   * "nudge towards center or player" and the code was a pure random walk, so
   * they fell off by accident. They now steer inward as the ice closes.
   */
  const rt = useGameRuntime<IceState, IceSnapshot>({
    create: createIceState,

    update: (st, ctx) => {
      stepIce(st, ctx.dt, { wave: waveAt(runRef.current.elapsed), rng: Math.random });
      if (st.events.shrank) {
        // Scored per shrink rather than per second, so the points track the
        // thing that actually gets harder. The iceberg shrinking is the
        // threat; it should be felt.
        runRef.current.hit(25);
        juiceRef.current.impact("solid");
      }
      if (st.events.sank > 0) juiceRef.current.impact("heavy");
      if (st.over) {
        juiceRef.current.impact(st.events.died ? "fatal" : "solid");
        ctx.over = true;
      }
    },

    snapshot: (st) => ({ racers: st.racers, radius: st.radius, winner: st.winner }),
    onGameOver: () => runRef.current.end(),
  });

  const { start } = rt;
  React.useEffect(() => {
    start();
  }, [start]);

  const { racers, radius: iceRadius, winner } = rt.state;
  const gameOver = rt.over;

  const movePlayer = (dx: number, dy: number) => {
    rt.mutate((st) => moveRacer(st, dx, dy));
  };

  const restart = () => {
    run.reset();
    rt.restart();
  };

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-white/20 bg-gradient-to-b from-[#0369a1] via-[#075985] to-[#082f49] p-4 sm:p-6 lg:p-8 text-white shadow-2xl">
      {/* Top Bar */}
      <div className="flex w-full items-center justify-between border-b border-white/10 pb-3 sm:pb-4">
        <div>
          <span className="text-[10px] sm:text-xs font-bold text-cyan-300 uppercase tracking-widest">
            ARCTIC BUMPER ARENA
          </span>
          <h2 className="font-display text-xl sm:text-3xl font-black text-white">ICE BREAKER</h2>
        </div>

        {/*
          * The wave, shown. Escalation a player cannot see reads as the game
          * quietly becoming unfair rather than as something they are surviving.
          */}
        <div className="rounded-xl border border-white/15 bg-black/55 px-3 py-1.5 backdrop-blur-md">
          <div className="text-[9px] font-bold uppercase tracking-widest text-white/50">Wave</div>
          <div className="numeric text-lg font-black leading-none text-white tabular-nums sm:text-xl">
            {waveAt(run.elapsed)}
          </div>
        </div>
        <ArcadeHud run={run} />
        <div className="rounded-xl border border-cyan-400/30 bg-cyan-950/40 px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-bold text-cyan-300">
          ICEBERG: {Math.round(iceRadius * 2)}%
        </div>
      </div>

      {/* Main Arctic Arena Viewport */}
      <div
        {...juice.shakeProps}
        className="relative my-2 sm:my-4 flex flex-1 aspect-square max-h-[380px] sm:max-h-[460px] w-full max-w-xl items-center justify-center overflow-hidden rounded-full border-4 border-cyan-300/40 shadow-2xl bg-cover bg-center select-none"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(5,50,85,0.65), rgba(2,20,40,0.9)), url('/games/ice-breaker-thumb.jpg')`,
        }}
      >
        {/* Floating Iceberg Disc */}
        <div
          style={{ width: `${iceRadius * 2}%`, height: `${iceRadius * 2}%` }}
          className="relative flex items-center justify-center rounded-full border-2 border-white/80 bg-gradient-to-br from-[#f0f9ff] via-[#e0f2fe] to-[#bae6fd] shadow-[0_0_40px_rgba(255,255,255,0.4)] transition-all duration-700"
        >
          {/* Fissure Cracks */}
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#0284c7_1px,transparent_1px)] [background-size:16px_16px]" />
        </div>

        {/* Racers */}
        {racers.map((racer) => {
          if (!racer.alive) {
            return (
              <div
                key={racer.id}
                style={{ left: `${racer.x}%`, top: `${racer.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-cyan-200 opacity-40"
              >
                🌊 {racer.name}
              </div>
            );
          }

          return (
            <div
              key={racer.id}
              style={{ left: `${racer.x}%`, top: `${racer.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 transition-all duration-100"
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white shadow-xl text-sm"
                style={{ backgroundColor: racer.color }}
              >
                {racer.id === "p1" ? "🛷" : "🐧"}
              </div>
              <span className="text-[9px] font-black text-black bg-white/80 px-1 rounded shadow-sm">
                {racer.name}
              </span>
            </div>
          );
        })}

        {gameOver && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md rounded-full">
            <Trophy className="h-12 w-12 text-amber-400 animate-bounce" />
            <h3 className="font-display text-3xl font-black text-white mt-2">WINNER: {winner}</h3>
            <p className="text-sm text-white/70">Last survivor standing on the arctic floe!</p>
            <Button onClick={restart} className="mt-4 gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] px-6 font-bold">
              <RotateCcw className="h-4 w-4" /> Play Again
            </Button>
          </div>
        )}
      </div>

      {/* Directional Pad */}
      <div className="flex w-full items-center justify-between border-t border-white/10 pt-4">
        <p className="text-xs text-white/60">Use direction keys to ram opponents off the ice!</p>

        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => movePlayer(-6, 0)} className="border-white/20 text-white">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-col gap-1">
            <Button variant="outline" size="sm" onClick={() => movePlayer(0, -6)} className="border-white/20 text-white">
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => movePlayer(0, 6)} className="border-white/20 text-white">
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => movePlayer(6, 0)} className="border-white/20 text-white">
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {onExit && (
          <Button variant="outline" onClick={onExit} className="border-white/20 text-white">
            Exit
          </Button>
        )}
      </div>
    </div>
  );
}
