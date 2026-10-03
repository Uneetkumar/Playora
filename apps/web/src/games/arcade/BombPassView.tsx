"use client";

import * as React from "react";
import { Button, cn } from "@playora/ui";
import { Trophy, RotateCcw } from "lucide-react";
import { useArcadeRun } from "./use-arcade-run";
import { ArcadeHud } from "./ArcadeHud";
import { useJuice } from "./use-juice";
import { waveAt } from "./juice";
import { bombHoldValue, formatScore } from "./scoring";
import { BombSprite, PlayerToken } from "./ArcadeSprites";
import { useGameRuntime } from "../runtime/use-game-runtime";
import {
  createBombState,
  stepBomb,
  passBomb,
  type BombState,
  type BombPlayer,
} from "./bomb-pass";

interface BombSnapshot {
  players: BombPlayer[];
  holderId: string;
  fuse: number;
  held: number;
  round: number;
  winner: string | null;
}

export function BombPassView({ onExit }: { onExit?: () => void }) {
  // Surviving a round scores; holding the bomb when it goes off ends the run.
  const run = useArcadeRun("bomb-pass");
  const juice = useJuice();
  const juiceRef = React.useRef(juice);
  juiceRef.current = juice;
  const runRef = React.useRef(run);
  runRef.current = run;

  /*
   * One simulation, replacing a 100ms fuse tick, a 1200ms AI loop and the
   * `latest` ref that mirrored state so both could read it. That mirror
   * existed because the original ran its elimination inside
   * `setFuseTime(t => ...)`, which StrictMode double-invokes.
   *
   * The extraction surfaced two gameplay bugs, both now fixed in
   * `bomb-pass.ts`: the fuse reset to a hardcoded 7.0 regardless of wave, and
   * bots rolled a flat 35% pass chance blind to how much fuse was left.
   */
  const rt = useGameRuntime<BombState, BombSnapshot>({
    create: createBombState,

    update: (st, ctx) => {
      stepBomb(st, ctx.dt, { wave: waveAt(runRef.current.elapsed), rng: Math.random });
      if (st.events.survivedRound) runRef.current.hit(50);
      if (st.events.exploded) {
        // The bomb going off is the loudest thing in this game.
        juiceRef.current.impact(st.events.died ? "fatal" : "heavy");
      }
      if (st.over) ctx.over = true;
    },

    snapshot: (st) => ({
      players: st.players,
      holderId: st.holderId,
      fuse: st.fuse,
      held: st.held,
      round: st.round,
      winner: st.winner,
    }),
    onGameOver: () => runRef.current.end(),
  });

  const { start } = rt;
  React.useEffect(() => {
    start();
  }, [start]);

  const {
    players,
    holderId: bombHolderId,
    fuse: fuseTime,
    held: heldSeconds,
    round,
    winner,
  } = rt.state;
  const gameOver = rt.over;

  const passBombTo = (targetId: string) => {
    rt.mutate((st) => {
      /*
       * The pass banks the hold — and the fuse does *not* reset, so whoever
       * receives it inherits however little is left. That is the whole
       * strategy: hold long enough to be worth something, then hand on a bomb
       * nobody can survive.
       */
      const held = passBomb(st, targetId);
      if (held === null) return;
      const banked = bombHoldValue(held);
      if (banked > 0) {
        runRef.current.bank(banked);
        juiceRef.current.impact(banked > 200 ? "solid" : "tap");
      }
    });
  };

  const restart = () => {
    run.reset();
    rt.restart();
  };

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-white/20 bg-gradient-to-b from-[#450a0a] via-[#1c0505] to-[#0c0202] p-4 sm:p-6 lg:p-8 text-white shadow-2xl">
      {/* Top Bar */}
      <div className="flex w-full items-center justify-between border-b border-white/10 pb-3 sm:pb-4">
        <div>
          <span className="text-[10px] sm:text-xs font-bold text-rose-400 uppercase tracking-widest">
            PARTY ELIMINATION
          </span>
          <h2 className="font-display text-xl sm:text-3xl font-black text-white">BOMB PASS</h2>
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
          {bombHolderId === "p1" && heldSeconds > 0 && (
            /*
             * What is riding on the current hold.
             *
             * Unlike Hot Potato this sits beside a visible fuse, so the player
             * is weighing a number they can see against a clock they can also
             * see — a judgement call rather than a blind gamble, which is what
             * makes the two games feel different despite the same skeleton.
             */
            <div className="rounded-xl border border-rose-400/60 bg-rose-500/20 px-3 py-1.5 backdrop-blur-md">
              <div className="text-[9px] font-bold uppercase tracking-widest text-rose-200/70">
                At risk
              </div>
              <div className="numeric text-lg font-black leading-none text-rose-100 tabular-nums sm:text-xl">
                {formatScore(bombHoldValue(heldSeconds))}
              </div>
            </div>
          )}
          <ArcadeHud run={run} />
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/60 px-3 sm:px-4 py-1 sm:py-1.5 font-display text-base sm:text-xl font-black text-rose-400 animate-pulse">
            💥 {fuseTime.toFixed(1)}s
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-bold text-white/80">
            ROUND {round}
          </div>
        </div>
      </div>

      {/* Main Arena */}
      <div
        {...juice.shakeProps}
        className="relative my-2 sm:my-4 flex flex-1 w-full max-w-4xl items-center justify-center overflow-hidden rounded-2xl sm:rounded-3xl border border-white/20 shadow-2xl bg-cover bg-center select-none"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(25,5,5,0.7), rgba(10,2,2,0.9)), url('/games/bomb-pass-thumb.jpg')`,
        }}
      >
        {players.map((p, i) => {
          const hasBomb = bombHolderId === p.id;
          if (!p.alive) {
            return (
              <div
                key={p.id}
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 opacity-30 text-xs font-bold text-slate-500 line-through"
              >
                💀 {p.name}
              </div>
            );
          }

          return (
            <button
              key={p.id}
              type="button"
              onClick={() => passBombTo(p.id)}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all active:scale-95",
                hasBomb
                  ? "border-rose-400 bg-rose-950/80 shadow-[0_0_30px_rgba(244,63,94,0.8)] scale-110 animate-bounce"
                  : "border-white/15 bg-black/60 hover:border-white/40"
              )}
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl border shadow-lg"
                style={{ borderColor: p.color, backgroundColor: `${p.color}30` }}
              >
                {/*
                 * The bomb is armed whenever someone is holding it, so the fuse
                 * animates on whoever is actually in danger — the emoji it
                 * replaces could not show that at all.
                 */}
                {hasBomb ? (
                  <BombSprite size={34} armed />
                ) : (
                  <PlayerToken seat={i} size={30} eliminated={!p.alive} />
                )}
              </div>
              <span className="text-[11px] font-bold text-white">{p.name}</span>
              {hasBomb && (
                <span className="rounded bg-rose-600 px-1.5 py-0.2 text-[8px] font-black text-white uppercase animate-pulse">
                  HOT BOMB!
                </span>
              )}
              {bombHolderId === "p1" && p.id !== "p1" && (
                <span className="rounded bg-cyan-500 px-1.5 py-0.2 text-[8px] font-bold text-black uppercase">
                  TAP TO PASS
                </span>
              )}
            </button>
          );
        })}

        {gameOver && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md">
            <Trophy className="h-12 w-12 text-amber-400 animate-bounce" />
            <h3 className="font-display text-3xl font-black text-white mt-2">WINNER: {winner}</h3>
            <p className="text-sm text-white/70">Last player standing survived the blast!</p>
            <Button onClick={restart} className="mt-4 gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] px-6 font-bold">
              <RotateCcw className="h-4 w-4" /> Play Again
            </Button>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="flex w-full items-center justify-between border-t border-white/10 pt-4">
        <p className="text-xs text-white/60">
          {bombHolderId === "p1"
            ? "Holding pays — but the fuse carries over when you pass. Bail too late and it is yours."
            : "The fuse does not reset. Whoever is holding it when it hits zero is out."}
        </p>

        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={restart} className="gap-2 text-white/70 hover:text-white">
            <RotateCcw className="h-4 w-4" /> Restart
          </Button>
          {onExit && (
            <Button variant="outline" onClick={onExit} className="border-white/20 text-white">
              Exit
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
