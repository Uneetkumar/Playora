"use client";

import * as React from "react";
import { Button, cn } from "@playora/ui";
import { Trophy, RotateCcw, Flame } from "lucide-react";
import { useArcadeRun } from "./use-arcade-run";
import { ArcadeHud } from "./ArcadeHud";
import { useJuice } from "./use-juice";
import { waveAt } from "./juice";
import { useGameRuntime } from "../runtime/use-game-runtime";
import {
  createPotatoState,
  stepPotato,
  passPotato,
  type PotatoState,
  type PotatoPlayer,
} from "./hot-potato";

interface PotatoSnapshot {
  players: PotatoPlayer[];
  holder: number;
  held: number;
  winner: string | null;
}
import { holdBonus, formatScore } from "./scoring";
import { PlayerToken } from "./ArcadeSprites";

export function HotPotatoView({ onExit }: { onExit?: () => void }) {
  // Passing the potato on is the skill; each successful pass scores and
  // extends the chain, and holding it when it goes off ends the run.
  const run = useArcadeRun("hot-potato");
  const juice = useJuice();
  const juiceRef = React.useRef(juice);
  juiceRef.current = juice;
  const runRef = React.useRef(run);
  runRef.current = run;

  /*
   * One simulation, replacing three overlapping mechanisms.
   *
   * This view previously ran a 100ms `setInterval`, a `latest` ref mirroring
   * players/holder/gameOver so that interval could read them, and a separate
   * `setTimeout` for each bot's pass. The mirror existed because the original
   * did its work inside `setTimerSeconds(t => ...)`, calling four other
   * setters from within a state updater — which React re-invokes when it
   * re-bases an update and double-invokes under StrictMode, so one logical
   * tick eliminated two players and moved the potato twice.
   *
   * A fixed step over plain state removes the updater, the mirror and the
   * second timer together.
   */
  const rt = useGameRuntime<PotatoState, PotatoSnapshot>({
    create: () => createPotatoState(),

    update: (st, ctx) => {
      stepPotato(st, ctx.dt, { wave: waveAt(runRef.current.elapsed), rng: Math.random });
      if (st.events.botPassed) juiceRef.current.impact("tap");
      if (st.events.exploded) {
        juiceRef.current.impact(st.events.died ? "fatal" : "heavy");
      }
      if (st.over) ctx.over = true;
    },

    snapshot: (st) => ({
      players: st.players,
      holder: st.holder,
      held: st.held,
      winner: st.winner,
    }),
    onGameOver: () => runRef.current.end(),
  });

  const { start } = rt;
  React.useEffect(() => {
    start();
  }, [start]);

  const { players, holder: currentIndex, held: heldSeconds, winner } = rt.state;
  const gameOver = rt.over;

  const handlePass = () => {
    rt.mutate((st) => {
      passPotato(st, { wave: waveAt(runRef.current.elapsed), rng: Math.random });
      /*
       * The pass banks whatever the hold was worth.
       *
       * Only the human's passes score: a bot handing it on is not the player's
       * doing. The impact scales with the bank, so a nervy four-second hold
       * lands differently from an instant toss — the feedback that teaches the
       * risk is real.
       */
      const heldFor = st.events.humanPassedAfter;
      if (heldFor !== null) {
        const banked = holdBonus(heldFor);
        runRef.current.hit(banked);
        juiceRef.current.impact(banked > 120 ? "solid" : "tap");
      } else {
        juiceRef.current.impact("tap");
      }
    });
  };

  const restart = () => {
    run.reset();
    rt.restart();
  };

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-white/20 bg-gradient-to-b from-[#451a03] via-[#270d02] to-[#120501] p-4 sm:p-6 lg:p-8 text-white shadow-2xl">
      {/* Top Bar */}
      <div className="flex w-full items-center justify-between border-b border-white/10 pb-3 sm:pb-4">
        <div>
          <span className="text-[10px] sm:text-xs font-bold text-amber-400 uppercase tracking-widest">
            PARTY CIRCLE GAME
          </span>
          <h2 className="font-display text-xl sm:text-3xl font-black text-white">HOT POTATO</h2>
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
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/40 px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-bold text-amber-300 flex items-center gap-1.5 animate-pulse">
          <Flame className="h-4 w-4 text-amber-400" /> SIZZLING!
        </div>
      </div>

      {/* Circle Arena */}
      <div
        {...juice.shakeProps}
        className="relative my-2 sm:my-4 flex flex-1 aspect-square max-h-[380px] sm:max-h-[460px] w-full max-w-xl items-center justify-center rounded-full border-4 border-amber-500/30 shadow-2xl bg-cover bg-center p-4 sm:p-6 select-none"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(40,15,5,0.65), rgba(15,5,2,0.9)), url('/games/hot-potato-thumb.jpg')`,
        }}
      >
        {players.map((p, idx) => {
          const angle = (idx / players.length) * 2 * Math.PI - Math.PI / 2;
          const x = 50 + 36 * Math.cos(angle);
          const y = 50 + 36 * Math.sin(angle);
          const isHolding = currentIndex === idx;

          if (p.eliminated) {
            return (
              <div
                key={p.id}
                style={{ left: `${x}%`, top: `${y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 opacity-30 text-xs line-through text-slate-500"
              >
                💥 {p.name}
              </div>
            );
          }

          return (
            <div
              key={p.id}
              style={{ left: `${x}%`, top: `${y}%` }}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 rounded-2xl border p-2.5 transition-all",
                isHolding
                  ? "border-amber-400 bg-amber-950/80 shadow-[0_0_25px_rgba(245,158,11,0.8)] scale-110 animate-bounce"
                  : "border-white/15 bg-black/60"
              )}
            >
              {/*
                * A token that dims and crosses out when eliminated, which an
                * emoji face could not do — the previous version left a knocked
                * out player looking exactly like a live one.
                */}
              <PlayerToken seat={idx} size={36} eliminated={p.eliminated} />
              <span className="text-[10px] font-bold text-white">{p.name}</span>
            </div>
          );
        })}

        {/* Center Prompt */}
        <div className="flex flex-col items-center text-center">
          {currentIndex === 0 && !players[0]?.eliminated ? (
            /*
             * The button carries the decision.
             *
             * It shows what tossing right now banks, and heats up the longer it
             * is held — that heat is the only tension signal the player gets.
             * The fuse itself stays hidden on purpose: showing it would turn
             * the gamble back into a countdown, and the whole point is that you
             * are betting on how long you have rather than reading it off a
             * clock.
             */
            <button
              type="button"
              onPointerDown={handlePass}
              style={{
                // Interpolates amber -> deep red over roughly four seconds of
                // holding, which is where the risk starts to bite.
                backgroundImage: `linear-gradient(90deg, hsl(${Math.max(0, 38 - heldSeconds * 9)} 95% 52%), hsl(${Math.max(0, 22 - heldSeconds * 8)} 95% 45%))`,
                transform: `scale(${1 + Math.min(0.12, heldSeconds * 0.03)})`,
              }}
              className="flex flex-col items-center gap-0.5 rounded-2xl px-8 py-3.5 font-display text-white shadow-2xl transition-transform active:scale-90"
            >
              <span className="text-sm font-black uppercase tracking-wide">Toss it</span>
              <span className="numeric text-xs font-bold tabular-nums text-white/90">
                banks {formatScore(holdBonus(heldSeconds))}
              </span>
            </button>
          ) : (
            <span className="text-xs font-bold text-white/50">Passing in circle...</span>
          )}
        </div>

        {gameOver && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md rounded-full">
            <Trophy className="h-12 w-12 text-amber-400 animate-bounce" />
            <h3 className="font-display text-3xl font-black text-white mt-2">WINNER: {winner}</h3>
            <p className="text-sm text-white/70">Survived the sizzling potato party!</p>
            <Button onClick={restart} className="mt-4 gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] px-6 font-bold">
              <RotateCcw className="h-4 w-4" /> Play Again
            </Button>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="flex w-full items-center justify-between border-t border-white/10 pt-4">
        <p className="text-xs text-white/60">Hold the potato to bank more — but the fuse is hidden, and it is getting shorter.</p>

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
