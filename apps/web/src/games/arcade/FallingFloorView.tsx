"use client";

import * as React from "react";
import { Button, cn } from "@playora/ui";
import { Trophy, RotateCcw, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";
import { useArcadeRun } from "./use-arcade-run";
import { ArcadeHud } from "./ArcadeHud";
import { useJuice } from "./use-juice";
import { waveAt } from "./juice";
import { useGameRuntime } from "../runtime/use-game-runtime";
import {
  createFloorState,
  stepFloor,
  moveFloor,
  GRID,
  type FloorState,
  type HexTile,
} from "./falling-floor";

interface FloorSnapshot {
  tiles: HexTile[];
  layer: number;
  row: number;
  col: number;
  survived: number;
  prize: { row: number; col: number } | null;
}

export function FallingFloorView({ onExit }: { onExit?: () => void }) {
  /*
   * Surviving is the score. A second on the floor is worth ten points, and the
   * chain grows for every second you last — so the difference between a good
   * run and a great one widens the longer you stay alive, which is the shape a
   * survival game wants.
   */
  const run = useArcadeRun("falling-floor");
  const juice = useJuice();
  const juiceRef = React.useRef(juice);
  juiceRef.current = juice;
  const runRef = React.useRef(run);
  runRef.current = run;

  /*
   * One simulation, on the shared fixed-timestep runtime.
   *
   * The collapse used to be a `setTimeout` per tile, created inside an effect
   * that depended on `tiles` — so it re-ran constantly, and needed a cleanup
   * to stop a pending collapse from a previous run dropping the floor out from
   * under a player who had done nothing. The countdown lives on the tile now,
   * which deletes the timer and the bug together.
   *
   * The collapse delay also tightens with the wave. It was a flat 800ms, so
   * the difficulty ramp the HUD advertised did not exist on the floor itself.
   */
  const rt = useGameRuntime<FloorState, FloorSnapshot>({
    create: () => createFloorState(),

    update: (st, ctx) => {
      stepFloor(st, ctx.dt, { wave: waveAt(runRef.current.elapsed), rng: Math.random });
      applyEvents(st);
      if (st.over) ctx.over = true;
    },

    snapshot: (st) => ({
      tiles: st.tiles,
      layer: st.layer,
      row: st.row,
      col: st.col,
      survived: Math.floor(st.survived),
      prize: st.prize,
    }),
    onGameOver: () => runRef.current.end(),
  });

  /** Turns simulation events into score and feel. */
  const applyEvents = (st: FloorState) => {
    for (let i = 0; i < st.events.secondsSurvived; i++) runRef.current.hit(10);
    if (st.events.prizeTaken) {
      // Worth about eight seconds of survival: enough to be worth crossing
      // weakened ground for, not enough to make survival pointless.
      runRef.current.hit(80);
      juiceRef.current.impact("solid");
    }
    if (st.events.fellThrough) juiceRef.current.impact("heavy");
    if (st.events.died) juiceRef.current.impact("fatal");
  };

  const { start } = rt;
  React.useEffect(() => {
    start();
  }, [start]);

  const move = (dr: number, dc: number) => {
    rt.mutate((st) => {
      moveFloor(st, dr, dc, { wave: waveAt(runRef.current.elapsed), rng: Math.random });
      applyEvents(st);
    });
  };

  /** Clicking a tile walks one step towards it, so a tap cannot teleport. */
  const stepToward = (r: number, c: number) => {
    rt.mutate((st) => {
      const dr = Math.sign(r - st.row);
      const dc = Math.sign(c - st.col);
      if (dr === 0 && dc === 0) return;
      // One axis at a time keeps a diagonal tap from crossing two tiles.
      moveFloor(st, dr !== 0 ? dr : 0, dr !== 0 ? 0 : dc, {
        wave: waveAt(runRef.current.elapsed),
        rng: Math.random,
      });
      applyEvents(st);
    });
  };

  const restart = () => {
    run.reset();
    rt.restart();
  };

  const { tiles, layer: playerLayer, row: playerRow, col: playerCol, survived: survivedSecs, prize } =
    rt.state;
  const gameOver = rt.over;

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-white/20 bg-gradient-to-b from-[#311042] via-[#180824] to-[#0c0412] p-4 sm:p-6 lg:p-8 text-white shadow-2xl">
      {/* Top Bar */}
      <div className="flex w-full items-center justify-between border-b border-white/10 pb-3 sm:pb-4">
        <div>
          <span className="text-[10px] sm:text-xs font-bold text-purple-400 uppercase tracking-widest">
            SURVIVAL KNOCKOUT
          </span>
          <h2 className="font-display text-xl sm:text-3xl font-black text-white">FALLING FLOOR</h2>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/*
            * The wave, shown.
            *
            * The difficulty ramp already existed but was invisible, and
            * escalation a player cannot see reads as the game quietly becoming
            * unfair rather than as something they are surviving.
            */}
          <div className="rounded-xl border border-white/15 bg-black/55 px-3 py-1.5 backdrop-blur-md">
            <div className="text-[9px] font-bold uppercase tracking-widest text-white/50">Wave</div>
            <div className="numeric text-lg font-black leading-none text-white tabular-nums sm:text-xl">
              {waveAt(run.elapsed)}
            </div>
          </div>
          <ArcadeHud run={run} />
          <div className="rounded-xl border border-purple-500/30 bg-purple-950/40 px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-bold text-purple-300">
            LAYER {playerLayer}/3
          </div>
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/40 px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-black text-cyan-300">
            TIME: {survivedSecs}s
          </div>
        </div>
      </div>

      {/* Hex Grid Arena */}
      <div
        ref={rt.containerRef}
        {...juice.shakeProps}
        className="relative my-2 sm:my-4 flex flex-1 w-full max-w-2xl items-center justify-center rounded-2xl sm:rounded-3xl border border-white/20 shadow-2xl bg-cover bg-center p-3 sm:p-6 select-none touch-none"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(20,5,35,0.75), rgba(8,2,15,0.9)), url('/games/falling-floor-thumb.jpg')`,
        }}
      >
        <div className="grid grid-cols-5 gap-2 sm:gap-4 p-2 sm:p-4 rounded-2xl bg-black/60 backdrop-blur-xl border border-purple-500/30 shadow-2xl">
          {Array.from({ length: GRID }).map((_, r) =>
            Array.from({ length: GRID }).map((_, c) => {
              const tile = tiles.find(
                (t) => t.layer === playerLayer && t.row === r && t.col === c
              );
              const isPlayerHere = playerRow === r && playerCol === c;

              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  onPointerDown={() => stepToward(r, c)}
                  className={cn(
                    "relative flex h-14 w-14 sm:h-20 sm:w-20 items-center justify-center rounded-2xl border-2 transition-all duration-300 font-bold backdrop-blur-sm",
                    tile?.state === "collapsed"
                      ? "border-transparent bg-transparent opacity-5 pointer-events-none scale-75"
                      : tile?.state === "shaking"
                      ? "border-rose-400 bg-gradient-to-br from-rose-600/90 to-rose-950/90 shadow-[0_0_25px_rgba(244,63,94,0.9)] animate-bounce"
                      : "border-purple-400/40 bg-gradient-to-br from-purple-900/60 via-purple-950/80 to-black/90 hover:border-purple-300 shadow-[0_4px_15px_rgba(0,0,0,0.5)] hover:scale-105",
                    isPlayerHere && "ring-4 ring-cyan-400 ring-offset-4 ring-offset-black shadow-[0_0_30px_#22d3ee]"
                  )}
                >
                  {/*
                    * The prize, drawn on the tile it sits on.
                    *
                    * Reaching it is the only reason one direction is better
                    * than another — without it every move was worth the same
                    * and the best play was to shuffle in a safe corner.
                    */}
                  {tile?.state !== "collapsed" &&
                    !isPlayerHere &&
                    prize?.row === r &&
                    prize?.col === c && (
                      <span
                        className="text-xl sm:text-2xl drop-shadow-[0_0_10px_rgba(250,204,21,0.9)] animate-pulse"
                        aria-label="Prize"
                      >
                        ★
                      </span>
                    )}

                  {tile?.state !== "collapsed" &&
                    !isPlayerHere &&
                    !(prize?.row === r && prize?.col === c) && (
                      <span className="text-[9px] font-mono tracking-tighter text-purple-400/50 uppercase">
                        L{playerLayer}
                      </span>
                    )}
                  {isPlayerHere && (
                    <div className="flex h-11 w-11 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-gradient-to-tr from-cyan-500 to-cyan-300 text-black text-2xl sm:text-3xl shadow-[0_0_20px_#22d3ee] animate-pulse">
                      🏃
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {gameOver && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md">
            <Trophy className="h-14 w-14 text-amber-400 animate-bounce drop-shadow-[0_0_20px_#f59e0b]" />
            <h3 className="font-display text-4xl font-black text-white mt-3 tracking-tight">FALLEN INTO ABYSS</h3>
            <p className="text-base text-white/70 mt-1">Survived: <strong className="text-cyan-400 font-black">{survivedSecs} seconds</strong></p>
            <Button onClick={restart} className="mt-5 gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 px-8 py-3 text-base font-black shadow-[0_0_25px_rgba(124,58,237,0.6)]">
              <RotateCcw className="h-5 w-5" /> Try Again
            </Button>
          </div>
        )}
      </div>

      {/* Directional Pad */}
      <div className="flex w-full items-center justify-between border-t border-white/10 pt-4">
        <p className="text-xs text-white/60">Arrows, WASD or tap a neighbouring tile. Step off before it drops!</p>

        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => move(0, -1)} className="border-white/20 text-white">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-col gap-1">
            <Button variant="outline" size="sm" onClick={() => move(-1, 0)} className="border-white/20 text-white">
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => move(1, 0)} className="border-white/20 text-white">
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => move(0, 1)} className="border-white/20 text-white">
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
