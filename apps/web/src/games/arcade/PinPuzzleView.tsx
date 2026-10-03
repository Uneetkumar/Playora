"use client";

import * as React from "react";
import { Button } from "@playora/ui";
import { RotateCcw, Lightbulb } from "lucide-react";
import { useArcadeRun } from "./use-arcade-run";
import { ArcadeHud } from "./ArcadeHud";
import { buildPinLevel, canPull, chamberAfter, isDeadEnd, isSolved, nextSafePin } from "./pin-puzzle";
import { useJuice } from "./use-juice";

const CONTENT_LABEL = { water: "W", gold: "G", rock: "R" } as const;
const CONTENT_FILL = { water: "#0ea5e9", gold: "#facc15", rock: "#94a3b8" } as const;

export function PinPuzzleView({ onExit }: { onExit?: () => void }) {
  const [level, setLevel] = React.useState(1);
  // A solved board scores; a melted one ends the run. Levels carry the
  // difficulty, so the score is simply how far you got.
  const run = useArcadeRun("pin-puzzle");
  const juice = useJuice();
  // Held in refs so handlers can reach them without becoming dependencies.
  const juiceRef = React.useRef(juice);
  juiceRef.current = juice;
  const runRef = React.useRef(run);
  runRef.current = run;

  /*
   * A generated level instead of three hard-coded pins.
   *
   * The game was one puzzle — pull the water pin, then the gold pin — with a
   * third pin that did nothing and a `level` that never advanced.
   *
   * Levels now vary the budget rather than a hidden order: how many coolants
   * you hold against how many golds you still owe. Both are on the board, so
   * the puzzle is counting rather than guessing.
   */
  const [puzzle, setPuzzle] = React.useState(() => buildPinLevel(1, Math.random));
  const [pulled, setPulled] = React.useState<string[]>([]);
  const [goldCollected, setGoldCollected] = React.useState(0);
  const [melted, setMelted] = React.useState(false);
  const [hint, setHint] = React.useState<string | null>(null);

  /*
   * Chamber state is replayed from the pulls rather than tracked alongside
   * them: the lava's temperature and the gold count are two views of one list,
   * and a second copy of a fact is a second thing that can disagree.
   */
  const chamber = chamberAfter(puzzle, pulled);
  const stranded = !melted && isDeadEnd(puzzle, pulled);
  const remaining = puzzle.pins.filter((p) => !pulled.includes(p.id));
  const goldLeft = remaining.filter((p) => p.content === "gold").length;
  const coolantLeft = remaining.length - goldLeft;

  const pullPin = (pinId: string) => {
    if (melted || stranded) return;
    setHint(null);

    if (!canPull(puzzle, pinId, pulled)) {
      // The only fatal move: gold onto lava that is still hot. The board said
      // so — the lava is drawn red — so this is a decision, not an ambush.
      setMelted(true);
      runRef.current.end();
      juiceRef.current.impact("fatal");
      return;
    }

    const next = [...pulled, pinId];
    const after = chamberAfter(puzzle, next);
    setPulled(next);

    if (after.goldBanked > chamber.goldBanked) {
      setGoldCollected((g) => g + 50);
      runRef.current.hit(90);
      juiceRef.current.impact("solid");
    } else {
      /*
       * A coolant pull pays nothing.
       *
       * It used to score, which meant burning every coolant and resetting the
       * chamber earned points for ever without banking a single gold. You are
       * paid for the gold you get out, not for touching pins.
       */
      juiceRef.current.impact("tap");
    }

    if (isSolved(puzzle, next)) {
      // Chamber cleared: bank it and move up a level rather than ending the
      // run. Level advance happens in exactly one place.
      const nextLevel = level + 1;
      runRef.current.hit(150);
      setLevel(nextLevel);
      setPuzzle(buildPinLevel(nextLevel, Math.random));
      setPulled([]);
    }
  };

  /** Restarts the chamber only — a stranded board should not cost the run. */
  const retryChamber = () => {
    setPuzzle(buildPinLevel(level, Math.random));
    setPulled([]);
    setHint(null);
  };

  const restart = () => {
    run.reset();
    setLevel(1);
    setPuzzle(buildPinLevel(1, Math.random));
    setPulled([]);
    setGoldCollected(0);
    setMelted(false);
    setHint(null);
  };

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-white/20 bg-gradient-to-b from-[#1e293b] via-[#0f172a] to-[#020617] p-4 sm:p-6 lg:p-8 text-white shadow-2xl">
      {/* Top Bar */}
      <div className="flex w-full items-center justify-between border-b border-white/10 pb-3 sm:pb-4">
        <div>
          <span className="text-[10px] sm:text-xs font-bold text-amber-400 uppercase tracking-widest">
            LOGIC PHYSICS
          </span>
          <h2 className="font-display text-xl sm:text-3xl font-black text-white">PIN PUZZLE</h2>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <ArcadeHud run={run} />
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-bold text-cyan-400">
            CHAMBER {level}
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/40 px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-bold text-amber-300">
            GOLD: {goldCollected}
          </div>
        </div>
      </div>

      {/*
        * The budget, stated plainly.
        *
        * This is the whole puzzle now, so it is on screen rather than
        * something the player has to keep count of in their head.
        */}
      <div className="mt-3 flex w-full max-w-2xl items-center justify-center gap-2 text-[11px] sm:text-xs font-bold">
        <span className="rounded-lg border border-sky-400/30 bg-sky-950/40 px-3 py-1 text-sky-300">
          COOLANT LEFT: {coolantLeft}
        </span>
        <span className="rounded-lg border border-amber-400/30 bg-amber-950/40 px-3 py-1 text-amber-300">
          GOLD TO DROP: {goldLeft}
        </span>
        <span
          className={`rounded-lg border px-3 py-1 ${
            chamber.lavaHot
              ? "border-rose-400/40 bg-rose-950/50 text-rose-300"
              : "border-slate-400/30 bg-slate-800/60 text-slate-300"
          }`}
        >
          LAVA: {chamber.lavaHot ? "HOT" : "COOL"}
        </span>
      </div>

      {/* Main Puzzle Chamber SVG */}
      <div
        {...juice.shakeProps}
        className="relative my-2 sm:my-4 flex flex-1 w-full max-w-2xl items-center justify-center rounded-2xl sm:rounded-3xl border border-white/20 shadow-2xl bg-cover bg-center p-3 sm:p-6 select-none"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(15,20,30,0.7), rgba(5,10,20,0.9)), url('/games/pin-puzzle-thumb.jpg')`,
        }}
      >
        <svg viewBox="0 0 300 320" className="h-full w-full">
          {/* Chamber Walls */}
          <path d="M 60 20 L 60 260 L 240 260 L 240 20" fill="none" stroke="#475569" strokeWidth="8" />

          {/*
            * The held stock, sized to what is actually left.
            *
            * These used to be a fixed picture of water and three coins that
            * never changed no matter what you pulled.
            */}
          <rect x="68" y="40" width="74" height="46" fill="#06b6d4" opacity={coolantLeft ? 0.85 : 0.15} rx="4" />
          <text x="105" y="60" fill="#fff" fontSize="11" fontWeight="bold" textAnchor="middle">COOLANT</text>
          <text x="105" y="76" fill="#fff" fontSize="14" fontWeight="bold" textAnchor="middle">{coolantLeft}</text>

          <g transform="translate(160, 40)">
            {Array.from({ length: goldLeft }).map((_, i) => (
              <circle
                key={i}
                cx={14 + i * 22}
                cy="20"
                r="9"
                fill="#facc15"
                stroke="#ca8a04"
                strokeWidth="1.5"
              />
            ))}
            <text x="35" y="52" fill="#fef08a" fontSize="11" fontWeight="bold" textAnchor="middle">
              GOLD ×{goldLeft}
            </text>
          </g>

          {/* Bottom: the lava, whose colour is the state the puzzle turns on. */}
          <rect
            x="68"
            y="190"
            width="164"
            height="60"
            fill={chamber.lavaHot ? "#ef4444" : "#475569"}
            opacity="0.85"
            rx="4"
          />
          <text x="150" y="225" fill="#fff" fontSize="12" fontWeight="bold" textAnchor="middle">
            {chamber.lavaHot ? "MOLTEN LAVA (DANGER)" : "COOLED CRUST (SAFE)"}
          </text>

          {/*
            * Every pin the level has, drawn from the level itself.
            *
            * The old version hard-coded two and left a third in the state that
            * was never rendered or used. Driving this from the generated level
            * means a pin cannot exist without doing something.
            */}
          {puzzle.pins.map((pin, i) => {
            if (pulled.includes(pin.id)) return null;
            const y = 100 + i * 15;
            const hinted = hint === pin.id;

            return (
              <g
                key={pin.id}
                transform={`translate(50, ${y})`}
                className="cursor-pointer"
                onClick={() => pullPin(pin.id)}
              >
                <rect
                  x="0"
                  y="0"
                  width="200"
                  height="10"
                  rx="3"
                  fill={hinted ? "#22c55e" : "#f59e0b"}
                  stroke="#fff"
                  strokeWidth="1.5"
                />
                {/* The head shows what this pin is holding back, which is the
                    information the puzzle is solved with. */}
                <circle cx="5" cy="5" r="11" fill={CONTENT_FILL[pin.content]} stroke="#fff" strokeWidth="1.5" />
                <text x="5" y="9" fill="#0b0f19" fontSize="10" fontWeight="bold" textAnchor="middle">
                  {CONTENT_LABEL[pin.content]}
                </text>
              </g>
            );
          })}
        </svg>

        {stranded && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md">
            <h3 className="font-display text-2xl font-black text-amber-400">NO COOLANT LEFT</h3>
            <p className="mt-1 max-w-xs text-center text-sm text-white/70">
              Not enough coolant remains to cool the lava for the gold still held. Reset the chamber
              and spend it more carefully.
            </p>
            <Button onClick={retryChamber} className="mt-4 gap-2 bg-amber-500 px-6 font-bold hover:bg-amber-600">
              <RotateCcw className="h-4 w-4" /> Reset Chamber
            </Button>
          </div>
        )}

        {melted && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md">
            <h3 className="font-display text-3xl font-black text-rose-500">GOLD MELTED!</h3>
            <p className="mt-1 text-sm text-white/70">Cool the lava before you drop the gold.</p>
            <Button onClick={restart} className="mt-4 gap-2 bg-[#7c3aed] px-6 font-bold hover:bg-[#6d28d9]">
              <RotateCcw className="h-4 w-4" /> Try Again
            </Button>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="flex w-full flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        {/*
          * The three rules, always visible.
          *
          * A puzzle whose rules are on screen is solved by reasoning; one that
          * hides them is solved by dying until you remember.
          */}
        <p className="text-[11px] leading-relaxed text-white/60 sm:text-xs">
          <span className="font-bold text-sky-300">W</span>ater cools the lava ·{" "}
          <span className="font-bold text-slate-300">R</span>ock cools it too, but only while it is
          hot · <span className="font-bold text-amber-300">G</span>old melts unless the lava is cool,
          and re-opens the vault.
        </p>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => setHint(nextSafePin(puzzle, pulled))}
            className="gap-2 text-white/70 hover:text-white"
          >
            <Lightbulb className="h-4 w-4" /> Hint
          </Button>
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
