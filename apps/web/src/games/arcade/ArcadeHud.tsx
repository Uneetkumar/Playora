"use client";

import * as React from "react";
import { cn } from "@playora/ui";
import { Flame, Trophy } from "lucide-react";
import { formatScore } from "./scoring";
import type { ArcadeRun } from "./use-arcade-run";

/**
 * The score readout every arcade game shares.
 *
 * One component rather than ten, because these games previously each drew
 * their own — where they drew one at all — and a player moving between them
 * had to relearn where the number lived every time.
 *
 * The personal best sits next to the live score on purpose. A score with
 * nothing beside it is just a number; a score beside the one to beat is a goal,
 * and that is the whole difference between one round and five.
 */
export function ArcadeHud({ run, className }: { run: ArcadeRun; className?: string }) {
  const chasing = run.best > 0 && run.score < run.best;

  return (
    <div className={cn("flex items-center gap-2 sm:gap-3", className)}>
      <div className="rounded-xl border border-white/15 bg-black/55 px-3 py-1.5 backdrop-blur-md">
        <div className="text-[9px] font-bold uppercase tracking-widest text-white/50">Score</div>
        <div className="numeric text-lg font-black leading-none text-white tabular-nums sm:text-xl">
          {formatScore(run.score)}
        </div>
      </div>

      {run.best > 0 && (
        <div
          className={cn(
            "rounded-xl border px-3 py-1.5 backdrop-blur-md transition-colors",
            chasing
              ? "border-white/15 bg-black/55"
              : // Passed it mid-run: say so immediately rather than saving the
                // news for the result screen.
                "border-amber-400/60 bg-amber-500/20",
          )}
        >
          <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-white/50">
            <Trophy className="h-2.5 w-2.5" aria-hidden />
            {chasing ? "Best" : "Ahead"}
          </div>
          <div className="numeric text-lg font-black leading-none text-white tabular-nums sm:text-xl">
            {formatScore(run.best)}
          </div>
        </div>
      )}

      {run.combo >= 2 && (
        <div
          className="flex items-center gap-1 rounded-xl border border-orange-400/60 bg-orange-500/20 px-3 py-1.5 backdrop-blur-md"
          // Announced politely: a combo counter that interrupts a screen reader
          // on every hit is unusable.
          aria-live="polite"
        >
          <Flame className="h-3.5 w-3.5 text-orange-300" aria-hidden />
          <span className="numeric text-lg font-black leading-none text-orange-200 tabular-nums sm:text-xl">
            {run.combo}
          </span>
          <span className="text-[10px] font-black text-orange-300/80">CHAIN</span>
        </div>
      )}
    </div>
  );
}

/**
 * The end-of-run panel every arcade game shares.
 *
 * Leads with whether the best was beaten, because that is the only question a
 * player has at the end of a run.
 */
export function ArcadeResult({
  run,
  onRestart,
  onExit,
  title = "Run over",
}: {
  run: ArcadeRun;
  onRestart: () => void;
  onExit?: () => void;
  title?: string;
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-[#0d1020] p-6 text-center shadow-2xl">
        {run.isNewBest ? (
          <>
            <Trophy className="mx-auto h-10 w-10 text-amber-400" aria-hidden />
            <p className="mt-2 font-display text-2xl font-black text-amber-300">NEW BEST!</p>
          </>
        ) : (
          <p className="font-display text-2xl font-black text-white">{title}</p>
        )}

        <div className="numeric mt-4 text-5xl font-black text-white tabular-nums">
          {formatScore(run.score)}
        </div>

        {!run.isNewBest && run.best > 0 && (
          <p className="mt-1 text-xs text-white/60">
            Best {formatScore(run.best)} — {formatScore(run.best - run.score)} to beat it
          </p>
        )}

        {run.bestCombo >= 2 && (
          <p className="mt-3 text-xs font-semibold text-orange-300">
            Longest chain {run.bestCombo}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onRestart}
            className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition-transform active:scale-95"
          >
            Play again
          </button>
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="flex-1 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-bold text-white/80 transition-colors hover:bg-white/10"
            >
              Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
