"use client";

import * as React from "react";
import { Button, cn } from "@playora/ui";
import { RotateCcw, Zap, Heart } from "lucide-react";
import { useArcadeRun } from "./use-arcade-run";
import { ArcadeHud, ArcadeResult } from "./ArcadeHud";
import { useJuice } from "./use-juice";
import { waveAt } from "./juice";
import { useGameRuntime } from "../runtime/use-game-runtime";
import {
  createColorState,
  stepColor,
  matchColor,
  type ColorKey,
  type RushState as ColorState,
  type Orb,
} from "./color-rush";

interface ColorSnapshot {
  orbs: Orb[];
  lives: number;
}

const COLORS: Record<ColorKey, { name: string; hex: string; bg: string }> = {
  cyan: { name: "Cyan", hex: "#06b6d4", bg: "bg-cyan-500" },
  red: { name: "Red", hex: "#ef4444", bg: "bg-rose-500" },
  green: { name: "Green", hex: "#10b981", bg: "bg-emerald-500" },
  yellow: { name: "Yellow", hex: "#f59e0b", bg: "bg-amber-500" },
};

const COLOR_KEYS: ColorKey[] = ["cyan", "red", "green", "yellow"];

export function ColorRushView({ onExit }: { onExit?: () => void }) {
  // Score, chain and the personal best come from the shared run.
  const run = useArcadeRun("color-rush");
  const juice = useJuice();
  const juiceRef = React.useRef(juice);
  juiceRef.current = juice;
  const runRef = React.useRef(run);
  runRef.current = run;

  /*
   * Lives, and a chain you can choose to bank.
   *
   * The game was a reflex test with one input and a harsh fail: match the
   * colour, and one wrong tap ended the run instantly. There was nothing to
   * decide and nothing to weigh, which is the shape the retention research
   * says goes monotonous fastest.
   *
   * Two changes give it a decision. Lives make a mistake a cost rather than an
   * ending, so pushing is survivable. Banking makes the chain a *choice*: it
   * multiplies what each match is worth and is lost entirely on a miss, so
   * every few seconds the player is deciding whether to take what they have or
   * go for more.
   */
  const [banked, setBanked] = React.useState(0);

  /*
   * One fixed-timestep simulation, replacing a spawner at a hardcoded 1100ms
   * and a fall tick at 40ms.
   *
   * Both of those numbers were constants, which meant the wave badge in the
   * HUD described an escalation the game never actually performed — orbs fell
   * at the same speed in minute five as in second five. Spawn interval now
   * comes from the shared difficulty ramp and fall speed climbs with the wave.
   */
  const rt = useGameRuntime<ColorState, ColorSnapshot>({
    create: createColorState,

    update: (st, ctx) => {
      stepColor(st, ctx.dt, {
        spawnIntervalMs: runRef.current.spawnInterval(1100),
        wave: waveAt(runRef.current.elapsed),
        rng: Math.random,
      });
      for (let i = 0; i < st.events.dropped; i++) runRef.current.miss();
      if (st.events.died) {
        juiceRef.current.impact("fatal");
        ctx.over = true;
      } else if (st.events.dropped > 0) {
        juiceRef.current.impact("heavy");
      }
    },

    snapshot: (st) => ({ orbs: st.orbs, lives: st.lives }),
    onGameOver: () => runRef.current.end(),
  });

  const { start } = rt;
  React.useEffect(() => {
    start();
  }, [start]);

  const { orbs: currentOrbs, lives } = rt.state;
  const gameOver = rt.over;

  const handleColor = (color: ColorKey) => {
    rt.mutate((st) => {
      const result = matchColor(st, color);
      if (result === "hit") {
        runRef.current.hit(10);
        juiceRef.current.impact("tap");
      } else if (result === "wrong") {
        // A miss costs a life and the whole unbanked chain — the price of
        // having pushed rather than banked.
        runRef.current.miss();
        juiceRef.current.impact(st.over ? "fatal" : "heavy");
      }
    });
  };

  /**
   * Locks the chain in as points and resets it.
   *
   * The decision the game did not have: a long chain is worth far more per
   * match, and one mistake takes all of it. Banking is the safe half of that
   * bet.
   */
  const bankChain = () => {
    if (gameOver || run.combo < 2) return;
    const value = run.combo * 15;
    setBanked((b) => b + value);
    // `bank`, not `hit`: the value is already derived from the chain, and
    // `hit` would multiply it by the chain a second time.
    run.bank(value);
    juice.impact("solid");
  };

  const restart = () => {
    setBanked(0);
    run.reset();
    rt.restart();
  };

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-white/20 bg-gradient-to-b from-[#2e1065] via-[#17072e] to-[#0b0217] p-4 sm:p-6 lg:p-8 text-white shadow-2xl">
      {/* Top Bar */}
      <div className="flex w-full items-center justify-between border-b border-white/10 pb-3 sm:pb-4">
        <div>
          <span className="text-[10px] sm:text-xs font-bold text-cyan-400 uppercase tracking-widest">
            REFLEX SPEED
          </span>
          <h2 className="font-display text-xl sm:text-3xl font-black text-white">COLOR RUSH</h2>
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
          {/* Lives: a mistake is now a cost, not an ending. */}
          <div className="rounded-xl border border-white/15 bg-black/55 px-3 py-1.5 backdrop-blur-md">
            <div className="text-[9px] font-bold uppercase tracking-widest text-white/50">Lives</div>
            <div className="flex gap-1 pt-0.5" aria-label={`${lives} lives left`}>
              {[0, 1, 2].map((i) => (
                <Heart
                  key={i}
                  className={cn("h-3.5 w-3.5", i < lives ? "fill-rose-500 text-rose-500" : "text-white/20")}
                  aria-hidden
                />
              ))}
            </div>
          </div>
          <ArcadeHud run={run} />
        </div>
      </div>

      {/* Falling Arena */}
      <div
        {...juice.shakeProps}
        className="relative my-2 sm:my-4 flex flex-1 w-full max-w-2xl flex-col items-center justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-white/20 shadow-2xl bg-cover bg-center p-4 sm:p-6"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(20,5,40,0.65), rgba(10,2,20,0.9)), url('/games/color-rush-thumb.jpg')`,
        }}
      >
        {/* Falling Orbs */}
        <div className="relative flex-1 w-full min-h-[220px]">
          {currentOrbs.map((orb) => (
            <div
              key={orb.id}
              style={{ top: `${orb.y}%`, left: "50%" }}
              className={cn(
                "absolute -translate-x-1/2 flex h-12 w-12 items-center justify-center rounded-full border-2 border-white shadow-[0_0_25px_currentColor] transition-all",
                COLORS[orb.color].bg
              )}
            >
              <span className="h-3 w-3 rounded-full bg-white animate-ping" />
            </div>
          ))}
        </div>

        {/* Target Prism Ring */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/40 bg-black/60 shadow-[0_0_30px_rgba(168,85,247,0.5)]">
          <Zap className="h-8 w-8 text-cyan-400 animate-pulse" />
        </div>

        {gameOver && (
          <ArcadeResult run={run} onRestart={restart} onExit={onExit} title="Run over" />
        )}
      </div>

      {/*
        * Bank, beside the colour pads.
        *
        * Only offered once there is a chain worth protecting — a button that
        * does nothing most of the time teaches the player to ignore it.
        */}
      {run.combo >= 2 && !gameOver && (
        <button
          type="button"
          onClick={bankChain}
          className="mb-2 flex items-center gap-2 rounded-2xl border border-emerald-400/60 bg-emerald-500/20 px-6 py-2.5 font-display text-sm font-black uppercase tracking-wide text-emerald-200 transition-transform active:scale-95"
        >
          Bank {run.combo * 15}
          {banked > 0 && (
            <span className="text-[10px] font-bold text-emerald-300/70">({banked} saved)</span>
          )}
        </button>
      )}

      {/* 4 Quadrant Match Buttons */}
      <div className="grid w-full max-w-md grid-cols-4 gap-3 border-t border-white/10 pt-4">
        {COLOR_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onPointerDown={() => handleColor(k)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-2xl py-3 font-display text-xs font-black uppercase text-white shadow-xl transition-transform active:scale-90",
              COLORS[k].bg
            )}
          >
            <span>{COLORS[k].name}</span>
          </button>
        ))}
      </div>

      {/* Footer controls */}
      <div className="flex w-full items-center justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={restart} className="gap-2 text-white/70 hover:text-white">
          <RotateCcw className="h-4 w-4" /> Restart
        </Button>
        {onExit && (
          <Button variant="outline" size="sm" onClick={onExit} className="border-white/20 text-white">
            Exit
          </Button>
        )}
      </div>
    </div>
  );
}
