"use client";

import * as React from "react";
import { Button } from "@playora/ui";
import { RotateCcw, Clock } from "lucide-react";
import { useArcadeRun } from "./use-arcade-run";
import { ArcadeHud, ArcadeResult } from "./ArcadeHud";
import { TargetSprite } from "./ArcadeSprites";
import { useJuice } from "./use-juice";
import { waveAt } from "./juice";
import { useGameRuntime } from "../runtime/use-game-runtime";
import {
  createRushState,
  stepRush,
  removeTarget,
  type RushState,
  type Target,
} from "./target-rush";

interface RushSnapshot {
  timeLeft: number;
  targets: Target[];
}

export function TargetRushView({ onExit }: { onExit?: () => void }) {
  /*
   * Score, combo, difficulty and the personal best all come from the shared
   * run. The local versions scored a flat `25 * (1 + combo * 0.1)` and threw
   * the total away at the end, so a run had nothing to be measured against.
   */
  const run = useArcadeRun("target-rush");
  const runRef = React.useRef(run);
  runRef.current = run;
  const juice = useJuice();

  /*
   * One clock.
   *
   * This game used to run two `setInterval`s — a 1s countdown and a spawner on
   * `run.spawnInterval(650)` — plus React state for both. Three problems came
   * with that:
   *
   *   - The two timers drifted apart, and browsers throttle them by different
   *     amounts in a background tab, so the round length and the number of
   *     targets you faced were not the same run twice.
   *   - Every spawn and every tick was a React render.
   *   - The countdown had to be decided from a ref because `setTimeLeft(fn)`
   *     queues the updater, so reading a flag it sets on the next line always
   *     read the previous value. That comment is gone with the bug.
   *
   * Now: one fixed 60Hz simulation, mutating plain state, publishing a
   * snapshot once per frame.
   */
  const rt = useGameRuntime<RushState, RushSnapshot>({
    create: createRushState,

    update: (s, ctx) => {
      stepRush(s, ctx.dt, {
        spawnIntervalMs: runRef.current.spawnInterval(650),
        rng: Math.random,
      });
      // A bullseye that timed out is a broken chain, reported by the
      // simulation rather than decided here.
      for (let i = 0; i < s.expiredThisStep; i++) runRef.current.miss();
      if (s.over) ctx.over = true;
    },

    snapshot: (s) => ({ timeLeft: Math.ceil(s.timeLeft), targets: s.targets }),
    onGameOver: () => runRef.current.end(),
  });

  // Start once the component is mounted and the loop exists.
  const { start } = rt;
  React.useEffect(() => {
    start();
  }, [start]);

  const shootTarget = (target: Target) => {
    if (rt.over) return;

    // Through `mutate`, not `rt.state` — that is the published snapshot, and
    // writing to it would change what was drawn while leaving the simulation
    // holding the target.
    rt.mutate((s) => {
      removeTarget(s, target.id);
    });

    if (target.type === "tnt") {
      // TNT breaks the chain, which costs far more than the points do once a
      // run is going well — that is the point of it.
      run.miss();
      juice.impact("heavy");
    } else {
      run.hit(target.type === "gold" ? 75 : 25);
      // Gold is worth noticing; a routine bullseye is not. Shaking equally for
      // both teaches the player to ignore the shake.
      juice.impact(target.type === "gold" ? "solid" : "tap");
    }
  };

  const restart = () => {
    run.reset();
    rt.restart();
  };

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-white/20 bg-gradient-to-b from-[#3b0764] via-[#1e053a] to-[#0f021f] p-4 sm:p-6 lg:p-8 text-white shadow-2xl">
      {/* Top Bar */}
      <div className="flex w-full items-center justify-between border-b border-white/10 pb-3 sm:pb-4">
        <div>
          <span className="text-[10px] sm:text-xs font-bold text-rose-400 uppercase tracking-widest">
            SHOOTING RANGE
          </span>
          <h2 className="font-display text-xl sm:text-3xl font-black text-white">TARGET RUSH</h2>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-bold text-white">
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-cyan-400" />
            {rt.state.timeLeft}s
          </div>
          {/*
            * The wave, shown.
            *
            * The difficulty ramp already existed but was invisible, and an
            * escalation a player cannot see does not read as escalation — it
            * reads as the game quietly becoming unfair. Naming it turns the
            * same curve into something they can feel themselves surviving.
            */}
          <div className="rounded-xl border border-white/15 bg-black/55 px-3 py-1.5 backdrop-blur-md">
            <div className="text-[9px] font-bold uppercase tracking-widest text-white/50">Wave</div>
            <div className="numeric text-lg font-black leading-none text-white tabular-nums sm:text-xl">
              {waveAt(run.elapsed)}
            </div>
          </div>
          <ArcadeHud run={run} />
        </div>
      </div>

      {/* Main Shooting Range */}
      <div
        ref={rt.containerRef}
        {...juice.shakeProps}
        className="relative my-2 sm:my-4 flex flex-1 w-full max-w-4xl cursor-crosshair items-center justify-center overflow-hidden rounded-2xl sm:rounded-3xl border border-white/20 shadow-2xl bg-cover bg-center select-none touch-none"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(25,10,40,0.65), rgba(10,3,20,0.9)), url('/games/target-rush-thumb.jpg')`,
        }}
      >
        {rt.state.targets.map((t) => (
          <button
            key={t.id}
            type="button"
            onPointerDown={() => shootTarget(t)}
            style={{ left: `${t.x}%`, top: `${t.y}%` }}
            aria-label={t.type === "tnt" ? "TNT — do not shoot" : t.type === "gold" ? "Bonus target" : "Target"}
            /*
             * `onPointerDown` rather than `onClick`: a tap fires click only
             * after the browser has waited to rule out a double-tap, which in
             * a timed game reads as the game ignoring you. Pointer events also
             * cover mouse, touch and pen through one path.
             *
             * The sprite carries the artwork, so the button carries nothing but
             * position and the press feedback.
             */
            className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform duration-100 hover:scale-110 active:scale-125 drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
          >
            <TargetSprite
              kind={t.type}
              size={t.size}
              className={t.type === "tnt" ? "animate-pulse" : undefined}
            />
          </button>
        ))}

        {rt.over && (
          <ArcadeResult run={run} onRestart={restart} onExit={onExit} title="Time up!" />
        )}
      </div>

      {/* Bottom Bar */}
      <div className="flex w-full items-center justify-between border-t border-white/10 pt-4">
        <p className="text-xs text-white/60">
          Pop targets before they vanish to build streaks. Avoid hitting TNT bombs!
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
