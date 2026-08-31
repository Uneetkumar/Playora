"use client";

import * as React from "react";
import { Button } from "@playora/ui";
import { Trophy, RotateCcw, ArrowRight } from "lucide-react";

export function PinPuzzleView({ onExit }: { onExit?: () => void }) {
  const [level, setLevel] = React.useState(1);
  const [pins, setPins] = React.useState<{ [key: string]: boolean }>({
    pin1: true,
    pin2: true,
    pin3: true,
  });
  const [goldCollected, setGoldCollected] = React.useState(0);
  const [lavaNeutralized, setLavaNeutralized] = React.useState(false);
  const [gameOver, setGameOver] = React.useState(false);
  const [success, setSuccess] = React.useState(false);

  const pullPin = (pinId: string) => {
    if (gameOver || !pins[pinId]) return;

    setPins((p) => ({ ...p, [pinId]: false }));

    if (pinId === "pin1") {
      // Releases water onto lava
      setLavaNeutralized(true);
    } else if (pinId === "pin2") {
      // Releases gold
      if (lavaNeutralized) {
        setGoldCollected(50);
        setSuccess(true);
        setGameOver(true);
      } else {
        // Gold melted by lava!
        setGameOver(true);
        setSuccess(false);
      }
    }
  };

  const restart = () => {
    setPins({ pin1: true, pin2: true, pin3: true });
    setGoldCollected(0);
    setLavaNeutralized(false);
    setGameOver(false);
    setSuccess(false);
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
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-bold text-cyan-400">
            CHAMBER {level}
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/40 px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-bold text-amber-300">
            GOLD: {goldCollected}
          </div>
        </div>
      </div>

      {/* Main Puzzle Chamber SVG */}
      <div
        className="relative my-2 sm:my-4 flex flex-1 w-full max-w-2xl items-center justify-center rounded-2xl sm:rounded-3xl border border-white/20 shadow-2xl bg-cover bg-center p-3 sm:p-6 select-none"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(15,20,30,0.7), rgba(5,10,20,0.9)), url('/games/pin-puzzle-thumb.jpg')`,
        }}
      >
        <svg viewBox="0 0 300 320" className="h-full w-full">
          {/* Chamber Walls */}
          <path d="M 60 20 L 60 260 L 240 260 L 240 20" fill="none" stroke="#475569" strokeWidth="8" />
          <line x1="150" y1="20" x2="150" y2="180" stroke="#475569" strokeWidth="6" />

          {/* Left Chamber: Water */}
          <rect x="68" y="40" width="74" height="60" fill="#06b6d4" opacity="0.85" rx="4" />
          <text x="105" y="75" fill="#fff" fontSize="12" fontWeight="bold" textAnchor="middle">WATER</text>

          {/* Right Chamber: Gold Coins */}
          <g transform="translate(160, 40)">
            <circle cx="20" cy="20" r="8" fill="#facc15" stroke="#ca8a04" strokeWidth="1.5" />
            <circle cx="45" cy="20" r="8" fill="#facc15" stroke="#ca8a04" strokeWidth="1.5" />
            <circle cx="32" cy="40" r="8" fill="#facc15" stroke="#ca8a04" strokeWidth="1.5" />
            <text x="35" y="60" fill="#fef08a" fontSize="11" fontWeight="bold" textAnchor="middle">GOLD</text>
          </g>

          {/* Bottom Middle: Lava Chamber */}
          <rect
            x="68"
            y="190"
            width="164"
            height="60"
            fill={lavaNeutralized ? "#475569" : "#ef4444"}
            opacity="0.85"
            rx="4"
          />
          <text x="150" y="225" fill="#fff" fontSize="12" fontWeight="bold" textAnchor="middle">
            {lavaNeutralized ? "SOLID ROCK (SAFE)" : "MOLTEN LAVA (DANGER)"}
          </text>

          {/* Pullable Pin 1 (Water Divider) */}
          {pins.pin1 && (
            <g transform="translate(50, 100)" className="cursor-pointer" onClick={() => pullPin("pin1")}>
              <rect x="0" y="0" width="105" height="10" rx="3" fill="#f59e0b" stroke="#fff" strokeWidth="1.5" />
              <circle cx="5" cy="5" r="10" fill="#d97706" stroke="#fff" strokeWidth="1.5" />
              <text x="5" y="9" fill="#fff" fontSize="10" fontWeight="bold" textAnchor="middle">P1</text>
            </g>
          )}

          {/* Pullable Pin 2 (Gold Divider) */}
          {pins.pin2 && (
            <g transform="translate(145, 100)" className="cursor-pointer" onClick={() => pullPin("pin2")}>
              <rect x="0" y="0" width="105" height="10" rx="3" fill="#f59e0b" stroke="#fff" strokeWidth="1.5" />
              <circle cx="100" cy="5" r="10" fill="#d97706" stroke="#fff" strokeWidth="1.5" />
              <text x="100" y="9" fill="#fff" fontSize="10" fontWeight="bold" textAnchor="middle">P2</text>
            </g>
          )}
        </svg>

        {gameOver && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md">
            {success ? (
              <>
                <Trophy className="h-12 w-12 text-amber-400 animate-bounce" />
                <h3 className="font-display text-3xl font-black text-emerald-400 mt-2">CHAMBER SOLVED!</h3>
                <p className="text-sm text-white/70">Gold delivered safely to the vault!</p>
                <Button
                  onClick={() => {
                    setLevel((l) => l + 1);
                    restart();
                  }}
                  className="mt-4 gap-2 bg-emerald-500 hover:bg-emerald-600 px-6 font-bold"
                >
                  NEXT CHAMBER <ArrowRight className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <h3 className="font-display text-3xl font-black text-rose-500 mt-2">GOLD MELTED!</h3>
                <p className="text-sm text-white/70">Cool the lava with water before releasing the gold!</p>
                <Button onClick={restart} className="mt-4 gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] px-6 font-bold">
                  <RotateCcw className="h-4 w-4" /> Try Again
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="flex w-full items-center justify-between border-t border-white/10 pt-4">
        <p className="text-xs text-white/60">Click the golden pins in sequence to funnel gold safely.</p>

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
